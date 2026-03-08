// Text Insight — App script placeholder
// NOTE: The inline <script> in public/index.html remains the source of truth.
// This file is linked to begin separating JS from HTML and is safe to remove
// once the full script is migrated here.

console.debug('[app.js] Loaded: migration in progress');


const VIEW_ALL = '__ALL__';
const VIEW_ROOT = '__ROOT__';

const state = {
    currentView: VIEW_ALL,
    foldersTree: [],
    flatFolders: [],
    audios: [],
    counts: { total: 0, root: 0 },
    expandedFolders: new Set(),
    selectedAudios: new Set()
};

const playback = {
    player: null,
    audioData: null,
    filePath: null,
    raf: null
};

const els = {
    folderNav: document.getElementById('folder-navigation'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    listCount: document.getElementById('list-count'),
    audioList: document.getElementById('audio-list'),
    newFolderBtn: document.getElementById('new-folder-btn'),
    moveFolderBtn: document.getElementById('move-folder-btn'),
    deleteFolderBtn: document.getElementById('delete-folder-btn'),
    copyPathBtn: document.getElementById('copy-path-btn'),
    form: document.getElementById('text-to-speech-form'),
    generatorTarget: document.getElementById('generator-target'),
    generateButton: document.getElementById('generate-button'),
    folderSelect: document.getElementById('target-folder'),
    audioNameInput: document.getElementById('audio-name'),
    toast: document.getElementById('toast'),
    bulkBar: document.getElementById('bulk-actions'),
    bulkCount: document.getElementById('bulk-count'),
    bulkMoveBtn: document.getElementById('bulk-move'),
    bulkDeleteBtn: document.getElementById('bulk-delete'),
    bulkClearBtn: document.getElementById('bulk-clear'),
    appShell: document.querySelector('.app-shell'),
    sidebar: document.querySelector('.sidebar'),
    toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    fullscreenToggleBtn: document.getElementById('fullscreen-toggle-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    zoomLevel: document.getElementById('zoom-level'),
    floatingMenu: document.getElementById('floating-menu'),
    floatingToggle: document.getElementById('floating-toggle'),
    floatingList: document.getElementById('floating-audio-list'),
    floatingCount: document.getElementById('floating-count'),
    layoutHeader: document.querySelector('.layout-header'),
    notesSidebar: document.getElementById('notes-sidebar'),
    notesCloseBtn: document.getElementById('notes-close-btn'),
    notesVisibilityToggle: document.getElementById('notes-visibility-toggle'),
    notesContext: document.getElementById('notes-context'),
    notesList: document.getElementById('notes-list'),
    notesCreate: document.getElementById('notes-create'),
    notesCreateQuote: document.getElementById('notes-create-quote'),
    notesCreateText: document.getElementById('notes-create-text'),
    notesCreateSave: document.getElementById('notes-create-save'),
    notesCreateCancel: document.getElementById('notes-create-cancel'),
    notesCreateDir: document.getElementById('notes-create-dir'),
    notesCreateAi: document.getElementById('notes-create-ai'),
    notesCreateAiLang: document.getElementById('notes-create-ai-lang'),
    notesEdit: document.getElementById('notes-edit'),
    notesEditQuote: document.getElementById('notes-edit-quote'),
    notesEditText: document.getElementById('notes-edit-text'),
    notesEditSave: document.getElementById('notes-edit-save'),
    notesEditDelete: document.getElementById('notes-edit-delete'),
    notesEditHidden: document.getElementById('notes-edit-hidden'),
    notesEditColor: document.getElementById('notes-edit-color'),
    notesEditSwatches: document.getElementById('notes-edit-swatches'),
    notesEditDir: document.getElementById('notes-edit-dir'),
    notesEditJump: document.getElementById('notes-edit-jump'),
    notesEditCopy: document.getElementById('notes-edit-copy'),
    notesEditAi: document.getElementById('notes-edit-ai'),
    notesAiLang: document.getElementById('notes-ai-lang'),
    notesBackdrop: document.getElementById('notes-backdrop'),
    notesColorPicker: document.getElementById('notes-color-picker'),
    notesSearch: document.getElementById('notes-search'),
    notesSort: document.getElementById('notes-sort'),
    notesTooltipSize: document.getElementById('notes-tooltip-size'),
    notesTtsLang: document.getElementById('notes-tts-lang'),
    notesCreateSpeak: document.getElementById('notes-create-speak'),
    notesEditSpeakQuote: document.getElementById('notes-edit-speak-quote'),
    notesEditSpeakText: document.getElementById('notes-edit-speak-text')
};
// AI modal elements
const aiEls = {
    openBtn: document.getElementById('ai-assist-open'),
    modal: document.getElementById('ai-modal'),
    close: document.getElementById('ai-close'),
    cancel: document.getElementById('ai-cancel'),
    ask: document.getElementById('ai-ask'),
    prompt: document.getElementById('ai-prompt'),
    selected: document.getElementById('ai-selected'),
    response: document.getElementById('ai-response'),
    status: document.getElementById('ai-status'),
    loadNote: document.getElementById('ai-load-note'),
    templates: document.getElementById('ai-templates')
};

const playerUI = {
    container: document.getElementById('player-bar'),
    title: document.getElementById('player-title'),
    context: document.getElementById('player-context'),
    toggle: document.getElementById('player-toggle'),
    rewind: document.getElementById('player-rewind'),
    forward: document.getElementById('player-forward'),
    progress: document.getElementById('player-progress'),
    current: document.getElementById('player-current'),
    duration: document.getElementById('player-duration'),
    speed: document.getElementById('player-speed')
};

let toastTimer = null;
let bulkProcessing = false;
let textZoom = 1;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;
let playerSpeed = 1;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
// Notes state
const notesState = {
    visible: true,
    byFile: new Map(), // filePath -> notes[]
    sidebar: { mode: 'list', filePath: null, textBlock: null, note: null, range: null },
    // Default note highlight color (yellow)
    defaultColor: '#fde047',
    tts: { defaultLang: 'auto', voices: [] },
    tooltipSizePx: 14,
    searchQuery: '',
    sortOrder: 'new'
};

const getPreferredTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
};

const applyTheme = (theme) => {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (els.themeToggleBtn) {
        els.themeToggleBtn.textContent = `Theme: ${t.charAt(0).toUpperCase()}${t.slice(1)}`;
    }
};

// -------- Fullscreen helpers --------
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
const requestFs = (el) => {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
};
const exitFs = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
};
const updateFullscreenUI = () => {
    if (!els.fullscreenToggleBtn) return;
    els.fullscreenToggleBtn.textContent = isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen';
};
const toggleFullscreen = () => {
    if (isFullscreen()) {
        exitFs();
    } else {
        requestFs(document.documentElement);
    }
};

const setTheme = (theme) => {
    const t = theme === 'light' ? 'light' : 'dark';
    localStorage.setItem('theme', t);
    applyTheme(t);
};

const applyZoom = () => {
    document.documentElement.style.setProperty('--zoom', String(textZoom));
    if (els.zoomLevel) {
        els.zoomLevel.textContent = `${Math.round(textZoom * 100)}%`;
    }
    if (els.zoomInBtn) {
        els.zoomInBtn.disabled = textZoom >= ZOOM_MAX - 1e-6;
    }
    if (els.zoomOutBtn) {
        els.zoomOutBtn.disabled = textZoom <= ZOOM_MIN + 1e-6;
    }
};

const loadSpeed = () => {
    const stored = parseFloat(localStorage.getItem('playerSpeed'));
    playerSpeed = Number.isFinite(stored) ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, stored)) : 1;
    if (playerUI.speed) {
        playerUI.speed.value = String(playerSpeed);
    }
};

const hashId = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
};

const renderFloatingMenu = (items) => {
    if (!els.floatingList || !els.floatingCount) return;
    els.floatingList.innerHTML = '';
    els.floatingCount.textContent = String(items.length);

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No audios in view';
        empty.style.margin = '6px';
        els.floatingList.appendChild(empty);
        return;
    }

    items.forEach((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'floating-item';
        btn.dataset.anchorId = it.anchorId;
        btn.innerHTML = `
          <span title="${it.title}">▶ ${it.title}</span>
          <span class="badge">${it.lang.toUpperCase()}</span>
        `;
        els.floatingList.appendChild(btn);
    });
};

const setZoom = (value) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
    textZoom = Math.round((clamped + Number.EPSILON) * 10) / 10; // snap to 0.1
    localStorage.setItem('textZoom', String(textZoom));
    applyZoom();
};

const loadZoom = () => {
    const stored = parseFloat(localStorage.getItem('textZoom'));
    if (Number.isFinite(stored)) {
        textZoom = stored;
    } else {
        textZoom = 1;
    }
    applyZoom();
};

const updateSidebarToggleUI = () => {
    const hidden = els.appShell?.classList.contains('sidebar-hidden');
    if (els.toggleSidebarBtn) {
        els.toggleSidebarBtn.textContent = hidden ? 'Show Sidebar' : 'Hide Sidebar';
    }
};

const setSidebarHidden = (hidden) => {
    if (!els.appShell) return;
    els.appShell.classList.toggle('sidebar-hidden', !!hidden);
    localStorage.setItem('sidebarHidden', hidden ? '1' : '0');
    updateSidebarToggleUI();
};

const showToast = (message, type = 'info') => {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove('error');
    if (type === 'error') {
        els.toast.classList.add('error');
    }
    els.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast.classList.remove('visible', 'error');
    }, 3200);
};

