import {Vector3,MathUtils} from 'three';
export function closestOnSegment(a,b,p){const d=b.clone().sub(a),len=d.lengthSq();return a.clone().addScaledVector(d,len?MathUtils.clamp(p.clone().sub(a).dot(d)/len,0,1):0);}
export function sweepSphere(from,to,center,radius){return closestOnSegment(from,to,center).distanceToSquared(center)<=radius*radius;}
export class ContactSystem {
 constructor(targets){this.targets=targets;this.previous=new Map();this.previouslyActive=new Map();this.touching=new Set();this.hits=0;this.touches=0;this.peakSpeed=0;this.lastSpeed=0;}
 reset(){this.previous.clear();this.previouslyActive.clear();this.touching.clear();this.hits=0;this.touches=0;this.peakSpeed=0;this.lastSpeed=0;}
 update(probes,dt,enabled=true){
  const events=[];const seen=new Set();
  for(const probe of probes){
   seen.add(probe.id);const previous=this.previous.get(probe.id),wasActive=this.previouslyActive.get(probe.id);
   this.previouslyActive.set(probe.id,enabled&&probe.active);
   this.previous.set(probe.id,probe.position.clone());
   if(!enabled||!probe.active||!wasActive||!previous||dt<=0||dt>.12){for(const t of this.targets)this.touching.delete(`${probe.id}:${t.id}`);continue;}
   const delta=probe.position.clone().sub(previous),speed=delta.length()/dt;
   // Dropped frames / implausible sensor jumps cannot become high-damage impacts.
   if(speed>45){continue;}
   for(const target of this.targets){
    const key=`${probe.id}:${target.id}`,radius=target.radius+probe.radius;
    const inside=probe.position.distanceTo(target.position)<=radius+.12;
    const hit=sweepSphere(previous,probe.position,target.position,radius)||(probe.base&&sweepSphere(probe.base,probe.position,target.position,radius));
    if(!hit&&!inside){this.touching.delete(key);continue;}
    if(!hit||this.touching.has(key))continue;
    this.touching.add(key);this.touches++;this.lastSpeed=speed;this.peakSpeed=Math.max(this.peakSpeed,speed);if(speed>.8)this.hits++;
    events.push({type:speed>.8?'impact':'touch',target:target.id,speed,position:closestOnSegment(previous,probe.position,target.position),impulse:delta.normalize().multiplyScalar(MathUtils.clamp(speed*.15,.03,1.5))});
   }
  }
  for(const key of this.previous.keys())if(!seen.has(key))this.previous.delete(key);
  return events;
 }
}
