/**
 * mdexec.js - Backend execution bridge for the Moldo Flow Editor.
 *
 * Replaces the old PyIodide + /compile/ pipeline with a direct call
 * to the FastAPI /run endpoint. The original flow object (from MoldoGen)
 * is converted to the JSON program tree the backend expects.
 */

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';
function getBackendUrl() {
    return (localStorage.getItem('moldo_backend_url') || DEFAULT_BACKEND_URL).replace(/\/$/, '');
}

// ── MoldoVent 

class MoldoVent {
    constructor() {
        this.statusCheckIntervalId = null;
    }

    async statusCheck(callback, interval = 5000) {
        if (typeof callback !== 'function') return null;
        if (this.statusCheckIntervalId) clearInterval(this.statusCheckIntervalId);
        this._checkAndNotify(callback);
        this.statusCheckIntervalId = setInterval(() => this._checkAndNotify(callback), interval);
        return this.statusCheckIntervalId;
    }

    async _checkAndNotify(callback) {
        callback(await this.isAlive());
    }

    stopStatusCheck() {
        if (this.statusCheckIntervalId) {
            clearInterval(this.statusCheckIntervalId);
            this.statusCheckIntervalId = null;
            return true;
        }
        return false;
    }

    async isAlive() {
        try {
            const res = await fetch(`${getBackendUrl()}/health`);
            if (!res.ok) return false;
            const data = await res.json();
            return data.status === 'OK';
        } catch {
            return false;
        }
    }

