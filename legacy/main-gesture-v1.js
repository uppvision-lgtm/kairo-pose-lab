import './style.css';
import { Arena } from './scene.js';
import { Combat, WEAPONS, UPGRADES, newProfile, sanitizeProfile, buyWeapon, buyUpgrade, upgradeCost } from './game.js';
import { PilotCamera } from './camera.js';
const $=id=>document.getElementById(id);
const PROFILE_KEY='kairo.pilot.v1';
const cameraPanel=document.querySelector('.link-panel');
let profile;let storageAvailable=true;
try{profile=sanitizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)));}catch{profile=newProfile();}
let arena,game=null,paused=false,keyboardBlock=false,cameraBlock=false,calloutUntil=0,toastUntil=0,muted=true,audio=null,lastCameraState='',lastHud=0;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3300;}
function save(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch{storageAvailable=false;toast('Penyimpanan browser tidak tersedia. Progres hanya berlaku selama sesi ini.');}}
function sound(kind){if(muted)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);const special=['overdrive','armorBreak','parry'].includes(kind);osc.type=kind==='attack'?'sawtooth':'sine';osc.frequency.setValueAtTime(special?310:kind==='enemyAttack'?75:140,t);osc.frequency.exponentialRampToValueAtTime(special?95:30,t+.18);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.13,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+(special?.5:.2));osc.start(t);osc.stop(t+.55);}catch{/* Audio is optional. */}}
function updateProfileUI(){
 $('home-wins').textContent=String(profile.wins).padStart(2,'0');$('home-best').textContent=String(profile.bestCombo).padStart(2,'0');$('home-credits').textContent=profile.credits.toLocaleString('id-ID');$('home-weapon').textContent=WEAPONS[profile.equipped].name;$('home-weapon-desc').textContent=WEAPONS[profile.equipped].description;arena?.setWeapon(profile.equipped);
}
function renderGarage(){
 $('garage-credits').textContent=profile.credits.toLocaleString('id-ID');
 $('weapon-list').innerHTML=Object.entries(WEAPONS).map(([id,w])=>{const owned=profile.owned.includes(id),equipped=profile.equipped===id;return `<article class="weapon-card ${equipped?'equipped':''}"><div class="weapon-symbol">${w.symbol}</div><span class="weapon-tag">${w.tag}</span><h3>${w.name}</h3><p>${w.description}</p><button class="button ${equipped?'secondary':'primary'}" data-weapon="${id}" ${equipped||(!owned&&profile.credits<w.cost)?'disabled':''}>${equipped?'TERPASANG':owned?'PASANG':`BUKA / ${w.cost} CR`}<span>${equipped?'✓':'→'}</span></button></article>`;}).join('');
 $('upgrade-list').innerHTML=Object.entries(UPGRADES).map(([id,u])=>{const level=profile.upgrades[id],cost=upgradeCost(profile,id);return `<article class="upgrade-card"><div class="upgrade-title"><span>${u.name}</span><b>LV.${level}</b></div><p>${u.description}</p><div class="upgrade-pips">${Array.from({length:5},(_,i)=>`<i class="${i<level?'filled':''}"></i>`).join('')}</div><button class="small-button" data-upgrade="${id}" ${level>=5||profile.credits<cost?'disabled':''}>${level>=5?'MAX LEVEL':`UPGRADE / ${cost} CR`}</button></article>`;}).join('');
}
function openGarage(){if(game)return;renderGarage();$('garage-dialog').showModal();}
function openGuide(){if(game)return;$('guide-dialog').showModal();}
function callout(text,caption='',duration=1100){$('callout-text').textContent=text;$('callout-caption').textContent=caption;$('combat-callout').classList.add('visible');calloutUntil=performance.now()+duration;}
function start(training=false){
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());game=new Combat(profile,{training});paused=false;keyboardBlock=false;cameraBlock=false;
 if(camera.active){$('combat').append(cameraPanel);cameraPanel.hidden=false;}
 $('home').hidden=true;$('combat').hidden=false;document.body.classList.add('in-combat');arena.setMode(training?'training':'duel');arena.setWeapon(profile.equipped);
 $('round-mode').textContent=training?'TRAINING / 01':'DUEL / 01';$('enemy-name').textContent=training?'TRAINING SENTINEL':'REVENANT–07';$('combat-weapon').textContent=WEAPONS[profile.equipped].name;$('enemy-warning').hidden=true;
 callout(training?'TRAINING ONLINE':'ENGAGE.','ATLAS–01 / SYSTEM READY',1500);updateHud();if(camera.active&&!camera.ready)toast('Kalibrasi belum selesai. Keyboard tetap aktif.');
}
function exitGame(){$('home').append(cameraPanel);cameraPanel.hidden=false;game=null;paused=false;keyboardBlock=false;cameraBlock=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('home').hidden=false;$('combat').hidden=true;document.body.classList.remove('in-combat');arena.setMode('home');updateProfileUI();}
function pause(){if(!game||game.status!=='playing'||paused)return;paused=true;keyboardBlock=false;cameraBlock=false;game.setBlock(false);$('pause-dialog').showModal();}
function resume(){if(!game)return;$('pause-dialog').close();paused=false;keyboardBlock=false;cameraBlock=false;}
function action(name){if(!game||paused||game.status!=='playing')return;game.act(name);handleEvents();}
function handleEvents(){if(!game)return;for(const e of game.drainEvents()){
 arena.event(e);if(['attack','enemyAttack','armorBreak','overdrive'].includes(e.type))sound(e.type);
 if(e.type==='combo'){$('combo-name').textContent=e.name;if(e.count%6===0)callout(e.name,`${e.count} HIT COMBO`,650);}
 if(e.type==='armorBreak')callout('ARMOR BREAK','DAMAGE BOOST / 5 SECONDS',1100);
 if(e.type==='overdrive')callout('OVERDRIVE','POWER LIMITER DISENGAGED',1500);
 if(e.type==='lowEnergy')toast('Energi belum cukup. Tunggu reaktor pulih.');
 if(e.type==='guardBreak')callout('GUARD BREAK','ENERGY DEPLETED',900);
 if(e.type==='enemyAttack'&&e.outcome==='parry'){callout('PERFECT PARRY','COUNTERATTACK NOW',900);sound('parry');}
 if(e.type==='enemyAttack'&&e.outcome==='evade')callout('EVADE','CLEAN DODGE',650);
 if(e.type==='dummyReset')callout('TARGET RESET','KEEP THE COMBO GOING',900);
 if(e.type==='result'){save();updateProfileUI();$('result-eyebrow').textContent=e.won?'MISSION COMPLETE':'MISSION FAILED';$('result-title').textContent=e.won?'VICTORY.':'MECH DOWN.';$('result-description').textContent=e.won?'Revenant dinonaktifkan. Kembali ke garasi dan tingkatkan robotmu.':'Reaktor cadangan menyelamatkan pilot. Perkuat robot dan coba lagi.';$('result-reward').textContent=`+${e.reward}`;$('result-combo').textContent=game.bestCombo;setTimeout(()=>{if(game?.status==='won'||game?.status==='lost')$('result-dialog').showModal();},650);}
 }}
