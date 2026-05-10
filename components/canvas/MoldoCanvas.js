/**
 * MoldoCanvas — infinite canvas for placing and connecting MoldoNodes.
 *
 * Usage:
 *   const canvas = new MoldoCanvas({ container, registry, onNodeDblClick });
 *   // drop a block from the sidebar:
 *   canvas.dropBlock(blockEntry, canvasX, canvasY);
 *   // programmatic add:
 *   canvas.addNode({ id, moldName, blockId, block, x, y, params });
 *
 * Public API:
 *   canvas.el              — root DOM element (fill your layout container with this)
 *   canvas.addNode(cfg)    — add a MoldoNode and return it
 *   canvas.removeNode(id)  — remove a node and its edges
 *   canvas.getNode(id)     — return MoldoNode by id
 *   canvas.allNodes()      — array of all MoldoNodes
 *   canvas.allEdges()      — array of { from, to } id pairs
 *   canvas.clear()         — remove everything
 *   canvas.serialize()     — { nodes:[{id,moldName,blockId,params,x,y}], edges:[{from,to}] }
 *   canvas.deserialize(obj, registry) — restore from serialize() output
 *
 * Events dispatched on canvas.el:
 *   'moldo:canvas:select'   — detail: { node } | null for deselect
 *   'moldo:canvas:dblclick' — detail: { node }  (open settings panel)
 *   'moldo:canvas:change'   — graph changed (node added/removed/moved/edge added/removed)
 */
class MoldoCanvas {
  constructor({ container, registry, onNodeDblClick = () => {} }) {
    this._registry       = registry;
    this._onNodeDblClick = onNodeDblClick;
    this._nodes          = new Map();   /* id → MoldoNode */
    this._edges          = [];          /* [{ from, to, path }] */
    this._selected       = null;        /* MoldoNode | null */
    this._idCounter      = 0;

    /* drag state */
    this._drag = null;   /* { node, startX, startY, origX, origY } */

    /* edge-draw state */
    this._edgeDraw = null;  /* { fromNode, tempPath } */

    this.el = this._build(container);
    this._attachGlobalEvents();
  }

  // ─── Public API ──────────────────────────────────────────────

  addNode({ id, moldName, blockId, block, x = 100, y = 100, params = {} }) {
    const nodeId = id || `node-${++this._idCounter}`;
    const node   = new MoldoNode({ id: nodeId, moldName, blockId, block, x, y, params });

    this._nodes.set(nodeId, node);
    this._nodesEl.appendChild(node.el);

    node.el.addEventListener('moldo:node:mousedown', (e) => this._onNodeMouseDown(e));
    node.el.addEventListener('moldo:node:dblclick',  (e) => this._onNodeDblClick(e));
    node.el.addEventListener('moldo:node:connect',   (e) => this._onConnectStart(e));

    this._dispatch('moldo:canvas:change');
    return node;
  }

  dropBlock(blockEntry, canvasX, canvasY) {
    return this.addNode({
      moldName: blockEntry.moldName,
      blockId:  blockEntry.id,
      block:    blockEntry,
      x:        canvasX,
      y:        canvasY,
    });
  }

  removeNode(id) {
    const node = this._nodes.get(id);
    if (!node) return;

    /* remove all edges connected to this node */
    this._edges = this._edges.filter(e => {
      if (e.from === id || e.to === id) { e.path.remove(); return false; }
      return true;
    });

    node.destroy();
    this._nodes.delete(id);
    if (this._selected?.id === id) this._selected = null;
    this._dispatch('moldo:canvas:change');
  }

  getNode(id)   { return this._nodes.get(id); }
  allNodes()    { return Array.from(this._nodes.values()); }
  allEdges()    { return this._edges.map(e => ({ from: e.from, to: e.to })); }

  clear() {
    for (const id of [...this._nodes.keys()]) this.removeNode(id);
  }

