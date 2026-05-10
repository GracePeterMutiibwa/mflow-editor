/**
 * MoldoFlow Settings Module
 * 
 * This module handles all settings-related functionality for MoldoFlow components,
 * including modals, settings forms, and validation logic.
 */

// Global reference to flowInstance (will be set from main script)
let flowInstance = null;
let currentEditingNodeId = null; // Track the node being edited

/**
 * Initialize the settings module with the flow instance
 * @param {Object} instance - The MoldoFlow instance to use
 */
function initSettings(instance) {
    flowInstance = instance;

    // Set up event listeners for the declaration settings modal
    setupDeclarationSettingsModal();

    // Set up event listeners for the output settings modal
    setupOutputSettingsModal();

    // Set up event listeners for the conditional settings modal
    setupConditionalSettingsModal();

    // Set up event listeners for the process settings modal
    setupProcessSettingsModal();

    // Set up event listeners for the loop settings modal
    setupLoopSettingsModal();

    // Set up event listeners for the new input settings modal
    setupInputSettingsModal();
}

/**
 * Set up event listeners for the declaration settings modal
 */
function setupDeclarationSettingsModal() {
    const addVariableBtn = document.getElementById('addVariableBtn');
    if (addVariableBtn) {
        // Remove any existing event listeners (to prevent duplicates)
        const newAddBtn = addVariableBtn.cloneNode(true);
        addVariableBtn.parentNode.replaceChild(newAddBtn, addVariableBtn);

        // Add the event listener
        newAddBtn.addEventListener('click', function () {
            addVariableRow();
        });
    }

    // Save button event listener
    const saveBtn = document.getElementById('saveDeclarationSettings');
    if (saveBtn) {
        // Remove any existing event listeners (to prevent duplicates)
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Add the event listener
        newSaveBtn.addEventListener('click', function () {
            saveDeclarationSettings();
        });
    }
}

/**
 * Set up event listeners for the output settings modal
 */
function setupOutputSettingsModal() {
    const saveBtn = document.getElementById('saveOutputSettings');
    if (saveBtn) {
        // Remove any existing event listeners to prevent duplicates
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Add event listener
        newSaveBtn.addEventListener('click', function () {
            saveOutputSettings();
        });
    }

    // Add input validation for the output message field
    const messageTextarea = document.getElementById('outputMessageText');
    if (messageTextarea) {
        messageTextarea.addEventListener('input', validateOutputMessage);
    }
}

/**
 * Set up event listeners for the conditional settings modal
 */
function setupConditionalSettingsModal() {
    const saveBtn = document.getElementById('saveConditionalSettings');
    if (saveBtn) {
        // Remove any existing event listeners to prevent duplicates
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Add event listener
        newSaveBtn.addEventListener('click', function () {
            saveConditionalSettings();
        });
    }

    // Add change listeners for condition elements
    const leftVarSelect = document.getElementById('conditionalLeftVar');
    const operatorSelect = document.getElementById('conditionalOperator');
    const rightValueInput = document.getElementById('conditionalRightValue');
    const rightVarSelect = document.getElementById('conditionalRightVar');
    const useVarSwitch = document.getElementById('useVariableForRight');
    const rightVarContainer = document.getElementById('conditionalRightVarContainer');
    const rightValueContainer = document.getElementById('conditionalRightValueContainer');

    if (leftVarSelect) {
        leftVarSelect.addEventListener('change', updateConditionPreview);
    }

    if (operatorSelect) {
        operatorSelect.addEventListener('change', updateConditionPreview);
    }

    if (rightValueInput) {
        rightValueInput.addEventListener('input', updateConditionPreview);
    }

    if (rightVarSelect) {
        rightVarSelect.addEventListener('change', updateConditionPreview);
    }

    if (useVarSwitch) {
        useVarSwitch.addEventListener('change', function () {
            // Toggle between variable selection and manual value input
            if (this.checked) {
                rightVarContainer.style.display = 'block';
                rightValueContainer.style.display = 'none';
            } else {
                rightVarContainer.style.display = 'none';
                rightValueContainer.style.display = 'block';
            }
            updateConditionPreview();
        });
    }
}

/**
 * Set up event listeners for the process settings modal
 */
function setupProcessSettingsModal() {
    const saveBtn = document.getElementById('saveProcessSettings');
    if (saveBtn) {
        // Remove any existing event listeners to prevent duplicates
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Add event listener
        newSaveBtn.addEventListener('click', function () {
            saveProcessSettings();
        });
    }

    // Add change listeners for process elements
    const targetVarSelect = document.getElementById('processTargetVar');
    const operationSelect = document.getElementById('processOperation');
    const valueTypeSelect = document.getElementById('processValueType');
    const valueInput = document.getElementById('processValue');
    const secondVarSelect = document.getElementById('processSecondVar');
    const valueContainer = document.getElementById('processValueContainer');
    const secondVarContainer = document.getElementById('processSecondVarContainer');

    if (targetVarSelect) {
        targetVarSelect.addEventListener('change', updateProcessPreview);
    }

    if (operationSelect) {
        operationSelect.addEventListener('change', updateProcessPreview);
    }

    if (valueInput) {
        valueInput.addEventListener('input', updateProcessPreview);
    }

    if (secondVarSelect) {
        secondVarSelect.addEventListener('change', updateProcessPreview);
    }

    if (valueTypeSelect) {
        valueTypeSelect.addEventListener('change', function () {
            // Toggle between variable selection and manual value input
            if (this.value === 'variable') {
                secondVarContainer.style.display = 'block';
                valueContainer.style.display = 'none';
            } else {
                secondVarContainer.style.display = 'none';
                valueContainer.style.display = 'block';
            }
            updateProcessPreview();
        });
    }
}

/**
 * Set up event listeners for the loop settings modal
 */
function setupLoopSettingsModal() {
    const saveBtn = document.getElementById('saveLoopSettings');
    if (saveBtn) {
        // Remove any existing event listeners to prevent duplicates
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Add event listener
        newSaveBtn.addEventListener('click', function () {
            saveLoopSettings();
        });
    }

    // Add change listeners for loop elements
    const iterationTypeSelect = document.getElementById('loopIterationType');
    const iterationValueInput = document.getElementById('loopIterationValue');
    const iterationVarSelect = document.getElementById('loopIterationVar');
    const iterationValueContainer = document.getElementById('loopIterationValueContainer');
    const iterationVarContainer = document.getElementById('loopIterationVarContainer');

    if (iterationTypeSelect) {
        iterationTypeSelect.addEventListener('change', function () {
            // Toggle between variable selection and manual value input
            if (this.value === 'variable') {
                iterationVarContainer.style.display = 'block';
                iterationValueContainer.style.display = 'none';
            } else {
                iterationVarContainer.style.display = 'none';
                iterationValueContainer.style.display = 'block';
            }
            updateLoopPreview();
        });
    }

    if (iterationValueInput) {
        iterationValueInput.addEventListener('input', updateLoopPreview);
    }

    if (iterationVarSelect) {
        iterationVarSelect.addEventListener('change', updateLoopPreview);
    }
}

/**
 * Set up event listeners for the input settings modal
 */
function setupInputSettingsModal() {
    const saveBtn = document.getElementById('saveInputSettings');
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', saveInputSettings);
    }

    const variableSelect = document.getElementById('inputSelectedVariable');
    const messageTextarea = document.getElementById('inputDisplayMessage');

    if (variableSelect) {
        variableSelect.addEventListener('change', validateInputSettingsForm);
    }
    if (messageTextarea) {
        messageTextarea.addEventListener('input', validateInputSettingsForm);
    }
}

