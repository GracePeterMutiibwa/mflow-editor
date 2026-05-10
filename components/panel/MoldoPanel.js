/**
 * MoldoPanel — settings panel auto-generated from a block manifest.
 *
 * Usage:
 *   const panel = new MoldoPanel({ block, params, onSave, onClose });
 *   document.body.appendChild(panel.el);
 *   panel.open(node);   // position relative to a MoldoNode and show
 *   panel.close();
 *
 * Constructor options:
 *   block    — block manifest entry from MoldoRegistry
 *   params   — initial field values  { fieldId: value, ... }
 *   onSave   — function(params, node) called when user clicks Save
 *   onClose  — function() called when panel closes without saving
 *
 * The panel generates one input per entry in block.inputs[]:
 *   type "text"     → <input type="text">
 *   type "variable" → <input type="text"> with @ hint
 *   type "number"   → <input type="number">
 *   type "select"   → <select> with block.input.options[]
 *   type "checkbox" → <input type="checkbox">
 *
 * Outputs[] are shown read-only so the user knows what variable gets produced.
 */
class MoldoPanel {
  constructor({ block, params = {}, onSave = () => {}, onClose = () => {} }) {
    this.block   = block;
    this._params = { ...params };
    this._onSave  = onSave;
    this._onClose = onClose;
    this._node    = null;   // the MoldoNode this panel is currently editing

    this.el = this._build();
    this.el.style.display = 'none';
    this._trapEsc();
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Populate from a new block + params, then show positioned near targetNode.
   * Call this every time a node is double-clicked.
   */
  open(node, block, params) {
    this._node   = node;
    this.block   = block;
    this._params = { ...params };

    this._rebuild();
    this.el.style.display = 'flex';
    this._positionNear(node);

    /* focus the first input */
    const first = this.el.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  close() {
    this.el.style.display = 'none';
    this._node = null;
    this._onClose();
  }

  getValues() { return { ...this._params }; }

  // ─── Build shell ─────────────────────────────────────────────

  _build() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      width: 300px;
      max-height: 80vh;
      background: #ffffff;
      border: 1px solid #e6e6e6;
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.06);
      font-family: "IBM Plex Sans", system-ui, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      overflow: hidden;
    `;

    this._headerEl  = document.createElement('div');
    this._bodyEl    = document.createElement('div');
    this._footerEl  = this._buildFooter();

    this._headerEl.style.cssText = 'flex-shrink:0; padding:12px 14px 10px; border-bottom:1px solid #f0f0f0;';
    this._bodyEl.style.cssText   = 'flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:12px;';

    panel.append(this._headerEl, this._bodyEl, this._footerEl);
    return panel;
  }

  _buildFooter() {
    const footer = document.createElement('div');
    footer.style.cssText = 'flex-shrink:0; display:flex; gap:8px; padding:10px 14px; border-top:1px solid #f0f0f0; background:#fafaf9;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `
      flex:1; padding:7px 0; background:#2563eb; color:#fff;
      border:none; border-radius:4px; cursor:pointer;
      font-family:inherit; font-size:12px; font-weight:500;
    `;
    saveBtn.addEventListener('click', () => {
      this._onSave(this._params, this._node);
      this.close();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding:7px 12px; background:transparent; color:#6b6b6b;
      border:1px solid #e6e6e6; border-radius:4px; cursor:pointer;
      font-family:inherit; font-size:12px;
    `;
    cancelBtn.addEventListener('click', () => this.close());

    footer.append(saveBtn, cancelBtn);
    return footer;
  }

  // ─── Rebuild contents for the current block ───────────────────

  _rebuild() {
    /* header */
    this._headerEl.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600; font-size:13px; color:#1a1a1a;';
    title.textContent = this.block.name;

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:11px; color:#9a9a9a; margin-top:2px; font-family:"JetBrains Mono",monospace;';
    desc.textContent = this.block.moldDisplayName + ' · ' + (this.block.description || '');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = `
      position:absolute; top:10px; right:10px;
      background:transparent; border:none; font-size:18px; line-height:1;
      color:#9a9a9a; cursor:pointer; padding:0 4px;
    `;
    closeBtn.addEventListener('click', () => this.close());

    /* make header position:relative so × can be absolute */
    this._headerEl.style.position = 'relative';
    this._headerEl.append(title, desc, closeBtn);

    /* body */
    this._bodyEl.innerHTML = '';

    for (const input of (this.block.inputs || [])) {
      this._bodyEl.appendChild(this._buildField(input));
    }

    if ((this.block.outputs || []).length) {
      this._bodyEl.appendChild(this._buildOutputSection());
    }
  }

