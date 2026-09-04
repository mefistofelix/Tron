import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Execute the product's real simulation and networking code, without WebGL or a browser.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const section=(a,b)=>script.slice(script.indexOf(a),script.indexOf(b,script.indexOf(a)));
const core=[section('const COLORS=','class Soundscape'),section('function startSolo()','// WebGL renderer'),section('function visibleWall(','function render('),section('// Host-authoritative simulation','function selectedFlow()')].join('\n');
const ui=new Proxy({},{get:(_,key)=>key==='value'?'RIDER':key==='classList'?{add(){},remove(){},toggle(){}}:()=>{}});
function game(){
  const clock={now:0};
  const make=new Function('clock',`const ui=arguments[1]; const performance={now:()=>clock.now},localStorage={getItem:()=>null},$=()=>ui,document={body:ui},audio={init(){},tone(){},noise(){}},clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t; function resetChat(){} function applyLocalPreferences(){} function acceptChat(){} function showToast(){} function closeNetwork(){} function updateHUD(){} function setRulesOpen(){} function announcePresence(){}\n${core}\nreturn {syncAICount,removeAutoPeer,state,cfg,DIRS,hostPeers,makeCycle,packCycle,packWall,activeSegment,finalizedWall,segmentDistance,rayHit,rayDistance,sideGrind,queueTurn,applyTurn,advanceCycle,step,crash,carveGap,respawnCycle,playerAction,replayGuestTo,reconcileGuest,displayCycles,handleNet,receiveSnapshot,initPayload,sendSnapshot,sendInit,sendWalls,netSend,updateGuest,resetGuestPrediction,visibleWall,setHost:v=>isHost=v,setTransport:a=>autoAction=a,setHostPeer:p=>autoHostPeer=p,setRtt:r=>netRtt=r,get pending(){return guestPendingTurns},get predicted(){return predictedWalls},get guestTick(){return guestTick},get lastSnapshotTick(){return lastSnapshotTick},get outbox(){return snapshotOutbox}}`);
  const g=make(clock,ui);g.clock=clock;g.state.mode='solo';g.state.running=true;g.state.round=1;return g
}
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message)};
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message)};
const close=(a,b,message)=>check(Math.abs(a-b)<1e-7,message);
function cardinal(g){for(const w of [...g.state.walls,...g.predicted,...g.state.cycles.filter(c=>c.alive).map(g.activeSegment)])check(w.x1===w.x2||w.z1===w.z2,'all physical/visible walls must be cardinal')}