// Prefer shared Services.apiRequest if available, fallback to local
const apiRequest = (window.Services && window.Services.apiRequest)
    ? window.Services.apiRequest
    : (async (url, options = {}) => {
        const response = await fetch(url, options);
        const text = await response.text();
        let payload = null;
        if (text) {
            try { payload = JSON.parse(text); } catch (_) { payload = null; }
        }
        if (!response.ok) {
            const errorMessage = (payload && payload.error) || response.statusText || 'Request failed';
            throw new Error(errorMessage);
        }
        return payload;
    });

const formatFolderLabel = (path) => {
    if (!path) {
        return 'Root (unsorted)';
    }
    return path.split('/').map((part) => part.trim()).join(' › ');
};

const formatFolderPath = (path) => {
    if (!path) {
        return '/';
    }
    return path;
};

const flattenFolders = (nodes, chain = []) => {
    const list = [];
    nodes.forEach((node) => {
        const currentChain = [...chain, node.name];
        list.push({
            path: node.path,
            label: currentChain.join(' / ')
        });
        if (node.children && node.children.length) {
            list.push(...flattenFolders(node.children, currentChain));
        }
    });
    return list;
};

const collectPaths = (nodes, acc = []) => {
    nodes.forEach((node) => {
        acc.push(node.path);
        if (node.children && node.children.length) {
            collectPaths(node.children, acc);
        }
    });
    return acc;
};

const highlightActiveView = () => {
    const buttons = els.folderNav.querySelectorAll('[data-target]');
    buttons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.target === state.currentView);
    });
};

const updateFolderSelect = () => {
    const previousValue = els.folderSelect.value;
    els.folderSelect.innerHTML = '';

    const rootOption = document.createElement('option');
    rootOption.value = '';
    rootOption.textContent = 'Root (unsorted)';
    els.folderSelect.appendChild(rootOption);

    state.flatFolders.forEach((folder) => {
        const option = document.createElement('option');
        option.value = folder.path;
        option.textContent = folder.label;
        els.folderSelect.appendChild(option);
    });

    const desired = state.currentView === VIEW_ALL
        ? previousValue
        : state.currentView === VIEW_ROOT
            ? ''
            : state.currentView;

    if (desired !== undefined && desired !== null) {
        els.folderSelect.value = desired;
    }
    if (!els.folderSelect.value && desired) {
        els.folderSelect.value = desired;
    }
};

const updateGeneratorTarget = () => {
    if (state.currentView === VIEW_ALL) {
        els.generatorTarget.textContent = 'Saving to: All audio';
    } else if (state.currentView === VIEW_ROOT) {
        els.generatorTarget.textContent = 'Saving to: Root (unsorted)';
    } else {
        els.generatorTarget.textContent = `Saving to: ${formatFolderLabel(state.currentView)}`;
    }
};

const updateHeaderState = () => {
    let title = 'All audio';
    let subtitle = '';
    let count = state.audios.length;

    if (state.currentView === VIEW_ALL) {
        title = 'All audio';
        count = state.counts.total;
        subtitle = `${count} item${count === 1 ? '' : 's'} in your library.`;
    } else if (state.currentView === VIEW_ROOT) {
        title = 'Root (unsorted)';
        count = state.audios.length;
        subtitle = count
            ? `${count} audio${count === 1 ? '' : 's'} stored directly in the root.`
            : 'No audio files are stored directly in the root.';
    } else {
        title = formatFolderLabel(state.currentView);
        subtitle = count
            ? `${count} audio${count === 1 ? '' : 's'} in this folder.`
            : 'This folder does not contain any audio yet.';
    }

    els.viewTitle.textContent = title;
    els.viewSubtitle.textContent = subtitle;
    els.listCount.textContent = count ? `${count} item${count === 1 ? '' : 's'}` : 'Empty';

    const isFolder = state.currentView !== VIEW_ALL && state.currentView !== VIEW_ROOT;
    els.moveFolderBtn.disabled = !isFolder;
    els.deleteFolderBtn.disabled = !isFolder;

    const canCopy = state.currentView !== VIEW_ALL;
    els.copyPathBtn.disabled = !canCopy;
};

const applyLanguageStyling = (element, language) => {
    element.classList.toggle('rtl', language === 'ar');
};

// Notes/annotation support using Rough Notation
let noteSelection = { range: null, textBlock: null };

const getSelectionInTextBlock = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    const containerNode = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!containerNode) return null;
    const textBlock = containerNode.closest('.audio-text');
    if (!textBlock) return null;
    return { range, textBlock };
};

// note-bubble functions removed

const applyRoughHighlight = (el) => {
    try {
        if (window.RoughNotation && RoughNotation.annotate) {
            const color = getComputedStyle(document.documentElement).getPropertyValue('--note-color').trim() || '#fde047';
            const a = RoughNotation.annotate(el, { type: 'highlight', multiline: true, color, strokeWidth: 2, padding: 2, animationDuration: 600 });
            a.show();
            el._annotation = a;
        } else {
            el.style.backgroundImage = `linear-gradient(transparent 60%, var(--note-color) 60%)`;
        }
    } catch (_) { }
};

const initNotesUI = () => {
    document.addEventListener('mouseup', () => {
        const selData = getSelectionInTextBlock();
        if (!selData) return;
        noteSelection = selData;
        // Also open sidebar directly for creating a new note
        openNotesSidebarForSelection(noteSelection.textBlock, noteSelection.range);
    });
    // Enable/disable save buttons on input
    if (els.notesCreateText) {
        els.notesCreateText.addEventListener('input', () => {
            const v = (els.notesCreateText.value || '').trim();
            els.notesCreateSave.disabled = v.length === 0;
        });
    }
    if (els.notesEditText) {
        els.notesEditText.addEventListener('input', () => {
            const v = (els.notesEditText.value || '').trim();
            els.notesEditSave.disabled = v.length === 0;
        });
    }
    // note-bubble listeners removed
};

// Break text into tokens and wrap punctuation in spans for coloring
const tokenizeText = (text) => {
    const tokens = [];
    let lastIndex = 0;
    // Capture ellipsis (… or ...) and common punctuation 
    const re = /(\u2026|\.\.\.|[\.,;:!\?\-—–\(\)\{\}\[\]"“„”'’])/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        tokens.push({ type: 'punct', value: match[0] });
        lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
        tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return tokens;
};

const classForPunct = (value) => {
    switch (value) {
        case '.': return 'punct-period';
        case ',': return 'punct-comma';
        case '-': return 'punct-dash';
        case '—':
        case '–': return 'punct-mdash';
        case '…':
        case '...': return 'punct-ellipsis';
        case ';': return 'punct-semicolon';
        case ':': return 'punct-colon';
        case '?': return 'punct-question';
        case '!': return 'punct-exclaim';
        case '"':
        case '“':
        case '„':
        case '”': return 'punct-quote';
        case "'":
        case '’': return 'punct-quote';
        case '(': case ')': return 'punct-paren';
        case '[': case ']': return 'punct-bracket';
        case '{': case '}': return 'punct-brace';
        default: return 'punct';
    }
};

const colorizePunctuationInto = (element, text) => {
    element.innerHTML = '';
    const frag = document.createDocumentFragment();
    const lines = String(text).split(/\n/);
    lines.forEach((line, i) => {
        const parts = tokenizeText(line);
        parts.forEach((part) => {
            if (part.type === 'punct') {
                const span = document.createElement('span');
                span.className = `punct ${classForPunct(part.value)}`;
                span.textContent = part.value;
                frag.appendChild(span);
            } else if (part.value) {
                frag.appendChild(document.createTextNode(part.value));
            }
        });
        if (i < lines.length - 1) {
            frag.appendChild(document.createElement('br'));
        }
    });
    element.appendChild(frag);
};

// ---- Notes helpers ----
const setNotesVisible = (visible) => {
    notesState.visible = !!visible;
    try { localStorage.setItem('notesVisible', notesState.visible ? '1' : '0'); } catch (_) { }
    document.documentElement.classList.toggle('notes-visible', notesState.visible);
    if (els.notesVisibilityToggle) {
        els.notesVisibilityToggle.checked = notesState.visible;
    }
};

const loadNotesVisibility = () => {
    const stored = localStorage.getItem('notesVisible');
    setNotesVisible(stored !== '0');
};

const setNoteColor = (color) => {
    if (!color || typeof color !== 'string') return;
    document.documentElement.style.setProperty('--note-color', color);
    try { localStorage.setItem('noteColor', color); } catch (_) { }
    notesState.defaultColor = color;
    if (els.notesColorPicker) {
        try { els.notesColorPicker.value = color; } catch (_) { }
    }
    // Update selected swatch indicator
    document.querySelectorAll('.color-swatch').forEach((b) => {
        b.setAttribute('aria-selected', (b.dataset.swatch || '').toLowerCase() === color.toLowerCase() ? 'true' : 'false');
    });
};

const loadNoteColor = () => {
    const stored = localStorage.getItem('noteColor');
    if (stored) {
        setNoteColor(stored);
        return;
    }
    // If not stored, prefer CSS var, otherwise force default yellow
    const current = (getComputedStyle(document.documentElement).getPropertyValue('--note-color') || '').trim();
    if (current) {
        setNoteColor(current);
    } else {
        setNoteColor(notesState.defaultColor || '#fde047');
    }
};

// Tooltip size
const setTooltipSizePx = (px) => {
    const size = Math.max(10, Math.min(28, Number(px) || 14));
    notesState.tooltipSizePx = size;
    try { localStorage.setItem('notesTooltipSizePx', String(size)); } catch (_) { }
    if (els.notesTooltipSize) els.notesTooltipSize.value = String(size);
    // Re-apply tooltips for current text block to reflect new size
    if (notesState.sidebar && notesState.sidebar.textBlock && notesState.sidebar.filePath) {
        applyNotesToTextBlock(notesState.sidebar.textBlock, notesState.sidebar.filePath);
    }
};
const loadTooltipSizePx = () => {
    const stored = parseInt(localStorage.getItem('notesTooltipSizePx'), 10);
    if (Number.isFinite(stored)) {
        setTooltipSizePx(stored);
    } else {
        setTooltipSizePx(14);
    }
};

// ---- TTS helpers ----
const populateTtsVoices = () => {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    notesState.tts.voices = voices;
    if (els.notesTtsLang) {
        const current = els.notesTtsLang.value;
        const langs = Array.from(new Set(voices.map(v => v.lang))).sort();
        // Keep existing first option(s), then add langs
        // Clear dynamic options
        while (els.notesTtsLang.options.length > 1) els.notesTtsLang.remove(1);
        langs.forEach((lang) => {
            const opt = document.createElement('option');
            opt.value = lang;
            opt.textContent = lang;
            els.notesTtsLang.appendChild(opt);
        });
        // Restore saved selection
        const saved = localStorage.getItem('notesTtsLang') || 'auto';
        els.notesTtsLang.value = saved;
        notesState.tts.defaultLang = saved;
    }
};

const initTts = () => {
    try { populateTtsVoices(); } catch (_) { }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = populateTtsVoices;
    }
};

const setDefaultTtsLang = (lang) => {
    notesState.tts.defaultLang = lang || 'auto';
    try { localStorage.setItem('notesTtsLang', notesState.tts.defaultLang); } catch (_) { }
};

const speakText = (text, langOverride) => {
    if (!text) return;
    if (!('speechSynthesis' in window)) { showToast('TTS not supported in this browser.', 'error'); return; }
    const utter = new SpeechSynthesisUtterance(text);
    const lang = langOverride || notesState.tts.defaultLang;
    if (lang && lang !== 'auto') {
        utter.lang = lang;
        const voice = notesState.tts.voices.find(v => v.lang === lang) || notesState.tts.voices.find(v => v.lang && v.lang.startsWith(lang.split('-')[0]));
        if (voice) utter.voice = voice;
    }
    try { window.speechSynthesis.cancel(); } catch (_) { }
    try { window.speechSynthesis.speak(utter); } catch (e) { console.error(e); }
};

const walkTextNodes = (root) => {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
        if (n.nodeValue && n.nodeValue.length) {
            nodes.push(n);
        }
    }
    return nodes;
};