/**
 * Validates the input settings form and enables/disables the save button.
 */
function validateInputSettingsForm() {
    const variableSelect = document.getElementById('inputSelectedVariable');
    const messageTextarea = document.getElementById('inputDisplayMessage');
    const saveBtn = document.getElementById('saveInputSettings');

    const isVariableSelected = variableSelect && variableSelect.value !== '';
    const isMessageEntered = messageTextarea && messageTextarea.value.trim() !== '';

    if (saveBtn) {
        saveBtn.disabled = !(isVariableSelected && isMessageEntered);
    }

    // Clear specific field feedback if they become valid
    if (variableSelect) {
        const feedbackVar = document.getElementById('inputSelectedVariableFeedback');
        if (isVariableSelected) {
            variableSelect.classList.remove('is-invalid');
            if (feedbackVar) feedbackVar.textContent = '';
        }
    }
    if (messageTextarea) {
        const feedbackMsg = document.getElementById('inputDisplayMessageFeedback');
        if (isMessageEntered) {
            messageTextarea.classList.remove('is-invalid');
            if (feedbackMsg) feedbackMsg.textContent = '';
        }
    }
}

/**
 * Show settings for a specific node based on its type
 * @param {string} nodeId - The ID of the node to show settings for
 */
function showNodeSettings(nodeId) {
    const node = flowInstance.getNodes()[nodeId];
    if (!node) return;

    const nodeType = flowInstance.getNodeType(node);

    // Show the appropriate settings modal based on node type
    if (nodeType === 'declaration-component') {
        showDeclarationSettings(nodeId, node);
    } else if (nodeType === 'output-node') {
        showOutputSettings(nodeId, node);
    } else if (nodeType === 'conditional-component') {
        showConditionalSettings(nodeId, node);
    } else if (nodeType === 'process-node') {
        showProcessSettings(nodeId, node);
    } else if (nodeType === 'loop-component') {
        showLoopSettings(nodeId, node);
    } else if (nodeType === 'input-component') { // New
        showInputSettings(nodeId, node);
    } else {
        // Handle other node types (placeholder)
        showNotification(`Settings for ${nodeId} (${nodeType})`, false);
    }
}

/**
 * Show declaration block settings in a modal
 * @param {string} nodeId - The ID of the declaration node
 * @param {Object} node - The node object
 */
function showDeclarationSettings(nodeId, node) {
    // Get or initialize variables data for this node
    const nodeData = node.data || {};
    nodeData.variables = nodeData.variables || [];

    // Get the modal element
    const modal = document.getElementById('declarationSettingsModal');
    const bsModal = new bootstrap.Modal(modal);

    // Cache current node ID to use when saving
    currentEditingNodeId = nodeId;

    // Set up the variables container
    const variablesContainer = document.getElementById('declarationVariablesContainer');
    const noVariablesMsg = variablesContainer.querySelector('.no-variables-message');

    // Clear existing variable rows
    const existingRows = variablesContainer.querySelectorAll('.variable-row');
    existingRows.forEach(row => row.remove());

    // Show/hide no variables message
    if (nodeData.variables.length === 0) {
        noVariablesMsg.style.display = 'block';
    } else {
        noVariablesMsg.style.display = 'none';

        // Add existing variables
        nodeData.variables.forEach(variable => {
            addVariableRow(variable.name, variable.type, variable.value);
        });
    }

    // Show the modal
    bsModal.show();
}

/**
 * Show output block settings in a modal
 * @param {string} nodeId - The ID of the output node
 * @param {Object} node - The node object
 */
function showOutputSettings(nodeId, node) {
    // Get or initialize output data for this node
    const nodeData = node.data || {};
    nodeData.outputMessage = nodeData.outputMessage || '';

    // Get the modal element
    const modal = document.getElementById('outputSettingsModal');
    const bsModal = new bootstrap.Modal(modal);

    // Cache current node ID to use when saving
    currentEditingNodeId = nodeId;

    // Get form elements
    const messageTextarea = document.getElementById('outputMessageText');
    const noVariablesAlert = document.getElementById('noVariablesAlert');
    const availableVarsList = document.getElementById('availableVarsList');
    const noAvailableVars = document.getElementById('noAvailableVars');

    // Set current values
    messageTextarea.value = nodeData.outputMessage;

    // Get all available variables from declaration blocks
    const availableVariables = getAllDeclaredVariables();

    // Update the variables display
    if (availableVariables.length > 0) {
        noVariablesAlert.style.display = 'none';

        // Display available variables in the helper section
        if (availableVarsList && noAvailableVars) {
            // Clear previous content
            availableVarsList.innerHTML = '';

            // Show the list, hide the "no variables" message
            availableVarsList.style.display = 'block';
            noAvailableVars.style.display = 'none';

            // Add each variable as a clickable badge
            availableVariables.forEach(variable => {
                const varBadge = document.createElement('span');
                varBadge.className = 'badge bg-secondary me-1 mb-1 variable-badge';
                varBadge.textContent = variable.name;
                varBadge.title = `Click to insert ${variable.name} (${variable.type})`;
                varBadge.style.cursor = 'pointer';

                // Add click handler to insert the variable in the textarea
                varBadge.addEventListener('click', function () {
                    insertVariableIntoMessage(variable.name);
                });

                availableVarsList.appendChild(varBadge);
            });
        }
    } else {
        // Show the no variables alert
        noVariablesAlert.style.display = 'block';

        // Hide the variable list, show the "no variables" message
        if (availableVarsList && noAvailableVars) {
            availableVarsList.style.display = 'none';
            noAvailableVars.style.display = 'block';
        }
    }

    // Validate the output message after populating the form
    setTimeout(() => {
        validateOutputMessage();
    }, 0);

    // Show the modal
    bsModal.show();
}

/**
 * Show input block settings in a modal
 * @param {string} nodeId - The ID of the input node
 * @param {Object} node - The node object
 */
function showInputSettings(nodeId, node) {
    const nodeData = node.data || {};
    nodeData.inputConfig = nodeData.inputConfig || { selectedVariable: '', variableType: '', displayMessage: '' };

    const modal = document.getElementById('inputSettingsModal');
    const bsModal = new bootstrap.Modal(modal);
    currentEditingNodeId = nodeId;

    const variableSelect = document.getElementById('inputSelectedVariable');
    const messageTextarea = document.getElementById('inputDisplayMessage');
    const noVariablesAlert = document.getElementById('noVariablesAlertInput');
    const saveBtn = document.getElementById('saveInputSettings');

    // Reset form
    variableSelect.innerHTML = '<option value="" selected disabled>Select a variable...</option>';
    messageTextarea.value = '';
    if (saveBtn) saveBtn.disabled = true;


    const availableVariables = getAllDeclaredVariables();

    if (availableVariables.length > 0) {
        if (noVariablesAlert) noVariablesAlert.style.display = 'none';
        availableVariables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.name;
            option.textContent = `${variable.name} (${variable.type})`;
            option.dataset.variableType = variable.type; // Store type for easy access
            variableSelect.appendChild(option);
        });

        // Load existing settings
        if (nodeData.inputConfig.selectedVariable) {
            variableSelect.value = nodeData.inputConfig.selectedVariable;
        }
        if (nodeData.inputConfig.displayMessage) {
            messageTextarea.value = nodeData.inputConfig.displayMessage;
        }
    } else {
        if (noVariablesAlert) noVariablesAlert.style.display = 'block';
        if (saveBtn) saveBtn.disabled = true; // Can't save if no variables to select
    }

    // Initial validation of the form
    validateInputSettingsForm();

    // Clear previous feedback messages
    const feedbackVar = document.getElementById('inputSelectedVariableFeedback');
    const feedbackMsg = document.getElementById('inputDisplayMessageFeedback');
    if (feedbackVar) feedbackVar.textContent = '';
    if (feedbackMsg) feedbackMsg.textContent = '';
    variableSelect.classList.remove('is-invalid');
    messageTextarea.classList.remove('is-invalid');

    bsModal.show();
}

