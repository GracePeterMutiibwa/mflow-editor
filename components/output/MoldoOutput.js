/**
 * MoldoOutput — scrollable output / console panel.
 *
 * Usage:
 *   const out = new MoldoOutput();
 *   container.appendChild(out.el);
 *   out.print('Hello from the program!');
 *   out.error('Something went wrong');
 *   out.clear();
 *
 * Public API:
 *   out.el            — root DOM element
 *   out.print(text)   — append a stdout line
 *   out.error(text)   — append a red error line
 *   out.info(text)    — append a dim info line (e.g. "Running…")
 *   out.clear()       — wipe all output
 *   out.setRunning(bool) — show/hide the "running" indicator in the header
 */
class MoldoOutput {
  constructor() {
    this.el = this._build();
  }

  // ─── Public API ──────────────────────────────────────────────

  print(text) {
    this._append(String(text), '#e5e5e5');
  }

  error(text) {
    this._append('✕ ' + String(text), '#f87171');
  }

  info(text) {
    this._append(String(text), '#6b7280');
  }

  clear() {
    this._linesEl.innerHTML = '';
  }

  setRunning(on) {
    this._dotEl.style.background  = on ? '#10b981' : '#475569';
    this._dotEl.style.animation   = on ? 'moldoOutputPulse 1s ease-in-out infinite' : 'none';
    this._statusEl.textContent    = on ? 'Running…' : 'Output';
  }

  // ─── Build ───────────────────────────────────────────────────

  _build() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display: flex;
      flex-direction: column;
      background: #111827;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      color: #e5e5e5;
      overflow: hidden;
    `;

    /* header */
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; gap:8px;
      padding: 8px 14px; border-bottom: 1px solid #1f2937; flex-shrink:0;
    `;

    this._dotEl = document.createElement('span');
    this._dotEl.style.cssText = 'width:7px; height:7px; border-radius:50%; background:#475569; display:inline-block; flex-shrink:0;';

    this._statusEl = document.createElement('span');
    this._statusEl.style.cssText = 'font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:.08em; flex:1;';
    this._statusEl.textContent = 'Output';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      padding:3px 8px; background:transparent; border:1px solid #374151;
      border-radius:3px; color:#6b7280; cursor:pointer; font-family:inherit; font-size:10px;
    `;
    clearBtn.addEventListener('click', () => this.clear());

    header.append(this._dotEl, this._statusEl, clearBtn);
    wrap.appendChild(header);

    /* scrollable lines area */
    this._linesEl = document.createElement('div');
    this._linesEl.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px; display:flex; flex-direction:column; gap:2px;';
    wrap.appendChild(this._linesEl);

    /* inject pulse keyframes once */
    if (!document.getElementById('moldo-output-styles')) {
      const style = document.createElement('style');
      style.id = 'moldo-output-styles';
      style.textContent = `
        @keyframes moldoOutputPulse {
          0%, 100% { opacity:1; } 50% { opacity:.3; }
        }
      `;
      document.head.appendChild(style);
    }

    return wrap;
  }

  _append(text, color) {
    const line = document.createElement('div');
    line.style.cssText = `color:${color}; line-height:1.6; white-space:pre-wrap; word-break:break-all;`;
    line.textContent = text;
    this._linesEl.appendChild(line);
    /* auto-scroll to bottom */
    this._linesEl.scrollTop = this._linesEl.scrollHeight;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoOutput;
} else {
  window.MoldoOutput = MoldoOutput;
}
