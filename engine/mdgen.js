class MoldoGen {
    constructor(flowInstance) {
        if (!flowInstance) {
            throw new Error("MoldoGen requires a MoldoFlow instance.");
        }
        this.flowInstance = flowInstance;
        this.nodes = flowInstance.getNodes();
        this.edges = flowInstance.getEdges();
        this.visited = new Set();

    }

    /**
     * Finds the node connected to a given node ID via an outgoing edge.
     * For loops, it needs to distinguish between the body and the exit edge.
     * @param {string} fromNodeId - The ID of the starting node.
     * @param {boolean} [findLoopBody=false] - For loop nodes, set to true to find the body edge, false for the exit edge.
     * @param {boolean} [respectDirectTermination=false] - If true, and the direct next node is a termination node, return it instead of looking past it.
     * @returns {string|null} The ID of the connected node, or null if not found.
     */
    findNextNodeId(fromNodeId, findLoopBody = false, respectDirectTermination = false) {
        const findActualNext = (startNodeId, respectBoundary) => {
            const node = this.nodes[startNodeId];
            if (!node) return null;
            const outgoingEdges = this.edges.filter(edge => edge.from === startNodeId);
            if (outgoingEdges.length === 0) return null;

            // Assuming the first outgoing edge is the main path for non-loop/non-decision nodes.
            // More complex logic might be needed if nodes can have multiple non-conditional, non-loop-body outgoing paths.
            const nextNodeId = outgoingEdges[0].to;
            const nextNode = this.nodes[nextNodeId];
            if (!nextNode) return null; // Target node doesn't exist

            // If the direct next node is a termination node, look past it
            if (this.flowInstance.getNodeType(nextNode) === 'termination-component') {
                if (respectBoundary) {
                    console.debug(`Respecting termination boundary: ${nextNodeId} is the next node for ${startNodeId}.`);
                    return nextNodeId; // Return the termination node itself
                }
                console.debug(`Skipping termination node ${nextNodeId} (from ${startNodeId}), looking for node after it.`);
                const afterTerminationEdges = this.edges.filter(edge => edge.from === nextNodeId);
                if (afterTerminationEdges.length > 0) {
                    const finalNextNodeId = afterTerminationEdges[0].to;
                    console.debug(`Node after termination ${nextNodeId} is ${finalNextNodeId}.`);
                    // We don't need to check if *this* is a termination node again, 
                    // as that would imply consecutive termination nodes, which shouldn't be valid.
                    return finalNextNodeId;
                } else {
                    console.debug(`Termination node ${nextNodeId} is the end of this path.`);
                    return null; // Termination node is the end of the line
                }
            } else {
                return nextNodeId; // It's not a termination node, return its ID
            }
        };

        const fromNode = this.nodes[fromNodeId];
        if (!fromNode) return null;

        const nodeType = this.flowInstance.getNodeType(fromNode);
        const outgoingEdges = this.edges.filter(edge => edge.from === fromNodeId);

        if (nodeType === 'loop-component') {
            // For loop, findNextNodeId is used to find EITHER the body start OR the node after loop termination.
            // The respectDirectTermination flag is not directly applicable here as this logic is specific.
            const bodyEdge = outgoingEdges.find(edge => this.nodes[edge.to] && this.flowInstance.getNodeType(this.nodes[edge.to]) !== 'termination-component');
            const exitEdge = outgoingEdges.find(edge => this.nodes[edge.to] && this.flowInstance.getNodeType(this.nodes[edge.to]) === 'termination-component');

            if (findLoopBody) {
                return bodyEdge ? bodyEdge.to : null;
            } else { // Finding node after loop
                if (exitEdge) {
                    const terminationNodeId = exitEdge.to;
                    // We want to find what's *after* this termination node.
                    return this.findNodeAfterTermination(terminationNodeId);
                }
                return null;
            }
        } else if (nodeType === 'decision-node' || nodeType === 'decision-component') {
            // For a decision node itself, 'findNextNodeId' isn't used to get its 'next' property.
            // That's handled by findNodeAfterTermination(decisionMeta.terminationNodeId).
            // This call might be for a node *within* a decision path.
            return findActualNext(fromNodeId, respectDirectTermination);
        } else if (nodeType === 'termination-component') {
            // If called on a termination node, we always want what's after it.
            return this.findNodeAfterTermination(fromNodeId);
        } else {
            // General case for simple nodes (process, output, declaration, conditional)
            return findActualNext(fromNodeId, respectDirectTermination);
        }
    }

    /**
    * Recursively builds the flow object structure starting from a given node.
    * @param {string} nodeId - The ID of the current node to process.
    * @param {boolean} [isLoopBody=false] - Flag indicating if the current node is part of a loop body traversal.
    * @param {Set} [parentTerminationNodes=null] - Set of termination node IDs that should terminate the parent block
    * @returns {object|null} The JSON object representation for this node and its successors, or null if invalid.
    */
    buildNodeObject(nodeId, isLoopBody = false, parentTerminationNodes = null) {
        if (!nodeId || this.visited.has(nodeId)) {
            // If already visited in a non-loop context, return null to break cycles.
            if (this.visited.has(nodeId) && !isLoopBody) { // Be more specific
                console.debug(`Node ${nodeId} already visited in this path. Skipping.`);
                return null;
            }
            if (!nodeId) return null;
        }

        const nodeElement = this.nodes[nodeId];
        if (!nodeElement) return null;

        const nodeType = this.flowInstance.getNodeType(nodeElement);
        if (nodeType === 'termination-component') {
            // If we encounter a termination node, this path ends.
            // The logic for finding what's *after* a structure is handled by the structure itself.
            return null;
        }

        // Track visited nodes to prevent cycles
        this.visited.add(nodeId);

        // Initialize parent termination nodes if not provided
        if (!parentTerminationNodes) {
            parentTerminationNodes = new Set();
        }

        const nodeData = {
            nodeId: nodeId,
            type: nodeType.replace('-node', '').replace('-component', ''),
            meta: this.getNodeMeta(nodeElement, nodeType, isLoopBody, parentTerminationNodes)
        };

        // Handle special node types
        if (nodeType === 'decision-node' || nodeType === 'decision-component') {
            // nodeData.meta.decisions are built by getNodeMeta with proper context.
            // Determine the 'next' for the decision block itself.
            const decisionTerminationId = nodeData.meta.terminationNodeId;
            if (decisionTerminationId) {
                const afterDecisionNodeId = this.findNodeAfterTermination(decisionTerminationId);
                if (afterDecisionNodeId) {
                    nodeData.next = this.buildNodeObject(afterDecisionNodeId, isLoopBody, parentTerminationNodes);
                }
            } // else: decision is malformed or end of flow
        }
        else if (nodeType === 'loop-component') {
            // Get the termination node ID for this loop
            const terminationNodeId = nodeData.meta.terminationNodeId;

            // Create a set of termination nodes for this loop's context
            const loopTerminationNodes = new Set(parentTerminationNodes);
            if (terminationNodeId) {
                loopTerminationNodes.add(terminationNodeId);
            }

            // Find the first node of the loop body
            const loopBodyNodeId = this.findNextNodeId(nodeId, true, false); // respectDirectTermination is false, find actual body start

            // Process the loop body if it exists
            if (loopBodyNodeId) {
                // Process the loop body with the loop's termination nodes
                this.visited.delete(nodeId); // Allow recursion into the same node
                const bodyObject = this.buildNodeObject(loopBodyNodeId, true, loopTerminationNodes);
                this.visited.add(nodeId); // Re-add to prevent cycles

                // Store the body object in meta
                if (bodyObject) {
                    nodeData.meta.body = bodyObject;
                }
            }

            // Determine the 'next' for the loop block itself.
            const loopTerminationId = nodeData.meta.terminationNodeId; // Already fetched by getNodeMeta
            if (loopTerminationId) {
                const afterLoopNodeId = this.findNodeAfterTermination(loopTerminationId);
                if (afterLoopNodeId) {
                    this.visited.delete(nodeId); // Allow this path to be different from body path
                    nodeData.next = this.buildNodeObject(afterLoopNodeId, isLoopBody, parentTerminationNodes);
                    this.visited.add(nodeId);
                }
            } // else: loop is malformed or end of flow
        }
        else {
            // For regular nodes, find and process next node
            // Pass `isLoopBody` to `findNextNodeId` to indicate if termination boundaries should be respected
            const nextNodeId = this.findNextNodeId(nodeId, false, isLoopBody);

            if (nextNodeId) {
                const nextNodeElement = this.nodes[nextNodeId];
                const nextNodeType = nextNodeElement ? this.flowInstance.getNodeType(nextNodeElement) : null;

                if (nextNodeType === 'termination-component' &&
                    isLoopBody &&
                    parentTerminationNodes &&
                    parentTerminationNodes.has(nextNodeId)) {
                    // Current node's next is a termination node that ends this body/branch.
                    // So, no 'next' property for the current nodeData.
                } else if (nextNodeType !== 'termination-component') {
                    // Next node is a regular node, process it.
                    nodeData.next = this.buildNodeObject(nextNodeId, isLoopBody, parentTerminationNodes);
                } else if (nextNodeType === 'termination-component' && !isLoopBody) {
                    // Next node is a termination node, but we are NOT in a body.
                    // So, find what's after this termination node.
                    const afterTerminationNodeId = this.findNodeAfterTermination(nextNodeId);
                    if (afterTerminationNodeId) {
                        nodeData.next = this.buildNodeObject(afterTerminationNodeId, isLoopBody, parentTerminationNodes);
                    }
                }
            }
        }

        // Clean up visited set before returning
        this.visited.delete(nodeId);

        // Clean up empty properties
        if (nodeData.next === null || nodeData.next === undefined) {
            delete nodeData.next;
        }
        if (nodeData.meta && (nodeData.meta.body === null || nodeData.meta.body === undefined)) {
            delete nodeData.meta.body;
        }

        return nodeData;
    }

    /**
     * Helper method to find the node that comes after a termination node
     * @param {string} terminationNodeId - The ID of the termination node
     * @returns {string|null} The ID of the node after the termination, or null if none
     */
    findNodeAfterTermination(terminationNodeId) {
        const outgoingEdges = this.edges.filter(edge => edge.from === terminationNodeId);
        if (outgoingEdges.length > 0) {
            return outgoingEdges[0].to;
        }
        return null;
    }

    /**
    * Extracts the metadata ('meta') for a given node based on its type.
    * @param {HTMLElement} nodeElement - The DOM element of the node.
    * @param {string} nodeType - The type of the node.
    * @param {boolean} isLoopBodyForContext - Indicates if the current context is within a loop body.
    * @param {Set} parentTerminationNodesForContext - Set of termination nodes for the current context.
    * @returns {object} The metadata object.
    */
    getNodeMeta(nodeElement, nodeType, isLoopBodyForContext, parentTerminationNodesForContext) {
        let meta = {};
        const settingsString = nodeElement.dataset.settings;
        let settings = {};
        try {
            if (settingsString) {
                settings = JSON.parse(settingsString);
            }
        } catch (e) {
            console.error(`Error parsing settings for node ${nodeElement.id}:`, e);
        }

        switch (nodeType) {
            case 'declaration-component':
                meta = {}; // Extract variables directly into meta
                if (settings.variables && Array.isArray(settings.variables)) {
                    settings.variables.forEach(v => {
                        // Attempt to parse type correctly based on spec example
                        let value = v.value;
                        if (v.type === 'int') value = parseInt(v.value, 10);
                        else if (v.type === 'float') value = parseFloat(v.value);
                        else if (v.type === 'boolean') {
                            // Use Python-style 'True'/'False' strings
                            value = v.value.toLowerCase() === 'true' ? 'True' : 'False';
                        }
                        // Text remains string

                        // Assign the potentially converted value, handling NaN for numbers
                        if ((v.type === 'int' || v.type === 'float') && isNaN(value)) {
                            meta[v.name] = v.value; // Assign original string if parsing failed
                        } else {
                            meta[v.name] = value; // Assign parsed/converted value
                        }
                    });
                }
                break;
            case 'input-component': // For MoldoGen to correctly create meta for 'input' type
                meta = { ...settings }; // Directly copy selectedVariable, variableType, displayMessage
                // No need for fallback for variableType here as mldset.js ensures it's saved.
                break;
            case 'output-node':
                meta.message = settings.message || '';
                break;
            case 'process-node':
                // Construct the operation string as expected by the executor: "variable = expression"
                const targetVar = settings.targetVariable || '';
                const operation = settings.operation || '=';
                const valueType = settings.valueType || 'value';
                const value = settings.value || '';
                const secondVar = settings.secondVariable || '';
                let rightHandExpression = '';

                if (operation === '=') { // Simple assignment
                    rightHandExpression = (valueType === 'variable') ? secondVar : value;
                } else if (operation === '^2') { // Unary square
                    rightHandExpression = `${targetVar} * ${targetVar}`;
                } else if (operation === 'sqrt') { // Unary square root - Note: executor needs Math.sqrt
                    // Generator just creates the structure, executor needs to know how to run it.
                    // Let's generate a standard JS call for the executor.
                    rightHandExpression = `Math.sqrt(${targetVar})`;
                } else if (operation === '%') { // Modulus
                    const rightOperand = (valueType === 'variable') ? secondVar : value;
                    rightHandExpression = `${targetVar} % ${rightOperand}`;
                } else { // Binary operations (+, -, *, /)
                    const rightOperand = (valueType === 'variable') ? secondVar : value;
                    rightHandExpression = `${targetVar} ${operation} ${rightOperand}`;
                }

                // Ensure targetVar is set before creating the final string
                if (!targetVar) {
                    console.error(`Process node ${nodeElement.id} is missing target variable.`);
                    meta.operation = 'ERROR: Missing target variable'; // Indicate error in generated object
                } else {
                    meta.operation = `${targetVar} = ${rightHandExpression}`;
                }
                break;
            case 'decision-node':
            case 'decision-component':
                meta.decisions = [];
                const outgoingEdges = this.edges.filter(edge => edge.from === nodeElement.id);
                // Find the termination node associated with this decision
                const terminationEdge = outgoingEdges.find(edge =>
                    this.nodes[edge.to] && this.flowInstance.getNodeType(this.nodes[edge.to]) === 'termination-component'
                );
                meta.terminationNodeId = terminationEdge ? terminationEdge.to : null; // Store term node ID

                outgoingEdges.forEach(edge => {
                    const conditionNodeElement = this.nodes[edge.to];
                    if (conditionNodeElement && this.flowInstance.getNodeType(conditionNodeElement) === 'conditional-component') {
                        // Build the object for the conditional node and its subsequent chain.
                        // Pass the decision's context (isLoopBodyForContext) and
                        // an augmented set of parentTerminationNodes that includes the decision's own termination node.
                        const decisionBranchTerminationNodes = new Set(parentTerminationNodesForContext);
                        if (meta.terminationNodeId) {
                            decisionBranchTerminationNodes.add(meta.terminationNodeId);
                        }
                        const conditionNodeObject = this.buildNodeObject(edge.to, isLoopBodyForContext, decisionBranchTerminationNodes);
                        if (conditionNodeObject) {
                            // The structure from python spec shows condition object directly in array
                            meta.decisions.push(conditionNodeObject);
                        }
                    }
                    // Ignore termination nodes directly connected, as per spec
                });
                break;
            case 'conditional-component':
                // The meta for the condition itself
                const conditionSettingsString = nodeElement.dataset.settings;
                let conditionSettings = {};
                try {
                    if (conditionSettingsString) {
                        conditionSettings = JSON.parse(conditionSettingsString);
                    }
                } catch (e) { console.error('Error parsing condition settings', e); }
                meta = conditionSettings; // Store the full condition settings object
                break;
            case 'loop-component':
                const loopSettingsString = nodeElement.dataset.settings;
                let loopSettings = {};
                try {
                    if (loopSettingsString) {
                        loopSettings = JSON.parse(loopSettingsString);
                    }
                } catch (e) { console.error('Error parsing loop settings', e); }

                if (loopSettings.iterationType === 'variable') {
                    meta.iterations = loopSettings.variableName || '';
                } else {
                    meta.iterations = parseInt(loopSettings.iterations || '0', 10);
                }
                // 'body' is handled in buildNodeObject

                // Find and store the associated termination node ID
                const loopOutgoingEdges = this.edges.filter(edge => edge.from === nodeElement.id);
                const loopTerminationEdge = loopOutgoingEdges.find(edge =>
                    this.nodes[edge.to] && this.flowInstance.getNodeType(this.nodes[edge.to]) === 'termination-component'
                );
                meta.terminationNodeId = loopTerminationEdge ? loopTerminationEdge.to : null;
                break;
            case 'start-node':
                meta = {}; // Start node has no specific meta in the spec
                break;
            case 'termination-component':
                meta = {}; // Termination node has no meta and isn't added explicitly in decisions array
                break;
            default:
                meta = settings; // Fallback for unknown types?
        }
        return meta;
    }

    /**
     * Generates the complete flow object starting from the 'start-node'.
     * @returns {object|null} The root object of the flow structure, or null if start node not found.
     */
    generateFlowObject() {
        // --- Refresh node and edge data from the flow instance ---
        this.nodes = this.flowInstance.getNodes();
        this.edges = this.flowInstance.getEdges();
        // --- End Refresh ---

        const startNodeElement = document.getElementById('start-node'); // Assuming 'start-node' is the constant ID
        if (!startNodeElement || !this.nodes['start-node']) {
            console.error("Start node not found.");
            return null;
        }

        this.visited.clear(); // Ensure visited set is clear before starting

        // The structure starts with 'start' which contains the *next* node's data
        const firstNodeId = this.findNextNodeId('start-node', false, false); // Not in a loop body, don't respect termination for this first step

        if (!firstNodeId) {
            // Only start node exists
            return { start: {} };
        }

        let firstNodeObject = this.buildNodeObject(firstNodeId);


        return {
            start: firstNodeObject || {} // Return empty object if the first node couldn't be built
        };
    }
}