  serialize() {
    return {
      nodes: this.allNodes().map(n => ({
        id:       n.id,
        moldName: n.moldName,
        blockId:  n.blockId,
        params:   n.getParams(),
        x:        n._x,
        y:        n._y,
      })),
      edges: this.allEdges(),
    };
  }

  deserialize(data, registry) {
    this.clear();
    for (const nd of (data.nodes || [])) {
      const block = registry.getBlock(nd.moldName, nd.blockId);
      if (!block) { console.warn(`MoldoCanvas: unknown block ${nd.moldName}.${nd.blockId}`); continue; }
      this.addNode({ id: nd.id, moldName: nd.moldName, blockId: nd.blockId, block, x: nd.x, y: nd.y, params: nd.params });
    }
    for (const edge of (data.edges || [])) {
      this._addEdge(edge.from, edge.to);
    }
  }

  // ─── Build ───────────────────────────────────────────────────

  _build() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative; width:100%; height:100%; overflow:hidden; background:#fafaf9; cursor:default;';

    /* grid background via CSS */
    wrap.style.backgroundImage = 'radial-gradient(circle, #d4d4d4 1px, transparent 1px)';
    wrap.style.backgroundSize  = '24px 24px';

    /* SVG layer for edges — sits behind nodes */
    this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgEl.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible;';
    wrap.appendChild(this._svgEl);

    /* div layer for nodes */
    this._nodesEl = document.createElement('div');
    this._nodesEl.style.cssText = 'position:absolute; inset:0; pointer-events:none;';
    wrap.appendChild(this._nodesEl);

    /* drag-drop from sidebar */
    wrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    wrap.addEventListener('drop',     (e) => this._onDrop(e));