const getCharIndexOfNodeOffset = (root, node, offset) => {
    // Count characters across all text nodes within root until reaching node/offset
    let index = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let current;
    while ((current = walker.nextNode())) {
        if (current === node) {
            return index + Math.min(offset, current.nodeValue.length);
        }
        index += current.nodeValue.length;
    }
    return index;
};

const buildRangeFromCharSpan = (root, start, end) => {
    const range = document.createRange();
    const textNodes = walkTextNodes(root);
    let acc = 0;
    let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
    for (const tn of textNodes) {
        const len = tn.nodeValue.length;
        if (startNode === null && acc + len >= start) {
            startNode = tn;
            startOffset = start - acc;
        }
        if (acc + len >= end) {
            endNode = tn;
            endOffset = end - acc;
            break;
        }
        acc += len;
    }
    if (!startNode || !endNode) return null;
    range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.nodeValue.length)));
    range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.nodeValue.length)));
    return range;
};

const applyHighlightStyle = (el, color, hidden) => {
    if (hidden) {
        el.style.backgroundImage = 'none';
        el.dataset.hidden = '1';
        return;
    }
    el.dataset.hidden = '';
    const c = color || notesState.defaultColor || getComputedStyle(document.documentElement).getPropertyValue('--note-color').trim() || '#fde047';
    el.style.backgroundImage = `linear-gradient(transparent 60%, ${c} 60%)`;
};

const wrapCharRangeInBlock = (textBlock, start, end, note) => {
    const range = buildRangeFromCharSpan(textBlock, start, end);
    if (!range) return null;
    const wrapper = document.createElement('span');
    wrapper.className = 'note-annot';
    wrapper.dataset.noteId = note.id;
    applyHighlightStyle(wrapper, note.color, note.hidden);
    try {
        const frag = range.extractContents();
        wrapper.appendChild(frag);
        range.insertNode(wrapper);
    } catch (e) {
        return null;
    }
    return wrapper;
};

const fetchNotes = async (filePath) => {
    try {
        const data = await apiRequest(`/api/notes?filePath=${encodeURIComponent(filePath)}`);
        notesState.byFile.set(filePath, Array.isArray(data) ? data : []);
        return notesState.byFile.get(filePath);
    } catch (err) {
        console.error(err);
        return [];
    }
};

const applyNotesToTextBlock = async (textBlock, filePath) => {
    const notes = notesState.byFile.has(filePath)
        ? notesState.byFile.get(filePath)
        : await fetchNotes(filePath);
    if (!Array.isArray(notes)) return;
    // Clean any existing wrappers (re-colorize textBlock to reset)
    // Rebuild content to avoid nested wraps
    const original = textBlock.dataset.originalText || textBlock.textContent;
    if (!textBlock.dataset.originalText) {
        textBlock.dataset.originalText = original;
    }
    colorizePunctuationInto(textBlock, textBlock.dataset.originalText);
    applyLanguageStyling(textBlock, textBlock.classList.contains('rtl') ? 'ar' : '');
    // Apply notes
    notes.filter((n) => n && typeof n.charStart === 'number' && typeof n.charEnd === 'number')
        .forEach((n) => {
            const el = wrapCharRangeInBlock(textBlock, n.charStart, n.charEnd, n);
            if (el) {
                attachNoteTooltip(el, n);
                // Click to edit (only if no selection)
                el.addEventListener('click', (ev) => {
                    const sel = window.getSelection && window.getSelection();
                    if (sel && sel.toString().trim().length > 0) return;
                    ev.stopPropagation();
                    openNotesSidebarForEdit(textBlock, filePath, n);
                });
            }
        });
};

const renderNotesList = (filePath) => {
    if (!els.notesList) return;
    let notes = [...(notesState.byFile.get(filePath) || [])];
    const q = (notesState.searchQuery || '').toLowerCase().trim();
    if (q) {
        notes = notes.filter((n) =>
            String(n.text || '').toLowerCase().includes(q) ||
            String(n.quote || '').toLowerCase().includes(q)
        );
    }
    notes.sort((a, b) => {
        const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return notesState.sortOrder === 'old' ? tA - tB : tB - tA;
    });
    els.notesList.innerHTML = '';
    notes.forEach((n) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        const quote = document.createElement('div');
        quote.className = 'note-item__quote';
        quote.textContent = n.quote || '';
        const text = document.createElement('div');
        text.className = 'note-item__text';
        text.textContent = n.text || '';
        const meta = document.createElement('div');
        meta.style.cssText = 'display:flex;gap:8px;align-items:center;color:var(--text-muted);font-size:0.8rem;margin-top:6px;';
        const time = document.createElement('span');
        time.textContent = formatRelativeTime(n.updatedAt || n.createdAt);
        meta.appendChild(time);
        const actions = document.createElement('div');
        actions.className = 'note-item__actions';
        const speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'ghost small';
        speakBtn.textContent = 'Speak';
        speakBtn.addEventListener('click', (ev) => { ev.stopPropagation(); speakText(n.text || n.quote || ''); });
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'ghost small';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            if (notesState.sidebar.textBlock) {
                openNotesSidebarForEdit(notesState.sidebar.textBlock, filePath, n);
            }
        });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ghost danger small';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async () => {
            try {
                await apiRequest(`/api/notes/${encodeURIComponent(n.id)}`, { method: 'DELETE' });
                const arr = notesState.byFile.get(filePath) || [];
                notesState.byFile.set(filePath, arr.filter((x) => x.id !== n.id));
                if (notesState.sidebar.textBlock) await applyNotesToTextBlock(notesState.sidebar.textBlock, filePath);
                renderNotesList(filePath);
                showToast('Note deleted.');
            } catch (err) {
                showToast(String(err.message || err), 'error');
            }
        });
        actions.append(speakBtn, editBtn, delBtn);
        item.append(quote, text, meta, actions);
        item.addEventListener('click', () => {
            if (notesState.sidebar.textBlock) {
                openNotesSidebarForEdit(notesState.sidebar.textBlock, filePath, n);
            }
        });
        els.notesList.appendChild(item);
    });
};

const formatRelativeTime = (iso) => {
    if (!iso) return '';
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(then).toLocaleDateString();
};

const setSidebarOpen = (open) => {
    if (!els.notesSidebar || !els.notesBackdrop) return;
    els.notesSidebar.classList.toggle('open', !!open);
    els.notesBackdrop.classList.toggle('open', !!open);
};

const openNotesSidebar = (filePath, textBlock) => {
    notesState.sidebar.filePath = filePath;
    notesState.sidebar.textBlock = textBlock;
    notesState.sidebar.mode = 'list';
    notesState.sidebar.note = null;
    notesState.sidebar.range = null;
    els.notesContext.textContent = `For: ${formatFolderLabel((filePath.split('/').slice(0, -1).join('/'))) || 'Root'} / ${filePath.split('/').pop()}`;
    els.notesCreate.style.display = 'none';
    els.notesEdit.style.display = 'none';
    setSidebarOpen(true);
    renderNotesList(filePath);
};

