export const WEAPONS = {
  fists: {name:'STEEL FISTS', tag:'MELEE / COMBO', description:'Pukulan cepat. Kombo panjang dengan konsumsi energi rendah.', cost:0, damage:12, cooldown:.28, specialCost:24, symbol:'⟐'},
  blade: {name:'PLASMA BLADE', tag:'MELEE / ARMOR BREAK', description:'Tebasan plasma. Spesial memecahkan armor dengan cepat.', cost:300, damage:17, cooldown:.36, specialCost:30, symbol:'╱'},
  cannon: {name:'ARC CANNON', tag:'RANGED / BURST', description:'Tembakan energi. Spesial melepaskan ledakan bermuatan.', cost:500, damage:21, cooldown:.47, specialCost:38, symbol:'⊙'},
};
export const UPGRADES = {
  armor:{name:'ARMOR', description:'+20 ketahanan per level.', cost:150},
  reactor:{name:'REACTOR', description:'+15 energi dan regenerasi lebih cepat.', cost:170},
  actuator:{name:'ACTUATOR', description:'+8% damage dan serangan lebih cepat.', cost:190},
};
export function newProfile(){return {version:1,credits:300,wins:0,bestCombo:0,equipped:'fists',owned:['fists'],upgrades:{armor:0,reactor:0,actuator:0}};}
export function sanitizeProfile(data){
  const p=newProfile();if(!data||data.version!==1)return p;
  const int=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
  p.credits=int(data.credits,1e7);p.wins=int(data.wins,1e5);p.bestCombo=int(data.bestCombo,1e4);
  p.owned=['fists',...['blade','cannon'].filter(k=>Array.isArray(data.owned)&&data.owned.includes(k))];
  p.equipped=p.owned.includes(data.equipped)?data.equipped:'fists';
  for(const k in UPGRADES)p.upgrades[k]=int(data.upgrades?.[k],5);return p;
}
export function buyWeapon(p,id){const w=WEAPONS[id];if(!w)return false;if(p.owned.includes(id)){p.equipped=id;return true;}if(p.credits<w.cost)return false;p.credits-=w.cost;p.owned.push(id);p.equipped=id;return true;}
export function upgradeCost(p,id){return UPGRADES[id]?UPGRADES[id].cost*(p.upgrades[id]+1):Infinity;}
export function buyUpgrade(p,id){if(!UPGRADES[id]||p.upgrades[id]>=5)return false;const cost=upgradeCost(p,id);if(p.credits<cost)return false;p.credits-=cost;p.upgrades[id]++;return true;}
export class Combat {
  constructor(profile,{training=false,rng=Math.random}={}){
    this.profile=profile;this.training=training;this.rng=rng;this.events=[];this.time=0;this.duration=120;this.status='playing';this.weapon=WEAPONS[profile.equipped];this.weaponId=profile.equipped;
    this.maxHp=100+profile.upgrades.armor*20;this.hp=this.maxHp;this.maxEnergy=100+profile.upgrades.reactor*15;this.energy=this.maxEnergy;
    this.enemyMaxHp=training?500:680+Math.min(profile.wins,10)*35;this.enemyHp=this.enemyMaxHp;this.enemyArmor=100;this.armorBrokenUntil=0;
    this.combo=0;this.bestCombo=0;this.lastHit=-10;this.lastSide='';this.nextAttack=0;this.blocking=false;this.blockSince=-10;this.dodgeUntil=0;this.nextDodge=0;this.overdrive=0;this.overdriveUntil=0;this.enemyStunUntil=0;
    this.enemyAttackAt=3;this.telegraph=false;this.attackType=0;this.reward=0;this.damageTaken=0;
  }
  emit(type,data={}){this.events.push({type,...data});}
  drainEvents(){return this.events.splice(0);}
  setBlock(value){if(this.status!=='playing')return;if(value&&!this.blocking)this.blockSince=this.time;this.blocking=!!value&&this.energy>2;}
  act(action){
    if(this.status!=='playing')return false;
    if(action==='overdrive'){
      if(this.overdrive<100||this.overdriveUntil>this.time)return false;
      this.overdrive=0;this.overdriveUntil=this.time+8;this.energy=this.maxEnergy;this.emit('overdrive');return true;
    }
    if(action==='dodgeLeft'||action==='dodgeRight'){
      if(this.energy<14||this.time<this.nextDodge)return false;
      this.energy-=14;this.dodgeUntil=this.time+.55;this.nextDodge=this.time+.8;this.blocking=false;this.emit('dodge',{direction:action==='dodgeLeft'?-1:1});return true;
    }
    if(!['left','right','special'].includes(action)||this.time<this.nextAttack||this.blocking)return false;
    const special=action==='special';const active=this.time<this.overdriveUntil;
    const cost=special?this.weapon.specialCost:(this.weaponId==='cannon'?7:0);
    if(this.energy<cost){this.emit('lowEnergy');return false;}this.energy-=cost;
    this.nextAttack=this.time+(special?.65:this.weapon.cooldown)*(1-this.profile.upgrades.actuator*.045)*(active?.65:1);
    if(this.time-this.lastHit>1.6)this.combo=0;
    this.combo++;this.bestCombo=Math.max(this.combo,this.bestCombo);this.lastHit=this.time;
    const alternating=this.lastSide!==action;this.lastSide=action;
    const finisher=this.combo%3===0;const broken=this.time<this.armorBrokenUntil;
    let damage=this.weapon.damage*(1+this.profile.upgrades.actuator*.08)*(special?2:1)*(active?1.4:1)*(finisher&&alternating?1.6:1)*(broken?1.5:.82);
    damage=Math.round(damage);this.enemyHp=Math.max(0,this.enemyHp-damage);
    if(!broken){this.enemyArmor=Math.max(0,this.enemyArmor-(special?(this.weaponId==='blade'?48:32):12));if(this.enemyArmor===0){this.armorBrokenUntil=this.time+5;this.enemyStunUntil=this.time+1.5;this.telegraph=false;this.enemyAttackAt=Math.max(this.enemyAttackAt,this.time+2.5);this.emit('armorBreak');}}
    if(!active)this.overdrive=Math.min(100,this.overdrive+(special?11:8));
    this.emit('attack',{side:action,damage,finisher,combo:this.combo,weapon:this.weaponId});
    if(finisher)this.emit('combo',{count:this.combo,name:special?'REACTOR FINISH':alternating?'CROSS BREAK':'HEAVY CHAIN'});
    if(this.enemyHp<=0){if(this.training){this.enemyHp=this.enemyMaxHp;this.enemyArmor=100;this.armorBrokenUntil=0;this.emit('dummyReset');}else this.finish(true);}
    return true;
  }
  finish(won){if(this.status!=='playing')return;this.status=won?'won':'lost';this.blocking=false;this.telegraph=false;this.reward=won?300+Math.min(150,this.bestCombo*5):75;this.profile.credits+=this.reward;if(won)this.profile.wins++;this.profile.bestCombo=Math.max(this.profile.bestCombo,this.bestCombo);this.emit('result',{won,reward:this.reward});}
  tick(dt){
    if(this.status!=='playing')return;dt=Math.min(Math.max(dt,0),.1);this.time+=dt;
    const regen=8+this.profile.upgrades.reactor*2;
    this.energy=Math.min(this.maxEnergy,Math.max(0,this.energy+(this.blocking?-13:regen)*dt));
    if(this.blocking&&this.energy<1){this.blocking=false;this.emit('guardBreak');}
    if(this.time-this.lastHit>1.6)this.combo=0;
    if(this.enemyArmor===0&&this.time>=this.armorBrokenUntil){this.enemyArmor=100;this.emit('armorRestore');}
    if(this.training)return;
    if(this.time>=this.duration){this.finish(this.hp/this.maxHp>this.enemyHp/this.enemyMaxHp);return;}
    if(this.time<this.enemyStunUntil)return;
    if(!this.telegraph&&this.time>=this.enemyAttackAt-.9){this.telegraph=true;this.attackType=this.rng()<.35?1:0;this.emit('telegraph',{heavy:!!this.attackType});}
    if(this.time>=this.enemyAttackAt){
      const heavy=!!this.attackType;let amount=heavy?25:16;let outcome='hit';
      if(this.time<this.dodgeUntil){amount=0;outcome='evade';this.overdrive=Math.min(100,this.overdrive+12);}
      else if(this.blocking&&this.time-this.blockSince<=.4){amount=0;outcome='parry';this.enemyStunUntil=this.time+1.8;this.overdrive=Math.min(100,this.overdrive+22);this.energy=Math.min(this.maxEnergy,this.energy+15);}
      else if(this.blocking){amount=heavy?9:3;outcome='block';this.energy=Math.max(0,this.energy-(heavy?22:12));}
      else {this.combo=0;}
      this.hp=Math.max(0,this.hp-amount);this.damageTaken+=amount;this.emit('enemyAttack',{outcome,damage:amount,heavy});this.telegraph=false;
      this.enemyAttackAt=this.time+2.3+this.rng()*1.3+(outcome==='parry'?1:0);
      if(this.hp<=0)this.finish(false);
    }
  }
}