for(const origin of [0,1e6])for(let dir=0;dir<4;dir++){
  const g=game(),d=g.DIRS[dir],n={x:-d.z,z:d.x},p=(a,b)=>({x:origin+d.x*a+n.x*b,z:origin+d.z*a+n.z*b});
  const w=(a,b,c,e,owner=1)=>{const s=p(a,b),t=p(c,e);return{id:10,owner,x1:s.x,z1:s.z,x2:t.x,z2:t.z}};
  const hit=(a,b)=>{const q=p(a,b),c=g.makeCycle(1,'test','#31ecff',q.x,q.z,dir,true,false);return g.rayHit(c,d,5)};
  g.state.walls=[w(2,-1,2,1)];close(hit(0,0).distance,2,'perpendicular crossing');
  g.state.walls=[w(0,0,3,0)];eq(hit(1,0).distance,0,'collinear retracing must collide');
  g.state.walls=[w(0,-.00001,3,-.00001),w(0,.00001,3,.00001)];eq(hit(1,0).owner,null,'arbitrarily narrow positive corridor');
  g.state.walls=[w(2,0,2,1)];Object.assign(g.state.walls[0],{entryDir:dir,entryX:p(2,0).x,entryZ:p(2,0).z});
  close(hit(0,.02).distance,2,'old corner exemption must not open holes');eq(hit(0,-.02).owner,null,'outside corner cannot protrude');
  g.state.walls=[w(2,-.000001,2,.000001,2)];close(hit(0,0).distance,2,'tiny perpendicular wall');
}
{
  const g=game(),c=g.makeCycle(0,'tiny','#31ecff',0,0,0,true,false);g.state.cycles=[c];c.speed=g.cfg.minSpeed;
  let retained=0;for(let i=0;i<400&&c.alive;i++){g.queueTurn(c,'right');g.step(1/60);retained=Math.max(retained,g.state.walls.length)}
  check(retained>0,'rapid turns must retain short walls');check(!c.alive,'repeated exact small loops must crash');
}
{
  const g=game(),c=g.makeCycle(0,'survivor','#31ecff',10,0,1,true,false),victim=g.makeCycle(1,'victim','#ff3da8',100,0,0,true,false);
  c.trailX=0;g.state.cycles=[c,victim];g.crash(victim);
  const attached=g.state.walls.find(w=>w.owner===0);eq(c.ignoreWall,attached.id,'unrelated explosion preserves adjacent wall identity');
  g.applyTurn(c,'right');eq(g.rayHit(c,g.DIRS[c.dir],2).owner,null,'turn immediately after external trail finalization');
  for(let i=0;i<60;i++)g.step(1/60);check(c.alive,'survivor must remain alive');
}
{
  const g=game(),w={id:7,owner:0,x1:0,z1:0,x2:10,z2:0};g.state.walls=[w];g.carveGap(100,0,4.4);
  eq(g.state.walls[0],w,'untouched wall retains exact data');check(g.state.walls[0]===w,'untouched wall retains identity');
  g.state.walls=[{...w,x1:10,x2:-10}];g.carveGap(0,0,4);
  eq(g.state.walls.map(w=>[w.x1,w.x2]),[[10,4],[-4,-10]],'carved reverse segment preserves direction');eq(g.state.walls[1].id,7,'endpoint fragment keeps adjacency identity');
  const packed=g.packWall({id:1,owner:0,x1:.0001,z1:0,x2:.0001,z2:2});eq(packed.x1,.0001,'network preserves submillimetre coordinates');
}
{
  const g=game(),c=g.makeCycle(0,'test','#31ecff',2,0,1,true,false);c.trailX=0;g.state.cycles=[c];g.applyTurn(c,'right');
  g.state.walls.push({id:999,owner:0,x1:0,z1:0,x2:3,z2:0});eq(g.rayHit(c,g.DIRS[2],1).wallId,999,'only attached wall exempted at departing junction');
}
{
  const g=game(),c=g.makeCycle(0,'corridor','#31ecff',0,0,1,true,false);c.speed=82;g.state.cycles=[c];
  g.state.walls=[{id:1,owner:1,x1:-100,z1:-.0001,x2:2000,z2:-.0001},{id:2,owner:2,x1:-100,z1:.0001,x2:2000,z2:.0001}];
  for(let i=0;i<300;i++)g.step(1/60);check(c.alive&&c.x>400,'high-speed narrow corridor stays safe');
}

{
  const g=game(),c=g.makeCycle(0,'coast','#31ecff',0,0,1,true,false);g.state.cycles=[c];c.speed=g.cfg.maxSpeed;
  for(let i=0;i<60;i++)g.advanceCycle(c,1/60);
  close(c.speed,g.cfg.baseSpeed+(82-g.cfg.baseSpeed)*(1-g.cfg.coastDrag/60)**60,'coasting uses slower exponential drag');
  check(c.speed>62&&c.speed<64,'one second after boost retains meaningful momentum');
  c.speed=12;g.advanceCycle(c,1/60);close(c.speed,12+(g.cfg.baseSpeed-12)*.68/60,'below-base recovery unchanged');
  c.speed=82;c.brake=true;c.brakeEnergy=1;g.advanceCycle(c,1/60);close(c.speed,82+(g.cfg.baseSpeed-82)*.68/60-23/60,'powered brake retains previous effectiveness');
  c.speed=82;c.brakeEnergy=0;g.advanceCycle(c,1/60);close(c.speed,82+(g.cfg.baseSpeed-82)*g.cfg.coastDrag/60,'empty brake coasts naturally');
}

