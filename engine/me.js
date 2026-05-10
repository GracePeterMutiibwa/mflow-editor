/**
 * Generate a UUID v4 (random)
 * @returns {string} A UUID v4 string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Stall class to display a loading overlay.
 */
class Stall {
    constructor() {
        this.overlayElement = null;
        this._createStyles();
    }

    _createStyles() {
        if (document.getElementById('stall-styles')) return;

        const style = document.createElement('style');
        style.id = 'stall-styles';
        style.innerHTML = `
            .stall-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            }
            .stall-loader {
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3498db;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: stall-spin 1s linear infinite;
            }
            .stall-message {
                margin-top: 20px;
                font-size: 1.2em;
            }
            @keyframes stall-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    show(message = "Loading...") {
        if (this.overlayElement) {
            // Remove existing if any
            this.hide();
        }

        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'stall-overlay';

        const loader = document.createElement('div');
        loader.className = 'stall-loader';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'stall-message';
        messageDiv.textContent = message;

        this.overlayElement.appendChild(loader);
        this.overlayElement.appendChild(messageDiv);
        document.body.appendChild(this.overlayElement);
    }

    hide() {
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }
        this.overlayElement = null;
    }
}

/**
 * MoldoExport class to handle exporting flow data.
 */
class MoldoExport {
    constructor(flowInstance, moldoGenInstance, validateFlowFunc, showNotificationFunc) {
        this.flowInstance = flowInstance;
        this.moldoGenInstance = moldoGenInstance;
        this.validateFlowFunc = validateFlowFunc;
        this.showNotificationFunc = showNotificationFunc;
        this.exportModalElement = document.getElementById('exportFlowModal');
        this.exportModal = this.exportModalElement ? new bootstrap.Modal(this.exportModalElement) : null;
        this.confirmExportBtn = document.getElementById('confirmExportBtn');
    }

    _getVisualState() {
        const nodes = this.flowInstance.getNodes();
        const nodeStates = Object.values(nodes).map(nodeEl => {
            const rawSettings = nodeEl.dataset.settings ? JSON.parse(nodeEl.dataset.settings) : {};
            // dataset.settings is what's consistently saved by MoldoSettings modals
            const settingsToSave = rawSettings;

            // Get node type and name, preferably from node.data if available, else derive
            const derivedType = this.flowInstance.getNodeType(nodeEl).replace('-node', '').replace('-component', '');
            const nodeDataType = nodeEl.data?.type || derivedType;
            const nodeDataName = nodeEl.data?.name || nodeEl.querySelector('.node-content')?.textContent.trim() || derivedType;

            // Filter out transient highlight class before saving
            const classesToSave = nodeEl.className
                .split(' ')
                .filter(cls => cls !== 'moldo-node-highlighted')
                .join(' ');

            return {
                id: nodeEl.id,
                classes: classesToSave,
                x: parseInt(nodeEl.style.left, 10) || 0,
                y: parseInt(nodeEl.style.top, 10) || 0,
                content: nodeEl.querySelector('.node-content')?.innerHTML || '', // Save only the .node-content's innerHTML
                settings: settingsToSave,
                // Explicitly save type, name, and uuid from node.data for robust reconstruction
                dataType: nodeDataType,
                dataName: nodeDataName,
                dataUuid: nodeEl.data?.uuid
            };
        });

        const edgeStates = this.flowInstance.getEdges().map(edge => ({
            from: edge.from,
            to: edge.to
        }));

        return { nodes: nodeStates, edges: edgeStates };
    }

    _triggerDownload(jsonDataString, filename) {
        const blob = new Blob([jsonDataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _showExportModal(onConfirm) {
        if (!this.exportModal || !this.confirmExportBtn) {
            this.showNotificationFunc("Export modal not found.", true);
            return;
        }
        const filenameInput = document.getElementById('exportFilename');
        filenameInput.value = 'moldo_flow'; // Default filename

        const validateAndToggleButton = () => {
            const isValid = filenameInput.value.trim() !== '';
            this.confirmExportBtn.disabled = !isValid;
        };

        // Add input event listener for real-time validation
        filenameInput.removeEventListener('input', validateAndToggleButton); // Remove old listener if any
        filenameInput.addEventListener('input', validateAndToggleButton);

        this.confirmExportBtn.onclick = () => { // Use onclick to easily replace if modal is shown multiple times
            const filename = filenameInput.value.trim() || 'moldo_flow';
            onConfirm(filename);
            this.exportModal.hide();
        };
        validateAndToggleButton(); // Set initial button state
        this.exportModal.show();
    }

    exportCurrentFlow() {
        const validation = this.validateFlowFunc();
        if (!validation.valid) {
            this.showNotificationFunc(`Cannot export: ${validation.message}`, true);
            return;
        }

        const flowObject = this.moldoGenInstance.generateFlowObject();
        const visualState = this._getVisualState();

        const fullExportData = {
            flowObject: flowObject,
            visualState: visualState,
            version: "1.0" // Optional: add a version for future compatibility
        };

        this._showExportModal((filename) => {
            const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
            this._triggerDownload(JSON.stringify(fullExportData, null, 2), finalFilename);
            this.showNotificationFunc(`Flow exported as ${finalFilename}`);
        });
    }
}

/**
 * MoldoImport class to handle importing flow data.
 */
class MoldoImport {
    constructor(options) {
        this.flowInstance = options.flowInstance;
        this.showNotificationFunc = options.showNotificationFunc;
        this.clearEditorFunc = options.clearEditorFunc;
        this.validateFlowFunc = options.validateFlowFunc;
        this.updateTextAreaFunc = options.updateTextAreaFunc;
        this.initSettingsIndicatorsFunc = options.initSettingsIndicatorsFunc;
        this.reAttachSettingsButtonListenersFunc = options.reAttachSettingsButtonListenersFunc;
        this.updateEmptyStateFunc = options.updateEmptyStateFunc;
        this.updateRunButtonStateFunc = options.updateRunButtonStateFunc;
        this.stateCallBack = options.stateCallBack;


        this.importActive = false;

        this.fileInput = document.getElementById('importFileInput');
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
    }

    triggerFileSelect() {
        if (this.fileInput) {
            this.fileInput.click();
        } else {
            this.showNotificationFunc("Import mechanism not properly initialized.", true);
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        if (!file.name.endsWith('.json')) {
            this.showNotificationFunc("Invalid file type. Please select a .json file.", true);
            event.target.value = ''; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData.flowObject || !importedData.visualState || !importedData.visualState.nodes || !importedData.visualState.edges) {
                    throw new Error("Invalid JSON structure. Missing 'flowObject' or 'visualState'.");
                }

                await this._reconstructFlow(importedData);

                this.showNotificationFunc("Flow imported successfully!");

                // activate the import state
                this.updateImportState(1)

            } catch (error) {
                console.error("Error importing flow:", error);
                this.showNotificationFunc(`Error importing flow: ${error.message}`, true);
            } finally {
                event.target.value = ''; // Reset file input
            }
        };
        reader.onerror = () => {
            this.showNotificationFunc("Error reading file.", true);
            event.target.value = ''; // Reset file input
        };
        reader.readAsText(file);
    }

    updateImportState(stateTag) {
        this.importActive = stateTag === 1 ? true : false;

        this.stateCallBack(!this.importActive);
    }


    async _reconstructFlow(data) {
        this.clearEditorFunc(); // Clear existing flow

        // Recreate nodes
        for (const nodeState of data.visualState.nodes) {
            let nodeElement;
            if (nodeState.id === 'start-node') {
                nodeElement = document.getElementById('start-node');
                if (nodeElement) {
                    // Apply position from imported data to the existing start-node
                    nodeElement.style.left = (typeof nodeState.x === 'number' ? nodeState.x : parseInt(nodeElement.style.left, 10) || 0) + 'px';
                    nodeElement.style.top = (typeof nodeState.y === 'number' ? nodeState.y : parseInt(nodeElement.style.top, 10) || 0) + 'px';
                } else {
                    console.error("Import error: 'start-node' defined in JSON but not found on canvas after clear.");
                    // This case should ideally not happen if clearEditorFunc works as expected.
                    continue;
                }
            } else {
                nodeElement = this.flowInstance.addNode({
                    id: nodeState.id,
                    x: nodeState.x,
                    y: nodeState.y,
                    content: '', // Pass empty content; _applyNodeDataAndSettings will build it
                    className: nodeState.classes,
                    connectToLastNode: false
                });
            }

            if (nodeElement) { // Ensure nodeElement exists (it should, unless start-node was missing)
                this._applyNodeDataAndSettings(nodeElement, nodeState);
            }
        }

        // Recreate edges
        for (const edgeState of data.visualState.edges) {
            this.flowInstance.edge(edgeState.from, edgeState.to);
        }

        // Redraw edges for the start node in case its position changed
        if (document.getElementById('start-node')) {
            this.flowInstance.redrawEdgesForNode('start-node');
        }

        this.reAttachSettingsButtonListenersFunc(); // Re-attach listeners to settings buttons
        this.initSettingsIndicatorsFunc(); // Update visual indicators for settings
        this.updateTextAreaFunc();
        this.updateEmptyStateFunc();
        this.updateRunButtonStateFunc();

        // Validate the imported flow
        const validationResult = this.validateFlowFunc();
        if (!validationResult.valid) {
            this.showNotificationFunc(`Imported flow has validation issues: ${validationResult.message}`, true);
        }
    }

    _applyNodeDataAndSettings(nodeElement, nodeState) {
        // Clear any default content addNode might have put
        nodeElement.innerHTML = '';

        const importedNodeType = nodeState.dataType; // Use the reliable dataType from export
        const requiresControls = importedNodeType !== 'termination' && nodeState.id !== 'start-node' && importedNodeType !== 'decision';

        // Create and set .node-content (label part)
        const nodeContentDiv = document.createElement('div');
        nodeContentDiv.className = 'node-content';
        nodeContentDiv.textContent = nodeState.dataName || importedNodeType; // Use dataName for the label
        nodeContentDiv.setAttribute('data-type', importedNodeType); // Set data-type based on imported dataType
        nodeElement.appendChild(nodeContentDiv);

        // Programmatically add controls if required for this node type
        if (requiresControls) {
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'node-controls';
            controlsDiv.innerHTML = `
                <div class="node-divider"></div>
                <button type="button" class="node-settings-btn" title="Node Settings">
                    <i class="bi bi-gear"></i>
                </button>
            `;
            nodeElement.appendChild(controlsDiv);
        }

        // --- The rest of the function for dataset.settings and node.data remains the same ---
        nodeElement.dataset.settings = JSON.stringify(nodeState.settings || {});

        // Initialize node.data
        if (!nodeElement.data) nodeElement.data = {};

        // Populate node.data with common properties from the export
        nodeElement.data.name = nodeState.dataName || 'Imported Node';
        nodeElement.data.type = nodeState.dataType || 'unknown'; // Use the explicitly saved dataType
        nodeElement.data.uuid = nodeState.dataUuid || generateUUID();

        // Populate node.data specific structures based on node type (derived from dataType)
        const nodeTypeForData = nodeState.dataType;
        const settingsFromImport = nodeState.settings || {};

        if (nodeTypeForData === 'declaration') {
            nodeElement.data.variables = settingsFromImport.variables || [];
        } else if (nodeTypeForData === 'output') {
            nodeElement.data.outputMessage = settingsFromImport.message || '';
        } else if (nodeTypeForData === 'conditional') {
            nodeElement.data.condition = { ...settingsFromImport };
        } else if (nodeTypeForData === 'process' && nodeElement.id !== 'start-node') {
            nodeElement.data.operation = { ...settingsFromImport };
        } else if (nodeTypeForData === 'loop') {
            nodeElement.data.loop = { ...settingsFromImport };
        } else if (nodeTypeForData === 'input') {
            nodeElement.data.inputConfig = { ...settingsFromImport };
        } else if (nodeTypeForData === 'communityBlock') {
            nodeElement.data.moldName = settingsFromImport.moldName || '';
            nodeElement.data.blockId  = settingsFromImport.blockId  || '';
            // manifest is persisted in dataset.settings; restore it to node.data so all
            // live code paths (getAllDeclaredVariables, showCommunityBlockSettings) work.
            nodeElement.data.manifest = settingsFromImport.manifest || null;
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const editor = document.getElementById("moedEditor");
    const editorArea = document.getElementById("moedEditorArea");
    const toggleModeButton = document.getElementById("moedToggleMode");
    const toggleGuiButton = document.getElementById("moedToggleGuiBtn");
    const emptyState = document.getElementById("moedEmptyState");
    const textArea = document.getElementById("moedTextArea");
    const draggableComponents = document.querySelectorAll(
        ".moed-draggable-component"
    );
    const speedSlider = document.getElementById("executionSpeedSlider"); // Get slider
    const speedLabel = document.getElementById("executionSpeedLabel"); // Get label
    const runButton = document.querySelector(".moed-run-button"); // Get Run button

    let componentCounter = 0;
    let flowInstance = null;
    let lastAddedNodeId = null;
    let moldoGenInstance = null;
    let executor = null;
    let vent = null;
    let moldoImporter = null;
    let moldoExporter = null;
    let lastKnownServerStatus = false;
    let _communityBlockEditingNodeId = null; // tracks node open in community settings modal
    let _installedMolds = []; // cache of mold manifests fetched from backend
    const stall = new Stall();
    const newFlowButton = document.getElementById("moedNewFlowButton");

    // Make showNotification globally available for the settings module
    window.showNotification = showNotification;
    window.addOutputMessage = addOutputMessage;
    window.updateTextAreaContent = updateTextAreaContent;


    /**
     * Manages periodic server status checks and updates the UI accordingly.
     */
    function manageServerStatusChecks() {
        const serverStatusContainer = document.querySelector(".moed-server-status");
        const statusIndicator = serverStatusContainer ? serverStatusContainer.querySelector(".moed-status-indicator") : null;
        const statusTextElement = serverStatusContainer ? serverStatusContainer.childNodes[2] : null; // Assuming text is the 3rd child (after indicator and space)
        const runButton = document.querySelector(".moed-run-button");

        if (!serverStatusContainer || !statusIndicator || !statusTextElement || !runButton) {
            console.error("Server status UI elements not found. Cannot initialize status checks.");
            return;
        }

        // Instantiate MoldoVent if not already done
        if (!vent) { // 'vent' is now accessible as it's in the same scope
            vent = new MoldoVent();
        }

        const updateStatusAndRefreshUI = (isServerAlive) => {
            lastKnownServerStatus = isServerAlive;
            refreshRunButtonVisibility(); // Call without arguments
        };
        vent.statusCheck(updateStatusAndRefreshUI, 5000); // Check every 5 seconds
    }

    // Initialize MoldoFlow
    async function initializeMoldoFlow() {
        // Create a MoldoFlow instance with the editor area
        flowInstance = MoldoFlow.init(editorArea);

        // Create an initial "start" node if the editor is empty
        if (editorArea.querySelectorAll('.moldo-node').length === 0) {
            createStartNode();
        }

        // Initialize the output pane with a default message
        const outputContent = document.getElementById("moedOutputContent");
        if (outputContent) {
            outputContent.innerHTML = `
                <div class="output-item">
                    <span class="output-title">Flow Editor</span>
                    <span>Build your flow by dragging components from the sidebar and then run it to see the execution here.</span>
                </div>
            `;
        }

        // Initialize the settings module with the flow instance
        if (window.MoldoSettings) {
            MoldoSettings.initSettings(flowInstance);

            // Initialize settings indicators for existing nodes
            MoldoSettings.initNodeSettingsIndicators();
        }

        // Initialize MoldoGen with the flow instance
        moldoGenInstance = new MoldoGen(flowInstance);

        // load the executor (talks to FastAPI backend)
        executor = new MoldoExecutor(flowInstance)

        // Initialize the exporter
        moldoExporter = new MoldoExport(flowInstance, moldoGenInstance, validateFlowBeforeRun, showNotification);

        // Initialize the importer
        moldoImporter = new MoldoImport({
            flowInstance: flowInstance,
            showNotificationFunc: showNotification,
            clearEditorFunc: clearFlowEditor, // Pass the actual function
            validateFlowFunc: validateFlowBeforeRun,
            updateTextAreaFunc: updateTextAreaContent,
            initSettingsIndicatorsFunc: MoldoSettings.initNodeSettingsIndicators,
            reAttachSettingsButtonListenersFunc: reAttachSettingsButtonListeners,
            updateEmptyStateFunc: updateEmptyState,
            updateRunButtonStateFunc: updateRunButtonState,
            stateCallBack: disableEnableDrag
        });

        // Update text area with initial content
        updateTextAreaContent();

        // Start server status checks
        manageServerStatusChecks();
        refreshRunButtonVisibility();

        // Populate backend URL field and load installed molds
        loadEditorSettings();
        loadInstalledMolds();
        initSettingsModal();
    }

    // ── Settings & Mold (Pod) management ───────────────────────

    function loadEditorSettings() {
        const urlInput = document.getElementById('backendUrlInput');
        if (urlInput) urlInput.value = localStorage.getItem('moldo_backend_url') || 'http://127.0.0.1:8000';
    }

    async function loadInstalledMolds() {
        if (!vent) return;
        const molds = await vent.fetchMolds();
        _installedMolds = molds || [];
        refreshCommunityMoldsSidebar(molds);
        refreshSettingsMoldsList(molds);
    }

    // Returns the block-level manifest entry for a given mold+block pair.
    function _findBlockManifest(moldName, blockId) {
        const mold = _installedMolds.find(m => m.name === moldName);
        if (!mold) return null;
        return (mold.blocks || []).find(b => b.id === blockId) || null;
    }

    function refreshCommunityMoldsSidebar(molds) {
        const section = document.getElementById('communityMoldsSection');
        const list    = document.getElementById('communityMoldsList');
        if (!section || !list) return;

        list.innerHTML = '';
        let hasBlocks = false;

        (molds || []).forEach(mold => {
            if (mold.isCore) return;
            const blocks = (mold.blocks || []);
            if (!blocks.length) return;
            hasBlocks = true;

            // Group header per mold
            const header = document.createElement('div');
            header.className = 'mold-group-header';
            header.innerHTML = `<i class="bi bi-box-seam" style="font-size:11px;"></i>${mold.displayName || mold.name}`;
            list.appendChild(header);

            const group = document.createElement('div');
            group.className = 'mold-group-blocks';

            blocks.forEach(block => {
                const el = document.createElement('div');
                el.className = 'moed-draggable-component community-block';
                el.draggable = true;
                el.dataset.componentType  = 'communityBlock';
                el.dataset.moldName       = mold.name;
                el.dataset.blockId        = block.id;
                el.dataset.blockName      = block.name || block.id;
                el.dataset.moldDisplay    = mold.displayName || mold.name;
                el.dataset.blockManifest  = JSON.stringify(block);
                el.title = block.description || '';
                el.innerHTML = `
                    <span class="comp-icon community-icon"><i class="${block.icon || 'bi bi-puzzle-fill'}"></i></span>
                    <span class="comp-name">${block.name || block.id}</span>
                `;
                el.addEventListener('dragstart', handleDragStart);
                group.appendChild(el);
            });

            list.appendChild(group);
        });

        section.style.display = hasBlocks ? 'block' : 'none';
    }

    function refreshSettingsMoldsList(molds) {
        const container = document.getElementById('settingsMoldsList');
        if (!container) return;
        const community = (molds || []).filter(m => !m.isCore);
        if (!community.length) {
            container.innerHTML = '<div class="text-muted small">No molds installed yet.</div>';
            return;
        }
        container.innerHTML = community.map(m => `
            <div class="d-flex align-items-center justify-content-between mb-2 p-2 border rounded small">
                <div>
                    <strong>${m.displayName || m.name}</strong>
                    <span class="text-muted ms-2">v${m.version || '?'}</span>
                    <div class="text-muted" style="font-size:11px;">${(m.blocks || []).length} block(s)</div>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="uninstallMoldAndRefresh('${m.name}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    }

    window.uninstallMoldAndRefresh = async function(name) {
        if (!confirm(`Uninstall mold "${name}"?`)) return;
        const ok = await vent.uninstallMold(name);
        if (ok) {
            showNotification(`Mold "${name}" uninstalled.`);
            loadInstalledMolds();
        } else {
            showNotification(`Failed to uninstall "${name}".`, true);
        }
    };

    function initSettingsModal() {
        const settingsBtn = document.querySelector('.moed-settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                loadEditorSettings();
                loadInstalledMolds();
                const modal = new bootstrap.Modal(document.getElementById('editorSettingsModal'));
                modal.show();
            });
        }