/**
 * Utility to translate flow objects to expected python syntax.
 */
class MoldoTranslator {
    constructor() {
        this.moldoCode = [];
        this.indentationLevel = 0;
        this.uniqueLoopVarCounter = 0;
    }

    // Helper for indentation
    _indent() {
        return '  '.repeat(this.indentationLevel);
    }

    // Helper to add a line of Moldo code with current indentation
    _add(line) {
        this.moldoCode.push(`${this._indent()}${line}`);
    }

    // Helper to add highlight blocks
    _addHighlight(type, id1, id2 = null, delayInSeconds = 0) {
        let highlightContent;
        if (type === 1 && id1) { // Node highlight
            highlightContent = `await moldoBridge.highlight(1, '${id1}')`;
        } else if (type === 2 && id1 && id2) { // Edge highlight
            highlightContent = `await moldoBridge.highlight(2, '${id1}|${id2}')`;
        } else {
            console.warn(`Invalid _addHighlight call: type=${type}, id1=${id1}, id2=${id2}`);
            return;
        }

        this._add(`<mblock type="highlight">${highlightContent}</mblock>`);

        this._add(`<python>time.sleep(${delayInSeconds.toFixed(3)})</python>`)


    }

    /**
     * Main method to translate the visual program object to Moldo code.
     * @param {object} program The structured JS object representing the visual program.
     * @returns {string} The generated Moldo code.
     */
    cast(program, delayInSeconds = 0) {
        this.moldoCode = [];
        this.indentationLevel = 0;
        this.uniqueLoopVarCounter = 0;

        if (program && program.start) {
            this._addHighlight(1, 'start-node', null, delayInSeconds);
            this._processBlock(program.start, 'start-node', delayInSeconds);
        }
        return this.moldoCode.join('\n');
    }