function updateHud(){if(!game)return;const percent=(n,max)=>`${Math.max(0,Math.min(100,n/max*100))}%`;
 $('player-hp').style.width=percent(game.hp,game.maxHp);$('player-hp-text').textContent=Math.ceil(game.hp);$('enemy-hp').style.width=percent(game.enemyHp,game.enemyMaxHp);$('enemy-hp-text').textContent=Math.ceil(game.enemyHp);$('player-energy').style.width=percent(game.energy,game.maxEnergy);$('energy-label').textContent=`ENERGY ${Math.floor(game.energy)}`;$('enemy-armor').style.width=`${game.enemyArmor}%`;$('armor-label').textContent=game.enemyArmor===0?'ARMOR BROKEN':`ARMOR ${game.enemyArmor}%`;
 const remaining=Math.max(0,Math.ceil(game.duration-game.time));$('round-time').textContent=game.training?'∞':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
 $('round-state').textContent=game.training?'FREE PRACTICE':paused?'PAUSED':game.status==='playing'?'TARGET LOCKED':'MISSION ENDED';
 $('combo-display').classList.toggle('active',game.combo>1);$('combo-count').textContent=game.combo;
 $('enemy-warning').hidden=!game.telegraph||game.status!=='playing';$('warning-text').textContent=game.attackType?'HEAVY STRIKE — DASH ATAU PARRY!':'SERANGAN MASUK — TANGKIS ATAU DASH';
 const active=game.overdriveUntil>game.time;$('overdrive-fill').style.width=active?`${(game.overdriveUntil-game.time)/8*100}%`:`${game.overdrive}%`;$('overdrive-label').textContent=active?'OVERDRIVE ACTIVE':game.overdrive>=100?'OVERDRIVE READY / O':`OVERDRIVE / ${Math.floor(game.overdrive)}%`;
 $('combat-camera-status').textContent=camera.active?(camera.latest?.visible&&camera.ready?'NEURAL LINK ACTIVE · GERAKAN TUBUH + KEYBOARD':`PILOT LINK · ${$('camera-message').textContent}`):'KEYBOARD CONTROL · J / K UNTUK MENYERANG';
}
const camera=new PilotCamera({video:$('webcam'),canvas:$('pose-overlay'),onStatus:(state,message)=>{
 if(game&&!camera.active&&!camera.starting)cameraPanel.hidden=true;
 $('camera-message').textContent=message;$('camera-placeholder').hidden=camera?.active||state==='loading'||state==='calibrating';$('camera-dot').classList.toggle('online',state==='ready');$('camera-badge').textContent=state==='ready'?'LINKED':state==='calibrating'?'CALIBRATING':state==='loading'?'CONNECTING':state==='lost'?'NO POSE':'STANDBY';$('camera-live').textContent=state==='ready'?'● LIVE / LOCAL':state==='calibrating'?'● CALIBRATING':camera?.active?'● SEARCHING':'CAM OFF';$('camera-btn').innerHTML=camera?.active||camera?.starting?'MATIKAN KAMERA <span>◉</span>':'AKTIFKAN KAMERA <span>◎</span>';$('calibrate-btn').hidden=!camera?.active;
 if(state==='error'&&lastCameraState!=='error')toast(message);lastCameraState=state;
},onInput:input=>{cameraBlock=input.visible&&input.ready&&input.blocking;if(!game||paused||game.status!=='playing')return;game.setBlock(keyboardBlock||cameraBlock);if(input.visible&&input.ready)for(const a of input.actions)action(a);}});
$('camera-btn').addEventListener('click',()=>camera.active||camera.starting?camera.stop():camera.start());$('calibrate-btn').addEventListener('click',()=>camera.calibrate());
$('deploy-btn').addEventListener('click',()=>start());$('training-btn').addEventListener('click',()=>start(true));$('guide-training').addEventListener('click',()=>start(true));$('nav-garage').addEventListener('click',openGarage);$('loadout-btn').addEventListener('click',openGarage);$('nav-guide').addEventListener('click',openGuide);$('sector-btn').addEventListener('click',()=>toast('IRON HARBOR / Arena aktif. Siap untuk duel.'));
$('nav-deploy').addEventListener('click',()=>{if(!game)document.querySelectorAll('dialog[open]').forEach(d=>d.close());});document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();if(game)pause();});
$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);$('exit-btn').addEventListener('click',exitGame);$('rematch-btn').addEventListener('click',()=>start());$('result-garage-btn').addEventListener('click',()=>{exitGame();openGarage();});
$('sound-btn').addEventListener('click',()=>{muted=!muted;$('sound-btn').textContent=muted?'SFX OFF':'SFX ON';$('sound-btn').setAttribute('aria-label',muted?'Aktifkan suara':'Matikan suara');if(!muted)sound('parry');});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>b.closest('dialog').close());
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d&&!['pause-dialog','result-dialog'].includes(d.id)){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('result-dialog').addEventListener('cancel',e=>{e.preventDefault();exitGame();});
$('weapon-list').addEventListener('click',e=>{const b=e.target.closest('[data-weapon]');if(b&&buyWeapon(profile,b.dataset.weapon)){save();updateProfileUI();renderGarage();toast(`${WEAPONS[profile.equipped].name} terpasang.`);}});
$('upgrade-list').addEventListener('click',e=>{const b=e.target.closest('[data-upgrade]');if(b&&buyUpgrade(profile,b.dataset.upgrade)){save();renderGarage();toast(`${UPGRADES[b.dataset.upgrade].name} naik ke level ${profile.upgrades[b.dataset.upgrade]}.`);}});
const keyActions={j:'left',k:'right',l:'special',a:'dodgeLeft',d:'dodgeRight',o:'overdrive',ArrowLeft:'dodgeLeft',ArrowRight:'dodgeRight'};
window.addEventListener('keydown',e=>{
 if(!game)return;if(e.key==='Escape'){e.preventDefault();if(!document.querySelector('dialog[open]'))pause();return;}
 if(paused||document.querySelector('dialog[open]'))return;const key=e.key.length===1?e.key.toLowerCase():e.key;
 if(e.code==='Space'){e.preventDefault();if(!e.repeat){keyboardBlock=true;game.setBlock(true);}return;}
 if(keyActions[key]){e.preventDefault();if(!e.repeat)action(keyActions[key]);}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){keyboardBlock=false;game?.setBlock(cameraBlock);}});
