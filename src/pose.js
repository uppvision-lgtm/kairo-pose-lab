import { Vector3, Quaternion, Matrix4, Euler, MathUtils } from 'three';
const {clamp}=MathUtils;
const UP=new Vector3(0,1,0),DOWN=new Vector3(0,-1,0);
const ARM_IDS={left:[11,13,15],right:[12,14,16]};
const HAND_IDS={left:[19,17],right:[20,18]};
const identity=()=>new Quaternion();
const finiteWorld=(points,ids)=>ids.every(i=>points?.[i]&&['x','y','z'].every(k=>Number.isFinite(points[i][k])));
const visible=(p,i,min=.5)=>!!p?.[i]&&Number.isFinite(p[i].x)&&Number.isFinite(p[i].y)&&(p[i].visibility??1)>=min&&(p[i].presence??1)>=.4&&p[i].x>=-.06&&p[i].x<=1.06&&p[i].y>=-.06&&p[i].y<=1.06;
const point=(p,i,depth=1)=>new Vector3(p[i].x,-p[i].y,-(p[i].z||0)*depth);
const direction=(p,a,b,depth)=>point(p,b,depth).sub(point(p,a,depth)).normalize();
function basis(x,up){
 x=x.clone().normalize();const y=up.clone().addScaledVector(x,-up.dot(x)).normalize();if(y.lengthSq()<.1)return identity();const z=new Vector3().crossVectors(x,y).normalize();return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}