/**
 * Show conditional block settings in a modal
 * @param {string} nodeId - The ID of the conditional node
 * @param {Object} node - The node object
 */
function showConditionalSettings(nodeId, node) {
    // Get or initialize condition data for this node
    const nodeData = node.data || {};
    nodeData.condition = nodeData.condition || {};
    const condition = nodeData.condition;

    // Get the modal element
    const modal = document.getElementById('conditionalSettingsModal');
    const bsModal = new bootstrap.Modal(modal);

    // Cache current node ID to use when saving
    currentEditingNodeId = nodeId;

    // Get form elements
    const leftVarSelect = document.getElementById('conditionalLeftVar');
    const operatorSelect = document.getElementById('conditionalOperator');
    const rightValueInput = document.getElementById('conditionalRightValue');
    const rightVarSelect = document.getElementById('conditionalRightVar');
    const useVarSwitch = document.getElementById('useVariableForRight');
    const rightVarContainer = document.getElementById('conditionalRightVarContainer');
    const rightValueContainer = document.getElementById('conditionalRightValueContainer');
    const noVariablesAlert = document.getElementById('noVariablesAlertConditional');

    // Reset the form
    leftVarSelect.innerHTML = '<option value="" selected disabled>Select variable...</option>';
    rightVarSelect.innerHTML = '<option value="" selected disabled>Select variable...</option>';
    operatorSelect.value = '';
    rightValueInput.value = '';
    useVarSwitch.checked = false;
    rightVarContainer.style.display = 'none';
    rightValueContainer.style.display = 'block';

    // Get all available variables from declaration blocks
    const availableVariables = getAllDeclaredVariables();

    if (availableVariables.length > 0) {
        noVariablesAlert.style.display = 'none';

        // Add variables to the selects
        availableVariables.forEach(variable => {
            // Add to left variable select
            const leftOption = document.createElement('option');
            leftOption.value = variable.name;
            leftOption.textContent = `${variable.name} (${variable.type})`;
            leftVarSelect.appendChild(leftOption);

            // Add to right variable select
            const rightOption = document.createElement('option');
            rightOption.value = variable.name;
            rightOption.textContent = `${variable.name} (${variable.type})`;
            rightVarSelect.appendChild(rightOption);
        });

        // Set existing values if present
        if (condition.leftVar) {
            leftVarSelect.value = condition.leftVar;
        }

        if (condition.operator) {
            operatorSelect.value = condition.operator;
        }

        if (condition.useVariable) {
            useVarSwitch.checked = true;
            rightVarContainer.style.display = 'block';
            rightValueContainer.style.display = 'none';

            if (condition.rightVar) {
                rightVarSelect.value = condition.rightVar;
            }
        } else {
            if (condition.rightValue !== undefined) {
                rightValueInput.value = condition.rightValue;
            }
        }
    } else {
        // No variables available
        noVariablesAlert.style.display = 'block';
        document.getElementById('saveConditionalSettings').disabled = true;
    }

    // Update the condition preview
    updateConditionPreview();

    // Show the modal
    bsModal.show();
}

/**
 * Insert a variable reference into the message textarea at cursor position
 * @param {string} variableName - The name of the variable to insert
 */
function insertVariableIntoMessage(variableName) {
    const messageTextarea = document.getElementById('outputMessageText');
    if (!messageTextarea) return;

    // Get cursor position
    const startPos = messageTextarea.selectionStart;
    const endPos = messageTextarea.selectionEnd;

    // Get text before and after cursor
    const textBefore = messageTextarea.value.substring(0, startPos);
    const textAfter = messageTextarea.value.substring(endPos);

    // Insert variable reference at cursor position
    const variableRef = `{${variableName}}`;
    messageTextarea.value = textBefore + variableRef + textAfter;

    // Set cursor position after the inserted variable
    const newCursorPos = startPos + variableRef.length;
    messageTextarea.selectionStart = newCursorPos;
    messageTextarea.selectionEnd = newCursorPos;

    // Focus back on textarea
    messageTextarea.focus();

    // Validate the message with the newly added variable
    validateOutputMessage();
}

/**
 * Add a new variable row to the declaration settings modal
 * @param {string} name - The variable name
 * @param {string} type - The variable type
 * @param {string} value - The variable value
 */
