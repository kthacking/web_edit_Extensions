document.addEventListener('DOMContentLoaded', () => {

    // --- State ---
    let selectedElement = null;

    // --- DOM Elements ---
    const editableElements = document.querySelectorAll('.editable-element');
    const inputWidth = document.getElementById('prop-width');
    const inputHeight = document.getElementById('prop-height');
    const inputColor = document.getElementById('prop-color');
    const colorPreview = document.getElementById('prop-color-preview');

    // --- Helper Functions ---

    // Convert computed values (like "rgb(40, 116, 240)") to hex for inputs
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return '#ffffff';
        // Check if already hex
        if (rgb.startsWith('#')) return rgb;
        // Simple regex pick
        const sep = rgb.indexOf(',') > -1 ? ',' : ' ';
        const rgbVals = rgb.substr(4).split(')')[0].split(sep);

        let r = (+rgbVals[0]).toString(16),
            g = (+rgbVals[1]).toString(16),
            b = (+rgbVals[2]).toString(16);

        if (r.length == 1) r = "0" + r;
        if (g.length == 1) g = "0" + g;
        if (b.length == 1) b = "0" + b;

        return "#" + r + g + b;
    }

    // Update panel inputs based on element styles
    function updatePropertiesPanel(element) {
        if (!element) return;

        const computed = window.getComputedStyle(element);

        // Layout
        // We prefer 'style.width' if set, else computed
        // But for "live" feel, showing computed is often better or showing blank if not set.
        // Let's show computed pixels for now, or percent if we can deduce it (hard).
        // A simple approach:
        inputWidth.value = element.style.width || computed.width;
        inputHeight.value = element.style.height || computed.height;

        // Color (Background)
        const bg = computed.backgroundColor;
        const hex = rgbToHex(bg);
        inputColor.value = hex;
        colorPreview.style.background = hex;

        // We could add more here (Typography, Borders, etc.)
    }

    // Apply Property Change
    function applyStyle(property, value) {
        if (selectedElement) {
            selectedElement.style[property] = value;
        }
    }

    // --- Event Listeners : Selection ---

    editableElements.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Deselect previous
            if (selectedElement && selectedElement !== el) {
                selectedElement.classList.remove('selected-element');
                const overlay = selectedElement.querySelector('.editor-overlay');
                if (overlay) overlay.remove();
            }

            selectedElement = el;
            selectedElement.classList.add('selected-element');

            // Inject Overlay if missing
            if (!selectedElement.querySelector('.editor-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'editor-overlay';
                overlay.innerHTML = `
                    <div class="resize-handle handle-tl"></div>
                    <div class="resize-handle handle-tr"></div>
                    <div class="resize-handle handle-bl"></div>
                    <div class="resize-handle handle-br"></div>
                    <div class="edit-badge"><i class="fa-solid fa-pen"></i> ${selectedElement.tagName}</div>
                `;
                // Only append if strict container rules allow (skip img/input)
                if (selectedElement.tagName !== 'IMG' && selectedElement.tagName !== 'INPUT') {
                    selectedElement.appendChild(overlay);
                    overlay.style.display = 'block';
                }
            }

            // Sync Panel
            updatePropertiesPanel(selectedElement);
        });
    });

    // --- Event Listeners : Property Inputs ---

    // Width
    inputWidth.addEventListener('change', (e) => {
        applyStyle('width', e.target.value);
    });
    inputWidth.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyStyle('width', e.target.value);
            inputWidth.blur();
        }
    });

    // Height
    inputHeight.addEventListener('change', (e) => {
        applyStyle('height', e.target.value);
    });
    inputHeight.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyStyle('height', e.target.value);
            inputHeight.blur();
        }
    });

    // Color
    inputColor.addEventListener('input', (e) => {
        const val = e.target.value;
        colorPreview.style.background = val;
        applyStyle('backgroundColor', val);
    });


    // --- Toolbar Toggle (Existing) ---
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!['Delete', 'Resize'].includes(btn.title)) {
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });

});