        // Save settings
        const saveBtn = document.getElementById('saveEditorSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const url = (document.getElementById('backendUrlInput').value || '').trim();
                if (url) {
                    localStorage.setItem('moldo_backend_url', url);
                    showNotification('Settings saved. Reconnecting…');
                    manageServerStatusChecks();
                }
                bootstrap.Modal.getInstance(document.getElementById('editorSettingsModal'))?.hide();
            });
        }

        // Test connection button
        document.getElementById('testConnectionBtn')?.addEventListener('click', async () => {
            const resultEl = document.getElementById('connectionTestResult');
            resultEl.textContent = 'Testing…';
            const ok = await vent.isAlive();
            resultEl.textContent = ok ? '✓ Connected' : '✗ Cannot reach backend';
            resultEl.style.color = ok ? '#198754' : '#dc3545';
        });

        // Install mold button + file picker
        const installBtn  = document.getElementById('installMoldBtn');
        const fileInput   = document.getElementById('moldFileInput');
        const statusEl    = document.getElementById('installMoldStatus');

        installBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            statusEl.textContent = `Installing ${file.name}…`;
            statusEl.style.color = '';
            const result = await vent.installMold(file);
            if (result.ok) {
                statusEl.textContent = `✓ "${result.manifest?.displayName || file.name}" installed.`;
                statusEl.style.color = '#198754';
                loadInstalledMolds();
            } else {
                statusEl.textContent = `✗ ${result.error}`;
                statusEl.style.color = '#dc3545';
            }
            e.target.value = '';
        });

        // Community block settings save button
        document.getElementById('saveCommunityBlockBtn')?.addEventListener('click', () => {
            saveCommunityBlockSettings();
        });
    }

    // ── Community block drag / drop / settings ──────────────────

    function getAvailableVariables() {
        if (!flowInstance) return [];
        const vars = [];
        const seen = new Set();

        Object.values(flowInstance.getNodes()).forEach(node => {
            const type = flowInstance.getNodeType(node);

            // From declaration blocks
            if (type === 'declaration-component') {
                ((node.data || {}).variables || []).forEach(v => {
                    if (v.name && !seen.has(v.name)) {
                        vars.push(v);
                        seen.add(v.name);
                    }
                });
            }

            // From community block result variables (output fields)
            if (type === 'community-block') {
                const saved    = JSON.parse(node.dataset.settings || '{}');
                const params   = saved.params || {};
                const manifest = (node.data && node.data.manifest) || saved.manifest || null;
                ((manifest && manifest.outputs) || []).forEach(out => {
                    const varName = (params[out.id] || '').replace(/^@/, '').trim();
                    if (varName && !seen.has(varName)) {
                        vars.push({ name: varName, type: 'any' });
                        seen.add(varName);
                    }
                });
            }
        });

        return vars;
    }

    function _renderCommunityField(inp, params, availVars) {
        const cur = params[inp.id] !== undefined ? params[inp.id] : '';
        if (inp.type === 'select') {
            return `<select class="form-select" id="cb_field_${inp.id}" data-inp-id="${inp.id}">
                ${(inp.options || []).map(o =>
                    `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`
                ).join('')}
            </select>`;
        }
        if (inp.type === 'checkbox') {
            return `<div class="form-check">
                <input class="form-check-input" type="checkbox" id="cb_field_${inp.id}"
                    data-inp-id="${inp.id}" ${cur ? 'checked' : ''}>
            </div>`;
        }
        if (inp.type === 'variable') {
            if (!availVars.length) {
                return `<div class="alert alert-info py-2 small mb-0">
                    <i class="bi bi-info-circle"></i>
                    No variables declared yet - add a Declaration block first.
                </div>`;
            }
            return `<select class="form-select" id="cb_field_${inp.id}" data-inp-id="${inp.id}">
                <option value="">- select variable -</option>
                ${availVars.map(v =>
                    `<option value="@${v.name}" ${cur === '@' + v.name ? 'selected' : ''}>
                        ${v.name}${v.type ? ' (' + v.type + ')' : ''}
                    </option>`
                ).join('')}
            </select>`;
        }
        // text / number fallback
        const safeVal = String(cur).replace(/"/g, '&quot;');
        return `<input type="${inp.type === 'number' ? 'number' : 'text'}"
            class="form-control" id="cb_field_${inp.id}" data-inp-id="${inp.id}"
            value="${safeVal}" placeholder="${inp.placeholder || ''}">`;
    }

    const _PY_KEYWORDS = new Set([
        'False','None','True','and','as','assert','async','await','break','class',
        'continue','def','del','elif','else','except','finally','for','from',
        'global','if','import','in','is','lambda','nonlocal','not','or','pass',
        'raise','return','try','while','with','yield'
    ]);

    function _validateVarName(val) {
        if (!val) return { ok: false, msg: '' };
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val))
            return { ok: false, msg: 'Only letters, digits and _ - cannot start with a digit.' };
        if (_PY_KEYWORDS.has(val))
            return { ok: false, msg: `"${val}" is a Python keyword - pick a different name.` };
        return { ok: true, msg: `✓ "${val}" is a valid variable name.` };
    }

    function _renderOutputField(out, params, availVars) {
        const curVal     = (params[out.id] || '').replace(/^@/, '').trim();
        const inExisting = availVars.some(v => v.name === curVal);
        let mode = (inExisting && availVars.length) ? 'existing' : 'new';

        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3';

        // Label
        const lbl = document.createElement('label');
        lbl.className = 'form-label fw-semibold small';
        lbl.textContent = out.label || 'Save result to';
        wrapper.appendChild(lbl);

        // Toggle row
        const toggleRow = document.createElement('div');
        toggleRow.className = 'd-flex gap-2 mb-2';

        const mkBtn = (label, m) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `btn btn-sm ${mode === m ? 'btn-dark' : 'btn-outline-secondary'}`;
            b.textContent = label;
            b.dataset.m = m;
            if (m === 'existing' && !availVars.length) {
                b.disabled = true;
                b.title = 'No variables available yet';
            }
            return b;
        };
        const newBtn = mkBtn('Define new', 'new');
        const selBtn = mkBtn('Use existing', 'existing');
        toggleRow.appendChild(newBtn);
        toggleRow.appendChild(selBtn);
        wrapper.appendChild(toggleRow);

        // Hidden canonical value - the one `saveCommunityBlockSettings` reads
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.dataset.outId = out.id;
        hidden.value = curVal;
        wrapper.appendChild(hidden);

        // ── "Define new" panel ───────────────────────────────────
        const newPanel = document.createElement('div');
        newPanel.style.display = mode === 'new' ? '' : 'none';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'form-control form-control-sm';
        textInput.placeholder = 'e.g. my_result';
        textInput.value = mode === 'new' ? curVal : '';

        const fb = document.createElement('div');
        fb.className = 'form-text mt-1';
        fb.style.minHeight = '1.1em';

        function applyValidation(val) {
            const { ok, msg } = _validateVarName(val);
            textInput.classList.toggle('is-valid',   ok);
            textInput.classList.toggle('is-invalid', !!val && !ok);
            fb.style.color   = ok ? '#198754' : '#dc3545';
            fb.textContent   = msg;
            if (ok) hidden.value = val;
            else if (!val) hidden.value = '';
        }
        textInput.addEventListener('input', () => applyValidation(textInput.value.trim()));
        applyValidation(textInput.value.trim());

        newPanel.appendChild(textInput);
        newPanel.appendChild(fb);
        wrapper.appendChild(newPanel);

        // ── "Use existing" panel ─────────────────────────────────
        const selPanel = document.createElement('div');
        selPanel.style.display = mode === 'existing' ? '' : 'none';

        const sel = document.createElement('select');
        sel.className = 'form-select form-select-sm';
        const placeholderOpt = new Option('- select variable -', '');
        sel.appendChild(placeholderOpt);
        availVars.forEach(v => {
            const opt = new Option(
                `${v.name}${v.type && v.type !== 'any' ? ' (' + v.type + ')' : ''}`,
                v.name
            );
            if (mode === 'existing' && v.name === curVal) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => { hidden.value = sel.value; });
        if (mode === 'existing') hidden.value = sel.value;

        selPanel.appendChild(sel);
        wrapper.appendChild(selPanel);

        // ── Toggle logic ─────────────────────────────────────────
        function switchMode(m) {
            mode = m;
            [newBtn, selBtn].forEach(b => {
                b.classList.toggle('btn-dark',            b.dataset.m === m);
                b.classList.toggle('btn-outline-secondary', b.dataset.m !== m);
            });
            newPanel.style.display = m === 'new'      ? '' : 'none';
            selPanel.style.display = m === 'existing' ? '' : 'none';
            if (m === 'new') {
                textInput.focus();
                applyValidation(textInput.value.trim());
            } else {
                hidden.value = sel.value;
            }
        }
        newBtn.addEventListener('click', () => switchMode('new'));
        selBtn.addEventListener('click', () => switchMode('existing'));

        return wrapper;
    }

    function showCommunityBlockSettings(nodeId) {
        const nodeEl   = flowInstance && flowInstance.getNodes()[nodeId];
        if (!nodeEl || !nodeEl.data) return;

        let { manifest, moldName, blockId } = nodeEl.data;
        // Resolve manifest from all available sources, caching back onto node.data.
        if (!manifest) {
            const saved = JSON.parse(nodeEl.dataset.settings || '{}');
            manifest = saved.manifest || _findBlockManifest(moldName, blockId) || null;
            nodeEl.data.manifest = manifest;
        }
        const inputs   = (manifest && manifest.inputs) || [];
        const settings = JSON.parse(nodeEl.dataset.settings || '{}');
        const params   = settings.params || {};
        const availVars = getAvailableVariables();

        document.getElementById('communityBlockModalTitle').textContent =
            (manifest && manifest.name) || blockId || 'Block Settings';
        document.getElementById('communityBlockDescription').textContent =
            (manifest && manifest.description) || '';

        const outputs = (manifest && manifest.outputs) || [];

        const fieldsEl = document.getElementById('communityBlockFields');
        fieldsEl.innerHTML = '';

        // ── Inputs ───────────────────────────────────────────────
        if (!inputs.length && !outputs.length) {
            fieldsEl.innerHTML = '<div class="text-muted small">This block has no configurable settings.</div>';
        }

        inputs.forEach(inp => {
            const wrap = document.createElement('div');
            wrap.className = 'mb-3';
            wrap.innerHTML = `
                <label class="form-label fw-semibold" for="cb_field_${inp.id}">
                    ${inp.label || inp.id}
                    ${inp.type === 'variable' ? '<span class="badge bg-secondary ms-1" style="font-size:9px;">variable</span>' : ''}
                </label>
                ${_renderCommunityField(inp, params, availVars)}
                ${inp.description ? `<div class="form-text">${inp.description}</div>` : ''}
            `;
            fieldsEl.appendChild(wrap);
        });

        // ── Outputs (result variable selector) ───────────────────
        if (outputs.length) {
            const sep = document.createElement('div');
            sep.className = inputs.length ? 'border-top mt-3 pt-3' : '';
            const heading = document.createElement('p');
            heading.className = 'small fw-semibold text-muted mb-2 text-uppercase';
            heading.style.cssText = 'font-size:10px;letter-spacing:.05em;';
            heading.textContent = 'Store Result';
            sep.appendChild(heading);
            outputs.forEach(out => sep.appendChild(_renderOutputField(out, params, availVars)));
            fieldsEl.appendChild(sep);
        }

        // Available variable strip
        if (availVars.length) {
            const ref = document.createElement('div');
            ref.className = 'mt-3 p-2 rounded small';
            ref.style.cssText = 'background:#f5f5f5;color:#6b7280;font-size:11px;';
            ref.innerHTML = `<strong>Available variables:</strong> ${availVars.map(v => `<code>${v.name}</code>`).join(' &nbsp;')}`;
            fieldsEl.appendChild(ref);
        }

        _communityBlockEditingNodeId = nodeId;
        const modal = new bootstrap.Modal(document.getElementById('communityBlockSettingsModal'));
        modal.show();
    }

    function saveCommunityBlockSettings() {
        if (!_communityBlockEditingNodeId) return;
        const nodeEl = flowInstance && flowInstance.getNodes()[_communityBlockEditingNodeId];
        if (!nodeEl) return;

        const settings = JSON.parse(nodeEl.dataset.settings || '{}');
        const params   = {};

        // Input fields
        document.querySelectorAll('#communityBlockFields [data-inp-id]').forEach(el => {
            const key = el.dataset.inpId;
            params[key] = el.type === 'checkbox' ? el.checked : el.value;
        });

        // Output (result variable) fields
        document.querySelectorAll('#communityBlockFields [data-out-id]').forEach(el => {
            const key = el.dataset.outId;
            const val = (el.value || '').trim().replace(/^@/, '');
            if (val) params[key] = val;
        });

        settings.params = params;
        nodeEl.dataset.settings = JSON.stringify(settings);
        MoldoSettings.updateNodeSettingsIndicator(_communityBlockEditingNodeId, true);

        bootstrap.Modal.getInstance(document.getElementById('communityBlockSettingsModal'))?.hide();
        updateTextAreaContent();
        showNotification('Block settings saved.');
    }

    function createStartNode() {
        const startId = "start-node";

        // Create a start node in the center of the editor area
        const centerX = editorArea.clientWidth / 2 - 90; // Half of 180px width
        const centerY = editorArea.clientHeight / 2 - 30;

        // Simple content for start node (no settings button)
        const startNodeContent = `<div class="node-content" data-type="start">Start</div>`;

        flowInstance.addNode({
            id: startId,
            x: centerX,
            y: centerY,
            width: 180,
            height: 60,
            content: startNodeContent,
            className: "moldo-node process-node",
            connectToLastNode: false,
            uuid: generateUUID() // Add UUID as a separate property
        });

        lastAddedNodeId = startId;

        // Hide empty state since we now have a node
        updateEmptyState();

        // Update text area
        updateTextAreaContent();
    }

    // Toggle between visual and text mode
    toggleModeButton.addEventListener("click", function () {
        toggleEditorMode();
    });

    // Toggle back to visual mode from text mode
    toggleGuiButton.addEventListener("click", function () {
        toggleEditorMode();
    });

    function toggleEditorMode() {
        if (editor.classList.contains("moed-visual-mode")) {
            editor.classList.remove("moed-visual-mode");
            editor.classList.add("moed-text-mode");

            // Make sure text area is up-to-date
            updateTextAreaContent();
        } else {
            editor.classList.remove("moed-text-mode");
            editor.classList.add("moed-visual-mode");
        }
    }


    // Handle drag events for components
    draggableComponents.forEach((component) => {
        component.addEventListener("dragstart", handleDragStart);
    });

    editorArea.addEventListener("dragover", handleDragOver);
    editorArea.addEventListener("dragenter", handleDragEnter);
    editorArea.addEventListener("dragleave", handleDragLeave);
    editorArea.addEventListener("drop", handleDrop);

    function handleDragStart(e) {
        const ds = e.target.dataset;
        e.dataTransfer.setData("text/plain", JSON.stringify({
            componentType: ds.componentType,
            moldName:      ds.moldName      || null,
            blockId:       ds.blockId       || null,
            blockName:     ds.blockName     || null,
            moldDisplay:   ds.moldDisplay   || null,
            blockManifest: ds.blockManifest || null,
        }));
        e.target.classList.add("moed-dragging");
    }

    function handleDragOver(e) {
        e.preventDefault();

        // Get position relative to the editor area
        const editorRect = editorArea.getBoundingClientRect();
        const x = e.clientX - editorRect.left;
        const y = e.clientY - editorRect.top;

        // Find the closest node
        const closestNodeId = findClosestNodeTo(x, y);

        // If there are nodes in the editor but none nearby, indicate invalid drop
        if (!closestNodeId && document.querySelectorAll('.moldo-node').length > 0) {
            editorArea.classList.add("moed-drop-invalid");
            editorArea.classList.remove("moed-drop-active");
        } else {
            editorArea.classList.add("moed-drop-active");
            editorArea.classList.remove("moed-drop-invalid");
        }
    }

    function handleDragEnter(e) {
        e.preventDefault();

        // Get position relative to the editor area
        const editorRect = editorArea.getBoundingClientRect();
        const x = e.clientX - editorRect.left;
        const y = e.clientY - editorRect.top;

        // Find the closest node
        const closestNodeId = findClosestNodeTo(x, y);

        // If there are nodes in the editor but none nearby, indicate invalid drop
        if (!closestNodeId && document.querySelectorAll('.moldo-node').length > 0) {
            editorArea.classList.add("moed-drop-invalid");
        } else {
            editorArea.classList.add("moed-drop-active");
        }
    }

    function handleDragLeave(e) {
        editorArea.classList.remove("moed-drop-active");
        editorArea.classList.remove("moed-drop-invalid");
    }

    function handleDrop(e) {
        e.preventDefault();
        editorArea.classList.remove("moed-drop-active");
        editorArea.classList.remove("moed-drop-invalid");

        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            const componentType = data.componentType;

            // Get drop coordinates relative to the editor area
            const editorRect = editorArea.getBoundingClientRect();
            const x = e.clientX - editorRect.left;
            const y = e.clientY - editorRect.top;

            // Reset dragging component style
            document.querySelectorAll(".moed-dragging").forEach((el) => {
                el.classList.remove("moed-dragging");
            });

            // Find the closest node to connect to
            const closestNodeId = findClosestNodeTo(x, y);

            // Prevent orphan nodes - only allow drops if there's a node nearby
            if (!closestNodeId && document.querySelectorAll('.moldo-node').length > 0) {
                showNotification("Cannot create orphan node - drop closer to an existing node", true);
                return; // Prevent the drop
            }

            // Check if the closest node is a decision node and restrict what can be added to it
            if (closestNodeId) {
                const closestNode = document.getElementById(closestNodeId);
                const closestNodeType = flowInstance.getNodeType(closestNode);

                // If the closest node is a decision node, only allow conditional components or termination components
                if ((closestNodeType === "decision-component" || closestNodeType === "decision-node") &&
                    componentType !== "component9" && // component9 is the conditional component
                    componentType !== "component4" && // component4 is also a conditional component
                    componentType !== "component8") { // component8 is the termination component
                    showNotification("Only Conditional or Termination components can be added directly to Decision nodes", true);
                    return; // Prevent the drop
                }
            }

            // Check if the closest node can have outgoing connections
            if (closestNodeId && !flowInstance.canHaveOutgoingConnection(closestNodeId)) {
                // Show a notification that we can't connect to this node
                showNotification(`Cannot connect to node - maximum connections reached`, true);
                return; // Prevent the drop
            }

            // Create new component block as a MoldoFlow node
            createComponentNode(componentType, x, y, data);

            // Hide empty state if there are nodes
            updateEmptyState();

            // Update text area
            updateTextAreaContent();
        } catch (err) {
            console.error("Error handling drop:", err);
            showNotification(`Error: ${err.message}`);
        }
    }

    function showNotification(message, isError = false) {
        // Log to console
        if (isError) {
            console.error(message);
        } else {
            console.warn(message);
        }

        // Also show in the output pane for better visibility
        const outputContent = document.getElementById("moedOutputContent");
        if (outputContent) {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = isError ? 'output-item output-error' : 'output-item output-warning';
            notificationDiv.innerHTML = `<span>${message}</span>`;

            // Clear existing content if it's an error
            if (isError) {
                outputContent.innerHTML = '<div class="output-item"><span class="output-title">Flow Validation Error</span></div>';
            }

            outputContent.appendChild(notificationDiv);

            // Ensure proper scrolling
            requestAnimationFrame(() => {
                outputContent.scrollTo({
                    top: outputContent.scrollHeight,
                    behavior: 'smooth'
                });

                // Backup scrolling for compatibility
                setTimeout(() => {
                    outputContent.scrollTop = outputContent.scrollHeight;
                }, 50);
            });
        }
    }

    function createCommunityBlockNode(dragData, x, y) {
        componentCounter++;
        const nodeId   = `moed-component-${componentCounter}`;
        const blockName    = dragData.blockName    || 'Block';
        const moldName     = dragData.moldName     || '';
        const blockId      = dragData.blockId      || '';
        const moldDisplay  = dragData.moldDisplay  || moldName;
        const manifest     = dragData.blockManifest ? JSON.parse(dragData.blockManifest) : {};

        const nodeContent = `
            <div class="node-content" data-type="communityBlock" style="font-size:12px;">
                <span style="display:block;font-size:10px;opacity:.55;margin-bottom:2px;">${moldDisplay}</span>
                ${blockName}
            </div>
            <div class="node-controls">
                <div class="node-divider"></div>
                <button type="button" class="node-settings-btn" title="Block Settings">
                    <i class="bi bi-gear"></i>
                </button>
            </div>
        `;

        const closestNodeId = findClosestNodeTo(x, y);

        const node = flowInstance.addNode({
            id:   nodeId,
            x:    x - 90,
            y:    y - 30,
            width: 180,
            height: 60,
            content:   nodeContent,
            className: 'moldo-node community-block',
            connectToLastNode: false,
            data: { name: blockName, type: 'communityBlock', moldName, blockId, manifest }
        });

        // Save settings to dataset - manifest included so it survives export/import
        node.dataset.settings = JSON.stringify({ moldName, blockId, manifest, params: {} });
        node.data = { name: blockName, type: 'communityBlock', moldName, blockId, manifest };

        setTimeout(() => {
            const btn = document.querySelector(`#${nodeId} .node-settings-btn`);
            if (btn) btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCommunityBlockSettings(nodeId);
            });
            MoldoSettings.updateNodeSettingsIndicator(nodeId, false);
        }, 0);

        if (closestNodeId) flowInstance.edge(closestNodeId, nodeId);
        else if (lastAddedNodeId) flowInstance.edge(lastAddedNodeId, nodeId);

        lastAddedNodeId = nodeId;
        updateEmptyState();
        updateTextAreaContent();
        return node;
    }

    function createComponentNode(componentType, x, y, dragData = {}) {
        // Handle community (pod) blocks separately
        if (componentType === 'communityBlock') {
            return createCommunityBlockNode(dragData, x, y);
        }

        // Keep the original ID format
        componentCounter++;
        const nodeId = `moed-component-${componentCounter}`;

        // Generate UUID as a separate property
        const nodeUuid = generateUUID();

        // Map component types to node classes
        const componentTypes = {
            component1: 'process-node',
            component2: 'decision-node',
            component3: 'output-node',
            component4: 'conditional-component',
            component5: 'declaration-component',
            component6: 'decision-component',
            component7: 'loop-component',
            component10: 'input-component', // New component
            component8: 'termination-component'
        };

        // Map component types to node type names (for data model)
        const typeNameMap = {
            "component1": "process",
            "component2": "decision",
            "component3": "output",
            "component4": "conditional",
            "component5": "declaration",
            "component6": "decision",
            "component7": "loop",
            "component10": "input", // New component type name
            "component8": "termination",
            "component9": "conditional"
        };

        // Get appropriate class based on component type
        const nodeClass = componentTypes[componentType] || "process-node";

        // Get the node type name for data model
        const nodeTypeName = typeNameMap[componentType] || "process";

        // Get a friendly name for the component based on its type
        const componentNames = {
            "component1": "Process",
            "component2": "Decision",
            "component3": "Output",
            "component4": "Conditional",
            "component5": "Declaration",
            "component6": "Decision",
            "component7": "Loop",
            "component10": "Input", // New component friendly name
            "component8": "End",
            "component9": "Conditional"
        };

        const componentName = componentNames[componentType] || "Process";

        // Find the closest node to connect to
        const closestNodeId = findClosestNodeTo(x, y);

        // Special case for conditional component - they can ONLY be dropped directly onto decision nodes
        if (nodeClass === "conditional-component" && closestNodeId) {
            const closestNode = document.getElementById(closestNodeId);
            if (!closestNode) return null;

            const closestNodeType = flowInstance.getNodeType(closestNode);

            // Check if the closest node is a decision node
            const isDirectlyOnDecision = (
                closestNodeType === "decision-component" ||
                closestNodeType === "decision-node"
            );

            if (!isDirectlyOnDecision) {
                showNotification("Conditional nodes can only be dropped directly onto Decision nodes", true);
                return null;
            }

            // Check if this decision node already has conditional children
            const allEdges = flowInstance.getEdges();
            const existingConditionals = allEdges.filter(edge => {
                return edge.from === closestNodeId &&
                    flowInstance.getNodeType(flowInstance.getNodes()[edge.to]) === 'conditional-component';
            });

            // In this version, we'll allow multiple conditionals per decision
            // This is just to track how many for user feedback
            if (existingConditionals.length > 0) {
                showNotification(`Adding another conditional path to this decision (now ${existingConditionals.length + 1} paths)`, false);
            }
        }

        // Special case for termination nodes - they can ONLY be dropped directly onto decision or loop nodes
        if (nodeClass === "termination-component" && closestNodeId) {
            const closestNode = document.getElementById(closestNodeId);
            if (!closestNode) return null;

            const closestNodeType = flowInstance.getNodeType(closestNode);
            const allEdges = flowInstance.getEdges();

            // Check if the closest node is a decision or loop node
            const isDirectlyOnDecisionOrLoop = (
                closestNodeType === "decision-component" ||
                closestNodeType === "decision-node" ||
                closestNodeType === "loop-component"
            );

            if (!isDirectlyOnDecisionOrLoop) {
                showNotification("Termination nodes can only be dropped directly onto Decision or Loop nodes", true);
                return null;
            }

            // For decision nodes, make sure all conditionals have children
            if (closestNodeType === "decision-component" || closestNodeType === "decision-node") {
                // First, find all conditional nodes (direct children of the decision)
                const conditionalNodes = allEdges.filter(edge =>
                    edge.from === closestNodeId &&
                    flowInstance.getNodeType(flowInstance.getNodes()[edge.to]) === "conditional-component"
                ).map(edge => edge.to);

                // If there are no conditional children, we can't add a termination node
                if (conditionalNodes.length === 0) {
                    showNotification("Add at least one Conditional node before adding a Termination node", true);
                    return null;
                }

                // Check if all conditional nodes have children
                const danglingConditionals = conditionalNodes.filter(nodeId => {
                    // Count outgoing edges from this conditional node
                    const outgoingEdges = allEdges.filter(edge => edge.from === nodeId);
                    return outgoingEdges.length === 0;
                });

                if (danglingConditionals.length > 0) {
                    showNotification("All Conditional nodes must have children before adding a Termination node", true);
                    return null;
                }
            }
        }

        // For declaration-component, check that closestNode doesn't already have an outgoing connection
        // This is already handled by the canHaveOutgoingConnection check above, so we can remove this specific check

        // Create node content with settings button for appropriate nodes
        let nodeContent = '';
        if (nodeClass === "termination-component" || nodeId === "start-node" || nodeClass === "decision-node") {
            // Simple content for termination nodes, start node, and decision nodes (no settings button)
            nodeContent = `<div class="node-content" data-type="${componentType}">${componentName}</div>`;
        } else {
            // Add settings button for all other nodes
            nodeContent = `
                <div class="node-content" data-type="${componentType}">${componentName}</div>
                <div class="node-controls">
                    <div class="node-divider"></div>
                    <button type="button" class="node-settings-btn" title="Node Settings">
                        <i class="bi bi-gear"></i>
                    </button>
                </div>
            `;
        }

        // Create the node
        const node = flowInstance.addNode({
            id: nodeId,
            x: x - 90, // Center the node on the drop point (half of 180px width)
            y: y - 30,
            width: 180,
            height: 60,
            content: nodeContent,
            className: `moldo-node ${nodeClass}`,
            connectToLastNode: false, // We'll handle connections manually
            type: nodeTypeName, // Store the node type
            data: {
                name: componentName, // Store node name
                type: nodeTypeName,  // Duplicate type in data for easier access
                uuid: nodeUuid
            }
        });

        // If this is not a termination node, start node or decision node, add event listener for the settings button
        if (nodeClass !== "termination-component" && nodeId !== "start-node" && nodeClass !== "decision-node") {
            setTimeout(() => {
                const settingsBtn = document.querySelector(`#${nodeId} .node-settings-btn`);
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent dragging when clicking the button
                        if (window.MoldoSettings) {
                            MoldoSettings.showNodeSettings(nodeId);
                        } else {
                            showNotification(`Settings module not loaded`, true);
                        }
                    });
                }

                // Initialize settings indicator for the new node if applicable
                if (window.MoldoSettings && (nodeClass === "declaration-component" ||
                    nodeClass === "output-node" ||
                    nodeClass === "conditional-component" ||
                    nodeClass === "process-node" || // Keep existing
                    nodeClass === "input-component" || // Add new input component
                    nodeClass === "loop-component")) {
                    MoldoSettings.updateNodeSettingsIndicator(nodeId, false);
                }
            }, 0);
        }

        // Connect to the closest node if one was found
        if (closestNodeId) {
            flowInstance.edge(closestNodeId, nodeId);

            // Special handling for termination nodes dropped on decision nodes
            if (nodeClass === "termination-component") {
                const closestNode = document.getElementById(closestNodeId);
                const closestNodeType = flowInstance.getNodeType(closestNode);
                const allEdges = flowInstance.getEdges();

                // If this is a termination node dropped on a decision node, connect all leaf nodes
                if (closestNodeType === "decision-component" || closestNodeType === "decision-node") {
                    // First, find all conditional nodes (direct children of the decision)
                    const conditionalNodes = allEdges.filter(edge =>
                        edge.from === closestNodeId &&
                        flowInstance.getNodeType(flowInstance.getNodes()[edge.to]) === "conditional-component"
                    ).map(edge => edge.to);

                    // For each conditional branch, find leaf nodes (nodes with no outgoing edges)
                    let allLeafNodes = [];

                    for (const conditionalId of conditionalNodes) {
                        // First, find all nodes reachable from this conditional
                        const reachableFromConditional = [conditionalId];
                        const queue = [conditionalId];

                        // Breadth-first search to find all nodes in this branch
                        while (queue.length > 0) {
                            const currentId = queue.shift();

                            // Find nodes connected to the current node (excluding the termination node we're adding)
                            const connectedNodes = allEdges.filter(edge =>
                                edge.from === currentId &&
                                edge.to !== nodeId
                            ).map(edge => edge.to);

                            // Add these nodes to our reachable set and queue
                            for (const connectedId of connectedNodes) {
                                if (!reachableFromConditional.includes(connectedId)) {
                                    reachableFromConditional.push(connectedId);
                                    queue.push(connectedId);
                                }
                            }
                        }

                        // Now find which of these nodes are leaf nodes (have no outgoing edges)
                        const leafNodesInBranch = reachableFromConditional.filter(id => {
                            // Skip the conditional node itself, we don't want to connect conditionals directly to termination
                            if (id === conditionalId) return false;

                            // Check if this node has any outgoing edges
                            const hasOutgoingEdges = allEdges.some(edge =>
                                edge.from === id &&
                                reachableFromConditional.includes(edge.to) // Only count edges to nodes in this branch
                            );

                            return !hasOutgoingEdges;
                        });

                        // If this branch has no leaf nodes (e.g., only the conditional), we're in an invalid state
                        // but we should still handle it gracefully
                        if (leafNodesInBranch.length === 0) {
                            showNotification(`Warning: Conditional node ${conditionalId} has no leaf nodes`, false);
                            // We won't connect this conditional directly since that should be prevented by validation
                        } else {
                            // Add these leaf nodes to our overall collection
                            allLeafNodes = [...allLeafNodes, ...leafNodesInBranch];
                        }
                    }

                    // Connect all leaf nodes to the termination node
                    if (allLeafNodes.length > 0) {
                        allLeafNodes.forEach(leafNodeId => {
                            flowInstance.edge(leafNodeId, nodeId);
                            showNotification(`Connected leaf node ${leafNodeId} to termination node ${nodeId}`);
                        });
                    } else {
                        showNotification("Warning: No leaf nodes found to connect to termination", false);
                    }
                }
                // If this is a termination node for a loop, handle differently
                else if (closestNodeType === "loop-component") {
                    // Find all nodes reachable from the loop body entry points
                    const loopOutgoingEdges = allEdges.filter(edge => edge.from === closestNodeId);

                    // Get body entry points (excluding the termination node itself)
                    const bodyEntryPoints = loopOutgoingEdges
                        .filter(edge => {
                            const targetNode = flowInstance.getNodes()[edge.to];
                            return targetNode &&
                                edge.to !== nodeId &&
                                flowInstance.getNodeType(targetNode) !== 'termination-component';
                        })
                        .map(edge => edge.to);

                    const reachableNodes = new Set();

                    // Collect all nodes reachable from body entry points
                    bodyEntryPoints.forEach(entryId => {
                        const reachable = findReachableNodes(entryId);
                        reachable.forEach(nodeId => reachableNodes.add(nodeId));
                    });

                    // Find nodes within the body that don't have outgoing connections (dangling leaves)
                    const danglingLeaves = Array.from(reachableNodes).filter(bodyNodeId => {
                        // Skip the termination node itself
                        if (bodyNodeId === nodeId) return false;

                        // Count outgoing edges for this node
                        const outgoingEdges = allEdges.filter(edge => edge.from === bodyNodeId);
                        return outgoingEdges.length === 0;
                    });

                    // Connect each dangling leaf to the termination node
                    if (danglingLeaves.length > 0) {
                        danglingLeaves.forEach(leafNodeId => {
                            flowInstance.edge(leafNodeId, nodeId);
                            showNotification(`Connected loop leaf node ${leafNodeId} to termination node ${nodeId}`);
                        });
                    } else {
                        showNotification("No dangling leaf nodes found in loop body", false);
                    }
                }
            }
        } else if (lastAddedNodeId) {
            // Connect to the last added node if no close node was found
            flowInstance.edge(lastAddedNodeId, nodeId);
        }

        // Update the last added node id
        lastAddedNodeId = nodeId;

        // Update text area
        updateTextAreaContent();

        return node;
    }


    function findClosestNodeTo(x, y) {
        const nodes = document.querySelectorAll(".moldo-node");
        let closestNode = null;
        let closestDistance = Infinity;

        // Define a maximum distance threshold (in pixels)
        // Only nodes within this distance will be considered "nearby"
        const MAX_DISTANCE_THRESHOLD = 150; // pixels

        nodes.forEach(node => {
            const rect = node.getBoundingClientRect();
            const editorRect = editorArea.getBoundingClientRect();

            // Calculate node center position relative to editor
            const nodeX = rect.left - editorRect.left + rect.width / 2;
            const nodeY = rect.top - editorRect.top + rect.height / 2;

            // Calculate distance to drop point
            const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));

            // Check if this is the closest node so far and within threshold
            if (distance < closestDistance && distance < MAX_DISTANCE_THRESHOLD) {
                closestDistance = distance;
                closestNode = node;
            }
        });

        return closestNode ? closestNode.id : null;
    }

    /**
     * Re-attaches event listeners to settings buttons for all applicable nodes.
     * This is useful after importing a flow.
     */
    function reAttachSettingsButtonListeners() {
        if (!flowInstance || !window.MoldoSettings) return;

        const allNodes = flowInstance.getNodes();
        Object.values(allNodes).forEach(nodeElement => {
            const nodeId   = nodeElement.id;
            const nodeType = flowInstance.getNodeType(nodeElement);

            if (nodeType === 'termination-component' || nodeId === 'start-node' || nodeType === 'decision-node') return;

            const settingsBtn = nodeElement.querySelector('.node-settings-btn');
            if (!settingsBtn) return;

            // Clone to wipe any stale listeners
            const newBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);

            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (nodeType === 'community-block') {
                    showCommunityBlockSettings(nodeId);
                } else {
                    MoldoSettings.showNodeSettings(nodeId);
                }
            });
        });
    }

    function disableEnableDrag(dragState) {
        // update the drag state
        draggableComponents.forEach((component) => {
            component.draggable = dragState;
        });
    }

    function clearFlowEditor() {
        // Only proceed if we have a flow instance
        if (!flowInstance) {
            showNotification("Flow instance not initialized", true);
            return;
        }

        // Get all nodes EXCEPT the start node
        const nodesToRemove = editorArea.querySelectorAll(".moldo-node:not(#start-node)");

        // Delete nodes one by one
        nodesToRemove.forEach(node => {
            flowInstance.deleteNode(node.id);
        });

        // Ensure the start node is considered the last added node for subsequent operations
        lastAddedNodeId = 'start-node';

        const outputContent = document.getElementById("moedOutputContent");
        if (outputContent) {
            outputContent.innerHTML = `
                <div class="output-item">
                    <span class="output-title">Flow Editor</span>
                    <span>Build your flow by dragging components from the sidebar and then run it to see the execution here.</span>
                </div>
            `;

            // Ensure proper scrolling after clearing
            requestAnimationFrame(() => {
                outputContent.scrollTop = 0;
            });
        }

        // Reset highlighted elements
        if (flowInstance.resetHighlightedEdges) {
            flowInstance.resetHighlightedEdges();
        }

        // Update UI state
        updateEmptyState();

        // If start-node is somehow missing after this, recreate it.
        if (!document.getElementById('start-node')) {
            createStartNode(); // This will also set lastAddedNodeId
        }

        // Update text area
        updateTextAreaContent();

        // update the import state
        if (moldoImporter) {
            moldoImporter.updateImportState(0);
        }

        // Show confirmation
        showNotification("Flow cleared successfully");
    }

    function updateEmptyState() {
        const hasNodes = editorArea.querySelectorAll(".moldo-node").length > 0;
        emptyState.style.display = hasNodes ? "none" : "block";
    }

    // Clear button functionality
    document.querySelector(".moed-clear-button").addEventListener("click", clearFlowEditor);

    // New Flow button functionality
    if (newFlowButton) {
        newFlowButton.addEventListener("click", function (e) {
            e.preventDefault(); // Prevent default <a> tag behavior
            clearFlowEditor();
        });
    }

    // Import Flow button functionality
    const importFlowButton = document.getElementById("moedImportFlowButton");
    if (importFlowButton) {
        importFlowButton.addEventListener("click", function (e) {
            e.preventDefault();
            if (moldoImporter) moldoImporter.triggerFileSelect();
        });
    }

    // Save button functionality
    document.querySelector(".moed-save-button").addEventListener("click", function () {
        if (moldoExporter) {
            moldoExporter.exportCurrentFlow();
        } else {
            showNotification("Export module not initialized.", true);
        }
    });

    runButton.addEventListener("click", function () {
        if (!flowInstance) {
            showNotification("Flow instance not initialized", true);
            return;
        }


        executeFlowObjectRunner();
    });


    /**
     * Validate the flow before running to ensure it doesn't have unterminated loops or decisions
     * @returns {Object} An object with valid flag and message
     */
    function validateFlowBeforeRun() {
        const allNodes = flowInstance.getNodes();

        const allEdges = flowInstance.getEdges();

        // Check declaration blocks for valid variables
        const declarationBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'declaration-component')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of declarationBlocks) {
            // Read from node.data as used by runtime
            const nodeData = node.data || {};
            const variables = nodeData.variables || [];

            if (variables.length === 0) {
                return {
                    valid: false,
                    message: `Declaration block (${id}) has no variables defined. Please configure settings.`
                };
            }

        }

        // Check output blocks for valid settings
        const outputBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'output-node')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of outputBlocks) {
            // Read from node.data as used by runtime
            const nodeData = node.data || {};
            const hasMessage = !!(nodeData.outputMessage && nodeData.outputMessage.trim());

            if (!hasMessage) {
                return {
                    valid: false,
                    message: `Output block (${id}) has no message set. Please configure settings.`
                };
            }
        }

        // Check input blocks for valid settings
        const inputBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'input-component')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of inputBlocks) {
            const nodeData = node.data || {};
            const inputConfig = nodeData.inputConfig || {};
            if (!inputConfig.selectedVariable || !inputConfig.displayMessage) {
                return { valid: false, message: `Input block (${id}) is not fully configured. Please select a variable and enter a display message.` };
            }
            const variableExists = findVariable(inputConfig.selectedVariable);
            if (!variableExists) {
                return { valid: false, message: `Input block (${id}) references a non-existent variable "${inputConfig.selectedVariable}".` };
            }
        }

        // Check conditional blocks for valid conditions
        const conditionalBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'conditional-component')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of conditionalBlocks) {
            // Read from node.data as used by runtime
            const nodeData = node.data || {};
            const condition = nodeData.condition || {}; // Read the condition object
            // Check if essential parts of the condition object exist
            const hasValidCondition = !!(condition.leftVar && condition.operator &&
                (condition.useVariable ? condition.rightVar : condition.rightValue !== undefined && condition.rightValue !== null));

            if (!hasValidCondition) {
                return {
                    valid: false,
                    message: `Conditional block (${id}) is missing a valid condition. Please configure settings.`
                };
            }
        }

        // Check process blocks for valid operations
        const processBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'process-node' && id !== 'start-node') // Exclude start node if it has process-node class
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of processBlocks) {
            // Check if process node has a valid operation in node.data
            const nodeData = node.data || {};
            const operation = nodeData.operation || {};

            if (!operation.targetVariable || !operation.operation) { // Check properties within the operation object
                const nodeName = node.data && node.data.name ? node.data.name : id;
                return {
                    valid: false,
                    message: `Process node "${nodeName}" (${id}) has an invalid operation configured.`
                };
            }

            // Check if the target variable exists (using findVariable which checks node.data)
            const targetVar = findVariable(operation.targetVariable);
            if (!targetVar) {
                return {
                    valid: false,
                    message: `Process node (${id}) references undefined variable "${operation.targetVariable}". Declare it first.`
                };
            }

            // If using a variable for the right side, check it exists
            if (operation.valueType === 'variable' && operation.secondVariable) { // Check correct properties
                const rightVar = findVariable(operation.secondVariable);
                if (!rightVar) {
                    return {
                        valid: false,
                        message: `Process node (${id}) references undefined variable "${operation.secondVariable}". Declare it first.`
                    };
                }
            } else if (operation.valueType === 'value' && operation.value === undefined) {
                // If using a value, ensure it's present (unless it's an operation like sqrt that doesn't need one)
                if (operation.operation !== 'sqrt') {
                    return {
                        valid: false,
                        message: `Process node (${id}) requires a value for the operation.`
                    };
                }
            }
        }

        // Check loop component blocks for valid settings
        const loopBlocks = Object.entries(allNodes)
            .filter(([id, node]) => flowInstance.getNodeType(node) === 'loop-component')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of loopBlocks) {
            // Check if loop component has valid settings in node.data
            const nodeData = node.data || {};
            const loop = nodeData.loop || {}; // Read the loop object

            if (!loop.loopType) { // Check property within the loop object
                const nodeName = node.data && node.data.name ? node.data.name : id;
                return {
                    valid: false,
                    message: `Loop node "${nodeName}" (${id}) has no loop type defined. Configure settings.`
                };
            }

            if (loop.iterationType === 'variable') { // Check correct properties
                if (!loop.variableName) {
                    return {
                        valid: false,
                        message: `Loop node (${id}) is set to use a variable, but no variable is selected. Configure settings.`
                    };
                }
                // Check if the iteration variable exists
                const iterVar = findVariable(loop.variableName);
                if (!iterVar) {
                    return {
                        valid: false,
                        message: `Loop node (${id}) references undefined variable "${loop.variableName}". Declare it first.`
                    };
                }
                // Verify it's a numeric type
                if (iterVar.type !== 'int' && iterVar.type !== 'float') {
                    return {
                        valid: false,
                        message: `Loop iteration variable "${loop.variableName}" must be a numeric type (Integer or Float), but is "${iterVar.type}".`
                    };
                }
            } else if (loop.iterationType === 'value') { // Check correct properties
                if (loop.iterations === undefined || loop.iterations === null || loop.iterations < 1) {
                    const nodeName = node.data && node.data.name ? node.data.name : id;
                    return {
                        valid: false,
                        message: `Loop node "${nodeName}" (${id}) has an invalid number of iterations specified. Configure settings.`
                    };
                }
            } else {
                return {
                    valid: false,
                    message: `Loop node (${id}) has an invalid iteration type. Configure settings.`
                };
            }

            // Check if loop has at least one node in its body
            const outgoingEdges = allEdges.filter(edge => edge.from === id);

            // No outgoing connections at all is invalid
            if (outgoingEdges.length === 0) {
                const nodeName = node.data && node.data.name ? node.data.name : id;
                return {
                    valid: false,
                    message: `Loop node "${nodeName}" (${id}) has no connections. It must have at least one node in its body.`
                };
            }

            // Check that the loop has at most 2 outgoing edges (one for body, one for termination)
            // Note: me-flow.js connection constraints already limit this to 2.
            // if (outgoingEdges.length > 2) { ... }

            // Check if any of the direct children are NOT termination nodes (i.e., part of the loop body)
            const hasLoopBody = outgoingEdges.some(edge => {
                const targetNode = allNodes[edge.to];
                return targetNode && flowInstance.getNodeType(targetNode) !== 'termination-component';
            });

            if (!hasLoopBody) {
                const nodeName = node.data && node.data.name ? node.data.name : id;
                return {
                    valid: false,
                    message: `Loop node "${nodeName}" (${id}) has no body nodes. Connect a node (other than Termination) to the loop.`
                };
            }

            // Check if loop has a termination node for the exit path
            const hasTermination = checkNodeHasTermination(id);
            if (!hasTermination) {
                const nodeName = allNodes[id].data && allNodes[id].data.name ? allNodes[id].data.name : id;
                return {
                    valid: false,
                    message: `Loop node "${nodeName}" (${id}) requires a Termination node directly connected to it.`
                };
            }

            // Count the number of termination edges
            const terminationEdges = outgoingEdges.filter(edge => {
                const targetNode = allNodes[edge.to];
                return targetNode && flowInstance.getNodeType(targetNode) === 'termination-component';
            });

            // Loop should have exactly one termination edge
            if (terminationEdges.length !== 1) { // Ensure exactly one
                const nodeName = node.data && node.data.name ? node.data.name : id;
                return {
                    valid: false,
                    message: `Loop node "${nodeName}" (${id}) must have exactly one Termination node connected.`
                };
            }
        }

        // Check community blocks - mold installed, block exists, required params set
        const communityBlocks = Object.entries(allNodes)
            .filter(([, node]) => flowInstance.getNodeType(node) === 'community-block')
            .map(([id, node]) => ({ id, node }));

        for (const { id, node } of communityBlocks) {
            const settings  = JSON.parse(node.dataset.settings || '{}');
            const moldName  = (node.data && node.data.moldName) || settings.moldName || '';
            const blockId   = (node.data && node.data.blockId)  || settings.blockId  || '';
            const params    = settings.params || {};

            if (!moldName || !blockId) {
                return { valid: false, message: `Community block (${id}) has no mold or block configured.` };
            }

            // Verify the mold is installed
            const mold = _installedMolds.find(m => m.name === moldName);
            if (!mold) {
                return { valid: false, message: `Community block (${id}) requires mold "${moldName}" which is not installed.` };
            }

            // Verify the block exists in that mold
            const blockDef = (mold.blocks || []).find(b => b.id === blockId);
            if (!blockDef) {
                return { valid: false, message: `Community block (${id}): block "${blockId}" not found in mold "${moldName}".` };
            }

            // Verify all required inputs are filled
            for (const inp of (blockDef.inputs || [])) {
                const val = (params[inp.id] || '').toString().trim();
                if (!val) {
                    return { valid: false, message: `Community block (${id}) - "${blockDef.name || blockId}": input "${inp.label || inp.id}" is not set.` };
                }
                // If the input expects a variable reference, make sure the variable exists
                if (inp.type === 'variable' && val.startsWith('@')) {
                    const varName = val.slice(1);
                    if (!findVariable(varName)) {
                        return { valid: false, message: `Community block (${id}) - "${blockDef.name || blockId}": variable "@${varName}" is not declared.` };
                    }
                }
            }

            // Verify output variable is defined
            for (const out of (blockDef.outputs || [])) {
                const outVar = (params[out.id] || '').toString().trim();
                if (!outVar) {
                    return { valid: false, message: `Community block (${id}) - "${blockDef.name || blockId}": output variable not set.` };
                }
            }
        }

        // ... (rest of validation: decision nodes, conditional nodes, reachability) ...

        return { valid: true };
    }

    /**
     * Find all nodes that can be reached from a starting node
     * @param {string} startNodeId - The ID of the starting node
     * @returns {Array} Array of node IDs that can be reached from the starting node
     */
    function findReachableNodes(startNodeId) {
        if (!flowInstance) return [];

        const allEdges = flowInstance.getEdges();
        const allNodes = flowInstance.getNodes();

        // Check if start node exists
        if (!allNodes[startNodeId]) {
            console.warn(`findReachableNodes: Start node ${startNodeId} not found`);
            return [];
        }

        const reachable = [startNodeId];
        const queue = [startNodeId];

        // Simple breadth-first search to find all reachable nodes
        while (queue.length > 0) {
            const currentNodeId = queue.shift();

            // Skip if this node doesn't exist (might have been deleted)
            if (!allNodes[currentNodeId]) continue;

            // Find all nodes directly connected to this node
            const connectedNodes = allEdges
                .filter(edge => edge.from === currentNodeId)
                .map(edge => edge.to)
                // Filter out any IDs that don't correspond to actual nodes
                .filter(nodeId => allNodes[nodeId]);

            // Add connected nodes to the reachable list and queue if not already visited
            for (const nodeId of connectedNodes) {
                if (!reachable.includes(nodeId)) {
                    reachable.push(nodeId);
                    queue.push(nodeId);
                }
            }
        }

        return reachable;
    }

    /**
     * Check if a decision or loop node has an appropriate termination node
     * @param {string} nodeId - The ID of the node to check
     * @returns {boolean} True if the node has a termination node, false otherwise
     */
    function checkNodeHasTermination(nodeId) {
        // With our stricter requirement, we only check for direct connections to termination nodes
        const allNodes = flowInstance.getNodes();
        const allEdges = flowInstance.getEdges();

        // Get all nodes directly connected to this node
        const connectedNodes = allEdges
            .filter(edge => edge.from === nodeId)
            .map(edge => edge.to);

        // Check if any of these nodes are termination nodes
        return connectedNodes.some(connectedId => {
            const node = allNodes[connectedId];
            return node && flowInstance.getNodeType(node) === 'termination-component';
        });
    }

    /**
     * Find dangling nodes within a loop and connect them to the termination node
     * @param {string} loopNodeId - The ID of the loop node
     * @returns {boolean} True if connections were made, false otherwise
     */
    function connectDanglingLoopNodes(loopNodeId) {
        if (!flowInstance) return false;

        const allNodes = flowInstance.getNodes();
        const allEdges = flowInstance.getEdges();

        // Find the termination node for this loop
        const terminationEdge = allEdges.find(edge =>
            edge.from === loopNodeId &&
            allNodes[edge.to] &&
            flowInstance.getNodeType(allNodes[edge.to]) === 'termination-component'
        );

        if (!terminationEdge) return false;

        const terminationNodeId = terminationEdge.to;

        // Find all nodes in the loop body (excluding the termination node)
        const bodyEdges = allEdges.filter(edge =>
            edge.from === loopNodeId &&
            edge.to !== terminationNodeId
        );

        if (bodyEdges.length === 0) return false;

        // Find all nodes reachable from the loop body entry points
        const bodyEntryPoints = bodyEdges.map(edge => edge.to);
        const reachableNodes = new Set();

        // Collect all nodes reachable from body entry points
        bodyEntryPoints.forEach(entryId => {
            const reachable = findReachableNodes(entryId);
            reachable.forEach(nodeId => reachableNodes.add(nodeId));
        });

        // Remove the loop node itself and termination node from consideration
        reachableNodes.delete(loopNodeId);
        reachableNodes.delete(terminationNodeId);

        // Find nodes within the body that don't have outgoing connections (dangling leaves)
        const danglingLeaves = Array.from(reachableNodes).filter(nodeId => {
            // Count outgoing edges for this node
            const outgoingEdges = allEdges.filter(edge => edge.from === nodeId);
            return outgoingEdges.length === 0;
        });

        // Connect dangling leaves to the termination node
        let connectionsAdded = false;
        danglingLeaves.forEach(nodeId => {
            // Only connect if the node type allows outgoing connections
            if (flowInstance.canHaveOutgoingConnection(nodeId)) {
                flowInstance.edge(nodeId, terminationNodeId);
                connectionsAdded = true;
            }
        });

        return connectionsAdded;
    }

    /**
     * start execution based on the generated flow object.
     */
    async function executeFlowObjectRunner() {
        const outputContent = document.getElementById("moedOutputContent");
        outputContent.innerHTML = '';

        // Validate first
        const validationResult = validateFlowBeforeRun();

        if (!validationResult.valid) {
            showNotification(`Flow validation failed: ${validationResult.message}`, true);
            addOutputMessage(`Flow validation failed: ${validationResult.message}`, true);
            return;
        }

        if (!moldoGenInstance) {
            addOutputMessage("Error: Flow object generator not initialized.", true);
            return;
        }

        // create instance
        let flowObject;

        try {
            // generate the flow object
            flowObject = moldoGenInstance.generateFlowObject();

            if (!flowObject || !flowObject.start) {
                addOutputMessage("Error: Failed to generate valid flow object structure.", true);
                return;
            }
        } catch (genError) {
            console.error("Error generating flow object:", genError);
            addOutputMessage(`Error generating flow object: ${genError.message}`, true);
            return;
        }

        // Reset highlights
        const allNodesUI = flowInstance.getNodes();
        Object.keys(allNodesUI).forEach(nodeId => flowInstance.highlight(nodeId, false));
        flowInstance.resetHighlightedEdges();

        // Send to backend and display results
        await executor.runFlow(flowObject);

        // Re-enable run button after execution
        updateRunButtonState();
    }



    // --- Keep existing helper functions like delay, addOutputMessage --- 
    function addOutputMessage(message, isError = false) {
        const outputContent = document.getElementById("moedOutputContent");
        if (!outputContent) return;

        const div = document.createElement('div');
        div.className = isError ? 'output-item output-error' : 'output-item';

        // Copy button - visible on hover
        const copyBtn = document.createElement('button');
        copyBtn.className = 'output-copy-btn';
        copyBtn.title = 'Copy';
        const copyImg = document.createElement('img');
        copyImg.src = 'engine/assets/icons/copy.svg';
        copyImg.alt = 'copy';
        copyBtn.appendChild(copyImg);
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(String(message)).then(() => {
                copyImg.style.filter = 'hue-rotate(120deg) saturate(2)';
                setTimeout(() => { copyImg.style.filter = ''; }, 1500);
            }).catch(() => {});
        });
        div.appendChild(copyBtn);

        // Content area - rendered by MDRenderer
        const content = document.createElement('div');
        content.className = 'output-content';
        div.appendChild(content);

        outputContent.appendChild(div);

        if (typeof MDRenderer === 'function') {
            MDRenderer().load(content, String(message)).catch(() => {
                content.textContent = message;
            });
        } else {
            content.textContent = message;
        }

        requestAnimationFrame(() => { outputContent.scrollTop = outputContent.scrollHeight; });
    }


    // Function to generate and update the text representation of the flow diagram
    function updateTextAreaContent() {
        if (!textArea) return;

        const nodes = document.querySelectorAll(".moldo-node");
        if (nodes.length === 0) {
            textArea.value = "// Empty flow diagram";
            return;
        }

        let content = "// Flow Diagram Nodes:\n";

        // Simple representation of all nodes
        nodes.forEach((node, index) => {
            const nodeId = node.id;
            const nodeType = flowInstance ? flowInstance.getNodeType(node) : "unknown";

            let statusIndicator = ""; // Default to no indicator
            const currentNodeSpecificData = flowInstance.getNodes()[nodeId].data || {}; // Get data once for this node

            // Determine status indicator based on node type and its settings
            if (nodeType === 'declaration-component') {
                const variables = currentNodeSpecificData.variables || [];
                statusIndicator = variables.length > 0 ? "✓" : "○";
            } else if (nodeType === 'output-node') {
                const hasMessage = !!(currentNodeSpecificData.outputMessage && currentNodeSpecificData.outputMessage.trim());
                statusIndicator = hasMessage ? "✓" : "○";
            } else if (nodeType === 'input-component') {
                const inputConfig = currentNodeSpecificData.inputConfig || {};
                const isConfigured = !!(inputConfig.selectedVariable && inputConfig.displayMessage);
                statusIndicator = isConfigured ? "✓" : "○";
            } else if (nodeType === 'conditional-component') {
                const condition = currentNodeSpecificData.condition || {};
                const hasCondition = !!(condition.leftVar && condition.operator &&
                    (condition.useVariable ? condition.rightVar : condition.rightValue !== undefined && condition.rightValue !== null));
                statusIndicator = hasCondition ? "✓" : "○";
            } else if (nodeType === 'process-node' && nodeId !== 'start-node') { // Exclude start-node if it has process-node class
                const operation = currentNodeSpecificData.operation || {};
                const hasOperation = !!(operation.targetVariable && operation.operation);
                statusIndicator = hasOperation ? "✓" : "○";
            } else if (nodeType === 'loop-component') {
                const loop = currentNodeSpecificData.loop || {};
                // Check based on how loop settings are actually stored and validated
                const hasLoopConfig = !!(
                    loop.loopType &&
                    (loop.iterationType === 'variable' ? loop.variableName : (loop.iterations !== undefined && loop.iterations !== null))
                );
                statusIndicator = hasLoopConfig ? "✓" : "○";
            }


            // Create line for this node
            content += `${index + 1}. [${nodeId}] (${nodeType}) ${statusIndicator}\n`;

            // Add variable information for declaration blocks
            if (nodeType === 'declaration-component' && flowInstance) {
                // currentNodeSpecificData is already fetched above, can reuse or fetch again if preferred for clarity
                const nodeData = currentNodeSpecificData;
                const variables = nodeData.variables || [];

                if (variables.length > 0) {
                    content += "   Variables:\n";
                    variables.forEach(variable => {
                        content += `   - ${variable.name} (${variable.type}): ${variable.value}\n`;
                    });
                }
            }

            // Add output information for output blocks
            if (nodeType === 'output-node' && flowInstance) {
                const nodeData = currentNodeSpecificData;
                const outputMessage = nodeData.outputMessage || '';

                if (outputMessage) {
                    content += `   Message: "${outputMessage}"\n`;
                }
            }

            // Add condition information for conditional blocks
            if (nodeType === 'conditional-component' && flowInstance) {
                const nodeData = currentNodeSpecificData;
                const condition = nodeData.condition || {};

                if (condition.leftVar && condition.operator) {
                    content += `   Condition: ${MoldoSettings.generateConditionDisplayText(condition)}\n`;
                }
            }

            // Add output information for process blocks
            if (nodeType === 'process-node' && flowInstance) {
                const nodeData = currentNodeSpecificData;
                const operation = nodeData.operation || {};

                if (operation.targetVar && operation.operation) {
                    content += `   Operation: ${MoldoSettings.generateOperationDisplayText(operation)}\n`;
                }
            }
        });

        // Add information about connections
        if (flowInstance) {
            content += "\n// Connections:\n";
            const allEdges = flowInstance.getEdges();
            allEdges.forEach((edge, index) => {
                const fromNode = document.getElementById(edge.from);
                const toNode = document.getElementById(edge.to);

                const fromType = fromNode ? flowInstance.getNodeType(fromNode) : "unknown";
                const toType = toNode ? flowInstance.getNodeType(toNode) : "unknown";

                content += `${index + 1}. ${fromType} → ${toType}\n`;
            });
        }

        // Update the text area
        textArea.value = content;
    }

    /**
     * Find a variable by name from all declaration blocks
     * @param {string} name - Variable name to find
     * @returns {Object|null} Variable object if found, null otherwise
     */
    function findVariable(name) {
        if (!flowInstance) return null;

        const allNodes = flowInstance.getNodes();

        // Check all declaration blocks
        for (const nodeId in allNodes) {
            const node = allNodes[nodeId];
            if (node && flowInstance.getNodeType(node) === 'declaration-component') {
                const nodeData = node.data || {};
                const variables = nodeData.variables || [];

                // Find the variable with matching name
                const variable = variables.find(v => v.name === name);
                if (variable) {
                    return variable;
                }
            }
        }

        return null; // Variable not found
    }



    // Initialize MoldoFlow and components
    initializeMoldoFlow();
    updateEmptyState();
    updateRunButtonState(); // Initial check

    // --- Speed Slider Event Listener --- 
    if (speedSlider && speedLabel) {
        // Initial label update
        speedLabel.textContent = `Execution Speed: ${parseFloat(speedSlider.value).toFixed(1)}s`;

        speedSlider.addEventListener('input', function () {
            // Update label as slider moves
            speedLabel.textContent = `Execution Speed: ${parseFloat(this.value).toFixed(1)}s`;
        });
    } else {
        console.warn("Speed slider or label element not found.");
    }
    // --- End Listener ---

    // Set up a MutationObserver to detect changes in the editor area
    const editorObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        mutations.forEach((mutation) => {
            // Check for node additions or removals
            if (mutation.type === 'childList') {
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                    shouldUpdate = true;
                }
            }
            // Check for attribute changes that might affect the flow
            else if (mutation.type === 'attributes') {
                if (mutation.attributeName === 'style' ||
                    mutation.attributeName === 'class' ||
                    mutation.attributeName === 'id') {
                    shouldUpdate = true;
                }
            }
        });

        // Update the text area if changes were detected
        if (shouldUpdate) {
            updateTextAreaContent();

            updateRunButtonState(); // Update button state on node changes
        }
    });

    // Configure and start the observer
    editorObserver.observe(editorArea, {
        childList: true,       // Watch for node additions/removals
        attributes: true,      // Watch for attribute changes
        subtree: true,         // Watch all descendants
        characterData: true    // Watch for text changes
    });

    /**
     * Enables or disables the Run Flow button based on node count.
     */
    function updateRunButtonState() { // This function now just triggers the refresh
        refreshRunButtonVisibility();
    }

    /**
     * Checks all conditions and updates the visibility of the Run Flow button.
     * @param {boolean} [isServerAlive] - Optional server status. If not provided, it won't override current understanding.
     */
    function refreshRunButtonVisibility() { // No longer takes isServerAlive as param
        if (!runButton) return;

        const isOnline             = navigator.onLine;
        const nodeCount            = editorArea.querySelectorAll(".moldo-node").length;
        const serverIsActuallyAlive = lastKnownServerStatus;

        const serverStatusContainer = document.querySelector(".moed-server-status");
        const statusIndicator = serverStatusContainer ? serverStatusContainer.querySelector(".moed-status-indicator") : null;
        const statusTextElement = document.getElementById("moedServerStatusText") || (serverStatusContainer ? serverStatusContainer.childNodes[2] : null);

        // --- Logic for Server Status Indicator and Text ---
        if (!isOnline) {
            if (statusIndicator) statusIndicator.parentElement.classList.add("moed-disconnected");
            if (statusTextElement) statusTextElement.textContent = " Network offline";
        } else if (!serverIsActuallyAlive) {
            if (statusIndicator) statusIndicator.parentElement.classList.add("moed-disconnected");
            if (statusTextElement) statusTextElement.textContent = " Flow engine disconnected";
        } else {
            if (statusIndicator) statusIndicator.parentElement.classList.remove("moed-disconnected");
            if (statusTextElement) statusTextElement.textContent = " Flow engine connected";
        }

        // --- Logic for Run Button Visibility ---
        const environmentReadyForExecution = isOnline && serverIsActuallyAlive;

        if (environmentReadyForExecution && nodeCount > 1) {
            runButton.classList.remove('d-none');
            runButton.title = "Run Flow";
        } else {
            runButton.classList.add('d-none');
            if (!isOnline) {
                runButton.title = "Network is offline. Cannot run flow.";
            } else if (!serverIsActuallyAlive) {
                runButton.title = "Flow engine is disconnected. Cannot run flow.";
            } else {
                runButton.title = "Add more nodes to the flow to enable Run.";
            }
        }
    }
});