    _processBlock(block, previousNodeId, delayInSeconds = 0) {
        if (!block) {
            return;
        }

        if (previousNodeId && block.nodeId && previousNodeId !== block.nodeId) {
            this._addHighlight(2, previousNodeId, block.nodeId, delayInSeconds);
        }

        if (block.nodeId) {
            this._addHighlight(1, block.nodeId, null, delayInSeconds);
        }

        let nextBlockToProcess = block.next;
        let predecessorForNext = block.nodeId;
        switch (block.type) {
            case 'declaration':
                this._handleDeclaration(block.meta);
                break;
            case 'process':
                this._handleProcess(block.meta);
                break;
            case 'output':
                this._handleOutput(block.meta);
                break;
            case 'loop':
                this._handleLoop(block, delayInSeconds);
                nextBlockToProcess = null;
                break;
            case 'decision':
                this._handleDecision(block, delayInSeconds);
                nextBlockToProcess = null;
                break;
            case 'input': // Add this case to handle the 'input' type from flowObject
                this._handleInput(block.meta); // Call the new handler
                break;
            default:
                console.warn(`Unhandled block type: ${block.type} with nodeId: ${block.nodeId}`);
        }
        if (nextBlockToProcess) {
            this._processBlock(nextBlockToProcess, predecessorForNext, delayInSeconds);
        }
    }

