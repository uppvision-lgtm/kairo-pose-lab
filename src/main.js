import './style.css';
import {Arena} from './scene.js';
import {PilotCamera} from './camera.js';
import {PoseController,demoLandmarks} from './pose.js';
const $=id=>document.getElementById(id);
const EQUIPMENT={fists:{name:'STEEL FISTS',tag:'DIRECT HAND CONTACT',symbol:'⟐',description:'Tangan bebas. Sentuh atau dorong sasaran dengan gerakanmu sendiri.'},blade:{name:'PLASMA BLADE',tag:'CONTINUOUS BLADE CONTACT',symbol:'╱',description:'Pedang di tangan kanan. Arah bilah selalu mengikuti lengan dan pergelangan.'},cannon:{name:'ARC CANNON',tag:'ARM AIM / MANUAL FIRE',symbol:'⊙',description:'Bidik dengan lengan kanan. Tekan F atau tombol Tembak untuk melepaskan energi.'}};
const SETTINGS_KEY='kairo.pose.settings.v2';
let settings={weapon:'fists',response:18,depth:1};
try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(saved){settings.weapon=EQUIPMENT[saved.weapon]?saved.weapon:'fists';settings.response=Number.isFinite(saved.response)?Math.max(6,Math.min(30,saved.response)):18;settings.depth=Number.isFinite(saved.depth)?Math.max(.5,Math.min(1.4,saved.depth)):1;}}catch{}
const rig=new PoseController();rig.response=settings.response;rig.depth=settings.depth;
let arena,camera,mode='home',source='none',demo=false,demoTime=0,muted=true,audio=null,toastUntil=0,lastStatus='',contactUntil=0,lastHud=0;
const panel=$('pilot-panel');
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{toast('Pengaturan berlaku untuk sesi ini; penyimpanan browser tidak tersedia.');}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3200;}
function sound(strength=.4){if(muted)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.connect(gain);gain.connect(audio.destination);osc.frequency.setValueAtTime(70+strength*50,t);osc.frequency.exponentialRampToValueAtTime(25,t+.17);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.min(.15,.03+strength*.02),t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+.22);osc.start(t);osc.stop(t+.23);}catch{}}
function syncSettings(){rig.response=settings.response;rig.depth=settings.depth;$('response-slider').value=settings.response;$('depth-slider').value=Math.round(settings.depth*100);$('response-value').textContent=settings.response<12?'Halus':settings.response>23?'Responsif':'Seimbang';$('depth-value').textContent=`${Math.round(settings.depth*100)}%`;}
function equip(id){if(!EQUIPMENT[id])return;settings.weapon=id;arena.setWeapon(id);saveSettings();$('home-weapon').textContent=EQUIPMENT[id].name;$('fire-btn').hidden=id!=='cannon';document.querySelectorAll('[data-equip]').forEach(b=>b.classList.toggle('selected',b.dataset.equip===id));renderEquipment();}
function renderEquipment(){$('weapon-list').innerHTML=Object.entries(EQUIPMENT).map(([id,w])=>`<article class="weapon-card ${settings.weapon===id?'equipped':''}"><div class="weapon-symbol">${w.symbol}</div><span class="weapon-tag">${w.tag}</span><h3>${w.name}</h3><p>${w.description}</p><button class="button ${settings.weapon===id?'secondary':'primary'}" data-weapon="${id}" ${settings.weapon===id?'disabled':''}>${settings.weapon===id?'TERPASANG':'PASANG'}<span>${settings.weapon===id?'✓':'→'}</span></button></article>`).join('');}
function openEquipment(){renderEquipment();$('equipment-dialog').showModal();}
function enterLab({connect=false,example=false}={}){document.querySelectorAll('dialog[open]').forEach(d=>d.close());mode='lab';$('home').hidden=true;$('lab').hidden=false;document.body.classList.add('in-combat');$('lab').append(panel);arena.setMode('lab');if(example)startDemo();else if(connect&&!camera.active&&!camera.starting)connectCamera();updateHUD(performance.now());}
function leaveLab(){mode='home';$('home').append(panel);$('home').hidden=false;$('lab').hidden=true;document.body.classList.remove('in-combat');arena.setMode('home');document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function startDemo(){arena.contacts.previous.clear();if(camera.active||camera.starting)camera.stop();rig.reset();syncSettings();rig.ready=true;source='demo';demo=true;demoTime=0;$('pose-overlay').width=640;$('pose-overlay').height=480;$('camera-message').textContent='Contoh sensor simulasi. Aktifkan kamera untuk memakai tubuhmu.';updateHUD(performance.now());}
function stopDemo(){demo=false;source='none';rig.reset();camera.draw(null);updateHUD(performance.now());}
function connectCamera(){arena.contacts.previous.clear();if(demo)stopDemo();source='camera';rig.reset();syncSettings();camera.start();}
function freeze(){if(!rig.ready)return;rig.frozen=!rig.frozen;if(!rig.frozen)rig.state='tracking';arena.contacts.previous.clear();updateHUD(performance.now());}
function updateHUD(now){
 const state=rig.state;const tracked=camera.active&&rig.ready&&state==='tracking';const frozen=rig.frozen;
 $('camera-placeholder').hidden=camera.active||camera.starting||demo;$('webcam').hidden=demo;
 $('camera-dot').classList.toggle('online',tracked);$('camera-badge').textContent=demo?'DEMO':frozen?'HELD':camera.starting?'LOADING':camera.active?(rig.calibrating?'ALIGNING':state==='tracking'?'LINKED':state==='partial'?'PARTIAL':'NO POSE'):'STANDBY';
 $('camera-live').textContent=demo?'SIMULASI / BUKAN KAMERA':camera.active?(frozen?'● LIVE / POSE DITAHAN':'● LIVE / LOCAL'):'CAM OFF';panel.querySelector('.camera-view').classList.toggle('demo-view',demo);
 $('calibration-track').hidden=!camera.active||!rig.calibrating;$('calibration-fill').style.width=`${rig.progress*100}%`;
 $('camera-btn').innerHTML=camera.active||camera.starting?'MATIKAN KAMERA <span>◉</span>':'AKTIFKAN KAMERA <span>◎</span>';$('calibrate-btn').hidden=!camera.active;
 if(camera.active){$('camera-message').textContent=frozen?'Pose ditahan. Kamera tetap aktif. Klik Lanjutkan Pose untuk bergerak.':rig.calibrating?(state==='framing'?'Pastikan kedua bahu, siku, dan tangan terlihat.':'Duduk tegak, tangan di depan dada. Tahan… '+Math.round(rig.progress*100)+'%'):state==='tracking'?'Gerakkan tubuhmu dengan bebas. Robot mengikuti posisimu.':state==='partial'?'Satu lengan tidak terlihat. Bagian yang terlihat tetap mengikuti.':'Pose tidak terlihat. Kembali ke dalam bingkai kamera.';}
 else if(demo)$('camera-message').textContent='Contoh gerakan dari sensor simulasi. Tidak memakai kamera.';
 const sourceText=demo?(frozen?'DEMO / POSE DITAHAN':'DEMO SENSOR · SIMULASI'):frozen?'POSE DITAHAN':camera.active?(rig.calibrating?'KALIBRASI POSISI DUDUK':state==='tracking'?'LIVE · DIRECT POSE':state==='partial'?'LIVE · TRACKING PARSIAL':'TRACKING TERPUTUS'):camera.starting?'MENGHUBUNGKAN KAMERA':'MENUNGGU KAMERA';
 $('source-text').textContent=sourceText;$('source-badge').className=`source-badge ${demo?'demo':tracked?'live':''} ${frozen?'frozen':''}`;
 $('lab-note').textContent=demo?'SIMULASI SENSOR · Aktifkan kamera untuk mengendalikan dengan tubuhmu.':frozen?'POSE DITAHAN · Putar kamera untuk memeriksa gerakan dari segala sisi.':rig.ready?'Gerak tangan menentukan kontak. Drag arena untuk memutar pandangan.':'Duduk tegak. Kedua siku dan tangan harus terlihat saat kalibrasi.';
 $('freeze-btn').disabled=!rig.ready;$('freeze-btn').textContent=frozen?'LANJUTKAN POSE':'TAHAN POSE';$('lab-demo-btn').textContent=demo?'HENTIKAN CONTOH GERAK':'COBA CONTOH GERAK';
 $('left-link').textContent=rig.ready?(frozen?'DITAHAN':rig.canCollide(now/1000,'left')?'TERBACA':'HILANG'):'—';$('right-link').textContent=rig.ready?(frozen?'DITAHAN':rig.canCollide(now/1000,'right')?'TERBACA':'HILANG'):'—';
 $('touch-count').textContent=String(arena.contacts.touches).padStart(2,'0');$('hit-count').textContent=String(arena.contacts.hits).padStart(2,'0');
 $('fire-btn').disabled=!rig.canCollide(now/1000,'right');
 if(now>contactUntil)$('contact-message').textContent='Jangkau sasaran di depan atau samping robot.';
}
camera=new PilotCamera({video:$('webcam'),canvas:$('pose-overlay'),onStatus:(state,message)=>{
 lastStatus=state;$('camera-message').textContent=message;if(state==='streaming'){source='camera';rig.calibrate();}if(state==='off'){source='none';rig.reset();}if(state==='error'){source='none';toast(message);}
},onFrame:frame=>{if(source==='camera'&&!demo)rig.ingest(frame);}});
try{arena=new Arena($('arena'));arena.setPose(rig.current);arena.setWeapon(settings.weapon);$('home-weapon').textContent=EQUIPMENT[settings.weapon].name;document.querySelectorAll('[data-equip]').forEach(b=>b.classList.toggle('selected',b.dataset.equip===settings.weapon));$('fire-btn').hidden=settings.weapon!=='cannon';renderEquipment();syncSettings();}
catch(error){$('loading').innerHTML='<p>Grafis 3D gagal dimuat. Aktifkan akselerasi grafis browser lalu muat ulang.</p>';console.error(error);throw error;}
arena.onContact=event=>{contactUntil=performance.now()+1700;$('contact-message').textContent=event.type==='shot'?`Sasaran ${event.target} terkena tembakan.`:`Sasaran ${event.target} · ${event.type==='impact'?(event.speed>3?'benturan kuat':'benturan ringan'):'sentuhan lembut'}`;if(event.type!=='touch')sound(event.speed);};
$('enter-btn').addEventListener('click',()=>enterLab({connect:true}));$('guide-enter').addEventListener('click',()=>enterLab({connect:true}));$('demo-btn').addEventListener('click',()=>enterLab({example:true}));$('nav-lab').addEventListener('click',()=>enterLab());$('leave-btn').addEventListener('click',leaveLab);document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();leaveLab();});
$('camera-btn').addEventListener('click',()=>camera.active||camera.starting?camera.stop():connectCamera());$('calibrate-btn').addEventListener('click',()=>{rig.calibrate();arena.contacts.previous.clear();toast('Kalibrasi ulang: duduk tegak dan tahan posisi 2 detik.');});
$('lab-demo-btn').addEventListener('click',()=>demo?stopDemo():startDemo());$('freeze-btn').addEventListener('click',freeze);$('back-view-btn').addEventListener('click',()=>arena.resetCamera());$('front-view-btn').addEventListener('click',()=>arena.resetCamera('front'));
$('reset-targets-btn').addEventListener('click',()=>{arena.resetTargets();contactUntil=0;toast('Sasaran dan hitungan kontak direset.');});
for(const id of ['nav-equipment','equipment-btn'])$(id).addEventListener('click',openEquipment);$('nav-guide').addEventListener('click',()=>$('guide-dialog').showModal());$('settings-btn').addEventListener('click',()=>$('settings-dialog').showModal());
$('weapon-list').addEventListener('click',e=>{const b=e.target.closest('[data-weapon]');if(b){equip(b.dataset.weapon);toast(`${EQUIPMENT[b.dataset.weapon].name} terpasang.`);}});document.querySelectorAll('[data-equip]').forEach(b=>b.addEventListener('click',()=>equip(b.dataset.equip)));
for(const id of ['response-slider','depth-slider'])$(id).addEventListener('input',()=>{settings.response=Number($('response-slider').value);settings.depth=Number($('depth-slider').value)/100;syncSettings();saveSettings();});$('reset-settings-btn').addEventListener('click',()=>{settings.response=18;settings.depth=1;syncSettings();saveSettings();});
$('fire-btn').addEventListener('click',()=>{if(arena.fire())sound(1);});
$('sound-btn').addEventListener('click',()=>{muted=!muted;$('sound-btn').textContent=muted?'SFX OFF':'SFX ON';$('sound-btn').setAttribute('aria-label',muted?'Aktifkan suara':'Matikan suara');if(!muted)sound(.5);});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>b.closest('dialog').close());
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
window.addEventListener('keydown',e=>{if(mode!=='lab'||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.repeat)return;const key=e.key.toLowerCase();if(key==='c'){arena.resetCamera();e.preventDefault();}if(key==='f'&&settings.weapon==='cannon'){if(arena.fire())sound(1);e.preventDefault();}if(e.key==='Escape'){leaveLab();e.preventDefault();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&rig.ready){rig.frozen=true;arena.contacts.previous.clear();}});window.addEventListener('pagehide',()=>camera.stop());
let previous=performance.now(),frames=0,fpsTime=previous;
function frame(now){const dt=Math.min((now-previous)/1000,.05);previous=now;
 camera.update(now);
 if(demo&&!rig.frozen){demoTime+=dt;const sample=demoLandmarks(demoTime);rig.ingest({...sample,timestamp:now/1000});camera.draw(sample.landmarks);}
 const pose=rig.update(dt,now/1000);arena.setPose(pose,{left:rig.canCollide(now/1000,'left'),right:rig.canCollide(now/1000,'right'),source});arena.update(dt);
 if(now-lastHud>90){updateHUD(now);lastHud=now;}if(now>toastUntil)$('toast').classList.remove('visible');frames++;if(now-fpsTime>1200){$('fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;frames=0;fpsTime=now;}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),450);