// Attach Tippy.js tooltip for a note
const attachNoteTooltip = (anchorEl, note) => {
    if (!window.tippy) return; // graceful fallback
    const makeContent = () => {
        const wrapper = document.createElement('div');
        wrapper.style.maxWidth = '520px';
        wrapper.style.direction = note && note.dir === 'rtl' ? 'rtl' : 'ltr';
        // Apply user-configured tooltip text size (separate from text size)
        try {
            const px = notesState.tooltipSizePx || 14;
            wrapper.style.fontSize = `${px}px`;
            wrapper.style.lineHeight = '1.5';
        } catch (_) { }
        const text = note && note.text ? String(note.text) : '';
        if (window.marked && typeof marked.parse === 'function') {
            wrapper.innerHTML = marked.parse(text);
        } else {
            wrapper.innerHTML = text.replace(/\n/g, '<br>');
        }
        return wrapper;
    };
    try { if (anchorEl._tippy) anchorEl._tippy.destroy(); } catch (_) { }
    tippy(anchorEl, {
        content: makeContent(),
        allowHTML: true,
        interactive: true,
        appendTo: () => document.body,
        theme: 'notes',
        placement: 'top',
        arrow: true,
        maxWidth: 520,
        delay: [80, 0],
    });
};

const getSelectionCharRange = (textBlock, range) => {
    const start = getCharIndexOfNodeOffset(textBlock, range.startContainer, range.startOffset);
    const end = getCharIndexOfNodeOffset(textBlock, range.endContainer, range.endOffset);
    const selText = range.toString();
    return { start, end, quote: selText };
};

const openNotesSidebarForSelection = (textBlock, range) => {
    const filePath = textBlock.dataset.filePath;
    if (!filePath) return;
    const { start, end, quote } = getSelectionCharRange(textBlock, range);
    openNotesSidebar(filePath, textBlock);
    notesState.sidebar.mode = 'create';
    notesState.sidebar.range = { start, end, quote };
    els.notesCreateQuote.textContent = quote;
    els.notesCreateText.value = '';
    els.notesCreateSave.disabled = true;
    // Default direction RTL for new notes
    if (els.notesCreateDir) {
        els.notesCreateDir.value = 'rtl';
    }
    if (els.notesCreateText) {
        try { els.notesCreateText.style.direction = 'rtl'; els.notesCreateText.style.textAlign = 'right'; } catch (_) { }
    }
    els.notesCreate.style.display = '';
    els.notesEdit.style.display = 'none';
    setTimeout(() => { try { els.notesCreateText.focus(); } catch (_) { } }, 0);
};

const openNotesSidebarForEdit = (textBlock, filePath, note) => {
    openNotesSidebar(filePath, textBlock);
    notesState.sidebar.mode = 'edit';
    notesState.sidebar.note = note;
    els.notesEditQuote.textContent = note.quote || '';
    els.notesEditText.value = note.text || '';
    els.notesEditHidden.checked = !!note.hidden;
    if (els.notesEditColor) {
        try { els.notesEditColor.value = (note.color || notesState.defaultColor || '#fde047'); } catch (_) { }
    }
    if (els.notesEditDir) {
        const dirVal = note.dir === 'rtl' ? 'rtl' : note.dir === 'ltr' ? 'ltr' : 'auto';
        els.notesEditDir.value = dirVal;
    }
    els.notesCreate.style.display = 'none';
    els.notesEdit.style.display = '';
    els.notesEditSave.disabled = true;
    setTimeout(() => { try { els.notesEditText.focus(); } catch (_) { } }, 0);
    // Try to bring the note into view
    try {
        const target = textBlock.querySelector(`.note-annot[data-note-id="${CSS && CSS.escape ? CSS.escape(note.id) : note.id}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) { }
};

const setBulkProcessing = (value) => {
    bulkProcessing = value;
    [els.bulkMoveBtn, els.bulkDeleteBtn, els.bulkClearBtn].forEach((btn) => {
        if (btn) {
            btn.disabled = value;
        }
    });
};

const debounce = (fn, delay = 400) => {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
};

const patchNote = async (noteId, body) => {
    const ctx = notesState.sidebar;
    if (!ctx || !ctx.filePath || !noteId) return;
    try {
        const updated = await apiRequest(`/api/notes/${encodeURIComponent(noteId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const arr = notesState.byFile.get(ctx.filePath) || [];
        const i = arr.findIndex((n) => n.id === updated.id);
        if (i !== -1) arr[i] = updated; else arr.push(updated);
        notesState.byFile.set(ctx.filePath, arr);
        await applyNotesToTextBlock(ctx.textBlock, ctx.filePath);
        renderNotesList(ctx.filePath);
    } catch (err) {
        console.error(err);
        showToast(String(err.message || err), 'error');
    }
};

const updateBulkActions = () => {
    const count = state.selectedAudios.size;
    if (!count) {
        els.bulkBar.classList.add('hidden');
        els.bulkCount.textContent = '';
        return;
    }
    els.bulkBar.classList.remove('hidden');
    els.bulkCount.textContent = `${count} selected audio${count === 1 ? '' : 's'}`;
};

const toggleSelection = (filePath, shouldSelect) => {
    if (shouldSelect) {
        state.selectedAudios.add(filePath);
    } else {
        state.selectedAudios.delete(filePath);
    }
    updateBulkActions();
};

const clearSelection = (options = {}) => {
    if (!state.selectedAudios.size) return;
    state.selectedAudios = new Set();
    updateBulkActions();
    if (!options.silent) {
        renderAudios();
    }
};

const copyFolderPath = async (path) => {
    const value = formatFolderPath(path);
    try {
        await navigator.clipboard.writeText(value);
        showToast('Folder path copied.');
    } catch (error) {
        console.error(error);
        showToast('Unable to copy folder path.', 'error');
    }
};

const renderFolderNavigation = () => {
    els.folderNav.innerHTML = '';

    const createRootRow = (label, target, badge, copyPathValue) => {
        const row = document.createElement('div');
        row.className = 'folder-row';
        row.style.paddingLeft = '12px';

        const spacer = document.createElement('span');
        spacer.className = 'folder-toggle';
        spacer.textContent = '•';
        spacer.disabled = true;
        row.appendChild(spacer);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'folder-button';
        button.dataset.target = target;
        button.innerHTML = `<span>${label}</span><span class="badge">${badge}</span>`;
        // Show full label on hover
        try { button.title = label; } catch (_) { }
        button.addEventListener('click', () => setActiveView(target));
        row.appendChild(button);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'folder-copy';
        copyBtn.innerHTML = '⧉';
        copyBtn.disabled = copyPathValue === null;
        copyBtn.title = 'Copy folder path';
        copyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (copyPathValue !== null) {
                copyFolderPath(copyPathValue);
            }
        });
        row.appendChild(copyBtn);

        return row;
    };

    els.folderNav.appendChild(createRootRow('All audio', VIEW_ALL, state.counts.total, null));
    els.folderNav.appendChild(createRootRow('Unsorted', VIEW_ROOT, state.counts.root, ''));

    if (!state.foldersTree.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Create folders to organize your audio library.';
        empty.style.fontSize = '0.85rem';
        empty.style.marginTop = '12px';
        els.folderNav.appendChild(empty);
        highlightActiveView();
        return;
    }

    const renderNodes = (nodes, depth = 0) => {
        const fragment = document.createDocumentFragment();
        nodes.forEach((node) => {
            const row = document.createElement('div');
            row.className = 'folder-row';
            row.style.paddingLeft = `${Math.max(depth, 0) * 18 + 12}px`;

            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = state.expandedFolders.has(node.path);

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'folder-toggle';
            toggle.textContent = hasChildren ? (isExpanded ? '▾' : '▸') : '•';
            toggle.disabled = !hasChildren;
            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!hasChildren) return;
                if (isExpanded) {
                    state.expandedFolders.delete(node.path);
                } else {
                    state.expandedFolders.add(node.path);
                }
                renderFolderNavigation();
                highlightActiveView();
            });

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'folder-button';
            button.dataset.target = node.path;
            button.innerHTML = `<span>${node.name}</span><span class="badge">${node.audioCount || 0}</span>`;
            try { button.title = node.path || node.name; } catch (_) { }
            button.addEventListener('click', () => setActiveView(node.path));

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'folder-copy';
            copyBtn.innerHTML = '⧉';
            copyBtn.title = 'Copy folder path';
            copyBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                copyFolderPath(node.path);
            });

            row.append(toggle, button, copyBtn);
            fragment.appendChild(row);

            if (hasChildren && isExpanded) {
                fragment.appendChild(renderNodes(node.children, depth + 1));
            }
        });
        return fragment;
    };

    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'folder-tree';
    treeWrapper.appendChild(renderNodes(state.foldersTree));
    els.folderNav.appendChild(treeWrapper);

    highlightActiveView();
};