{
  const segments=[],floors=[];
  const geometry=new Function('line','quad',`const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),state={mode:'solo',time:2},cfg={wallHeight:1.48},hex=(c,a)=>[1,1,1,a];${script.split('\n').find(s=>s.includes('function pointSegDistance('))} ${section('const VIEW_RANGE=','function shader(')} ${section('function worldHash(','function visibleWall(')} ${section('function wallGeom(','function bikeHull(')};return{VIEW_RANGE,vs,fs,gridGeom,boardGeom,wallGeom}`)((a,b,color)=>segments.push({a,b,color}),(a,b,c,d,color)=>floors.push({a,b,c,d,color}));
  const r=geometry.VIEW_RANGE;check(r.grid>r.fogEnd+50&&r.wall>r.fogEnd+50,'geometry covers full fog range plus chase offset');check(r.far>Math.SQRT2*r.floor+60,'far plane covers floor corners');
  check(geometry.vs.includes('(aPos.xz-uCam.xz)/620.0')&&geometry.fs.includes('length(vFog)'),'fog uses normalized camera-relative varying for mobile precision');
  geometry.gridGeom(0,0);const first=segments.slice();check(first.length<300,'extended horizon keeps grid geometry bounded');
  segments.length=0;geometry.gridGeom(51,101);const shifted=segments.slice();
  for(const s of first){const axis=s.a[0]===s.b[0]?0:2,value=s.a[axis],same=shifted.find(t=>t.a[axis]===value&&t.b[axis]===value);if(same)eq(s.color,same.color,'major/minor world grid classification never shifts')}
  segments.length=0;geometry.boardGeom(0,0);check(segments.length>0&&segments.length<2000,'near circuit detail bounded independently of horizon');
  check(segments.every(s=>s.a[0]===s.b[0]||s.a[2]===s.b[2]),'circuit paths and pulses remain cardinal');check(segments.every(s=>s.color[3]>0&&s.color[3]<=1),'circuit distance fades stay valid');
  check(r.near>=.5&&geometry.vs.includes('varying mediump vec2 vFog')&&geometry.fs.includes('varying mediump vec2 vFog'),'mobile fog precision matches and depth range stays useful');
  segments.length=floors.length=0;geometry.wallGeom({x1:1,z1:1,x2:10000,z2:1},{x:0,z:0});eq(floors.length,1,'long walls crossing nearby retain full surface');
  segments.length=floors.length=0;geometry.wallGeom({x1:500,z1:0,x2:510,z2:0},{x:0,z:0});eq(floors.length,0,'far walls avoid surface geometry');eq(segments.length,1,'far walls retain luminous edge');
  segments.length=floors.length=0;for(let i=0;i<20000;i++){const x=i%142*10-710,z=Math.floor(i/142)*10-710;geometry.wallGeom({x1:x,z1:z,x2:x+5,z2:z},{x:0,z:0})}
  check(floors.length<segments.length*.5&&segments.length<20000,'dense histories bound surface generation and cull distant walls');
}

