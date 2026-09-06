import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const script=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const section=(a,b)=>script.slice(script.indexOf(a),script.indexOf(b,script.indexOf(a)));
const core=[section('const COLORS=','class Soundscape'),section('function startSolo()','// WebGL renderer'),section('function visibleWall(','function render('),section('function advanceGameClock(','function loop('),section('// Host-authoritative simulation','function selectedFlow()')].join('\n');
function game(){
  const clock={now:0},ui=new Proxy({},{get:(_,key)=>key==='value'?'RIDER':key==='classList'?{add(){},remove(){},toggle(){}}:()=>{}});
  const api=new Function('clock','ui',`
    const performance={now:()=>clock.now},localStorage={getItem:()=>null,setItem(){}},$=()=>ui,document={body:ui,hidden:false},audio={init(){},tone(){},noise(){}},clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t;
    const location={origin:'https://game.test',pathname:'/',href:'https://game.test/',hash:''},history={replaceState(a,b,href){const u=new URL(href,location.origin);location.href=u.href;location.hash=u.hash}};
    function resetChat(){} function applyLocalPreferences(){} function acceptChat(){} function showToast(){} function closeNetwork(){} function updateHUD(){} function setRulesOpen(){} function announcePresence(){}
    ${core}
    return {state,DIRS,document,makeCycle,activeSegment,certifiedSpawn,chooseSafeSpawn,safeBotSpawn,spawnRunwaySafe};
  `)(clock,ui);api.clock=clock;return api;
}
const box=(r,o=0)=>[{x1:o-r,z1:o-r,x2:o+r,z2:o-r},{x1:o+r,z1:o-r,x2:o+r,z2:o+r},{x1:o+r,z1:o+r,x2:o-r,z2:o+r},{x1:o-r,z1:o+r,x2:o-r,z2:o-r}].map((w,i)=>({...w,id:i+1,owner:90}));
for(const origin of [0,1e6]){
  const g=game();g.state.cycles=[g.makeCycle(0,'human','#31ecff',origin,origin,1,true,false)];
  g.state.walls=box(80,origin);assert.equal(g.certifiedSpawn(origin+24,origin,[],g.state.walls),null,'closed pocket rejected');
  let p=g.chooseSafeSpawn(-1);assert.ok(Math.abs(p.x-origin)>80||Math.abs(p.z-origin)>80,'spawn outside sealed box');
  g.state.walls=[...box(60,origin),...box(800,origin)];const original=JSON.stringify(g.state.walls);p=g.chooseSafeSpawn(-1);
  assert.ok(Math.abs(p.x-origin)>800||Math.abs(p.z-origin)>800,'huge enclosing wall defeats local-boundary false escape');assert.equal(JSON.stringify(g.state.walls),original,'selector never carves walls');
}
{
  const g=game(),walls=box(80),active=g.makeCycle(1,'rider','#ff3da8',-80,-80,0,true,false);active.trailX=-80;active.trailZ=80;
  assert.equal(g.certifiedSpawn(0,0,[],[...walls.slice(0,3),g.activeSegment(active)]),null,'active fourth side closes pocket');
  assert.ok(g.certifiedSpawn(0,0,[],walls.slice(0,3)),'open fourth side permits escape');
  const crossing=g.makeCycle(2,'rider','#ff3da8',50,-20,3,true,false);crossing.speed=82;
  assert.equal(g.spawnRunwaySafe(0,0,0,[crossing]),false,'projected fast rider crosses initial runway');
  const x=g.makeCycle(3,'rider','#ff3da8',25,20,2,true,false);x.trailX=25;x.trailZ=-20;g.state.cycles=[g.makeCycle(0,'human','#31ecff',0,0,1,true,false),x];
  assert.equal(g.certifiedSpawn(25,0,[],[g.activeSegment(x)]),null,'active trail blocks spawn point');assert.notDeepEqual(g.safeBotSpawn(0),{x:25,z:0,dir:1});
  const bent=[{x1:-20,z1:-100,x2:-20,z2:100},{x1:100,z1:-100,x2:100,z2:100},{x1:-20,z1:-20,x2:100,z2:-20},{x1:-20,z1:20,x2:30,z2:20}];
  assert.ok(g.certifiedSpawn(0,0,[],bent),'two-leg escape around corner accepted');
}
console.log('spawn enclosure, active-wall and moving-lane checks passed');

// Cloud directory/signaling coverage is in cloud-lobby.mjs.

