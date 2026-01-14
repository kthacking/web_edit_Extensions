/* Editor Logic - Group Resizing */
(function () {
    if (document.getElementById('live-editor-root')) {
        alert('Live Editor is already active!');
        return;
    }

    // --- State ---
    const state = {
        selection: [],
        mode: 'select',
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        startPos: { x: 0, y: 0 },

        // Group Logic
        moveSnapshot: [],    // For moving: [{ el, startTx, startTy }]
        resizeSnapshot: {    // For resizing
            groupRect: null, // { x, y, w, h }
            items: []        // [{ el, rect, startW, startH, startTx, startTy }]
        }
    };

    // --- UI Layout ---
    const root = document.createElement('div');
    root.id = 'live-editor-root';
    root.innerHTML = `
    <div class="le-toolbar-top">
        <div class="le-brand"><i class="fa-solid fa-layer-group"></i> LiveEditor</div>
        <div class="le-actions">
            <button class="le-btn active" id="le-tool-select" title="Select (Shift+Click)"><i class="fa-solid fa-arrow-pointer"></i></button>
            <button class="le-btn" id="le-tool-move" title="Move"><i class="fa-solid fa-up-down-left-right"></i></button>
            <button class="le-btn" id="le-tool-text" title="Edit Text"><i class="fa-solid fa-i-cursor"></i></button>
            <button class="le-btn" id="le-tool-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
            <div class="le-divider"></div>
            <button class="le-btn" id="le-tool-add-text" title="Add Text"><i class="fa-solid fa-font"></i></button>
            <button class="le-btn" id="le-tool-add-img" title="Add Image"><i class="fa-regular fa-image"></i></button>
            <button class="le-btn" id="le-tool-add-btn" title="Add Button"><i class="fa-solid fa-mobile-button"></i></button>
        </div>
        <div class="le-meta"><button class="le-publish-btn" id="le-finish-btn">Done</button></div>
    </div>
    <aside class="le-properties-panel">
        <div class="le-panel-header"><h3>Properties</h3><i class="fa-solid fa-xmark" id="le-close-panel"></i></div>
        <div class="le-panel-section"><label class="le-label">Layout</label>
            <div class="le-row le-two-col"><div class="le-input-group"><span>W</span><input id="le-prop-width"></div><div class="le-input-group"><span>H</span><input id="le-prop-height"></div></div>
            <div class="le-row"><div class="le-input-group"><span>Display</span><input id="le-prop-display"></div></div>
        </div>
        <div class="le-panel-section"><label class="le-label">Typography</label>
            <div class="le-row le-two-col"><input id="le-prop-color-text" placeholder="Color"><input id="le-prop-size" placeholder="Size"></div>
        </div>
        <div class="le-panel-section"><label class="le-label">Background</label>
            <div class="le-row"><div class="le-input-group"><span>Bg</span><input id="le-prop-bg"><div class="le-color-preview" id="le-preview-bg"></div></div></div>
        </div>
    </aside>`;
    document.body.appendChild(root);

    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fa);
    }

    const overlaysContainer = document.createElement('div');
    overlaysContainer.id = 'le-overlays-container';
    overlaysContainer.style.position = 'fixed'; // Viewport relative
    overlaysContainer.style.top = '0';
    overlaysContainer.style.left = '0';
    overlaysContainer.style.width = '100%';
    overlaysContainer.style.height = '100%';
    overlaysContainer.style.pointerEvents = 'none';
    overlaysContainer.style.zIndex = '2147483645';
    document.body.appendChild(overlaysContainer);

    const inputs = {
        w: document.getElementById('le-prop-width'),
        h: document.getElementById('le-prop-height'),
        d: document.getElementById('le-prop-display'),
        bg: document.getElementById('le-prop-bg'),
        bgP: document.getElementById('le-preview-bg'),
        c: document.getElementById('le-prop-color-text'),
        s: document.getElementById('le-prop-size')
    };

    // --- Utils ---

    function getTranslate(el) {
        const style = window.getComputedStyle(el);
        const mat = new WebKitCSSMatrix(style.transform);
        return { x: mat.m41, y: mat.m42 };
    }

    // A single box for either one element OR the bounding box of many
    function createBox(rect, label) {
        const div = document.createElement('div');
        div.className = 'le-selection-box';
        Object.assign(div.style, {
            position: 'absolute',
            border: '2px solid #007bff',
            pointerEvents: 'none',
            display: 'block',
            top: rect.top + 'px',
            left: rect.left + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px'
        });

        div.innerHTML = `
            <div class="le-resize-handle le-handle-tl" data-dir="tl"></div>
            <div class="le-resize-handle le-handle-tr" data-dir="tr"></div>
            <div class="le-resize-handle le-handle-bl" data-dir="bl"></div>
            <div class="le-resize-handle le-handle-br" data-dir="br"></div>
            <div class="le-badge">${label}</div>
        `;

        div.querySelectorAll('.le-resize-handle').forEach(h => {
            h.style.pointerEvents = 'auto'; // Catch clicks
            Object.assign(h.style, {
                position: 'absolute', width: '10px', height: '10px',
                background: 'white', border: '1px solid #007bff', zIndex: 10
            });
            if (h.classList.contains('le-handle-tl')) Object.assign(h.style, { top: '-6px', left: '-6px', cursor: 'nw-resize' });
            if (h.classList.contains('le-handle-tr')) Object.assign(h.style, { top: '-6px', right: '-6px', cursor: 'ne-resize' });
            if (h.classList.contains('le-handle-bl')) Object.assign(h.style, { bottom: '-6px', left: '-6px', cursor: 'sw-resize' });
            if (h.classList.contains('le-handle-br')) Object.assign(h.style, { bottom: '-6px', right: '-6px', cursor: 'se-resize' });
        });

        const badge = div.querySelector('.le-badge');
        Object.assign(badge.style, {
            position: 'absolute', top: '-24px', left: '0',
            background: '#007bff', color: 'white',
            padding: '2px 6px', borderRadius: '4px', fontSize: '11px'
        });

        return div;
    }

    function getCombinedRect(elements) {
        if (!elements.length) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.left < minX) minX = r.left;
            if (r.top < minY) minY = r.top;
            if (r.right > maxX) maxX = r.right;
            if (r.bottom > maxY) maxY = r.bottom;
        });
        return {
            left: minX, top: minY,
            width: maxX - minX, height: maxY - minY,
            right: maxX, bottom: maxY
        };
    }

    function updateOverlays() {
        overlaysContainer.innerHTML = '';
        if (!state.selection.length) return;

        if (state.selection.length === 1) {
            // Single Box
            const el = state.selection[0];
            const rect = el.getBoundingClientRect();
            overlaysContainer.appendChild(createBox(rect, el.tagName.toLowerCase()));
        } else {
            // Group Box
            const rect = getCombinedRect(state.selection);
            if (rect) {
                overlaysContainer.appendChild(createBox(rect, `Group (${state.selection.length})`));
            }
        }
    }

    function syncPanel() {
        const primary = state.selection[state.selection.length - 1];
        if (!primary) return;
        const s = window.getComputedStyle(primary);
        inputs.w.value = primary.style.width || s.width;
        inputs.h.value = primary.style.height || s.height;
        inputs.d.value = s.display;
        inputs.bg.value = s.backgroundColor;
        inputs.bgP.style.background = s.backgroundColor;
        inputs.c.value = s.color;
        inputs.s.value = s.fontSize;
    }

    function setMode(m) {
        state.mode = m;
        document.querySelectorAll('.le-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`le-tool-${m}`);
        if (btn) btn.classList.add('active');
        document.body.style.cursor = m === 'move' ? 'move' : (m === 'text' ? 'text' : 'default');
        state.selection.forEach(el => el.contentEditable = 'false');
    }

    // --- Inputs ---

    document.addEventListener('dragstart', (e) => e.preventDefault(), true);

    document.addEventListener('mousedown', (e) => {
        // 1. Resize Handle (Works for Single OR Group now)
        if (e.target.classList.contains('le-resize-handle')) {
            e.preventDefault(); e.stopPropagation();
            state.isResizing = true;
            state.resizeHandle = e.target.dataset.dir;
            state.startPos = { x: e.clientX, y: e.clientY };

            // Snapshot Logic
            const groupRect = getCombinedRect(state.selection);
            state.resizeSnapshot = {
                groupRect: groupRect,
                items: state.selection.map(el => {
                    const rect = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    const t = getTranslate(el);
                    return {
                        el: el,
                        rect: rect,
                        startW: parseFloat(s.width), // use parsed pixel values
                        startH: parseFloat(s.height),
                        startTx: t.x,
                        startTy: t.y,
                        // Relative pos in group (0-1 range roughly, or absolute offset)
                        relX: rect.left - groupRect.left,
                        relY: rect.top - groupRect.top
                    };
                })
            };
            return;
        }

        if (root.contains(e.target) || overlaysContainer.contains(e.target)) return;

        // 2. Move Logic
        const clickedSelected = state.selection.includes(e.target);
        if (state.mode === 'move' && clickedSelected) {
            e.preventDefault();
            state.isDragging = true;
            state.startPos = { x: e.clientX, y: e.clientY };
            state.moveSnapshot = state.selection.map(el => ({
                el: el,
                startTx: getTranslate(el).x,
                startTy: getTranslate(el).y
            }));
        }

    }, true);

    document.addEventListener('mousemove', (e) => {
        // Resize
        if (state.isResizing && state.resizeSnapshot.groupRect) {
            const dx = e.clientX - state.startPos.x;
            const dy = e.clientY - state.startPos.y;
            const r = state.resizeSnapshot.groupRect;
            const h = state.resizeHandle;

            // Calculate new Group Dimensions
            let newW = r.width;
            let newH = r.height;

            // Simple expansion logic (Right/Bottom)
            if (h.includes('r')) newW += dx;
            if (h.includes('b')) newH += dy;
            if (h.includes('l')) newW -= dx; // Visual only, shift logic implies pos change too..
            // Note: For partial handle support (R/B is reliable), keeping complex L/T out for stability unless requested.
            // But user asked for scaling. So we rely on Width/Height ratios.

            // Scale Factors
            // Prevention of div/0
            const scaleX = newW / (r.width || 1);
            const scaleY = newH / (r.height || 1);

            state.resizeSnapshot.items.forEach(item => {
                // Scale Size
                // We use float math then 'px' string
                item.el.style.width = (item.startW * scaleX) + 'px';
                item.el.style.height = (item.startH * scaleY) + 'px';

                // Scale Position (gap)
                // New offset = Old offset * scale
                const newRelX = item.relX * scaleX;
                const newRelY = item.relY * scaleY;

                // Diff is how much we moved
                const shiftX = newRelX - item.relX;
                const shiftY = newRelY - item.relY;

                // Apply to Transform
                item.el.style.transform = `translate(${item.startTx + shiftX}px, ${item.startTy + shiftY}px)`;
            });

            updateOverlays();
            syncPanel();
            return;
        }

        // Move
        if (state.isDragging) {
            const dx = e.clientX - state.startPos.x;
            const dy = e.clientY - state.startPos.y;
            state.moveSnapshot.forEach(item => {
                item.el.style.transform = `translate(${item.startTx + dx}px, ${item.startTy + dy}px)`;
            });
            updateOverlays();
        }
    });

    document.addEventListener('mouseup', () => {
        state.isDragging = false;
        state.isResizing = false;
    });

    document.addEventListener('click', (e) => {
        if (root.contains(e.target) || overlaysContainer.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();

        if (state.mode === 'delete') {
            e.target.remove(); state.selection = []; updateOverlays(); setMode('select'); return;
        }

        if (e.shiftKey) {
            const idx = state.selection.indexOf(e.target);
            if (idx > -1) state.selection.splice(idx, 1);
            else state.selection.push(e.target);
        } else {
            state.selection = [e.target];
        }

        updateOverlays();
        syncPanel();

        if (state.mode === 'text' && state.selection.length === 1) {
            state.selection[0].contentEditable = 'true'; state.selection[0].focus();
        }
    }, true);

    document.addEventListener('dblclick', (e) => {
        if (state.selection.includes(e.target)) {
            setMode('move');
        }
    }, true);

    window.addEventListener('scroll', updateOverlays, true);
    window.addEventListener('resize', updateOverlays);

    // --- Wiring ---
    ['select', 'move', 'text', 'delete'].forEach(m => document.getElementById(`le-tool-${m}`).addEventListener('click', () => setMode(m)));

    function createEl(type) {
        let el;
        const x = window.scrollX + window.innerWidth / 3;
        const y = window.scrollY + window.innerHeight / 3;
        if (type === 'text') { el = document.createElement('h2'); el.textContent = 'Text'; el.style.fontSize = '24px'; }
        if (type === 'img') { el = document.createElement('img'); el.src = 'https://via.placeholder.com/200'; }
        if (type === 'btn') { el = document.createElement('button'); el.textContent = 'Button'; el.style.padding = '10px 20px'; el.style.background = '#007bff'; el.style.color = 'white'; }

        if (el) {
            el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.zIndex = '1000';
            document.body.appendChild(el);
            state.selection = [el]; setMode('move'); updateOverlays();
        }
    }
    document.getElementById('le-tool-add-text').addEventListener('click', () => createEl('text'));
    document.getElementById('le-tool-add-img').addEventListener('click', () => createEl('img'));
    document.getElementById('le-tool-add-btn').addEventListener('click', () => createEl('btn'));

    const apply = (p, v) => { state.selection.forEach(el => el.style[p] = v); updateOverlays(); };
    inputs.w.addEventListener('change', e => apply('width', e.target.value));
    inputs.h.addEventListener('change', e => apply('height', e.target.value));
    inputs.d.addEventListener('change', e => apply('display', e.target.value));
    inputs.bg.addEventListener('change', e => { apply('backgroundColor', e.target.value); inputs.bgP.style.background = e.target.value; });
    inputs.c.addEventListener('change', e => apply('color', e.target.value));
    inputs.s.addEventListener('change', e => apply('fontSize', e.target.value));
    document.getElementById('le-finish-btn').addEventListener('click', () => { root.remove(); overlaysContainer.remove(); state.selection.forEach(el => el.contentEditable = 'false'); });
    document.getElementById('le-close-panel').addEventListener('click', () => document.querySelector('.le-properties-panel').style.display = 'none');

})();
