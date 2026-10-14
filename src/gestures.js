// Coordinates use unmirrored MediaPipe input. Left/right actions refer to the pilot's body.
export class GestureTracker {
  constructor(){this.reset();}
  reset(){this.baseline=null;this.samples=[];this.calibrating=false;this.previous=null;this.lastAction={left:-10,right:-10,special:-10,dodge:-10};this.armed={left:true,right:true};this.leanArmed=true;this.blocking=false;this.lastSeen=0;}
  startCalibration(){this.reset();this.calibrating=true;}
  read(points,time){
    const ids=[11,12,13,14,15,16];
    if(!points||ids.some(i=>!points[i]||(points[i].visibility??1)<.45)){
      this.previous=null;this.blocking=false;if(this.calibrating)this.samples=[];
      return {visible:false,ready:!!this.baseline,actions:[],blocking:false,progress:0};
    }
    const l=points[11],r=points[12],width=Math.hypot(l.x-r.x,l.y-r.y);
    if(width<.1)return {visible:false,ready:false,actions:[],blocking:false,progress:0};
    const center={x:(l.x+r.x)/2,y:(l.y+r.y)/2};
    const v={time,cx:center.x,cy:center.y,width,left:{x:(points[15].x-l.x)/width,y:(points[15].y-l.y)/width},right:{x:(points[16].x-r.x)/width,y:(points[16].y-r.y)/width}};
    this.lastSeen=time;
    if(this.calibrating){
      const first=this.samples[0];if(first&&Math.abs(first.cx-v.cx)>width*.2)this.samples=[];
      this.samples.push(v);const elapsed=time-this.samples[0].time;const progress=Math.min(1,elapsed/2.5);
      if(progress>=1){const avg=key=>this.samples.reduce((s,p)=>s+p[key],0)/this.samples.length;this.baseline={cx:avg('cx'),cy:avg('cy'),width:avg('width')};this.calibrating=false;this.previous=v;}
      return {visible:true,ready:!!this.baseline,calibrating:this.calibrating,progress,actions:[],blocking:false};
    }
    if(!this.baseline){this.previous=v;return {visible:true,ready:false,actions:[],blocking:false};}
    const actions=[];const lean=(center.x-this.baseline.cx)/this.baseline.width;
    // Both hands raised = guard. Keep this mutually exclusive with strikes.
    const blocking=v.left.y<-.1&&v.right.y<-.1;
    if(Math.abs(lean)<.13)this.leanArmed=true;
    if(Math.abs(lean)>.30&&this.leanArmed&&time-this.lastAction.dodge>.9){actions.push(lean>0?'dodgeLeft':'dodgeRight');this.lastAction.dodge=time;this.leanArmed=false;}
    if(this.previous&&!blocking&&!this.blocking){
      const dt=time-this.previous.time;
      if(dt>.012&&dt<.25){
        for(const side of ['left','right']){
          const hand=v[side],prev=this.previous[side];const speed=Math.hypot(hand.x-prev.x,hand.y-prev.y)/dt;
          const outward=(Math.hypot(hand.x,hand.y)-Math.hypot(prev.x,prev.y))/dt;
          const upward=(prev.y-hand.y)/dt;
          if(speed<.65||hand.y>.65)this.armed[side]=true;
          if(this.armed[side]&&time-this.lastAction[side]>.4){
            if(upward>2.8&&hand.y<-.35&&time-this.lastAction.special>.85){actions.push('special');this.lastAction.special=time;this.lastAction[side]=time;this.armed[side]=false;}
            else if(speed>2.1&&outward>.65&&hand.y<.65){actions.push(side);this.lastAction[side]=time;this.armed[side]=false;}
          }
        }
      }
    }
    this.previous=v;this.blocking=blocking;
    return {visible:true,ready:true,actions,blocking,lean};
  }
}