    async fetchMolds() {
        try {
            const res = await fetch(`${getBackendUrl()}/molds`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.molds || [];
        } catch { return []; }
    }

    async installMold(file) {
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch(`${getBackendUrl()}/molds/install`, { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) return { ok: false, error: data.detail || 'Install failed' };
            return { ok: true, manifest: data.manifest };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    async uninstallMold(name) {
        try {
            const res = await fetch(`${getBackendUrl()}/molds/${encodeURIComponent(name)}`, { method: 'DELETE' });
            return res.ok;
        } catch { return false; }
    }

    async runProgram(protocol) {
        try {
            const res = await fetch(`${getBackendUrl()}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(protocol),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { stdout: [], errors: [err.detail || `Server error ${res.status}`], highlights: [] };
            }
            return await res.json();
        } catch (e) {
            return { stdout: [], errors: [`Network error: ${e.message}`], highlights: [] };
        }
    }

    /**
     * Open a WebSocket to /ws/run and drive real-time execution.
     *
     * Messages from the backend are placed in a queue and dispatched
     * strictly one at a time - each message is fully awaited before
     * the next one begins, so async handlers (input prompts, etc.)
     * can never run concurrently or race each other.
     */
    runProgramWS(protocol, { stepDelay = 0, onHighlight, onOutput, onError, onInputRequest, onDone } = {}) {
        const wsUrl = getBackendUrl().replace(/^http/, 'ws') + '/ws/run';

        return new Promise((resolve) => {
            let ws;
            try {
                ws = new WebSocket(wsUrl);
            } catch (e) {
                onError?.(`WebSocket error: ${e.message}`);
                resolve();
                return;
            }

            const queue = [];
            let busy = false;

            const pump = () => {
                if (busy || queue.length === 0) return;
                busy = true;
                const msg = queue.shift();
                dispatch(msg).catch((e) => onError?.(`Execution error: ${e.message}`))
                    .finally(() => { busy = false; pump(); });
            };

            const dispatch = async (msg) => {
                switch (msg.type) {
                    case 'highlight':
                        onHighlight?.(msg.canvasId);
                        break;
                    case 'output':
                        onOutput?.(msg.value);
                        break;
                    case 'error':
                        onError?.(msg.message);
                        break;
                    case 'input_request': {
                        const val = onInputRequest
                            ? await onInputRequest(msg.message, msg.dataType)
                            : '';
                        ws.send(JSON.stringify({ type: 'input_response', value: String(val ?? '') }));
                        break;
                    }
                    case 'done':
                        onDone?.();
                        ws.close();
                        resolve();
                        break;
                }
            };

            ws.onopen = () => ws.send(JSON.stringify({ type: 'start', protocol, stepDelay }));
            ws.onmessage = (event) => {
                let msg;
                try { msg = JSON.parse(event.data); } catch { return; }
                queue.push(msg);
                pump();
            };
            ws.onerror = () => { onError?.('Lost connection to backend.'); resolve(); };
            ws.onclose = () => resolve();
        });
    }
}

// ── MoldoInput ────────────────────────────────────────────────────────────────
// Plain-JS input dialog - no Bootstrap, no animations, no timing issues.
// Each call to getInput() creates a fresh overlay, resolves immediately on
// submit, and removes itself from the DOM.

class MoldoInput {
    getInput(typeOfInput, displayMessage) {
        const dtype = (typeOfInput || 'text').toLowerCase();

        return new Promise((resolve) => {
            // Overlay
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', inset: '0', zIndex: '9999',
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            });

            // Dialog card
            const card = document.createElement('div');
            Object.assign(card.style, {
                background: '#faf9f4', borderRadius: '10px',
                padding: '28px 28px 22px', minWidth: '320px', maxWidth: '460px',
                width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                fontFamily: 'inherit',
            });

            // Label
            const label = document.createElement('div');
            label.textContent = displayMessage || 'Input Required';
            Object.assign(label.style, {
                fontWeight: '600', fontSize: '14px',
                color: '#2d3748', marginBottom: '14px',
            });

            // Input element
            let inputEl;
            if (dtype === 'boolean') {
                inputEl = document.createElement('select');
                inputEl.innerHTML = '<option value="False">False</option>'
                    + '<option value="True">True</option>';
            } else {
                inputEl = document.createElement('input');
                inputEl.type = (dtype === 'int' || dtype === 'float') ? 'number' : 'text';
                if (dtype === 'int') inputEl.step = '1';
                if (dtype === 'float') inputEl.step = 'any';
                inputEl.placeholder = dtype === 'int' ? 'Enter an integer'
                    : dtype === 'float' ? 'Enter a number'
                        : 'Enter text';
            }
            Object.assign(inputEl.style, {
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                border: '1px solid #d1cdc4', borderRadius: '6px',
                fontSize: '14px', marginBottom: '18px', outline: 'none',
                background: '#fff', color: '#2d3748',
            });

            // Submit button
            const btn = document.createElement('button');
            btn.textContent = 'OK';
            Object.assign(btn.style, {
                background: '#3e4a1c', color: '#fff', border: 'none',
                padding: '8px 22px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', float: 'right',
            });

            const submit = () => {
                document.body.removeChild(overlay);
                resolve(inputEl.value);
            };

            btn.onclick = submit;
            inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

            card.appendChild(label);
            card.appendChild(inputEl);
            card.appendChild(btn);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => inputEl.focus());
        });
    }
}

// ── MoldoFlowConverter ────────────────────────────────────────────────────────
// Converts the original MoldoGen flow object to the JSON protocol
// expected by POST /run.

class MoldoFlowConverter {
    constructor(flowInstance) {
        this._flow = flowInstance;
        this._ctr = 0;
        this._molds = new Set();
    }

    _id() { return `n${++this._ctr}`; }

    convert(flowObject, collectedInputs = {}) {
        if (!flowObject || !flowObject.start) return null;
        this._ctr = 0;
        this._molds = new Set();

        const program = this._block(flowObject.start, collectedInputs);
        return {
            version: '1.0',
            molds: Array.from(this._molds),
            program,
        };
    }

    // ── Block dispatcher ────────────────────────────────────────

    _block(b, inputs) {
        if (!b) return null;
        let node = null;
        switch (b.type) {
            case 'declaration': node = this._declaration(b); break;
            case 'process': node = this._process(b); break;
            case 'output': node = this._output(b); break;
            case 'input': node = this._input(b, inputs); break;
            case 'loop': node = this._loop(b, inputs); break;
            case 'decision': node = this._decision(b, inputs); break;
            case 'community-block': node = this._community(b); break;
            default: return null;
        }
        if (!node) return null;

        // Tag the root protocol node with the originating canvas node ID
        // so we can map back to canvas nodes for animation after execution.
        node.canvasId = b.nodeId;

        if (b.next) {
            // attach next to tail of the chain this block produced
            let tail = node;
            while (tail.next) tail = tail.next;
            tail.next = this._block(b.next, inputs);
        }
        return node;
    }

    // Walk the protocol tree in execution order, collecting unique canvas IDs.
    _walkSeq(node, seq) {
        if (!node) return;
        const cid = node.canvasId;
        if (cid && (seq.length === 0 || seq[seq.length - 1] !== cid)) {
            seq.push(cid);
        }
        if (node.body) this._walkSeq(node.body, seq);
        if (node.branches && node.branches.true) this._walkSeq(node.branches.true, seq);
        if (node.branches && node.branches.false) this._walkSeq(node.branches.false, seq);
        if (node.next) this._walkSeq(node.next, seq);
    }

    // ── Declaration ─────────────────────────────────────────────

    _declaration(b) {
        this._molds.add('variables');
        // Prefer full variable list with types from DOM node data
        const nodeEl = this._flow && this._flow.getNodes()[b.nodeId];
        const vars = (nodeEl && nodeEl.data && nodeEl.data.variables) ||
            this._inferVars(b.meta);

        if (!vars.length) return {
            id: this._id(), mold: 'variables', block: 'declare',
            params: { name: '_x', value: '0', dataType: 'int' }
        };
        let root = null, prev = null;
        for (const v of vars) {
            const n = {
                id: this._id(), mold: 'variables', block: 'declare',
                params: { name: v.name, value: String(v.value ?? ''), dataType: v.type || 'text' }
            };
            if (!root) root = n;
            if (prev) prev.next = n;
            prev = n;
        }
        return root;
    }

    _inferVars(meta) {
        return Object.entries(meta || {}).map(([name, value]) => ({
            name,
            value: String(value),
            type: typeof value === 'number'
                ? (Number.isInteger(value) ? 'int' : 'float')
                : 'text',
        }));
    }

    // ── Process ─────────────────────────────────────────────────

    _process(b) {
        const op = b.meta && b.meta.operation;
        if (!op) return null;

        // sqrt
        const sqrtM = op.match(/^(\w+)\s*=\s*Math\.sqrt\((\w+)\)$/);
        if (sqrtM) {
            this._molds.add('math');
            return {
                id: this._id(), mold: 'math', block: 'sqrt',
                params: { value: '@' + sqrtM[2], result: sqrtM[1] }
            };
        }

        // x = x * x  (square)
        const sqM = op.match(/^(\w+)\s*=\s*(\w+)\s*\*\s*(\w+)$/);
        if (sqM && sqM[1] === sqM[2] && sqM[2] === sqM[3]) {
            this._molds.add('math');
            return {
                id: this._id(), mold: 'math', block: 'arithmetic',
                params: { left: '@' + sqM[1], operator: '*', right: '@' + sqM[1], result: sqM[1] }
            };
        }

        // target = left op right
        const binM = op.match(/^(\w+)\s*=\s*(\w+)\s*([+\-*\/%])\s*(.+)$/);
        if (binM) {
            const [, target, leftOp, oper, rightRaw] = binM;
            const rTrim = rightRaw.trim();
            const isNum = /^-?\d+(\.\d+)?$/.test(rTrim);
            const right = isNum ? rTrim : ('@' + rTrim);

            if (target === leftOp) {
                // compound assignment: x = x + 5  →  x += 5
                this._molds.add('variables');
                const opMap = { '+': '+=', '-': '-=', '*': '*=', '/': '/=', '%': '%=' };
                return {
                    id: this._id(), mold: 'variables', block: 'modify',
                    params: { target, operator: opMap[oper] || '+=', value: right }
                };
            }
            // arbitrary binary: x = a + b
            this._molds.add('math');
            return {
                id: this._id(), mold: 'math', block: 'arithmetic',
                params: { left: '@' + leftOp, operator: oper, right, result: target }
            };
        }

        // simple assign: x = something
        const asgM = op.match(/^(\w+)\s*=\s*(.+)$/);
        if (asgM) {
            const [, target, rhs] = asgM;
            const rTrim = rhs.trim();
            const isNum = /^-?\d+(\.\d+)?$/.test(rTrim);
            const isWord = /^\w+$/.test(rTrim);
            const value = (isWord && !isNum) ? ('@' + rTrim) : rTrim;
            this._molds.add('variables');
            return {
                id: this._id(), mold: 'variables', block: 'assign',
                params: { target, value }
            };
        }
        return null;
    }

    // ── Output ──────────────────────────────────────────────────

    _output(b) {
        this._molds.add('io');
        const msg = (b.meta && b.meta.message) || '';
        const hasBraces = msg.includes('{') && msg.includes('}');
        const value = hasBraces
            ? 'f"' + msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
            : '"' + msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        return { id: this._id(), mold: 'io', block: 'print', params: { value } };
    }

    // ── Input ───────────────────────────────────────────────────

    _input(b, inputs) {
        const meta = b.meta || {};
        const varName = meta.selectedVariable || '_inp';
        const varType = (meta.variableType || 'text').toLowerCase();

        if (inputs && inputs[b.nodeId] !== undefined) {
            // Use pre-collected browser value - emit as a plain assign
            this._molds.add('variables');
            let val = String(inputs[b.nodeId]);
            if (varType === 'int') val = String(parseInt(val, 10));
            if (varType === 'float') val = String(parseFloat(val));
            return {
                id: this._id(), mold: 'variables', block: 'assign',
                params: { target: varName, value: val }
            };
        }

        // Fallback: server-side input() prompt
        this._molds.add('io');
        const displayMsg = (meta.displayMessage || 'Enter value:').replace(/"/g, '\\"');
        return {
            id: this._id(), mold: 'io', block: 'prompt',
            params: { target: varName, dataType: varType, message: `"${displayMsg}"` }
        };
    }

    // ── Loop ────────────────────────────────────────────────────

    _loop(b, inputs) {
        this._molds.add('control');
        const meta = b.meta || {};
        const iterations = meta.iterations;
        const toVal = typeof iterations === 'number'
            ? String(iterations)
            : ('@' + iterations);

        const body = this._block(meta.body, inputs);
        return {
            id: this._id(), mold: 'control', block: 'forLoop',
            params: { variable: '_loop_i', from: '0', to: toVal, step: '1' },
            body,
        };
    }

    // ── Community block ─────────────────────────────────────────

    _community(b) {
        const meta = b.meta || {};
        const moldName = meta.moldName;
        const blockId = meta.blockId;
        const params = meta.params || {};
        if (!moldName || !blockId) return null;
        this._molds.add(moldName);
        return { id: this._id(), mold: moldName, block: blockId, params };
    }

    // ── Decision / Conditional ──────────────────────────────────

    _decision(b, inputs) {
        this._molds.add('control');
        const decisions = (b.meta && b.meta.decisions) || [];
        if (!decisions.length) return null;
        return this._branchChain(decisions, 0, inputs);
    }

    _branchChain(decisions, idx, inputs) {
        if (idx >= decisions.length) return null;
        const cond = decisions[idx];
        const cm = cond.meta || {};

        const left = '@' + (cm.leftVar || '');
        const op = cm.operator || '==';
        let right;

        if (cm.useVariable) {
            right = '@' + (cm.rightVar || '');
        } else {
            const rv = String(cm.rightValue ?? '');
            const isN = /^-?\d+(\.\d+)?$/.test(rv.trim());
            const isBool = rv.toLowerCase() === 'true' || rv.toLowerCase() === 'false';
            right = (isN || isBool) ? rv : '"' + rv.replace(/"/g, '\\"') + '"';
        }

        const trueBranch = this._block(cond.next, inputs);
        const falseBranch = this._branchChain(decisions, idx + 1, inputs);

        return {
            id: this._id(), mold: 'control', block: 'branch',
            params: { left, operator: op, right },
            branches: { true: trueBranch, false: falseBranch },
        };
    }
}

// ── MoldoExecutor ─────────────────────────────────────────────────────────────

class MoldoExecutor {
    constructor(flowInstance) {
        this.flowInstance = flowInstance;
        this.netManager = new MoldoVent();
        this._moldoInput = new MoldoInput();
    }

    /**
     * Main entry point: scan for inputs, convert, POST, display.
     * @param {object} flowObject  Result of MoldoGen.generateFlowObject()
     */
    async runFlow(flowObject) {
        const log = window.addOutputMessage || console.log;
        const errFn = (msg) => log(msg, true);

        // Convert flow object → JSON protocol (with canvasId tags on each node)
        const converter = new MoldoFlowConverter(this.flowInstance);
        const protocol = converter.convert(flowObject, {});
        if (!protocol || !protocol.program) {
            errFn('Could not convert flow to execution format.');
            return;
        }

        const stepDelay = parseFloat(document.getElementById('executionSpeedSlider')?.value || 0);
        const flow = this.flowInstance;
        let prevCanvas = null;

        const onHighlight = (canvasId) => {
            if (!canvasId || !flow) return;
            flow.highlight(canvasId);
            if (prevCanvas && prevCanvas !== canvasId) {
                flow.highlightEdge(prevCanvas, canvasId);
            }
            prevCanvas = canvasId;
        };

        const onDone = () => {
            setTimeout(() => {
                if (prevCanvas) flow.highlight(prevCanvas, false);
                flow.resetHighlightedEdges();
            }, 900);
        };

        await this.netManager.runProgramWS(protocol, {
            stepDelay,
            onHighlight,
            onOutput: (val) => log(val),
            onError: (msg) => errFn(msg),
            onInputRequest: async (message, dataType) => {
                try {
                    return await this._moldoInput.getInput(dataType, message);
                } catch (_) {
                    return '';
                }
            },
            onDone,
        });
    }
}
