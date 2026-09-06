// Ephemeral directory and WebRTC signaling only. No simulation, accounts or scores.
export const LOBBY_PROTOCOL=8;
const LEASE=30000,HOST_LEASE=10000,SIGNAL_LEASE=60000;
const bound=(v,min,max,fallback)=>Number.isFinite(+v)?Math.max(min,Math.min(max,Math.floor(+v))):fallback;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(status,error)=>{throw Object.assign(new Error(error),{status})};
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const roomCode=pub=>(pub?'PUB-':'PRI-')+Array.from(crypto.getRandomValues(new Uint8Array(pub?6:10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
async function readBody(request){
  if(!request.headers.get('content-type')?.includes('application/json'))fail(415,'JSON required');
  const reader=request.body?.getReader();if(!reader)fail(400,'Missing request');let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();fail(413,'Request too large')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')fail(400,'Invalid request');return data}catch{fail(400,'Invalid JSON')}
}
function query(db,sql,...args){return db.prepare(sql).bind(...args)}
async function clean(db,now){
  await db.batch([
    query(db,'DELETE FROM lobby_signals WHERE created < ?',now-SIGNAL_LEASE),
    query(db,'DELETE FROM lobby_members WHERE seen < ?',now-LEASE),
    query(db,'DELETE FROM lobby_rooms WHERE NOT EXISTS (SELECT 1 FROM lobby_members m WHERE m.room=lobby_rooms.id)')
  ])
}
async function information(db,member){
  const [rooms,peers]=await db.batch([query(db,'SELECT id,public,protocol,capacity,host,term,ready,ai,clear_trails FROM lobby_rooms WHERE id=?',member.room),query(db,'SELECT id,joined,visible,connected FROM lobby_members WHERE room=? ORDER BY joined,id',member.room)]);
  const room=rooms.results[0];if(!room)fail(410,'Room expired');return{room,peers:peers.results,peerId:member.id,protocol:LOBBY_PROTOCOL}
}
async function join(db,b,secret,now){
  if(b.protocol!==LOBBY_PROTOCOL)fail(426,'Game updated: reload this page');
  if(!/^[a-f0-9]{32}$/.test(b.peerId||''))fail(400,'Invalid peer');
  const existing=await query(db,'SELECT * FROM lobby_members WHERE id=?',b.peerId).first();
  if(existing){if(existing.secret!==secret)fail(403,'Invalid session');await query(db,'UPDATE lobby_members SET seen=? WHERE id=?',now,b.peerId).run();return information(db,existing)}
  await clean(db,now);
  const match=b.match===true,pub=match||b.public===true,code=match?roomCode(true):String(b.room||roomCode(pub));
  if(!/^(PUB|PRI)-[A-Z0-9-]{4,18}$/.test(code)||code.startsWith('PUB-')!==pub)fail(400,'Invalid invitation');
  const capacity=bound(b.capacity,2,6,4),ai=pub?0:bound(b.ai,0,6,0),clear=b.clearTrails?1:0;
  const excluded=(Array.isArray(b.exclude)?b.exclude:[]).filter(x=>typeof x==='string'&&/^PUB-[A-Z0-9-]{4,18}$/.test(x)).slice(0,6);
  const excludeSQL=excluded.length?' AND r.id NOT IN ('+excluded.map(()=>'?').join(',')+')':'';
  const count='(SELECT COUNT(*) FROM lobby_members m WHERE m.room=r.id)',humans='(SELECT COUNT(*) FROM lobby_members m WHERE m.room=r.id AND m.connected=1)';
  const eligible=match?`r.public=1 AND r.protocol=? AND ${count}<r.capacity${excludeSQL}`:`r.id=? AND r.protocol=? AND ${count}<r.capacity`;
  const args=match?[LOBBY_PROTOCOL,...excluded]:[code,LOBBY_PROTOCOL];
  // The check/create and capacity reservation are one D1 transaction. Simultaneous
  // searches observe the preceding reservation rather than creating lonely rooms.
  const creation=match?`NOT EXISTS(SELECT 1 FROM lobby_rooms r WHERE ${eligible})`:'1';
  await db.batch([
    query(db,`INSERT INTO lobby_rooms(id,public,protocol,capacity,host,ai,clear_trails,created) SELECT ?,?,?,?,?,?,?,? WHERE ${creation} AND NOT EXISTS(SELECT 1 FROM lobby_members WHERE id=?) ON CONFLICT(id) DO NOTHING`,code,pub?1:0,LOBBY_PROTOCOL,capacity,b.peerId,ai,clear,now,...(match?args:[]),b.peerId),
    query(db,`INSERT INTO lobby_members(id,room,secret,joined,seen,visible,connected) SELECT ?,r.id,?,?,?,1,CASE WHEN r.host=? THEN 1 ELSE 0 END FROM lobby_rooms r WHERE ${eligible} ORDER BY ${humans} DESC,(r.capacity-${count}) ASC,r.created ASC,r.id ASC LIMIT 1 ON CONFLICT(id) DO NOTHING`,b.peerId,secret,now,now,b.peerId,...args)
  ]);
  const member=await query(db,'SELECT * FROM lobby_members WHERE id=?',b.peerId).first();if(!member)fail(409,'Room full or unavailable');if(member.secret!==secret)fail(403,'Invalid session');return information(db,member)
}
async function poll(db,member,b,now){
  const cursor=bound(b.cursor,0,Number.MAX_SAFE_INTEGER,0),outgoing=Array.isArray(b.signals)?b.signals:[];if(outgoing.length>24)fail(413,'Too many signals');
  const statements=[query(db,'DELETE FROM lobby_members WHERE room=? AND seen<?',member.room,now-LEASE),query(db,'UPDATE lobby_members SET seen=?,visible=? WHERE id=? AND secret=?',now,b.visible===false?0:1,member.id,member.secret),query(db,'DELETE FROM lobby_signals WHERE recipient=? AND (id<=? OR created<?)',member.id,cursor,now-SIGNAL_LEASE)];
  for(const s of outgoing){if(!s||!/^[a-f0-9]{32}$/.test(s.to||'')||!['offer','answer','candidate','reset'].includes(s.body?.type))fail(400,'Invalid signal');const body=JSON.stringify(s.body);if(body.length>64000)fail(413,'Signal too large');
    statements.push(query(db,'INSERT INTO lobby_signals(room,sender,recipient,body,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM lobby_members WHERE id=? AND room=?) AND (SELECT COUNT(*) FROM lobby_signals WHERE recipient=?)<256',member.room,member.id,s.to,body,now,s.to,member.room,s.to))
  }
  statements.push(query(db,`UPDATE lobby_rooms SET host=(SELECT id FROM lobby_members WHERE room=? AND seen>=? ORDER BY visible DESC,joined,id LIMIT 1),term=term+1,ready=0 WHERE id=? AND (NOT EXISTS(SELECT 1 FROM lobby_members WHERE id=lobby_rooms.host AND seen>=?) OR (EXISTS(SELECT 1 FROM lobby_members WHERE id=lobby_rooms.host AND visible=0) AND EXISTS(SELECT 1 FROM lobby_members WHERE room=? AND visible=1 AND seen>=?)))`,member.room,now-HOST_LEASE,member.room,now-HOST_LEASE,member.room,now-HOST_LEASE));
  const settings=b.host;
  if(settings&&typeof settings==='object'){
    const cap=bound(settings.capacity,2,6,4),ai=bound(settings.ai,0,6,0),admitted=(Array.isArray(settings.admitted)?settings.admitted:[]).filter(id=>/^[a-f0-9]{32}$/.test(id)).slice(0,6);
    statements.push(query(db,'UPDATE lobby_rooms SET capacity=MAX(?,(SELECT COUNT(*) FROM lobby_members WHERE room=?)),ai=?,clear_trails=?,ready=1 WHERE id=? AND host=? AND term=?',cap,member.room,ai,settings.clearTrails?1:0,member.room,member.id,settings.term));
    const slots=admitted.length?admitted.map(()=>'?').join(','):'NULL';
    statements.push(query(db,`UPDATE lobby_members SET connected=CASE WHEN id IN (${slots}) THEN 1 ELSE 0 END WHERE room=? AND EXISTS(SELECT 1 FROM lobby_rooms WHERE id=? AND host=? AND term=?)`,...admitted,member.room,member.room,member.id,settings.term))
  }
  await db.batch(statements);
  const info=await information(db,member),messages=await query(db,'SELECT id,sender,body FROM lobby_signals WHERE room=? AND recipient=? AND id>? AND created>=? ORDER BY id LIMIT 128',member.room,member.id,cursor,now-SIGNAL_LEASE).all();
  return{...info,signals:messages.results.map(s=>({id:s.id,from:s.sender,body:JSON.parse(s.body)})),cursor:messages.results.at(-1)?.id||cursor}
}
export async function handleLobby(request,env){
  try{
    if(!env.DB)return json({error:'Online service is being configured'},503);
    const url=new URL(request.url),origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Same-origin requests only');
    if(request.method!=='POST')fail(405,'POST required');
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token||''))fail(401,'Session required');
    const b=await readBody(request),secret=await digest(token),now=Date.now();
    if(url.pathname==='/api/lobby/join')return json(await join(env.DB,b,secret,now));
    if(!/^[a-f0-9]{32}$/.test(b.peerId||''))fail(400,'Invalid peer');
    const member=await query(env.DB,'SELECT * FROM lobby_members WHERE id=? AND secret=?',b.peerId,secret).first();if(!member||member.seen<now-LEASE)fail(410,'Session expired');
    if(url.pathname==='/api/lobby/leave'){await env.DB.batch([query(env.DB,'DELETE FROM lobby_signals WHERE sender=? OR recipient=?',member.id,member.id),query(env.DB,'DELETE FROM lobby_members WHERE id=? AND secret=?',member.id,secret)]);return json({left:true})}
    if(url.pathname==='/api/lobby/poll')return json(await poll(env.DB,member,b,now));
    fail(404,'Not found')
  }catch(error){if(!error.status)console.error('Lobby request failed:',error.message);return json({error:error.status?error.message:'Online service temporarily unavailable'},error.status||503)}
}
