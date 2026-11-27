const http = require('node:http');
const { randomInt } = require('node:crypto');
const { Server } = require('socket.io');
const { lineup, createOnline, tickOnline, action } = require('./engine.js');
const port = Number(process.env.PORT || 3001);
const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim());
const server = http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));});
const io = new Server(server,{cors:{origin:origins},allowRequest:(req,cb)=>cb(null,!req.headers.origin||origins.includes(req.headers.origin)),maxHttpBufferSize:100000});
const rooms = new Map();
const roomFor = socket => rooms.get(socket.data.code);
const info = r => ({code:r.code, members:r.members.map(m=>({team:m.team,name:m.name,ovr:Math.round(m.players.reduce((n,p)=>n+p.squadRating,0)/11),ready:m.ready})), started:!!r.game});
function publish(r){io.to(r.code).emit('lobby',info(r));}
function leave(socket){const r=roomFor(socket);socket.data.code=null;if(!r)return;socket.leave(r.code);if(r.game?.scene==='fulltime'){r.members=r.members.filter(m=>m.id!==socket.id);if(!r.members.length)rooms.delete(r.code);return;}if(r.game){io.to(r.code).emit('ended','Your opponent left the match.');for(const m of r.members){const s=io.sockets.sockets.get(m.id);if(s){s.data.code=null;s.leave(r.code);}}rooms.delete(r.code);return;}r.members=r.members.filter(m=>m.id!==socket.id);if(!r.members.length)rooms.delete(r.code);else{r.members[0].ready=false;publish(r);}}
function response(ack,fn){if(typeof ack!=='function')return;try{ack({ok:true,...fn()});}catch(e){ack({ok:false,error:e.message});}}
io.on('connection',socket=>{
  socket.on('create',(data,ack)=>response(ack,()=>{if(roomFor(socket))throw Error('Leave your existing room first');if(rooms.size>=200)throw Error('Server is full');const players=lineup(data?.players,'user');let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));const r={code,members:[{id:socket.id,team:'user',name:String(data?.name||'Home').slice(0,24),players,ready:false}],game:null,created:Date.now()};rooms.set(code,r);socket.join(code);socket.data.code=code;publish(r);return {code,team:'user'};}));
  socket.on('join',(data,ack)=>response(ack,()=>{if(roomFor(socket))throw Error('Leave your existing room first');const r=rooms.get(String(data?.code));if(!r||r.game||r.members.length!==1)throw Error('Room unavailable');const team=r.members[0].team==='user'?'ai':'user';const players=lineup(data?.players,team);r.members.push({id:socket.id,team,name:String(data?.name||'Away').slice(0,24),players,ready:false});socket.join(r.code);socket.data.code=r.code;publish(r);return {code:r.code,team};}));
  socket.on('ready',()=>{const r=roomFor(socket);if(!r||r.game)return;const m=r.members.find(m=>m.id===socket.id);if(!m)return;m.ready=!m.ready;if(r.members.length===2&&r.members.every(m=>m.ready)){r.game=createOnline(r.members.find(m=>m.team==='user').players,r.members.find(m=>m.team==='ai').players);r.startedAt=Date.now();}publish(r);});
  socket.on('action',data=>{const r=roomFor(socket);if(!r?.game)return;const m=r.members.find(m=>m.id===socket.id);const now=Date.now();if(!m||now-(socket.data.lastAction||0)<90)return;socket.data.lastAction=now;action(r.game,m.team,data);});
  socket.on('leave',()=>leave(socket));socket.on('disconnect',()=>leave(socket));
});
let last=performance.now(),frame=0;setInterval(()=>{const now=performance.now(),dt=Math.min(.08,(now-last)/1000);last=now;frame++;for(const r of rooms.values()){if(!r.game){if(Date.now()-r.created>30*60*1000){for(const m of r.members){const s=io.sockets.sockets.get(m.id);if(s){s.emit('ended','Lobby expired');s.data.code=null;s.leave(r.code);}}rooms.delete(r.code);}continue;}tickOnline(r.game,dt);if(frame%2===0){const g=r.game;io.to(r.code).volatile.emit('state',{...g,flight:g.flight?{...g.flight,checked:[]}:null});}if(r.game.scene==='fulltime'&&!r.finishedAt)r.finishedAt=Date.now();if(r.finishedAt&&Date.now()-r.finishedAt>120000){for(const m of r.members){const s=io.sockets.sockets.get(m.id);if(s){s.emit('ended','Match closed');s.data.code=null;s.leave(r.code);}}rooms.delete(r.code);}}},25);
server.listen(port,'0.0.0.0',()=>console.log(`Football server listening on ${port}`));
