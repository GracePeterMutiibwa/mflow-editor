/**
 * MoldoExecutor - sends a compiled program to the moldo backend and streams
 * back results, highlights, and input prompts.
 *
 * Usage:
 *   const executor = new MoldoExecutor({ baseUrl: 'http://127.0.0.1:8000' });
 *
 *   executor.onPrint   = (text)           => output.print(text);
 *   executor.onError   = (text)           => output.error(text);
 *   executor.onHighlight = (nodeId)       => canvas.getNode(nodeId)?.setRunning(true);
 *   executor.onDone    = ()               => output.setRunning(false);
 *   executor.onInput   = (prompt, type)   => showInputModal(prompt, type);
 *
 *   await executor.run(payload);    // payload from MoldoCompiler.compile()
 *   executor.stop();                // abort a running program
 *
 * The backend is expected to respond to POST /run with a JSON body.
 * For input prompts, the executor opens a modal and resolves the backend's
 * "waiting for input" polling via POST /run/input.
 */
class MoldoExecutor {
  constructor({ baseUrl = 'http://127.0.0.1:8000' } = {}) {
    this._base     = baseUrl.replace(/\/$/, '');
    this._abortCtl = null;   /* AbortController for the current run */

    /* callbacks - assign before calling run() */
    this.onPrint     = () => {};
    this.onError     = () => {};
    this.onHighlight = () => {};
    this.onDone      = () => {};
    /* onInput(promptText, type) must return a Promise<string> */
    this.onInput     = (prompt, type) => Promise.resolve(
      window.prompt(`[${type}] ${prompt}`) ?? ''
    );
  }

  // ─── Public API ──────────────────────────────────────────────

  get isRunning() { return this._abortCtl !== null; }

  async run(payload) {
    if (this.isRunning) return;

    this._abortCtl = new AbortController();
    const { signal } = this._abortCtl;

    try {
      const res = await fetch(`${this._base}/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this.onError(body.detail || `Backend error ${res.status}`);
        return;
      }

      const result = await res.json();
      this._handleResult(result);
    } catch (err) {
      if (err.name !== 'AbortError') this.onError(String(err));
    } finally {
      this._abortCtl = null;
      this.onDone();
    }
  }

  stop() {
    if (this._abortCtl) {
      this._abortCtl.abort();
      this._abortCtl = null;
    }
  }

  async checkHealth() {
    try {
      const res  = await fetch(`${this._base}/health`, { method: 'GET' });
      const body = await res.json();
      return body.status === 'OK';
    } catch {
      return false;
    }
  }

  // ─── Mold management API calls ───────────────────────────────

  /**
   * Upload a .zip.mold file to the backend for installation.
   * Returns { ok, manifest } on success or { ok: false, error } on failure.
   */
  async installMold(file) {
    const form = new FormData();
    form.append('file', file);

    try {
      const res  = await fetch(`${this._base}/molds/install`, { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: body.detail || `Error ${res.status}` };
      return { ok: true, manifest: body.manifest };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Fetch the list of installed molds from the backend.
   * Returns an array of manifest objects, or [] on failure.
   */
  async fetchInstalledMolds() {
    try {
      const res  = await fetch(`${this._base}/molds`);
      const body = await res.json();
      return body.molds || [];
    } catch {
      return [];
    }
  }

  /**
   * Uninstall a mold by name.
   * Returns { ok, error? }.
   */
  async uninstallMold(moldName) {
    try {
      const res  = await fetch(`${this._base}/molds/${encodeURIComponent(moldName)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: body.detail || `Error ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // ─── Result handling ─────────────────────────────────────────

  /**
   * The backend returns:
   * {
   *   stdout:   ["line1", "line2", ...],
   *   errors:   ["error msg", ...],
   *   highlights: ["nodeId", ...]   (order of execution)
   * }
   */
  _handleResult(result) {
    for (const nodeId of (result.highlights || [])) {
      this.onHighlight(nodeId);
    }
    for (const line of (result.stdout || [])) {
      this.onPrint(line);
    }
    for (const err of (result.errors || [])) {
      this.onError(err);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoExecutor;
} else {
  window.MoldoExecutor = MoldoExecutor;
}
