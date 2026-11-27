const assert=require('node:assert/strict');const {lineup,createOnline,tickOnline,action}=require('./engine');
const raw=['gk','lb','cb1','cb2','rb','cm1','cm2','cm3','lw','st','rw'].map(slot=>({slot,name:slot,rating:104,pace:115,physical:109,squadRating:104,playStyles:['pingedPass+']}));
const make=()=>createOnline(lineup(raw,'user'),lineup(raw,'ai'));
const plan=()=>{const g=make();while(g.scene==='simulation')tickOnline(g,.025);assert(g.planning);return g};
const attack=g=>g.players.find(p=>p.id===g.owner);const enemy=t=>t==='user'?'ai':'user';const send=(g,t,a)=>action(g,t,{...a,planId:g.planId});
assert.throws(()=>lineup([],'user'));assert.equal(lineup(raw,'user')[0].pace,115);assert.equal(lineup(raw,'user')[0].physical,109);
const g=plan(),p=attack(g),t=p.team,d=g.players.filter(q=>q.team===enemy(t)&&q.role!=='GK').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
const before=JSON.stringify(g.players.map(q=>[q.x,q.y]));const ball=JSON.stringify(g.ball);
assert(send(g,enemy(t),{kind:'tackle',actor:d.id,target:{x:p.x,y:p.y}}));assert(!send(g,enemy(t),{kind:'hold'}));
for(let i=0;i<120;i++)tickOnline(g,.025);assert(g.planning);assert.equal(JSON.stringify(g.players.map(q=>[q.x,q.y])),before);assert.equal(JSON.stringify(g.ball),ball);assert.equal(g.activeTime,0);assert(!g.tackle);assert(!JSON.stringify(g).includes('"kind":"tackle"'));
assert(!action(g,t,{planId:g.planId-1,kind:'dribble',target:{x:400,y:800}}));assert(!send(g,t,{kind:'pass',target:d.id}));
assert(send(g,t,{kind:'swipe',dir:{x:0,y:t==='user'?-1:1},power:.8,curve:0}));assert(!send(g,t,{kind:'dribble',target:{x:400,y:800}}));assert.equal(g.owner,p.id);tickOnline(g,.025);assert(!g.planning);assert(g.flight);assert(!send(g,enemy(t),{kind:'hold'}));
// Reverse the order: identical frozen state and same RNG must produce identical resolution.
const a=plan(),b=plan();Object.assign(b,structuredClone(a)); // WeakMap for b still belongs to its own plan; public state copied for comparison.
const attacker=attack(a),defender=a.players.filter(q=>q.team===enemy(attacker.team)&&q.role!=='GK').sort((q,r)=>Math.hypot(q.x-attacker.x,q.y-attacker.y)-Math.hypot(r.x-attacker.x,r.y-attacker.y))[0];
const move={kind:'swipe',dir:{x:0,y:attacker.team==='user'?-1:1},power:.8,curve:0},block={kind:'tackle',actor:defender.id,target:{x:attacker.x,y:attacker.y}};
assert(send(a,attacker.team,move));assert(send(a,enemy(attacker.team),block));assert(send(b,enemy(attacker.team),block));assert(send(b,attacker.team,move));const random=Math.random;Math.random=()=>.5;tickOnline(a,.025);tickOnline(b,.025);Math.random=random;assert.deepEqual(a,b);
// Defender defaults to auto-defend at deadline; attacker timeout ends the chance.
const expired=plan();for(let i=0;i<490;i++)tickOnline(expired,.025);assert.equal(expired.scene,'result');assert.equal(expired.message,'Decision time expired');
const slow=plan(),s=attack(slow);for(const q of slow.players)if(q.team!==s.team){q.x=25;q.y=800;}const start={x:s.x,y:s.y};assert(send(slow,s.team,{kind:'dribble',target:{x:s.x+400,y:s.y}}));assert(send(slow,enemy(s.team),{kind:'hold'}));tickOnline(slow,.025);assert(!slow.planning);assert(Math.hypot(slow.carry.x-start.x,slow.carry.y-start.y)<=165.0001);tickOnline(slow,.025);assert(Math.abs(Math.hypot(s.x-start.x,s.y-start.y)-(70+115*1.48)*.025*.70)<1e-6);
const defaultDefense=plan(),dp=attack(defaultDefense);assert(send(defaultDefense,dp.team,{kind:'swipe',dir:{x:0,y:dp.team==='user'?-1:1},power:.8,curve:0}));for(let i=0;i<480&&defaultDefense.planning;i++)tickOnline(defaultDefense,.025);if(defaultDefense.planning)tickOnline(defaultDefense,.025);assert(!defaultDefense.planning);assert(defaultDefense.flight);
for(let i=0;i<20;i++){const m=make();let ticks=0;while(m.scene!=='fulltime'&&ticks++<100000){if(m.planning){const p=attack(m),side=p.team;if(i%2===0){send(m,side,{kind:'swipe',dir:{x:(525-p.x)/600,y:side==='user'?-1:1},power:1,curve:0});send(m,enemy(side),{kind:'hold'});}else if(i%3===0){send(m,side,{kind:'dribble',target:{x:p.x+80,y:p.y+(side==='user'?-60:60)}});send(m,enemy(side),{kind:'hold'});}}tickOnline(m,.025);assert(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.y));}assert.equal(m.scene,'fulltime');assert.equal(m.minute,90);assert.equal(m.chanceCount.user,4);assert.equal(m.chanceCount.ai,4);}
console.log('PASS: 20 complete matches, frozen planning, private moves, order-independent execution, one move per turn, stale IDs rejected, timeout, capped dribble, 70% speed and stats preserved');