// Two independent copies of the real game with artificial transit delays and jitter.
async function networkScenario(delay,jitter=0){
  const host=game(),guest=game(),messages=[],peer={id:1,peerId:'guest',name:'guest'};
  host.setHost(true);host.state.mode='host';host.hostPeers.set(1,peer);host.state.cycles=[host.makeCycle(0,'host','#31ecff',10000,10000,1,true,false),host.makeCycle(1,'guest','#ff3da8',0,0,1,true,false)];
  guest.state.mode='guest';guest.setHost(false);guest.setHostPeer('host');guest.setRtt(delay*2/1000);
  let time=0,count=0,lastHostDelivery=0,lastGuestDelivery=0;
  const send=(to,message)=>{const offset=jitter?Math.sin(++count*2.7)*jitter:0;let at=time+Math.max(0,delay+offset);if(to===guest){at=Math.max(at,lastHostDelivery);lastHostDelivery=at}else{at=Math.max(at,lastGuestDelivery);lastGuestDelivery=at}messages.push({to,at,message:structuredClone(message)});return Promise.resolve()};
  host.setTransport({send:m=>send(guest,m)});guest.setTransport({send:m=>send(host,m)});
  guest.handleNet(structuredClone(host.initPayload(1)),null);
  let errors=[],turns=0;
  for(let frame=1;frame<=600;frame++){
    time=frame*1000/60;host.clock.now=guest.clock.now=time;
    messages.sort((a,b)=>a.at-b.at);
    while(messages.length&&messages[0].at<=time){const e=messages.shift();e.to.handleNet(e.message,e.to===host?peer:null)}
    // Wide zigzag route avoids actual crossings, including rapid pairs and held brake.
    if([45,110,175,240,305,370,435,500].includes(frame)){guest.playerAction(turns++%2?'left':'right')}
    if(frame===200)guest.playerAction('brake',true);if(frame===225)guest.playerAction('brake',false);
    host.step(1/60);guest.updateGuest(1/60,time);await Promise.resolve();await Promise.resolve();
    cardinal(host);cardinal(guest);
    for(const c of guest.displayCycles(time)){const w=guest.activeSegment(c);check(w.x1===w.x2||w.z1===w.z2,'extrapolated remote wall remains cardinal')}
    if(frame>550){const gc=guest.state.cycles.find(c=>c.id===1),hc=host.state.cycles.find(c=>c.id===1);errors.push(Math.abs((gc.x-hc.x)*(-host.DIRS[hc.dir].z)+(gc.z-hc.z)*host.DIRS[hc.dir].x))}
  }
  const hc=host.state.cycles[1],gc=guest.state.cycles.find(c=>c.id===1);
  check(hc.alive&&gc.alive,'safe multiplayer route must not produce unexplained deaths');eq(hc.inputAck,10,'host applies all turns and brake edges');eq(guest.pending.length,0,'all inputs acknowledged');check(Math.max(...errors)<1e-7,'reconciliation preserves exact lateral lane');
  console.log(`network simulation passed: ${delay*2} ms RTT, ±${jitter} ms jitter`);
  return {host,guest}
}
await networkScenario(25);await networkScenario(100,20);await networkScenario(180,45);
{
  const {host,guest}=await networkScenario(50,10),before=guest.lastSnapshotTick,c=host.state.cycles[1];
  guest.handleNet({...host.initPayload(1),t:'snap',tick:before-1,cycles:[{...host.packCycle(c),x:9999}]},null);eq(guest.lastSnapshotTick,before,'stale snapshot ignored');
  const oldLife=c.life;host.respawnCycle(c);host.state.needsSnapshot=false;
  guest.handleNet(host.initPayload(1),null);eq(guest.state.cycles.find(c=>c.id===1).life,oldLife+1,'respawn generation synchronized');
  guest.handleNet({t:'crash',round:host.state.round,life:oldLife,id:1,x:0,z:0},null);check(guest.state.cycles.find(c=>c.id===1).alive,'old life crash ignored');
}
{
  const g=game(),c=g.makeCycle(0,'rider','#31ecff',0,0,1,true,false);g.state.cycles=[c];g.state.mode='guest';g.setRtt(.1);
  g.reconcileGuest(g.packCycle(c),0,0);g.playerAction('brake',true);g.playerAction('brake',false);
  eq(g.pending.map(m=>m.down),[true,false],'brake press/release within one frame both queued');
  g.replayGuestTo(g.guestTick+3);check(!c.brake,'rapid brake release does not stick');
  const settled=g.packCycle(c);g.reconcileGuest(settled,20,100);g.clock.now=100;
  const previous=c.dir;g.playerAction('right');g.clock.now=100+1000/60;g.updateGuest(1/60,g.clock.now);eq(c.dir,(previous+1)%4,'guest turn appears within one frame without host response');
}
{
  const g=game(),c=g.makeCycle(1,'guest','#31ecff',0,0,1,true,false),peer={id:1};g.state.cycles=[c];g.state.tick=100;g.state.mode='host';g.setHost(true);
  const input=(seq,tick,life=c.life)=>({t:'input',seq,tick,life,round:1,action:'right'});
  g.handleNet(input(1,80),peer);g.handleNet(input(2,81),peer);g.handleNet(input(2,81),peer);
  eq(c.turnQueue.map(m=>m.tick),[101,102],'late burst retains separate turn ticks; duplicates discarded');
  g.step(1/60);eq(c.dir,2,'first late turn');check(c.z>0,'movement separates late turns');
  g.step(1/60);eq(c.dir,3,'second late turn');check(c.x<0,'second late turn moves separately');
  g.handleNet(input(3,105,c.life-1),peer);eq(c.turnQueue.length,0,'old-life input rejected');
}
{
  const g=game(),c=g.makeCycle(0,'rider','#31ecff',0,0,1,true,false);g.state.cycles=[c];c.rubber=.95;
  g.state.walls=[{id:1,owner:1,x1:0,z1:.0001,x2:100,z2:.0001}];
  for(let i=0;i<60;i++)g.step(1/60);
  check(c.alive&&c.rubber===0,'clear parallel travel recovers rubber and cannot crash');
  const wall={id:2,owner:1,x1:c.x+.1,z1:-1,x2:c.x+.1,z2:1};g.state.walls=[wall];c.rubber=.5;
  for(let i=0;i<80&&c.alive;i++){wall.id++;g.step(1/60)}check(!c.alive,'changing segment identity cannot recharge exhausted rubber');
  check(g.state.running,'solo with zero AI stays running after death');
  for(let i=0;i<300;i++)g.step(1/60);check(c.alive,'solo respawns after death');
}
{
  const host=game(),guest=game();host.state.cycles=[host.makeCycle(0,'host','#31ecff',100,100,1,true,false),host.makeCycle(1,'guest','#ff3da8',0,0,1,true,false)];
  guest.handleNet(host.initPayload(1),null);guest.clock.now=2000;
  const snapshot={...host.initPayload(1),t:'snap',tick:3,time:.05,revision:1};
  guest.handleNet(snapshot,null);eq(guest.lastSnapshotTick,0,'snapshot waits for referenced wall revision');
  guest.handleNet({t:'wall',round:1,revision:1,wall:{id:1,owner:0,x1:100,z1:100,x2:110,z2:100}},null);
  eq(guest.lastSnapshotTick,3,'wall arrival releases waiting snapshot');
  guest.handleNet(host.initPayload(1),null);eq(guest.lastSnapshotTick,3,'old full initialization cannot rewind current state');
  guest.playerAction('right');const seq=guest.pending[0].seq;
  guest.handleNet({...snapshot,t:'init',you:1,walls:guest.state.walls,tick:4,time:4/60},null);
  check(guest.pending.some(m=>m.seq===seq),'same-life resync preserves in-flight controls');
}
{
  const g=game(),sent=[];g.setHost(true);g.hostPeers.set(1,{peerId:'guest'});let release;
  g.setTransport({send:m=>{sent.push(m.tick);return new Promise(r=>release=r)}});
  for(let tick=1;tick<=10;tick++)g.netSend({t:'snap',tick});
  eq(sent,[1],'only one snapshot in flight per peer');release();await Promise.resolve();
  eq(sent,[1,10],'congested snapshot queue coalesces to newest state');release();await Promise.resolve();
}
{
  const host=game(),guest=game(),peer={id:1,peerId:'departing'};
  host.state.cycles=[host.makeCycle(0,'host','#31ecff',100,100,1,true,false),host.makeCycle(1,'guest','#ff3da8',0,0,1,true,false),host.makeCycle(100,'bot','#f0ff00',50,50,1,false,true)];
  host.state.walls=[{id:1,owner:100,x1:10,z1:0,x2:10,z2:10},{id:2,owner:1,x1:20,z1:0,x2:20,z2:10}];host.state.wallRevision=2;
  host.setHost(true);host.state.mode='host';guest.handleNet(host.initPayload(1),null);
  host.syncAICount(0,false);eq(host.state.wallRevision,3,'AI wall removal advances revision');
  guest.handleNet({...host.initPayload(1),t:'snap',tick:3,time:.05},null);eq(guest.lastSnapshotTick,0,'snapshot cannot overtake AI wall deletion');
  guest.handleNet(host.initPayload(1),null);check(!guest.state.walls.some(w=>w.owner===100),'AI walls deleted on guest');
  host.hostPeers.set(1,peer);host.removeAutoPeer(peer.peerId);eq(host.state.wallRevision,4,'human wall removal advances revision');
}
{
  const g=game();g.state.cycles=[g.makeCycle(0,'human','#31ecff',0,0,1,true,false)];g.syncAICount(6,false);
  for(let frame=0;frame<10800;frame++){
    const before=g.state.cycles.map(c=>({...c}));g.step(1/60);
    for(const old of before){const c=g.state.cycles.find(c=>c.id===old.id);if(!old.alive||!c.alive||old.life!==c.life)continue;
      const travel=Math.hypot(c.x-old.x,c.z-old.z);if(!travel||old.invuln>0)continue;
      const probe={...old,dir:c.dir,ignoreWall:c.ignoreWall};
      // An AI must never end up beyond a pre-existing perpendicular line that still exists.
      const crossed=g.state.walls.some(w=>{if(w.born>=g.state.time-1/60)return false;const hit=g.segmentDistance(probe,g.DIRS[c.dir],w);return hit>0&&hit<travel-1e-8});
      check(!crossed,'three-minute AI simulation never tunnels through a retained wall');
    }
    if(frame%120===0)cardinal(g);
  }
  check(g.state.running,'three-minute six-AI simulation stays active');console.log('three-minute six-AI simulation passed');
}
console.log(`${checks} regression assertions passed`);
