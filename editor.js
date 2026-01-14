/* Editor Logic - Complete + Add Elements */
(function () {
    if (document.getElementById('live-editor-root')) {
        alert('Live Editor is already active!');
        return;
    }

    // --- State ---
    const state = {
        selected: null,
        mode: 'select',
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        startPos: { x: 0, y: 0 },
        startRect: { w: 0, h: 0, x: 0, y: 0 },
        elementTransform: { x: 0, y: 0 }
    };

    // --- UI Construction ---
    const root = document.createElement('div');
    root.id = 'live-editor-root';
    root.innerHTML = `
    <div class="le-toolbar-top">
        <div class="le-brand"><i class="fa-solid fa-layer-group"></i> LiveEditor</div>
        <div class="le-actions">
            <button class="le-btn active" id="le-tool-select" title="Select"><i class="fa-solid fa-arrow-pointer"></i></button>
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

    const overlay = document.createElement('div');
    overlay.className = 'le-editor-overlay';
    overlay.style.position = 'fixed';
    document.body.appendChild(overlay);

    const inputs = {
        w: document.getElementById('le-prop-width'),
        h: document.getElementById('le-prop-height'),
        d: document.getElementById('le-prop-display'),
        bg: document.getElementById('le-prop-bg'),
        bgP: document.getElementById('le-preview-bg'),
        c: document.getElementById('le-prop-color-text'),
        s: document.getElementById('le-prop-size')
    };

    // --- Helpers ---
    function updateOverlay() {
        if (!state.selected) { overlay.style.display = 'none'; return; }
        const r = state.selected.getBoundingClientRect();
        overlay.style.display = 'block';
        overlay.style.top = r.top + 'px';
        overlay.style.left = r.left + 'px';
        overlay.style.width = r.width + 'px';
        overlay.style.height = r.height + 'px';

        if (!overlay.querySelector('.le-badge')) {
            overlay.innerHTML = `<div class="le-resize-handle le-handle-tl" data-dir="tl"></div>
                                 <div class="le-resize-handle le-handle-tr" data-dir="tr"></div>
                                 <div class="le-resize-handle le-handle-bl" data-dir="bl"></div>
                                 <div class="le-resize-handle le-handle-br" data-dir="br"></div>
                                 <div class="le-badge"></div>`;
        }
        overlay.querySelector('.le-badge').textContent = state.selected.tagName.toLowerCase();
    }

    function syncPanel() {
        if (!state.selected) return;
        const s = window.getComputedStyle(state.selected);
        inputs.w.value = state.selected.style.width || s.width;
        inputs.h.value = state.selected.style.height || s.height;
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
        if (state.selected && m !== 'text') state.selected.contentEditable = 'false';
    }

    function getTranslate(el) {
        const style = window.getComputedStyle(el);
        const mat = new WebKitCSSMatrix(style.transform);
        return { x: mat.m41, y: mat.m42 };
    }

    // --- Events ---
    document.addEventListener('dragstart', (e) => e.preventDefault(), true);

    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('le-resize-handle')) {
            e.preventDefault(); e.stopPropagation();
            state.isResizing = true;
            state.resizeHandle = e.target.dataset.dir;
            state.startPos = { x: e.clientX, y: e.clientY };
            const r = state.selected.getBoundingClientRect();
            state.startRect = { w: r.width, h: r.height, x: r.left, y: r.top };
            return;
        }

        if (root.contains(e.target) || overlay.contains(e.target)) return;

        if (state.mode === 'move' && state.selected && e.target === state.selected) {
            e.preventDefault();
            state.isDragging = true;
            state.startPos = { x: e.clientX, y: e.clientY };
            state.elementTransform = getTranslate(state.selected);
        }
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (state.isResizing && state.selected) {
            const dx = e.clientX - state.startPos.x;
            const dy = e.clientY - state.startPos.y;
            if (state.resizeHandle.includes('r')) state.selected.style.width = (state.startRect.w + dx) + 'px';
            if (state.resizeHandle.includes('b')) state.selected.style.height = (state.startRect.h + dy) + 'px';
            if (state.resizeHandle.includes('l')) state.selected.style.width = (state.startRect.w - dx) + 'px';
            updateOverlay(); syncPanel();
            return;
        }

        if (state.isDragging && state.selected) {
            const dx = e.clientX - state.startPos.x;
            const dy = e.clientY - state.startPos.y;
            state.selected.style.transform = `translate(${state.elementTransform.x + dx}px, ${state.elementTransform.y + dy}px)`;
            updateOverlay();
        }
    });

    document.addEventListener('mouseup', () => {
        state.isDragging = false;
        state.isResizing = false;
    });

    window.addEventListener('scroll', updateOverlay, true);

    document.addEventListener('click', (e) => {
        if (root.contains(e.target) || overlay.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();

        if (state.mode === 'delete') {
            e.target.remove(); overlay.style.display = 'none'; state.selected = null; setMode('select'); return;
        }

        state.selected = e.target;
        updateOverlay(); syncPanel();

        if (state.mode === 'text') {
            state.selected.contentEditable = 'true'; state.selected.focus();
        }
    }, true);

    document.addEventListener('dblclick', (e) => {
        if (root.contains(e.target) || overlay.contains(e.target)) return;
        if (state.selected && e.target === state.selected) {
            e.preventDefault(); e.stopPropagation();
            setMode('move');
        }
    }, true);

    window.addEventListener('resize', updateOverlay);

    // --- Actions ---
    function createElement(type) {
        let el;
        const x = window.scrollX + window.innerWidth / 3;
        const y = window.scrollY + window.innerHeight / 3;

        if (type === 'text') {
            el = document.createElement('h2');
            el.textContent = 'New Text Layer';
            el.style.color = '#333';
            el.style.fontSize = '24px';
        } else if (type === 'img') {
            el = document.createElement('img');
            el.src = 'https://via.placeholder.com/300x200?text=New+Image';
            el.style.width = '300px';
        } else if (type === 'btn') {
            el = document.createElement('button');
            el.textContent = 'Click Me';
            el.style.padding = '10px 20px';
            el.style.background = '#007bff';
            el.style.color = 'white';
            el.style.border = 'none';
            el.style.borderRadius = '4px';
        }

        if (el) {
            el.style.position = 'absolute';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.zIndex = 1000;
            document.body.appendChild(el);

            // Auto-select
            state.selected = el;
            updateOverlay();
            syncPanel();
            setMode('move');
        }
    }

    // --- Wiring ---
    ['select', 'move', 'text', 'delete'].forEach(m => document.getElementById(`le-tool-${m}`).addEventListener('click', () => setMode(m)));

    document.getElementById('le-tool-add-text').addEventListener('click', () => createElement('text'));
    document.getElementById('le-tool-add-img').addEventListener('click', () => createElement('img'));
    document.getElementById('le-tool-add-btn').addEventListener('click', () => createElement('btn'));

    const apply = (p, v) => { if (state.selected) { state.selected.style[p] = v; updateOverlay(); } };
    inputs.w.addEventListener('change', e => apply('width', e.target.value));
    inputs.h.addEventListener('change', e => apply('height', e.target.value));
    inputs.d.addEventListener('change', e => apply('display', e.target.value));
    inputs.bg.addEventListener('change', e => { apply('backgroundColor', e.target.value); inputs.bgP.style.background = e.target.value; });
    inputs.c.addEventListener('change', e => apply('color', e.target.value));
    inputs.s.addEventListener('change', e => apply('fontSize', e.target.value));

    document.getElementById('le-finish-btn').addEventListener('click', () => { root.remove(); overlay.remove(); if (state.selected) state.selected.contentEditable = 'false'; });
    document.getElementById('le-close-panel').addEventListener('click', () => document.querySelector('.le-properties-panel').style.display = 'none');

})();
