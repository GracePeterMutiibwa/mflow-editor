/**
 * MoldoSidebar — block picker + templates panel.
 *
 * Constructor options:
 *   registry        — MoldoRegistry instance (already loaded)
 *   onDragStart     — function(event, blockEntry) called when user starts dragging a block
 *   onLoadTemplate  — function(templateData) called when user clicks a template card
 *
 * Public API:
 *   sidebar.el        — root DOM element
 *   sidebar.refresh() — re-render block list (call after registry changes)
 */

const SIDEBAR_COLORS = {
  blue:    { dot: '#2563eb', soft: '#eff4ff' },
  violet:  { dot: '#7c3aed', soft: '#f3efff' },
  amber:   { dot: '#d97706', soft: '#fff5e6' },
  rose:    { dot: '#e11d48', soft: '#ffeef1' },
  emerald: { dot: '#059669', soft: '#e8f8f1' },
  slate:   { dot: '#475569', soft: '#eef1f5' },
};

const SIDEBAR_ICONS = {
  hash:'#', tag:'⊏', calc:'±', spark:'✦', send:'▶', prompt:'?',
  branch:'⑂', loop:'↺', merge:'⊕', split:'⊗', sort:'Aa',
  filter:'▽', ruler:'⌇', eye:'◎', function:'ƒ', play:'▸',
  layers:'▤', database:'⊟', globe:'⊕', link:'⊞', clock:'◷', check:'✓',
};