    /* click on canvas background to deselect */
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap || e.target === this._nodesEl || e.target === this._svgEl) {
        this._deselect();
      }
    });

    return wrap;
  }

  // ─── Events ──────────────────────────────────────────────────

  _attachGlobalEvents() {
    document.addEventListener('mousemove', (e) => {
      if (this._drag)     this._onDragMove(e);
      if (this._edgeDraw) this._onEdgeDrawMove(e);
    });
    document.addEventListener('mouseup', (e) => {
      if (this._drag)     this._onDragEnd(e);
      if (this._edgeDraw) this._onEdgeDrawEnd(e);
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._selected) {
        this.removeNode(this._selected.id);
      }
    });
  }

  _onDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/moldo-block');
    if (!raw) return;

    const { key } = JSON.parse(raw);
    const [moldName, blockId] = key.split('.');
    const block = this._registry.getBlock(moldName, blockId);
    if (!block) return;

    const rect  = this.el.getBoundingClientRect();
    const x     = e.clientX - rect.left - 110;   /* centre the node under cursor */
    const y     = e.clientY - rect.top  - 43;
    const node  = this.dropBlock(block, Math.max(0, x), Math.max(0, y));
    this._select(node);
  }

  _onNodeMouseDown(e) {
    const { node, originalEvent: oe } = e.detail;
    oe.stopPropagation();

    this._select(node);
    /* allow pointer events on the moving node */
    this._nodesEl.style.pointerEvents = 'auto';

    const rect = this.el.getBoundingClientRect();
    this._drag = {
      node,
      startX: oe.clientX,
      startY: oe.clientY,
      origX:  node._x,
      origY:  node._y,
    };
    node.el.style.cursor = 'grabbing';
  }

  _onDragMove(e) {
    const { node, startX, startY, origX, origY } = this._drag;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    node.moveTo(origX + dx, origY + dy);
    this._redrawEdgesFor(node.id);
  }

  _onDragEnd() {
    if (!this._drag) return;
    this._drag.node.el.style.cursor = 'grab';
    this._nodesEl.style.pointerEvents = 'none';
    this._drag = null;
    this._dispatch('moldo:canvas:change');
  }

  _onNodeDblClick(e) {
    const { node } = e.detail;
    this._dispatch('moldo:canvas:dblclick', { node });
    this._onNodeDblClick({ node });
  }

  _onConnectStart(e) {
    const { node, originalEvent: oe } = e.detail;

    /* allow pointer tracking outside the element */
    this._nodesEl.style.pointerEvents = 'auto';

    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('fill', 'none');
    tempPath.setAttribute('stroke', '#2563eb');
    tempPath.setAttribute('stroke-width', '1.5');
    tempPath.setAttribute('stroke-dasharray', '5 3');
    this._svgEl.appendChild(tempPath);

    this._edgeDraw = { fromNode: node, tempPath };
    oe.stopPropagation();
  }

  _onEdgeDrawMove(e) {
    const { fromNode, tempPath } = this._edgeDraw;
    const rect = this.el.getBoundingClientRect();
    const port = fromNode.rightPort();
    const tx   = e.clientX - rect.left;
    const ty   = e.clientY - rect.top;
    tempPath.setAttribute('d', this._bezier(port.x, port.y, tx, ty));
  }

  _onEdgeDrawEnd(e) {
    const { fromNode, tempPath } = this._edgeDraw;
    tempPath.remove();
    this._edgeDraw = null;
    this._nodesEl.style.pointerEvents = 'none';

    /* find if cursor is over another node */
    const rect   = this.el.getBoundingClientRect();
    const target = this._nodeAtPoint(e.clientX - rect.left, e.clientY - rect.top);

    if (target && target.id !== fromNode.id) {
      /* avoid duplicate edges */
      const exists = this._edges.some(ed => ed.from === fromNode.id && ed.to === target.id);
      if (!exists) {
        this._addEdge(fromNode.id, target.id);
        this._dispatch('moldo:canvas:change');
      }
    }
  }

  // ─── Selection ───────────────────────────────────────────────

  _select(node) {
    if (this._selected && this._selected.id !== node.id) this._selected.deselect();
    this._selected = node;
    node.select();
    this._dispatch('moldo:canvas:select', { node });
  }

  _deselect() {
    if (this._selected) { this._selected.deselect(); this._selected = null; }
    this._dispatch('moldo:canvas:select', { node: null });
  }

  // ─── Edges ───────────────────────────────────────────────────

  _addEdge(fromId, toId) {
    const fromNode = this._nodes.get(fromId);
    const toNode   = this._nodes.get(toId);
    if (!fromNode || !toNode) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#9a9a9a');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    this._svgEl.appendChild(path);

    const edge = { from: fromId, to: toId, path };
    this._edges.push(edge);
    this._redrawEdge(edge);
    this._ensureArrowMarker();
  }

  _redrawEdge(edge) {
    const fromNode = this._nodes.get(edge.from);
    const toNode   = this._nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const p1 = fromNode.rightPort();
    const p2 = toNode.leftPort();
    edge.path.setAttribute('d', this._bezier(p1.x, p1.y, p2.x, p2.y));
  }

  _redrawEdgesFor(nodeId) {
    for (const edge of this._edges) {
      if (edge.from === nodeId || edge.to === nodeId) this._redrawEdge(edge);
    }
  }

  _bezier(x1, y1, x2, y2) {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
  }

  _ensureArrowMarker() {
    if (this._svgEl.querySelector('#arrowhead')) return;
    const defs   = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6');
    poly.setAttribute('fill', '#9a9a9a');
    marker.appendChild(poly);
    defs.appendChild(marker);
    this._svgEl.insertBefore(defs, this._svgEl.firstChild);
  }

  // ─── Hit testing ─────────────────────────────────────────────

  _nodeAtPoint(x, y) {
    for (const node of this._nodes.values()) {
      if (x >= node._x && x <= node._x + node._w &&
          y >= node._y && y <= node._y + node._h) return node;
    }
    return null;
  }

  // ─── Utilities ───────────────────────────────────────────────

  _dispatch(type, detail = {}) {
    this.el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoCanvas;
} else {
  window.MoldoCanvas = MoldoCanvas;
}
