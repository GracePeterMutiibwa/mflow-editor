/**
 * MoldoVent - A client class for interacting with the Moldo API
 */
class MoldoVent {
    /**
     * Create a new MoldoVent instance
     * @constructor
     */
    constructor() {
        // URL mapping for different endpoints
        this.urlMapping = {
            0: "http://127.0.0.1:8000/health/",
            1: "http://127.0.0.1:8000/compile/"
        };

        // Request type mapping
        this.requestTypeMapping = {
            0: "get",
            1: "post"
        };

        // Store the status check interval ID to allow stopping
        this.statusCheckIntervalId = null;
    }

    /**
     * Start periodic status checks on the server
     * @param {Function} callback - Function to call with server status (true/false)
     * @param {number} [interval=5000] - Check interval in milliseconds
     * @returns {number} - The interval ID that can be used to stop checking
     */
    statusCheck(callback, interval = 5000) {
        if (typeof callback !== 'function') {
            console.error("Callback must be a function");
            return null;
        }

        // Clear any existing interval
        if (this.statusCheckIntervalId) {
            clearInterval(this.statusCheckIntervalId);
        }

        // Immediately check status once
        this.checkAndNotify(callback);

        // Set up recurring checks
        this.statusCheckIntervalId = setInterval(() => {
            this.checkAndNotify(callback);
        }, interval);

        return this.statusCheckIntervalId;
    }

    /**
     * Helper method to check status and notify via callback
     * @private
     * @param {Function} callback - Function to call with server status
     */
    async checkAndNotify(callback) {
        const isServerAlive = await this.isAlive();
        callback(isServerAlive);
    }

    /**
     * Stop the periodic status checks
     * @returns {boolean} - True if an interval was stopped, false otherwise
     */
    stopStatusCheck() {
        if (this.statusCheckIntervalId) {
            clearInterval(this.statusCheckIntervalId);
            this.statusCheckIntervalId = null;
            return true;
        }
        return false;
    }

    /**
     * Send a ping request to a specified endpoint
     * @param {number} urlTag - The URL identifier (0 for health, 1 for compile)
     * @param {number} pingTag - The request type (0 for GET, 1 for POST)
     * @param {Object} [dataToSend={}] - Optional data to send with the request
     * @returns {Object|null} - The response data or null if an error occurs
     */
    async ping(urlTag, pingTag, dataToSend = {}) {
        try {
            const url = this.urlMapping[urlTag];
            const requestType = this.requestTypeMapping[pingTag];

            if (!url) {
                console.error(`Invalid URL tag: ${urlTag}`);
                return null;
            }

            if (!requestType) {
                console.error(`Invalid ping tag: ${pingTag}`);
                return null;
            }

            let response;

            if (requestType === "get") {
                // For GET requests, we can pass params
                response = await axios.get(url, {
                    params: Object.keys(dataToSend).length > 0 ? dataToSend : undefined
                });
            } else {
                // For POST requests, we send the data in the body
                response = await axios.post(url, dataToSend);
            }

            return response.data;
        } catch (error) {
            console.error("Error in ping method:", error);
            return null;
        }
    }

    /**
     * Check if the API server is alive
     * @returns {boolean} - True if the server is alive, false otherwise
     */
    async isAlive() {
        // Call the health endpoint using ping method (urlTag=0 for health, pingTag=0 for GET)
        const response = await this.ping(0, 0);
        return response && response.status === "OK";
    }

    /**
     * Convert Moldo code to Python
     * @param {string} moldoCode - The Moldo code to compile
     * @returns {string|null} - The compiled Python code or null if an error occurs
     */
    async toPython(moldoCode) {
        try {
            if (!moldoCode || typeof moldoCode !== "string") {
                console.error("Moldo code must be a non-empty string");
                return null;
            }

            // Prepare the data to send
            const dataToSend = {
                code: moldoCode
            };

            // Call the compile endpoint using ping method (urlTag=1 for compile, pingTag=1 for POST)
            const response = await this.ping(1, 1, dataToSend);

            if (!response || !response.python_code) {
                console.error("Failed to compile Moldo code");
                return null;
            }

            return response.python_code;
        } catch (error) {
            console.error("Error compiling Moldo code:", error);
            return null;
        }
    }
}

/**
 * MoldoInput - Handles displaying a blocking modal to get user input.
 */
class MoldoInput {
    constructor() {
        this.modalElement = document.getElementById('moldoInputPromptModal');
        this.modalLabel = document.getElementById('moldoInputPromptModalLabel');
        this.fieldContainer = document.getElementById('moldoInputPromptFieldContainer');
        this.submitButton = document.getElementById('moldoInputPromptSubmitBtn');
        this.form = document.getElementById('moldoInputForm');

        if (!this.modalElement || !this.modalLabel || !this.fieldContainer || !this.submitButton || !this.form) {
            console.error("MoldoInput: Modal elements not found in HTML. Ensure #moldoInputPromptModal and its children are defined.");
            // Potentially throw an error or disable functionality
            this.isInitialized = false;
        } else {
            this.bsModal = new bootstrap.Modal(this.modalElement);
            this.isInitialized = true;
        }
        this.currentResolve = null;
        this.currentReject = null;
        this.currentInputType = null;
    }