const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) {
        return '--:--';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const stopPlayback = (options = {}) => {
    const { pause = true } = options;
    if (playback.player && pause) {
        try {
            playback.player.pause();
        } catch (_) {
            // Ignore pause errors
        }
    }
    if (playback.raf) {
        cancelAnimationFrame(playback.raf);
        playback.raf = null;
    }
    playback.player = null;
    playback.audioData = null;
    playback.filePath = null;
    if (playerUI.container) {
        playerUI.container.classList.add('hidden');
    }
    if (playerUI.progress) {
        playerUI.progress.value = 0;
        playerUI.progress.max = 0;
    }
    if (playerUI.current) {
        playerUI.current.textContent = '0:00';
    }
    if (playerUI.duration) {
        playerUI.duration.textContent = '0:00';
    }
    if (playerUI.toggle) {
        playerUI.toggle.textContent = '▶';
    }
};

const updatePlayerUI = () => {
    if (!playback.player || !playback.audioData) {
        stopPlayback({ pause: false });
        return;
    }

    playerUI.container.classList.remove('hidden');
    playerUI.title.textContent = playback.audioData.title || 'Untitled audio';
    playerUI.context.textContent = formatFolderLabel(playback.audioData.folder || '');

    const duration = playback.player.duration;
    playerUI.progress.max = Number.isFinite(duration) ? duration : 0;
    playerUI.progress.value = playback.player.currentTime || 0;
    playerUI.current.textContent = formatTime(playback.player.currentTime || 0);
    playerUI.duration.textContent = formatTime(duration);
    playerUI.toggle.textContent = playback.player.paused ? '▶' : '⏸';
};

const startProgressLoop = () => {
    if (playback.raf) {
        cancelAnimationFrame(playback.raf);
    }

    const step = () => {
        if (!playback.player) {
            return;
        }
        updatePlayerUI();
        playback.raf = requestAnimationFrame(step);
    };

    playback.raf = requestAnimationFrame(step);
};

const bindAudioPlayer = (audioData, playerEl) => {
    playerEl.dataset.filePath = audioData.filePath;

    playerEl.addEventListener('play', () => {
        if (playback.player && playback.player !== playerEl) {
            playback.player.pause();
        }
        playback.player = playerEl;
        playback.audioData = audioData;
        playback.filePath = audioData.filePath;
        try { playerEl.playbackRate = playerSpeed; } catch (_) { }
        updatePlayerUI();
        startProgressLoop();
    });

    playerEl.addEventListener('pause', () => {
        if (playback.player === playerEl) {
            updatePlayerUI();
        }
    });

    playerEl.addEventListener('ended', () => {
        if (playback.player === playerEl) {
            updatePlayerUI();
        }
    });

    playerEl.addEventListener('loadedmetadata', () => {
        if (playback.player === playerEl) {
            try { playerEl.playbackRate = playerSpeed; } catch (_) { }
            updatePlayerUI();
        }
    });
};

playerUI.toggle.addEventListener('click', () => {
    if (!playback.player) return;
    if (playback.player.paused) {
        playback.player.play().catch((error) => {
            console.error(error);
            showToast('Unable to resume playback.', 'error');
        });
    } else {
        playback.player.pause();
    }
});

playerUI.progress.addEventListener('input', (event) => {
    if (!playback.player) return;
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
        playback.player.currentTime = value;
        updatePlayerUI();
    }
});