/* ── Built-in templates ─────────────────────────────────────────────────── */
const TEMPLATES = [
  {
    id: 'helloWorld',
    name: 'Hello World',
    description: 'Declare a greeting message and print it',
    icon: '▶',
    tag: 'Beginner',
    data: {
      nodes: [
        { id: 'n1', moldName: 'variables', blockId: 'declare',
          params: { name: 'message', dataType: 'text', value: 'Hello, World!' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'io', blockId: 'print',
          params: { value: '@message' }, x: 60, y: 160 },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    },
  },
  {
    id: 'arithmetic',
    name: 'Arithmetic',
    description: 'Add two numbers and print the result',
    icon: '±',
    tag: 'Math',
    data: {
      nodes: [
        { id: 'n1', moldName: 'variables', blockId: 'declare',
          params: { name: 'a', dataType: 'int', value: '10' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'variables', blockId: 'declare',
          params: { name: 'b', dataType: 'int', value: '5' }, x: 60, y: 140 },
        { id: 'n3', moldName: 'math', blockId: 'arithmetic',
          params: { left: '@a', operator: '+', right: '@b', result: 'sum' }, x: 60, y: 240 },
        { id: 'n4', moldName: 'io', blockId: 'print',
          params: { value: '@sum' }, x: 60, y: 340 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
      ],
    },
  },
  {
    id: 'sumLoop',
    name: 'Sum 1 to N',
    description: 'Accumulate a total using a for loop',
    icon: '↺',
    tag: 'Loops',
    data: {
      nodes: [
        { id: 'n1', moldName: 'variables', blockId: 'declare',
          params: { name: 'n', dataType: 'int', value: '10' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'variables', blockId: 'declare',
          params: { name: 'total', dataType: 'int', value: '0' }, x: 60, y: 140 },
        { id: 'n3', moldName: 'control', blockId: 'forLoop',
          params: { variable: 'i', from: '1', to: '@n', step: '1' }, x: 60, y: 240 },
        { id: 'n4', moldName: 'variables', blockId: 'modify',
          params: { target: 'total', operator: '+=', value: '@i' }, x: 60, y: 340 },
        { id: 'n5', moldName: 'io', blockId: 'print',
          params: { value: '@total' }, x: 60, y: 440 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'countdown',
    name: 'Countdown',
    description: 'Count down from 5 to 1 with a while loop',
    icon: '⏱',
    tag: 'Loops',
    data: {
      nodes: [
        { id: 'n1', moldName: 'variables', blockId: 'declare',
          params: { name: 'count', dataType: 'int', value: '5' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'control', blockId: 'whileLoop',
          params: { left: '@count', operator: '>', right: '0' }, x: 60, y: 140 },
        { id: 'n3', moldName: 'io', blockId: 'print',
          params: { value: '@count' }, x: 60, y: 240 },
        { id: 'n4', moldName: 'variables', blockId: 'modify',
          params: { target: 'count', operator: '-=', value: '1' }, x: 60, y: 340 },
        { id: 'n5', moldName: 'io', blockId: 'print',
          params: { value: 'Blastoff!' }, x: 60, y: 440 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'userInput',
    name: 'User Input',
    description: 'Read a number from the user and double it',
    icon: '?',
    tag: 'I/O',
    data: {
      nodes: [
        { id: 'n1', moldName: 'io', blockId: 'prompt',
          params: { message: 'Enter a number:', dataType: 'int', target: 'n' }, x: 60, y: 60 },
        { id: 'n2', moldName: 'math', blockId: 'arithmetic',
          params: { left: '@n', operator: '*', right: '2', result: 'doubled' }, x: 60, y: 180 },
        { id: 'n3', moldName: 'io', blockId: 'print',
          params: { value: '@doubled' }, x: 60, y: 300 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
    },
  },
  {
    id: 'randomNumber',
    name: 'Random Number',
    description: 'Generate a random number between 1 and 100',
    icon: '✦',
    tag: 'Math',
    data: {
      nodes: [
        { id: 'n1', moldName: 'math', blockId: 'random',
          params: { min: '1', max: '100', result: 'num' }, x: 60, y: 60 },
        { id: 'n2', moldName: 'io', blockId: 'print',
          params: { value: '@num' }, x: 60, y: 180 },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    },
  },
  {
    id: 'buildList',
    name: 'Build a List',
    description: 'Create a list and append several items to it',
    icon: '▤',
    tag: 'Collections',
    data: {
      nodes: [
        { id: 'n1', moldName: 'collections', blockId: 'createList',
          params: { items: '', result: 'fruits' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'collections', blockId: 'append',
          params: { list: 'fruits', item: 'apple' }, x: 60, y: 140 },
        { id: 'n3', moldName: 'collections', blockId: 'append',
          params: { list: 'fruits', item: 'banana' }, x: 60, y: 240 },
        { id: 'n4', moldName: 'collections', blockId: 'append',
          params: { list: 'fruits', item: 'cherry' }, x: 60, y: 340 },
        { id: 'n5', moldName: 'io', blockId: 'print',
          params: { value: '@fruits' }, x: 60, y: 440 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'factorial',
    name: 'Factorial (Recursion)',
    description: 'Define and call a recursive factorial function',
    icon: 'ƒ',
    tag: 'Recursion',
    data: {
      nodes: [
        { id: 'n1', moldName: 'functions', blockId: 'define',
          params: { name: 'factorial', params: 'n' }, x: 60, y: 40 },
        { id: 'n2', moldName: 'control', blockId: 'branch',
          params: { left: '@n', operator: '<=', right: '1' }, x: 60, y: 140 },
        { id: 'n3', moldName: 'functions', blockId: 'return',
          params: { value: '1' }, x: 340, y: 140 },
        { id: 'n4', moldName: 'math', blockId: 'arithmetic',
          params: { left: '@n', operator: '-', right: '1', result: 'nm1' }, x: 60, y: 260 },
        { id: 'n5', moldName: 'functions', blockId: 'call',
          params: { name: 'factorial', args: '@nm1', result: 'sub' }, x: 60, y: 360 },
        { id: 'n6', moldName: 'math', blockId: 'arithmetic',
          params: { left: '@n', operator: '*', right: '@sub', result: 'result' }, x: 60, y: 460 },
        { id: 'n7', moldName: 'functions', blockId: 'return',
          params: { value: '@result' }, x: 60, y: 560 },
        { id: 'n8', moldName: 'functions', blockId: 'call',
          params: { name: 'factorial', args: '5', result: 'answer' }, x: 340, y: 320 },
        { id: 'n9', moldName: 'io', blockId: 'print',
          params: { value: '@answer' }, x: 340, y: 440 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n2', to: 'n4' },
        { from: 'n4', to: 'n5' },
        { from: 'n5', to: 'n6' },
        { from: 'n6', to: 'n7' },
        { from: 'n8', to: 'n9' },
      ],
    },
  },
];

/* ── Tag colours ───────────────────────────────────────────────────────── */
const TAG_COLORS = {
  Beginner:    { bg: '#eff4ff', text: '#2563eb' },
  Math:        { bg: '#f3efff', text: '#7c3aed' },
  Loops:       { bg: '#e8f8f1', text: '#059669' },
  'I/O':       { bg: '#fff5e6', text: '#d97706' },
  Collections: { bg: '#ffeef1', text: '#e11d48' },
  Recursion:   { bg: '#eef1f5', text: '#475569' },
  Functions:   { bg: '#eef1f5', text: '#475569' },
};

/* ════════════════════════════════════════════════════════════════════════ */
class MoldoSidebar {
  constructor({ registry, onDragStart = () => {}, onLoadTemplate = () => {} }) {
    this._registry       = registry;
    this._onDragStart    = onDragStart;
    this._onLoadTemplate = onLoadTemplate;
    this._query          = '';
    this._collapsed      = {};
    this._activeTab      = 'blocks';   /* 'blocks' | 'templates' */

    this.el = this._buildShell();
    this._listEl      = this.el.querySelector('[data-role="list"]');
    this._templatesEl = this.el.querySelector('[data-role="templates"]');
    this._render();
    this._renderTemplates();

    registry.onChange(() => this._render());
  }

  /* ── Public ─────────────────────────────────────────────────────────── */

  refresh() { this._render(); }

  /* ── Shell ──────────────────────────────────────────────────────────── */

  _buildShell() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; flex-direction: column;
      width: 220px; height: 100%;
      background: #ffffff;
      border-right: 1px solid #e6e6e6;
      font-family: "IBM Plex Sans", system-ui, sans-serif;
      font-size: 13px; color: #1a1a1a;
      overflow: hidden; flex-shrink: 0;
    `;

    /* ── tab bar ── */
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
      display: flex; flex-shrink: 0;
      border-bottom: 1px solid #e6e6e6;
      background: #fafaf9;
    `;

    this._tabBlocks    = this._makeTab('Blocks',    'blocks');
    this._tabTemplates = this._makeTab('Templates', 'templates');
    tabBar.append(this._tabBlocks, this._tabTemplates);
    panel.appendChild(tabBar);

    /* ── blocks panel ── */
    const blocksPanel = document.createElement('div');
    blocksPanel.dataset.role = 'blocks-panel';
    blocksPanel.style.cssText = 'display:flex; flex-direction:column; flex:1; overflow:hidden;';

    /* search box */
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:10px 12px 8px; border-bottom:1px solid #f0f0f0; flex-shrink:0;';

    const inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex; align-items:center; gap:6px; background:#f4f4f4; border-radius:5px; padding:5px 8px;';

    const searchIcon = document.createElement('span');
    searchIcon.style.cssText = 'color:#9a9a9a; font-size:12px; flex-shrink:0;';
    searchIcon.textContent = '⌕';

    const searchInput = document.createElement('input');
    searchInput.placeholder = 'Search blocks…';
    searchInput.style.cssText = 'flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:12px; color:#1a1a1a;';
    searchInput.addEventListener('input', () => {
      this._query = searchInput.value;
      this._render();
    });

    inputWrap.append(searchIcon, searchInput);
    searchWrap.appendChild(inputWrap);
    blocksPanel.appendChild(searchWrap);

    const list = document.createElement('div');
    list.dataset.role = 'list';
    list.style.cssText = 'flex:1; overflow-y:auto; padding:8px 0;';
    blocksPanel.appendChild(list);

    /* ── templates panel ── */
    const templatesPanel = document.createElement('div');
    templatesPanel.dataset.role = 'templates-panel';
    templatesPanel.style.cssText = 'display:none; flex-direction:column; flex:1; overflow:hidden;';

    const tList = document.createElement('div');
    tList.dataset.role = 'templates';
    tList.style.cssText = 'flex:1; overflow-y:auto; padding:10px 10px 16px;';
    templatesPanel.appendChild(tList);

    panel.appendChild(blocksPanel);
    panel.appendChild(templatesPanel);

    this._blocksPanel    = blocksPanel;
    this._templatesPanel = templatesPanel;

    this._syncTabs();
    return panel;
  }

  _makeTab(label, id) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.tab = id;
    btn.style.cssText = `
      flex: 1; padding: 9px 4px; border: none; background: transparent;
      font-family: "IBM Plex Sans", system-ui, sans-serif; font-size: 12px;
      font-weight: 500; color: #9a9a9a; cursor: pointer;
      border-bottom: 2px solid transparent; transition: color .15s, border-color .15s;
    `;
    btn.addEventListener('click', () => {
      this._activeTab = id;
      this._syncTabs();
    });
    return btn;
  }

  _syncTabs() {
    const isBlocks = this._activeTab === 'blocks';

    /* tab button appearance */
    const activeStyle  = 'color:#1a1a1a; border-bottom-color:#1a1a1a;';
    const inactiveStyle = 'color:#9a9a9a; border-bottom-color:transparent;';
    this._tabBlocks.style.cssText    += isBlocks  ? activeStyle : inactiveStyle;
    this._tabTemplates.style.cssText += !isBlocks ? activeStyle : inactiveStyle;

    if (this._blocksPanel && this._templatesPanel) {
      this._blocksPanel.style.display    = isBlocks  ? 'flex' : 'none';
      this._templatesPanel.style.display = !isBlocks ? 'flex' : 'none';
    }
  }

  /* ── Blocks render ──────────────────────────────────────────────────── */

  _render() {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';

    const groups = this._registry.grouped();
    const q      = this._query.trim().toLowerCase();

    for (const group of groups) {
      const filtered = q
        ? group.blocks.filter(b => b.name.toLowerCase().includes(q) || group.displayName.toLowerCase().includes(q))
        : group.blocks;
      if (!filtered.length) continue;
      this._listEl.appendChild(this._buildGroup(group.moldName, group.displayName, filtered));
    }

    if (!this._listEl.children.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:16px 14px; font-size:12px; color:#9a9a9a; font-family:"JetBrains Mono",monospace;';
      empty.textContent = 'No blocks found.';
      this._listEl.appendChild(empty);
    }
  }

  _buildGroup(moldName, displayName, blocks) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:4px;';

    const groupHeader = document.createElement('button');
    groupHeader.style.cssText = `
      width:100%; display:flex; align-items:center; justify-content:space-between;
      background:transparent; border:none; padding:4px 14px;
      font-family:"JetBrains Mono",monospace; font-size:10px; color:#9a9a9a;
      text-transform:uppercase; letter-spacing:.09em; cursor:pointer;
    `;

    const groupLabel = document.createElement('span');
    groupLabel.textContent = displayName;
    const toggle = document.createElement('span');
    toggle.textContent = this._collapsed[moldName] ? '+' : '−';

    groupHeader.append(groupLabel, toggle);
    groupHeader.addEventListener('click', () => {
      this._collapsed[moldName] = !this._collapsed[moldName];
      toggle.textContent = this._collapsed[moldName] ? '+' : '−';
      itemsEl.style.display = this._collapsed[moldName] ? 'none' : 'flex';
    });
    wrap.appendChild(groupHeader);

    const itemsEl = document.createElement('div');
    itemsEl.style.cssText = 'display:flex; flex-direction:column; gap:1px; padding:2px 0;';
    if (this._collapsed[moldName]) itemsEl.style.display = 'none';

    for (const block of blocks) itemsEl.appendChild(this._buildItem(block));
    wrap.appendChild(itemsEl);
    return wrap;
  }

  _buildItem(block) {
    const color    = SIDEBAR_COLORS[block.color] || SIDEBAR_COLORS.slate;
    const isCircle = block.nodeShape === 'circle';

    const item = document.createElement('div');
    item.draggable = true;
    item.style.cssText = `
      display:flex; align-items:center; gap:10px;
      padding:6px 14px; cursor:grab;
      font-size:12.5px; color:#1a1a1a;
      transition: background .1s;
    `;
    item.addEventListener('mouseenter', () => { item.style.background = '#fafaf9'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/moldo-block', JSON.stringify({ key: block.key }));
      e.dataTransfer.effectAllowed = 'copy';
      this._onDragStart(e, block);
    });

    const dot = document.createElement('span');
    dot.style.cssText = `
      width:18px; height:18px; flex-shrink:0;
      border-radius:${isCircle ? '50%' : '3px'};
      display:inline-flex; align-items:center; justify-content:center;
      background:${color.soft}; color:${color.dot}; font-size:10px;
    `;
    dot.textContent = SIDEBAR_ICONS[block.icon] || '▸';

    const name = document.createElement('span');
    name.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    name.textContent = block.name;

    const badge = document.createElement('span');
    badge.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:9px; color:#9a9a9a; text-transform:uppercase; flex-shrink:0;';
    badge.textContent = block.nodeType;

    item.append(dot, name, badge);
    return item;
  }

  /* ── Templates render ───────────────────────────────────────────────── */

  _renderTemplates() {
    if (!this._templatesEl) return;
    this._templatesEl.innerHTML = '';

    const label = document.createElement('div');
    label.style.cssText = 'font-family:"JetBrains Mono",monospace; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:.09em; margin-bottom:10px;';
    label.textContent = 'Click to load';
    this._templatesEl.appendChild(label);

    for (const tpl of TEMPLATES) {
      this._templatesEl.appendChild(this._buildTemplateCard(tpl));
    }
  }

  _buildTemplateCard(tpl) {
    const tagColor = TAG_COLORS[tpl.tag] || TAG_COLORS.Beginner;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #fafaf9;
      border: 1px solid #e6e6e6;
      border-radius: 7px;
      padding: 11px 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.background    = '#f4f4f4';
      card.style.borderColor   = '#c8c8c8';
    });
    card.addEventListener('mouseleave', () => {
      card.style.background    = '#fafaf9';
      card.style.borderColor   = '#e6e6e6';
    });
    card.addEventListener('click', () => {
      this._onLoadTemplate(tpl.data);
    });

    /* top row: icon + name + tag */
    const top = document.createElement('div');
    top.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:5px;';

    const iconEl = document.createElement('span');
    iconEl.style.cssText = `
      width:22px; height:22px; flex-shrink:0; border-radius:4px;
      background:${tagColor.bg}; color:${tagColor.text};
      display:inline-flex; align-items:center; justify-content:center;
      font-size:11px;
    `;
    iconEl.textContent = tpl.icon;

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:12.5px; font-weight:600; color:#1a1a1a; flex:1;';
    nameEl.textContent = tpl.name;

    const tagEl = document.createElement('span');
    tagEl.style.cssText = `
      font-family:"JetBrains Mono",monospace; font-size:9px; font-weight:500;
      padding:2px 6px; border-radius:3px;
      background:${tagColor.bg}; color:${tagColor.text};
      flex-shrink:0;
    `;
    tagEl.textContent = tpl.tag;

    top.append(iconEl, nameEl, tagEl);
    card.appendChild(top);

    /* description */
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:11.5px; color:#6b6b6b; line-height:1.4;';
    desc.textContent = tpl.description;
    card.appendChild(desc);

    /* node count hint */
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:6px; font-family:"JetBrains Mono",monospace; font-size:9.5px; color:#b0b0b0;';
    hint.textContent = `${tpl.data.nodes.length} nodes · ${tpl.data.edges.length} edges`;
    card.appendChild(hint);

    return card;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoldoSidebar;
} else {
  window.MoldoSidebar = MoldoSidebar;
}
