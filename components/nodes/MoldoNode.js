/**
 * MoldoNode — a single visual node on the canvas.
 *
 * Usage:
 *   const node = new MoldoNode({
 *     id:        'node-1',          // unique string id
 *     moldName:  'math',
 *     blockId:   'sqrt',
 *     block:     blockManifestEntry, // from MoldoRegistry.getBlock()
 *     x: 200, y: 150,              // canvas position
 *     params:    {},               // initial field values
 *   });
 *   canvasEl.appendChild(node.el);
 *
 * Public API:
 *   node.el              — the root DOM element
 *   node.id              — string id
 *   node.getParams()     — current field values { fieldId: value, ... }
 *   node.setParams(obj)  — update subtitle display (does not open panel)
 *   node.moveTo(x, y)    — reposition
 *   node.select()        — apply selected ring
 *   node.deselect()
 *   node.setRunning(bool)
 *   node.setDone(bool)
 *   node.destroy()       — remove element and clean up
 *
 * Events dispatched on node.el:
 *   'moldo:node:mousedown'   — drag start / selection, detail: { node, originalEvent }
 *   'moldo:node:dblclick'    — open settings panel, detail: { node }
 *   'moldo:node:connect'     — user grabbed the connect handle, detail: { node }
 *   'moldo:node:delete'      — delete key pressed while selected, detail: { node }
 */

const NODE_COLORS = {
  blue:    { dot: '#2563eb', soft: '#eff4ff' },
  violet:  { dot: '#7c3aed', soft: '#f3efff' },
  amber:   { dot: '#d97706', soft: '#fff5e6' },
  rose:    { dot: '#e11d48', soft: '#ffeef1' },
  emerald: { dot: '#059669', soft: '#e8f8f1' },
  slate:   { dot: '#475569', soft: '#eef1f5' },
};

const NODE_W  = 220;
const NODE_H  = 86;
const DIAMOND_W = 160;
const DIAMOND_H = 100;
const CIRCLE_D  = 88;

class MoldoNode {
  constructor({ id, moldName, blockId, block, x = 0, y = 0, params = {} }) {
    this.id       = id;
    this.moldName = moldName;
    this.blockId  = blockId;
    this.block    = block;        // full manifest entry
    this._params  = { ...params };
    this._x       = x;
    this._y       = y;
    this._selected  = false;
    this._running   = false;
    this._done      = false;

    this.el = this._build();
    this._attachEvents();
  }

  // ─── Public API ──────────────────────────────────────────────

  getParams() { return { ...this._params }; }

  setParams(newParams) {
    this._params = { ...this._params, ...newParams };
    this._updateSubtitle();
  }

  moveTo(x, y) {
    this._x = x;
    this._y = y;
    this.el.style.left = x + 'px';
    this.el.style.top  = y + 'px';
  }

  select() {
    this._selected = true;
    this._applyRing();
  }

  deselect() {
    this._selected = false;
    this._applyRing();
  }

  setRunning(on) {
    this._running = on;
    this._spinnerEl.style.display = on ? 'block' : 'none';
    if (on) this._spinnerEl.style.borderColor = '#2563eb';
  }

  setDone(on) {
    this._done = on;
    if (on) this._spinnerEl.style.borderColor = '#10b981';
    this._applyRing();
  }

  destroy() {
    this.el.remove();
  }

  // Returns the canvas-space centre of the right edge (for edge drawing)
  rightPort() {
    return { x: this._x + this._w, y: this._y + this._h / 2 };
  }

  // Returns the canvas-space centre of the left edge
  leftPort() {
    return { x: this._x, y: this._y + this._h / 2 };
  }

  // ─── Build DOM ───────────────────────────────────────────────

