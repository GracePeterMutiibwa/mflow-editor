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

    let componentCounter = 0;

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

            // Convert blocks to text
            const blocks = document.querySelectorAll(".moed-component-block");
            let textContent = "";
            blocks.forEach((block) => {
                textContent += block.textContent.trim() + "\n";
            });
            textArea.value = textContent;
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
        e.dataTransfer.setData("text/plain", e.target.dataset.componentType);
        e.target.classList.add("moed-dragging");
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDragEnter(e) {
        e.preventDefault();
        editorArea.classList.add("moed-drop-active");
    }

    function handleDragLeave(e) {
        editorArea.classList.remove("moed-drop-active");
    }

    function handleDrop(e) {
        e.preventDefault();
        editorArea.classList.remove("moed-drop-active");
        const componentType = e.dataTransfer.getData("text/plain");

        // Reset dragging component style
        document.querySelectorAll(".moed-dragging").forEach((el) => {
            el.classList.remove("moed-dragging");
        });

        // Create new component block
        createComponentBlock(componentType);

        // Hide empty state if there are blocks
        updateEmptyState();
    }

    function createComponentBlock(componentType) {
        componentCounter++;
        const id = `moed-component-${componentCounter}`;

        // Create block
        const block = document.createElement("div");
        block.className = "moed-component-block";
        block.id = id;
        block.innerHTML = `
                    Component area (${componentType})
                    <div class="moed-component-actions">
                        <button class="moed-action-button moed-move-up" data-id="${id}">
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button class="moed-action-button moed-move-down" data-id="${id}">
                            <i class="bi bi-arrow-down"></i>
                        </button>
                        <button class="moed-action-button moed-delete" data-id="${id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;

        // Add to editor
        editorArea.appendChild(block);

        // Add event listeners for actions
        block
            .querySelector(".moed-move-up")
            .addEventListener("click", moveBlockUp);
        block
            .querySelector(".moed-move-down")
            .addEventListener("click", moveBlockDown);
        block
            .querySelector(".moed-delete")
            .addEventListener("click", deleteBlock);

        return block;
    }

    function moveBlockUp(e) {
        const blockId = e.currentTarget.dataset.id;
        const block = document.getElementById(blockId);
        const previousBlock = block.previousElementSibling;

        if (
            previousBlock &&
            !previousBlock.classList.contains("moed-empty-state")
        ) {
            editorArea.insertBefore(block, previousBlock);
        }
    }

    function moveBlockDown(e) {
        const blockId = e.currentTarget.dataset.id;
        const block = document.getElementById(blockId);
        const nextBlock = block.nextElementSibling;

        if (nextBlock) {
            editorArea.insertBefore(nextBlock, block);
        }
    }

    function deleteBlock(e) {
        const blockId = e.currentTarget.dataset.id;
        const block = document.getElementById(blockId);
        block.remove();
        updateEmptyState();
    }

    function updateEmptyState() {
        const hasBlocks =
            editorArea.querySelectorAll(".moed-component-block").length > 0;
        emptyState.style.display = hasBlocks ? "none" : "block";
    }

    // Clear button functionality
    document
        .querySelector(".moed-clear-button")
        .addEventListener("click", function () {
            const blocks = editorArea.querySelectorAll(".moed-component-block");
            blocks.forEach((block) => block.remove());
            updateEmptyState();
        });

    // Initialize components
    updateEmptyState();
});
