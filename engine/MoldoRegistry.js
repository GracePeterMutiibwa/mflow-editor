/**
 * MoldoRegistry - loads mold manifests and answers queries about blocks.
 *
 * Usage:
 *   const registry = new MoldoRegistry();
 *   await registry.loadAll(['molds/variables.mold.json', ...]);
 *   const block  = registry.getBlock('math', 'sqrt');
 *   const mold   = registry.getMold('math');
 *   const all    = registry.allBlocks();   // flat list, each entry has .moldName
 */
class MoldoRegistry {
  constructor() {
    /* moldName → full manifest object */
    this._molds = new Map();

    /* "moldName.blockId" → block manifest entry (with moldName + moldDisplayName attached) */
    this._blocks = new Map();

    /* listeners called whenever the registry changes */
    this._changeListeners = [];
  }

  // ─── Loading ────────────────────────────────────────────────

  /**
   * Fetch and register one manifest from a URL or path.
   * Returns the loaded manifest object.
   */
  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MoldoRegistry: failed to fetch ${url} (${res.status})`);
    const manifest = await res.json();
    this._register(manifest);
    return manifest;
  }

  /**
   * Convenience: load an array of manifest URLs in parallel.
   * Returns an array of loaded manifests.
   */
  async loadAll(urls) {
    const results = await Promise.all(urls.map(u => this.load(u)));
    this._notify();
    return results;
  }

  /**
   * Register a manifest object directly (used by the mold-install flow when
   * the backend sends back a parsed manifest without a URL).
   */
  register(manifest) {
    this._register(manifest);
    this._notify();
  }

  /**
   * Remove an installed mold by name and fire change listeners.
   */
  unregister(moldName) {
    const mold = this._molds.get(moldName);
    if (!mold) return;

    this._molds.delete(moldName);
    for (const block of mold.blocks) {
      this._blocks.delete(`${moldName}.${block.id}`);
    }
    this._notify();
  }

  // ─── Queries ─────────────────────────────────────────────────

  /**
   * Return the full manifest for a mold, or undefined.
   */
  getMold(moldName) {
    return this._molds.get(moldName);
  }

  /**
   * Return the block manifest entry for moldName + blockId, or undefined.
   * The entry has extra fields attached: moldName, moldDisplayName.
   */
  getBlock(moldName, blockId) {
    return this._blocks.get(`${moldName}.${blockId}`);
  }

  /**
   * Return every registered block as a flat array, grouped in mold order.
   * Each item: { ...blockManifest, moldName, moldDisplayName, key }
   */
  allBlocks() {
    return Array.from(this._blocks.values());
  }

  /**
   * Return all registered molds as an array of manifests.
   */
  allMolds() {
    return Array.from(this._molds.values());
  }

  /**
   * Return blocks grouped by mold - useful for the sidebar.
   * Shape: [{ moldName, displayName, blocks: [...] }, ...]
   */
  grouped() {
    return Array.from(this._molds.values()).map(mold => ({
      moldName: mold.name,
      displayName: mold.displayName,
      blocks: mold.blocks.map(b => this._blocks.get(`${mold.name}.${b.id}`)),
    }));
  }

  // ─── Change listeners ─────────────────────────────────────────

  /**
   * Register a callback fired whenever the registry changes (load / unregister).
   * Returns an unsubscribe function.
   */
  onChange(fn) {
    this._changeListeners.push(fn);
    return () => { this._changeListeners = this._changeListeners.filter(l => l !== fn); };
  }

  // ─── Internal ─────────────────────────────────────────────────

  _register(manifest) {
    if (!manifest.name || !Array.isArray(manifest.blocks)) {
      throw new Error('MoldoRegistry: manifest must have "name" and "blocks" array');
    }

    this._molds.set(manifest.name, manifest);

    for (const block of manifest.blocks) {
      const key = `${manifest.name}.${block.id}`;
      this._blocks.set(key, {
        ...block,
        moldName: manifest.name,
        moldDisplayName: manifest.displayName || manifest.name,
        /* fully-qualified key, convenient for lookups */
        key,
      });
    }
  }

  _notify() {
    for (const fn of this._changeListeners) fn();
  }
}

/* Export for both browser (global) and Node / bundler environments */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoRegistry;
} else {
  window.MoldoRegistry = MoldoRegistry;
}
