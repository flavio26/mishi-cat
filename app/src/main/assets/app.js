/* Mishi interface controller, entirely local. */
(() => {
  'use strict';
  const M=window.MishiModel, $=id=>document.getElementById(id), KEY='mishi.v1';
  if (!M) throw Error('Falta el motor de Mishi');
  let state, bootEvents=[];
  const night=t=>Boolean(M.isNight&&M.isNight(t));
  const T=(st,t,opts)=>M.tick(st,t,{...(opts||{}),night:night(t)});
  try { const r=T(M.deserialize(localStorage.getItem(KEY),Date.now()).state,Date.now(),{offline:true}); state=r.state; bootEvents=r.events||[]; }
  catch (_) { state=M.createDefaultState(Date.now()); }
  if(state.activeGameId!=null){const r=M.abortGame(state,state.activeGameId);if(r.ok)state=r.state;}
  let game=null, audio=null, lastPet=0, soundOn=false, sleepPending=false, messBusy=false, litterShown=null;
  const pendingMess=new Set(), messQueue=[];
  const motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const reduced=()=>Boolean(state.settings.reducedMotion||motionQuery?.matches);
  const visibleMess=()=>(state.mess||[]).filter(m=>!pendingMess.has(m.id));
  const B=window.MishiBehavior&&$('cat')&&$('room')?window.MishiBehavior.create({cat:$('cat'),room:$('room'),fx:$('fx'),appearance:()=>{const f=M.getFur(state.fur);return {fur:f.base,dark:f.dark,light:f.light,eye:M.getEyes(state.eyes).color,pattern:state.pattern};},yarn:document.querySelector('.scene-yarn'),reduced,isBusy:()=>game!==null||sleepPending||messBusy,stats:()=>state.stats,name:()=>state.name,say,sound,mess:visibleMess,tired:autoSleep}):null;
  const save=()=>{try {localStorage.setItem(KEY,M.serialize(state));} catch (_) { /* private storage unavailable */ }};
  function say(text){const el=$('message');if(el)el.textContent=text;}
  function sound(freq=450) {
    if (!soundOn || document.hidden) return;
    try {audio ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),g=audio.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(0.05,audio.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.16);osc.connect(g);g.connect(audio.destination);osc.start();osc.stop(audio.currentTime+0.16);}catch (_){}
  }
  function scenePx(p){
    if(B)return B.toPx(p);
    const r=$('room'),W=r.clientWidth||1,H=r.clientHeight||1,s=Math.max(W/360,H/400);
    return {x:(W-360*s)/2+p.x*s,y:H-400*s+p.y*s};
  }
  function litterLevel(){return litterShown==null?(state.litter||0):Math.min(litterShown,state.litter||0);}
  function renderMess(){
    const layer=$('mess');if(!layer)return;
    const vis=visibleMess(), ids=new Set(vis.map(m=>String(m.id)));
    for(const el of [...layer.children])if(!ids.has(el.dataset.id))el.remove();
    for(const m of vis){
      let el=layer.querySelector('[data-id="'+m.id+'"]');
      if(!el){
        el=document.createElement('button');el.type='button';el.className='mess-item mess-'+m.type;el.dataset.id=String(m.id);
        el.setAttribute('aria-label',m.type==='poop'?'Limpiar la caca':'Limpiar el vómito');
        el.innerHTML=m.type==='poop'
          ?'<svg viewBox="0 0 40 50" aria-hidden="true"><g class="stink"><path d="M12 13q-4-4 0-7t0-6"/><path d="M20 11q-4-4 0-7t0-6"/><path d="M28 13q-4-4 0-7t0-6"/></g><use href="#i-poop" y="14" width="40" height="36"/></svg>'
          :'<svg viewBox="0 0 48 24" aria-hidden="true"><use href="#i-vomit"/></svg>';
        el.addEventListener('click',ev=>{ev.stopPropagation();cleanOne(m.id);});
        layer.appendChild(el);
      }
      const p=scenePx(m);el.style.left=p.x+'px';el.style.top=p.y+'px';
    }
    const lit=litterLevel(), lb=$('litter-btn'), room=$('room');
    for(const k of [1,2,3])room?.classList.toggle('litter-'+k,lit>=k);
    if(lb){const q=scenePx({x:88,y:362});lb.style.left=q.x+'px';lb.style.top=q.y+'px';lb.setAttribute('aria-label',lit?'Limpiar el arenero':'Arenero limpio');lb.classList.toggle('is-full',lit>=3);}
    const count=vis.length+(lit>=2?1:0), badge=$('mess-count');
    if(badge){badge.textContent=String(count);badge.hidden=!count;}
    $('clean')?.setAttribute('aria-label',count?'Limpiar '+(count===1?'la suciedad':count+' suciedades'):'Bañar a '+state.name);
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
      el.closest('.stat')?.classList.toggle('is-low',state.stats[key]<25);
    }
    if($('sleep')){$('sleep').setAttribute('aria-label',state.sleeping?'Despertar a '+state.name:'Dormir a '+state.name);const label=$('sleep').querySelector('.action-label');if(label)label.textContent=state.sleeping?'Despertar':'Dormir';}
    const cat=$('cat');
    if(cat){
      cat.classList.toggle('is-sleeping',state.sleeping);
      for(const f of M.FURS)cat.classList.remove('coat-'+f.id);
      cat.classList.remove('coat-ginger','coat-cream','coat-charcoal');cat.classList.add('coat-'+state.fur);
      for(const p of M.PATTERNS)cat.classList.remove('pattern-'+p.id);cat.classList.add('pattern-'+state.pattern);
      cat.setAttribute('aria-label',state.sleeping?state.name+' está dormido. Toca para acariciar.':'Acariciar a '+state.name);
      cat.classList.toggle('mood-happy',state.stats.mood>75&&!state.sleeping);
      cat.classList.toggle('mood-sad',state.stats.mood<28&&!state.sleeping);
      cat.classList.toggle('dirty-1',state.stats.hygiene<60&&state.stats.hygiene>=28);
      cat.classList.toggle('dirty-2',state.stats.hygiene<28);
    }
    const root=document.documentElement.style;
    root.setProperty('--fur',M.getFur(state.fur).base);root.setProperty('--fur-dark',M.getFur(state.fur).dark);
    root.setProperty('--fur-light',M.getFur(state.fur).light);root.setProperty('--eye',M.getEyes(state.eyes).color);
    const isNight=night(Date.now());
    $('room')?.classList.toggle('is-night',isNight);
    $('room')?.classList.toggle('is-dim',state.sleeping||isNight);
    $('room')?.classList.toggle('has-food',state.stats.hunger<65);
    document.documentElement.classList.toggle('reduce-motion',state.settings.reducedMotion);
    renderMess();
  }
  const reasons={sleeping:'Está durmiendo. Despiértalo primero.',cooldown:'Espera un momento.',full:'Ya ha comido suficiente.',alreadyClean:'Ya está limpito.',notTired:'Todavía tiene mucha energía.',tired:'Necesita descansar antes de jugar.',hungry:'Necesita comer antes de jugar.',locked:'Ese pelaje se desbloquea subiendo de nivel.',gameActive:'Termina el juego primero.',empty:'Escribe un nombre.',invalid:'Esa opción no está disponible.',noMess:'No hay nada que limpiar.',litterClean:'El arenero ya está limpio.'};
  function apply(result, message, frequency){
    if(!result.ok){say(reasons[result.reason]||'Ahora no se puede.');render();return false;}
    state=result.state;say(message);render();save();if(frequency)sound(frequency);return true;
  }
  /* Vida: caca, vómito y bolas de pelo */
  const lifeText={
    poop:n=>'¡'+n+' ha hecho caca! Tócala para limpiarla.',
    vomit:n=>'¡Ay! '+n+' ha comido demasiado y ha vomitado. Límpialo.',
    hairball:n=>n+' ha echado una bola de pelo. Báñalo más a menudo.',
    litter:n=>(state.litter||0)>=3?n+' ha usado el arenero y ya está lleno. ¡Límpialo o lo hará fuera!':n+' ha usado su arenero. ¡Buen gato!'
  };
  function handleEvents(events, live){
    if(!events||!events.length)return;
    if(!live||!B||reduced()){
      const types=[...new Set(events.map(e=>e.type))];
      say(live?lifeText[types[0]](state.name):types.every(t=>t==='litter')?'Mientras no estabas, '+state.name+' ha usado su arenero.':'Mientras no estabas, '+state.name+' ha ensuciado la habitación. Toca para limpiar.');
      return;
    }
    for(const e of events){if(e.type==='litter'){if(litterShown==null)litterShown=(state.litter||0)-1;}else pendingMess.add(e.id);messQueue.push(e);}
    renderMess();nextMess();
  }
  function nextMess(){
    if(messBusy)return;
    const e=messQueue.shift();if(!e)return;
    if(e.type==='litter'){
      messBusy=true;let done=false;
      const fin=()=>{if(done)return;done=true;litterShown=messQueue.some(q=>q.type==='litter')?Math.min(state.litter||0,(litterShown||0)+1):null;render();say(lifeText.litter(state.name));sound(340);setTimeout(()=>{messBusy=false;nextMess();},1200);};
      say(state.name+' va a su arenero…');B.react('litter',fin);setTimeout(fin,9000);return;
    }
    const m=(state.mess||[]).find(x=>x.id===e.id);
    if(!m){pendingMess.delete(e.id);nextMess();return;}
    messBusy=true;
    let shown=false;
    const reveal=()=>{if(shown)return;shown=true;pendingMess.delete(e.id);render();say(lifeText[e.type](state.name));sound(e.type==='poop'?300:220);setTimeout(()=>{messBusy=false;nextMess();},1200);};
    if(e.type==='poop')say(state.name+' busca un rincón con cara de apuro…');
    else say(state.name+' no se encuentra bien…');
    B.react(e.type==='poop'?'poop':'vomit',reveal,m);
    setTimeout(reveal,9000);
  }
  function cleanOne(id){
    if(game)return;
    const m=(state.mess||[]).find(x=>x.id===id);
    const now=Date.now();state=T(state,now,{holdEvents:true}).state;
    if(apply(M.cleanMess(state,now,id),'¡Recogido! '+state.name+' te lo agradece.',640)&&B){if(m)B.sparkleAt(m);B.react('tidy');}
  }
  function cleanLitter(){
    if(game||messBusy)return;
    const now=Date.now();state=T(state,now,{holdEvents:true}).state;
    if(apply(M.cleanLitter(state,now),'¡Arenero limpio! '+state.name+' lo usará encantado.',640)&&B){B.sparkleAt({x:88,y:352});B.react('tidy');}
  }
  function cleanAll(){
    const list=visibleMess();
    const now=Date.now();state=T(state,now,{holdEvents:true}).state;
    for(const m of (state.mess||[]))pendingMess.delete(m.id);
    messQueue.length=0;litterShown=null;
    let ok=false;
    if((state.litter||0)>=2){const r=M.cleanLitter(state,now);if(r.ok){state=r.state;ok=true;B?.sparkleAt({x:88,y:352});}}
    if(state.mess&&state.mess.length){const r=M.cleanMess(state,now,null);if(r.ok){state=r.state;ok=true;}}
    if(!ok){apply(M.cleanMess(state,now,null),'');return;}
    say(list.length>1?'¡Todo recogido! La habitación huele mucho mejor.':'¡Recogido! '+state.name+' te lo agradece.');render();save();sound(640);
    if(B){for(const m of list)B.sparkleAt(m);B.react('tidy');}
  }
  /* Cuidados */
  function sleepWalk(startMsg,endMsg){
    const now=Date.now();
    const check=M.toggleSleep(state,now);
    if(!check.ok){say(reasons[check.reason]||'Ahora no se puede.');return false;}
    if(!B||reduced())return apply(check,endMsg,520);
    sleepPending=true;say(startMsg);
    B.react('sleep',()=>{sleepPending=false;const t=Date.now();state=T(state,t,{holdEvents:true}).state;if(!state.sleeping)apply(M.toggleSleep(state,t),endMsg,520);});
    return true;
  }
  function autoSleep(){
    if(state.sleeping||game||sleepPending||messBusy)return false;
    state=T(state,Date.now(),{holdEvents:true}).state;
    if(state.stats.energy>=(night(Date.now())?60:18))return false;
    return sleepWalk(state.name+' bosteza y se va a su alfombra…',state.name+' se ha quedado dormido solito. Shh…');
  }
  function doAction(action){
    if(sleepPending||game)return false;
    if(action==='clean'&&(visibleMess().length||litterLevel()>=2)){cleanAll();return true;}
    const now=Date.now();state=T(state,now,{holdEvents:true}).state;
    const wasSleeping=state.sleeping;
    if(action==='sleep'&&!wasSleeping)return sleepWalk(state.name+' busca su sitio en la alfombra…','A dormir. Volverá con más energía.');
    const result=action==='sleep'?M.toggleSleep(state,now):M[action](state,now);
    const messages={feed:result.overfed?'¡Uf! Ya estaba lleno… le puede sentar mal.':'¡Qué rico! Va corriendo a su cuenco.',pet:'Ronronea. Le encanta estar contigo.',clean:'¡Pelito limpio y suave!',sleep:wasSleeping?'Ya está despierto y listo para jugar.':'A dormir. Volverá con más energía.'};
    const ok=apply(result,messages[action],action==='pet'?320:520);
    if(ok&&B)B.react(action==='sleep'?'wake':action);
    return ok;
  }
  /* Juego: lanzar el ovillo por la habitación y que Mishi lo atrape */
  function floorSpot(){
    const f=B?B.visibleFloor(30):{minX:90,maxX:280,minY:330,maxY:386};
    return {x:f.minX+Math.random()*(f.maxX-f.minX),y:f.minY+Math.random()*(f.maxY-f.minY)};
  }
  function clampFloor(p){const f=B?B.visibleFloor(24):{minX:84,maxX:292,minY:330,maxY:386};return {x:Math.min(f.maxX,Math.max(f.minX,p.x)),y:Math.min(f.maxY,Math.max(f.minY,p.y))};}
  function placeYarn(p){const el=$('game-target');if(!el)return;const q=scenePx(p);el.style.left=q.x+'px';el.style.top=q.y+'px';el.classList.remove('is-rolling');void el.offsetWidth;el.classList.add('is-rolling');}
  function throwYarn(p){
    if(!game)return;
    p=clampFloor(p);
    const from=B?B.position():game.yarn;
    game.bonus=Math.hypot(p.x-from.x,p.y-from.y)>120;
    game.yarn=p;game.throwId++;placeYarn(p);sound(480);
    const id=game.throwId;
    if(B)B.chase(p,()=>caught(id));else setTimeout(()=>caught(id),600);
  }
  function caught(id){
    if(!game||id!==game.throwId)return;
    game.score+=game.bonus?2:1;game.throwId++;
    $('game-score').textContent=String(game.score);sound(610+game.score*15);
    $('game-target')?.classList.add('caught');setTimeout(()=>$('game-target')?.classList.remove('caught'),260);
    say(game.bonus?'¡Lanzamiento largo! +2':'¡Atrapado! Toca el suelo para lanzarlo otra vez.');
    const side=Math.random()<0.5?-1:1;
    game.yarn=clampFloor({x:game.yarn.x+side*(25+Math.random()*25),y:game.yarn.y+(Math.random()-0.5)*20});
    setTimeout(()=>{if(game&&game.throwId===id+1)placeYarn(game.yarn);},350);
  }
  function closeGame(abort=true){
    if(!game)return;
    clearInterval(game.timer);
    if(abort){const r=M.abortGame(state,game.id);if(r.ok){state=r.state;save();}}
    game=null;
    if($('game'))$('game').hidden=true;
    if($('game-target'))$('game-target').hidden=true;
    $('room')?.classList.remove('is-playing');
    const pl=$('play')?.querySelector('.action-label');if(pl)pl.textContent='Jugar';
  }
  function endGame(){
    if(!game)return;
    const id=game.id,score=game.score;closeGame(false);
    const result=M.finishGame(state,id,score);
    if(apply(result,(score?'¡'+state.name+' atrapó el ovillo '+score+' '+(score===1?'punto':'puntos')+'!':state.name+' no atrapó nada esta vez.')+(result.newRecord?' ¡Nuevo récord!':''),660)&&B)B.react('celebrate');
  }
  function startGame(){
    if(game)return;
    if(sleepPending||messBusy){say('Espera un momento.');return;}
    state=T(state,Date.now(),{holdEvents:true}).state;
    const result=M.startGame(state);if(!result.ok){say(reasons[result.reason]||'Ahora no puede jugar.');render();return;}
    state=result.state;save();
    game={id:result.gameId,score:0,seconds:20,yarn:floorSpot(),throwId:0,bonus:false,timer:null};
    $('game-score').textContent='0';$('game-time').textContent='20';$('game-timer-fill').style.width='100%';
    $('game')?.querySelector('.timer-bar')?.classList.remove('is-hurry');
    $('game').hidden=false;$('game-target').hidden=false;$('room')?.classList.add('is-playing');
    const pl=$('play')?.querySelector('.action-label');if(pl)pl.textContent='Parar';
    say('¡A jugar! Toca el suelo para lanzar el ovillo.');
    throwYarn(game.yarn);
    game.timer=setInterval(()=>{
      if(!game||document.hidden)return;
      game.seconds--;
      $('game-time').textContent=String(game.seconds);
      $('game-timer-fill').style.width=Math.max(0,game.seconds*5)+'%';
      $('game')?.querySelector('.timer-bar')?.classList.toggle('is-hurry',game.seconds<=5);
      if(game.seconds<=0)endGame();
    },1000);
  }
  /* Eventos de interfaz */
  for (const action of ['feed','pet','sleep','clean']) $(action)?.addEventListener('click',()=>doAction(action));
  $('cat')?.addEventListener('click',e=>{
    if(game){e.stopPropagation();throwYarn(floorSpot());return;}
    if(Date.now()-lastPet<600)return;lastPet=Date.now();
    if(doAction('pet')){$('cat').classList.remove('petted');void $('cat').offsetWidth;$('cat').classList.add('petted');}
  });
  $('play')?.addEventListener('click',()=>{if(game){closeGame();say('Guardamos el ovillo para otro rato.');}else startGame();});
  $('litter-btn')?.addEventListener('click',e=>{e.stopPropagation();if(game){throwYarn(floorSpot());return;}cleanLitter();});
  $('room')?.addEventListener('click',e=>{
    if(e.target.closest('#cat,#game,.mess-item,#game-target,#litter-btn'))return;
    if(game&&B){throwYarn(B.toScene(e.clientX,e.clientY));return;}
    if(!B)return;
    if(state.sleeping){say('Shh… '+state.name+' está durmiendo.');return;}
    if(sleepPending||messBusy)return;
    B.call(e.clientX,e.clientY);say(state.name+' viene hacia ti.');
  });
  $('game-target')?.addEventListener('click',e=>{e.stopPropagation();if(!game)return;const c=B?B.position():{x:180,y:360};let p,t=0;do{p=floorSpot();t++;}while(t<8&&Math.abs(p.x-c.x)<110);throwYarn(p);});
  $('game-close')?.addEventListener('click',e=>{e.stopPropagation();closeGame();say('Guardamos el ovillo para otro rato.');$('play').focus();});
  $('name')?.addEventListener('change',e=>apply(M.rename(state,e.target.value),'Ahora se llama '+e.target.value.trim().slice(0,16)+'.'));
  $('coat')?.addEventListener('change',e=>apply(M.setFur(state,e.target.value),'¡Nuevo pelaje para '+state.name+'!'));
  $('pattern')?.addEventListener('change',e=>apply(M.setPattern(state,e.target.value),'¡Nuevo estampado para '+state.name+'!'));
  $('reduce-motion')?.addEventListener('change',e=>apply(M.setReducedMotion(state,e.target.checked),'Preferencia de animación guardada.'));
  $('sound')?.addEventListener('change',e=>{soundOn=e.target.checked;render();if(soundOn)sound(580);else if(audio){audio.close();audio=null;}});
  function pause(){B?.stop();if(game){closeGame();say('El juego se ha pausado. Vuelve a jugar cuando quieras.');}save();if(audio){audio.close();audio=null;}}
  function resume(){
    const r=T(state,Date.now(),{offline:true});state=r.state;
    render();save();handleEvents(r.events,false);
    if(B){B.layout();B.start();}
    renderMess();
  }
  window.addEventListener('mishi-pause',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else resume();});
  window.addEventListener('mishi-resume',resume);
  window.addEventListener('mishi-back',e=>{if(game){e.preventDefault();closeGame();$('play').focus();}else if($('customize')?.open){e.preventDefault();$('customize').open=false;}});
  window.addEventListener('pagehide',pause);
  function live(){
    if(document.hidden)return;
    const r=T(state,Date.now(),{holdEvents:sleepPending||messBusy||game!==null});
    state=r.state;
    if(r.wokeUp){say(state.name+' se ha despertado con energía.');B?.react('wake');}
    if(B&&!reduced())for(const e of r.events||[]){if(e.type==='litter'){if(litterShown==null)litterShown=(state.litter||0)-1;}else pendingMess.add(e.id);}
    render();save();handleEvents(r.events,true);
  }
  setInterval(live,5000);
  window.addEventListener('resize',()=>{B?.layout();renderMess();if(game)placeYarn(game.yarn);});
  if(B){B.layout();B.start();}
  render();save();handleEvents(bootEvents,false);
})();
