type Team = "user" | "ai"
type Difficulty = "easy" | "medium" | "hard"
type Role = "GK" | "CB" | "LB" | "RB" | "CM" | "CDM" | "CAM" | "LM" | "RM" | "LW" | "RW" | "ST"
type Point = { x: number; y: number }
type Card = { name:string; rating:number; position:string; altPositions?:string[]; stats:Record<string,number> }
type Slot = { key: string; role: Role; x: number; y: number }
type Animation = "kick" | "slide" | "dive" | "celebrate"
type Player = Point & { id: string; name: string; team: Team; role: Role; slot: string; home: Point; rating: number; pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number; keeping: number; diving: number; handling: number; kicking: number; reflexes: number; keeperSpeed: number; positioning: number; squadRating: number; facing: number; stride: number; moving: boolean; skin: string; hair: string; number: number; hairStyle: number; action: Animation | null; actionTime: number }
type Flight = { vx: number; vy: number; curve: number; age: number; kicker: string; target: string | null; kind: "pass" | "shot"; checked: Set<string> }
type Gesture = { start: Point; end: Point; first: Point | null; pointer: number; actor: string | null; mode: "attack" | "defend" }
type Scene = "simulation" | "attack" | "defense" | "result" | "fulltime"
type EventItem = { minute: number; text: string; team?: Team }
type Match = { players: Player[]; ball: Point; owner: string | null; flight: Flight | null; carry: Point | null; tackle: { id: string; target: Point } | null; scene: Scene; score: Record<Team, number>; minute: number; schedule: { minute: number; team: Team }[]; next: number; phaseTime: number; activeTime: number; actionCount: number; decisions: number; aiWait: number; aiLast: string | null; aiVisits: Record<string, number>; cooldown: number; message: string; events: EventItem[]; camera: Point; aim: Gesture | null; paused: boolean; difficulty: Difficulty; attackRating: number; defenseRating: number; chanceCount: Record<Team, number>; possessionAge: number; lastTouch: Team; halftime: boolean }
const W = 1050, H = 1600, MID = W / 2, GOAL = 270, NET = 72, R = 17, BR = 7
const DIFFICULTIES = {
  easy: { label: "Easy", ovr: 85, reaction: 0.9, press: 0.82 },
  medium: { label: "Medium", ovr: 92, reaction: 0.65, press: 1 },
  hard: { label: "Hard", ovr: 98, reaction: 0.43, press: 1.15 },
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const dist = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.y-b.y)
const unit = (x: number, y: number): Point => { const d = Math.hypot(x,y) || 1; return {x:x/d,y:y/d} }
const rotate = (p: Point, a: number): Point => ({ x:p.x*Math.cos(a)-p.y*Math.sin(a), y:p.x*Math.sin(a)+p.y*Math.cos(a) })
const rand = (a: number,b: number) => a+Math.random()*(b-a)
const opposite = (t: Team): Team => t === "user" ? "ai" : "user"
const forward = (t: Team) => t === "user" ? -1 : 1
const inside = (p: Point): Point => ({x:clamp(p.x,25,W-25), y:clamp(p.y,30,H-30)})
const segDist = (p: Point,a: Point,b: Point) => { const x=b.x-a.x,y=b.y-a.y; const t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1),0,1); return dist(p,{x:a.x+x*t,y:a.y+y*t}) }
const slot = (key: string, role: Role, x: number, y: number): Slot => ({key,role,x,y})
const BACK = [slot("gk","GK",.5,.94),slot("lb","LB",.13,.79),slot("cb1","CB",.37,.83),slot("cb2","CB",.63,.83),slot("rb","RB",.87,.79)]
const FORMATIONS: Record<string,Slot[]> = {
  "4-3-3": [...BACK,slot("cm1","CM",.25,.65),slot("cm2","CM",.5,.71),slot("cm3","CM",.75,.65),slot("lw","LW",.15,.55),slot("st","ST",.5,.535),slot("rw","RW",.85,.55)],
  "4-4-2": [...BACK,slot("lm","LM",.13,.62),slot("cm1","CM",.37,.67),slot("cm2","CM",.63,.67),slot("rm","RM",.87,.62),slot("st1","ST",.37,.54),slot("st2","ST",.63,.54)],
  "4-2-3-1": [...BACK,slot("cdm1","CDM",.36,.72),slot("cdm2","CDM",.64,.72),slot("lw","LW",.15,.57),slot("cam","CAM",.5,.625),slot("rw","RW",.85,.57),slot("st","ST",.5,.535)],
}
const isBack = (p: Player) => ["GK","CB","LB","RB"].includes(p.role)
const isMid = (p: Player) => ["CM","CDM","CAM","LM","RM"].includes(p.role)
const isWide = (p: Player) => ["LW","RW","LM","RM","LB","RB"].includes(p.role)
const isForward = (p: Player) => ["ST","LW","RW"].includes(p.role)
function stat(card: Card | undefined, key: string, fallback: number) {
  const s = card?.stats as unknown as Record<string,unknown> | undefined
  const aliases: Record<string,string> = {pace:"pac",shooting:"sho",passing:"pas",dribbling:"dri",defending:"def",physical:"phy",diving:"div",handling:"han",kicking:"kic",reflexes:"ref",speed:"spd",positioning:"pos"}
  const v = s?.[key] ?? s?.[aliases[key]] ?? s?.[key.toUpperCase()] ?? s?.[aliases[key]?.toUpperCase()]
  // Evolved cards can exceed 100. Do not cap the actual card stats.
  return typeof v === "number" && Number.isFinite(v) ? Math.max(1,v) : Math.max(1,fallback)
}
// Match the squad builder's positional OVR penalties; empty slots count as zero.
function adjustedRating(card:Card,role:Role){
  const data=card as unknown as {position?:string;altPositions?:string[]}
  const pos=(data.position??role).toUpperCase()
  if(pos===role||(data.altPositions??[]).some(p=>p.toUpperCase()===role))return card.rating
  const group=(p:string)=>p==="GK"?"gk":["LB","RB","CB"].includes(p)?"defense":["CM","CDM","CAM"].includes(p)?"midfield":"attack"
  const a=group(pos),b=group(role)
  const wide=["LW","RW","LM","RM"]
  const penalty=a==="gk"||b==="gk"?50:((pos==="ST"&&wide.includes(role))||(wide.includes(pos)&&role==="ST"))?1:((a==="attack"&&b==="defense")||(a==="defense"&&b==="attack"))?10:6
  return Math.max(1,card.rating-penalty)
}
const squadOVR=(players:Player[])=>Math.round(players.reduce((n,p)=>n+p.squadRating,0)/Math.max(1,players.length))
// Accuracy keeps improving above 100, with diminishing returns instead of a hard cap.
const shotError=(shooting:number)=>.15*Math.exp((70-shooting)/40)
const passChance=(passing:number,base:number,penalty=0)=>clamp(1-(1-base)*Math.exp(-passing/42)-penalty,.35,.999)
function makePlayer(s: Slot, team: Team, card: Card | undefined, ovr: number, index: number): Player {
  const rating = card?.rating ?? ovr
  const seed = Array.from(card?.name ?? `${team}-${s.key}`).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)
  const x = (team === "user" ? s.x : 1-s.x)*W, y = (team === "user" ? s.y : 1-s.y)*H
  const diving=stat(card,"diving",rating),handling=stat(card,"handling",rating),kicking=stat(card,"kicking",rating),reflexes=stat(card,"reflexes",rating),positioning=stat(card,"positioning",rating),keeperSpeed=stat(card,"speed",stat(card,"pace",rating))
  const keep=(diving+handling+reflexes+positioning)/4
  return {id:`${team}-${s.key}`,slot:s.key,role:s.role,name:card?.name ?? (team === "ai" ? `AI ${s.role}` : `Reserve ${s.role}`),team,x,y,home:{x,y},rating,
    pace:stat(card,"pace",rating),shooting:stat(card,"shooting",rating),passing:stat(card,"passing",rating),dribbling:stat(card,"dribbling",rating),defending:stat(card,"defending",rating),physical:stat(card,"physical",rating),keeping:keep,diving,handling,kicking,reflexes,keeperSpeed,positioning,squadRating:card?adjustedRating(card,s.role):team==="ai"?rating:0,
    facing:team === "user" ? -Math.PI/2 : Math.PI/2,stride:0,moving:false,skin:["#efbc91","#a96c45","#d79868","#79503a","#f5d0ac"][seed%5],hair:["#33291f","#201b19","#604127","#b58a41"][Math.floor(seed/7)%4],number:index+1,hairStyle:Math.floor(seed/13)%3,action:null,actionTime:0}
}
const ownerOf = (g: Match) => g.players.find(p=>p.id===g.owner) ?? null
const teamOf = (g: Match,t: Team) => g.players.filter(p=>p.team===t)
function move(p: Player,to: Point,speed:number,dt:number) {
  const d=dist(p,to); if(d<.5){p.moving=false;return true}
  const dir=unit(to.x-p.x,to.y-p.y),step=Math.min(d,speed*dt)
  p.x+=dir.x*step;p.y+=dir.y*step;p.facing=Math.atan2(dir.y,dir.x);p.stride+=step*.095;p.moving=true
  return d<=step+.5
}
function animate(p:Player,action:Animation,seconds:number){p.action=action;p.actionTime=seconds}
function attach(g:Match,p:Player) { p.moving=false;g.owner=p.id;g.flight=null;g.carry=null;g.lastTouch=p.team;g.possessionAge=0;g.ball={x:p.x+Math.cos(p.facing)*24,y:p.y+Math.sin(p.facing)*24} }
function setBallAtFeet(g:Match,p:Player){g.ball={x:clamp(p.x+Math.cos(p.facing)*24,BR,W-BR),y:clamp(p.y+Math.sin(p.facing)*24,BR,H-BR)}}
function endChance(g:Match,text:string,goal?:Team){
  if(g.scene!=="attack"&&g.scene!=="defense")return
  if(goal){g.score[goal]++;g.events.unshift({minute:Math.floor(g.minute),text:`GOAL! ${text}`,team:goal})}
  else g.events.unshift({minute:Math.floor(g.minute),text})
  if(goal){const scorer=g.players.find(p=>p.id===g.flight?.kicker&&p.team===goal);for(const p of teamOf(g,goal)){if(p.id===scorer?.id||dist(p,g.ball)<350){p.moving=false;animate(p,"celebrate",2.1)}}}
  for(const p of g.players)p.moving=false
  g.scene="result";g.message=text;g.phaseTime=0;g.owner=null;g.flight=null;g.carry=null;g.tackle=null;g.aim=null
}
function startChance(g:Match,team:Team){
  g.scene=team==="user"?"attack":"defense";g.phaseTime=0;g.activeTime=0;g.actionCount=0;g.decisions=0;g.aiLast=null;g.aiVisits={};g.aiWait=.8;g.cooldown=0;g.carry=null;g.tackle=null;g.aim=null;g.flight=null;g.chanceCount[team]++
  const lane=Math.random()<.5?-1:1, variant=g.chanceCount[team]%3
  for(const p of g.players){
    p.moving=false;p.stride=0;p.action=null;p.actionTime=0;p.facing=forward(p.team)*Math.PI/2
    // Coordinates relative to the attacking team's target goal (top of this local layout).
    let x=p.home.x,y=0
    if(p.team===team){
      if(p.role==="GK")y=H-70
      else if(p.role==="CB")y=1100
      else if(p.role==="LB"||p.role==="RB")y=775
      else if(p.role==="CDM")y=790
      else if(isMid(p)){y=p.slot==="cm2"?690:575;if(p.role==="CAM")y=465}
      else if(p.role==="ST"){y=300;x= p.slot==="st1"?p.home.x:p.slot==="st2"?p.home.x:MID+lane*45}
      else y=365
    }else{
      if(p.role==="GK"){y=52;x=MID}
      else if(p.role==="CB")y=208
      else if(p.role==="LB"||p.role==="RB")y=250
      else if(p.role==="CDM")y=350
      else if(isMid(p))y=p.slot==="cm2"?420:490
      else y=850
      if(p.role!=="GK")x= MID+(x-MID)*.82
    }
    if(p.role!=="GK"){x+=rand(-23,23);y+=rand(-22,22)}
    p.x=clamp(x,40,W-40);p.y=clamp(team==="user"?y:H-y,35,H-35)
  }
  const attackers=teamOf(g,team)
  const chosen=(variant===0?attackers.find(p=>p.role==="ST"):variant===1?attackers.find(p=>p.slot===(lane<0?"cm1":"cm3")):attackers.find(p=>p.role===(lane<0?"LW":"RW"))) ?? attackers.find(p=>isForward(p)) ?? attackers[5]
  if(chosen){const localX=variant===0?MID+lane*95:variant===1?MID+lane*140:lane<0?125:W-125;chosen.x=team==="user"?localX:W-localX;chosen.y=team==="user"?(variant===0?390:variant===1?630:480):H-(variant===0?390:variant===1?630:480);attach(g,chosen)}
  g.camera={x:MID,y:team==="user"?410:H-410};g.message=team==="user"?"Your chance!":"Defend your goal!"
}
function kick(g:Match,p:Player,dir:Point,speed:number,curve:number,kind:Flight["kind"],target:string|null=null){
  p.moving=false;g.owner=null;g.carry=null;g.aim=null;g.lastTouch=p.team;g.actionCount++;g.possessionAge=0
  g.ball={x:p.x+dir.x*25,y:p.y+dir.y*25};p.facing=Math.atan2(dir.y,dir.x);animate(p,"kick",.32)
  g.flight={vx:dir.x*speed,vy:dir.y*speed,curve,age:0,kicker:p.id,target,kind,checked:new Set()};g.message=""
}
function pass(g:Match,p:Player,t:Player){
  let d=unit(t.x-p.x,t.y-p.y);const len=dist(p,t)
  const chance=passChance(p.role==="GK"?(p.passing+p.kicking)/2:p.passing,.56,Math.max(0,len-340)*.00023)
  const success=Math.random()<chance
  if(!success)d=rotate(d,rand(.12,.30)*(Math.random()<.5?-1:1))
  kick(g,p,d,clamp(len*1.55+180,420,1250),0,"pass",success?t.id:null)
  if(!success)g.message="Misplaced pass"
}
function laneRisk(g:Match,p:Player,to:Point){return teamOf(g,opposite(p.team)).reduce((n,q)=>n+(segDist(q,p,to)<50?110:segDist(q,p,to)<100?36:0),0)}
function space(g:Match,t:Team,p:Point){return Math.min(430,...teamOf(g,opposite(t)).map(q=>dist(q,p)))}
function tackleChance(def:Player,att:Player){return clamp(.5+(def.defending-att.dribbling)*.025,.10,.90)}
// Shoulder contact is a separate physical duel; sliding tackles stay DEF vs DRI.
function physicalChance(def:Player,att:Player){return clamp(.5+(def.physical-att.physical)*.025,.10,.90)}
function shoulderContact(att:Player,def:Player){
  const d=unit(def.x-att.x,def.y-att.y)
  return Math.abs(d.x*Math.cos(att.facing)+d.y*Math.sin(att.facing))<.60
}
function resolveShoulder(g:Match,def:Player,att:Player){
  if(g.cooldown>0)return
  g.cooldown=1.0
  if(Math.random()<physicalChance(def,att)){
    attach(g,def);endChance(g,"Ball won — physical challenge!")
  }else{
    g.message=`${att.name} shields the ball`
    const away=unit(def.x-att.x,def.y-att.y)
    const next=inside({x:def.x+away.x*45,y:def.y+away.y*45});def.x=next.x;def.y=next.y
  }
}
function resolveTackle(g:Match,def:Player,att:Player){
  if(g.cooldown>0)return
  g.cooldown=.85;g.tackle=null;def.facing=Math.atan2(att.y-def.y,att.x-def.x);animate(def,"slide",.42)
  if(Math.random()<tackleChance(def,att)){
    attach(g,def);endChance(g,"Ball won — tackle!")
  } else {g.message="Tackle missed";const away=unit(def.x-att.x,def.y-att.y);def.x=clamp(def.x+away.x*48,25,W-25);def.y=clamp(def.y+away.y*48,25,H-25)}
}
function nearest(g:Match,team:Team,point:Point,excludeGK=true){return teamOf(g,team).filter(p=>!excludeGK||p.role!=="GK").sort((a,b)=>dist(a,point)-dist(b,point))[0]}
function queueTackle(g:Match,def:Player,target:Point){if((g.scene!=="attack"&&g.scene!=="defense")||g.cooldown>0||g.tackle)return;const d=dist(def,target);const u=unit(target.x-def.x,target.y-def.y);g.tackle={id:def.id,target:inside({x:def.x+u.x*Math.min(d,230),y:def.y+u.y*Math.min(d,230)})};def.facing=Math.atan2(u.y,u.x);animate(def,"slide",.45)}
function offBall(g:Match,dt:number){
  const t:Team=g.scene==="attack"?"user":"ai", defending=opposite(t),p=ownerOf(g)
  const flight=g.flight, receiver=g.players.find(q=>q.id===flight?.target)
  const press=nearest(g,defending,g.ball)
  const loose=flight&&flight.kind==="pass"&&!receiver?nearest(g,t,g.ball):null
  for(const q of g.players){
    if(q.id===p?.id||q.id===g.tackle?.id)continue
    q.moving=false
    if(q.role==="GK"){
      const gy=q.team==="ai"?52:H-52
      const gx=clamp(g.ball.x,MID-GOAL*.42,MID+GOAL*.42)
      move(q,{x:gx,y:gy},85+q.keeperSpeed*.55+q.reflexes*.70,dt);continue
    }
    if(q.id===receiver?.id){const f=flight!;move(q,inside({x:g.ball.x+f.vx*.21,y:g.ball.y+f.vy*.21}),90+q.pace*1.5,dt);continue}
    if(q.id===loose?.id){move(q,inside(g.ball),95+q.pace*1.35,dt);continue}
    if(q.id===press?.id){
      const d=dist(q,g.ball)
      if(d<330)move(q,inside(g.ball), (55+q.pace*.94),dt)
      continue
    }
    const sign=forward(q.team)
    let tx=q.home.x,ty=q.home.y
    if(q.team===t){
      const depth=t==="user"?g.ball.y:H-g.ball.y
      if(isForward(q))ty=t==="user"?clamp(depth-115,105,490):H-clamp(depth-115,105,490)
      else if(isMid(q))ty=t==="user"?clamp(depth+200,390,875):H-clamp(depth+200,390,875)
      else if(q.role==="LB"||q.role==="RB")ty=t==="user"?clamp(depth+270,450,1050):H-clamp(depth+270,450,1050)
      else ty=t==="user"?1050:H-1050
      if(q.role==="CDM"||q.slot==="cm2")ty-=sign*85
    }else{
      const depth=t==="user"?g.ball.y:H-g.ball.y
      const rel=isBack(q)?clamp(depth*.36+95,110,330):isMid(q)?clamp(depth+85,290,760):clamp(depth+410,620,1150)
      ty=t==="user"?rel:H-rel;tx=MID+(q.home.x-MID)*.78+(g.ball.x-MID)*.18
    }
    if(isWide(q)&&q.team===t)tx=q.home.x
    else tx+=(g.ball.x-MID)*.09
    // Keep the team spread; only the presser / intended receiver break shape.
    for(const other of g.players){if(other.id===q.id||other.team!==q.team)continue;const d=dist(q,other);if(d<45&&d>.01){tx+=(q.x-other.x)/d*(45-d);ty+=(q.y-other.y)/d*(45-d)}}
    move(q,inside({x:tx,y:ty}),32+q.pace*.42,dt)
  }
}
function updateFlight(g:Match,dt:number){
  const f=g.flight;if(!f)return
  const old={...g.ball};f.age+=dt
  const v=rotate({x:f.vx,y:f.vy},f.curve*dt);f.vx=v.x;f.vy=v.y
  g.ball.x+=f.vx*dt;g.ball.y+=f.vy*dt
  const decay=Math.exp(-.66*dt);f.vx*=decay;f.vy*=decay;f.curve*=Math.exp(-1.4*dt)
  const speed=Math.hypot(f.vx,f.vy)
  // Swept collision tests prevent fast shots going through players.
  const hits=g.players.filter(p=>!(p.id===f.kicker&&f.age<.25)&&segDist(p,old,g.ball)<(p.role==="GK"?33:R+BR+4)&&!f.checked.has(p.id)).sort((a,b)=>dist(a,old)-dist(b,old))
  for(const p of hits){
    if(p.id===f.kicker&&f.age<.45)continue
    if(f.kind==="shot"&&p.team===g.lastTouch&&p.role!=="GK")continue
    f.checked.add(p.id)
    const same=p.team===g.lastTouch
    let probability=p.role==="GK"?clamp(.28+p.keeping*.006-speed*.00017,.25,.88):same?clamp(.65+p.dribbling*.003-speed*.00012,.55,.98):clamp(.22+p.defending*.006-speed*.00016,.22,.86)
    if(p.id===f.target)probability+=.18
    if(same&&p.role!=="GK"){
      const marker=nearest(g,opposite(p.team),p,false)
      if(marker&&dist(marker,p)<65)probability+=clamp((p.physical-marker.physical)*.003,-.15,.15)
    }
    probability=clamp(probability,0,.995)
    if(Math.random()>probability&&speed>100)continue
    if(p.role==="GK"){p.facing=Math.atan2(old.y-p.y,old.x-p.x);animate(p,"dive",.65)}
    if(g.scene==="attack"&&p.team==="ai"){attach(g,p);endChance(g,p.role==="GK"?"Saved by the goalkeeper":"Intercepted");return}
    if(g.scene==="defense"&&p.team==="user"){attach(g,p);endChance(g,p.role==="GK"?"Saved by the goalkeeper":"Intercepted");return}
    attach(g,p);g.aiWait=DIFFICULTIES[g.difficulty].reaction;return
  }
  if(g.ball.y< -BR||g.ball.y>H+BR){
    const y=g.ball.y<0?-BR:H+BR
    const t=clamp((y-old.y)/(g.ball.y-old.y||1),0,1),x=old.x+(g.ball.x-old.x)*t
    if(Math.abs(x-MID)<GOAL/2-BR){const scoring:Team=y<0?"user":"ai";const kicker=g.players.find(p=>p.id===f.kicker);endChance(g,kicker?.name??"Goal!",scoring)}else endChance(g,"Wide of the goal")
    return
  }
  if(g.ball.x< -BR||g.ball.x>W+BR){endChance(g,"Ball out of play");return}
  if(speed<32||f.age>5){
    const p=[...g.players].sort((a,b)=>dist(a,g.ball)-dist(b,g.ball))[0]
    if(p&&dist(p,g.ball)<55){if(p.team!==g.lastTouch)endChance(g,g.scene==="defense"?"Ball recovered!":"Possession lost");else attach(g,p)}else endChance(g,g.scene==="defense"?"Danger cleared":"Chance missed")
  }
}