    _validateInput(inputElement) {
        let isValid = false;
        const value = inputElement.value;

        switch (this.currentInputType) {
            case 'text':
                isValid = value.trim() !== '';
                break;
            case 'int':
                isValid = value.trim() !== '' && /^-?\d+$/.test(value);
                break;
            case 'float':
                isValid = value.trim() !== '' && !isNaN(parseFloat(value)) && isFinite(value);
                break;
            case 'boolean':
                isValid = true; // Select always has a value
                break;
        }
        this.submitButton.disabled = !isValid;
        if (isValid) {
            inputElement.classList.remove('is-invalid');
        } else if (value.trim() !== '') { // Only show as invalid if user typed something but it's wrong
            inputElement.classList.add('is-invalid');
        }
    }

    getInput(typeOfInput, displayMessage) {
        if (!this.isInitialized) {
            return Promise.reject("MoldoInput modal not initialized.");
        }
        this.currentInputType = typeOfInput.toLowerCase();

        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;

            this.modalLabel.textContent = displayMessage || 'Input Required';
            this.fieldContainer.innerHTML = ''; // Clear previous field

            let inputElement;

            switch (this.currentInputType) {
                case 'text':
                    inputElement = document.createElement('input');
                    inputElement.type = 'text';
                    inputElement.className = 'form-control';
                    inputElement.required = true;
                    break;
                case 'int':
                    inputElement = document.createElement('input');
                    inputElement.type = 'number';
                    inputElement.className = 'form-control';
                    inputElement.step = '1';
                    inputElement.required = true;
                    break;
                case 'float':
                    inputElement = document.createElement('input');
                    inputElement.type = 'number';
                    inputElement.className = 'form-control';
                    inputElement.step = 'any';
                    inputElement.required = true;
                    break;
                case 'boolean':
                    inputElement = document.createElement('select');
                    inputElement.className = 'form-select';
                    inputElement.innerHTML = `
                        <option value="0">False</option>
                        <option value="1">True</option>
                    `;
                    break;
                default:
                    this.currentReject(new Error(`Unsupported input type: ${this.currentInputType}`));
                    return;
            }
            inputElement.id = 'moldoPromptInput';
            this.fieldContainer.appendChild(inputElement);

            // Attach event listeners
            inputElement.addEventListener('input', () => this._validateInput(inputElement));

            const handleSubmit = (event) => {
                event.preventDefault(); // Prevent form submission if it's a form
                if (!this.submitButton.disabled) {
                    this.bsModal.hide();
                    this.currentResolve(inputElement.value);
                    cleanupListeners();
                }
            };

            this.form.addEventListener('submit', handleSubmit); // Handle Enter key
            this.submitButton.onclick = handleSubmit; // Handle button click

            const cleanupListeners = () => {
                this.form.removeEventListener('submit', handleSubmit);
                this.submitButton.onclick = null;
            };

            this._validateInput(inputElement); // Initial validation
            this.bsModal.show();
            setTimeout(() => inputElement.focus(), 500); // Focus after modal animation
        });
    }
}

/**
 * MoldoAdapter - A bridge between PyIodide and the Moldo EDitor
 */
class MoldoAdapter {
    constructor(flowInstance) {
        this.flow = flowInstance;
        this.moldoInput = new MoldoInput(); // Instantiate MoldoInput
    }
    async highlight(highlightMode, artifactDetail) {
        try {
            // Delays are now handled by Python's time.sleep() before this call
            if (highlightMode === 1) {
                // unhighlight it in case its highlighted
                await this.flow.highlight(artifactDetail, false);
                await this.flow.highlight(artifactDetail);
            } else {
                // get the origin and target node
                let [previousNodeId, nextNodeId] = artifactDetail.split("|");
                await this.flow.highlightEdge(previousNodeId, nextNodeId);
            }
        } catch (error) {
            console.error('highlight::', error);
        }

    }

    async input(variableTypeString, displayMessageString) {
        if (!this.moldoInput || !this.moldoInput.isInitialized) {
            console.error("MoldoInput is not available in MoldoAdapter.");
            // Potentially throw an error or return a default that signals an issue to Python
            throw new Error("Input prompt mechanism is not initialized.");
        }
        try {
            const rawValue = await this.moldoInput.getInput(variableTypeString, displayMessageString);

            // Convert rawValue based on variableTypeString for Python consumption
            if (variableTypeString === "int") {
                return parseInt(rawValue, 10);
            } else if (variableTypeString === "float") {
                return parseFloat(rawValue);
            } else if (variableTypeString === "boolean") {
                return rawValue === "1"; // JS true/false, Pyodide bridges to Python True/False
            } else { // "text" or any other default
                return rawValue;
            }
        } catch (error) {
            console.error("MoldoAdapter.input: Error during input prompt:", error);
            throw error; // Re-throw to allow Python to catch it
        }
    }
}

class MoldoExecutor {
    constructor(flowInstanceObject) {
        this.flowInstance = flowInstanceObject;
        this.netManager = new MoldoVent();

        this.moldoBridge = new MoldoAdapter(flowInstanceObject);
        // Set up the log function for the bridge
        this.moldoBridge.log = window.addOutputMessage || console.log; // Fallback to console.log

        window.moldoBridge = this.moldoBridge; // Make the bridge globally available for Pyodide
    }

    async execute(pythonCode) {
        // merge
        const completeCode = `
import js
from js import moldoBridge
import time
${pythonCode}
`;

        // full
        console.log('complete::')
        console.log(completeCode);

        try {
            await window.iodide.runPythonAsync(completeCode);

        } catch (error) {
            console.error("Python execution error:", error);

            alert("Python error: " + error.message);
        }
    }
}
