import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {solvePose,PoseController} from '../src/pose.js';
import {ContactSystem,sweepSphere} from '../src/contact.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),DOWN=V(0,-1,0);
function sample(){
 const w=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1,presence:1}));
 for(const [side,ids]of [[1,[11,13,15]],[-1,[12,14,16]]])ids.forEach((i,j)=>w[i]={x:side*.2,y:-.6+j*.3,z:0,visibility:1,presence:1});
 w[23]={x:.15,y:0,z:0};w[24]={x:-.15,y:0,z:0};
 const p=w.map(v=>({...v,x:.5+v.x*.3,y:.5+v.y*.3}));for(const i of [0,7,8,17,18,19,20])p[i].visibility=0;
 return {landmarks:p,worldLandmarks:w};
}
function endpoint(p,side,bone='lower'){const q=p.torso.clone().multiply(p[side].upper);if(bone==='lower')q.multiply(p[side].lower);return DOWN.clone().applyQuaternion(q);}
function near(v,expected){assert.ok(v.distanceTo(expected)<1e-5,`${v.toArray()} != ${expected.toArray()}`);}
function ingest(c,s,time){c.ingest({...s,timestamp:time});}
function calibrated(){const c=new PoseController();c.calibrate();for(let i=0;i<=50;i++)ingest(c,sample(),i*.05);return c;}
test('neutral seated pose keeps both arms down without hips in frame',()=>{const s=sample();s.landmarks[23].visibility=0;s.landmarks[24].visibility=0;const {pose,valid}=solvePose(s.landmarks,s.worldLandmarks);assert.ok(valid.left&&valid.right&&valid.torso);near(endpoint(pose,'left'),DOWN);near(endpoint(pose,'right'),DOWN);});
test('raising the anatomical left arm continuously changes only that arm',()=>{for(const angle of [.2,.5,1,1.57,2.2]){const s=sample();s.worldLandmarks[13]={x:.2+Math.sin(angle)*.3,y:-.6+Math.cos(angle)*.3,z:0};s.worldLandmarks[15]={x:.2+Math.sin(angle)*.6,y:-.6+Math.cos(angle)*.6,z:0};const {pose}=solvePose(s.landmarks,s.worldLandmarks);near(endpoint(pose,'left'),V(Math.sin(angle),-Math.cos(angle),0));near(endpoint(pose,'right'),DOWN);assert.equal('actions' in pose,false);}});
test('elbow flexion points the forearm forward without rotating upper arm',()=>{const s=sample();s.worldLandmarks[15]={x:.2,y:-.3,z:-.3};const {pose}=solvePose(s.landmarks,s.worldLandmarks);near(endpoint(pose,'left','upper'),DOWN);near(endpoint(pose,'left'),V(0,0,1));});
test('both arms can be raised overhead freely instead of invoking a guard animation',()=>{const s=sample();for(const [sign,el,w]of [[1,13,15],[-1,14,16]]){s.worldLandmarks[el]={x:sign*.2,y:-.9,z:0};s.worldLandmarks[w]={x:sign*.2,y:-1.2,z:0};}const {pose}=solvePose(s.landmarks,s.worldLandmarks);near(endpoint(pose,'left'),V(0,1,0));near(endpoint(pose,'right'),V(0,1,0));});
test('torso rotation is compensated in local arm rotations, without applying it twice',()=>{const s=sample();const yaw=new Quaternion().setFromAxisAngle(V(0,1,0),.5);for(let i=0;i<33;i++){const w=s.worldLandmarks[i],v=V(w.x,-w.y,-w.z).applyQuaternion(yaw);s.worldLandmarks[i]={x:v.x,y:-v.y,z:-v.z};}const {pose}=solvePose(s.landmarks,s.worldLandmarks);near(endpoint(pose,'left'),DOWN);assert.ok(pose.torso.angleTo(new Quaternion())>.3);});
test('calibration completes with stable upper body and resets if an arm leaves frame',()=>{const c=new PoseController();c.calibrate();ingest(c,sample(),0);const s=sample();s.landmarks[15].visibility=.1;ingest(c,s,1.5);assert.equal(c.progress,0);assert.equal(c.ready,false);assert.equal(calibrated().ready,true);});
test('one occluded arm settles gently while the other remains independently tracked',()=>{const c=calibrated(),s=sample();s.worldLandmarks[13]={x:.5,y:-.6,z:0};s.worldLandmarks[15]={x:.8,y:-.6,z:0};for(let i=0;i<20;i++){ingest(c,s,3+i*.02);c.update(.02,3+i*.02);}const before=c.current.left.upper.angleTo(new Quaternion());assert.ok(before>1.2);s.landmarks[15].visibility=.1;for(let i=0;i<100;i++){ingest(c,s,3.4+i*.02);c.update(.02,3.4+i*.02);}assert.ok(c.current.left.upper.angleTo(new Quaternion())<before*.1);assert.equal(c.valid.right,true);assert.equal(c.canCollide(5.38,'left'),false);});
test('freeze holds exact pose and disables physical contacts',()=>{const c=calibrated();c.update(.02,2.5);c.frozen=true;const before=c.current.left.upper.toArray();const s=sample();s.worldLandmarks[13].x=.9;ingest(c,s,3);c.update(.5,3);assert.deepEqual(c.current.left.upper.toArray(),before);assert.equal(c.canCollide(3,'left'),false);});
test('reacquired tracking waits through a short settling interval before collisions',()=>{const c=calibrated();ingest(c,sample(),4);assert.equal(c.canCollide(4,'left'),false);for(let i=1;i<=7;i++)ingest(c,sample(),4+i*.04);assert.equal(c.canCollide(4.28,'left'),true);});
test('continuous sweep catches a fist passing through a small target between frames',()=>{assert.equal(sweepSphere(V(-1,0,0),V(1,0,0),V(),.3),true);assert.equal(sweepSphere(V(-1,1,0),V(1,1,0),V(),.3),false);});
function contacts(){return new ContactSystem([{id:1,position:V(),radius:.2}]);}
const probe=(x,active=true)=>[{id:'left',position:V(x,0,0),radius:.1,active}];
test('a real swept collision produces one impact and resting contact does not farm hits',()=>{const c=contacts();c.update(probe(-.6),.04);const events=c.update(probe(.1),.04);assert.equal(events.length,1);assert.equal(events[0].type,'impact');for(let i=0;i<50;i++)assert.equal(c.update(probe(.1),.02).length,0);assert.equal(c.hits,1);});
test('loss and reacquisition cannot turn relocation into a fake impact',()=>{const c=contacts();c.update(probe(-.6),.04);c.update(probe(-.6,false),.04);assert.deepEqual(c.update(probe(.1),.04),[]);assert.equal(c.hits,0);});
test('soft touch reacts but is not counted as a fast impact',()=>{const c=contacts();c.update(probe(-.31),.1);const e=c.update(probe(-.29),.1);assert.equal(e[0].type,'touch');assert.equal(c.touches,1);assert.equal(c.hits,0);});
test('calibration or paused input cannot produce contacts',()=>{const c=contacts();c.update(probe(-.6),.04);assert.deepEqual(c.update(probe(.1),.04,false),[]);assert.equal(c.hits,0);});
test('wrist orientation follows palm landmarks while keeping the elbow stationary',()=>{const s=sample();for(const i of [17,19])s.landmarks[i].visibility=1;s.worldLandmarks[19]={x:.2,y:.1,z:-.04};s.worldLandmarks[17]={x:.2,y:.1,z:.04};const {pose}=solvePose(s.landmarks,s.worldLandmarks);near(endpoint(pose,'left'),DOWN);assert.ok(pose.left.hand.angleTo(new Quaternion())>1.3);});
test('invalid world coordinates are ignored instead of contaminating joint rotations',()=>{const s=sample();s.worldLandmarks[13].x=NaN;const {pose,valid}=solvePose(s.landmarks,s.worldLandmarks);assert.equal(valid.left,false);assert.ok(pose.left.upper.toArray().every(Number.isFinite));assert.equal(valid.right,true);});
test('a long gap between samples cannot complete a false continuous calibration',()=>{const c=new PoseController();c.calibrate();ingest(c,sample(),0);ingest(c,sample(),5);assert.equal(c.ready,false);assert.equal(c.progress,0);});
