// Lightweight player bar controller (decoupled from app.js)
(function(){
  const ui = {
    bar: null, title: null, context: null,
    toggle: null, rewind: null, forward: null,
    progress: null, current: null, duration: null,
    speed: null,
  };
  let player = null;

  function q(id){ return document.getElementById(id); }
  function fmt(t){ const m=Math.floor(t/60)||0, s=Math.floor(t%60)||0; return `${m}:${s<10?'0':''}${s}`; }
  function ensureUi(){
    if (ui.bar) return;
    ui.bar = q('player-bar');
    ui.title = q('player-title');
    ui.context = q('player-context');
    ui.toggle = q('player-toggle');
    ui.rewind = q('player-rewind');
    ui.forward = q('player-forward');
    ui.progress = q('player-progress');
    ui.current = q('player-current');
    ui.duration = q('player-duration');
    ui.speed = q('player-speed');
    if (ui.toggle) ui.toggle.addEventListener('click', ()=> { if (!player) return; player.paused ? player.play().catch(()=>{}) : player.pause(); });
    if (ui.rewind) ui.rewind.addEventListener('click', ()=> { if (!player) return; player.currentTime = Math.max(0, player.currentTime-10); });
    if (ui.forward) ui.forward.addEventListener('click', ()=> { if (!player) return; const d=isFinite(player.duration)?player.duration:0; player.currentTime = Math.min(d, player.currentTime+10); });
    if (ui.progress) ui.progress.addEventListener('input', (e)=> { if (!player) return; player.currentTime = parseFloat(e.target.value)||0; });
    if (ui.speed) ui.speed.addEventListener('change', (e)=> { if (!player) return; const v=parseFloat(e.target.value)||1; try{ player.playbackRate=v; }catch(_){} });
  }

  function wire(el, meta){
    ensureUi(); if (!ui.bar) return;
    player = el;
    const title = (meta && (meta.title || meta.text)) || 'Untitled audio';
    const context = (meta && (meta.folder || meta.language || '')) || '';
    if (ui.title) ui.title.textContent = title;
    if (ui.context) ui.context.textContent = context;
    ui.bar.classList.remove('hidden');
    const sync = () => {
      if (!ui.progress) return;
      const d = isFinite(player.duration) ? player.duration : 0;
      ui.progress.max = d; ui.progress.value = player.currentTime;
      if (ui.current) ui.current.textContent = fmt(player.currentTime||0);
      if (ui.duration) ui.duration.textContent = fmt(d||0);
      if (ui.toggle) ui.toggle.textContent = player.paused ? '▶' : '⏸';
    };
    player.addEventListener('timeupdate', sync);
    player.addEventListener('loadedmetadata', sync);
    player.addEventListener('play', sync);
    player.addEventListener('pause', sync);
    player.addEventListener('ended', sync);
    try { const v=parseFloat((ui.speed && ui.speed.value) || '1'); player.playbackRate = v; } catch(_){}
    sync();
  }

  function hide(){ ensureUi(); if (ui.bar) ui.bar.classList.add('hidden'); }
  function show(){ ensureUi(); if (ui.bar) ui.bar.classList.remove('hidden'); }

  window.PlayerBar = { bind: wire, hide, show };
})();
