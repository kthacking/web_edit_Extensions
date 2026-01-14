/* Live Editor v3.6 - Keyboard Navigation & Multi-Selection */
(function () {
    if (document.getElementById('live-editor-root')) {
        const root = document.getElementById('live-editor-root');
        if (root.style.display === 'none') root.style.display = 'block';
        else root.style.display = 'none';
        return;
    }

    // --- 1. State & History ---
    const state = {
        selection: [], mode: 'select', viewport: 'desktop',
        isDragging: false, isResizing: false, resizeHandle: null, startPos: { x: 0, y: 0 },
        resizeSnapshot: null, moveSnapshot: null, dragStartStyles: [],
        activeColorProp: null, pickerStartStyles: [],
        cp: { h: 0, s: 100, v: 100, isDraggingSV: false, isDraggingHue: false },
        history: [], historyPtr: -1,

        record(cmd) {
            if (this.historyPtr < this.history.length - 1) this.history = this.history.slice(0, this.historyPtr + 1);
            this.history.push(cmd); this.historyPtr++;
            if (this.history.length > 50) { this.history.shift(); this.historyPtr--; }
        },
        undo() {
            if (this.historyPtr >= 0) { this.history[this.historyPtr].undo(); this.historyPtr--; updateOverlays(); syncPanel(); }
        },
        redo() {
            if (this.historyPtr < this.history.length - 1) { this.historyPtr++; this.history[this.historyPtr].redo(); updateOverlays(); syncPanel(); }
        }
    };

    const snapshotStyles = (els) => els.map(el => ({ el, css: el.style.cssText }));
    const restoreStyles = (snap) => snap.forEach(item => { if (item.el && item.el.style) item.el.style.cssText = item.css; });

    // --- 2. Data Lists ---
    const OPTIONS = {
        fontFamily: ["Inter", "Roboto", "Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Verdana", "Impact"],
        display: ["block", "flex", "grid", "inline-block", "inline", "none"],
        position: ["static", "relative", "absolute", "fixed", "sticky"],
        textAlign: ["left", "center", "right", "justify"],
        fontWeight: ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"]
    };

    function createControl(label, prop, type = 'input') {
        let inputHtml = '';
        if (type === 'select' && OPTIONS[prop]) {
            inputHtml = `<select class="le-select" id="le-p-${prop}" data-prop="${prop}">`;
            OPTIONS[prop].forEach(opt => inputHtml += `<option value="${opt}">${opt}</option>`);
            inputHtml += `</select>`;
        } else {
            inputHtml = `<input class="le-input" id="le-p-${prop}" data-prop="${prop}">`;
        }
        return `<div class="le-control-col"><span class="le-label">${label}</span>${inputHtml}</div>`;
    }

    // --- 3. HTML Templates ---
    const ICONS = { select: 'fa-arrow-pointer', move: 'fa-up-down-left-right', text: 'fa-i-cursor', delete: 'fa-trash', desktop: 'fa-desktop', tablet: 'fa-tablet-screen-button', mobile: 'fa-mobile-screen-button', undo: 'fa-rotate-left', redo: 'fa-rotate-right' };

    const UI_TOOLBAR = `
    <div class="le-toolbar">
        <div class="le-brand"><i class="fa-solid fa-layer-group"></i></div>
        <div class="le-divider"></div>
        <button class="le-icon-btn active" id="le-tool-select" title="Select"><i class="fa-solid ${ICONS.select}"></i></button>
        <button class="le-icon-btn" id="le-tool-move" title="Move"><i class="fa-solid ${ICONS.move}"></i></button>
        <button class="le-icon-btn" id="le-tool-text" title="Text"><i class="fa-solid ${ICONS.text}"></i></button>
        <button class="le-icon-btn" id="le-tool-delete" title="Delete"><i class="fa-solid ${ICONS.delete}"></i></button>
        <div class="le-divider"></div>
         <button class="le-icon-btn" id="le-tool-undo" title="Undo"><i class="fa-solid ${ICONS.undo}"></i></button>
         <button class="le-icon-btn" id="le-tool-redo" title="Redo"><i class="fa-solid ${ICONS.redo}"></i></button>
        <div class="le-divider"></div>
        <button class="le-icon-btn" id="le-view-desktop" title="Desktop"><i class="fa-solid ${ICONS.desktop}"></i></button>
        <button class="le-icon-btn" id="le-view-tablet" title="Tablet"><i class="fa-solid ${ICONS.tablet}"></i></button>
        <button class="le-icon-btn" id="le-view-mobile" title="Mobile"><i class="fa-solid ${ICONS.mobile}"></i></button>
        <div class="le-divider"></div>
        <button class="le-publish-btn" id="le-finish-btn" style="background:#111;border:none;color:white;padding:0 16px;border-radius:100px;height:32px;font-size:11px;font-weight:700;text-transform:uppercase;cursor:pointer;">Done</button>
    </div>`;

    const UI_SIDEBAR = `
    <div class="le-sidebar">
        <div class="le-sidebar-header" id="le-panel-header" title="Click to Collapse/Expand">
            <h3>Properties</h3>
            <i class="fa-solid fa-chevron-down le-toggle-icon" id="le-panel-toggle"></i>
        </div>
        <div class="le-scroll-area">
            <div class="le-block-title">Add Elements</div>
            <div class="le-component-grid">
                <div class="le-component-btn" data-type="text"><i class="fa-solid fa-font"></i><span>Text</span></div>
                <div class="le-component-btn" data-type="btn"><i class="fa-solid fa-mobile-button"></i><span>Button</span></div>
                <div class="le-component-btn" data-type="img"><i class="fa-regular fa-image"></i><span>Image</span></div>
                <div class="le-component-btn" data-type="input"><i class="fa-regular fa-keyboard"></i><span>Input</span></div>
                <div class="le-component-btn" data-type="container"><i class="fa-regular fa-square"></i><span>Box</span></div>
                <div class="le-component-btn" data-type="card"><i class="fa-regular fa-address-card"></i><span>Card</span></div>
            </div>

            <div class="le-block-title" style="border-top:1px solid #e0e0e0;">Properties</div>
            <div class="le-inspector-box">
                <div class="le-control-row">
                    ${createControl('W', 'width')}
                    ${createControl('H', 'height')}
                </div>
                 <div class="le-control-row">
                    ${createControl('Display', 'display', 'select')}
                    ${createControl('Position', 'position', 'select')}
                </div>
                 <div class="le-control-row">
                    ${createControl('Margin', 'margin')}
                    ${createControl('Padding', 'padding')}
                </div>
                ${createControl('Font Family', 'fontFamily', 'select')}
                <div class="le-control-row">
                    ${createControl('Size', 'fontSize')}
                    <div class="le-control-col"><span class="le-label">Color</span>
                         <div class="le-color-wrap" id="le-trig-color" style="cursor:pointer">
                            <div class="le-color-preview" id="le-pv-color"></div>
                            <input class="le-input" id="le-p-color" style="border:none;padding:0;pointer-events:none;" readonly placeholder="Select">
                         </div>
                    </div>
                </div>
                <div class="le-control-row">
                    ${createControl('Align', 'textAlign', 'select')}
                    ${createControl('Weight', 'fontWeight', 'select')}
                </div>
                 <div class="le-control-col"><span class="le-label">Background</span>
                    <div class="le-color-wrap" id="le-trig-bg" style="cursor:pointer">
                        <div class="le-color-preview" id="le-pv-backgroundColor"></div>
                        <input class="le-input" id="le-p-backgroundColor" style="border:none;padding:0;pointer-events:none;" readonly placeholder="Select">
                    </div>
                 </div>
                 <div class="le-control-row">
                    ${createControl('Radius', 'borderRadius')}
                    ${createControl('Opacity', 'opacity')}
                </div>
                 ${createControl('Border', 'border')}
                 ${createControl('Shadow', 'boxShadow')}
            </div>
        </div>
    </div>`;

    // --- 4. Build UI ---
    const root = document.createElement('div');
    root.id = 'live-editor-root';
    root.innerHTML = UI_TOOLBAR + UI_SIDEBAR;
    document.body.appendChild(root);

    const overlays = document.createElement('div');
    overlays.id = 'le-overlays-container';
    overlays.style.position = 'fixed'; overlays.style.top = '0'; overlays.style.left = '0'; overlays.style.width = '100%'; overlays.style.height = '100%'; overlays.style.pointerEvents = 'none'; overlays.style.zIndex = '2147483646';
    document.body.appendChild(overlays);

    // VISUAL COLOR PICKER
    const colorPicker = document.createElement('div');
    colorPicker.id = 'le-color-picker';
    Object.assign(colorPicker.style, {
        position: 'fixed', display: 'none', zIndex: '2147483647',
        background: 'white', padding: '12px', borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)', width: '260px', border: '1px solid #e0e0e0', font: 'inherit'
    });

    colorPicker.innerHTML = `
        <div style="display:flex; gap:12px; height:180px; margin-bottom:12px;">
            <div id="le-cp-sv" style="flex:1; position:relative; background:red; border-radius:6px; overflow:hidden; cursor:crosshair; box-shadow:inset 0 0 1px rgba(0,0,0,0.2);">
                <div style="position:absolute;top:0;left:0;right:0;bottom:0; background:linear-gradient(to right, #fff, transparent);"></div>
                <div style="position:absolute;top:0;left:0;right:0;bottom:0; background:linear-gradient(to top, #000, transparent);"></div>
                <div id="le-cp-sv-handle" style="width:14px;height:14px;border:2px solid white;border-radius:50%;position:absolute;top:0;left:0;transform:translate(-50%,-50%);box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;"></div>
            </div>
            <div id="le-cp-hue" style="width:24px; position:relative; border-radius:12px; background:linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); cursor:default; box-shadow:inset 0 0 1px rgba(0,0,0,0.2);">
                 <div id="le-cp-hue-handle" style="width:20px;height:20px;border:3px solid white;background:inherit;border-radius:50%;position:absolute;left:50%;top:0;transform:translate(-50%,-50%);box-shadow:0 0 4px rgba(0,0,0,0.4);pointer-events:none;"></div>
            </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div style="width:32px; height:32px; border-radius:6px; border:1px solid #ddd;" id="le-cp-preview"></div>
            <div style="flex:1;">
                <label style="font-size:10px; color:#999; font-weight:600; text-transform:uppercase;">Hex</label>
                <input type="text" id="le-cp-hex" value="#FF0000" style="width:100%; padding:6px; border:1px solid #e0e0e0; border-radius:4px; font-size:13px; font-family:monospace; color:#333;">
            </div>
             <button id="le-cp-close" style="height:32px; margin-top:16px; background:#f5f5f5; border:none; padding:0 12px; border-radius:4px; font-size:12px; font-weight:600; color:#555; cursor:pointer;">OK</button>
        </div>
    `;
    document.body.appendChild(colorPicker);

    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link'); fa.rel = 'stylesheet'; fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'; document.head.appendChild(fa);
    }

    function hsvToRgb(h, s, v) {
        let r, g, b, i, f, p, q, t; h /= 360; s /= 100; v /= 100; i = Math.floor(h * 6); f = h * 6 - i; p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s);
        switch (i % 6) { case 0: r = v, g = t, b = p; break; case 1: r = q, g = v, b = p; break; case 2: r = p, g = v, b = t; break; case 3: r = p, g = q, b = v; break; case 4: r = t, g = p, b = v; break; case 5: r = v, g = p, b = q; break; }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max, d = max - min; s = max == 0 ? 0 : d / max;
        if (max == min) h = 0; else { switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }
    function rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }
    function hexToRgb(h) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null; }

    const svBox = document.getElementById('le-cp-sv'), svHandle = document.getElementById('le-cp-sv-handle'), hueBox = document.getElementById('le-cp-hue'), hueHandle = document.getElementById('le-cp-hue-handle'), preview = document.getElementById('le-cp-preview'), hexInput = document.getElementById('le-cp-hex');

    function updatePickerUI() {
        svBox.style.backgroundColor = `hsl(${state.cp.h},100%,50%)`;
        svHandle.style.left = `${state.cp.s}%`; svHandle.style.top = `${100 - state.cp.v}%`;
        hueHandle.style.top = `${(state.cp.h / 360) * 100}%`;
        const rgb = hsvToRgb(state.cp.h, state.cp.s, state.cp.v); const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        preview.style.backgroundColor = hex; hexInput.value = hex;
        if (state.activeColorProp) {
            applyProp(state.activeColorProp, hex, false);
            document.getElementById(`le-p-${state.activeColorProp}`).value = hex;
        }
    }

    function handleColorMouseDown(e) { state.pickerStartStyles = snapshotStyles(state.selection); }
    function handleColorMouseUp() {
        const before = state.pickerStartStyles; const after = snapshotStyles(state.selection);
        if (before.length && JSON.stringify(before.map(x => x.css)) !== JSON.stringify(after.map(x => x.css))) {
            state.record({ undo: () => restoreStyles(before), redo: () => restoreStyles(after) });
        }
        state.cp.isDraggingSV = false; state.cp.isDraggingHue = false;
    }

    svBox.addEventListener('mousedown', (e) => { state.cp.isDraggingSV = true; handleColorMouseDown(e); updateSV(e); });
    hueBox.addEventListener('mousedown', (e) => { state.cp.isDraggingHue = true; handleColorMouseDown(e); updateHue(e); });

    function updateSV(e) { const r = svBox.getBoundingClientRect(); let x = e.clientX - r.left, y = e.clientY - r.top; x = Math.max(0, Math.min(x, r.width)); y = Math.max(0, Math.min(y, r.height)); state.cp.s = (x / r.width) * 100; state.cp.v = 100 - ((y / r.height) * 100); updatePickerUI(); }
    function updateHue(e) { const r = hueBox.getBoundingClientRect(); let y = e.clientY - r.top; y = Math.max(0, Math.min(y, r.height)); state.cp.h = (y / r.height) * 360; updatePickerUI(); }
    document.addEventListener('mousemove', (e) => { if (state.cp.isDraggingSV) { e.preventDefault(); updateSV(e); } if (state.cp.isDraggingHue) { e.preventDefault(); updateHue(e); } });
    document.addEventListener('mouseup', handleColorMouseUp);

    function openColorPicker(p) {
        state.activeColorProp = p;
        state.pickerStartStyles = snapshotStyles(state.selection);
        const c = document.getElementById(`le-p-${p}`).value; const r = hexToRgb(c) || { r: 255, g: 0, b: 0 }; const h = rgbToHsv(r.r, r.g, r.b); state.cp.h = h.h; state.cp.s = h.s; state.cp.v = h.v;
        updatePickerUI(); colorPicker.style.display = 'block'; colorPicker.style.top = '100px'; colorPicker.style.right = '320px';
    }
    document.getElementById('le-trig-bg').addEventListener('click', () => openColorPicker('backgroundColor'));
    document.getElementById('le-trig-color').addEventListener('click', () => openColorPicker('color'));
    document.getElementById('le-cp-close').addEventListener('click', () => colorPicker.style.display = 'none');

    hexInput.addEventListener('change', e => {
        const oldState = snapshotStyles(state.selection); const r = hexToRgb(e.target.value);
        if (r) { const h = rgbToHsv(r.r, r.g, r.b); state.cp.h = h.h; state.cp.s = h.s; state.cp.v = h.v; updatePickerUI(); const newState = snapshotStyles(state.selection); state.record({ undo: () => restoreStyles(oldState), redo: () => restoreStyles(newState) }); }
    });

    // --- 6. Main Editor Helpers ---
    function setViewport(v) {
        state.viewport = v; document.querySelectorAll('[id^="le-view-"]').forEach(b => b.classList.remove('active')); document.getElementById(`le-view-${v}`).classList.add('active');
        const doc = document.documentElement; doc.style.maxWidth = ''; doc.style.margin = ''; doc.style.border = '';
        if (v === 'tablet') { doc.style.maxWidth = '768px'; doc.style.margin = '0 auto'; doc.style.border = '1px solid #ccc'; }
        if (v === 'mobile') { doc.style.maxWidth = '375px'; doc.style.margin = '0 auto'; doc.style.border = '1px solid #ccc'; }
        updateOverlays();
    }

    function updateOverlays() {
        overlays.innerHTML = ''; if (state.selection.length === 0) return;
        state.selection = state.selection.filter(el => document.body.contains(el));
        if (state.selection.length === 0) { syncPanel(); return; }

        let rect;
        // Calculate Bounding Box for Group Selection
        if (state.selection.length === 1) rect = state.selection[0].getBoundingClientRect();
        else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            state.selection.forEach(el => { const r = el.getBoundingClientRect(); if (r.left < minX) minX = r.left; if (r.top < minY) minY = r.top; if (r.right > maxX) maxX = r.right; if (r.bottom > maxY) maxY = r.bottom; });
            rect = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
        }
        if (rect && rect.width > 0 && rect.height > 0) {
            const div = document.createElement('div'); div.className = 'le-selection-box';
            Object.assign(div.style, { top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' });
            div.innerHTML = `
                <div class="le-resize-handle le-handle-nw" data-dir="nw"></div>
                <div class="le-resize-handle le-handle-ne" data-dir="ne"></div>
                <div class="le-resize-handle le-handle-sw" data-dir="sw"></div>
                <div class="le-resize-handle le-handle-se" data-dir="se"></div>
                <div class="le-resize-handle le-handle-n" data-dir="n"></div>
                <div class="le-resize-handle le-handle-s" data-dir="s"></div>
                <div class="le-resize-handle le-handle-e" data-dir="e"></div>
                <div class="le-resize-handle le-handle-w" data-dir="w"></div>
            `;
            overlays.appendChild(div);
        }
    }

    const PROPS = ['width', 'height', 'display', 'position', 'margin', 'padding', 'fontFamily', 'fontSize', 'fontWeight', 'color', 'textAlign', 'backgroundColor', 'borderRadius', 'opacity', 'border', 'boxShadow'];
    function syncPanel() {
        if (state.selection.length === 0) {
            PROPS.forEach(p => { const i = document.getElementById(`le-p-${p}`); if (i) i.value = ''; });
            document.getElementById('le-pv-backgroundColor').style.background = 'transparent';
            document.getElementById('le-pv-color').style.background = 'transparent';
            return;
        }
        const el = state.selection[state.selection.length - 1]; if (!el) return; const s = window.getComputedStyle(el);
        PROPS.forEach(p => {
            const i = document.getElementById(`le-p-${p}`);
            if (i) {
                if (i.tagName === 'SELECT') {
                    let val = s[p];
                    if (p === 'fontWeight') { if (val === '400') val = 'normal'; if (val === '700') val = 'bold'; }
                    if (p === 'fontFamily') val = val.replace(/['"]/g, '');
                    i.value = val;
                } else {
                    i.value = s[p];
                }
            }
            if (p === 'backgroundColor') { const v = s[p]; document.getElementById('le-pv-backgroundColor').style.background = v; document.getElementById('le-p-backgroundColor').value = rgbToHexParsed(v) || v; }
            if (p === 'color') { const v = s[p]; document.getElementById('le-pv-color').style.background = v; document.getElementById('le-p-color').value = rgbToHexParsed(v) || v; }
        });
    }
    function rgbToHexParsed(h) { if (!h || h.indexOf('rgb') === -1) return h; const c = h.match(/\d+/g).map(Number); return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1).toUpperCase(); }

    function applyProp(p, v, record = true) {
        if (record) { const before = snapshotStyles(state.selection); state.selection.forEach(el => el.style[p] = v); const after = snapshotStyles(state.selection); state.record({ undo: () => restoreStyles(before), redo: () => restoreStyles(after) }); } else { state.selection.forEach(el => el.style[p] = v); }
        updateOverlays();
        if (p === 'backgroundColor') document.getElementById('le-pv-backgroundColor').style.background = v;
        if (p === 'color') document.getElementById('le-pv-color').style.background = v;
    }

    // Sidebar Input & Select Changes
    document.querySelectorAll('.le-input, .le-select').forEach(input => {
        if (input.dataset.prop) {
            let startVal = '';
            input.addEventListener('focus', () => { startVal = snapshotStyles(state.selection); });
            input.addEventListener('change', (e) => {
                const prop = input.dataset.prop;
                state.selection.forEach(el => el.style[prop] = e.target.value);
                const endVal = snapshotStyles(state.selection);
                state.record({ undo: () => restoreStyles(startVal), redo: () => restoreStyles(endVal) });
                updateOverlays();
                if (prop === 'backgroundColor') document.getElementById('le-pv-backgroundColor').style.background = e.target.value;
                if (prop === 'color') document.getElementById('le-pv-color').style.background = e.target.value;
            });
        }
    });

    function addElement(type) {
        let el; const x = window.scrollX + (window.innerWidth / 2) - 100; const y = window.scrollY + (window.innerHeight / 2) - 50;
        if (type === 'text') { el = document.createElement('h2'); el.textContent = 'Text'; } if (type === 'btn') { el = document.createElement('button'); el.textContent = 'Button'; Object.assign(el.style, { padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }); } if (type === 'input') { el = document.createElement('input'); el.placeholder = 'Input'; Object.assign(el.style, { padding: '8px', border: '1px solid #ccc' }); } if (type === 'container') { el = document.createElement('div'); Object.assign(el.style, { width: '200px', height: '200px', background: '#eee', border: '1px dashed #999' }); } if (type === 'card') { el = document.createElement('div'); Object.assign(el.style, { width: '300px', padding: '20px', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', borderRadius: '8px' }); el.innerHTML = `<h3>Card</h3><p>Content</p><button style="background:#007bff;color:#fff;border:none;padding:5px 10px;">Go</button>`; }

        if (el) {
            el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.zIndex = '1000';
            document.body.appendChild(el);
            const addedEl = el; state.record({ undo: () => { addedEl.remove(); state.selection = []; updateOverlays(); }, redo: () => { document.body.appendChild(addedEl); state.selection = [addedEl]; updateOverlays(); } });
            state.selection = [el]; setMode('move'); updateOverlays();
        }
    }

    function deleteSelection() {
        if (state.selection.length === 0) return;
        const deletedItems = state.selection.map(el => ({ el: el, parent: el.parentNode, sibling: el.nextSibling, display: el.style.display }));
        state.selection.forEach(el => el.remove());
        state.record({ undo: () => { deletedItems.forEach(item => { if (item.sibling) item.parent.insertBefore(item.el, item.sibling); else item.parent.appendChild(item.el); }); state.selection = deletedItems.map(x => x.el); updateOverlays(); }, redo: () => { deletedItems.forEach(item => item.el.remove()); state.selection = []; updateOverlays(); } });
        state.selection = []; updateOverlays();
    }

    document.querySelectorAll('.le-component-btn').forEach(b => {
        b.addEventListener('click', () => {
            if (b.dataset.type === 'img') showImageDialog(s => { const e = document.createElement('img'); e.src = s; e.style.width = '300px'; e.style.position = 'absolute'; e.style.left = (window.scrollX + window.innerWidth / 2) + 'px'; e.style.top = (window.scrollY + window.innerHeight / 2) + 'px'; document.body.appendChild(e); const addedEl = e; state.record({ undo: () => addedEl.remove(), redo: () => { document.body.appendChild(addedEl); state.selection = [addedEl]; updateOverlays(); } }); state.selection = [e]; setMode('move'); updateOverlays(); }); else addElement(b.dataset.type);
        });
    });
    function showImageDialog(cb) { const s = prompt("Image URL:"); if (s) cb(s); }

    function setMode(m) { state.mode = m; document.querySelectorAll('.le-icon-btn').forEach(b => b.classList.remove('active')); const t = document.getElementById(`le-tool-${m}`); if (t) t.classList.add('active'); state.selection.forEach(el => el.contentEditable = 'false'); }

    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('le-resize-handle')) { e.preventDefault(); e.stopPropagation(); state.isResizing = true; state.resizeHandle = e.target.dataset.dir; state.startPos = { x: e.clientX, y: e.clientY }; state.dragStartStyles = snapshotStyles(state.selection); state.resizeSnapshot = { items: state.selection.map(el => { const s = window.getComputedStyle(el); const mat = new WebKitCSSMatrix(s.transform); return { el: el, sW: parseFloat(s.width), sH: parseFloat(s.height), sTx: mat.m41, sTy: mat.m42 }; }) }; return; }
        if (root.contains(e.target) || overlays.contains(e.target) || document.getElementById('le-color-picker')?.contains(e.target)) return;
        if (state.mode === 'move' && state.selection.includes(e.target)) { e.preventDefault(); state.isDragging = true; state.startPos = { x: e.clientX, y: e.clientY }; state.dragStartStyles = snapshotStyles(state.selection); state.moveSnapshot = state.selection.map(el => ({ el, sx: new WebKitCSSMatrix(window.getComputedStyle(el).transform).m41, sy: new WebKitCSSMatrix(window.getComputedStyle(el).transform).m42 })); }
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (state.isResizing) {
            const dx = e.clientX - state.startPos.x; const dy = e.clientY - state.startPos.y; const dir = state.resizeHandle;
            state.resizeSnapshot.items.forEach(it => { let newW = it.sW, newH = it.sH, newTx = it.sTx, newTy = it.sTy; if (dir.includes('e')) { newW = it.sW + dx; } if (dir.includes('w')) { newW = it.sW - dx; newTx = it.sTx + dx; } if (dir.includes('s')) { newH = it.sH + dy; } if (dir.includes('n')) { newH = it.sH - dy; newTy = it.sTy + dy; } if (newW < 10) newW = 10; if (newH < 10) newH = 10; it.el.style.width = newW + 'px'; it.el.style.height = newH + 'px'; it.el.style.transform = `translate(${newTx}px, ${newTy}px)`; }); updateOverlays(); syncPanel(); return;
        }
        if (state.isDragging) { const dx = e.clientX - state.startPos.x; const dy = e.clientY - state.startPos.y; state.moveSnapshot.forEach(it => { it.el.style.transform = `translate(${it.sx + dx}px,${it.sy + dy}px)`; }); updateOverlays(); }
    });

    document.addEventListener('mouseup', () => {
        if (state.isDragging || state.isResizing) { const before = state.dragStartStyles; const after = snapshotStyles(state.selection); if (before.length && JSON.stringify(before.map(x => x.css)) !== JSON.stringify(after.map(x => x.css))) { state.record({ undo: () => restoreStyles(before), redo: () => restoreStyles(after) }); } }
        state.isDragging = false; state.isResizing = false;
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('le-resize-handle')) { e.stopPropagation(); return; }
        if (root.contains(e.target) || overlays.contains(e.target) || document.getElementById('le-color-picker')?.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        if (state.mode === 'delete') { deleteSelection(); return; }
        if (e.shiftKey) { const i = state.selection.indexOf(e.target); if (i > -1) state.selection.splice(i, 1); else state.selection.push(e.target); } else state.selection = [e.target];
        updateOverlays(); syncPanel();
        if (state.mode === 'text' && state.selection.length === 1) { state.selection[0].contentEditable = 'true'; state.selection[0].focus(); }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') { if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { deleteSelection(); } }

        // --- MULTI-SELECT TRAVERSAL ---
        if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            if (state.selection.length === 0) return;

            const lastEl = state.selection[state.selection.length - 1];
            let nextEl = null;

            if (e.key === 'ArrowRight') nextEl = lastEl.nextElementSibling;
            if (e.key === 'ArrowLeft') nextEl = lastEl.previousElementSibling;
            if (e.key === 'ArrowUp') nextEl = lastEl.parentElement;
            if (e.key === 'ArrowDown') nextEl = lastEl.firstElementChild;

            // Ensure we don't pick editor UI
            if (nextEl && nextEl.nodeType === 1 && !root.contains(nextEl) && !overlays.contains(nextEl) && nextEl.id !== 'le-color-picker') {
                if (!state.selection.includes(nextEl)) {
                    state.selection.push(nextEl);
                    updateOverlays();
                    syncPanel();
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) state.redo(); else state.undo(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); state.redo(); }
    });
    window.addEventListener('scroll', updateOverlays, true); window.addEventListener('resize', updateOverlays); document.addEventListener('dragstart', e => e.preventDefault(), true);

    document.getElementById('le-tool-delete').addEventListener('click', () => { if (state.selection.length > 0) { deleteSelection(); } else setMode('delete'); });
    document.getElementById('le-tool-undo').addEventListener('click', () => state.undo());
    document.getElementById('le-tool-redo').addEventListener('click', () => state.redo());
    ['select', 'move', 'text'].forEach(m => document.getElementById(`le-tool-${m}`).addEventListener('click', () => setMode(m)));
    ['desktop', 'tablet', 'mobile'].forEach(v => document.getElementById(`le-view-${v}`).addEventListener('click', () => setViewport(v)));
    document.getElementById('le-finish-btn').addEventListener('click', () => { root.remove(); overlays.remove(); document.documentElement.style = ''; document.getElementById('le-color-picker')?.remove(); });

    document.getElementById('le-panel-header').addEventListener('click', () => {
        document.querySelector('.le-sidebar').classList.toggle('collapsed');
    });

})();
