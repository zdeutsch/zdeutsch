// Reusable Notes Sidebar module
(function(){
  const Notes = {};
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    sidebar: null, backdrop: null,
    colorPicker: null, visibilityToggle: null, tooltipSize: null, ttsLang: null,
    context: null,
    search: null, sort: null,
    // create
    create: null, createQuote: null, createText: null, createSave: null, createCancel: null, createDir: null, createSpeak: null, createAi: null, createAiLang: null, createAiStatus: null,
    // edit
    edit: null, editQuote: null, editText: null, editSave: null, editDelete: null, editHidden: null, editColor: null, editDir: null, editJump: null, editCopy: null, editSpeak: null, editAiStatus: null,
    list: null,
    // modal
    aiModal: null, aiBackdrop: null, aiClose: null, aiCancel: null, aiOpen: null, aiAsk: null, aiPrompt: null, aiSelected: null, aiResponse: null, aiStatus: null, aiLoad: null, aiTemplates: null,
  };

  const LS = {
    visible: 'notesVisible',
    color: 'noteColor',
    tooltip: 'notesTooltipSizePx',
    tts: 'notesTtsLang',
    aiLang: 'notesAiLang',
    dirDefault: 'notesDirDefault',
  };

  const state = {
    filePath: null,
    textBlock: null,
    notes: [],
    selection: null,
    tooltipSizePx: 14,
    defaultColor: '#fde047',
    visible: true,
    voices: [],
  };

  function cacheEls(){
    els.sidebar = qs('#notes-sidebar');
    els.backdrop = qs('#notes-backdrop');
    els.colorPicker = qs('#notes-color-picker');
    els.visibilityToggle = qs('#notes-visibility-toggle');
    els.tooltipSize = qs('#notes-tooltip-size');
    els.ttsLang = qs('#notes-tts-lang');
    els.context = qs('#notes-context');
    els.search = qs('#notes-search');
    els.sort = qs('#notes-sort');
    els.create = qs('#notes-create');
    els.createQuote = qs('#notes-create-quote');
    els.createText = qs('#notes-create-text');
    els.createSave = qs('#notes-create-save');
    els.createCancel = qs('#notes-create-cancel');
    els.createDir = qs('#notes-create-dir');
    els.createSpeak = qs('#notes-create-speak');
    els.createAi = qs('#notes-create-ai');
    els.createAiLang = qs('#notes-create-ai-lang');
    els.createAiStatus = qs('#notes-create-ai-status');
    els.edit = qs('#notes-edit');
    els.editQuote = qs('#notes-edit-quote');
    els.editText = qs('#notes-edit-text');
    els.editSave = qs('#notes-edit-save');
    els.editDelete = qs('#notes-edit-delete');
    els.editHidden = qs('#notes-edit-hidden');
    els.editColor = qs('#notes-edit-color');
    els.editDir = qs('#notes-edit-dir');
    els.editAi = qs('#notes-edit-ai');
    els.editJump = qs('#notes-edit-jump');
    els.editCopy = qs('#notes-edit-copy');
    els.editSpeak = qs('#notes-edit-speak');
    els.editAiStatus = qs('#notes-edit-ai-status');
    els.list = qs('#notes-list');
    // AI modal
    els.aiModal = qs('#ai-modal');
    els.aiBackdrop = els.aiModal ? els.aiModal.querySelector('.ai-backdrop') : null;
    els.aiClose = qs('#ai-close');
    els.aiCancel = qs('#ai-cancel');
    els.aiOpen = qs('#ai-assist-open');
    els.aiAsk = qs('#ai-ask');
    els.aiPrompt = qs('#ai-prompt');
    els.aiSelected = qs('#ai-selected');
    els.aiResponse = qs('#ai-response');
    els.aiStatus = qs('#ai-status');
    els.aiLoad = qs('#ai-load-note');
    els.aiTemplates = qs('#ai-templates');
  }

  const speakText = (text, lang) => {
    if (!text) return;
    if (!('speechSynthesis' in window)) return;
    const u=new SpeechSynthesisUtterance(text);
    if (lang && lang !== 'auto') u.lang = lang;
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(_){}
  };

  // ----- Direction helpers (create/edit) -----
  function applyTextareaDir(target, dirVal){
    if (!target) return;
    if (dirVal === 'rtl') {
      try { target.style.direction = 'rtl'; target.style.textAlign = 'right'; } catch(_){}
    } else if (dirVal === 'ltr') {
      try { target.style.direction = 'ltr'; target.style.textAlign = 'left'; } catch(_){}
    } else {
      try { target.style.direction = ''; target.style.textAlign = ''; } catch(_){}
    }
  }

  const walkTextNodes = (root) => { const nodes=[]; const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null); let n; while((n=w.nextNode())){ if(n.nodeValue && n.nodeValue.length) nodes.push(n);} return nodes; };
  const charIndexFromNodeOffset = (root, node, offset) => { let idx=0; const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null); let cur; while((cur=w.nextNode())){ if(cur===node) return idx + Math.min(offset, cur.nodeValue.length); idx += cur.nodeValue.length; } return idx; };
  const buildRangeFromSpan = (start, end) => { const nodes = walkTextNodes(state.textBlock); let acc=0, sN=null, sO=0, eN=null, eO=0; for(const tn of nodes){ const len = tn.nodeValue.length; if(sN===null && acc+len>=start){ sN=tn; sO=start-acc; } if(acc+len>=end){ eN=tn; eO=end-acc; break; } acc += len; } if(!sN||!eN) return null; const r=document.createRange(); r.setStart(sN, Math.max(0, Math.min(sO, sN.nodeValue.length))); r.setEnd(eN, Math.max(0, Math.min(eO, eN.nodeValue.length))); return r; };

  const clearHighlights = () => { if (!state.textBlock) return; const spans = state.textBlock.querySelectorAll('span.note-annot'); spans.forEach(s => { const parent=s.parentNode; while(s.firstChild) parent.insertBefore(s.firstChild, s); parent.removeChild(s); }); };
  const applyHighlightStyle = (el, color, hidden) => {
    if (hidden) { el.style.backgroundImage = 'none'; el.dataset.hidden = '1'; return; }
    el.dataset.hidden = '';
    const c = color || state.defaultColor;
    el.style.backgroundImage = `linear-gradient(transparent 60%, ${c} 60%)`;
  };

  // Attach Tippy tooltip to a note annotation using the same style as Text‑Insight
  function attachNoteTooltip(anchorEl, note){
    if (!window.tippy || !anchorEl) return;
    const makeContent = () => {
      const wrapper = document.createElement('div');
      wrapper.style.maxWidth = '520px';
      try {
        const px = state.tooltipSizePx || parseInt(localStorage.getItem(LS.tooltip), 10) || 14;
        wrapper.style.fontSize = `${px}px`;
        wrapper.style.lineHeight = '1.5';
      } catch(_){}
      if (note && note.dir === 'rtl') wrapper.style.direction = 'rtl';
      const text = (note && note.text) ? String(note.text) : ((note && note.quote) ? String(note.quote) : '');
      if (window.marked && typeof marked.parse === 'function') {
        wrapper.innerHTML = marked.parse(text);
      } else {
        wrapper.innerHTML = text.replace(/\n/g, '<br>');
      }
      return wrapper;
    };
    try { if (anchorEl._tippy) anchorEl._tippy.destroy(); } catch(_){}
    try {
      window.tippy(anchorEl, {
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
    } catch(_){}
  }
  const wrapCharRange = (start, end, note) => { const r=buildRangeFromSpan(start,end); if(!r) return null; const w=document.createElement('span'); w.className='note-annot'; w.dataset.noteId = note.id; applyHighlightStyle(w, note.color, note.hidden); try{ const frag=r.extractContents(); w.appendChild(frag); r.insertNode(w);}catch(_){} return w; };

  async function fetchNotes(){
    if (!state.filePath) { state.notes = []; return []; }
    try { const arr = await window.Services.getNotes(state.filePath); state.notes = Array.isArray(arr)?arr:[]; return state.notes; } catch(_) { state.notes=[]; return []; }
  }
  function renderNotes(){
    if (!els.list) return;
    els.list.innerHTML = '';
    const q = (els.search && els.search.value || '').toLowerCase();
    let arr = [...state.notes];
    if (q) arr = arr.filter(n => String(n.text||'').toLowerCase().includes(q) || String(n.quote||'').toLowerCase().includes(q));
    const sortOrder = (els.sort && els.sort.value) || 'new';
    arr.sort((a,b)=>{
      const tA = new Date(a.updatedAt||a.createdAt||0).getTime();
      const tB = new Date(b.updatedAt||b.createdAt||0).getTime();
      return sortOrder==='old' ? tA - tB : tB - tA;
    });
    if (!arr.length) {
      const div=document.createElement('div'); div.className='empty-state'; div.textContent='No notes yet'; els.list.appendChild(div); return;
    }
    arr.forEach(n=>{
      const item=document.createElement('div'); item.className='note-item';
      const qDiv=document.createElement('div'); qDiv.className='note-item__quote'; qDiv.textContent = n.quote || '';
      const tDiv=document.createElement('div'); tDiv.className='note-item__text'; tDiv.textContent = n.text || '';
      const actions=document.createElement('div'); actions.className='note-item__actions';
      const speakBtn=document.createElement('button'); speakBtn.className='ghost small'; speakBtn.textContent='Speak'; speakBtn.addEventListener('click',()=> speakText(n.text||n.quote||'', els.ttsLang && els.ttsLang.value));
      const editBtn=document.createElement('button'); editBtn.className='ghost small'; editBtn.textContent='Edit'; editBtn.addEventListener('click',()=> openEdit(n));
      const delBtn=document.createElement('button'); delBtn.className='ghost danger small'; delBtn.textContent='Delete'; delBtn.addEventListener('click',()=> removeNote(n));
      actions.appendChild(speakBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);
      item.appendChild(qDiv); item.appendChild(tDiv); item.appendChild(actions);
      els.list.appendChild(item);
    });
  }
  function isStepTwoActive(){
    try {
      const s2 = document.getElementById('sp-step-2');
      if (!s2) return false;
      // speaking.js toggles style.display directly
      const disp = s2.style && s2.style.display;
      if (disp) return disp !== 'none';
      const cs = window.getComputedStyle ? getComputedStyle(s2) : null;
      return cs ? cs.display !== 'none' : false;
    } catch(_) { return false; }
  }

  function applyNotes(){
    clearHighlights();
    state.notes.forEach(n=>{
      const el = wrapCharRange(n.charStart, n.charEnd, n);
      if (!el) return;
      // Attach tooltip
      attachNoteTooltip(el, n);
      // Normalize pointer behavior
      try { el.style.pointerEvents = ''; } catch(_){}
      // Reset any previous inline handler to avoid stacking
      try { el.onclick = null; } catch(_){}
      // Always allow nested selection like Text Insight:
      // - If user has an active selection, do NOT open edit (let selection flow to create)
      // - If no selection, open edit for this note
      el.onclick = (ev) => {
        try { ev.stopPropagation(); } catch(_){}
        try {
          const sel = window.getSelection && window.getSelection();
          if (sel && String(sel.toString() || '').trim().length > 0) {
            try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}
            return false;
          }
        } catch(_){}
        openEdit(n);
        return false;
      };
    });
  }

  function setSidebarOpen(open){ if (!els.sidebar || !els.backdrop) return; els.sidebar.classList.toggle('open', !!open); els.backdrop.classList.toggle('open', !!open); }
  function formatContext(){ if (!els.context) return; const count = state.notes.length; els.context.textContent = state.filePath ? `${count} notes • ${state.filePath}` : 'No file loaded'; }

  function getSelectionInBlock(){ const sel = window.getSelection(); if(!sel||sel.rangeCount===0) return null; const range = sel.getRangeAt(0); if(!state.textBlock.contains(range.commonAncestorContainer)) return null; const start = charIndexFromNodeOffset(state.textBlock, range.startContainer, range.startOffset); const end = charIndexFromNodeOffset(state.textBlock, range.endContainer, range.endOffset); const text = range.toString(); if (!text.trim()) return null; return { start, end, text, range }; }

  async function openCreateFromSelection(){
    const s=getSelectionInBlock();
    if (!s) { setSidebarOpen(true); return; }
    state.selection = s;
    if (els.createQuote) els.createQuote.textContent = s.text;
    if (els.createText) {
      els.createText.value='';
      // Default new note direction to persisted preference (default RTL)
      const defDir = (()=>{ try { return localStorage.getItem(LS.dirDefault) || 'rtl'; } catch(_) { return 'rtl'; } })();
      if (els.createDir) { try { els.createDir.value = defDir; } catch(_){} }
      applyTextareaDir(els.createText, (els.createDir && els.createDir.value) || defDir);
      try { els.createText.focus(); } catch(_){}
    }
    if (els.create) els.create.style.display='';
    if (els.edit) els.edit.style.display='none';
    setSidebarOpen(true);
  }
  function openEdit(note){
    if (!note) return;
    if (els.editQuote) els.editQuote.textContent = note.quote || '';
    if (els.editText){
      els.editText.value = note.text || '';
      // reflect direction selection to textarea on open
      const dirVal = (note.dir || 'auto');
      if (els.editDir) { try { els.editDir.value = dirVal; } catch(_){} }
      applyTextareaDir(els.editText, dirVal);
      setTimeout(()=>{ try{ els.editText.focus(); }catch(_){ } },0);
    }
    // Color editor
    if (els.editColor) {
      try { els.editColor.value = note.color || state.defaultColor || '#fde047'; } catch(_){}
      els.editColor.oninput = async () => {
        const val = els.editColor.value;
        try {
          const updated = await window.Services.updateNote(note.id, { color: val });
          const i = state.notes.findIndex(n=> n.id===updated.id);
          if (i!==-1) state.notes[i]=updated;
          applyNotes(); renderNotes();
        } catch(_){}
      };
    }
    const swHost = document.getElementById('notes-edit-swatches');
    if (swHost && !swHost.dataset.colorWired) {
      swHost.dataset.colorWired = '1';
      swHost.addEventListener('click', (e) => {
        const btn = e.target.closest('.color-swatch');
        if (!btn) return;
        const c = btn.dataset.swatch;
        if (!c) return;
        if (els.editColor) {
          els.editColor.value = c;
          const ev = new Event('input');
          els.editColor.dispatchEvent(ev);
        }
      });
    }
    if (els.edit) els.edit.style.display='';
    if (els.create) els.create.style.display='none';
    setSidebarOpen(true);
    els.editSave.disabled = true;
    if (els.editText) els.editText.addEventListener('input', ()=> { els.editSave.disabled = (els.editText.value||'').trim().length===0; }, { once: true });
    if (els.editSave) els.editSave.onclick = async ()=>{
      try{
        const body={ text: (els.editText.value||'').trim(), dir: (els.editDir && els.editDir.value !== 'auto') ? els.editDir.value : undefined };
        const updated = await window.Services.updateNote(note.id, body);
        const i = state.notes.findIndex(n=> n.id===updated.id);
        if (i!==-1) state.notes[i]=updated;
        applyNotes(); renderNotes(); setSidebarOpen(false);
      }catch(err){ alert(String(err.message||err)); }
    };
    if (els.editDelete) els.editDelete.onclick = () => removeNote(note);
    if (els.editCopy) els.editCopy.onclick = ()=> { navigator.clipboard.writeText(note.quote||'').catch(()=>{}); };
    if (els.editJump) els.editJump.onclick = ()=>{ const el = state.textBlock && state.textBlock.querySelector(`.note-annot[data-note-id="${note.id}"]`); if (el) el.scrollIntoView({ behavior:'smooth', block:'center' }); };
    if (els.editSpeak) els.editSpeak.onclick = ()=> speakText(note.quote||'', els.ttsLang && els.ttsLang.value);
  }
  async function removeNote(note){ if (!note || !confirm('Delete this note?')) return; try { await window.Services.deleteNote(note.id); state.notes = state.notes.filter(n=> n.id!==note.id); applyNotes(); renderNotes(); } catch(err){ alert(String(err.message||err)); } }

  function persistSettings(){
    try { localStorage.setItem(LS.visible, state.visible ? '1' : '0'); } catch(_){}
    try { localStorage.setItem(LS.color, state.defaultColor || '#fde047'); } catch(_){}
    try { localStorage.setItem(LS.tooltip, String(state.tooltipSizePx)); } catch(_){}
    if (els.ttsLang) { try { localStorage.setItem(LS.tts, els.ttsLang.value || 'auto'); } catch(_){} }
  }

  function loadSettings(){
    try { state.visible = (localStorage.getItem(LS.visible) !== '0'); } catch(_){}
    try { const c = localStorage.getItem(LS.color); if (c) state.defaultColor = c; } catch(_){}
    try { const t = parseInt(localStorage.getItem(LS.tooltip),10); if (Number.isFinite(t)) state.tooltipSizePx = t; } catch(_){}
    if (els.ttsLang) { try { const v = localStorage.getItem(LS.tts) || 'auto'; els.ttsLang.value = v; } catch(_){} }
    // AI language default
    try {
      const savedAi = localStorage.getItem(LS.aiLang) || 'ar';
      if (els.createAiLang) { try { els.createAiLang.value = savedAi; } catch(_){} }
      const editAiLangEl = qs('#notes-ai-lang');
      if (editAiLangEl) { try { editAiLangEl.value = savedAi; } catch(_){} }
    } catch(_){}
    // Default direction
    try {
      const defDir = localStorage.getItem(LS.dirDefault) || 'rtl';
      if (els.createDir) { try { els.createDir.value = defDir; } catch(_){} }
      if (els.createText) applyTextareaDir(els.createText, defDir);
    } catch(_){}
    // reflect to UI
    document.documentElement.classList.toggle('notes-hidden', !state.visible);
    if (els.visibilityToggle) els.visibilityToggle.checked = state.visible;
    if (els.colorPicker) try{ els.colorPicker.value = state.defaultColor; }catch(_){ }
    if (els.tooltipSize) try{ els.tooltipSize.value = String(state.tooltipSizePx); }catch(_){ }
  }

  function wireBasics(){
    const closeBtn = qs('#notes-close-btn'); if (closeBtn) closeBtn.addEventListener('click', ()=> setSidebarOpen(false));
    if (els.backdrop) els.backdrop.addEventListener('click', ()=> setSidebarOpen(false));
    if (els.visibilityToggle) els.visibilityToggle.addEventListener('change', (e)=> { state.visible = !!e.target.checked; document.documentElement.classList.toggle('notes-hidden', !state.visible); persistSettings(); });
    if (els.colorPicker) els.colorPicker.addEventListener('input', (e)=> { state.defaultColor = e.target.value || '#fde047'; persistSettings(); });
    if (els.tooltipSize) els.tooltipSize.addEventListener('change', (e)=> { const v = parseInt(e.target.value,10); if (Number.isFinite(v)) { state.tooltipSizePx = v; persistSettings(); }});
    if (els.ttsLang) els.ttsLang.addEventListener('change', ()=> persistSettings());
    if (els.search) els.search.addEventListener('input', renderNotes);
    if (els.sort) els.sort.addEventListener('change', renderNotes);
    // create actions
    if (els.createCancel) els.createCancel.addEventListener('click', ()=> setSidebarOpen(false));
    if (els.createSave) els.createSave.addEventListener('click', async ()=>{
      if (!state.selection) return;
      const payload = { filePath: state.filePath, charStart: state.selection.start, charEnd: state.selection.end, text: (els.createText.value||'').trim(), quote: state.selection.text, hidden: false, color: state.defaultColor, dir: els.createDir ? (els.createDir.value||'auto'):'auto' };
      if (!payload.text) { alert('Write your note.'); return; }
      try{ const created = await window.Services.createNote(payload); state.notes.push(created); applyNotes(); renderNotes(); setSidebarOpen(false); }catch(err){ alert(String(err.message||err)); }
    });
    if (els.createText) els.createText.addEventListener('input', ()=> { els.createSave && (els.createSave.disabled = (els.createText.value||'').trim().length===0); });
    if (els.createSpeak) els.createSpeak.addEventListener('click', ()=> state.selection && speakText(state.selection.text, els.ttsLang && els.ttsLang.value));
    // Persist AI language on change (create + edit)
    if (els.createAiLang) els.createAiLang.addEventListener('change', ()=> { try { localStorage.setItem(LS.aiLang, els.createAiLang.value || 'ar'); } catch(_){} });
    const editAiLangEl = qs('#notes-ai-lang');
    if (editAiLangEl) editAiLangEl.addEventListener('change', ()=> { try { localStorage.setItem(LS.aiLang, editAiLangEl.value || 'ar'); } catch(_){} });
    // AI Analyze (shortcut) — same prompt as Text‑Insight
    const runAiAnalyze = async (mode) => {
      try {
        const btn = mode === 'create' ? els.createAi : els.editAi;
        const statusEl = mode === 'create' ? els.createAiStatus : els.editAiStatus;
        if (statusEl) statusEl.textContent = 'Thinking…';
        if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }
        const aiLang = (els.createAiLang && els.createAiLang.value) || (editAiLangEl && editAiLangEl.value) || localStorage.getItem(LS.aiLang) || 'ar';
        const aiLangLabels = { ar: 'Arabic', en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese' };
        const langName = aiLangLabels[aiLang] || aiLang;
        let quote = '';
        if (mode === 'create') { quote = (els.createQuote && els.createQuote.textContent || '').trim(); }
        else if (mode === 'edit') { const qEl = qs('#notes-edit-quote'); quote = (qEl && qEl.textContent || '').trim(); }
        if (!quote) { alert('No selected text to analyze.'); return; }
        const prompt = `${quote}\n----------\nAnalyze linguistically the above text and translate it.\nThe answer should be in ${langName} language. Don't explain it historically or culturally. Just analyze and translate.`;
        const { note } = await window.Services.aiNotes(prompt, quote);
        const text = (note || '').trim();
        if (!text) { alert('AI returned no content.'); return; }
        if (mode === 'create' && els.createText) { els.createText.value = text; if (els.createSave) els.createSave.disabled = false; }
        if (mode === 'edit') { const et = qs('#notes-edit-text'); if (et){ et.value = text; const save=qs('#notes-edit-save'); if (save) save.disabled = false; } }
        if (statusEl) statusEl.textContent = 'Done';
      } catch (err) {
        alert(String(err.message||err));
      } finally {
        const btn = mode === 'create' ? els.createAi : els.editAi;
        if (btn) { btn.disabled = false; btn.textContent = 'AI Analyze'; }
      }
    };
    if (els.createAi && !els.createAi.dataset.aiWired){ els.createAi.dataset.aiWired = '1'; els.createAi.addEventListener('click', ()=> runAiAnalyze('create')); }
    if (els.editAi && !els.editAi.dataset.aiWired){ els.editAi.dataset.aiWired = '1'; els.editAi.addEventListener('click', ()=> runAiAnalyze('edit')); }
    // create/edit dir controls
    if (els.createDir && els.createText) {
      els.createDir.addEventListener('change', ()=> { applyTextareaDir(els.createText, els.createDir.value); try { localStorage.setItem(LS.dirDefault, els.createDir.value||'rtl'); }catch(_){} });
    }
    if (els.editDir && els.editText) {
      els.editDir.addEventListener('change', ()=> { applyTextareaDir(els.editText, els.editDir.value); try { localStorage.setItem(LS.dirDefault, els.editDir.value||'rtl'); }catch(_){} });
    }
    // AI modal wiring
    const openAiModal = ()=>{
      if (!els.aiModal) return;
      const s = state.selection || getSelectionInBlock();
      els.aiSelected && (els.aiSelected.textContent = (s && s.text) || '(no text selected)');
      els.aiPrompt && (els.aiPrompt.value = '');
      els.aiResponse && (els.aiResponse.textContent = '');
      els.aiStatus && (els.aiStatus.textContent = '');
      els.aiLoad && (els.aiLoad.disabled = true);
      els.aiModal.classList.add('open');
      setTimeout(()=>{ try{ els.aiPrompt.focus(); }catch(_){ } },0);
    };
    const closeAi = ()=> { els.aiModal && els.aiModal.classList.remove('open'); };
    if (els.aiOpen) els.aiOpen.addEventListener('click', openAiModal);
    if (els.aiBackdrop) els.aiBackdrop.addEventListener('click', closeAi);
    if (els.aiClose) els.aiClose.addEventListener('click', closeAi);
    if (els.aiCancel) els.aiCancel.addEventListener('click', closeAi);
    if (els.aiTemplates) els.aiTemplates.addEventListener('click', (e)=>{ const btn = e.target.closest('[data-template]'); if(!btn) return; const selText = (els.aiSelected && els.aiSelected.textContent) || ''; let filled=(btn.getAttribute('data-template')||'').replace(/\$selected_text/gi, selText).replace(/\\n/g,'\n'); if (els.aiPrompt){ els.aiPrompt.value = filled; els.aiPrompt.focus(); } });
    if (els.aiAsk) els.aiAsk.addEventListener('click', async ()=>{
      if (!els.aiPrompt) return; const prompt = (els.aiPrompt.value||'').trim(); if (!prompt) { els.aiStatus && (els.aiStatus.textContent='Enter a prompt.'); return; }
      els.aiStatus && (els.aiStatus.textContent='Thinking…'); els.aiResponse && (els.aiResponse.textContent=''); els.aiLoad && (els.aiLoad.disabled=true);
      try{ const data = await window.Services.aiNotes(prompt, (els.aiSelected && els.aiSelected.textContent)||''); els.aiResponse && (els.aiResponse.textContent = data.note||''); els.aiStatus && (els.aiStatus.textContent='Done'); els.aiLoad && (els.aiLoad.disabled = !(data.note && data.note.trim())); } catch(err){ els.aiStatus && (els.aiStatus.textContent = String(err.message||err)); }
    });
    if (els.aiLoad) els.aiLoad.addEventListener('click', ()=>{ const content = (els.aiResponse && els.aiResponse.textContent||'').trim(); if (!content || !els.createText) return; openCreateFromSelection(); els.createText.value = content; els.createSave && (els.createSave.disabled = false); closeAi(); });
  }

  function wireTextSelection(){ if (!state.textBlock) return; state.textBlock.addEventListener('mouseup', ()=> { const s=getSelectionInBlock(); state.selection=s; if (s) openCreateFromSelection(); }); }

  async function load(filePath){ state.filePath = filePath; await fetchNotes(); applyNotes(); renderNotes(); formatContext(); }

  // ----- TTS voices handling -----
  function populateTtsOptions(){
    if (!els.ttsLang || !('speechSynthesis' in window)) return;
    const saved = (()=>{ try{ return localStorage.getItem(LS.tts)||'auto'; }catch(_){ return 'auto'; } })();
    const existing = new Set();
    // keep first option (auto), remove others
    while (els.ttsLang.options.length > 1) els.ttsLang.remove(1);
    state.voices = window.speechSynthesis.getVoices() || [];
    state.voices.forEach(v => {
      const code = v.lang || '';
      if (!code) return;
      if (existing.has(code)) return;
      existing.add(code);
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `TTS: ${code}`;
      els.ttsLang.appendChild(opt);
    });
    // restore saved
    try { els.ttsLang.value = saved; } catch(_){ }
  }

  function initTts(){
    if (!els.ttsLang || !('speechSynthesis' in window)) return;
    try {
      populateTtsOptions();
      window.speechSynthesis.onvoiceschanged = () => populateTtsOptions();
    } catch(_){}
  }

  Notes.init = async function(options){
    cacheEls();
    loadSettings();
    initTts();
    if (options && options.textBlock) { state.textBlock = (typeof options.textBlock === 'string') ? qs(options.textBlock) : options.textBlock; }
    if (options && options.filePath) state.filePath = options.filePath;
    wireBasics();
    wireTextSelection();
    if (state.filePath) await load(state.filePath);
  };
  Notes.open = () => setSidebarOpen(true);
  Notes.close = () => setSidebarOpen(false);
  Notes.setFile = async (filePath) => { await load(filePath); };

  window.Notes = Notes;
})();