  _build() {
    const shape = this.block.nodeShape || 'rect';
    const color = NODE_COLORS[this.block.color] || NODE_COLORS.slate;

    /* dimensions depend on shape */
    switch (shape) {
      case 'circle':  this._w = CIRCLE_D;  this._h = CIRCLE_D;  break;
      case 'diamond': this._w = DIAMOND_W; this._h = DIAMOND_H; break;
      default:        this._w = NODE_W;    this._h = NODE_H;
    }

    const wrap = document.createElement('div');
    wrap.dataset.nodeId = this.id;
    wrap.style.cssText = `
      position: absolute;
      left: ${this._x}px;
      top:  ${this._y}px;
      width:  ${this._w}px;
      height: ${this._h}px;
      cursor: grab;
      user-select: none;
      pointer-events: auto;
      transition: box-shadow .14s ease;
    `;

    if (shape === 'rect')    this._buildRect(wrap, color);
    if (shape === 'circle')  this._buildCircle(wrap, color);
    if (shape === 'diamond') this._buildDiamond(wrap, color);

    /* running / done spinner ring — hidden by default */
    this._spinnerEl = document.createElement('div');
    this._spinnerEl.style.cssText = `
      display: none;
      position: absolute;
      inset: -4px;
      border-radius: ${shape === 'circle' ? '50%' : '6px'};
      border: 2px solid #2563eb;
      pointer-events: none;
      animation: moldoPulse 1.1s ease-out infinite;
    `;
    wrap.appendChild(this._spinnerEl);

    /* connect handle — appears on hover */
    this._connectEl = this._makeHandle('→', 'Drag to connect');
    wrap.appendChild(this._connectEl);

    this.el = wrap;
    this._applyRing();
    return wrap;
  }