const renderAudios = () => {
    stopPlayback();
    els.audioList.innerHTML = '';

    const menuItems = [];

    if (!state.audios.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = state.currentView === VIEW_ALL
            ? 'No audio files yet. Generate one to get started!'
            : 'No audio files in this folder yet.';
        els.audioList.appendChild(empty);
        updateHeaderState();
        updateBulkActions();
        return;
    }

    state.audios.forEach((audio) => {
        const card = document.createElement('article');
        card.className = 'audio-card';
        const fileKey = audio.filePath;
        const anchorId = `audio-${hashId(fileKey)}`;
        card.id = anchorId;
        const selected = state.selectedAudios.has(fileKey);
        if (selected) {
            card.classList.add('is-selected');
        }

        const headerRow = document.createElement('div');
        headerRow.className = 'audio-card__header-row';

        const selector = document.createElement('label');
        selector.className = 'audio-select';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selected;
        checkbox.addEventListener('change', (event) => {
            toggleSelection(fileKey, event.target.checked);
            card.classList.toggle('is-selected', event.target.checked);
        });
        const selectorText = document.createElement('span');
        selectorText.textContent = 'Select';
        selector.append(checkbox, selectorText);

        const meta = document.createElement('div');
        meta.className = 'audio-card__meta';
        const createdAt = audio.createdAt ? new Date(audio.createdAt).toLocaleString() : 'Unknown date';
        meta.innerHTML = `
          <span class="pill primary">${audio.language.toUpperCase()}</span>
          <span class="pill">${audio.voice}</span>
          ${audio.folder ? `<span class="pill">${formatFolderLabel(audio.folder)}</span>` : ''}
          <span>${createdAt}</span>
        `;

        headerRow.append(selector, meta);

        const title = document.createElement('h4');
        title.className = 'audio-title';
        title.textContent = audio.title || 'Untitled audio';

        const textBlock = document.createElement('p');
        textBlock.className = 'audio-text';
        textBlock.dataset.filePath = audio.filePath;
        textBlock.dataset.originalText = audio.text || '';
        colorizePunctuationInto(textBlock, audio.text || '(No transcript available)');
        applyLanguageStyling(textBlock, audio.language);
        // Load and apply notes highlights for this audio
        applyNotesToTextBlock(textBlock, audio.filePath);

        const player = document.createElement('audio');
        player.controls = true;
        player.src = audio.filePath;
        bindAudioPlayer(audio, player);

        const actions = document.createElement('div');
        actions.className = 'audio-actions';

        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.textContent = 'Rename';
        renameButton.addEventListener('click', () => handleRenameAudio(audio));

        const timestampButton = document.createElement('button');
        timestampButton.type = 'button';
        timestampButton.textContent = 'View timestamps';
        timestampButton.addEventListener('click', () => {
            const url = new URL('/timestamps.html', window.location.origin);
            url.searchParams.set('filePath', audio.filePath);
            window.location.href = url.toString();
        });

        const copyLinkButton = document.createElement('button');
        copyLinkButton.type = 'button';
        copyLinkButton.textContent = 'Copy stream link';
        copyLinkButton.addEventListener('click', async () => {
            try {
                const obsLink = `${window.location.origin}/obs_stream.html?filePath=${encodeURIComponent(audio.filePath)}`;
                await navigator.clipboard.writeText(obsLink);
                showToast('OBS stream link copied.');
            } catch (error) {
                console.error(error);
                showToast('Unable to copy link.', 'error');
            }
        });

        const moveButton = document.createElement('button');
        moveButton.type = 'button';
        moveButton.textContent = 'Move audio';
        moveButton.addEventListener('click', async () => {
            const defaultValue = audio.folder || '';
            const target = prompt('Move audio to folder (leave blank for root):', defaultValue);
            if (target === null) return;
            try {
                await apiRequest('/api/audio/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: audio.filePath, targetFolder: target })
                });
                showToast('Audio moved successfully.');
                state.selectedAudios.delete(audio.filePath);
                await loadFolders();
                await loadAudios();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete audio';
        deleteButton.classList.add('danger');
        deleteButton.addEventListener('click', async () => {
            const confirmed = confirm('Delete this audio file? This cannot be undone.');
            if (!confirmed) return;
            try {
                await apiRequest(`/api/audios?filePath=${encodeURIComponent(audio.filePath)}`, {
                    method: 'DELETE'
                });
                showToast('Audio deleted.');
                state.selectedAudios.delete(audio.filePath);
                await loadFolders();
                await loadAudios();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        // actions.append(renameButton, timestampButton, copyLinkButton, moveButton, deleteButton);
        actions.append(renameButton, moveButton, deleteButton);

        // Place controls (player + actions) above the transcript text for better UX
        const controls = document.createElement('div');
        controls.className = 'audio-controls';
        controls.append(player, actions);

        card.append(headerRow, title, controls, textBlock);
        els.audioList.appendChild(card);

        const label = (audio.title && audio.title.trim())
            ? audio.title.trim()
            : (audio.text ? (audio.text.trim().slice(0, 48) + (audio.text.trim().length > 48 ? '…' : '')) : 'Untitled');
        menuItems.push({ anchorId, title: label, lang: audio.language || 'en' });
    });

    updateHeaderState();
    updateBulkActions();
    renderFloatingMenu(menuItems);
};

const loadFolders = async () => {
    try {
        const data = await apiRequest('/api/folders');
        state.foldersTree = data.folders || [];
        state.flatFolders = flattenFolders(state.foldersTree);
        state.counts.total = data.totalAudios || 0;
        state.counts.root = data.rootAudioCount || 0;

        const paths = collectPaths(state.foldersTree, []);
        if (!state.expandedFolders.size) {
            state.expandedFolders = new Set(paths);
        } else {
            const preserved = new Set();
            paths.forEach((path) => {
                if (state.expandedFolders.has(path)) {
                    preserved.add(path);
                }
            });
            state.expandedFolders = preserved;
        }

        if (state.currentView !== VIEW_ALL && state.currentView !== VIEW_ROOT) {
            if (!paths.includes(state.currentView)) {
                state.currentView = VIEW_ALL;
                clearSelection({ silent: true });
            }
        }

        renderFolderNavigation();
        updateFolderSelect();
        updateGeneratorTarget();
        updateHeaderState();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
};

const loadAudios = async () => {
    try {
        let url = '/api/audios';
        if (state.currentView === VIEW_ROOT) {
            url += '?folder=';
        } else if (state.currentView !== VIEW_ALL) {
            url += `?folder=${encodeURIComponent(state.currentView)}`;
        }
        const data = await apiRequest(url);
        state.audios = Array.isArray(data) ? data : [];
        renderAudios();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
};

const setActiveView = async (target) => {
    if (state.currentView === target) {
        return;
    }
    state.currentView = target;
    try { localStorage.setItem('currentView', target); } catch (_) { }
    clearSelection({ silent: true });
    highlightActiveView();
    updateGeneratorTarget();
    updateFolderSelect();
    updateHeaderState();
    await loadAudios();
};

const handleCreateFolder = async () => {
    const base = state.currentView !== VIEW_ALL && state.currentView !== VIEW_ROOT
        ? `${state.currentView}/`
        : '';
    const folderName = prompt('Create folder (nested paths allowed):', base);
    if (!folderName) return;
    try {
        await apiRequest('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: folderName })
        });
        showToast('Folder created.');
        await loadFolders();
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const handleMoveFolder = async () => {
    if (state.currentView === VIEW_ALL || state.currentView === VIEW_ROOT) return;
    const destination = prompt('Move folder to (new absolute path):', state.currentView);
    if (!destination || destination === state.currentView) return;
    try {
        await apiRequest('/api/folders/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: state.currentView, to: destination })
        });
        showToast('Folder moved.');
        state.currentView = destination;
        await loadFolders();
        await loadAudios();
        highlightActiveView();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const handleDeleteFolder = async () => {
    if (state.currentView === VIEW_ALL || state.currentView === VIEW_ROOT) return;
    const confirmed = confirm('Delete this folder and all audio inside it? This cannot be undone.');
    if (!confirmed) return;
    try {
        await apiRequest(`/api/folders?folder=${encodeURIComponent(state.currentView)}`, {
            method: 'DELETE'
        });
        showToast('Folder deleted.');
        state.currentView = VIEW_ALL;
        clearSelection({ silent: true });
        await loadFolders();
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const setGenerating = (isGenerating) => {
    if (isGenerating) {
        els.generateButton.disabled = true;
        els.generateButton.textContent = 'Generating…';
    } else {
        els.generateButton.disabled = false;
        els.generateButton.textContent = 'Generate Audio';
    }
};

const handleGenerate = async (event) => {
    event.preventDefault();
    setGenerating(true);

    const payload = {
        text: els.form.text.value.trim(),
        language: els.form.language.value,
        voice: els.form.voice.value,
        instructions: els.form.instructions.value.trim(),
        folder: els.folderSelect.value,
        title: els.audioNameInput.value.trim()
    };

    if (!payload.text) {
        showToast('Text is required to generate audio.', 'error');
        setGenerating(false);
        return;
    }

    try {
        await apiRequest('/api/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast('Audio generated successfully.');
        els.form.text.value = '';
        els.form.instructions.value = '';
        els.audioNameInput.value = '';
        try { localStorage.removeItem('draftText'); } catch (_) { }
        await loadFolders();
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setGenerating(false);
    }
};

const handleBulkMove = async () => {
    if (bulkProcessing || !state.selectedAudios.size) return;
    const defaultValue = state.currentView === VIEW_ALL
        ? ''
        : state.currentView === VIEW_ROOT
            ? ''
            : state.currentView;
    const target = prompt('Move selected audio to folder (leave blank for root):', defaultValue);
    if (target === null) return;

    const selection = Array.from(state.selectedAudios);
    setBulkProcessing(true);
    try {
        for (const filePath of selection) {
            await apiRequest('/api/audio/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, targetFolder: target })
            });
        }
        showToast('Selected audio moved.');
        clearSelection({ silent: true });
        await loadFolders();
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setBulkProcessing(false);
        updateBulkActions();
    }
};

const handleBulkDelete = async () => {
    if (bulkProcessing || !state.selectedAudios.size) return;
    const selection = Array.from(state.selectedAudios);
    const confirmed = confirm(`Delete ${selection.length} selected audio file${selection.length === 1 ? '' : 's'}? This cannot be undone.`);
    if (!confirmed) return;

    setBulkProcessing(true);
    try {
        for (const filePath of selection) {
            await apiRequest(`/api/audios?filePath=${encodeURIComponent(filePath)}`, {
                method: 'DELETE'
            });
        }
        showToast('Selected audio deleted.');
        clearSelection({ silent: true });
        await loadFolders();
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setBulkProcessing(false);
        updateBulkActions();
    }
};

const handleRenameAudio = async (audio) => {
    const defaultName = audio.title || '';
    const newTitle = prompt('Rename audio:', defaultName);
    if (newTitle === null) return;
    if (!newTitle.trim()) {
        showToast('Audio name cannot be empty.', 'error');
        return;
    }
    try {
        await apiRequest('/api/audios', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: audio.filePath, title: newTitle })
        });
        showToast('Audio renamed.');
        await loadAudios();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const handleCopyCurrentPath = () => {
    if (state.currentView === VIEW_ALL) {
        showToast('Select a folder to copy its path.', 'error');
        return;
    }
    const value = state.currentView === VIEW_ROOT ? '' : state.currentView;
    copyFolderPath(value);
};

const init = async () => {
    // Restore last active view and input draft
    const savedView = localStorage.getItem('currentView');
    if (savedView) {
        state.currentView = savedView;
    }

    const savedDraft = localStorage.getItem('draftText');
    if (savedDraft && typeof savedDraft === 'string') {
        try { els.form.text.value = savedDraft; } catch (_) { }
    }
    // Speed
    loadSpeed();

    // Theme
    applyTheme(getPreferredTheme());

    // Restore zoom and sidebar state
    loadZoom();
    // Notes/Annotations UI
    initNotesUI();

    const sidebarHiddenStored = localStorage.getItem('sidebarHidden');
    if (sidebarHiddenStored === '1') {
        setSidebarHidden(true);
    } else {
        setSidebarHidden(false);
    }

    els.newFolderBtn.addEventListener('click', handleCreateFolder);
    els.moveFolderBtn.addEventListener('click', handleMoveFolder);
    els.deleteFolderBtn.addEventListener('click', handleDeleteFolder);
    els.copyPathBtn.addEventListener('click', handleCopyCurrentPath);
    els.form.addEventListener('submit', handleGenerate);
    // Persist draft text while typing
    if (els.form && els.form.text) {
        els.form.text.addEventListener('input', (e) => {
            try { localStorage.setItem('draftText', e.target.value); } catch (_) { }
        });
    }
    els.bulkMoveBtn.addEventListener('click', handleBulkMove);
    els.bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    els.bulkClearBtn.addEventListener('click', () => clearSelection());

    // Sidebar toggle
    if (els.toggleSidebarBtn) {
        els.toggleSidebarBtn.addEventListener('click', () => {
            const hidden = els.appShell.classList.contains('sidebar-hidden');
            setSidebarHidden(!hidden);
        });
    }

    if (els.themeToggleBtn) {
        els.themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    // Fullscreen
    if (els.fullscreenToggleBtn) {
        els.fullscreenToggleBtn.addEventListener('click', toggleFullscreen);
        ['fullscreenchange','webkitfullscreenchange','msfullscreenchange'].forEach(ev => document.addEventListener(ev, updateFullscreenUI));
        updateFullscreenUI();
    }

    // Cancelled: auto-hide left sidebar at bottom (user requested header behavior instead)

    // Zoom controls
    if (els.zoomInBtn) {
        els.zoomInBtn.addEventListener('click', () => setZoom(textZoom + ZOOM_STEP));
    }
    if (els.zoomOutBtn) {
        els.zoomOutBtn.addEventListener('click', () => setZoom(textZoom - ZOOM_STEP));
    }

    // Speed control
    if (playerUI.speed) {
        playerUI.speed.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            if (Number.isFinite(value)) {
                playerSpeed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
                localStorage.setItem('playerSpeed', String(playerSpeed));
                if (playback.player) {
                    try { playback.player.playbackRate = playerSpeed; } catch (_) { }
                }
            }
        });
    }

    // Seek controls (±10s)
    const seekBy = (delta) => {
        if (!playback.player) return;
        try {
            const dur = isFinite(playback.player.duration) ? playback.player.duration : 0;
            const target = Math.max(0, Math.min(dur || 0, (playback.player.currentTime || 0) + delta));
            playback.player.currentTime = target;
            // Update UI immediately
            if (playerUI.progress) playerUI.progress.value = target;
            if (playerUI.current) playerUI.current.textContent = formatTime(target);
        } catch (_) { }
    };
    if (playerUI.rewind) {
        playerUI.rewind.addEventListener('click', () => seekBy(-10));
    }
    if (playerUI.forward) {
        playerUI.forward.addEventListener('click', () => seekBy(10));
    }

    // Floating menu interactions (for touch/click)
    if (els.floatingToggle && els.floatingMenu) {
        els.floatingToggle.setAttribute('aria-expanded', 'false');
        els.floatingToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !els.floatingMenu.classList.contains('open');
            els.floatingMenu.classList.toggle('open', willOpen);
            els.floatingToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        // Hover behavior: open when hovering toggle, keep open while hovering panel,
        // close when leaving the whole floating-menu unless it's click-open.
        els.floatingToggle.addEventListener('mouseenter', () => {
            els.floatingMenu.classList.add('hover-open');
            els.floatingToggle.setAttribute('aria-expanded', 'true');
        });
        els.floatingMenu.addEventListener('mouseleave', () => {
            els.floatingMenu.classList.remove('hover-open');
            if (!els.floatingMenu.classList.contains('open')) {
                els.floatingToggle.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('click', (e) => {
            if (!els.floatingMenu.contains(e.target)) {
                els.floatingMenu.classList.remove('open');
                els.floatingMenu.classList.remove('hover-open');
                els.floatingToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (els.floatingList) {
        els.floatingList.addEventListener('click', (e) => {
            const item = e.target.closest('.floating-item');
            if (!item) return;
            const anchorId = item.dataset.anchorId;
            const card = document.getElementById(anchorId);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const audioEl = card.querySelector('audio');
                if (audioEl) {
                    audioEl.play().catch(() => { });
                }
            }
        });
    }

    // Notes Sidebar controls
    loadNotesVisibility();
    if (els.notesVisibilityToggle) {
        els.notesVisibilityToggle.addEventListener('change', (e) => setNotesVisible(!!e.target.checked));
    }
    loadNoteColor();
    if (els.notesColorPicker) {
        els.notesColorPicker.addEventListener('input', (e) => setNoteColor(e.target.value));
    }
    const palette = document.querySelector('.color-swatches');
      if (palette) {
        palette.addEventListener('click', (e) => {
          const btn = e.target.closest('.color-swatch');
          if (!btn) return;
          const c = btn.dataset.swatch;
          if (c) setNoteColor(c);
        });
      }
      // Load tooltip size and wire control
      loadTooltipSizePx();
      if (els.notesTooltipSize) {
        els.notesTooltipSize.addEventListener('change', () => setTooltipSizePx(els.notesTooltipSize.value));
      }
    // TTS init + events
    initTts();
    if (els.notesTtsLang) {
        const saved = localStorage.getItem('notesTtsLang');
        if (saved) { els.notesTtsLang.value = saved; notesState.tts.defaultLang = saved; }
        els.notesTtsLang.addEventListener('change', () => setDefaultTtsLang(els.notesTtsLang.value));
    }
    if (els.notesCloseBtn) {
        els.notesCloseBtn.addEventListener('click', () => setSidebarOpen(false));
    }
    if (els.notesBackdrop) {
        els.notesBackdrop.addEventListener('click', () => setSidebarOpen(false));
    }
    if (els.notesCreateCancel) {
        els.notesCreateCancel.addEventListener('click', () => {
            els.notesCreate.style.display = 'none';
            els.notesEdit.style.display = 'none';
            notesState.sidebar.mode = 'list';
        });
    }
    if (els.notesCreateDir && els.notesCreateText) {
        els.notesCreateDir.addEventListener('change', () => {
            const val = els.notesCreateDir.value;
            if (val === 'rtl') {
                els.notesCreateText.style.direction = 'rtl';
                els.notesCreateText.style.textAlign = 'right';
            } else if (val === 'ltr') {
                els.notesCreateText.style.direction = 'ltr';
                els.notesCreateText.style.textAlign = 'left';
            } else {
                els.notesCreateText.style.direction = '';
                els.notesCreateText.style.textAlign = '';
            }
        });
    }
    // AI analyze in create mode
    if (els.notesCreateAiLang) {
        const saved = localStorage.getItem('notesAiLang') || 'ar';
        els.notesCreateAiLang.value = saved;
        els.notesCreateAiLang.addEventListener('change', () => localStorage.setItem('notesAiLang', els.notesCreateAiLang.value));
    }
    if (els.notesCreateAi) {
        els.notesCreateAi.addEventListener('click', async () => {
            const quote = (els.notesCreateQuote && els.notesCreateQuote.textContent) ? els.notesCreateQuote.textContent.trim() : '';
            if (!quote) { showToast('No selected text to analyze.', 'error'); return; }
            const code = (els.notesCreateAiLang && els.notesCreateAiLang.value) || 'ar';
            const aiLangLabels = { ar: 'Arabic', en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese' };
            const langName = aiLangLabels[code] || code;
            // const template = `${quote}\n----------\nAnalyze and translate it.\nthe answer should be in ${langName} language.`;
            const template = `${quote}\n----------\nAnalyze linguistically the above text and translate it.\nthe answer should be in ${langName} language. don't explain it historically or culturally. just analyze and translate.`;
            try {
                const data = await apiRequest('/api/ai-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: template, selectedText: '' })
                });
                const text = (data && data.note) ? data.note.trim() : '';
                if (text && els.notesCreateText) {
                    els.notesCreateText.value = text;
                    if (els.notesCreateSave) els.notesCreateSave.disabled = false;
                    showToast('AI analysis loaded.');
                } else {
                    showToast('AI returned no content.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast(String(err.message || err), 'error');
            }
        });
    }
    if (els.notesCreateSpeak) {
        els.notesCreateSpeak.addEventListener('click', () => {
            speakText(els.notesCreateQuote.textContent || '');
        });
    }
    if (els.notesCreateSave) {
        els.notesCreateSave.addEventListener('click', async () => {
            const ctx = notesState.sidebar;
            if (!ctx || !ctx.filePath || !ctx.range) return;
            try {
                const payload = {
                    filePath: ctx.filePath,
                    charStart: ctx.range.start,
                    charEnd: ctx.range.end,
                    text: els.notesCreateText.value || '',
                    quote: ctx.range.quote || '',
                    color: notesState.defaultColor,
                    dir: (els.notesCreateDir && els.notesCreateDir.value !== 'auto') ? els.notesCreateDir.value : undefined
                };
                const note = await apiRequest('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                // Update local cache
                const arr = notesState.byFile.get(ctx.filePath) || [];
                arr.push(note);
                notesState.byFile.set(ctx.filePath, arr);
                // Apply to block and refresh list
                await applyNotesToTextBlock(ctx.textBlock, ctx.filePath);
                renderNotesList(ctx.filePath);
                els.notesCreate.style.display = 'none';
                showToast('Note added.');
                // pulse new highlight
                try {
                    const target = ctx.textBlock.querySelector(`.note-annot[data-note-id="${CSS && CSS.escape ? CSS.escape(note.id) : note.id}"]`);
                    if (target) {
                        target.animate([{ boxShadow: '0 0 0 0 rgba(56,189,248,0.6)' }, { boxShadow: '0 0 0 8px rgba(56,189,248,0)' }], { duration: 600, easing: 'ease-out' });
                    }
                } catch (_) { }
            } catch (error) {
                showToast(String(error.message || error), 'error');
            }
        });
    }
    if (els.notesEditSave) {
        els.notesEditSave.addEventListener('click', async () => {
            const ctx = notesState.sidebar;
            if (!ctx || !ctx.filePath || !ctx.note) return;
            try {
                const updated = await apiRequest(`/api/notes/${encodeURIComponent(ctx.note.id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: els.notesEditText.value || '',
                        hidden: !!els.notesEditHidden.checked,
                        color: (els.notesEditColor && els.notesEditColor.value) || undefined,
                        dir: (els.notesEditDir && els.notesEditDir.value !== 'auto') ? els.notesEditDir.value : undefined
                    })
                });
                // Update cache
                const arr = notesState.byFile.get(ctx.filePath) || [];
                const i = arr.findIndex((n) => n.id === updated.id);
                if (i !== -1) arr[i] = updated;
                notesState.byFile.set(ctx.filePath, arr);
                await applyNotesToTextBlock(ctx.textBlock, ctx.filePath);
                renderNotesList(ctx.filePath);
                showToast('Note updated.');
                els.notesEditSave.disabled = true;
            } catch (error) {
                showToast(String(error.message || error), 'error');
            }
        });
    }
    if (els.notesEditDelete) {
        els.notesEditDelete.addEventListener('click', async () => {
            const ctx = notesState.sidebar;
            if (!ctx || !ctx.filePath || !ctx.note) return;
            try {
                await apiRequest(`/api/notes/${encodeURIComponent(ctx.note.id)}`, { method: 'DELETE' });
                const arr = notesState.byFile.get(ctx.filePath) || [];
                notesState.byFile.set(ctx.filePath, arr.filter((n) => n.id !== ctx.note.id));
                await applyNotesToTextBlock(ctx.textBlock, ctx.filePath);
                renderNotesList(ctx.filePath);
                els.notesEdit.style.display = 'none';
                showToast('Note deleted.');
            } catch (error) {
                showToast(String(error.message || error), 'error');
            }
        });
    }
    // AI quick analyze/translate from edit view
    const aiLangLabels = { ar: 'Arabic', en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese' };
    if (els.notesAiLang) {
        const savedAiLang = localStorage.getItem('notesAiLang') || 'ar';
        els.notesAiLang.value = savedAiLang;
        els.notesAiLang.addEventListener('change', () => {
            localStorage.setItem('notesAiLang', els.notesAiLang.value);
        });
    }
    if (els.notesEditAi) {
        els.notesEditAi.addEventListener('click', async () => {
            const quote = (els.notesEditQuote && els.notesEditQuote.textContent) ? els.notesEditQuote.textContent.trim() : '';
            if (!quote) { showToast('No quoted text to analyze.', 'error'); return; }
            const code = (els.notesAiLang && els.notesAiLang.value) || 'ar';
            const langName = aiLangLabels[code] || code;
            const template = `${quote}\n----------\nAnalyze linguistically the above text and translate it.\nthe answer should be in ${langName} language. don't explain it historically or culturally. just analyze and translate.`;
            try {
                const data = await apiRequest('/api/ai-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: template, selectedText: '' })
                });
                const text = (data && data.note) ? data.note.trim() : '';
                if (text && els.notesEditText) {
                    els.notesEditText.value = text;
                    if (els.notesEditSave) els.notesEditSave.disabled = false;
                    showToast('AI analysis loaded.');
                } else {
                    showToast('AI returned no content.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast(String(err.message || err), 'error');
            }
        });
    }
    if (els.notesEditSpeakQuote) {
        els.notesEditSpeakQuote.addEventListener('click', () => speakText(els.notesEditQuote.textContent || ''));
    }
    if (els.notesEditSpeakText) {
        els.notesEditSpeakText.addEventListener('click', () => speakText(els.notesEditText.value || ''));
    }

    if (els.notesEditColor) {
        const previewAndSaveColor = debounce(() => {
            const ctx = notesState.sidebar;
            if (!ctx || !ctx.textBlock || !ctx.note) return;
            try {
                const target = ctx.textBlock.querySelector(`.note-annot[data-note-id="${CSS && CSS.escape ? CSS.escape(ctx.note.id) : ctx.note.id}"]`);
                if (target) applyHighlightStyle(target, els.notesEditColor.value, !!els.notesEditHidden.checked);
            } catch (_) { }
            patchNote(notesState.sidebar.note.id, { color: els.notesEditColor.value });
            if (els.notesEditSave) els.notesEditSave.disabled = false;
        }, 200);
        els.notesEditColor.addEventListener('input', previewAndSaveColor);
    }
    if (els.notesEditSwatches) {
        els.notesEditSwatches.addEventListener('click', (e) => {
            const btn = e.target.closest('.color-swatch');
            if (!btn) return;
            const c = btn.dataset.swatch;
            if (!c) return;
            if (els.notesEditColor) els.notesEditColor.value = c;
            const evt = new Event('input');
            els.notesEditColor.dispatchEvent(evt);
            if (els.notesEditSave) els.notesEditSave.disabled = false;
        });
    }

    if (els.notesEditDir) {
        els.notesEditDir.addEventListener('change', () => {
            const val = els.notesEditDir.value;
            patchNote(notesState.sidebar.note.id, { dir: val === 'auto' ? undefined : val });
            if (els.notesEditSave) els.notesEditSave.disabled = false;
        });
    }
    if (els.notesEditHidden) {
        els.notesEditHidden.addEventListener('change', () => {
            const hidden = !!els.notesEditHidden.checked;
            const ctx = notesState.sidebar;
            if (ctx && ctx.textBlock && ctx.note) {
                try {
                    const target = ctx.textBlock.querySelector(`.note-annot[data-note-id="${CSS && CSS.escape ? CSS.escape(ctx.note.id) : ctx.note.id}"]`);
                    if (target) applyHighlightStyle(target, els.notesEditColor ? els.notesEditColor.value : undefined, hidden);
                } catch (_) { }
            }
            patchNote(notesState.sidebar.note.id, { hidden });
            if (els.notesEditSave) els.notesEditSave.disabled = false;
        });
    }

    // Show header only at top; hide at bottom.
    // When shown, auto-hide after 3s if not hovered.
    let headerHideTimer = null;
    const isHoveringHeader = () => !!(els.layoutHeader && els.layoutHeader.matches(':hover'));
    const hideHeader = () => {
        if (!els.layoutHeader) return;
        if (isHoveringHeader()) return; // don't hide while hovering
        els.layoutHeader.classList.add('is-hidden');
    };
    const scheduleHideHeader = (delayMs = 3000) => {
        clearTimeout(headerHideTimer);
        headerHideTimer = setTimeout(hideHeader, delayMs);
    };
    const showHeader = () => {
        if (!els.layoutHeader) return;
        els.layoutHeader.classList.remove('is-hidden');
        scheduleHideHeader(3000);
    };
    const pinHeaderAtTop = () => {
        // Keep header visible without auto-hide while at top
        clearTimeout(headerHideTimer);
        if (!els.layoutHeader) return;
        els.layoutHeader.classList.remove('is-hidden');
    };

    if (els.layoutHeader) {
        els.layoutHeader.addEventListener('mouseenter', () => {
            clearTimeout(headerHideTimer);
            els.layoutHeader.classList.remove('is-hidden');
        });
        els.layoutHeader.addEventListener('mouseleave', () => scheduleHideHeader(3000));
    }
    // Show header when scrolling upwards; hide at very bottom.
    let lastScrollForHeader = window.scrollY || document.documentElement.scrollTop || 0;
    window.addEventListener('scroll', () => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const doc = document.documentElement;
        const docHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
        const winBottom = y + window.innerHeight;
        const nearBottom = (docHeight - winBottom) <= 24; // px from bottom
        const nearTop = y <= 16; // px from top
        const delta = y - lastScrollForHeader; // positive = down, negative = up
        lastScrollForHeader = y;

        if (nearBottom) {
            clearTimeout(headerHideTimer);
            hideHeader();
            return;
        }

        if (nearTop) {
            // While at the very top region, keep header pinned (no auto-hide)
            pinHeaderAtTop();
            return;
        }

        // If user scrolls up by more than a small threshold, reveal header
        if (delta < -8) {
            showHeader(); // schedules auto-hide in 3s
        }
        // Scrolling down does not immediately hide; auto-hide timer will handle it
    }, { passive: true });
    // Initial state based on current scroll position
    const initY = window.scrollY || document.documentElement.scrollTop || 0;
    if (initY <= 16) {
        pinHeaderAtTop();
    } else {
        hideHeader();
    }

    await loadFolders();
    await loadAudios();

    // Keyboard shortcuts within sidebar
    document.addEventListener('keydown', (e) => {
        if (!els.notesSidebar.classList.contains('open')) return;
        if (e.key === 'Escape') {
            setSidebarOpen(false);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            if (notesState.sidebar.mode === 'create' && !els.notesCreateSave.disabled) {
                els.notesCreateSave.click();
            } else if (notesState.sidebar.mode === 'edit' && !els.notesEditSave.disabled) {
                els.notesEditSave.click();
            }
        }
    });

    // --- AI modal wiring ---
    const getActiveSelection = () => {
        const selData = getSelectionInTextBlock();
        if (selData) return selData;
        if (notesState.sidebar && notesState.sidebar.textBlock && notesState.sidebar.range) {
            const { start, end, quote } = notesState.sidebar.range;
            const range = buildRangeFromCharSpan(notesState.sidebar.textBlock, start, end);
            if (range) return { range, textBlock: notesState.sidebar.textBlock };
            return { range: null, textBlock: notesState.sidebar.textBlock, quote };
        }
        return null;
    };

    const openAiModal = () => {
        if (!aiEls.modal) return;
        const sel = getActiveSelection();
        const quote = sel?.range ? sel.range.toString() : (sel?.quote || '');
        aiEls.selected.textContent = quote || '(no text selected)';
        if (aiEls.prompt) { aiEls.prompt.value = ''; }
        aiEls.response.textContent = '';
        aiEls.status.textContent = '';
        aiEls.loadNote.disabled = true;
        aiEls.modal.classList.add('open');
        setTimeout(() => { try { aiEls.prompt.focus(); } catch (_) { } }, 0);
    };

    const closeAiModal = () => { if (aiEls.modal) aiEls.modal.classList.remove('open'); };
    if (aiEls.openBtn) aiEls.openBtn.addEventListener('click', openAiModal);
    if (aiEls.close) aiEls.close.addEventListener('click', closeAiModal);
    if (aiEls.cancel) aiEls.cancel.addEventListener('click', closeAiModal);
    if (aiEls.modal) {
        aiEls.modal.addEventListener('click', (e) => { if (e.target.classList.contains('ai-backdrop')) closeAiModal(); });
    }
    if (aiEls.templates) {
        aiEls.templates.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-template]');
            if (!btn) return;
            const selText = aiEls.selected.textContent || '';
            const template = btn.getAttribute('data-template') || '';
            let filled = template.replace(/\$selected_text/gi, selText);
            // Convert literal \n sequences into new lines
            filled = filled.replace(/\\n/g, '\n');
            aiEls.prompt.value = filled;
            aiEls.prompt.focus();
        });
    }
    if (aiEls.ask) {
        aiEls.ask.addEventListener('click', async () => {
            const selText = aiEls.selected.textContent || '';
            const prompt = (aiEls.prompt.value || '').trim();
            if (!prompt) { aiEls.status.textContent = 'Enter a prompt first.'; return; }
            aiEls.status.textContent = 'Thinking…';
            aiEls.response.textContent = '';
            aiEls.loadNote.disabled = true;
            try {
                const payload = { prompt, selectedText: selText };
                const data = await apiRequest('/api/ai-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                aiEls.response.textContent = data.note || '';
                aiEls.status.textContent = 'Done';
                aiEls.loadNote.disabled = !(data.note && data.note.trim());
            } catch (err) {
                aiEls.status.textContent = String(err.message || err);
            }
        });
    }
    if (aiEls.loadNote) {
        aiEls.loadNote.addEventListener('click', () => {
            const content = (aiEls.response.textContent || '').trim();
            if (!content) return;
            const sel = getActiveSelection();
            if (!sel || (!sel.range && !notesState.sidebar.range)) {
                showToast('Select text first to attach a note.', 'error');
                return;
            }
            const range = sel.range || buildRangeFromCharSpan(notesState.sidebar.textBlock, notesState.sidebar.range.start, notesState.sidebar.range.end);
            if (!range) { showToast('Could not find selection.', 'error'); return; }
            openNotesSidebarForSelection(sel.textBlock, range);
            els.notesCreateText.value = content;
            els.notesCreateSave.disabled = content.trim().length === 0;
            closeAiModal();
            showToast('AI note loaded. You can edit before saving.');
        });
    }
};

init();
