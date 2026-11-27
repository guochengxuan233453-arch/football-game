const assert=require('node:assert/strict');const {lineup,createOnline,tickOnline,action}=require('./engine');
const slots=['gk','lb','cb1','cb2','rb','cm1','cm2','cm3','lw','st','rw'];const raw=slots.map(slot=>({slot,name:slot,rating:104,pace:115,physical:109,squadRating:104}));
assert.throws(()=>lineup([], 'user'));assert.equal(lineup(raw,'user')[0].pace,115);assert.equal(lineup(raw,'user')[0].physical,109);
for(let i=0;i<20;i++){
 const g=createOnline(lineup(raw,'user'),lineup(raw,'ai'));let ticks=0;while(g.scene!=='fulltime'&&ticks++<30000){
  if(g.scene==='attack'||g.scene==='defense'){
   const side=g.scene==='attack'?'user':'ai',p=g.players.find(p=>p.id===g.owner),enemy=side==='user'?'ai':'user';
   if(p&&!g.carry&&!g.flight&&g.possessionAge>.2){assert.equal(action(g,enemy,{kind:'dribble',target:{x:400,y:800}}),false);assert.equal(action(g,side,{kind:'pass',target:g.players.find(q=>q.team===enemy).id}),false);if(i%2===0)action(g,side,{kind:'swipe',dir:{x:(525-p.x)/600,y:side==='user'?-1:1},power:1,curve:0});}
  }
  tickOnline(g,.025);assert(Number.isFinite(g.ball.x)&&Number.isFinite(g.ball.y));
 }
 assert.equal(g.scene,'fulltime');assert.equal(g.minute,90);assert.equal(g.chanceCount.user,4);assert.equal(g.chanceCount.ai,4);
}
const g=createOnline(lineup(raw,'user'),lineup(raw,'ai'));while(g.scene==='simulation')tickOnline(g,.025);const side=g.scene==='attack'?'user':'ai';for(let i=0;i<205;i++)tickOnline(g,.025);assert.equal(g.scene,'result');assert.equal(g.message,'Decision time expired');
console.log('PASS: 20 complete matches; equal highlight counts, timeout, stat preservation, rejected unauthorized actions');