    _handleDeclaration(meta) {
        for (const varName in meta) {
            if (Object.hasOwnProperty.call(meta, varName)) {
                let value = meta[varName];
                if (typeof value === 'string') {
                    const isPythonString = (value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'")) ||
                        (value.startsWith('f"') && value.endsWith('"')) ||
                        (value.startsWith("f'") && value.endsWith("'"));
                    if (!isPythonString) {
                        value = `"${value.replace(/"/g, '\\"')}"`;
                    }
                } else if (typeof value === 'boolean') {
                    value = value ? 'True' : 'False';
                }
                this._add(`<mblock type="variable">${varName} = ${value}</mblock>`);
            }
        }
    }

    _handleProcess(meta) {
        if (meta && meta.operation) {
            this._add(`<mblock type="variable">${meta.operation}</mblock>`);
        }
    }

    _handleOutput(meta) {
        if (meta && typeof meta.message === 'string') {
            // 'messageForPrint' will be what actually goes into the print mblock and log
            let messageForPrint = meta.message;

            const hasBraces = messageForPrint.includes("{") && messageForPrint.includes("}");
            const isAlreadyFString = messageForPrint.startsWith('f"') || messageForPrint.startsWith("f'");
            const isAlreadyQuoted = (messageForPrint.startsWith('"') && messageForPrint.endsWith('"')) ||
                (messageForPrint.startsWith("'") && messageForPrint.endsWith("'"));

            if (hasBraces && !isAlreadyFString) {
                // Convert to f-string if it has placeholders and isn't one already
                // Ensure internal quotes within the message are escaped for the f-string.
                messageForPrint = `f"${messageForPrint.replace(/"/g, '\\"')}"`;
            } else if (!isAlreadyFString && !isAlreadyQuoted) {
                // If not an f-string and not quoted, treat as plain text to be stringified
                // Ensure internal quotes within the message are escaped for the string.
                messageForPrint = `"${messageForPrint.replace(/"/g, '\\"')}"`;
            }
            // Now, 'messageForPrint' is the string formatted as it would be for Python.

            // Add the <mblock type="print">
            this._add(`<mblock type="print">${messageForPrint}</mblock>`);

            this._add(`<python>moldoBridge.log(${messageForPrint})</python>`);


        }
    }

    _handleInput(meta) { // New method in MoldoTranslator
        if (meta && meta.selectedVariable && meta.variableType && meta.displayMessage) {
            const varName = meta.selectedVariable;
            // Ensure variableType is a string, as it comes from settings
            // Default to "text" if type is somehow missing but shouldn't happen with proper settings saving.
            const varType = typeof meta.variableType === 'string' && meta.variableType ? meta.variableType.toLowerCase() : 'text';
            let displayMsg = meta.displayMessage;

            // Ensure displayMsg is a valid Python string literal
            // Replace backslashes first, then double quotes
            displayMsg = displayMsg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            // Enclose in double quotes for the Python string
            displayMsg = `"${displayMsg}"`;

            this._add(`<mblock type="variable">${varName} = await moldoBridge.input("${varType}", ${displayMsg})</mblock>`);
        } else {
            console.warn(`Input block meta is incomplete:`, meta);
            this._add(`<!-- Error: Input block meta incomplete for ${meta.selectedVariable || 'unknown variable'} -->`);
        }
    }

    _handleLoop(loopBlock, delayInSeconds = 0) {
        const loopVar = `loop_iter_${this.uniqueLoopVarCounter++}_${loopBlock.nodeId.replace(/-/g, '_')}`;
        const iterations = loopBlock.meta.iterations;
        const condition = `${loopVar} in range(${iterations})`;

        this._add(`<mblock type="loop" condition="${condition}">`);
        this.indentationLevel++;
        // Highlight for loop node itself is handled by _processBlock before calling _handleLoop
        // this._addHighlight(1, loopBlock.nodeId, null, delayInSeconds); // Already done by caller

        if (loopBlock.meta.body) {
            // The first node in the body will get its edge and node highlight from this _processBlock call
            this._processBlock(loopBlock.meta.body, loopBlock.nodeId, delayInSeconds);

        }

        this.indentationLevel--;
        this._add(`</mblock>`);

        let predecessorForNextBlock = loopBlock.nodeId;
        if (loopBlock.meta.terminationNodeId) {
            this._addHighlight(2, predecessorForNextBlock, loopBlock.meta.terminationNodeId, delayInSeconds);
            this._addHighlight(1, loopBlock.meta.terminationNodeId, null, delayInSeconds);
            predecessorForNextBlock = loopBlock.meta.terminationNodeId;
        }

        if (loopBlock.next) {
            this._processBlock(loopBlock.next, predecessorForNextBlock, delayInSeconds);
        }
    }

    _handleDecision(decisionBlock, delayInSeconds = 0) {
        const decisionNodeId = decisionBlock.nodeId;

        if (decisionBlock.meta.decisions && Array.isArray(decisionBlock.meta.decisions)) {
            decisionBlock.meta.decisions.forEach((conditionalBranch) => {
                if (!conditionalBranch || !conditionalBranch.meta || !conditionalBranch.nodeId) return;

                const conditionalMeta = conditionalBranch.meta;
                let conditionExpression = `${conditionalMeta.leftVar} ${conditionalMeta.operator} `;

                if (conditionalMeta.useVariable) {
                    conditionExpression += conditionalMeta.rightVar;
                } else {
                    let rightValue = conditionalMeta.rightValue;
                    if (typeof rightValue === 'string') {
                        const numVal = parseFloat(rightValue);
                        if (!isNaN(numVal) && numVal.toString() === rightValue.trim()) {
                            rightValue = numVal;
                        } else if (rightValue.toLowerCase() === 'true') {
                            rightValue = 'True';
                        } else if (rightValue.toLowerCase() === 'false') {
                            rightValue = 'False';
                        } else {
                            rightValue = `"${rightValue.replace(/"/g, '\\"')}"`;
                        }
                    } else if (typeof rightValue === 'boolean') {
                        rightValue = rightValue ? 'True' : 'False';
                    }
                    conditionExpression += rightValue;
                }

                this._add(`<mblock type="if" condition="${conditionExpression}">`);
                this.indentationLevel++;

                // Highlight for conditional branch node itself is handled by _processBlock
                // this._addHighlight(2, decisionNodeId, conditionalBranch.nodeId, delayInSeconds); // Done by _processBlock
                // this._addHighlight(1, conditionalBranch.nodeId, null, delayInSeconds); // Done by _processBlock

                if (conditionalBranch.next) {
                    this._processBlock(conditionalBranch.next, conditionalBranch.nodeId, delayInSeconds);

                }

                this.indentationLevel--;
                this._add(`</mblock>`);
            });
        }

        let predecessorForNextBlock = decisionNodeId;

        if (decisionBlock.meta.terminationNodeId) {
            // Edge to termination is not explicitly drawn from decision node, but from last node of branches.
            this._addHighlight(1, decisionBlock.meta.terminationNodeId, null, delayInSeconds);
            predecessorForNextBlock = decisionBlock.meta.terminationNodeId;
        }

        if (decisionBlock.next) {
            this._processBlock(decisionBlock.next, predecessorForNextBlock, delayInSeconds);
        }
    }
}
