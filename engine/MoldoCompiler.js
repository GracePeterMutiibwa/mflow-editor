/**
 * MoldoCompiler - takes a MoldoCanvas serialized state and produces the JSON
 * program payload ready to POST to the backend.
 *
 * Usage:
 *   const compiler = new MoldoCompiler({ registry });
 *   const { ok, payload, errors } = compiler.compile(canvasData);
 *   if (ok) await executor.run(payload);
 *
 * compile() returns:
 *   { ok: true,  payload: { version, molds, program } }  on success
 *   { ok: false, errors: string[] }                       on validation failure
 */
class MoldoCompiler {
  constructor({ registry }) {
    this._registry = registry;
  }

  compile(canvasData) {
    const graph = MoldoGraph.fromCanvas(canvasData);

    /* validate before attempting to build the tree */
    const { ok, errors } = graph.validate();
    if (!ok) return { ok: false, errors };

    try {
      const payload = graph.toProgram();
      return { ok: true, payload };
    } catch (err) {
      return { ok: false, errors: [err.message] };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoCompiler;
} else {
  window.MoldoCompiler = MoldoCompiler;
}
