/* Mishi interface controller, entirely local. */
(() => {
  'use strict';
  const M=window.MishiModel, $=id=>document.getElementById(id), KEY='mishi.v1';
  if (!M) throw Error('Falta el motor de Mishi');
  let state;
  try { state=M.tick(M.deserialize(localStorage.getItem(KEY),Date.now()).state,Date.now(),{offline:true}).state; }
  catch (_) { state=M.createDefaultState(Date.now()); }
  let gameTimer=null, seconds=20, score=0, gameId=null, audio=null, lastPet=0, soundOn=false;
  const save=()=>{try {localStorage.setItem(KEY,M.serialize(state));} catch (_) { /* private storage unavailable */ }};
  function say(text){const el=$('message');if(el)el.textContent=text;}
  function sound(freq=450) {
    if (!soundOn || document.hidden) return;
    try {audio ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),g=audio.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(0.05,audio.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.16);osc.connect(g);g.connect(audio.destination);osc.start();osc.stop(audio.currentTime+0.16);}catch (_){}
  }
  function render(){
    if($('cat-name'))$('cat-name').textContent=state.name;
    if($('name') && document.activeElement!==$('name'))$('name').value=state.name;
    if($('coat')){$('coat').value=state.fur;for(const o of $('coat').options){const f=M.getFur(o.value);o.disabled=f.unlockLevel>state.level;}}
    if($('pattern')){$('pattern').value=state.pattern;for(const o of $('pattern').options){const p=M.PATTERNS.find(x=>x.id===o.value);o.disabled=p.unlockLevel>state.level;}}
    if($('reduce-motion'))$('reduce-motion').checked=state.settings.reducedMotion;
    if($('xp-fill'))$('xp-fill').style.width=Math.min(100,Math.round(state.xp/M.xpToNext(state.level)*100))+'%';
    if($('sound')){$('sound').checked=soundOn;$('sound').setAttribute('aria-checked',String(soundOn));}
    if($('level'))$('level').textContent=String(state.level);
    if($('xp'))$('xp').textContent=String(state.xp);
    for(const [id,key] of [['stat-hunger','hunger'],['stat-energy','energy'],['stat-mood','mood'],['stat-cleanliness','hygiene']]){
      const el=$(id);if(!el)continue;
      const val=Math.round(state.stats[key]);el.textContent=val+'%';el.setAttribute('aria-label',val+' de 100');
      const bar=el.closest('.stat')?.querySelector('.bar-fill');if(bar)bar.style.width=val+'%';
    }
    if($('sleep')){$('sleep').setAttribute('aria-label',state.sleeping?'Despertar a '+state.name:'Dormir a '+state.name);const label=$('sleep').querySelector('.action-label');if(label)label.textContent=state.sleeping?'Despertar':'Dormir';}
    if($('cat')){$('cat').classList.toggle('is-sleeping',state.sleeping);$('cat').classList.remove('coat-ginger','coat-cream','coat-charcoal','coat-naranja','coat-gris','coat-crema','coat-negro','coat-chocolate','coat-nieve');$('cat').classList.add('coat-'+state.fur);for(const p of M.PATTERNS)$('cat').classList.remove('pattern-'+p.id);$('cat').classList.add('pattern-'+state.pattern);$('cat').setAttribute('aria-label',state.sleeping?state.name+' está dormido. Toca para acariciar.':'Acariciar a '+state.name);}
    document.documentElement.style.setProperty('--fur',M.getFur(state.fur).base);
    document.documentElement.style.setProperty('--fur-dark',M.getFur(state.fur).dark);
    document.documentElement.style.setProperty('--fur-light',M.getFur(state.fur).light);
    document.documentElement.style.setProperty('--eye',M.getEyes(state.eyes).color);
    $('room')?.classList.toggle('is-night',state.sleeping);
    $('cat')?.classList.toggle('mood-happy',state.stats.mood>75&&!state.sleeping);
    $('cat')?.classList.toggle('mood-sad',state.stats.mood<28&&!state.sleeping);
    $('cat')?.classList.toggle('dirty-1',state.stats.hygiene<60&&state.stats.hygiene>=28);
    $('cat')?.classList.toggle('dirty-2',state.stats.hygiene<28);
    $('room')?.classList.toggle('has-food',state.stats.hunger<65);
    for(const [id,key] of [['stat-hunger','hunger'],['stat-energy','energy'],['stat-mood','mood'],['stat-cleanliness','hygiene']])$(id)?.closest('.stat')?.classList.toggle('is-low',state.stats[key]<25);
    document.documentElement.classList.toggle('reduce-motion',state.settings.reducedMotion);
  }
  const reasons={sleeping:'Está durmiendo. Despiértalo primero.',cooldown:'Espera un momento.',full:'Ya ha comido suficiente.',alreadyClean:'Ya está limpito.',notTired:'Todavía tiene mucha energía.',tired:'Necesita descansar antes de jugar.',hungry:'Necesita comer antes de jugar.',locked:'Ese pelaje se desbloquea subiendo de nivel.',gameActive:'Termina el juego primero.',empty:'Escribe un nombre.',invalid:'Esa opción no está disponible.'};
  function apply(result, message, frequency){
    if(!result.ok){say(reasons[result.reason]||'Ahora no se puede.');render();return false;}
    state=result.state;say(message);render();save();if(frequency)sound(frequency);return true;
  }
  function doAction(action){
    const now=Date.now();state=M.tick(state,now).state;
    const result=action==='sleep'?M.toggleSleep(state,now):M[action](state,now);
    const messages={feed:'¡Qué rico! Ya tiene la barriguita llena.',pet:'Ronronea. Le encanta estar contigo.',clean:'¡Pelito limpio y suave!',sleep:state.sleeping?'Ya está despierto y listo para jugar.':'A dormir. Volverá con más energía.'};
    return apply(result,messages[action],action==='pet'?320:520);
  }
  function closeGame(abort=true){if(gameTimer){clearInterval(gameTimer);gameTimer=null;}if(abort&&gameId!==null){const result=M.abortGame(state,gameId);if(result.ok){state=result.state;save();}}gameId=null;if($('game'))$('game').hidden=true;}
  function endGame(){if(gameId===null)return;const result=M.finishGame(state,gameId,score);closeGame(false);apply(result,'¡Atrapaste el juguete '+score+' veces! '+state.name+' está feliz.',660);}
  function moveTarget(){const el=$('game-target');if(!el)return;el.style.left=(12+Math.random()*66)+'%';el.style.top=(12+Math.random()*63)+'%';}
  function startGame(){
    if(gameId!==null)return;
    state=M.tick(state,Date.now()).state;
    const result=M.startGame(state);if(!result.ok){say(reasons[result.reason]||'Ahora no puede jugar.');render();return;}
    state=result.state;gameId=result.gameId;score=0;seconds=20;save();
    $('game-score').textContent='0';$('game-time').textContent='20';$('game-timer-fill').style.width='100%';$('game').hidden=false;moveTarget();
    gameTimer=setInterval(()=>{if(document.hidden)return;seconds--;if($('game-time'))$('game-time').textContent=String(seconds);if($('game-timer-fill'))$('game-timer-fill').style.width=Math.max(0,seconds*5)+'%';$('game')?.querySelector('.timer-bar')?.classList.toggle('is-hurry',seconds<=5);if(seconds<=0)endGame();},1000);
    $('game-target').focus({preventScroll:true});
  }
  for (const action of ['feed','pet','sleep','clean']) $(action)?.addEventListener('click',()=>doAction(action));
  $('cat')?.addEventListener('click',()=>{if(Date.now()-lastPet<600)return;lastPet=Date.now();if(doAction('pet')){$('cat').classList.remove('petted');void $('cat').offsetWidth;$('cat').classList.add('petted');}});
  $('play')?.addEventListener('click',startGame);
  $('game-target')?.addEventListener('click',()=>{if(gameId===null)return;score++;$('game-score').textContent=String(score);sound(610+score*20);moveTarget();});
  $('game-close')?.addEventListener('click',()=>{closeGame();say('Guardamos el juguete para otro rato.');$('play').focus();});
  $('name')?.addEventListener('change',e=>apply(M.rename(state,e.target.value),'Ahora se llama '+e.target.value.trim().slice(0,16)+'.'));
  $('coat')?.addEventListener('change',e=>apply(M.setFur(state,e.target.value),'¡Nuevo pelaje para '+state.name+'!'));
  $('pattern')?.addEventListener('change',e=>apply(M.setPattern(state,e.target.value),'¡Nuevo estampado para '+state.name+'!'));
  $('reduce-motion')?.addEventListener('change',e=>apply(M.setReducedMotion(state,e.target.checked),'Preferencia de animación guardada.'));
  $('sound')?.addEventListener('change',e=>{soundOn=e.target.checked;render();if(soundOn)sound(580);else if(audio){audio.close();audio=null;}});
  function pause(){if(gameId!==null){closeGame();say('El juego se ha pausado. Vuelve a jugar cuando quieras.');}save();if(audio){audio.close();audio=null;}}
  window.addEventListener('mishi-pause',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else resume();});
  function resume(){state=M.tick(state,Date.now(),{offline:true}).state;render();save();}
  window.addEventListener('mishi-resume',resume);
  window.addEventListener('mishi-back',e=>{if(gameId!==null){e.preventDefault();closeGame();$('play').focus();}else if($('customize')?.open){e.preventDefault();$('customize').open=false;}});
  window.addEventListener('pagehide',pause);
  setInterval(()=>{if(!document.hidden){state=M.tick(state,Date.now()).state;render();save();}},30000);
  render();save();
})();