window.addEventListener('blur',()=>{keyboardBlock=false;cameraBlock=false;pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('click',()=>action(b.dataset.action));
$('touch-block').addEventListener('pointerdown',e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);keyboardBlock=true;game?.setBlock(true);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('touch-block').addEventListener(event,()=>{keyboardBlock=false;game?.setBlock(cameraBlock);});
// Camera controls remain accessible while a match is paused.
const pauseCamera=document.createElement('button');pauseCamera.className='text-button';pauseCamera.textContent='MATIKAN KAMERA';pauseCamera.addEventListener('click',()=>{camera.stop();toast('Kamera dimatikan. Keyboard tetap aktif.');});$('pause-dialog').append(pauseCamera);
window.addEventListener('pagehide',()=>camera.stop());
try{arena=new Arena($('arena'));updateProfileUI();save();}catch(error){$('loading').innerHTML='<p>Grafis 3D gagal dimuat. Aktifkan akselerasi grafis browser lalu muat ulang.</p>';console.error(error);throw error;}
let previous=performance.now(),frames=0,fpsTime=previous;
function frame(now){
 const dt=Math.min((now-previous)/1000,.05);previous=now;camera.update(now);
 if(game&&!paused){game.tick(dt);handleEvents();}
 arena.update(paused?0:dt,game);if(now-lastHud>70){updateHud();lastHud=now;}
 if(now>calloutUntil)$('combat-callout').classList.remove('visible');if(now>toastUntil)$('toast').classList.remove('visible');
 frames++;if(now-fpsTime>1200){$('fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;fpsTime=now;frames=0;}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),450);
if(import.meta.env.DEV)window.__kairo={get game(){return game;},get profile(){return structuredClone(profile);},get camera(){return {active:camera.active,ready:camera.ready,starting:camera.starting};},get paused(){return paused;},get storageAvailable(){return storageAvailable;}};