function addVariableRow(name = '', type = 'text', value = '') {
    const variablesContainer = document.getElementById('declarationVariablesContainer');
    const noVariablesMsg = variablesContainer.querySelector('.no-variables-message');

    // Hide the "no variables" message
    noVariablesMsg.style.display = 'none';

    // Create a new row
    const newRow = document.createElement('div');
    newRow.className = 'variable-row mb-3 row';
    newRow.innerHTML = `
        <div class="col-4">
            <input type="text" class="form-control variable-name" placeholder="Variable Name" value="${name}">
            <div class="invalid-feedback"></div>
        </div>
        <div class="col-3">
            <select class="form-select variable-type">
                <option value="text" ${type === 'text' ? 'selected' : ''}>Text</option>
                <option value="int" ${type === 'int' ? 'selected' : ''}>Integer</option>
                <option value="float" ${type === 'float' ? 'selected' : ''}>Float</option>
                <option value="boolean" ${type === 'boolean' ? 'selected' : ''}>Boolean</option>
            </select>
        </div>
        <div class="col-4">
            <input type="text" class="form-control variable-value" placeholder="Value" value="${value}">
        </div>
        <div class="col-1">
            <button type="button" class="btn btn-danger delete-variable-btn">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;

    // Add event listener to delete button
    const deleteBtn = newRow.querySelector('.delete-variable-btn');
    deleteBtn.addEventListener('click', function () {
        this.closest('.variable-row').remove();

        // Check if there are any variables left
        const remainingRows = variablesContainer.querySelectorAll('.variable-row');
        if (remainingRows.length === 0) {
            noVariablesMsg.style.display = 'block';
        }

        // Validate remaining variable names for duplicates
        validateAllVariableNames();
    });

    // Add event listener to type select to validate value input based on type
    const typeSelect = newRow.querySelector('.variable-type');
    const valueInput = newRow.querySelector('.variable-value');

    typeSelect.addEventListener('change', function () {
        updateValueFieldBasedOnType(this, valueInput);
    });

    // Add event listener to validate variable name as user types
    const nameInput = newRow.querySelector('.variable-name');
    nameInput.addEventListener('input', function () {
        validateVariableName(this);
        validateAllVariableNames(); // Check for duplicates
    });

    // Initialize value field based on type
    updateValueFieldBasedOnType(typeSelect, valueInput);

    // Append the row to the container
    variablesContainer.appendChild(newRow);

    // Validate the new name if provided
    if (name) {
        validateVariableName(nameInput);
    }

    // Check for duplicates after adding the new row
    validateAllVariableNames();

    // Focus on the name input if it's empty
    if (!name) {
        newRow.querySelector('.variable-name').focus();
    }
}

/**
 * Validate a single variable name input field
 * @param {HTMLElement} nameInput - The name input element to validate
 * @returns {boolean} Whether the name is valid
 */
function validateVariableName(nameInput) {
    const name = nameInput.value.trim();
    const feedback = nameInput.nextElementSibling;

    // Check for basic name validity
    const nameError = getVariableNameError(name);

    if (nameError) {
        nameInput.classList.add('is-invalid');
        if (feedback) {
            feedback.textContent = nameError;
        }
        return false;
    } else {
        // Remove basic error (duplicate errors will be handled separately)
        if (!nameInput.classList.contains('duplicate-error')) {
            nameInput.classList.remove('is-invalid');
            if (feedback) {
                feedback.textContent = '';
            }
        }
        return true;
    }
}

/**
 * Validate all variable names in the modal to check for duplicates
 */
function validateAllVariableNames() {
    const variablesContainer = document.getElementById('declarationVariablesContainer');
    const rows = variablesContainer.querySelectorAll('.variable-row');

    // First collect all names
    const names = [];
    const inputs = [];

    rows.forEach(row => {
        const nameInput = row.querySelector('.variable-name');
        if (nameInput) {
            const name = nameInput.value.trim();
            if (name) {
                names.push(name);
                inputs.push(nameInput);
            }
        }
    });

    // Then check for duplicates
    const duplicates = {};
    names.forEach((name, index) => {
        const firstIndex = names.indexOf(name);
        if (firstIndex !== index) {
            // This is a duplicate
            duplicates[index] = name;
        }
    });

    // Clear all previous duplicate error states
    inputs.forEach(input => {
        input.classList.remove('duplicate-error');
    });

    // Apply duplicate error states
    Object.keys(duplicates).forEach(index => {
        const input = inputs[index];
        const name = duplicates[index];
        const feedback = input.nextElementSibling;

        input.classList.add('is-invalid');
        input.classList.add('duplicate-error');
        if (feedback) {
            feedback.textContent = `Duplicate variable name: "${name}"`;
        }
    });

    return Object.keys(duplicates).length === 0;
}

/**
 * Update value input field based on selected type
 * @param {HTMLElement} typeSelect - The type select element
 * @param {HTMLElement} valueInput - The value input element
 */
function updateValueFieldBasedOnType(typeSelect, valueInput) {
    const type = typeSelect.value;

    // Skip if valueInput doesn't exist
    if (!valueInput) return;

    // Reset attributes
    valueInput.type = 'text';
    valueInput.min = '';
    valueInput.step = '';

    switch (type) {
        case 'int':
            valueInput.type = 'number';
            valueInput.step = '1';
            break;
        case 'float':
            valueInput.type = 'number';
            valueInput.step = '0.01';
            break;
        case 'boolean':
            // For boolean type, replace the text input with a select element
            if (valueInput.tagName !== 'SELECT') {
                const currentValue = valueInput.value.toLowerCase();
                const isTrue = currentValue === 'true' || currentValue === '1' || currentValue === 'yes';

                // Create the select element
                const select = document.createElement('select');
                select.className = 'form-select variable-value';

                // Add true/false options
                select.innerHTML = `
                    <option value="true" ${isTrue ? 'selected' : ''}>True</option>
                    <option value="false" ${!isTrue ? 'selected' : ''}>False</option>
                `;

                // Replace the input with the select
                valueInput.parentNode.replaceChild(select, valueInput);
            }
            break;
    }
}

/**
 * Check variable name validity and return error message if invalid
 * @param {string} name - The variable name to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function getVariableNameError(name) {
    // Empty name
    if (!name) {
        return "Variable name cannot be empty";
    }

    // Check pattern
    const namePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!namePattern.test(name)) {
        if (!/^[a-zA-Z_]/.test(name)) {
            return `"${name}" must start with a letter or underscore`;
        } else {
            return `"${name}" contains invalid characters (only letters, numbers, and underscores allowed)`;
        }
    }

    // Check if name is a Python keyword
    const pythonKeywords = [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
        'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
        'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
        'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
    ];

    if (pythonKeywords.includes(name)) {
        return `"${name}" is a reserved keyword and cannot be used as a variable name`;
    }

    // Additional checks:
    // Prevent names that are too long
    if (name.length > 64) {
        return `Variable name is too long (maximum 64 characters)`;
    }

    return null; // Name is valid
}

/**
 * Save declaration settings from the modal
 */
function saveDeclarationSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    // Validate all names before saving
    if (!validateAllVariableNames()) {
        showNotification('Invalid variable names detected. Please fix errors.', true);
        return;
    }

    const variablesContainer = document.getElementById('declarationVariablesContainer');
    const variableRows = variablesContainer.querySelectorAll('.variable-row');
    const collectedVariables = [];
    let isValid = true;

    variableRows.forEach(row => {
        const nameInput = row.querySelector('.variable-name');
        const typeSelect = row.querySelector('.variable-type');
        const valueInput = row.querySelector('.variable-value');

        const name = nameInput.value.trim();
        const type = typeSelect.value;
        let value = valueInput.value.trim();

        // Basic validation
        if (!name) {
            nameInput.classList.add('is-invalid');
            isValid = false;
        } else {
            nameInput.classList.remove('is-invalid');
        }

        // Validate value based on type
        if (type === 'int' && !/^-?\d+$/.test(value)) {
            valueInput.classList.add('is-invalid');
            isValid = false;
        } else if (type === 'float' && !/^-?\d*\.?\d+$/.test(value)) {
            valueInput.classList.add('is-invalid');
            isValid = false;
        } else if (type === 'boolean' && !/^(true|false)$/i.test(value)) {
            valueInput.classList.add('is-invalid');
            isValid = false;
        } else {
            valueInput.classList.remove('is-invalid');
        }

        // Add to collection if valid
        if (name) { // Only add if name is provided
            collectedVariables.push({ name, type, value });
        }
    });

    if (!isValid) {
        showNotification('Please fix the highlighted errors in variable definitions.', true);
        return; // Don't save if there are errors
    }

    // ---- Update node.data and node.dataset.settings ----
    const settings = { variables: collectedVariables };
    node.dataset.settings = JSON.stringify(settings);
    // ALSO update the node.data object used by runtime/validation
    if (!node.data) node.data = {}; // Ensure node.data exists
    node.data.variables = collectedVariables;
    // ---- End Update ----

    // Update the node settings indicator
    updateNodeSettingsIndicator(currentEditingNodeId, collectedVariables.length > 0);

    // Update text area and close modal
    if (window.updateTextAreaContent) {
        window.updateTextAreaContent();
    }
    const modalElement = document.getElementById('declarationSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    showNotification('Declaration settings saved');
    currentEditingNodeId = null; // Reset editing node
}

/**
 * Save input settings from the modal
 */
function saveInputSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    const variableSelect = document.getElementById('inputSelectedVariable');
    const messageTextarea = document.getElementById('inputDisplayMessage');
    const feedbackVar = document.getElementById('inputSelectedVariableFeedback');
    const feedbackMsg = document.getElementById('inputDisplayMessageFeedback');

    const selectedVariable = variableSelect.value;
    const displayMessage = messageTextarea.value.trim();
    const selectedOption = variableSelect.options[variableSelect.selectedIndex];
    const variableType = selectedOption ? selectedOption.dataset.variableType : '';

    let isValid = true;
    if (!selectedVariable) {
        variableSelect.classList.add('is-invalid');
        if (feedbackVar) feedbackVar.textContent = 'Please select a variable.';
        isValid = false;
    }
    if (!displayMessage) {
        messageTextarea.classList.add('is-invalid');
        if (feedbackMsg) feedbackMsg.textContent = 'Please enter a display message.';
        isValid = false;
    }

    if (!isValid) {
        showNotification('Please complete all fields for the Input block.', true);
        return;
    }

    const settings = { selectedVariable, variableType, displayMessage };
    node.dataset.settings = JSON.stringify(settings);
    if (!node.data) node.data = {};
    node.data.inputConfig = settings;

    updateNodeSettingsIndicator(currentEditingNodeId, true);

    if (window.updateTextAreaContent) window.updateTextAreaContent();
    const modalElement = document.getElementById('inputSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) modalInstance.hide();

    showNotification('Input settings saved');
    currentEditingNodeId = null;
}

/**
 * Validate the output message to ensure all variable references exist
 */
function validateOutputMessage() {
    const messageTextarea = document.getElementById('outputMessageText');
    const saveBtn = document.getElementById('saveOutputSettings');
    const feedbackElement = document.getElementById('outputMessageFeedback');

    if (!messageTextarea || !saveBtn) return;

    // Get current message and all available variables
    const message = messageTextarea.value;
    const availableVariables = getAllDeclaredVariables();
    const availableVarNames = availableVariables.map(v => v.name);

    // Extract all variable references from the message
    const varPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = [...message.matchAll(varPattern)];
    const referencedVars = matches.map(m => m[1]);

    // Check if any referenced variables don't exist
    const invalidVars = referencedVars.filter(varName => !availableVarNames.includes(varName));

    // If there are invalid variables, show error and disable save button
    if (invalidVars.length > 0) {
        messageTextarea.classList.add('is-invalid');
        if (feedbackElement) {
            feedbackElement.textContent = `Unknown variable(s): ${invalidVars.join(', ')}`;
            feedbackElement.style.display = 'block';
        }
        saveBtn.disabled = true;
        return false;
    } else {
        messageTextarea.classList.remove('is-invalid');
        if (feedbackElement) {
            feedbackElement.textContent = '';
            feedbackElement.style.display = 'none';
        }

        // Only enable save if there's a message
        saveBtn.disabled = !message.trim();
        return true;
    }
}

/**
 * Save output settings from the modal
 */
function saveOutputSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    const messageTextarea = document.getElementById('outputMessageText');
    const messageText = messageTextarea.value.trim();

    // Basic validation: message cannot be empty
    if (!validateOutputMessage()) {
        showNotification('Output message cannot be empty.', true);
        return;
    }

    // ---- Update node.data and node.dataset.settings ----
    const settings = { message: messageText };
    node.dataset.settings = JSON.stringify(settings);
    // ALSO update the node.data object used by runtime/validation
    if (!node.data) node.data = {}; // Ensure node.data exists
    node.data.outputMessage = messageText; // Use the property name expected by runtime
    // ---- End Update ----

    // Update the node settings indicator
    updateNodeSettingsIndicator(currentEditingNodeId, true);

    // Update the text area and close the modal
    if (window.updateTextAreaContent) {
        window.updateTextAreaContent();
    }
    const modalElement = document.getElementById('outputSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    showNotification('Output settings saved');
    currentEditingNodeId = null; // Reset editing node
}

/**
 * Update the settings indicator on a node to show if settings are valid
 * @param {string} nodeId - The ID of the node to update
 * @param {boolean} isValid - Whether the settings are valid
 */
function updateNodeSettingsIndicator(nodeId, isValid) {
    const nodeElement = document.getElementById(nodeId);
    if (!nodeElement) return;

    // Find or create the settings indicator
    let indicatorElement = nodeElement.querySelector('.settings-indicator');

    if (!indicatorElement) {
        // Create the indicator element if it doesn't exist
        indicatorElement = document.createElement('span');
        indicatorElement.className = 'settings-indicator';

        // Find the node-content element to position it properly
        const nodeContent = nodeElement.querySelector('.node-content');
        if (nodeContent) {
            // Insert the indicator after the node content
            nodeContent.parentNode.insertBefore(indicatorElement, nodeContent.nextSibling);
        }
    }

    // Update the indicator based on validity
    if (isValid) {
        indicatorElement.className = 'settings-indicator settings-valid';
        indicatorElement.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
        indicatorElement.title = 'Settings are valid';
    } else {
        indicatorElement.className = 'settings-indicator settings-invalid';
        indicatorElement.innerHTML = '<i class="bi bi-circle"></i>';
        indicatorElement.title = 'Settings required';
    }
}

/**
 * Initialize settings indicators for all nodes that can have settings
 */
function initNodeSettingsIndicators() {
    if (!flowInstance) return;

    const allNodes = flowInstance.getNodes();

    // Loop through all nodes
    Object.entries(allNodes).forEach(([nodeId, node]) => {
        const nodeType = flowInstance.getNodeType(node);

        // Only add indicators to nodes that can have settings
        if (nodeType === 'declaration-component') {
            // Check if there are variables defined
            const nodeData = node.data || {};
            const variables = nodeData.variables || [];
            updateNodeSettingsIndicator(nodeId, variables.length > 0);
        }
        else if (nodeType === 'output-node') {
            // Check if there is a message specified
            const nodeData = node.data || {};
            const hasMessage = !!(nodeData.outputMessage && nodeData.outputMessage.trim());
            updateNodeSettingsIndicator(nodeId, hasMessage);
        }
        else if (nodeType === 'conditional-component') {
            // Check if there is a condition defined
            const nodeData = node.data || {};
            const condition = nodeData.condition || {};
            const hasCondition = !!(condition.leftVar && condition.operator);
            updateNodeSettingsIndicator(nodeId, hasCondition);
        }
        else if (nodeType === 'process-node') {
            // Check if there is an operation defined
            const nodeData = node.data || {};
            const operation = nodeData.operation || {};
            const hasOperation = !!(operation.targetVar && operation.operation);
            updateNodeSettingsIndicator(nodeId, hasOperation);
        }
        else if (nodeType === 'loop-component') {
            // Check if there is a loop configuration defined
            const nodeData = node.data || {};
            const loop = nodeData.loop || {};
            const hasLoop = !!(loop.loopType && (loop.useVariable ? loop.iterationVar : loop.iterations !== undefined));
            updateNodeSettingsIndicator(nodeId, hasLoop);
        }
        else if (nodeType === 'input-component') { // New
            const nodeData = node.data || {};
            const inputConfig = nodeData.inputConfig || {};
            const isConfigured = !!(inputConfig.selectedVariable && inputConfig.displayMessage);
            updateNodeSettingsIndicator(nodeId, isConfigured);
        }
    });
}

/**
 * Get all variables from declaration blocks in the flow
 * @returns {Array} Array of variable objects with name, type
 */
function getAllDeclaredVariables() {
    if (!flowInstance) return [];

    const allNodes = flowInstance.getNodes();
    const variables = [];
    const seen = new Set();

    Object.values(allNodes).forEach(node => {
        if (!node) return;
        const type = flowInstance.getNodeType(node);

        // Variables from Declaration blocks
        if (type === 'declaration-component') {
            const nodeVariables = (node.data || {}).variables || [];
            nodeVariables.forEach(variable => {
                if (variable.name && !seen.has(variable.name)) {
                    seen.add(variable.name);
                    variables.push({
                        name: variable.name,
                        type: variable.type,
                        blockId: node.id
                    });
                }
            });
        }

        // Variables produced by community (mold) blocks - stored in params[outputId]
        if (type === 'community-block') {
            try {
                const saved    = JSON.parse(node.dataset.settings || '{}');
                const params   = saved.params || {};
                // manifest lives in node.data (live) or dataset.settings (after import)
                const manifest = (node.data && node.data.manifest) || saved.manifest || null;
                ((manifest && manifest.outputs) || []).forEach(out => {
                    const varName = (params[out.id] || '').replace(/^@/, '').trim();
                    if (varName && !seen.has(varName)) {
                        seen.add(varName);
                        variables.push({
                            name: varName,
                            type: 'any',
                            blockId: node.id
                        });
                    }
                });
            } catch (_) {}
        }
    });

    return variables;
}

/**
 * Shows a notification message
 * This is a placeholder that will be replaced by the actual function from the main script
 * @param {string} message - The message to show
 * @param {boolean} isError - Whether this is an error message
 */
function showNotification(message, isError = false) {
    // This function will be provided by the main script
    console.log(`${isError ? 'ERROR' : 'INFO'}: ${message}`);

    // If we have access to the main script's showNotification, use it
    if (window.showNotification) {
        window.showNotification(message, isError);
    }
}

/**
 * Update the condition preview in the modal
 */
function updateConditionPreview() {
    const leftVarSelect = document.getElementById('conditionalLeftVar');
    const operatorSelect = document.getElementById('conditionalOperator');
    const rightValueInput = document.getElementById('conditionalRightValue');
    const rightVarSelect = document.getElementById('conditionalRightVar');
    const useVarSwitch = document.getElementById('useVariableForRight');
    const previewText = document.getElementById('conditionPreviewText');
    const saveBtn = document.getElementById('saveConditionalSettings');

    // Get selected values
    const leftVar = leftVarSelect.value;
    const operator = operatorSelect.value;
    const rightValue = rightValueInput.value;
    const rightVar = rightVarSelect.value;
    const useVar = useVarSwitch.checked;

    // Helper to quote string values for display
    const quoteIfString = (val) => typeof val === 'string' && isNaN(val) ? `"${val}"` : val;

    // Validate the condition
    let isValid = true;
    let previewString = '';

    // Reset validation styling
    leftVarSelect.classList.remove('is-invalid');
    operatorSelect.classList.remove('is-invalid');
    rightValueInput.classList.remove('is-invalid');
    rightVarSelect.classList.remove('is-invalid');

    // Check left variable
    if (!leftVar) {
        leftVarSelect.classList.add('is-invalid');
        isValid = false;
    } else {
        previewString += leftVar;
    }

    // Check operator
    if (!operator) {
        operatorSelect.classList.add('is-invalid');
        isValid = false;
    } else if (operator === '%') {
        previewString += ` % `;
    } else {
        previewString += ' ' + operator + ' ';
    }

    // Check right side
    if (useVar) {
        if (!rightVar) {
            rightVarSelect.classList.add('is-invalid');
            isValid = false;
        } else {
            previewString += rightVar;
        }
    } else {
        if (rightValue === '') {
            rightValueInput.classList.add('is-invalid');
            isValid = false;
        } else {
            // Add quotes for string values in preview
            previewString += quoteIfString(rightValue);
        }
    }

    // For modulus, implicitly add the "=== 0" part to the preview for clarity
    if (operator === '%' && isValid) {
        previewString += ' === 0';
    }

    // Update preview text and save button state
    if (isValid) {
        previewText.textContent = previewString;
        saveBtn.disabled = false;
    } else {
        previewText.textContent = 'Complete the condition definition';
        saveBtn.disabled = true;
    }

    return isValid;
}

/**
 * Save conditional settings from the modal
 */
function saveConditionalSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    const leftVar = document.getElementById('conditionalLeftVar').value;
    const operator = document.getElementById('conditionalOperator').value;
    const rightValueInput = document.getElementById('conditionalRightValue');
    const rightVarSelect = document.getElementById('conditionalRightVar');
    const useVariable = document.getElementById('useVariableForRight').checked;

    let rightValue = '';
    let rightVar = '';

    // Basic validation
    if (!leftVar || !operator) {
        showNotification('Please select a variable and operator for the condition.', true);
        return;
    }

    if (useVariable) {
        rightVar = rightVarSelect.value;
        if (!rightVar) {
            showNotification('Please select the second variable for comparison.', true);
            return;
        }
    } else {
        rightValue = rightValueInput.value.trim();
        if (rightValue === '') {
            showNotification('Please enter a value for comparison.', true);
            return;
        }
    }

    // Store settings in data attribute and node.data
    const conditionSettings = {
        leftVar,
        operator,
        useVariable,
        rightValue: useVariable ? null : rightValue, // Store null if using variable
        rightVar: useVariable ? rightVar : null,     // Store null if using value
        // Also store the display text for convenience
        displayText: generateConditionDisplayText({ leftVar, operator, useVariable, rightValue, rightVar })
    };

    // ---- Update node.data and node.dataset.settings ----
    node.dataset.settings = JSON.stringify(conditionSettings);
    // ALSO update the node.data object used by runtime/validation
    if (!node.data) node.data = {}; // Ensure node.data exists
    node.data.condition = conditionSettings; // Store the entire settings object
    // ---- End Update ----

    // Update the node settings indicator
    updateNodeSettingsIndicator(currentEditingNodeId, true);

    // Update text area and close modal
    if (window.updateTextAreaContent) {
        window.updateTextAreaContent();
    }
    const modalElement = document.getElementById('conditionalSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    showNotification('Conditional settings saved');
    currentEditingNodeId = null; // Reset editing node
}

/**
 * Generate human-readable display text for a condition
 * @param {Object} condition - The condition object
 * @returns {string} Human-readable condition text
 */
function generateConditionDisplayText(condition) {
    if (!condition || !condition.leftVar || !condition.operator) {
        return 'Undefined condition';
    }

    // Helper to quote string values for display
    const quoteIfString = (val) => typeof val === 'string' && isNaN(val) ? `"${val}"` : val;

    let display = `${condition.leftVar} ${condition.operator} `;

    if (condition.useVariable) {
        display += condition.rightVar;
    } else {
        display += quoteIfString(condition.rightValue);
    }

    // Add implicit "=== 0" for modulus display
    if (condition.operator === '%') {
        display += ' === 0';
    }

    return display;
}

/**
 * Show process block settings in a modal
 * @param {string} nodeId - The ID of the process node
 * @param {Object} node - The node object
 */
function showProcessSettings(nodeId, node) {
    // Get or initialize operation data for this node
    const nodeData = node.data || {};
    nodeData.operation = nodeData.operation || {};

    // Get the modal element
    const modal = document.getElementById('processSettingsModal');
    const bsModal = new bootstrap.Modal(modal);

    // Cache current node ID to use when saving
    currentEditingNodeId = nodeId;

    // Get form elements
    const targetVarSelect = document.getElementById('processTargetVar');
    const operationSelect = document.getElementById('processOperation');
    const valueTypeSelect = document.getElementById('processValueType');
    const valueInput = document.getElementById('processValue');
    const secondVarSelect = document.getElementById('processSecondVar');
    const valueContainer = document.getElementById('processValueContainer');
    const secondVarContainer = document.getElementById('processSecondVarContainer');
    const noVariablesAlert = document.getElementById('noVariablesAlertProcess');

    // Reset the form
    targetVarSelect.innerHTML = '<option value="" selected disabled>Select variable...</option>';
    secondVarSelect.innerHTML = '<option value="" selected disabled>Select variable...</option>';
    operationSelect.value = '';
    valueInput.value = '';
    valueTypeSelect.value = 'value';
    valueContainer.style.display = 'block';
    secondVarContainer.style.display = 'none';

    // Get all available variables from declaration blocks
    const availableVariables = getAllDeclaredVariables();

    if (availableVariables.length > 0) {
        noVariablesAlert.style.display = 'none';

        // Add variables to the selects
        availableVariables.forEach(variable => {
            // Add to target variable select
            const targetOption = document.createElement('option');
            targetOption.value = variable.name;
            targetOption.textContent = `${variable.name} (${variable.type})`;
            targetVarSelect.appendChild(targetOption);

            // Add to second variable select
            const secondOption = document.createElement('option');
            secondOption.value = variable.name;
            secondOption.textContent = `${variable.name} (${variable.type})`;
            secondVarSelect.appendChild(secondOption);
        });

        // Set existing values if present
        if (nodeData.operation.targetVar) {
            targetVarSelect.value = nodeData.operation.targetVar;
        }

        if (nodeData.operation.operation) {
            operationSelect.value = nodeData.operation.operation;
        }

        if (nodeData.operation.useVariable) {
            valueTypeSelect.value = 'variable';
            valueContainer.style.display = 'none';
            secondVarContainer.style.display = 'block';

            if (nodeData.operation.secondVar) {
                secondVarSelect.value = nodeData.operation.secondVar;
            }
        } else {
            if (nodeData.operation.value !== undefined) {
                valueInput.value = nodeData.operation.value;
            }
        }
    } else {
        // No variables available
        noVariablesAlert.style.display = 'block';
        document.getElementById('saveProcessSettings').disabled = true;
    }

    // Update the operation preview
    updateProcessPreview();

    // Show the modal
    bsModal.show();
}

/**
 * Update the operation preview in the modal
 */
function updateProcessPreview() {
    const targetVarSelect = document.getElementById('processTargetVar');
    const operationSelect = document.getElementById('processOperation');
    const valueTypeSelect = document.getElementById('processValueType');
    const valueInput = document.getElementById('processValue');
    const secondVarSelect = document.getElementById('processSecondVar');
    const previewText = document.getElementById('processPreviewText');
    const saveBtn = document.getElementById('saveProcessSettings');

    // Get selected values
    const targetVar = targetVarSelect.value;
    const operation = operationSelect.value;
    const useVariable = valueTypeSelect.value === 'variable';
    const value = valueInput.value;
    const secondVar = secondVarSelect.value;

    // Validate the operation
    let isValid = true;
    let previewString = '';

    // Reset validation styling
    targetVarSelect.classList.remove('is-invalid');
    operationSelect.classList.remove('is-invalid');
    valueInput.classList.remove('is-invalid');
    secondVarSelect.classList.remove('is-invalid');

    // Check target variable
    if (!targetVar) {
        targetVarSelect.classList.add('is-invalid');
        isValid = false;
    } else {
        previewString += targetVar + ' ';
    }

    // Special case for unary operations
    if (operation === '^2' || operation === 'sqrt') {
        if (targetVar) {
            if (operation === '^2') {
                previewString = `${targetVar} = ${targetVar} * ${targetVar}`;
            } else if (operation === 'sqrt') {
                previewString = `${targetVar} = √${targetVar}`;
            }
        }
    } else {
        // Regular binary operations
        if (!operation) {
            operationSelect.classList.add('is-invalid');
            isValid = false;
        } else {
            if (operation === '=') {
                previewString += '= ';
            } else {
                previewString += '= ' + targetVar + ' ' + operation + ' ';
            }
        }

        // Check right side
        if (useVariable) {
            if (!secondVar) {
                secondVarSelect.classList.add('is-invalid');
                isValid = false;
            } else {
                previewString += secondVar;
            }
        } else {
            if (value === '') {
                valueInput.classList.add('is-invalid');
                isValid = false;
            } else {
                previewString += value;
            }
        }
    }

    // Update preview text and save button state
    if (isValid) {
        previewText.textContent = previewString;
        saveBtn.disabled = false;
    } else {
        previewText.textContent = 'Complete the operation definition';
        saveBtn.disabled = true;
    }

    return isValid;
}

/**
 * Save process settings from the modal
 */
function saveProcessSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    const targetVar = document.getElementById('processTargetVar').value;
    const operation = document.getElementById('processOperation').value;
    const valueType = document.getElementById('processValueType').value;
    const valueInput = document.getElementById('processValue');
    const secondVarSelect = document.getElementById('processSecondVar');

    let value = '';
    let secondVar = '';

    // Basic validation
    if (!targetVar || !operation) {
        showNotification('Please select a target variable and operation.', true);
        return;
    }

    if (valueType === 'variable') {
        secondVar = secondVarSelect.value;
        if (!secondVar) {
            showNotification('Please select the second variable for the operation.', true);
            return;
        }
    } else {
        value = valueInput.value.trim();
        if (value === '' && operation !== 'sqrt') { // Value not needed for sqrt
            showNotification('Please enter a value for the operation.', true);
            return;
        }
        // TODO: Add validation for numeric values if required by operation (+, -, *, /)
    }

    // Store settings in data attribute and node.data
    const processSettings = {
        targetVariable: targetVar,
        operation: operation,
        valueType: valueType,
        value: valueType === 'value' ? value : null,
        secondVariable: valueType === 'variable' ? secondVar : null,
        // Also store the display text
        displayText: generateOperationDisplayText({ targetVar, operation, valueType, value, secondVar })
    };

    // ---- Update node.data and node.dataset.settings ----
    node.dataset.settings = JSON.stringify(processSettings);
    // ALSO update the node.data object used by runtime/validation
    if (!node.data) node.data = {}; // Ensure node.data exists
    node.data.operation = processSettings; // Store the entire settings object
    // ---- End Update ----

    // Update the node settings indicator
    updateNodeSettingsIndicator(currentEditingNodeId, true);

    // Update text area and close modal
    if (window.updateTextAreaContent) {
        window.updateTextAreaContent();
    }
    const modalElement = document.getElementById('processSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    showNotification('Process settings saved');
    currentEditingNodeId = null; // Reset editing node
}

/**
 * Generate human-readable display text for an operation
 * @param {Object} operation - The operation object
 * @returns {string} Human-readable operation text
 */
function generateOperationDisplayText(operation) {
    if (!operation || !operation.targetVar || !operation.operation) {
        return 'Undefined operation';
    }

    let display = '';

    // Special case for unary operations
    if (operation.operation === '^2') {
        display = `${operation.targetVar} = ${operation.targetVar}²`;
        return display;
    }

    if (operation.operation === 'sqrt') {
        display = `${operation.targetVar} = √${operation.targetVar}`;
        return display;
    }

    // Handle Modulus
    if (operation.operation === '%') {
        display = `${operation.targetVar} = ${operation.targetVar} % `;
        if (operation.useVariable || operation.valueType === 'variable') { // Check both potential properties
            display += operation.secondVar || operation.secondVariable || '';
        } else {
            if (typeof operation.value === 'string') {
                display += `"${operation.value}"`;
            } else {
                display += operation.value;
            }
        }
        return display;
    }

    // Regular binary operations
    if (operation.operation === '=') {
        display = `${operation.targetVar} = `;
    } else {
        display = `${operation.targetVar} = ${operation.targetVar} ${operation.operation} `;
    }

    if (operation.useVariable) {
        display += operation.secondVar;
    } else {
        // Add quotes for string values in display
        if (typeof operation.value === 'string') {
            display += `"${operation.value}"`;
        } else {
            display += operation.value;
        }
    }

    return display;
}

/**
 * Show loop block settings in a modal
 * @param {string} nodeId - The ID of the loop node
 * @param {Object} node - The node object
 */
function showLoopSettings(nodeId, node) {
    // Get or initialize loop data for this node
    const nodeData = node.data || {};
    nodeData.loop = nodeData.loop || {};

    // Get the modal element
    const modal = document.getElementById('loopSettingsModal');
    const bsModal = new bootstrap.Modal(modal);

    // Cache current node ID to use when saving
    currentEditingNodeId = nodeId;

    // Get form elements
    const iterationTypeSelect = document.getElementById('loopIterationType');
    const iterationValueInput = document.getElementById('loopIterationValue');
    const iterationVarSelect = document.getElementById('loopIterationVar');
    const iterationValueContainer = document.getElementById('loopIterationValueContainer');
    const iterationVarContainer = document.getElementById('loopIterationVarContainer');
    const noVariablesAlert = document.getElementById('noVariablesAlertLoop');

    // Reset the form
    iterationVarSelect.innerHTML = '<option value="" selected disabled>Select variable...</option>';
    iterationTypeSelect.value = 'value';
    iterationValueInput.value = '1';
    iterationValueContainer.style.display = 'block';
    iterationVarContainer.style.display = 'none';

    // Get all available variables from declaration blocks, but only int type
    const availableVariables = getAllDeclaredVariables().filter(variable =>
        variable.type === 'int' || variable.type === 'float'
    );

    let showNoVarsAlert = false;

    if (availableVariables.length > 0) {
        // Add variables to the variable select
        availableVariables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.name;
            option.textContent = `${variable.name} (${variable.type})`;
            iterationVarSelect.appendChild(option);
        });
    } else {
        // No numeric variables available for iteration count
        showNoVarsAlert = true;
    }

    // Set existing values if present
    if (nodeData.loop) {
        if (nodeData.loop.useVariable) {
            iterationTypeSelect.value = 'variable';
            iterationValueContainer.style.display = 'none';
            iterationVarContainer.style.display = 'block';

            if (nodeData.loop.iterationVar) {
                // Check if the variable still exists
                const varExists = availableVariables.some(v => v.name === nodeData.loop.iterationVar);
                if (varExists) {
                    iterationVarSelect.value = nodeData.loop.iterationVar;
                } else {
                    showNoVarsAlert = true;
                }
            }
        } else {
            if (nodeData.loop.iterations !== undefined) {
                iterationValueInput.value = nodeData.loop.iterations;
            }
        }
    }

    // Show/hide no variables alert
    noVariablesAlert.style.display = showNoVarsAlert ? 'block' : 'none';

    // Update the loop preview
    updateLoopPreview();

    // Show the modal
    bsModal.show();
}

/**
 * Update the loop preview in the modal
 */
function updateLoopPreview() {
    const iterationTypeSelect = document.getElementById('loopIterationType');
    const iterationValueInput = document.getElementById('loopIterationValue');
    const iterationVarSelect = document.getElementById('loopIterationVar');
    const previewText = document.getElementById('loopPreviewText');
    const saveBtn = document.getElementById('saveLoopSettings');

    // Get selected values
    const useVariable = iterationTypeSelect.value === 'variable';
    const iterations = iterationValueInput.value;
    const iterationVar = iterationVarSelect.value;

    // Validate the inputs
    let isValid = true;
    let previewString = '';

    // Reset validation styling
    iterationValueInput.classList.remove('is-invalid');
    iterationVarSelect.classList.remove('is-invalid');

    if (useVariable) {
        if (!iterationVar) {
            iterationVarSelect.classList.add('is-invalid');
            isValid = false;
            previewString = 'Select a variable for the iteration count';
        } else {
            previewString = `Loop will execute based on the value of "${iterationVar}"`;
        }
    } else {
        // Validate the iteration value
        const iterationCount = parseInt(iterations, 10);
        if (isNaN(iterationCount) || iterationCount < 1) {
            iterationValueInput.classList.add('is-invalid');
            isValid = false;
            previewString = 'Enter a valid number of iterations (minimum 1)';
        } else {
            const plural = iterationCount !== 1 ? 's' : '';
            previewString = `Loop will execute ${iterationCount} time${plural}`;
        }
    }

    // Update preview text and save button state
    previewText.textContent = previewString;
    saveBtn.disabled = !isValid;

    return isValid;
}

/**
 * Save loop settings from the modal
 */
function saveLoopSettings() {
    if (!flowInstance || !currentEditingNodeId) return;

    const node = flowInstance.getNodes()[currentEditingNodeId];
    if (!node) return;

    const iterationType = document.getElementById('loopIterationType').value;
    const iterationValueInput = document.getElementById('loopIterationValue');
    const iterationVarSelect = document.getElementById('loopIterationVar');

    let iterations = null;
    let variableName = null;
    let isValid = true;

    if (iterationType === 'variable') {
        variableName = iterationVarSelect.value;
        if (!variableName) {
            showNotification('Please select a variable for the iteration count.', true);
            isValid = false;
        }
        // Further validation: Ensure the selected variable is numeric (handled in runFlow validation)
    } else {
        iterations = parseInt(iterationValueInput.value, 10);
        if (isNaN(iterations) || iterations < 1) {
            showNotification('Please enter a valid number of iterations (>= 1).', true);
            iterationValueInput.classList.add('is-invalid');
            isValid = false;
        } else {
            iterationValueInput.classList.remove('is-invalid');
        }
    }

    if (!isValid) return;

    // Store settings in data attribute and node.data
    const loopSettings = {
        loopType: 'iterations', // Assuming fixed iterations for now based on modal structure
        iterationType: iterationType,
        iterations: iterationType === 'value' ? iterations : null,
        variableName: iterationType === 'variable' ? variableName : null,
        // Also store display text
        displayText: generateLoopDisplayText({ iterationType, iterations, variableName })
    };

    // ---- Update node.data and node.dataset.settings ----
    node.dataset.settings = JSON.stringify(loopSettings);
    // ALSO update the node.data object used by runtime/validation
    if (!node.data) node.data = {}; // Ensure node.data exists
    node.data.loop = loopSettings; // Store the entire settings object
    // ---- End Update ----

    // Update node settings indicator
    updateNodeSettingsIndicator(currentEditingNodeId, true);

    // Update text area and close modal
    if (window.updateTextAreaContent) {
        window.updateTextAreaContent();
    }
    const modalElement = document.getElementById('loopSettingsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    showNotification('Loop settings saved');
    currentEditingNodeId = null;
}

/**
 * Generate human-readable display text for a loop configuration
 * @param {Object} loop - The loop configuration object
 * @returns {string} Human-readable loop text
 */
function generateLoopDisplayText(loop) {
    if (!loop) {
        return 'Undefined loop';
    }

    if (loop.loopType === 'iterations') {
        if (loop.useVariable) {
            return `Loop ${loop.iterations} times based on variable ${loop.iterationVar}`;
        } else {
            const plural = loop.iterations !== 1 ? 's' : '';
            return `Loop ${loop.iterations} time${plural}`;
        }
    }

    return 'Loop configuration';
}

// Export the module functions
const MoldoSettings = {
    initSettings,
    showNodeSettings,
    addVariableRow,
    updateValueFieldBasedOnType,
    getVariableNameError,
    validateVariableName,
    validateAllVariableNames,
    saveDeclarationSettings,
    saveOutputSettings,
    getAllDeclaredVariables,
    updateNodeSettingsIndicator,
    initNodeSettingsIndicators,
    validateOutputMessage,
    insertVariableIntoMessage,
    updateConditionPreview,
    saveConditionalSettings,
    generateConditionDisplayText,
    showProcessSettings,
    updateProcessPreview,
    saveProcessSettings,
    generateOperationDisplayText,
    showLoopSettings,
    updateLoopPreview,
    saveLoopSettings,
    generateLoopDisplayText,
    setupInputSettingsModal, // New
    showInputSettings,       // New
    saveInputSettings        // New
};

// Make the module available globally
window.MoldoSettings = MoldoSettings; 