// Both sides are human-controlled. The server alone advances the match.
export function lineup(raw:unknown,team:Team):Player[]{
  if(!Array.isArray(raw)||raw.length!==11)throw Error("A full eleven-slot lineup is required")
  const rows=raw as Record<string,unknown>[]
  if(rows.some(r=>!r||typeof r!=="object"))throw Error("Invalid lineup")
  const formation=Object.values(FORMATIONS).find(f=>f.every(s=>rows.some(r=>r.slot===s.key)))
  if(!formation)throw Error("Unsupported formation")
  const num=(n:unknown,fallback=80)=>typeof n==="number"&&Number.isFinite(n)?clamp(n,1,200):fallback
  return formation.map((s,i)=>{
    const r=rows.find(q=>q.slot===s.key)!,rating=num(r.rating)
    const stats:Record<string,number>={}
    for(const key of ["pace","shooting","passing","dribbling","defending","physical","diving","handling","kicking","reflexes","positioning"])stats[key]=num(r[key],rating)
    stats.speed=num(r.keeperSpeed,rating)
    const p=makePlayer(s,team,{name:String(r.name??s.role).slice(0,48),rating,position:s.role,stats},rating,i)
    p.squadRating=r.squadRating===0?0:num(r.squadRating,rating)
    return p
  })
}
export function createOnline(a:Player[],b:Player[]):Match{
  const schedule=[7,19,31,41,53,64,76,85].map((minute,i)=>({minute,team:(i%2===0?"user":"ai") as Team}))
  if(Math.random()<.5)for(const e of schedule)e.team=opposite(e.team)
  return {players:[...a,...b],ball:{x:MID,y:H/2},owner:null,flight:null,carry:null,tackle:null,scene:"simulation",score:{user:0,ai:0},minute:0,schedule,next:0,phaseTime:0,activeTime:0,actionCount:0,decisions:0,aiWait:0,aiLast:null,aiVisits:{},cooldown:0,message:"Kick off",events:[],camera:{x:MID,y:H/2},aim:null,paused:false,difficulty:"medium",attackRating:0,defenseRating:0,chanceCount:{user:0,ai:0},possessionAge:0,lastTouch:"user",halftime:false}
}
export function tickOnline(g:Match,dt:number){
  if(g.scene==="fulltime")return
  for(const p of g.players){if(p.actionTime>0){p.actionTime=Math.max(0,p.actionTime-dt);if(!p.actionTime)p.action=null}}
  g.phaseTime+=dt
  if(g.scene==="simulation"){
    const e=g.schedule[g.next];g.minute=Math.min(90,g.minute+dt*12)
    if(!g.halftime&&g.minute>=45){g.halftime=true;g.events.unshift({minute:45,text:"Half time"})}
    if(e&&g.minute>=e.minute){g.minute=e.minute;g.next++;startChance(g,e.team);g.message="Play the chance!"}
    else if(g.minute>=90){g.scene="fulltime";g.message="Full time"}return
  }
  if(g.scene==="result"){if(g.phaseTime>=2.1){g.scene="simulation";g.phaseTime=0;g.message="Match in progress";g.ball={x:MID,y:H/2}}return}
  g.activeTime+=dt;g.cooldown=Math.max(0,g.cooldown-dt)
  if(g.activeTime>35||g.actionCount>22){endChance(g,"Chance over");return}
  const p=ownerOf(g)
  if(p&&!g.carry&&!g.flight){
    g.possessionAge+=dt
    if(g.possessionAge>=5){endChance(g,"Decision time expired");return}
    for(const q of g.players)if(q.id!==g.tackle?.id)q.moving=false
    // The defender may still act while the attacker decides.
    if(!g.tackle)return
  }
  if(p&&g.carry){p.moving=true;const done=move(p,g.carry,70+p.pace*1.48,dt);setBallAtFeet(g,p);if(done){g.carry=null;g.possessionAge=0}}
  if(g.carry||g.flight)offBall(g,dt)
  const current=ownerOf(g)
  if(current&&current.moving&&!g.tackle){const q=nearest(g,opposite(current.team),current);if(q&&dist(q,current)<R*2+9){if(shoulderContact(current,q))resolveShoulder(g,q,current);else resolveTackle(g,q,current)}}
  if(g.scene!=="attack"&&g.scene!=="defense")return
  if(g.tackle){const task=g.tackle,q=g.players.find(z=>z.id===task.id);if(!q)g.tackle=null;else{
    const done=move(q,task.target,580+q.pace*2,dt),att=ownerOf(g)
    if(att&&att.team!==q.team&&dist(q,att)<R*2+15)resolveTackle(g,q,att)
    else if(g.flight&&dist(q,g.ball)<35)endChance(g,"Excellent interception!")
    else if(done){g.tackle=null;g.cooldown=.45;g.message="Tackle missed"}
  }}
  updateFlight(g,dt)
}
export function action(g:Match,team:Team,raw:unknown){
  if(!raw||typeof raw!=="object"||!(g.scene==="attack"||g.scene==="defense"))return false
  const a=raw as Record<string,unknown>,attacking=g.scene==="attack"?"user":"ai",p=ownerOf(g)
  const point=(v:unknown):Point|null=>{if(!v||typeof v!=="object")return null;const q=v as Point;return Number.isFinite(q.x)&&Number.isFinite(q.y)&&Math.abs(q.x)<W*3&&Math.abs(q.y)<H*3?{x:q.x,y:q.y}:null}
  if(team!==attacking){if(a.kind!=="tackle"||g.cooldown>0||g.tackle)return false;const q=g.players.find(q=>q.id===a.actor&&q.team===team&&q.role!=="GK");const target=point(a.target);if(!q||!target||dist(q,g.ball)>430)return false;queueTackle(g,q,target);return true}
  if(!p||p.team!==team||g.flight)return false
  if(a.kind==="cancel"){if(!g.carry)return false;g.carry=null;p.moving=false;g.possessionAge=0;return true}
  if(a.kind==="pass"){const q=g.players.find(q=>q.id===a.target&&q.team===team&&q.id!==p.id);if(!q)return false;pass(g,p,q);return true}
  if(a.kind==="dribble"){const target=point(a.target);if(!target||dist(p,target)<25)return false;g.carry=inside(target);g.actionCount++;g.message="";return true}
  if(a.kind==="swipe"){
    const v=point(a.dir);if(!v||Math.hypot(v.x,v.y)<.1||typeof a.power!=="number"||!Number.isFinite(a.power)||typeof a.curve!=="number"||!Number.isFinite(a.curve))return false
    let d=unit(v.x,v.y),curve=clamp(a.curve,-1.35,1.35);const power=clamp(a.power,.12,1),goalY=team==="user"?0:H,goalX=d.y*forward(team)>.04?p.x+d.x*(goalY-p.y)/d.y:Infinity
    const shot=d.y*forward(team)>.15&&Math.abs(p.y-goalY)<720&&Math.abs(goalX-MID)<GOAL*.85+Math.abs(curve)*150
    if(shot){d=rotate(d,rand(-1,1)*shotError(p.shooting));kick(g,p,d,700+power*(690+p.shooting*3),curve,"shot")}
    else{const success=Math.random()<passChance(p.role==="GK"?(p.passing+p.kicking)/2:p.passing,.42);if(!success)curve=0;const end=point(a.target)??{x:p.x+d.x*300,y:p.y+d.y*300};const receiver=teamOf(g,team).filter(q=>q.id!==p.id&&dist(q,end)<175&&((q.x-p.x)*d.x+(q.y-p.y)*d.y)>40).sort((q,r)=>dist(q,end)-dist(r,end))[0];kick(g,p,d,330+power*(870+(p.role==="GK"?(p.kicking-80)*2:0)),curve,"pass",success?receiver?.id??null:null);if(!success)g.message="Poor pass — no curve"}
    return true
  }return false
}