  _buildField(input) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; flex-direction:column; gap:4px;';

    const label = document.createElement('label');
    label.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:.08em;';
    label.textContent = input.label;

    let control;

    switch (input.type) {
      case 'select':
        control = document.createElement('select');
        control.style.cssText = this._inputStyle();
        for (const opt of (input.options || [])) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          if (this._params[input.id] === opt) o.selected = true;
          control.appendChild(o);
        }
        /* set default if no saved param */
        if (!this._params[input.id] && input.options?.length) {
          this._params[input.id] = input.options[0];
        }
        control.addEventListener('change', () => { this._params[input.id] = control.value; });
        break;

      case 'checkbox':
        control = document.createElement('input');
        control.type    = 'checkbox';
        control.checked = Boolean(this._params[input.id]);
        control.addEventListener('change', () => { this._params[input.id] = control.checked; });
        break;

      case 'number':
        control = document.createElement('input');
        control.type        = 'number';
        control.value       = this._params[input.id] ?? '';
        control.placeholder = input.placeholder || '';
        control.style.cssText = this._inputStyle();
        control.addEventListener('input', () => { this._params[input.id] = control.value; });
        break;

      case 'variable':
        /* same as text but placeholder shows @ convention */
        control = document.createElement('input');
        control.type        = 'text';
        control.value       = this._params[input.id] ?? '';
        control.placeholder = input.placeholder || '@variableName';
        control.style.cssText = this._inputStyle('monospace');
        control.addEventListener('input', () => { this._params[input.id] = control.value; });
        break;

      default: /* text */
        control = document.createElement('input');
        control.type        = 'text';
        control.value       = this._params[input.id] ?? '';
        control.placeholder = input.placeholder || '';
        control.style.cssText = this._inputStyle();
        control.addEventListener('input', () => { this._params[input.id] = control.value; });
        break;
    }

    row.append(label, control);
    return row;
  }

  _buildOutputSection() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border-top:1px solid #f0f0f0; padding-top:12px; display:flex; flex-direction:column; gap:6px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:.08em;';
    heading.textContent = 'Produces';
    wrap.appendChild(heading);

    for (const out of this.block.outputs) {
      const tag = document.createElement('div');
      tag.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-family:"JetBrains Mono",monospace; font-size:11px; color:#059669;';
      tag.innerHTML = `<span style="font-size:9px;">▶</span> ${out.label}: <strong>@${this._params[out.id] || out.id}</strong>`;
      wrap.appendChild(tag);
    }

    return wrap;
  }

  _inputStyle(fontHint) {
    const mono = fontHint === 'monospace'
      ? 'font-family:"JetBrains Mono",monospace;'
      : 'font-family:"IBM Plex Sans",system-ui,sans-serif;';
    return `
      background:#fafaf9; border:1px solid #e6e6e6; border-radius:4px;
      padding:6px 8px; font-size:12px; color:#1a1a1a; outline:none;
      width:100%; box-sizing:border-box; ${mono}
    `;
  }

  // ─── Positioning ─────────────────────────────────────────────

  _positionNear(node) {
    if (!node) return;
    const rect = node.el.getBoundingClientRect();
    let left = rect.right + 12;
    let top  = rect.top;

    /* keep inside viewport */
    const panelW = 300, panelH = 400;
    if (left + panelW > window.innerWidth)  left = rect.left - panelW - 12;
    if (top  + panelH > window.innerHeight) top  = window.innerHeight - panelH - 16;

    this.el.style.left = Math.max(8, left) + 'px';
    this.el.style.top  = Math.max(8, top)  + 'px';
  }

  // ─── Keyboard ────────────────────────────────────────────────

  _trapEsc() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el.style.display !== 'none') this.close();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoPanel;
} else {
  window.MoldoPanel = MoldoPanel;
}