function bodyRotation(normalized,world){
 const x=direction(world,12,11,1);let up=UP.clone();
 // Hips are optional. When they leave a seated crop, shoulders still determine yaw and roll.
 if(visible(normalized,23,.65)&&visible(normalized,24,.65)&&finiteWorld(world,[23,24])){
  const shoulders=point(world,11).add(point(world,12)).multiplyScalar(.5),hips=point(world,23).add(point(world,24)).multiplyScalar(.5);
  const measured=shoulders.sub(hips);if(measured.length()>.15)up=measured.normalize();
 }
 return basis(x,up);
}
export function restPose(){return {torso:identity(),head:identity(),left:{upper:identity(),lower:identity(),hand:identity()},right:{upper:identity(),lower:identity(),hand:identity()}};}
export function solvePose(normalized,world,{correction=identity(),depth=1}={}){
 const pose=restPose();const valid={torso:false,head:false,left:false,right:false};
 if(!visible(normalized,11)||!visible(normalized,12)||!finiteWorld(world,[11,12])||point(world,11).distanceTo(point(world,12))<.02)return {pose,valid};
 const rawBody=bodyRotation(normalized,world);pose.torso.copy(correction).multiply(rawBody);
 // A fixed pelvis permits upper-body lean and rotation without translating the root.
 const e=new Euler().setFromQuaternion(pose.torso,'YXZ');e.x=clamp(e.x,-.5,.5);e.y=clamp(e.y,-1.05,1.05);e.z=clamp(e.z,-.65,.65);pose.torso.setFromEuler(e);valid.torso=true;
 const torsoInv=pose.torso.clone().invert();
 for(const side of ['left','right']){
  const [s,el,w]=ARM_IDS[side];if(![s,el,w].every(i=>visible(normalized,i))||!finiteWorld(world,[s,el,w]))continue;
  const a=direction(world,s,el,depth).applyQuaternion(correction),b=direction(world,el,w,depth).applyQuaternion(correction);
  if(a.lengthSq()<.9||b.lengthSq()<.9)continue;
  const upperGlobal=new Quaternion().setFromUnitVectors(DOWN,a),lowerGlobal=new Quaternion().setFromUnitVectors(DOWN,b);
  pose[side].upper.copy(torsoInv).multiply(upperGlobal);
  pose[side].lower.copy(upperGlobal).invert().multiply(lowerGlobal);
  const [index,pinky]=HAND_IDS[side];
  if(visible(normalized,index,.55)&&visible(normalized,pinky,.55)&&finiteWorld(world,[index,pinky])){
   const fingers=point(world,index,depth).add(point(world,pinky,depth)).multiplyScalar(.5).sub(point(world,w,depth));
   const across=point(world,index,depth).sub(point(world,pinky,depth)).multiplyScalar(side==='left'?-1:1);
   if(fingers.length()>.015&&across.length()>.015){
    const y=fingers.normalize().negate(),x=across.addScaledVector(y,-across.dot(y)).normalize();
    if(x.lengthSq()>.5){const handGlobal=basis(x,y).premultiply(correction);pose[side].hand.copy(lowerGlobal).invert().multiply(handGlobal);}
   }
  }
  valid[side]=true;
 }
 if([0,7,8].every(i=>visible(normalized,i,.6))&&finiteWorld(world,[0,7,8])){
  const x=direction(world,8,7,1),mid=point(world,7).add(point(world,8)).multiplyScalar(.5),front=point(world,0).sub(mid).normalize();
  const headUp=new Vector3().crossVectors(front,x).normalize();
  if(headUp.y>.25){const headGlobal=basis(x,headUp).premultiply(correction);pose.head.copy(torsoInv).multiply(headGlobal);const h=new Euler().setFromQuaternion(pose.head,'YXZ');h.x=clamp(h.x,-.55,.55);h.y=clamp(h.y,-1,1);h.z=clamp(h.z,-.45,.45);pose.head.setFromEuler(h);valid.head=true;}
 }
 return {pose,valid};
}
export class PoseController {
 constructor(){this.response=18;this.depth=1;this.reset();}
 reset(){this.current=restPose();this.target=restPose();this.correction=identity();this.ready=false;this.calibrating=false;this.progress=0;this.samples=[];this.lastSeen={torso:-Infinity,head:-Infinity,left:-Infinity,right:-Infinity};this.acquiredAt={left:Infinity,right:Infinity};this.valid={torso:false,head:false,left:false,right:false};this.lastInput=-Infinity;this.frozen=false;this.state='off';}
 calibrate(){this.ready=false;this.calibrating=true;this.progress=0;this.samples=[];this.lastSeen={torso:-Infinity,head:-Infinity,left:-Infinity,right:-Infinity};this.state='calibrating';this.frozen=false;}
 ingest({landmarks,worldLandmarks,timestamp}){
  if(this.frozen)return;
  this.lastInput=timestamp;
  const full=[11,12,13,14,15,16].every(i=>visible(landmarks,i));
  if(this.calibrating){
   if(!full||!finiteWorld(worldLandmarks,[11,12,13,14,15,16])){this.samples=[];this.progress=0;this.state='framing';return;}
   const cx=(landmarks[11].x+landmarks[12].x)/2,cy=(landmarks[11].y+landmarks[12].y)/2,width=Math.hypot(landmarks[11].x-landmarks[12].x,landmarks[11].y-landmarks[12].y);
   if(width<.1){this.samples=[];this.progress=0;this.state='framing';return;}
   const last=this.samples.at(-1);if(last&&timestamp-last.time>.25)this.samples=[];
   const first=this.samples[0];if(first&&(Math.abs(cx-first.cx)>.06||Math.abs(cy-first.cy)>.06))this.samples=[];
   this.samples.push({time:timestamp,cx,cy,q:bodyRotation(landmarks,worldLandmarks)});this.progress=clamp((timestamp-this.samples[0].time)/2,0,1);this.state='calibrating';
   if(this.progress<1)return;
   const neutral=this.samples[0].q.clone();for(let i=1;i<this.samples.length;i++)neutral.slerp(this.samples[i].q,1/(i+1));this.correction.copy(neutral).invert();this.samples=[];this.ready=true;this.calibrating=false;
  }
  if(!this.ready)return;
  const {pose,valid}=solvePose(landmarks,worldLandmarks,{correction:this.correction,depth:this.depth});this.valid=valid;
  for(const part of ['torso','head','left','right'])if(valid[part]){
   if((part==='left'||part==='right')&&timestamp-this.lastSeen[part]>.3)this.acquiredAt[part]=timestamp;
   this.lastSeen[part]=timestamp;
   if(part==='left'||part==='right')for(const bone of ['upper','lower','hand'])this.target[part][bone].copy(pose[part][bone]);else this.target[part].copy(pose[part]);
  }
  this.state=valid.left&&valid.right?'tracking':valid.left||valid.right?'partial':'lost';
 }
 update(dt,now){
  if(this.frozen){this.state='frozen';return this.current;}
  if(this.ready&&now-this.lastInput>.35)this.state='lost';
  for(const part of ['torso','head','left','right']){
   const age=now-this.lastSeen[part],tracked=this.ready&&age<.35;
   // Brief occlusion holds each arm independently. A longer loss settles gently.
   const amount=1-Math.exp(-(tracked?this.response:2.3)*Math.max(0,dt));
   const blend=(current,target)=>{if(age>.55||!this.ready)current.slerp(identity(),amount);else current.slerp(target,amount);};
   if(part==='left'||part==='right')for(const bone of ['upper','lower','hand'])blend(this.current[part][bone],this.target[part][bone]);else blend(this.current[part],this.target[part]);
  }
  return this.current;
 }
 canCollide(now,side){return this.ready&&!this.frozen&&this.valid[side]&&now-this.lastSeen[side]<.2&&now-this.acquiredAt[side]>.22;}
}
// Explicit synthetic sensor feed for the preview button and repeatable tests.
// It travels through the same retargeting code as webcam landmarks.
export function demoLandmarks(t=0){
 const world=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1,presence:1}));
 const set=(i,v)=>{world[i]={x:v.x,y:-v.y,z:-v.z,visibility:1,presence:1};};
 const torsoQ=new Quaternion().setFromEuler(new Euler(Math.sin(t*.35)*.10,Math.sin(t*.30)*.24,Math.sin(t*.43)*.15,'YXZ'));
 const shoulders={left:new Vector3(.21,.55,0),right:new Vector3(-.21,.55,0)};
 for(const [side,s]of [['left',1],['right',-1]]){
  const [si,ei,wi]=ARM_IDS[side];const shoulder=shoulders[side].clone();
  const phase=t*.8+(side==='left'?0:1.7);
  const elevation=.85+Math.sin(phase)*1.12,forward=.55+Math.sin(phase*.7)*.6;
  const upperQ=new Quaternion().setFromEuler(new Euler(-forward,0,s*elevation,'XYZ'));
  const elbow=shoulder.clone().add(DOWN.clone().applyQuaternion(upperQ).multiplyScalar(.30));
  const lowerQ=upperQ.clone().multiply(new Quaternion().setFromEuler(new Euler(-(.45+Math.sin(phase*.9)*.6),0,0)));
  const wrist=elbow.clone().add(DOWN.clone().applyQuaternion(lowerQ).multiplyScalar(.28));
  for(const [i,p]of [[si,shoulder],[ei,elbow],[wi,wrist]])set(i,p.clone().applyQuaternion(torsoQ));
  const [index,pinky]=HAND_IDS[side];const indexP=wrist.clone().add(new Vector3(-s*.03,-.08,.015).applyQuaternion(lowerQ)),pinkyP=wrist.clone().add(new Vector3(s*.03,-.08,.015).applyQuaternion(lowerQ));
  set(index,indexP.applyQuaternion(torsoQ));set(pinky,pinkyP.applyQuaternion(torsoQ));
 }
 set(23,new Vector3(.15,0,0));set(24,new Vector3(-.15,0,0));set(7,new Vector3(.075,.78,0).applyQuaternion(torsoQ));set(8,new Vector3(-.075,.78,0).applyQuaternion(torsoQ));set(0,new Vector3(0,.78,.10).applyQuaternion(torsoQ));
 const landmarks=world.map(p=>({...p,x:.5+p.x*.48,y:.65+p.y*.48}));return {landmarks,worldLandmarks:world};
}
