import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ContactSystem } from './contact.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const V=THREE.Vector3;
const boxGeo=new RoundedBoxGeometry(1,1,1,2,.07);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,12);
const sphereGeo=new THREE.SphereGeometry(1,12,8);
const mats={};
function metal(color,roughness=.42,metalness=.78){const key=`${color}-${roughness}-${metalness}`;return mats[key]??=new THREE.MeshStandardMaterial({color,roughness,metalness});}
function glow(color,strength=2){const key=`g${color}-${strength}`;return mats[key]??=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:strength,roughness:.25,metalness:.4});}
function box(parent,x,y,z,sx,sy,sz,material,rotation=0){const mesh=new THREE.Mesh(boxGeo,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=rotation;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cyl(parent,x,y,z,r,h,material,axis='y'){const mesh=new THREE.Mesh(cylinderGeo,material);mesh.position.set(x,y,z);mesh.scale.set(r,h,r);if(axis==='z')mesh.rotation.x=Math.PI/2;if(axis==='x')mesh.rotation.z=Math.PI/2;mesh.castShadow=true;parent.add(mesh);return mesh;}
function ball(parent,x,y,z,r,material){const mesh=new THREE.Mesh(sphereGeo,material);mesh.position.set(x,y,z);mesh.scale.setScalar(r);parent.add(mesh);return mesh;}
function ring(parent,x,y,z,r,t,material){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,36),material);m.position.set(x,y,z);parent.add(m);return m;}
function decal(text,color='#c7d8df'){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=color;c.font='bold 70px monospace';c.textAlign='center';c.fillText(text,128,89);return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false});
}
// Merge fixed pieces within each joint; the articulated hierarchy remains intact.
function batchMeshes(group){
 for(const child of [...group.children])if(child.isGroup)batchMeshes(child);
 const byMaterial=new Map();
 for(const child of group.children){if(!child.isMesh||child.isInstancedMesh||Array.isArray(child.material)||child.material.transparent)continue;const key=child.material.uuid;if(!byMaterial.has(key))byMaterial.set(key,[]);byMaterial.get(key).push(child);}
 for(const meshes of byMaterial.values()){
  if(meshes.length<2)continue;
  const geometries=meshes.map(mesh=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();return geometry.applyMatrix4(mesh.matrix);});
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!geometry)continue;
  const merged=new THREE.Mesh(geometry,meshes[0].material);merged.castShadow=meshes.some(m=>m.castShadow);merged.receiveShadow=true;group.add(merged);for(const mesh of meshes)group.remove(mesh);
 }
}
function mech({enemy=false}={}){
 const root=new THREE.Group();const torso=new THREE.Group();torso.position.y=3.85;root.add(torso);
 const armor=metal(enemy?0x584b43:0x394e5e), armor2=metal(enemy?0x877467:0x7b919c), dark=metal(0x151e26,.58), edge=metal(0x9daeb3,.3), accent=metal(enemy?0x9b3420:0xc06e37,.42), light=glow(enemy?0xff6336:0x63e8ff,2.5);
 // Pelvis, armored torso and layered chest.
 box(torso,0,-.4,0,1.65,.8,1.15,dark);box(torso,0,.25,0,2.5,1.8,1.35,armor);
 for(const s of [-1,1]){
   box(torso,s*.66,.65,.73,1.17,.77,.32,armor2,s*-.16);
   box(torso,s*.95,.04,.77,.47,.63,.25,armor);
   box(torso,s*.70,-.54,.6,.9,.37,.35,accent,s*.13);
   box(torso,s*.4,-1,.15,.65,.6,.8,armor,s*-.16);
   for(let i=0;i<4;i++)box(torso,s*1.28,-.1+i*.18,-.15,.07,.07,.9,edge);
   cyl(torso,s*.9,.7,-.85,.2,1.9,dark);cyl(torso,s*.9,1.75,-.85,.23,.16,edge);
   box(torso,s*.7,.2,-.8,.6,1.3,.45,armor);
   box(torso,s*.7,.25,-1.06,.1,.7,.08,light);
 }
 cyl(torso,0,.2,.82,.49,.15,dark,'z');ring(torso,0,.2,.93,.36,.065,edge);ring(torso,0,.2,.95,.29,.035,light);cyl(torso,0,.2,.98,.22,.05,light,'z');
 for(let i=0;i<3;i++)box(torso,0,-.48+i*.19,.78,.62,.09,.1,dark);
 // Fasteners, service panels and warning strips give the armor scale.
 for(const s of [-1,1]){
   for(let j=0;j<3;j++)box(torso,s*.8,.74-j*.16,.94,.48,.035,.025,dark,s*-.16);
   for(const x of [s*.28,s*1.03])for(const y of [.47,.94])cyl(torso,x,y,.97,.038,.03,edge,'z');
   box(torso,s*1.08,-.22,.9,.16,.27,.025,accent);
   box(torso,s*.55,.04,-1.075,.33,.57,.035,dark);
   for(let j=0;j<4;j++)box(torso,s*.55,-.18+j*.12,-1.10,.32,.035,.035,edge);
 }
 // Head and neck.
 cyl(torso,0,1.34,0,.32,.48,dark);const head=new THREE.Group();head.position.set(0,1.77,.03);torso.add(head);
 box(head,0,0,0,.86,.79,.79,armor2);box(head,0,.06,.4,.79,.24,.11,dark);box(head,0,.08,.468,.64,.055,.03,light);box(head,0,-.29,.37,.48,.15,.16,armor);
 for(const s of [-1,1]){box(head,s*.49,-.05,0,.16,.48,.56,armor);box(head,s*.35,.38,-.12,.12,.25,.45,accent);}
 box(head,.43,.71,-.2,.045,.57,.045,edge);
 const arms=[];
 for(const s of [-1,1]){
   const arm=new THREE.Group();arm.position.set(s*1.58,.85,0);torso.add(arm);arms.push(arm);
   ball(arm,0,0,0,.43,dark);box(arm,s*.13,.1,0,1.23,.79,1.24,armor);box(arm,s*.15,.48,.01,1.25,.14,1.25,armor2);box(arm,s*.17,.50,.29,1.2,.025,.2,accent);
   box(arm,0,-.67,0,.7,.9,.76,armor);cyl(arm,0,-1.12,0,.28,.85,edge,'x');
   const forearm=new THREE.Group();forearm.position.y=-1.19;arm.add(forearm);arm.userData.forearm=forearm;
   box(forearm,0,-.53,.07,.93,1.02,.97,armor2);box(forearm,0,-.5,.58,.6,.65,.13,armor);box(forearm,s*.48,-.55,.13,.08,.61,.28,accent);box(forearm,0,-.65,.67,.3,.04,.06,light);
   cyl(forearm,0,-1.12,0,.29,.25,dark);
   const hand=new THREE.Group();hand.position.y=-1.19;forearm.add(hand);arm.userData.hand=hand;
   box(hand,0,-.20,.13,.76,.43,.7,dark);
   for(let i=0;i<3;i++)box(hand,-.24+i*.24,-.25,.48,.2,.34,.2,edge);
   box(hand,-s*.46,-.08,.18,.23,.39,.3,armor2,s*-.25);
   const label=new THREE.Mesh(new THREE.PlaneGeometry(.59,.3),decal(enemy?'07':'01'));label.position.set(s*.15,.13,.63);arm.add(label);
 }
 const legs=[];
 for(const s of [-1,1]){
   const leg=new THREE.Group();leg.position.set(s*.68,2.75,0);root.add(leg);legs.push(leg);
   ball(leg,0,0,0,.38,dark);box(leg,0,-.6,0,.91,1.1,1,armor);box(leg,0,-.54,.55,.68,.83,.18,armor2);
   cyl(leg,0,-1.24,0,.29,1,edge,'x');box(leg,0,-1.18,.51,.8,.43,.36,accent);
   box(leg,0,-1.82,0,.86,1.04,1.03,armor);box(leg,0,-1.77,.53,.58,.83,.25,armor2);box(leg,s*.44,-1.85,0,.1,.77,.4,dark);
   box(leg,0,-2.4,.28,1.07,.48,1.63,armor);box(leg,0,-2.34,.98,.8,.17,.13,edge);box(leg,0,-1.88,.68,.055,.53,.05,light);
 }
 const sword=new THREE.Group();arms[0].userData.hand.add(sword);sword.position.set(0,-.2,.4);box(sword,0,-.18,0,.23,.9,.24,dark);box(sword,0,-.6,0,.76,.16,.29,edge);box(sword,0,-1.9,0,.26,2.5,.16,light);box(sword,0,-1.85,-.1,.45,2.4,.08,armor2);sword.visible=false;
 const cannon=new THREE.Group();arms[0].userData.hand.add(cannon);cannon.position.set(0,-.2,.25);cannon.rotation.x=Math.PI/2;box(cannon,0,0,0,1.03,.87,1.4,dark);cyl(cannon,0,-.05,.77,.38,.4,armor,'z');ring(cannon,0,-.05,1,.28,.04,light);cyl(cannon,0,-.05,1.02,.17,.03,light,'z');cannon.visible=false;
 const shield=new THREE.Mesh(new THREE.CircleGeometry(1.65,6),new THREE.MeshBasicMaterial({color:enemy?0xff7733:0x63e8ff,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));shield.position.set(0,3.9,1.8);root.add(shield);shield.visible=false;
 const spine=new THREE.Group();spine.position.y=3;root.remove(torso);torso.position.y=.85;spine.add(torso);root.add(spine);
 return {root,torso,spine,head,arms,legs,sword,cannon,shield};
}
export class Arena {
 constructor(container){
  this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x0a171f);this.scene.fog=new THREE.FogExp2(0x0b1b26,.022);
  this.camera=new THREE.PerspectiveCamera(43,1,.1,220);this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;container.append(this.renderer.domElement);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.38,.5,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.scene.add(new THREE.HemisphereLight(0xb9ddeb,0x243446,2.5));
  const key=new THREE.DirectionalLight(0xa7dcff,4);key.position.set(-8,15,10);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:60});key.shadow.bias=-.001;this.scene.add(key);
  const rim=new THREE.DirectionalLight(0xfb7c43,3.7);rim.position.set(8,9,-6);this.scene.add(rim);
  const front=new THREE.PointLight(0x9fdded,45,35,1.5);front.position.set(2,6,8);this.scene.add(front);
  this.buildEnvironment();batchMeshes(this.scene);this.player=mech();this.enemy=mech({enemy:true});batchMeshes(this.player.root);batchMeshes(this.enemy.root);this.scene.add(this.player.root,this.enemy.root);this.enemy.root.visible=false;
  this.mode='home';this.time=0;this.effects=[];this.pose=null;this.source='none';this.onContact=()=>{};this.targets=[];this.buildTargets();this.contacts=new ContactSystem(this.targets);this.nextShot=0;this.cameraPos=new V(13,7.9,19);this.cameraTarget=new V(-2.7,3,0);this.camera.position.copy(this.cameraPos);this.camera.lookAt(this.cameraTarget);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enablePan=false;this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=8;this.controls.maxDistance=23;this.controls.minPolarAngle=.4;this.controls.maxPolarAngle=1.48;this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.65;this.controls.enabled=false;this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
 }
 buildEnvironment(){
   const platform=new THREE.Mesh(new THREE.CylinderGeometry(11,11.15,.25,80),metal(0x21303a,.27,.86));platform.position.y=-.15;platform.receiveShadow=true;this.scene.add(platform);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),metal(0x152a36,.2,.87));floor.rotation.x=-Math.PI/2;floor.position.y=-.31;floor.receiveShadow=true;this.scene.add(floor);
   for(const radius of [9.7,10.5]){const r=ring(this.scene,0,.004,0,radius,.025,glow(radius===9.7?0x417c8a:0xe28249,.9));r.rotation.x=-Math.PI/2;}
   const grid=new THREE.GridHelper(22,16,0x507582,0x314a58);grid.position.y=.003;grid.material.transparent=true;grid.material.opacity=.22;this.scene.add(grid);
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const o=box(this.scene,Math.cos(a)*10.13,.012,Math.sin(a)*10.13,.6,.02,.12,metal(0xb6834a));o.rotation.y=-a;}
   const windowGeo=new THREE.BoxGeometry(.12,.17,.03);const windows=new THREE.InstancedMesh(windowGeo,glow(0x83b8c6,.55),1800);const matrix=new THREE.Matrix4();let wi=0;
   let seed=57;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
   for(let i=0;i<55;i++){
    const a=i/55*Math.PI*2;const radius=27+rand()*35;const x=Math.cos(a)*radius,z=Math.sin(a)*radius;const height=3+rand()*18,w=2+rand()*3;
    box(this.scene,x,height/2-.3,z,w,height,2+rand()*3,metal(i%2?0x162934:0x20343e,.68));
    for(let row=0;row<height/.8;row++)for(let col=0;col<Math.floor(w/.6);col++)if(rand()>.42&&wi<1800){matrix.makeTranslation(x-w/2+.4+col*.6,.6+row*.8,z+2.51);windows.setMatrixAt(wi++,matrix);}
    if(i%5===0)box(this.scene,x,height+.25,z,.08,.5,.08,glow(0xff5729,2));
   }
   windows.count=wi;this.scene.add(windows);
   // Harbor cranes, cargo and dock beacons.
   for(const [x,z,h] of [[-16,-12,16],[18,-21,21],[30,-8,18]]){
     const crane=new THREE.Group();crane.position.set(x,0,z);this.scene.add(crane);const paint=metal(0x59636a,.6);
     box(crane,0,h/2,0,.43,h,.5,paint);box(crane,0,h,0,14,.38,.48,paint);box(crane,-1,h-1.2,0,2,2,1.5,metal(0x8b673d));
     for(let j=0;j<5;j++){box(crane,0,j*3,0,2,.18,.6,paint);const beam=box(crane,0,j*3+1.5,0,.11,3.5,.11,paint);beam.rotation.z=.5;}
     box(crane,4,h-4,0,.035,8,.035,metal(0x8f9a9a));box(crane,4,h-8,0,.6,.3,.5,paint);
   }
   for(let i=0;i<18;i++){const side=i%2?1:-1,x=side*(13+(i%3)*3),z=-12+i*1.8;box(this.scene,x,.8,z,2.6,1.6,1.9,metal(i%3===0?0x694132:0x344e59));for(let j=0;j<5;j++)box(this.scene,x-1+j*.5,.8,z+1,.055,1.4,.07,metal(0x50606a));}
   for(const x of [-12,12])for(const z of [-9,7]){cyl(this.scene,x,3,z,.055,6,metal(0x6b7b81));box(this.scene,x,6,z,.6,.15,.3,glow(0xfbb988,3));const light=new THREE.PointLight(0xeb9d6a,15,13,2);light.position.set(x,5.7,z);this.scene.add(light);}
   const positions=new Float32Array(1600*3);for(let i=0;i<positions.length;i+=3){positions[i]=(rand()-.5)*70;positions[i+1]=rand()*30;positions[i+2]=(rand()-.5)*70;}
   const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));this.rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0x90b8c9,size:.035,transparent:true,opacity:.4,depthWrite:false}));this.scene.add(this.rain);
 }
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);}
 buildTargets(){
  this.targetRoot=new THREE.Group();this.scene.add(this.targetRoot);this.targetRoot.visible=false;
  const specs=[[-2.05,4.1,-2.25],[2.05,4.1,-2.25],[0,5.4,-2.5],[-3.6,3.7,-.25],[3.6,3.7,-.25]];
  specs.forEach(([x,y,z],i)=>{
   const anchor=new V(x,y,z),pad=new THREE.Group();pad.position.copy(anchor);this.targetRoot.add(pad);
   const face=glow(i===2?0xf59a58:0x59d8e1,.75).clone();
   cyl(pad,0,0,0,.57,.3,metal(0x334a56),'z');cyl(pad,0,0,.19,.44,.08,metal(0x101e29),'z');ring(pad,0,0,.25,.47,.035,face);ring(pad,0,0,.26,.21,.014,face);
   box(pad,0,0,.28,.13,.13,.02,face);box(pad,0,.65,0,.38,.15,.06,metal(0xb37c4f));
   cyl(this.targetRoot,x,(y-.65)/2,z,.065,Math.max(.1,y-.65),metal(0x3c5360));cyl(this.targetRoot,x,.09,z,.55,.18,metal(0x263c46));
   this.targets.push({id:i+1,position:pad.position,anchor,object:pad,radius:.57,velocity:new V(),offset:new V(),material:face,flash:0});
  });
  batchMeshes(this.targetRoot);
 }
 setWeapon(id){this.weapon=id;this.player.sword.visible=id==='blade';this.player.cannon.visible=id==='cannon';this.contacts?.previous.clear();this.contacts?.touching.clear();}
 setMode(mode){
  this.mode=mode;this.enemy.root.visible=false;this.targetRoot.visible=mode==='lab';this.controls.enabled=mode==='lab';this.player.root.position.set(0,0,0);this.player.root.rotation.y=mode==='lab'?Math.PI:.37;this.contacts.reset();
  if(mode==='lab')this.resetCamera();
 }
 resetCamera(view='back'){
  this.controls.target.set(0,3.6,-.8);
  const distance=this.camera.aspect<1?17:12.8;
  this.camera.position.set(view==='front'?-4:4.1,6.8,view==='front'?-distance:distance);
  this.controls.update();this.camera.lookAt(this.controls.target);this.controls.saveState();
 }
 setPose(pose,{left=false,right=false,source='none'}={}){this.pose=pose;this.collisionArms={left,right};this.source=source;}
 resetTargets(){for(const t of this.targets){t.position.copy(t.anchor);t.velocity.set(0,0,0);t.offset.set(0,0,0);t.flash=0;}this.contacts.reset();}
 applyPose(){
  const m=this.player;if(!this.pose)return;
  m.spine.quaternion.copy(this.pose.torso);m.head.quaternion.copy(this.pose.head);
  for(const [side,index]of [['left',1],['right',0]]){const arm=m.arms[index];arm.quaternion.copy(this.pose[side].upper);arm.userData.forearm.quaternion.copy(this.pose[side].lower);arm.userData.hand.quaternion.copy(this.pose[side].hand);}
  m.shield.visible=false;m.root.updateMatrixWorld(true);
 }
 contactProbes(){
  const probes=[];
  for(const [side,index]of [['left',1],['right',0]]){
   const hand=this.player.arms[index].userData.hand;probes.push({id:side,position:hand.localToWorld(new V(0,-.28,.2)),radius:.33,active:this.collisionArms?.[side]});
  }
  if(this.weapon==='blade')probes.push({id:'blade',position:this.player.sword.localToWorld(new V(0,-3.15,0)),base:this.player.sword.localToWorld(new V(0,-.6,0)),radius:.13,active:this.collisionArms?.right});
  return probes;
 }
 reactToContact(event){
  const target=this.targets.find(t=>t.id===event.target);target.velocity.add(event.impulse);target.flash=.22;
  if(event.type==='impact'){this.burst(event.position,0xffb76c,Math.min(35,Math.round(event.speed*3)+6));}
  this.onContact(event);
 }
 fire(){
  if(this.mode!=='lab'||this.weapon!=='cannon'||!this.collisionArms?.right||this.time<this.nextShot)return false;
  this.nextShot=this.time+.4;
  const muzzle=this.player.cannon.localToWorld(new V(0,-.05,1.08));const forward=this.player.cannon.localToWorld(new V(0,-.05,2.08)).sub(muzzle).normalize();
  const ray=new THREE.Ray(muzzle,forward);let end=muzzle.clone().addScaledVector(forward,25),nearest=Infinity,hitTarget=null;
  for(const target of this.targets){const hit=ray.intersectSphere(new THREE.Sphere(target.position,target.radius),new V());if(hit){const d=hit.distanceTo(muzzle);if(d<nearest){nearest=d;end=hit;hitTarget=target;}}}
  const length=muzzle.distanceTo(end),beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,length,8),glow(0x8feeff,4));beam.position.copy(muzzle).add(end).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new V(0,1,0),forward);this.scene.add(beam);this.effects.push({type:'beam',object:beam,life:0,duration:.13});
  if(hitTarget)this.reactToContact({type:'shot',target:hitTarget.id,speed:0,position:end,impulse:forward.multiplyScalar(.65)});return true;
 }
 burst(position,color=0x90eaff,count=30){
  const pos=new Float32Array(count*3),vel=[];for(let i=0;i<count;i++)vel.push(new V((Math.random()-.5)*9,Math.random()*7,(Math.random()-.5)*9));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const mat=new THREE.PointsMaterial({color,size:.10,transparent:true,opacity:1,depthWrite:false});const object=new THREE.Points(geo,mat);object.position.copy(position);this.scene.add(object);this.effects.push({type:'sparks',object,vel,life:0,duration:.65});
  const flash=new THREE.PointLight(color,60,8,2);flash.position.copy(position);this.scene.add(flash);this.effects.push({type:'light',object:flash,life:0,duration:.18});
 }
 update(dt){
  this.time+=dt;this.applyPose();
  if(this.mode==='home'){
   const narrow=this.camera.aspect<1.1;
   this.cameraPos.lerp(narrow?new V(13,8,25):new V(12,7.5,18.5),Math.min(1,dt*3));this.cameraTarget.lerp(narrow?new V(-1.7,3,0):new V(-3.7,3.1,0),Math.min(1,dt*3));this.camera.position.copy(this.cameraPos);this.camera.lookAt(this.cameraTarget);
  }else{
   this.controls.update();
   const probes=this.contactProbes();for(const event of this.contacts.update(probes,dt,true))this.reactToContact(event);
   for(const target of this.targets){target.velocity.addScaledVector(target.offset,-dt*35);target.velocity.multiplyScalar(Math.exp(-dt*5));target.offset.addScaledVector(target.velocity,dt);target.offset.clampLength(0,.75);target.position.copy(target.anchor).add(target.offset);target.flash=Math.max(0,target.flash-dt);target.material.emissiveIntensity=target.flash>0?2.5:.75;}
  }
  const pos=this.rain.geometry.attributes.position;for(let i=0;i<pos.count;i++){pos.array[i*3+1]-=dt*15;pos.array[i*3]-=dt*1.5;if(pos.array[i*3+1]<0)pos.array[i*3+1]=30;}pos.needsUpdate=true;
  for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life+=dt;const p=e.life/e.duration;if(e.type==='sparks'){const a=e.object.geometry.attributes.position;for(let j=0;j<a.count;j++){a.array[j*3]+=e.vel[j].x*dt;a.array[j*3+1]+=e.vel[j].y*dt;a.array[j*3+2]+=e.vel[j].z*dt;e.vel[j].y-=dt*16;}a.needsUpdate=true;e.object.material.opacity=1-p;}else if(e.type==='light')e.object.intensity=60*(1-p);if(p>=1){this.scene.remove(e.object);e.object.geometry?.dispose();if(e.type==='sparks')e.object.material.dispose();this.effects.splice(i,1);}}
  this.composer.render();
 }
}