// Audio-clock scheduling checks, using the real score without claiming a listening test.
const audioCode=section('const MUSIC_BPM=','function syncSoundButton(');
const audioAPI=new Function('localStorage',`${audioCode};return{Soundscape,MUSIC_STEP,MUSIC_MELODY}`)({getItem:()=>null});
const sound=new audioAPI.Soundscape(),events=[];sound.ctx={state:'running',currentTime:0};sound.musicCell=(step,t)=>events.push({step,t});sound.music();
sound.ctx.currentTime=.075;sound.music();sound.ctx.currentTime=.18;sound.music();
for(let i=1;i<events.length;i++)assert.ok(Math.abs(events[i].t-events[i-1].t-audioAPI.MUSIC_STEP)<1e-10,'audio-clock beats stay evenly spaced despite callback jitter');
sound.ctx.currentTime=45;const before=events.length;sound.music();assert.ok(events.length-before<3,'resume skips stale beats rather than bursting');assert.equal(events[before].step%16,0,'resume aligns to bar');
sound.muted=true;sound.ctx.currentTime=46;const muted=events.length;sound.music();assert.equal(events.length,muted,'saved mute respected');
assert.ok(audioAPI.MUSIC_MELODY.every(phrase=>phrase.some(note=>note[2]>=5)),'melody retains varied phrase lengths');
console.log('music score and audio-clock scheduler checks passed');
{
  const scheduled=[];
  const param=()=>({value:0,setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v},exponentialRampToValueAtTime(v,t){assert.ok(v>0&&Number.isFinite(t));this.value=v},setTargetAtTime(v,t,k){assert.ok(Number.isFinite(v)&&Number.isFinite(t)&&k>0);this.target=v}});
  const node=()=>({gain:param(),pan:param(),frequency:param(),detune:param(),Q:param(),delayTime:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(n){assert.ok(n);return n},disconnect(){this.disconnected=true},start(t=0){assert.ok(t>=0);this.started=t;scheduled.push(this)},stop(t){assert.ok(t>=(this.started||0)&&Number.isFinite(t));this.stopped=t}});
  class Context{constructor(){this.state='running';this.currentTime=0;this.sampleRate=48000;this.destination=node()}async resume(){}createGain(){return node()}createStereoPanner(){return node()}createOscillator(){return node()}createDynamicsCompressor(){return node()}createDelay(){return node()}createBiquadFilter(){return node()}createBufferSource(){return node()}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)}}}
  const audioState={mode:'guest',running:true,cycles:[]};
  const {Soundscape:Sound,nearbyMotorMix}=new Function('localStorage','window','state','DIRS',`const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),setInterval=()=>1;function syncSoundButton(){} function showToast(){} function syncMusicToggle(){} ${audioCode};return{Soundscape,nearbyMotorMix}`)({getItem:()=>null,setItem(){}},{AudioContext:Context},audioState,game().DIRS);
  const real=new Sound();await real.init(true);for(let step=0;step<512;step++)real.musicCell(step,10+step*audioAPI.MUSIC_STEP);
  assert.ok(scheduled.length>1000&&scheduled.length<2500,'complete score schedules bounded synth voices');assert.ok(real.musicSpace!==real.echo,'score and engine echo are isolated');
  real.setMusic(false);assert.equal(real.musicEnabled,false);await real.toggle();assert.equal(real.muted,true);await real.toggle();assert.equal(real.muted,false);
  console.log('full synth graph, note envelopes and audio toggles passed');
  const listener={id:4,x:0,z:0,dir:0,alive:true,speed:22.2,grind:0},other=(id,x,z=0)=>({id,x,z,dir:0,alive:true,speed:40,grind:.5,human:id%2===0});
  assert.deepEqual(nearbyMotorMix(null,[]),[]);
  const mix=nearbyMotorMix(listener,[listener,other(1,2),other(2,35),other(3,109),other(5,110),{...other(6,1),alive:false}],{x:1,z:0});
  assert.deepEqual(mix.map(v=>v.cycle.id),[1,2,3],'only living other riders inside audible radius');
  assert.ok(mix[0].gain>mix[1].gain&&mix[1].gain>mix[2].gain&&mix[2].gain>0,'continuous distance attenuation');
  assert.ok(mix.every(v=>v.pan>0&&v.pan<=.85));
  assert.ok(nearbyMotorMix(listener,[other(1,20)],{x:-1,z:0})[0].pan<0,'stereo follows camera orientation');
  assert.ok(Number.isFinite(nearbyMotorMix(listener,[other(1,0)],{x:0,z:0})[0].pan),'coincident rider and vertical camera stay finite');
  const crowd=Array.from({length:12},(_,i)=>other(i+10,i*.001));
  const limited=nearbyMotorMix(listener,crowd);assert.equal(limited.length,6);assert.ok(limited.reduce((sum,v)=>sum+v.gain,0)<=.0800000001,'crowd has bounded total gain');
  audioState.cycles=[listener,other(1,2),other(2,-20)];real.update(listener,{x:1,z:0});
  assert.equal(real.remotes.size,2,'music off still plays human and AI motors');assert.equal(real.remotes.has(listener.id),false,'guest never hears a duplicate own engine');
  const voice=real.remotes.get(1);assert.ok(voice.gain.gain.target>0);assert.equal(voice.engine.frequency.target,38+40*2.15);assert.equal(voice.whine.frequency.target,90+40*8.2+.5*85);
  listener.alive=false;real.update(listener);assert.equal(real.engineGain.gain.target,0);assert.equal(real.remotes.size,2,'death view retains nearby living motors');listener.alive=true;
  audioState.cycles=[listener];real.update(listener);assert.equal(real.remotes.size,0);assert.equal(voice.engine.stopped,.2);voice.engine.onended();assert.ok(Object.values(voice).every(v=>v.disconnected),'retired voices disconnect every node');
  for(let i=0;i<100;i++){audioState.cycles=[listener,...crowd];real.update(listener);assert.equal(real.remotes.size,6);audioState.cycles=[listener];real.update(listener);assert.equal(real.remotes.size,0)}
  audioState.cycles=[listener,...crowd];real.update(listener);await real.toggle();real.update(listener);assert.equal(real.remotes.size,0,'mute retires nearby voices');await real.toggle();
  for(const mode of ['connecting','menu']){audioState.mode=mode;real.update(listener);assert.equal(real.remotes.size,0);assert.equal(real.engineGain.gain.target,0,'non-playing states silence motors')}
  audioState.mode='guest';audioState.running=false;real.update(listener);assert.equal(real.remotes.size,0);
  console.log('distance/stereo motor mix, crowd ceiling and voice lifecycle passed');
}