  _buildRect(wrap, color) {
    wrap.style.background   = '#ffffff';
    wrap.style.border       = '1px solid #e6e6e6';
    wrap.style.borderRadius = '3px';
    wrap.style.boxShadow    = '0 1px 2px rgba(15,23,42,.04)';

    /* left accent bar */
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      background: ${color.dot}; border-radius: 3px 0 0 3px;
    `;
    wrap.appendChild(bar);

    /* header row: icon + title + type badge */
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; gap:8px; padding:10px 12px 4px 14px;';

    const iconBox = this._makeIconBox(color);
    const title = document.createElement('div');
    title.style.cssText = 'font-family:"IBM Plex Sans",system-ui,sans-serif; font-size:13px; font-weight:600; color:#1a1a1a; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    title.textContent = this.block.name;

    const badge = document.createElement('div');
    badge.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:.05em;';
    badge.textContent = this.block.nodeType;

    header.append(iconBox, title, badge);
    wrap.appendChild(header);

    /* subtitle — first param value preview */
    this._subtitleEl = document.createElement('div');
    this._subtitleEl.style.cssText = 'padding:0 12px 8px 14px; font-family:"JetBrains Mono",monospace; font-size:11px; color:#6b6b6b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    this._updateSubtitleEl();
    wrap.appendChild(this._subtitleEl);
  }

  _buildCircle(wrap, color) {
    wrap.style.borderRadius = '50%';
    wrap.style.background   = '#ffffff';
    wrap.style.border       = '1px solid #e6e6e6';
    wrap.style.boxShadow    = '0 1px 2px rgba(15,23,42,.04)';
    wrap.style.display      = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems   = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.textAlign    = 'center';

    const iconBox = this._makeIconBox(color);
    iconBox.style.marginBottom = '4px';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:"IBM Plex Sans",system-ui,sans-serif; font-size:11px; font-weight:600; color:#1a1a1a; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    title.textContent = this.block.name;

    this._subtitleEl = null; // circles have no subtitle
    wrap.append(iconBox, title);
  }

  _buildDiamond(wrap, color) {
    /* SVG for the diamond shape */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', this._w);
    svg.setAttribute('height', this._h);
    svg.setAttribute('viewBox', `0 0 ${this._w} ${this._h}`);
    svg.style.cssText = 'position:absolute; inset:0; overflow:visible;';

    this._diamondPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const hw = this._w / 2, hh = this._h / 2;
    this._diamondPoly.setAttribute('points', `${hw},2 ${this._w-2},${hh} ${hw},${this._h-2} 2,${hh}`);
    this._diamondPoly.setAttribute('fill', '#ffffff');
    this._diamondPoly.setAttribute('stroke', '#e6e6e6');
    this._diamondPoly.setAttribute('stroke-width', '1');
    svg.appendChild(this._diamondPoly);
    wrap.appendChild(svg);

    /* centred content overlay */
    const inner = document.createElement('div');
    inner.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 28px; text-align:center; pointer-events:none;';

    const iconBox = this._makeIconBox(color);
    iconBox.style.marginBottom = '3px';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:"IBM Plex Sans",system-ui,sans-serif; font-size:11.5px; font-weight:600; color:#1a1a1a; line-height:1.2;';
    title.textContent = this.block.name;

    const badge = document.createElement('div');
    badge.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:9.5px; color:#9a9a9a; text-transform:uppercase; margin-top:2px;';
    badge.textContent = this.block.nodeType;

    this._subtitleEl = null;
    inner.append(iconBox, title, badge);
    wrap.appendChild(inner);
  }

  _makeIconBox(color) {
    const box = document.createElement('span');
    box.style.cssText = `width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; background:${color.soft}; color:${color.dot}; border-radius:4px; flex-shrink:0; font-size:12px;`;
    box.textContent = MoldoNode._icons[this.block.icon] || '▸';
    return box;
  }

  _makeHandle(symbol, title) {
    const btn = document.createElement('button');
    btn.title = title;
    btn.textContent = symbol;
    btn.style.cssText = `
      display: none;
      position: absolute;
      right: -22px;
      top: 50%;
      transform: translateY(-50%);
      width: 22px; height: 22px;
      background: #ffffff;
      border: 1px solid #d4d4d4;
      border-radius: 4px;
      cursor: crosshair;
      font-size: 11px;
      color: #1a1a1a;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
      z-index: 5;
    `;
    return btn;
  }

  // ─── Events ──────────────────────────────────────────────────

  _attachEvents() {
    this.el.addEventListener('mouseenter', () => {
      this._connectEl.style.display = 'flex';
    });
    this.el.addEventListener('mouseleave', () => {
      this._connectEl.style.display = 'none';
    });

    this.el.addEventListener('mousedown', (e) => {
      if (e.target === this._connectEl) return;
      this._dispatch('moldo:node:mousedown', { node: this, originalEvent: e });
    });

    this.el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._dispatch('moldo:node:dblclick', { node: this });
    });

    this._connectEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._dispatch('moldo:node:connect', { node: this, originalEvent: e });
    });
  }

  _dispatch(type, detail) {
    this.el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }

  // ─── Visual state ─────────────────────────────────────────────

  _applyRing() {
    if (this._selected) {
      this.el.style.boxShadow = '0 0 0 2px #2563eb, 0 6px 16px rgba(37,99,235,.12)';
      if (this.block.nodeShape === 'diamond' && this._diamondPoly) {
        this._diamondPoly.setAttribute('stroke', '#2563eb');
        this._diamondPoly.setAttribute('stroke-width', '2');
      }
    } else if (this._done) {
      this.el.style.boxShadow = '0 0 0 2px #10b981, 0 6px 16px rgba(16,185,129,.12)';
    } else {
      this.el.style.boxShadow = '0 1px 2px rgba(15,23,42,.04)';
      if (this.block.nodeShape === 'diamond' && this._diamondPoly) {
        this._diamondPoly.setAttribute('stroke', '#e6e6e6');
        this._diamondPoly.setAttribute('stroke-width', '1');
      }
    }
  }

  _updateSubtitle() {
    if (this._subtitleEl) this._updateSubtitleEl();
  }

  _updateSubtitleEl() {
    if (!this._subtitleEl) return;
    /* show the first non-empty param value as a hint */
    const first = (this.block.inputs || []).find(inp => this._params[inp.id]);
    this._subtitleEl.textContent = first ? this._params[first.id] : this.block.description;
  }

  // ─── Icon map — unicode fallbacks; replace with SVG set if preferred ──

  static _icons = {
    hash:      '#',
    tag:       '⊏',
    calc:      '±',
    spark:     '✦',
    send:      '▶',
    prompt:    '?',
    branch:    '⑂',
    loop:      '↺',
    merge:     '⊕',
    split:     '⊗',
    sort:      'Aa',
    filter:    '▽',
    ruler:     '⌇',
    eye:       '◎',
    function:  'ƒ',
    play:      '▸',
    layers:    '▤',
    database:  '⊟',
    globe:     '⊕',
    link:      '⊞',
    clock:     '◷',
    check:     '✓',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoNode;
} else {
  window.MoldoNode = MoldoNode;
}
