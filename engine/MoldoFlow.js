/**
 * MoldoFlow.js
 * A lightweight JavaScript library for building interactive flow diagrams
 * with draggable nodes and flexible edges.
 * Features:
 * - Draggable nodes
 * - Flexible edge connections
 * - Right-click context menu for node deletion
 * - Automatic edge creation for new nodes
 * - Node type-based connection constraints
 * - Recursive deletion of child nodes
 * - Prevention of invalid connections
 */

// IIFE to avoid global scope pollution
const MoldoFlow = (function () {
    // Private variables
    let container = null;
    let nodes = {};
    let edges = [];
    let isDragging = false;
    let currentNode = null;
    let offset = { x: 0, y: 0 };
    let lastAddedNodeId = null;
    let contextMenu = null;

    // Store positions for nodes
    const nodePositions = {};

    // Connection constraints based on node type
    const connectionConstraints = {
        "start-node": {
            maxOutgoing: 1,
            allowIncoming: false
        },
        "process-node": {
            maxOutgoing: 1,
            allowIncoming: true
        },
        "input-component": { // New component
            maxOutgoing: 1,
            allowIncoming: true
        },
        "decision-node": {
            maxOutgoing: Infinity, // No limit
            allowIncoming: true
        },
        "output-node": {
            maxOutgoing: 1, // Cannot have outgoing connections
            allowIncoming: true
        },
        "declaration-component": {
            maxOutgoing: 1,
            allowIncoming: true
        },
        "decision-component": {
            maxOutgoing: Infinity, // No limit
            allowIncoming: true
        },
        "loop-component": {
            maxOutgoing: 2,
            allowIncoming: true,
            isLoop: true
        },
        "termination-component": {
            maxOutgoing: 1,
            allowIncoming: true,
            isTermination: true
        },
        "conditional-component": {
            maxOutgoing: 1,
            allowIncoming: true
        }
    };

    /**
     * Initialize the MoldoFlow instance with a container element
     * @param {HTMLElement} containerElement - The DOM element to serve as the canvas
     */
    function init(containerElement) {
        if (!containerElement || !(containerElement instanceof HTMLElement)) {
            throw new Error('MoldoFlow: Container must be a valid DOM element');
        }

        container = containerElement;

        // Set container style for proper node positioning
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // Create context menu for nodes
        createContextMenu();

        // Find all nodes with the moldo-node class and make them draggable
        const nodeElements = container.querySelectorAll('.moldo-node');
        nodeElements.forEach(setupNode);

        if (nodeElements.length > 0) {
            lastAddedNodeId = nodeElements[nodeElements.length - 1].id;
        }

        // Set up mutation observer to detect new nodes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList && node.classList.contains('moldo-node')) {
                            setupNode(node);
                        }
                    });
                }
            });
        });

        observer.observe(container, { childList: true, subtree: true });

        // Set up event listeners for dragging
        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mouseleave', handleMouseUp);

        // Handle context menu (right-click) on the container
        container.addEventListener('contextmenu', handleContextMenu);

        // Close context menu when clicking elsewhere
        document.addEventListener('click', () => {
            if (contextMenu) contextMenu.style.display = 'none';
        });

        // Redraw edges on window resize
        window.addEventListener('resize', redrawAllEdges);

        return {
            container,
            addNode,
            edge,
            disconnect,
            deleteNode,
            getNodes: () => ({ ...nodes }),
            getEdges: () => [...edges],
            canHaveOutgoingConnection,  // Expose this method
            canHaveIncomingConnection,  // Expose this method
            getAllChildNodes,          // Expose method to get child nodes
            getNodeType,               // Expose method to get node type
            highlight,                 // Expose method to highlight a node
            highlightEdge,             // Expose method to highlight an edge
            resetHighlightedEdges,     // Expose method to reset all highlighted edges
            redrawEdgesForNode         // Expose method to redraw edges for a specific node
        };
    }

    /**
     * Get the node type based on its class name
     * @param {HTMLElement} nodeElement - The node element
     * @returns {string} The node type
     */
    function getNodeType(nodeElement) {
        if (nodeElement.id === 'start-node') {
            return 'start-node';
        } else if (nodeElement.classList.contains('process-node')) {
            return 'process-node';
        } else if (nodeElement.classList.contains('decision-node')) {
            return 'decision-node';
        } else if (nodeElement.classList.contains('input-component')) { // New
            return 'input-component';
        } else if (nodeElement.classList.contains('output-node')) {
            return 'output-node';
        } else if (nodeElement.classList.contains('declaration-component')) {
            return 'declaration-component';
        } else if (nodeElement.classList.contains('decision-component')) {
            return 'decision-component';
        } else if (nodeElement.classList.contains('loop-component')) {
            return 'loop-component';
        } else if (nodeElement.classList.contains('termination-component')) {
            return 'termination-component';
        } else if (nodeElement.classList.contains('conditional-component')) {
            return 'conditional-component';
        }

        // Default to process node if no specific type is found
        return 'process-node';
    }

    /**
     * Check if a node can have an outgoing connection
     * @param {string} nodeId - ID of the node
     * @returns {boolean} True if the node can have an outgoing connection
     */
    function canHaveOutgoingConnection(nodeId) {
        const node = nodes[nodeId];
        if (!node) return false;

        const nodeType = getNodeType(node);
        const constraints = connectionConstraints[nodeType] || { maxOutgoing: 1 };

        // Count existing outgoing connections
        const outgoingEdges = edges.filter(e => e.from === nodeId);

        return outgoingEdges.length < constraints.maxOutgoing;
    }

    /**
     * Check if a node can have an incoming connection
     * @param {string} nodeId - ID of the node
     * @returns {boolean} True if the node can have an incoming connection
     */
    function canHaveIncomingConnection(nodeId) {
        const node = nodes[nodeId];
        if (!node) return false;

        const nodeType = getNodeType(node);
        const constraints = connectionConstraints[nodeType] || { allowIncoming: true };

        return constraints.allowIncoming;
    }

    /**
     * Set up a node element for dragging and tracking
     * @param {HTMLElement} nodeElement - The node element
     */
    function setupNode(nodeElement) {
        if (!nodeElement.id) {
            nodeElement.id = 'moldo-node-' + Date.now() + Math.floor(Math.random() * 1000);
        }

        // Store the node in our nodes object
        nodes[nodeElement.id] = nodeElement;

        // Make the position relative if it's not absolute or fixed
        const position = getComputedStyle(nodeElement).position;
        if (position !== 'absolute' && position !== 'fixed') {
            nodeElement.style.position = 'absolute';
        }

        // Initialize position if not already set
        if (!nodePositions[nodeElement.id]) {
            const rect = nodeElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            nodePositions[nodeElement.id] = {
                x: rect.left - containerRect.left,
                y: rect.top - containerRect.top
            };

            nodeElement.style.left = nodePositions[nodeElement.id].x + 'px';
            nodeElement.style.top = nodePositions[nodeElement.id].y + 'px';
        }

        // Add mousedown event listener
        nodeElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            currentNode = nodeElement;

            const rect = nodeElement.getBoundingClientRect();
            offset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            // Bring to front
            nodeElement.style.zIndex = '1000';

            e.preventDefault();
        });
    }

    /**
     * Handle mouse movement for dragging nodes
     * @param {MouseEvent} e - Mouse event
     */
    function handleMouseMove(e) {
        if (!isDragging || !currentNode) return;

        const containerRect = container.getBoundingClientRect();
        const x = e.clientX - containerRect.left - offset.x;
        const y = e.clientY - containerRect.top - offset.y;

        // Constrain to container boundaries
        const nodeRect = currentNode.getBoundingClientRect();
        const maxX = containerRect.width - nodeRect.width;
        const maxY = containerRect.height - nodeRect.height;

        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));

        currentNode.style.left = boundedX + 'px';
        currentNode.style.top = boundedY + 'px';

        // Store the new position
        nodePositions[currentNode.id] = { x: boundedX, y: boundedY };

        // Redraw edges connected to this node
        redrawEdgesForNode(currentNode.id);
    }

    /**
     * Handle mouse up event to stop dragging
     */
    function handleMouseUp() {
        if (currentNode) {
            currentNode.style.zIndex = '';
        }
        isDragging = false;
        currentNode = null;
    }

    /**
     * Create context menu for node deletion
     */
    function createContextMenu() {
        if (contextMenu) return;

        contextMenu = document.createElement('div');
        contextMenu.className = 'moldo-context-menu';
        contextMenu.style.position = 'absolute';
        contextMenu.style.backgroundColor = 'white';
        contextMenu.style.border = '1px solid #ccc';
        contextMenu.style.borderRadius = '4px';
        contextMenu.style.padding = '5px 0';
        contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        contextMenu.style.zIndex = '2000';
        contextMenu.style.display = 'none';

        const deleteOption = document.createElement('div');
        deleteOption.textContent = 'Delete Node';
        deleteOption.style.padding = '8px 15px';
        deleteOption.style.cursor = 'pointer';
        deleteOption.style.userSelect = 'none';

        deleteOption.addEventListener('mouseover', () => {
            deleteOption.style.backgroundColor = '#f0f0f0';
        });

        deleteOption.addEventListener('mouseout', () => {
            deleteOption.style.backgroundColor = '';
        });

        deleteOption.addEventListener('click', (e) => {
            e.stopPropagation();

            if (contextMenu.nodeId) {
                deleteNodeWithChildren(contextMenu.nodeId);
            }

            contextMenu.style.display = 'none';
        });

        contextMenu.appendChild(deleteOption);
        document.body.appendChild(contextMenu);
    }

    /**
     * Handle context menu (right-click) on nodes
     * @param {MouseEvent} e - Mouse event
     */
    function handleContextMenu(e) {
        // Only show context menu for nodes
        const node = findParentNode(e.target);

        if (!node) {
            if (contextMenu) contextMenu.style.display = 'none';
            return;
        }

        // Prevent the context menu for the start node
        if (node.id === 'start-node') {
            e.preventDefault();
            if (contextMenu) contextMenu.style.display = 'none';
            return;
        }

        e.preventDefault();

        // Position and show context menu
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
        contextMenu.style.display = 'block';
        contextMenu.nodeId = node.id;
    }

    /**
     * Find parent node element
     * @param {HTMLElement} element - Starting element
     * @returns {HTMLElement|null} - Found node element or null
     */
    function findParentNode(element) {
        let current = element;

        while (current) {
            if (current.classList && current.classList.contains('moldo-node')) {
                return current;
            }
            current = current.parentElement;
        }

        return null;
    }

    /**
     * Create a new node programmatically
     * @param {Object} options - Options for the new node
     * @returns {HTMLElement} The created node element
     */
    function addNode(options = {}) {
        const {
            id = 'moldo-node-' + Date.now() + Math.floor(Math.random() * 1000),
            x = 10,
            y = 10,
            width = 100,
            height = 50,
            content = '',
            className = '',
            connectToLastNode = true
        } = options;

        const nodeElement = document.createElement('div');
        nodeElement.id = id;
        nodeElement.className = 'moldo-node ' + className;
        nodeElement.style.position = 'absolute';
        nodeElement.style.left = x + 'px';
        nodeElement.style.top = y + 'px';
        nodeElement.style.width = width + 'px';
        nodeElement.style.height = height + 'px';
        nodeElement.innerHTML = content;

        container.appendChild(nodeElement);
        setupNode(nodeElement);

        // Connect to the last added node if requested and connection constraints allow
        if (connectToLastNode && lastAddedNodeId && nodes[lastAddedNodeId]) {
            // Check if the last node can have an outgoing connection and this node can have an incoming connection
            if (canHaveOutgoingConnection(lastAddedNodeId) && canHaveIncomingConnection(id)) {
                edge(lastAddedNodeId, id);
            }
        }

        // Update the last added node id
        lastAddedNodeId = id;

        return nodeElement;
    }

    /**
     * Create an edge between two nodes
     * @param {string} fromId - ID of the source node
     * @param {string} toId - ID of the target node
     * @returns {SVGElement|null} The created edge element or null if unsuccessful
     */
    function edge(fromId, toId) {
        const fromNode = nodes[fromId];
        const toNode = nodes[toId];

        if (!fromNode || !toNode) {
            console.error('MoldoFlow: Cannot create edge, one or both nodes not found');
            return null;
        }

        // Check if edge already exists
        const existingEdge = edges.find(e => e.from === fromId && e.to === toId);
        if (existingEdge) {
            return existingEdge.element;
        }

        // Apply connection constraints
        if (!canHaveOutgoingConnection(fromId)) {
            console.warn(`MoldoFlow: Node ${fromId} has reached its maximum number of outgoing connections`);
            return null;
        }

        if (!canHaveIncomingConnection(toId)) {
            console.warn(`MoldoFlow: Node ${toId} cannot have incoming connections`);
            return null;
        }

        // Create or get the SVG container for edges
        let svgContainer = container.querySelector('.moldo-edges-container');
        if (!svgContainer) {
            svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgContainer.classList.add('moldo-edges-container');
            svgContainer.style.position = 'absolute';
            svgContainer.style.top = '0';
            svgContainer.style.left = '0';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';
            svgContainer.style.pointerEvents = 'none';
            svgContainer.style.zIndex = '0';
            container.insertBefore(svgContainer, container.firstChild);
        }

        // Check if this is a termination edge (an edge to a termination component)
        const isTerminationEdge = toNode && getNodeType(toNode) === 'termination-component';

        // Check if this is a direct edge from a decision or loop to a termination node
        const fromNodeType = fromNode ? getNodeType(fromNode) : null;
        const isDirectDecisionToTermination = isTerminationEdge &&
            (fromNodeType === 'decision-node' || fromNodeType === 'decision-component' || fromNodeType === 'loop-component');

        // Choose the appropriate style based on the edge type
        let strokeColor, strokeWidth, strokeDasharray;

        if (isDirectDecisionToTermination) {
            // Faint dotted gray for direct decision/loop to termination
            strokeColor = '#aaaaaa';
            strokeWidth = '1.5';
            strokeDasharray = '2,3';
        } else if (isTerminationEdge) {
            // Red dashed for other termination edges (from leaf nodes)
            strokeColor = '#dc3545';
            strokeWidth = '2';
            strokeDasharray = '5,3';
        } else {
            // Default style for regular edges
            strokeColor = '#666';
            strokeWidth = '2';
            strokeDasharray = 'none';
        }

        // Create the path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', strokeColor);
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-dasharray', strokeDasharray);
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#moldo-arrow)');
        path.setAttribute('class', 'moldo-edge');

        // Create arrow marker if it doesn't exist
        if (!document.getElementById('moldo-arrow')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'moldo-arrow');
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '8');
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('orient', 'auto');

            const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
            markerPath.setAttribute('fill', '#666');

            marker.appendChild(markerPath);
            defs.appendChild(marker);
            svgContainer.appendChild(defs);
        }

        svgContainer.appendChild(path);

        // Store edge information
        const edgeInfo = {
            from: fromId,
            to: toId,
            element: path
        };

        edges.push(edgeInfo);

        // Draw the path
        updateEdgePath(edgeInfo);

        return path;
    }

    /**
     * Update the path of an edge
     * @param {Object} edgeInfo - Edge information object
     */
    function updateEdgePath(edgeInfo) {
        const fromNode = nodes[edgeInfo.from];
        const toNode = nodes[edgeInfo.to];
        const path = edgeInfo.element;

        if (!fromNode || !toNode || !path) return;

        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate center points
        const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
        const fromY = fromRect.top - containerRect.top + fromRect.height / 2;
        const toX = toRect.left - containerRect.left + toRect.width / 2;
        const toY = toRect.top - containerRect.top + toRect.height / 2;

        // Calculate control points for the bezier curve
        const dx = Math.abs(toX - fromX);
        const controlPointOffset = Math.min(80, dx * 0.5);

        // Create a path with a bezier curve
        const d = `M ${fromX},${fromY} C ${fromX + controlPointOffset},${fromY} ${toX - controlPointOffset},${toY} ${toX},${toY}`;
        path.setAttribute('d', d);
    }

    /**
     * Redraw all edges connected to a specific node
     * @param {string} nodeId - ID of the node
     */
    function redrawEdgesForNode(nodeId) {
        edges.forEach(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                updateEdgePath(edge);
            }
        });
    }

    /**
     * Redraw all edges
     */
    function redrawAllEdges() {
        edges.forEach(updateEdgePath);
    }

    /**
     * Disconnect (remove) an edge between two nodes
     * @param {string} fromId - ID of the source node
     * @param {string} toId - ID of the target node
     * @returns {boolean} True if successful, false otherwise
     */
    function disconnect(fromId, toId) {
        const edgeIndex = edges.findIndex(e => e.from === fromId && e.to === toId);

        if (edgeIndex === -1) {
            console.error('MoldoFlow: Edge not found');
            return false;
        }

        const edge = edges[edgeIndex];
        if (edge.element && edge.element.parentNode) {
            edge.element.parentNode.removeChild(edge.element);
        }

        edges.splice(edgeIndex, 1);
        return true;
    }

    /**
     * Get all child nodes of a specific node
     * @param {string} nodeId - ID of the parent node
     * @returns {Array} Array of child node IDs
     */
    function getAllChildNodes(nodeId) {
        const result = [];
        const visited = new Set();

        function dfs(currentId) {
            if (visited.has(currentId)) return;
            visited.add(currentId);

            // Find all direct children
            const childEdges = edges.filter(e => e.from === currentId);
            for (const edge of childEdges) {
                result.push(edge.to);
                dfs(edge.to); // Recursively find children of this child
            }
        }

        dfs(nodeId);
        return result;
    }

    /**
     * Delete a node with all its child nodes recursively
     * @param {string} nodeId - ID of the node to delete
     * @returns {boolean} True if successful, false otherwise
     */
    function deleteNodeWithChildren(nodeId) {
        // Get all child nodes first
        const childrenIds = getAllChildNodes(nodeId);

        // Delete children first (from leaves up to avoid orphan references)
        // We need to find the leaf nodes (nodes with no children) and delete them first
        let deletedNodes = new Set();

        // Keep deleting until all nodes are gone
        while (childrenIds.length > 0) {
            for (let i = childrenIds.length - 1; i >= 0; i--) {
                const childId = childrenIds[i];

                // Check if this node has any children that aren't already deleted
                const hasRemainingChildren = edges.some(e =>
                    e.from === childId &&
                    !deletedNodes.has(e.to) &&
                    childrenIds.includes(e.to)
                );

                if (!hasRemainingChildren) {
                    // This is a leaf node or all its children are deleted, so delete it
                    deleteNode(childId);
                    deletedNodes.add(childId);
                    childrenIds.splice(i, 1);
                }
            }
        }

        // Finally delete the parent node
        return deleteNode(nodeId);
    }

    /**
     * Delete a node and its connected edges
     * @param {string} nodeId - ID of the node to delete
     * @returns {boolean} True if successful, false otherwise
     */
    function deleteNode(nodeId) {
        const node = nodes[nodeId];

        if (!node) {
            console.error('MoldoFlow: Node not found');
            return false;
        }

        // Remove connected edges
        edges = edges.filter(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                if (edge.element && edge.element.parentNode) {
                    edge.element.parentNode.removeChild(edge.element);
                }
                return false;
            }
            return true;
        });

        // Remove node from the DOM
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }

        // Remove from nodes object and positions
        delete nodes[nodeId];
        delete nodePositions[nodeId];

        return true;
    }

    /**
     * Highlight a node with a glowing effect
     * @param {string} nodeId - ID of the node to highlight
     * @param {boolean} [active=true] - Whether to activate or deactivate the highlight
     */
    function highlight(nodeId, active = true) {
        const node = nodes[nodeId];
        if (!node) return;

        // Remove highlight from all nodes first
        Object.values(nodes).forEach(n => {
            n.classList.remove('moldo-node-highlighted');
        });

        if (active) {
            // Add highlight to the specified node
            node.classList.add('moldo-node-highlighted');
        }
    }

    /**
     * Highlight an edge with a color to indicate execution path
     * @param {string} fromId - ID of the source node
     * @param {string} toId - ID of the target node
     * @param {boolean} [highlight=true] - Whether to highlight or reset the edge
     */
    function highlightEdge(fromId, toId, highlight = true) {
        // Find the edge
        const edgeInfo = edges.find(e => e.from === fromId && e.to === toId);
        if (!edgeInfo || !edgeInfo.element) return;

        if (highlight) {
            // Store the original attributes for later restoration
            if (!edgeInfo.originalStyle) {
                edgeInfo.originalStyle = {
                    stroke: edgeInfo.element.getAttribute('stroke'),
                    strokeWidth: edgeInfo.element.getAttribute('stroke-width'),
                    strokeDasharray: edgeInfo.element.getAttribute('stroke-dasharray')
                };
            }

            // Highlight the edge with a greenish color
            edgeInfo.element.setAttribute('stroke', '#5fcb41');
            edgeInfo.element.setAttribute('stroke-width', '3');
            edgeInfo.element.setAttribute('stroke-dasharray', '5,3');
            edgeInfo.element.classList.add('moldo-edge-highlighted');

            // Create a glow effect for the edge (SVG filter)
            let filter = document.getElementById('glow-filter');
            if (!filter) {
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                filter.setAttribute('id', 'glow-filter');
                filter.setAttribute('x', '-20%');
                filter.setAttribute('y', '-20%');
                filter.setAttribute('width', '140%');
                filter.setAttribute('height', '140%');

                const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
                feGaussianBlur.setAttribute('stdDeviation', '3');
                feGaussianBlur.setAttribute('result', 'blur');

                const feComponentTransfer = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
                feComponentTransfer.setAttribute('in', 'blur');
                feComponentTransfer.setAttribute('result', 'glow');

                const feFuncA = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
                feFuncA.setAttribute('type', 'linear');
                feFuncA.setAttribute('slope', '0.5');
                feFuncA.setAttribute('intercept', '0');

                feComponentTransfer.appendChild(feFuncA);
                filter.appendChild(feGaussianBlur);
                filter.appendChild(feComponentTransfer);

                const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');

                const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
                feMergeNode1.setAttribute('in', 'glow');

                const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
                feMergeNode2.setAttribute('in', 'SourceGraphic');

                feMerge.appendChild(feMergeNode1);
                feMerge.appendChild(feMergeNode2);
                filter.appendChild(feMerge);

                defs.appendChild(filter);

                // Find the SVG container
                const svgContainer = edgeInfo.element.parentNode;
                if (svgContainer) {
                    svgContainer.appendChild(defs);
                }
            }

            // Apply the filter to the edge
            edgeInfo.element.setAttribute('filter', 'url(#glow-filter)');
        } else if (edgeInfo.originalStyle) {
            // Restore the original attributes
            edgeInfo.element.setAttribute('stroke', edgeInfo.originalStyle.stroke);
            edgeInfo.element.setAttribute('stroke-width', edgeInfo.originalStyle.strokeWidth);
            edgeInfo.element.setAttribute('stroke-dasharray', edgeInfo.originalStyle.strokeDasharray);
            edgeInfo.element.classList.remove('moldo-edge-highlighted');
            edgeInfo.element.removeAttribute('filter');
        }
    }

    /**
     * Reset all highlighted edges to their original appearance
     */
    function resetHighlightedEdges() {
        edges.forEach(edge => {
            if (edge.element && edge.originalStyle) {
                edge.element.setAttribute('stroke', edge.originalStyle.stroke);
                edge.element.setAttribute('stroke-width', edge.originalStyle.strokeWidth);
                edge.element.setAttribute('stroke-dasharray', edge.originalStyle.strokeDasharray);
                edge.element.classList.remove('moldo-edge-highlighted');
                edge.element.removeAttribute('filter');
                // Clear the stored original style
                delete edge.originalStyle;
            }
        });
    }

    // Public API
    return {
        init,
        addNode
    };
})();

// Export for use in CommonJS or ES modules
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = MoldoFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function () {
        return MoldoFlow;
    });
} else {
    window.MoldoFlow = MoldoFlow;
}