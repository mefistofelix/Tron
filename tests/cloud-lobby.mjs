import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleLobby,LOBBY_PROTOCOL} from '../server/lobby.mjs';

function database(){
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')))sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const statement=(text,args=[])=>({text,args,bind(...values){return statement(text,values)},async first(){return sql.prepare(text).get(...args)||null},async all(){return{results:sql.prepare(text).all(...args)}},async run(){return sql.prepare(text).run(...args)}});
  return{sql,prepare:text=>statement(text),async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>({results:sql.prepare(s.text).all(...s.args)}));sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}
}
const identity=()=>({peerId:crypto.randomUUID().replaceAll('-',''),key:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')});
function fixture(){const DB=database();return{DB,async request(path,body,id=identity(),extra={}){const response=await handleLobby(new Request('https://game.test/api/lobby/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+id.key,...extra},body:JSON.stringify({...body,peerId:id.peerId})}),{DB});return{status:response.status,data:await response.json(),headers:response.headers}},join(id,options={}){return this.request('join',{match:true,protocol:LOBBY_PROTOCOL,capacity:6,...options},id)}}}

{
  const f=fixture(),a=identity(),b=identity();const [one,two]=await Promise.all([f.join(a),f.join(b)]);
  assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(one.data.room.id,two.data.room.id,'simultaneous searches reserve one shared room');
  assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM lobby_rooms').get().n,1);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM lobby_members').get().n,2);
  const again=await f.join(a);assert.equal(again.data.room.id,one.data.room.id,'retry is idempotent');assert.equal(again.data.peers.length,2);
  const fake=await f.join({...a,key:b.key});assert.equal(fake.status,403);assert.notEqual(f.DB.sql.prepare('SELECT secret FROM lobby_members WHERE id=?').get(a.peerId).secret,a.key,'stored credential is hashed');
  const host=one.data.room.host===a.peerId?a:b,guest=host===a?b:a,room=one.data.room.id;
  await f.request('poll',{host:{term:1,capacity:2,ai:6,clearTrails:true,admitted:[host.peerId,guest.peerId]}},host);
  const settings=await f.request('poll',{host:{term:1,capacity:6,ai:0,clearTrails:false,admitted:[guest.peerId]}},guest);
  assert.equal(settings.data.room.capacity,2,'guest cannot change capacity');assert.equal(settings.data.room.ai,6);assert.equal(settings.data.room.clear_trails,1);
  assert.equal((await f.join(identity(),{match:false,public:true,room})).status,409,'reserved human slots enforce capacity');
  const next=await f.join(identity());assert.notEqual(next.data.room.id,room,'full rooms do not receive more reservations');
  const request=await f.request('poll',{signals:[{to:guest.peerId,body:{type:'offer',session:'test',sdp:'sdp'}}]},host);assert.equal(request.status,200);
  const inbox=await f.request('poll',{},guest);assert.equal(inbox.data.signals.length,1);assert.equal(inbox.data.signals[0].from,host.peerId);
  assert.equal((await f.request('poll',{cursor:inbox.data.cursor},guest)).data.signals.length,0,'acknowledged signaling messages are removed');
  await f.request('poll',{visible:false},host);const migrated=await f.request('poll',{},guest);assert.equal(migrated.data.room.host,guest.peerId);assert.equal(migrated.data.room.term,2);assert.equal(migrated.data.room.capacity,2);assert.equal(migrated.data.room.ai,6);
  assert.equal((await f.request('poll',{visible:true},host)).data.room.host,guest.peerId,'returning host does not reclaim authority');
  assert.equal((await f.request('poll',{},guest,{Origin:'https://other.test'})).status,403);assert.equal((await f.join(identity(),{protocol:7})).status,426);
  assert.equal(inbox.headers.get('cache-control'),'no-store');
}
{
  const f=fixture(),ids=Array.from({length:20},identity),results=await Promise.all(ids.map(id=>f.join(id)));
  assert.ok(results.every(r=>r.status===200));const counts=f.DB.sql.prepare('SELECT room,COUNT(*) n FROM lobby_members GROUP BY room').all();assert.equal(counts.length,4);assert.ok(counts.every(c=>c.n<=6));assert.equal(counts.reduce((n,c)=>n+c.n,0),20,'concurrent matchmaking neither loses nor overbooks riders');
}
{
  const f=fixture(),a=identity(),b=identity(),c=identity(),d=identity(),privateRoom='PRI-ABCDEFGHJK';
  assert.equal((await f.join(a,{match:false,public:false,room:privateRoom})).status,200);
  const invited=await f.join(b,{match:false,public:false,room:privateRoom});assert.equal(invited.data.room.id,privateRoom);
  const publicRoom=await f.join(c);assert.notEqual(publicRoom.data.room.id,privateRoom);assert.equal(publicRoom.data.room.ai,0,'public rooms default to no AI');
  await f.request('poll',{signals:[{to:c.peerId,body:{type:'offer',sdp:'private'}}]},a);assert.equal((await f.request('poll',{},c)).data.signals.length,0,'signals cannot cross rooms');
  const other=await f.join(d,{match:false,public:true,room:'PUB-ZZZZZZ'});await f.request('poll',{host:{term:1,capacity:6,ai:6,admitted:[d.peerId]}},d);
  const additional=identity();await f.join(additional,{match:false,public:true,room:publicRoom.data.room.id});await f.request('poll',{host:{term:1,capacity:6,ai:0,admitted:[c.peerId,additional.peerId]}},c);
  assert.equal((await f.join(identity())).data.room.id,publicRoom.data.room.id,'ranking follows humans rather than AI count');
  const before=Date.now,now=before();try{Date.now=()=>now+31000;assert.equal((await f.request('poll',{},c)).status,410);const newRoom=await f.join(identity());assert.equal(newRoom.data.peers.length,1,'expired memberships are purged before matching')}finally{Date.now=before}
  assert.equal((await f.request('leave',{},a)).status,410);
}
console.log('D1 transaction, concurrent capacity, private invitations, host authority, signaling privacy and expiry passed');

// Execute the real native WebRTC adapter against a deterministic data-channel mock.
// This verifies framing/orchestration, not Internet NAT traversal or a browser playtest.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);
const code=script.slice(script.indexOf('const rtcConfig='),script.indexOf('const snapshotOutbox='));
let serial=0;const pcs=new Map();
class Channel{constructor(){this.readyState='connecting';this.bufferedAmount=0}send(data){queueMicrotask(()=>this.other?.onmessage?.({data}))}close(){if(this.readyState==='closed')return;this.readyState='closed';this.onclose?.()}addEventListener(){}removeEventListener(){}}
class Peer{
  constructor(){this.id=++serial;pcs.set(this.id,this);this.connectionState='new';this.signalingState='stable'}
  createDataChannel(){return this.channel=new Channel()}
  async createOffer(){return{type:'offer',sdp:String(this.id)}}
  async createAnswer(){return{type:'answer',sdp:String(this.id)}}
  async setLocalDescription(d){this.localDescription=d;this.signalingState=d.type==='offer'?'have-local-offer':'stable'}
  async setRemoteDescription(d){this.remoteDescription=d;if(d.type==='offer'){this.channel=new Channel();this.ondatachannel?.({channel:this.channel})}else{const other=pcs.get(Number(d.sdp));this.channel.other=other.channel;other.channel.other=this.channel;this.channel.readyState=other.channel.readyState='open';this.connectionState=other.connectionState='connected';this.signalingState='stable';queueMicrotask(()=>{this.channel.onopen?.();other.channel.onopen?.()})}}
  async addIceCandidate(){}close(){this.connectionState='closed';this.channel?.close()}
}
{
  const f=fixture(),a=identity(),b=identity(),one=await f.join(a),two=await f.join(b),make=new Function('fetch','RTCPeerConnection','document',`const setTimeout=()=>1,clearTimeout=()=>{};${code};return CloudRoom`);
  const fetcher=async(url,options)=>handleLobby(new Request('https://game.test'+url,options),{DB:f.DB});
  const Cloud=make(fetcher,Peer,{hidden:false}),left=new Cloud(a,one.data),right=new Cloud(b,two.data),received=[];
  left.makeAction('game');right.makeAction('game').onMessage=(data,meta)=>received.push({data,meta});left.start();right.start();
  for(let i=0;i<12;i++){await left.poll();await right.poll();await Promise.resolve()}
  assert.equal(Object.keys(left.getPeers()).length,1);assert.equal(Object.keys(right.getPeers()).length,1,'HTTP signaling establishes one data channel in the adapter fixture');
  const message={t:'init',text:'neon🙂'.repeat(15000)};await left.makeAction('game').send(message,{target:b.peerId});await Promise.resolve();assert.equal(received.length,1);assert.deepEqual(received[0].data,message,'large Unicode payload survives chunking');assert.equal(received[0].meta.peerId,a.peerId);
  await left.makeAction('game').send({t:'private'},{target:'unrelated'});assert.equal(received.length,1,'targeted messages are not broadcast');left.leave();right.leave();
}
console.log('native WebRTC adapter signaling, targeting and large-message framing passed');

// Actual game join/admission and initialization over the same backend/RTC fixture.
{
  const f=fixture(),section=(a,b)=>script.slice(script.indexOf(a),script.indexOf(b,script.indexOf(a)));
  const core=[section('const COLORS=','class Soundscape'),section('function startSolo()','// WebGL renderer'),section('function advanceGameClock(','function loop('),section('// Host-authoritative simulation','function selectedFlow()')].join('\n');
  const ui={value:'TEST',classList:{add(){},remove(){},toggle(){}},setAttribute(){}};
  function game(){
    const fetcher=async(url,options)=>handleLobby(new Request('https://game.test'+url,options),{DB:f.DB});
    return new Function('fetch','RTCPeerConnection','ui',`const setTimeout=()=>1,clearTimeout=()=>{},localStorage={getItem:()=>null},document={hidden:false,body:ui},location={origin:'https://game.test',pathname:'/',href:'https://game.test/',hash:''},history={replaceState(){}},$=()=>ui,audio={init(){},tone(){},noise(){}},clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t;function resetChat(){}function applyLocalPreferences(){}function showToast(){}function closeNetwork(){}function updateHUD(){}function announcePresence(){}function acceptChat(){}function setRulesOpen(){}\n${core}\nreturn {joinAutoRoom,startSolo,handleAutoMessage,state,get room(){return autoRoom},get self(){return autoSelf},get host(){return isHost}}`)(fetcher,Peer,ui);
  }
  const a=game(),b=game();await Promise.all([a.joinAutoRoom('',true,{match:true}),b.joinAutoRoom('',true,{match:true})]);
  assert.equal(a.state.roomId,b.state.roomId);assert.equal(Number(a.host)+Number(b.host),1);
  for(let i=0;i<16;i++){await a.room.poll();await b.room.poll();await Promise.resolve()}
  assert.equal(a.state.running,true);assert.equal(b.state.running,true,'guest receives actual game initialization');
  assert.equal(a.state.cycles.filter(c=>c.human).length,2);assert.equal(b.state.cycles.filter(c=>c.human).length,2);
  const guest=a.host?b:a,host=a.host?a:b;guest.handleAutoMessage({t:'host',host:guest.self,term:999},guest.self);assert.equal(guest.host,false,'peer messages cannot seize host authority');
  host.room.leave();for(let i=0;i<4;i++){await guest.room.poll();await Promise.resolve()}assert.equal(guest.host,true,'remaining game accepts server-selected host succession');assert.equal(guest.state.running,true);
  guest.startSolo();assert.equal(guest.state.mode,'solo');assert.equal(guest.room,null);
}
console.log('full game admission, initialization, host succession and solo cancellation passed');
