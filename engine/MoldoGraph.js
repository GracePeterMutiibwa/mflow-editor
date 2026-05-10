/**
 * MoldoGraph - converts a MoldoCanvas serialized state into the JSON program
 * tree that the backend understands, and back again.
 *
 * The graph is a simple directed graph: nodes connected by edges.
 * One node is the "start" (no incoming edges). The graph is walked from there.
 *
 * Public API:
 *   MoldoGraph.fromCanvas(canvasData)  → MoldoGraph instance
 *   graph.toProgram()                  → JSON protocol object (sent to backend)
 *   graph.validate()                   → { ok: bool, errors: string[] }
 */
class MoldoGraph {
  /**
   * Build a graph from MoldoCanvas.serialize() output.
   * canvasData: { nodes: [...], edges: [...] }
   */
  static fromCanvas(canvasData) {
    const g = new MoldoGraph();
    g._nodes = new Map(canvasData.nodes.map(n => [n.id, n]));
    g._edges = canvasData.edges || [];
    return g;
  }

  constructor() {
    this._nodes = new Map();
    this._edges = [];
  }

  // ─── Validation ──────────────────────────────────────────────

  validate() {
    const errors = [];

    if (this._nodes.size === 0) {
      errors.push('The canvas is empty - add at least one block.');
      return { ok: false, errors };
    }

    const starts = this._findStartNodes();
    if (starts.length === 0) errors.push('No start node found. Every node has an incoming edge - there is a cycle with no entry point.');
    if (starts.length >  1) errors.push(`Multiple start nodes found (${starts.map(n => n.id).join(', ')}). Connect them into a single flow.`);

    /* check that all decision (branch) nodes have at least one outgoing edge */
    for (const node of this._nodes.values()) {
      if (node.blockId === 'branch' || node.block?.hasBranches) {
        const outs = this._outgoingEdges(node.id);
        if (outs.length < 1) errors.push(`"${node.id}" is a branch node but has no outgoing edges.`);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  // ─── Program tree builder ─────────────────────────────────────

  /**
   * Convert the graph to the JSON protocol expected by the moldo backend.
   * Returns:
   * {
   *   version: "1.0",
   *   molds:   ["variables", "io", ...],
   *   program: { id, mold, block, params, next | branches | body, ... }
   * }
   */
  toProgram() {
    const starts = this._findStartNodes();
    if (starts.length !== 1) throw new Error('Graph must have exactly one start node to compile.');

    const usedMolds = new Set(
      Array.from(this._nodes.values()).map(n => n.moldName)
    );

    return {
      version: '1.0',
      molds:   Array.from(usedMolds),
      program: this._buildNode(starts[0].id, new Set()),
    };
  }

  // ─── Internal graph walk ─────────────────────────────────────

  _buildNode(nodeId, visited) {
    if (!nodeId || visited.has(nodeId)) return null;
    visited.add(nodeId);

    const raw  = this._nodes.get(nodeId);
    if (!raw) return null;

    const block = raw.block || {};
    const entry = {
      id:     raw.id,
      mold:   raw.moldName,
      block:  raw.blockId,
      params: raw.params || {},
    };

    const outEdges = this._outgoingEdges(nodeId);

    if (block.hasBranches) {
      /* decision / branch node: edges labelled "true"/"false" or first two */
      const trueEdge  = outEdges.find(e => e.label === 'true')  || outEdges[0];
      const falseEdge = outEdges.find(e => e.label === 'false') || outEdges[1];

      entry.branches = {
        true:  trueEdge  ? this._buildNode(trueEdge.to,  new Set(visited)) : null,
        false: falseEdge ? this._buildNode(falseEdge.to, new Set(visited)) : null,
      };
    } else if (block.hasBody) {
      /* loop / function-define node: first edge = body, second edge = after loop */
      const bodyEdge = outEdges[0];
      const nextEdge = outEdges[1];
      entry.body = bodyEdge ? this._buildNode(bodyEdge.to, new Set(visited)) : null;
      entry.next = nextEdge ? this._buildNode(nextEdge.to, new Set(visited)) : null;
    } else {
      /* linear node: single outgoing edge */
      const nextEdge = outEdges[0];
      entry.next = nextEdge ? this._buildNode(nextEdge.to, new Set(visited)) : null;
    }

    return entry;
  }

  _findStartNodes() {
    const hasIncoming = new Set(this._edges.map(e => e.to));
    return Array.from(this._nodes.values()).filter(n => !hasIncoming.has(n.id));
  }

  _outgoingEdges(nodeId) {
    return this._edges.filter(e => e.from === nodeId);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoGraph;
} else {
  window.MoldoGraph = MoldoGraph;
}
