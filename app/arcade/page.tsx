"use client"

import { normalizePlayStyles, style, styleName, type PlayStyleEntry } from "@/lib/playStyles"
import Link from "next/link"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { getInventory, getSquad } from "@/lib/storage"

// Original highlight-based football arcade engine. Pixel sprites are generated and cached at runtime; no external assets.
type Team = "user" | "ai"
type Difficulty = "easy" | "medium" | "hard"
type Role = "GK" | "CB" | "LB" | "RB" | "CM" | "CDM" | "CAM" | "LM" | "RM" | "LW" | "RW" | "ST"
type Point = { x: number; y: number }
type Card = ReturnType<typeof getInventory>[number]
type Slot = { key: string; role: Role; x: number; y: number }
type Animation = "kick" | "slide" | "dive" | "celebrate"
type Player = Point & { playStyles: PlayStyleEntry[]; id: string; name: string; team: Team; role: Role; slot: string; home: Point; rating: number; pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number; keeping: number; diving: number; handling: number; kicking: number; reflexes: number; keeperSpeed: number; positioning: number; squadRating: number; facing: number; stride: number; moving: boolean; skin: string; hair: string; number: number; hairStyle: number; action: Animation | null; actionTime: number }
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
  const x = s.x*W, y = (team === "user" ? s.y : 1-s.y)*H
  const diving=stat(card,"diving",rating),handling=stat(card,"handling",rating),kicking=stat(card,"kicking",rating),reflexes=stat(card,"reflexes",rating),positioning=stat(card,"positioning",rating),keeperSpeed=stat(card,"speed",stat(card,"pace",rating))
  const keep=(diving+handling+reflexes+positioning)/4
  return {playStyles:normalizePlayStyles((card as {playStyles?:unknown}|undefined)?.playStyles),id:`${team}-${s.key}`,slot:s.key,role:s.role,name:card?.name ?? (team === "ai" ? `AI ${s.role}` : `Reserve ${s.role}`),team,x,y,home:{x,y},rating,
    pace:stat(card,"pace",rating),shooting:stat(card,"shooting",rating),passing:stat(card,"passing",rating),dribbling:stat(card,"dribbling",rating),defending:stat(card,"defending",rating),physical:stat(card,"physical",rating),keeping:keep,diving,handling,kicking,reflexes,keeperSpeed,positioning,squadRating:card?adjustedRating(card,s.role):team==="ai"?rating:0,
    facing:team === "user" ? -Math.PI/2 : Math.PI/2,stride:0,moving:false,skin:["#efbc91","#a96c45","#d79868","#79503a","#f5d0ac"][seed%5],hair:["#33291f","#201b19","#604127","#b58a41"][Math.floor(seed/7)%4],number:index+1,hairStyle:Math.floor(seed/13)%3,action:null,actionTime:0}
}
function loadLineup(): Player[] {
  const squad = getSquad()
  const inventory = getInventory()
  const data = squad as unknown as {formation?: string; slots: Record<string,string|null>}
  const keys = Object.fromEntries(Object.entries(data.slots ?? {}).map(([k,v])=>[k.toLowerCase(),v]))
  const formation = FORMATIONS[String(data.formation)] ?? ("st2" in keys ? FORMATIONS["4-4-2"] : "cdm2" in keys ? FORMATIONS["4-2-3-1"] : FORMATIONS["4-3-3"])
  const used = new Set<string>()
  return formation.map((s,i)=>{
    const id = keys[s.key]
    const card = id && !used.has(id) ? inventory.find(p=>p.id===id) : undefined
    if(card) used.add(card.id)
    return makePlayer(s,"user",card,80,i)
  })
}
function createMatch(difficulty: Difficulty): Match {
  const user=loadLineup(), cfg=DIFFICULTIES[difficulty]
  const ai=FORMATIONS["4-3-3"].map((s,i)=>makePlayer(s,"ai",undefined,cfg.ovr,i))
  const average=(ps:Player[],key:"shooting"|"passing"|"defending"|"keeping")=>ps.reduce((sum,p)=>sum+p[key],0)/Math.max(1,ps.length)
  const att=(average(user.filter(isForward),"shooting")+average(user.filter(isMid),"passing"))/2
  const def=(average(user.filter(p=>isBack(p)&&p.role!=="GK"),"defending")+average(user.filter(p=>p.role==="GK"),"keeping"))/2
  const advantage=clamp(.5+(att-cfg.ovr)*.012+(def-cfg.ovr)*.004,.30,.73)
  const minutes=[7,19,31,41,53,64,76,85].map(m=>m+Math.floor(rand(-3,4)))
  const schedule=minutes.map(minute=>({minute,team:(Math.random()<advantage?"user":"ai") as Team}))
  // Always provide both attacking and defending opportunities.
  if(!schedule.some(e=>e.team==="user")) schedule[1].team="user"
  if(!schedule.some(e=>e.team==="ai")) schedule[5].team="ai"
  return {players:[...user,...ai],ball:{x:MID,y:H/2},owner:null,flight:null,carry:null,tackle:null,scene:"simulation",score:{user:0,ai:0},minute:0,schedule,next:0,phaseTime:0,activeTime:0,actionCount:0,decisions:0,aiWait:0,aiLast:null,aiVisits:{},cooldown:0,message:"Kick off",events:[],camera:{x:MID,y:H/2},aim:null,paused:false,difficulty,attackRating:att,defenseRating:def,chanceCount:{user:0,ai:0},possessionAge:0,lastTouch:"user",halftime:false}
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
  if(goal){g.score[goal]++;g.events.unshift({minute:Math.floor(g.minute),text:goal==="user"?`GOAL! ${text}`:`Opponent goal — ${text}`,team:goal})}
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
      else if(p.role==="ST"){y=300;x= p.slot==="st1"?MID-120:p.slot==="st2"?MID+120:MID+lane*45}
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
  if(chosen){chosen.x=variant===0?MID+lane*95:variant===1?MID+lane*140:lane<0?125:W-125;chosen.y=team==="user"?(variant===0?390:variant===1?630:480):H-(variant===0?390:variant===1?630:480);attach(g,chosen)}
  g.camera={x:MID,y:team==="user"?410:H-410};g.message=team==="user"?"Your chance!":"Defend your goal!"
}
function kick(g:Match,p:Player,dir:Point,speed:number,curve:number,kind:Flight["kind"],target:string|null=null){
  speed*=kind==="pass"?1+.18*style(p,"pingedPass"):1+.15*style(p,"powerShot");p.moving=false;g.owner=null;g.carry=null;g.aim=null;g.lastTouch=p.team;g.actionCount++;g.possessionAge=0
  g.ball={x:p.x+dir.x*25,y:p.y+dir.y*25};p.facing=Math.atan2(dir.y,dir.x);animate(p,"kick",.32)
  g.flight={vx:dir.x*speed,vy:dir.y*speed,curve,age:0,kicker:p.id,target,kind,checked:new Set()};g.message=""
}
function pass(g:Match,p:Player,t:Player){
  let d=unit(t.x-p.x,t.y-p.y);const len=dist(p,t)
  const chance=passChance(p.role==="GK"?(p.passing+p.kicking)/2:p.passing,.56,Math.max(0,len-340)*.00023)
  const success=Math.random()<1-(1-chance)*(1-.25*style(p,"incisivePass"))
  if(!success)d=rotate(d,rand(.12,.30)*(Math.random()<.5?-1:1))
  kick(g,p,d,clamp(len*1.55+180,420,1250),0,"pass",success?t.id:null)
  if(!success)g.message="Misplaced pass"
}
function laneRisk(g:Match,p:Player,to:Point){return teamOf(g,opposite(p.team)).reduce((n,q)=>n+(segDist(q,p,to)<50?110:segDist(q,p,to)<100?36:0),0)}
function space(g:Match,t:Team,p:Point){return Math.min(430,...teamOf(g,opposite(t)).map(q=>dist(q,p)))}
function aiDecision(g:Match,p:Player){
  const goalY=H, gap=goalY-p.y, cfg=DIFFICULTIES[g.difficulty]
  const keeper=teamOf(g,"user").find(q=>q.role==="GK")
  if(gap<470&&Math.abs(p.x-MID)<350&&(g.decisions>2||laneRisk(g,p,{x:MID,y:H})<140||gap<210)){
    const side=(keeper?.x??MID)>MID?-1:1
    const aim={x:MID+side*(GOAL*.34)+rand(-25,25),y:H+30}
    const dir=rotate(unit(aim.x-p.x,aim.y-p.y),rand(-1,1)*shotError(p.shooting)*(1-.30*style(p,"finesseShot"))*.75)
    kick(g,p,dir,1120+p.shooting*3,0,"shot");return
  }
  const choices=teamOf(g,"ai").filter(q=>q.id!==p.id&&q.role!=="GK"&&dist(p,q)<790&&q.y>p.y+50)
    .map(q=>({q,value:(q.y-p.y)*.8+space(g,"ai",q)*.46-laneRisk(g,p,q)*(g.difficulty==="hard"?1.8:1.2)-(g.aiVisits[q.id]??0)*150+(q.id===g.aiLast?-650:0)+(isForward(q)?70:0)})).sort((a,b)=>b.value-a.value)
  const best=choices[0]
  if(best&&best.value>70&&g.decisions<9){g.aiLast=p.id;g.aiVisits[best.q.id]=(g.aiVisits[best.q.id]??0)+1;g.decisions++;pass(g,p,best.q);return}
  // No safe forward pass? Carry into the best open channel; never recycle CB to CB.
  const options=[-150,-75,0,75,150].map(dx=>inside({x:p.x+dx+(MID-p.x)*.12,y:p.y+rand(125,205)}))
  options.sort((a,b)=>(space(g,"ai",b)-laneRisk(g,p,b)*.45)-(space(g,"ai",a)-laneRisk(g,p,a)*.45))
  g.carry=options[0];g.decisions++;g.aiWait=cfg.reaction
}
function tackleChance(def:Player,att:Player){return clamp(.5+(def.defending-att.dribbling)*.025+.08*style(def,"anticipate")-.06*style(att,"pressProven"),.10,.90)}
// Shoulder contact is a separate physical duel; sliding tackles stay DEF vs DRI.
function physicalChance(def:Player,att:Player){return clamp(.5+(def.physical-att.physical)*.025+.10*(style(def,"bruiser")-style(att,"bruiser"))-.06*style(att,"pressProven"),.10,.90)}
function shoulderContact(att:Player,def:Player){
  const d=unit(def.x-att.x,def.y-att.y)
  return Math.abs(d.x*Math.cos(att.facing)+d.y*Math.sin(att.facing))<.60
}
function resolveShoulder(g:Match,def:Player,att:Player){
  if(g.cooldown>0)return
  g.cooldown=1.0
  if(Math.random()<physicalChance(def,att)){
    attach(g,def);endChance(g,def.team==="user"?"Ball won — physical challenge!":"Outmuscled — possession lost")
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
    if(def.team==="user"){attach(g,def);endChance(g,"Ball won! Great defending.")}
    else {attach(g,def);endChance(g,"Possession lost")}
  } else {g.message="Tackle missed";const away=unit(def.x-att.x,def.y-att.y);def.x=clamp(def.x+away.x*48,25,W-25);def.y=clamp(def.y+away.y*48,25,H-25)}
}
function nearest(g:Match,team:Team,point:Point,excludeGK=true){return teamOf(g,team).filter(p=>!excludeGK||p.role!=="GK").sort((a,b)=>dist(a,point)-dist(b,point))[0]}
function queueTackle(g:Match,def:Player,target:Point){if(g.scene!=="defense"||g.cooldown>0||g.tackle)return;const d=dist(def,target);const u=unit(target.x-def.x,target.y-def.y);g.tackle={id:def.id,target:inside({x:def.x+u.x*Math.min(d,230),y:def.y+u.y*Math.min(d,230)})};def.facing=Math.atan2(u.y,u.x);animate(def,"slide",.45)}
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
      if(d<330&&g.scene==="attack")move(q,inside(g.ball), (55+q.pace*.94)*DIFFICULTIES[g.difficulty].press,dt)
      else if(d<260&&flight&&g.scene==="defense")move(q,inside(g.ball),65+q.pace*.8,dt)
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
  const hits=g.players.filter(p=>!(p.id===f.kicker&&f.age<.25)&&segDist(p,old,g.ball)<(p.role==="GK"?33:R+BR+4+(p.team!==g.lastTouch?5*style(p,"intercept"):0))&&!f.checked.has(p.id)).sort((a,b)=>dist(a,old)-dist(b,old))
  for(const p of hits){
    if(p.id===f.kicker&&f.age<.45)continue
    if(f.kind==="shot"&&p.team===g.lastTouch&&p.role!=="GK")continue
    f.checked.add(p.id)
    const same=p.team===g.lastTouch
    let probability=p.role==="GK"?clamp(.28+p.keeping*.006-speed*.00017,.25,.88):same?clamp(.65+p.dribbling*.003-speed*.00012,.55,.98):clamp(.22+p.defending*.006-speed*.00016,.22,.86)
    if(p.role==="GK")probability+=.08*style(p,"longReach");else if(same)probability+=.08*style(p,"firstTouch");else probability+=.10*style(p,"intercept")
    if(p.id===f.target)probability+=.18
    if(same&&p.role!=="GK"){
      const marker=nearest(g,opposite(p.team),p,false)
      if(marker&&dist(marker,p)<65)probability+=clamp((p.physical-marker.physical)*.003,-.15,.15)
    }
    probability=clamp(probability,0,.995)
    if(Math.random()>probability&&speed>100)continue
    if(p.role==="GK"){p.facing=Math.atan2(old.y-p.y,old.x-p.x);animate(p,"dive",.65)}
    if(g.scene==="attack"&&p.team==="ai"){attach(g,p);endChance(g,p.role==="GK"?"Saved by the goalkeeper":"Intercepted");return}
    if(g.scene==="defense"&&p.team==="user"){attach(g,p);endChance(g,p.role==="GK"?"Great save!":"Pass intercepted!");return}
    attach(g,p);g.aiWait=DIFFICULTIES[g.difficulty].reaction;return
  }
  if(g.ball.y< -BR||g.ball.y>H+BR){
    const y=g.ball.y<0?-BR:H+BR
    const t=clamp((y-old.y)/(g.ball.y-old.y||1),0,1),x=old.x+(g.ball.x-old.x)*t
    if(Math.abs(x-MID)<GOAL/2-BR){const scoring:Team=y<0?"user":"ai";const kicker=g.players.find(p=>p.id===f.kicker);endChance(g,scoring==="user"?(kicker?.name??"Goal!"):"Goal conceded",scoring)}else endChance(g,"Wide of the goal")
    return
  }
  if(g.ball.x< -BR||g.ball.x>W+BR){endChance(g,"Ball out of play");return}
  if(speed<32||f.age>5){
    const p=[...g.players].sort((a,b)=>dist(a,g.ball)-dist(b,g.ball))[0]
    if(p&&dist(p,g.ball)<55){if(p.team!==g.lastTouch)endChance(g,g.scene==="defense"?"Ball recovered!":"Possession lost");else attach(g,p)}else endChance(g,g.scene==="defense"?"Danger cleared":"Chance missed")
  }
}
function tick(g:Match,dt:number){
  if(g.paused||g.scene==="fulltime")return
  for(const p of g.players){if(p.actionTime>0){p.actionTime=Math.max(0,p.actionTime-dt);if(p.actionTime===0)p.action=null}}
  g.phaseTime+=dt
  if(g.scene==="simulation"){
    const e=g.schedule[g.next];g.minute=Math.min(90,g.minute+dt*12)
    if(!g.halftime&&g.minute>=45){g.halftime=true;g.message="Half time";g.events.unshift({minute:45,text:"Half time"})}
    if(e&&g.minute>=e.minute){g.minute=e.minute;g.next++;startChance(g,e.team)}else if(g.minute>=90){g.scene="fulltime";g.message="Full time"}
    return
  }
  if(g.scene==="result"){
    if(g.phaseTime>=2.1){g.scene="simulation";g.phaseTime=0;g.message="Match in progress";g.ball={x:MID,y:H/2};g.camera={x:MID,y:H/2}}
    return
  }
  // Like a highlight puzzle: stop the entire pitch while the user plans a move.
  const p=ownerOf(g)
  if(g.scene==="attack"&&p?.team==="user"&&!g.carry&&!g.flight){for(const q of g.players)q.moving=false;return}
  g.activeTime+=dt;g.cooldown=Math.max(0,g.cooldown-dt)
  if(g.activeTime>27||g.actionCount>16){endChance(g,g.scene==="defense"?"Attack survived":"Chance over");return}
  if(p){
    g.possessionAge+=dt
    if(g.carry){
      const target=g.carry;const done=move(p,target,(70+p.pace*1.48)*(1+.10*style(p,"quickStep")),dt);setBallAtFeet(g,p)
      if(done){g.carry=null;g.aiWait=.1}
    }
    if(p.team==="ai"&&!g.carry){g.aiWait-=dt;if(g.aiWait<=0){aiDecision(g,p)}}
  }
  if(g.scene!=="attack"&&g.scene!=="defense")return
  offBall(g,dt)
  const current=ownerOf(g)
  if(current&&current.moving){
    const q=nearest(g,opposite(current.team),current)
    if(q&&dist(q,current)<R*2+9){
      if(shoulderContact(current,q)&&!g.tackle)resolveShoulder(g,q,current)
      else if(current.team==="user"&&g.scene==="attack")resolveTackle(g,q,current)
    }
  }
  if(g.scene!=="attack"&&g.scene!=="defense")return
  if(g.tackle){
    const task=g.tackle,q=g.players.find(z=>z.id===task.id)
    if(!q){g.tackle=null}else{
      const done=move(q,task.target,580+q.pace*2,dt),att=ownerOf(g)
      if(att?.team==="ai"&&dist(q,att)<R*2+15)resolveTackle(g,q,att)
      else if(g.flight&&dist(q,g.ball)<35){endChance(g,"Excellent interception!")}
      else if(done){g.tackle=null;g.cooldown=.45;g.message="Tackle missed"}
    }
  }
  updateFlight(g,dt)
}

// Rendering: original chunky pixel footballers, striped pitch, net and camera.
type View = { scale:number; x:number; y:number; width:number; height:number }
function viewFor(g:Match,w:number,h:number):View{
  const scale=Math.min(w/(W+100),h/780)
  const half=h/(2*scale),margin=NET+35
  const targetY=half*2>=H+2*margin?H/2:clamp(g.camera.y,half-margin,H+margin-half)
  return {scale,x:w/2-MID*scale,y:h/2-targetY*scale,width:w,height:h}
}
const toWorld=(v:View,p:Point):Point=>({x:(p.x-v.x)/v.scale,y:(p.y-v.y)/v.scale})
function drawPitch(ctx:CanvasRenderingContext2D){
  ctx.fillStyle="#497927";ctx.fillRect(-300,-180,W+600,H+360)
  for(let y=0,i=0;y<H;y+=100,i++){ctx.fillStyle=i%2?"#72a52f":"#80b83a";ctx.fillRect(0,y,W,Math.min(100,H-y))}
  ctx.strokeStyle="#f3f5d7";ctx.lineWidth=4;ctx.strokeRect(0,0,W,H)
  ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.beginPath();ctx.arc(MID,H/2,100,0,Math.PI*2);ctx.stroke()
  ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(MID,H/2,5,0,Math.PI*2);ctx.fill()
  for(const top of [true,false]){
    ctx.strokeStyle="#f3f5d7";ctx.lineWidth=4
    const line=top?0:H,side=top?1:-1,boxY=top?0:H-230
    ctx.strokeRect(MID-300,boxY,600,230);ctx.strokeRect(MID-155,top?0:H-84,310,84)
    ctx.beginPath();ctx.arc(MID,line+side*150,5,0,Math.PI*2);ctx.fill()
    ctx.beginPath();ctx.arc(MID,line+side*150,105,top?.86:Math.PI+.86,top?Math.PI-.86:Math.PI*2-.86);ctx.stroke()
    const gy=top?-NET:H,gx=MID-GOAL/2
    ctx.fillStyle="#304d24";ctx.fillRect(gx-7,gy-5,GOAL+14,NET+10)
    ctx.fillStyle="rgba(230,240,220,.28)";ctx.fillRect(gx,gy,GOAL,NET)
    ctx.strokeStyle="rgba(248,252,238,.70)";ctx.lineWidth=1.5
    for(let i=0;i<=12;i++){ctx.beginPath();ctx.moveTo(gx+GOAL*i/12,gy);ctx.lineTo(gx+GOAL*i/12,gy+NET);ctx.stroke()}
    for(let i=0;i<=5;i++){ctx.beginPath();ctx.moveTo(gx,gy+NET*i/5);ctx.lineTo(gx+GOAL,gy+NET*i/5);ctx.stroke()}
    ctx.strokeStyle="#fff";ctx.lineWidth=6;ctx.strokeRect(gx,gy,GOAL,NET)
    ctx.fillStyle="#fff";for(const x of [gx,gx+GOAL])ctx.fillRect(x-4,line-4,8,8)
    // Unbranded stadium fascia behind each end.
    ctx.fillStyle="#253945";ctx.fillRect(-30,top?-135:H+110,W+60,24)
    ctx.fillStyle="#bdcfcc";for(let x=12;x<W;x+=90)ctx.fillRect(x,top?-129:H+116,45,4)
    ctx.fillStyle="#fff"
  }
}
// Pixel-art sprites: generated on a tiny canvas, then enlarged with nearest-neighbor sampling.
// Each player has eight directional views, four run frames and separate action poses.
const spriteCache = new Map<string, HTMLCanvasElement>()
const SPRITE_W = 40, SPRITE_H = 40, PIXEL = 1.65
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]] as const
const KIT = {
  user: {shirt:"#2358d3",light:"#6396ff",dark:"#15378b",shorts:"#172e74",sock:"#e5efff"},
  ai: {shirt:"#e77320",light:"#ffad55",dark:"#99400f",shorts:"#493327",sock:"#ffdfb3"},
  userGK: {shirt:"#14956b",light:"#66d5a3",dark:"#0e674c",shorts:"#144f40",sock:"#d4f5e7"},
  aiGK: {shirt:"#d6b92e",light:"#ffe56c",dark:"#8d7218",shorts:"#5f501d",sock:"#fff0a0"},
}
// Draw a pixel-thick limb using integer coordinates (no anti-aliasing).
function pixelLine(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,width:number,color:string){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))))
  ctx.fillStyle=color
  for(let i=0;i<=steps;i++)ctx.fillRect(Math.round(x1+(x2-x1)*i/steps-width/2),Math.round(y1+(y2-y1)*i/steps-width/2),width,width)
}
function playerSprite(p:Player,direction:number,pose:string,frame:number){
  const key=[p.team,p.role==="GK",p.skin,p.hair,p.hairStyle,p.number,direction,pose,frame].join("|")
  const cached=spriteCache.get(key);if(cached)return cached
  const c=document.createElement("canvas");c.width=SPRITE_W;c.height=SPRITE_H
  const ctx=c.getContext("2d");if(!ctx)return c
  const kit=p.role==="GK"?(p.team==="user"?KIT.userGK:KIT.aiGK):KIT[p.team]
  const [dx,dy]=DIRS[direction],side=dx!==0&&dy===0,back=dy<0,diagonal=dx!==0&&dy!==0
  const ink="#192530",boot="#17202b",glove=p.role==="GK"?"#f8f8e9":p.skin
  const rect=(color:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
  const limb=(a:Point,b:Point,w:number,color:string)=>pixelLine(ctx,a.x,a.y,b.x,b.y,w,color)
  const run=pose==="run"?[0,4,0,-4][frame%4]:0
  const bob=pose==="run"&&frame%2===1?-1:pose==="celebrate"&&frame===1?-2:0
  // Sliding and diving are full-body poses, leaning in the action direction.
  if(pose==="slide"||pose==="dive"){
    const sign=dx||1, reach=pose==="dive"?8:6, lift=pose==="dive"?-4:0
    const hip={x:19-sign*4,y:26+lift},shoulder={x:19+sign*4,y:22+lift},head={x:19+sign*10,y:20+lift}
    limb(hip,{x:hip.x-sign*reach,y:31+lift},6,kit.shorts)
    limb({x:hip.x-sign*reach,y:31+lift},{x:hip.x-sign*(reach+4),y:32+lift},4,kit.sock)
    limb({x:hip.x-sign*(reach+4),y:32+lift},{x:hip.x-sign*(reach+6),y:32+lift},3,boot)
    limb(hip,shoulder,10,ink);limb(hip,shoulder,8,kit.shirt)
    limb(shoulder,{x:shoulder.x+sign*9,y:shoulder.y-4},4,glove)
    rect(ink,head.x-4,head.y-4,9,9);rect(p.skin,head.x-3,head.y-3,7,7);rect(p.hair,head.x-4,head.y-4,8,3)
    spriteCache.set(key,c);return c
  }
  const cx=20,bodyY=14+bob,bodyW=side?9:diagonal?11:13
  const left=cx-Math.floor(bodyW/2),right=left+bodyW-1
  // Feet and arms swing along the facing direction; idle players stay still.
  for(const leg of [-1,1]){
    const x=cx+leg*(side?2:3),swing=run*leg
    const kick=pose==="kick"&&leg===1?(frame===0?-3:frame===1?7:3):0
    const vx=dx*(swing+kick),vy=dy*(swing+kick)
    const knee={x:x+vx*.45,y:26+bob+vy*.35},foot={x:x+vx,y:31+bob+vy*.65}
    limb({x,y:22+bob},knee,5,kit.shorts);limb(knee,foot,3,kit.sock)
    rect(boot,foot.x-2,foot.y,5,3)
  }
  for(const arm of [-1,1]){
    const shoulder={x:arm<0?left-1:right+1,y:bodyY+2}
    const hand=pose==="celebrate"?{x:shoulder.x+arm*4,y:bodyY-8-frame*2}:{x:shoulder.x+arm*2-dx*run*arm*.6,y:bodyY+8-dy*run*arm*.5}
    limb(shoulder,hand,4,ink);limb(shoulder,hand,3,glove)
    limb(shoulder,{x:shoulder.x+arm,y:shoulder.y+3},4,kit.shirt)
  }
  rect(ink,left-1,bodyY-1,bodyW+2,12);rect(kit.shirt,left,bodyY,bodyW,10)
  rect(kit.dark,right-1,bodyY+2,2,8);rect(kit.light,left,bodyY,bodyW-2,2)
  rect(kit.shorts,left+1,bodyY+9,bodyW-2,4)
  // Shirt number is kept pixel-sized; two digits fit on a back-facing shirt.
  if(back&&!side){const digits=["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001","111100111001111","111100111101111","111001001001001","111101111101111","111101111001111"];const ns=String(p.number);for(let i=0;i<ns.length;i++){const bits=digits[Number(ns[i])];for(let j=0;j<15;j++)if(bits[j]==="1")rect("#f4f4e9",cx-Math.floor((ns.length*4-1)/2)+i*4+j%3,bodyY+3+Math.floor(j/3),1,1)}}
  else {rect("#edf3e5",cx-1,bodyY+2,3,1);rect(kit.light,left+1,bodyY+4,2,2)}
  // Head: north shows the back of the hair; south shows both eyes; diagonals / side show a profile.
  const hx=cx+(side?dx*2:diagonal?dx:0),hy=bodyY-9
  rect(ink,hx-5,hy,10,9);rect(ink,hx-4,hy-1,8,11)
  rect(p.skin,hx-4,hy+1,8,7);rect(p.skin,hx-3,hy+7,6,2)
  rect(p.hair,hx-4,hy,8,back?6:3)
  if(p.hairStyle===1){rect(p.hair,hx-5,hy+1,2,6);rect(p.hair,hx+3,hy+1,2,5)}
  if(p.hairStyle===2)rect(p.hair,hx-3,hy-2,5,3)
  if(back){rect(p.hair,hx-4,hy+2,8,5);if(diagonal)rect(p.skin,hx+dx*3,hy+4,1,3)}
  else if(dx!==0){rect(ink,hx+dx*2,hy+4,1,1);rect(p.skin,hx+dx*4,hy+5,2,2)}
  else {rect(ink,hx-2,hy+4,1,1);rect(ink,hx+2,hy+4,1,1);rect("#a76e54",hx-1,hy+7,3,1)}
  spriteCache.set(key,c);return c
}
function drawPlayer(ctx:CanvasRenderingContext2D,p:Player,owner:boolean,selected:boolean){
  ctx.save();ctx.translate(p.x,p.y)
  ctx.fillStyle="rgba(0,0,0,.28)";ctx.beginPath();ctx.ellipse(3,10,16,8,0,0,Math.PI*2);ctx.fill()
  if(owner||selected){ctx.strokeStyle=owner?(p.team==="user"?"#f9f49c":"#ffd6a0"):"#9de4ff";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,8,22,15,0,0,Math.PI*2);ctx.stroke()}
  const direction=(Math.round(p.facing/(Math.PI/4))+8)%8
  const pose=p.action??(p.moving?"run":"idle")
  const frame=pose==="run"?Math.floor(p.stride*1.4)%4:pose==="kick"?clamp(Math.floor((.32-p.actionTime)*12),0,2):pose==="celebrate"?Math.floor(p.actionTime*5)%2:0
  const sprite=playerSprite(p,direction,pose,frame)
  ctx.imageSmoothingEnabled=false
  ctx.drawImage(sprite,-SPRITE_W*PIXEL/2,-25*PIXEL,SPRITE_W*PIXEL,SPRITE_H*PIXEL)
  if(owner){ctx.fillStyle=p.team==="user"?"#fff6a0":"#ffbe82";ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(-6,-43);ctx.lineTo(6,-43);ctx.closePath();ctx.fill()}
  ctx.restore()
}
function aimVector(a:Gesture){const dx=a.end.x-a.start.x,dy=a.end.y-a.start.y;const d=unit(dx,dy);const initial=a.first?unit(a.first.x-a.start.x,a.first.y-a.start.y):d;const curve=clamp((initial.x*d.y-initial.y*d.x)*2.2,-1.35,1.35);return {d,power:clamp(Math.hypot(dx,dy)/300,.12,1),curve}}
function paint(g:Match,ctx:CanvasRenderingContext2D,w:number,h:number,v:View,curveMode:boolean,pullMode:boolean){
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#355524";ctx.fillRect(0,0,w,h)
  ctx.save();ctx.translate(v.x,v.y);ctx.scale(v.scale,v.scale);drawPitch(ctx)
  const active=ownerOf(g),def=g.scene==="defense"?controlledPlayer(g):undefined
  for(const p of [...g.players].sort((a,b)=>a.y-b.y))drawPlayer(ctx,p,p.id===g.owner,p.id===def?.id)
  ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(g.ball.x+2,g.ball.y+4,8,5,0,0,Math.PI*2);ctx.fill()
  ctx.fillStyle="#fff";ctx.strokeStyle="#253047";ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(g.ball.x,g.ball.y,BR,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#263047";ctx.fillRect(g.ball.x-2,g.ball.y-2,4,4)
  if(g.carry&&active?.team==="user") {ctx.strokeStyle="#e7f5ff";ctx.lineWidth=2.5;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(active.x,active.y);ctx.lineTo(g.carry.x,g.carry.y);ctx.stroke();ctx.setLineDash([])}
  if(g.aim){const a=g.aim,vec=aimVector(a);let d=vec.d;if(pullMode&&a.mode==="attack")d={x:-d.x,y:-d.y};const start=a.mode==="attack"?g.ball:a.start;const length=dist(a.start,a.end);const end={x:start.x+d.x*length,y:start.y+d.y*length};ctx.strokeStyle=a.mode==="attack"?"#fff6bd":"#9de4ff";ctx.lineWidth=4;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo((start.x+end.x)/2-d.y*(curveMode?vec.curve:0)*length*.25,(start.y+end.y)/2+d.x*(curveMode?vec.curve:0)*length*.25,end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-d.x*16-d.y*9,end.y-d.y*16+d.x*9);ctx.lineTo(end.x-d.x*16+d.y*9,end.y-d.y*16-d.x*9);ctx.closePath();ctx.fill()}
  ctx.restore()
  // Names remain sharp at any resolution.
  ctx.font="600 11px Arial";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#18261b";ctx.fillStyle="#fff"
  for(const p of g.players){if(p.team!=="user"&&p.id!==g.owner)continue;const x=v.x+p.x*v.scale,y=v.y+p.y*v.scale+32*v.scale+8;if(y<0||y>h)continue;const name=p.name.length>22?p.name.split(" ").slice(-1)[0]:p.name;const label=`${p.rating} ${name}`;ctx.strokeText(label,x,y);ctx.fillText(label,x,y)}
  // Small radar at bottom left, showing all 22 players even when camera is zoomed.
  if(w>680){const rw=77,rh=112,rx=14,ry=h-rh-14;ctx.fillStyle="rgba(14,33,23,.75)";ctx.fillRect(rx,ry,rw,rh);ctx.strokeStyle="#a8c8a0";ctx.lineWidth=1;ctx.strokeRect(rx+4,ry+4,rw-8,rh-8);ctx.beginPath();ctx.moveTo(rx+4,ry+rh/2);ctx.lineTo(rx+rw-4,ry+rh/2);ctx.stroke();for(const p of g.players){ctx.fillStyle=p.team==="user"?"#7da8ff":"#ffad67";ctx.fillRect(rx+4+p.x/W*(rw-8)-2,ry+4+p.y/H*(rh-8)-2,4,4)}ctx.fillStyle="#fff";ctx.fillRect(rx+4+g.ball.x/W*(rw-8)-1.5,ry+4+g.ball.y/H*(rh-8)-1.5,3,3)}
}

type StatPanelData = {playStyles:PlayStyleEntry[];name:string;role:Role;rating:number;stats:{label:string;value:number}[]}
function panelData(p:Player):StatPanelData{
  const stats=p.role==="GK"?[["DIV",p.diving],["HAN",p.handling],["KIC",p.kicking],["REF",p.reflexes],["SPD",p.keeperSpeed],["POS",p.positioning]]:[["PAC",p.pace],["SHO",p.shooting],["PAS",p.passing],["DRI",p.dribbling],["DEF",p.defending],["PHY",p.physical]]
  return {playStyles:p.playStyles??[],name:p.name,role:p.role,rating:p.rating,stats:stats.map(([label,value])=>({label:String(label),value:Number(value)}))}
}
function controlledPlayer(g:Match){
  if(g.scene==="defense")return g.players.find(p=>p.team==="user"&&p.id===(g.tackle?.id??g.aim?.actor))??nearest(g,"user",g.ball)
  if(g.scene==="attack")return g.players.find(p=>p.team==="user"&&p.id===(g.owner??g.flight?.target??g.flight?.kicker))??nearest(g,"user",g.ball,false)
  return undefined
}
function PlayerStats({player,defending}:{player:StatPanelData|null;defending:boolean}){
  return <aside className="shrink-0 border-t border-white/10 bg-[#122334] px-3 py-2 lg:w-56 lg:border-l lg:border-t-0 lg:p-4">
    <div className="mb-2 flex items-center justify-between gap-2 lg:mb-4"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{defending?"Selected defender":"Controlled player"}</p></div>
    {player?<><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-700 font-black leading-none lg:h-14 lg:w-14"><span className="text-lg lg:text-2xl">{player.rating}</span><span className="mt-1 text-[10px]">{player.role}</span></div><p className="min-w-0 break-words text-sm font-black lg:text-lg">{player.name}</p></div>
    <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 lg:mt-5 lg:grid-cols-1 lg:gap-3">{player.stats.map(stat=><div key={stat.label} className="min-w-0"><div className="flex justify-between gap-1 text-xs font-bold"><span className="text-slate-300">{stat.label}</span><span className="tabular-nums">{stat.value}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${stat.value>=100?"bg-cyan-300":stat.value>=90?"bg-emerald-400":stat.value>=70?"bg-yellow-400":"bg-orange-400"}`} style={{width:`${clamp(stat.value/Math.max(110,...player.stats.map(s=>s.value))*100,0,100)}%`}}/></div></div>)}</div>{player.playStyles.length>0&&<div className="mt-3 flex flex-wrap gap-1">{player.playStyles.map(s=><span key={s} className="rounded bg-amber-400/20 px-2 py-1 text-xs text-amber-200">{styleName(s)}</span>)}</div>}<p className="mt-4 hidden text-xs leading-relaxed text-slate-400 lg:block">{player.role==="GK"?"Keeper attributes affect saves, movement and distribution.":"PHY helps shield the ball. Tackles compare DEF against DRI."}</p></>:<p className="text-xs text-slate-400">Player stats appear during the next chance.</p>}
  </aside>
}
type HUD = { player:StatPanelData|null; scene:Scene; minute:number; score:Record<Team,number>; message:string; events:EventItem[]; chances:Record<Team,number>; owner:string; paused:boolean; ready:boolean }
function snapshot(g:Match):HUD {const player=controlledPlayer(g);return {player:player?panelData(player):null,scene:g.scene,minute:Math.floor(g.minute),score:{...g.score},message:g.message,events:g.events.slice(0,6),chances:{...g.chanceCount},owner:ownerOf(g)?.name??"",paused:g.paused,ready:g.scene==="attack"&&!!g.owner&&!g.carry&&!g.flight}}
export default function ArcadePage(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),gameRef=useRef<Match|null>(null),viewRef=useRef<View>({scale:1,x:0,y:0,width:1,height:1})
  const [difficulty,setDifficulty]=useState<Difficulty>("medium")
  const [hud,setHud]=useState<HUD|null>(null)
  const [yourOvr,setYourOvr]=useState<number|null>(null)
  const [curveMode,setCurveMode]=useState(true),[pullMode,setPullMode]=useState(false)
  const settings=useRef({curve:true,pull:false})
  function start(d:Difficulty){spriteCache.clear();const g=createMatch(d);gameRef.current=g;setYourOvr(squadOVR(teamOf(g,"user")));setDifficulty(d);setHud(snapshot(g))}
  function stop(){spriteCache.clear();gameRef.current=null;setHud(null)}
  function pause(){const g=gameRef.current;if(g&&g.scene!=="fulltime"){g.paused=!g.paused;g.aim=null;setHud(snapshot(g))}}
  const started=hud!==null
  useEffect(()=>{if(!started)setYourOvr(squadOVR(loadLineup()))},[started])
  useEffect(()=>{settings.current={curve:curveMode,pull:pullMode}},[curveMode,pullMode])
  useEffect(()=>{
    if(!started)return
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext("2d");if(!ctx)return
    let raf=0,last=performance.now(),lastHUD=0
    function loop(now:number){
      const g=gameRef.current
      if(!g||!canvas||!ctx)return
      const dt=clamp((now-last)/1000,0,.04);last=now
      const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1)
      const pw=Math.round(w*dpr),ph=Math.round(h*dpr)
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
      ctx.setTransform(pw/w,0,0,ph/h,0,0)
      tick(g,dt)
      if(g.scene==="attack"||g.scene==="defense"){
        const target=g.ball.y+(g.scene==="attack"?-95:95)
        if(!g.aim&&!g.paused)g.camera.y+=(target-g.camera.y)*Math.min(1,dt*5.5)
      }
      const v=viewFor(g,w,h);viewRef.current=v
      paint(g,ctx,w,h,v,settings.current.curve,settings.current.pull)
      if(now-lastHUD>75){setHud(snapshot(g));lastHUD=now}
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    function key(e:KeyboardEvent){const g=gameRef.current;if(!g)return
      if(e.key==="Escape"){if(g.scene==="fulltime")return;if(g.aim){g.aim=null}else if(g.carry&&g.scene==="attack"){g.carry=null}else {g.paused=!g.paused;setHud(snapshot(g))}return}
      if(g.paused||g.scene!=="defense")return
      if(e.key.toLowerCase()==="k"&&!e.repeat){const def=nearest(g,"user",g.ball);if(def)queueTackle(g,def,g.ball)}
    }
    window.addEventListener("keydown",key)
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",key)}
  },[started])
  function point(e:ReactPointerEvent<HTMLCanvasElement>){const rect=e.currentTarget.getBoundingClientRect();return toWorld(viewRef.current,{x:e.clientX-rect.left,y:e.clientY-rect.top})}
  function down(e:ReactPointerEvent<HTMLCanvasElement>){
    const g=gameRef.current;if(!g||g.paused||e.button!==0||!(g.scene==="attack"||g.scene==="defense"))return
    const p=point(e),owner=ownerOf(g)
    if(g.scene==="attack"&&(owner?.team!=="user"||g.flight))return
    if(g.scene==="attack"&&g.carry){g.carry=null}
    const def=g.scene==="defense"?nearest(g,"user",p):undefined
    g.aim={start:p,end:p,first:null,pointer:e.pointerId,actor:def?.id??owner?.id??null,mode:g.scene==="attack"?"attack":"defend"}
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function pointerMove(e:ReactPointerEvent<HTMLCanvasElement>){const g=gameRef.current,a=g?.aim;if(!a||a.pointer!==e.pointerId)return;a.end=point(e);if(!a.first&&dist(a.start,a.end)>28)a.first={...a.end}}
  function cancel(){const g=gameRef.current;if(g)g.aim=null}
  function up(e:ReactPointerEvent<HTMLCanvasElement>){
    const g=gameRef.current,a=g?.aim;if(!g||!a||a.pointer!==e.pointerId)return
    a.end=point(e);g.aim=null
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    if(g.paused)return
    const len=dist(a.start,a.end),tap=len*viewRef.current.scale<12
    if(a.mode==="defend"){
      if(g.scene!=="defense")return
      const defender=tap?nearest(g,"user",g.ball):g.players.find(p=>p.id===a.actor&&p.role!=="GK")??nearest(g,"user",g.ball)
      if(defender)queueTackle(g,defender,tap?g.ball:a.end);return
    }
    const p=ownerOf(g);if(g.scene!=="attack"||p?.team!=="user"||p.id!==a.actor||g.flight)return
    if(tap){
      const target=teamOf(g,"user").filter(q=>q.id!==p.id).sort((q,r)=>dist(q,a.end)-dist(r,a.end))[0]
      if(target&&dist(target,a.end)<Math.max(25,19/viewRef.current.scale)){pass(g,p,target);return}
      if(a.end.x>=0&&a.end.x<=W&&a.end.y>=0&&a.end.y<=H&&dist(p,a.end)>25){g.carry=inside(a.end);g.actionCount++;g.message=""}
      return
    }
    const vec=aimVector(a),dir=pullMode?{x:-vec.d.x,y:-vec.d.y}:vec.d
    const goalX=dir.y<-.04?p.x+dir.x*(0-p.y)/dir.y:Infinity
    const shot=dir.y<-.15&&p.y<720&&Math.abs(goalX-MID)<GOAL*.85+Math.abs(vec.curve)*150
    let d=dir,curve=curveMode?vec.curve:0
    if(shot){d=rotate(d,rand(-1,1)*shotError(p.shooting)*(1-.30*style(p,"finesseShot")));kick(g,p,d,700+vec.power*(690+p.shooting*3),curve,"shot")}
    else{
      const success=Math.random()<1-(1-passChance(p.role==="GK"?(p.passing+p.kicking)/2:p.passing,.42))*(1-.25*style(p,"incisivePass"))
      // On failure, keep the final aim straight, without curve or receiver assistance.
      if(!success)curve=0
      const speed=330+vec.power*(870+(p.role==="GK"?(p.kicking-80)*2:0))
      const end={x:p.x+d.x*len,y:p.y+d.y*len}
      const receiver=teamOf(g,"user").filter(q=>q.id!==p.id&&dist(q,end)<175&&((q.x-p.x)*d.x+(q.y-p.y)*d.y)>40).sort((q,r)=>dist(q,end)-dist(r,end))[0]
      kick(g,p,d,speed,curve,"pass",success?receiver?.id??null:null);if(!success)g.message="Poor pass — no curve"
    }
  }
  if(!hud)return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173449,#06101d_52%,#030811)] p-5 text-white">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.35em] text-cyan-300">Ultimate Team / Arcade</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">Football Highlights</h1><p className="mt-3 text-slate-300">Play the decisive moments of a full match with your own squad.</p></div><Link href="/" className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-bold">Main Menu</Link></div>
        <div className="my-8 rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-bold text-cyan-200">Match controls</h2><div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2"><span>Tap a teammate to pass.</span><span>Tap grass to dribble.</span><span>Swipe toward the goal to shoot.</span><span>Swipe into space for a through pass.</span><span>On defense, swipe a defender toward the ball.</span><span>Press K or tap the ball to tackle.</span></div><div className="mt-4 flex flex-wrap gap-3"><button onClick={()=>setCurveMode(v=>!v)} className={`rounded-xl px-4 py-2 font-bold ${curveMode?"bg-cyan-400 text-slate-950":"bg-white/10"}`}>Curve: {curveMode?"ON":"OFF"}</button><button onClick={()=>setPullMode(v=>!v)} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 font-bold">Aim: {pullMode?"Pull back":"Swipe forward"}</button></div></div>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">Choose opponent</h2><div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-200">Your squad: <span className="text-xl font-black">{yourOvr??"—"}</span> OVR</div></div><div className="grid gap-4 sm:grid-cols-3">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d=><button key={d} onClick={()=>start(d)} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300 hover:bg-white/10"><div className="text-2xl font-black">{DIFFICULTIES[d].label}</div><div className="mt-3 text-5xl font-black text-cyan-300">{DIFFICULTIES[d].ovr}</div><div className="mt-1 text-xs uppercase tracking-widest text-slate-400">Opponent OVR</div><div className="mt-5 rounded-xl bg-cyan-400 p-3 text-center font-black text-slate-950">Play match</div></button>)}</div>
      </div>
    </main>
  )
  const playing=hud.scene==="attack"||hud.scene==="defense",result=hud.score.user>hud.score.ai?"YOU WIN":hud.score.user<hud.score.ai?"DEFEAT":"DRAW"
  return (
    <main className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#0b1620] text-white select-none">
      {/* The scoreboard is outside the pitch so neither goal can be hidden. */}
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#122334] px-3 py-2 sm:px-6">
        <div className="flex items-center gap-2"><span className="rounded-lg bg-white/10 px-2 py-2 font-mono text-sm font-black sm:px-4 sm:text-lg">{hud.minute}&apos;</span><span className="hidden text-xs text-slate-300 sm:block">{DIFFICULTIES[difficulty].label} · {DIFFICULTIES[difficulty].ovr} OVR</span></div>
        <div className="flex overflow-hidden rounded-lg text-sm font-black sm:text-lg"><span className="bg-[#1946bb] px-3 py-2 sm:px-6">YOU</span><span className="bg-[#08121e] whitespace-nowrap px-4 py-2 tabular-nums">{hud.score.user} : {hud.score.ai}</span><span className="bg-[#b95b17] px-3 py-2 sm:px-6">AI</span></div>
        <div className="flex items-center gap-2"><button onClick={pause} className="rounded-lg bg-white/10 px-3 py-2 font-bold" aria-label="Pause">{hud.paused?"▶":"Ⅱ"}</button><Link href="/" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Exit</Link></div>
      </header>
      <div className="h-1 shrink-0 bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{width:`${hud.minute/90*100}%`}}/></div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#355524]">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" onPointerDown={down} onPointerMove={pointerMove} onPointerUp={up} onPointerCancel={cancel} onContextMenu={(e: {preventDefault:()=>void})=>{e.preventDefault();cancel();const g=gameRef.current;if(g?.scene==="attack")g.carry=null}}/>
        {playing&&<div className="pointer-events-none absolute left-3 top-3 rounded-md bg-[#0b1923]/90 px-3 py-2 text-xs font-black uppercase tracking-wider">{hud.scene==="attack"?"Attacking chance":"Defensive chance"}</div>}
        {playing&&hud.message&&<div className="pointer-events-none absolute right-3 top-3 max-w-[45%] rounded-lg bg-black/65 px-3 py-2 text-right text-sm font-bold">{hud.message}</div>}
        {hud.scene==="simulation"&&<div className="absolute inset-0 flex items-center justify-center bg-[#081521]/90 p-4"><div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#132737] p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Match simulation</p><h2 className="mt-2 text-5xl font-black tabular-nums">{hud.minute}&apos;</h2><p className="mt-2 text-slate-300">{hud.message}</p><div className="my-5 h-2 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-cyan-400" style={{width:`${hud.minute/90*100}%`}}/></div><div className="space-y-2">{hud.events.length?hud.events.map((ev,i)=><div key={`${ev.minute}-${i}`} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-sm"><span className="w-8 font-black text-cyan-300">{ev.minute}&apos;</span><span>{ev.text}</span></div>):<p className="text-sm text-slate-400">Waiting for the first chance…</p>}</div></div></div>}
        {hud.scene==="result"&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"><div className="rounded-2xl border border-white/15 bg-[#0a1722]/95 px-9 py-6 text-center shadow-xl"><p className="text-xs uppercase tracking-[.3em] text-cyan-300">{hud.minute}&apos;</p><h2 className="mt-2 text-3xl font-black">{hud.events[0]?.team==="user"?"GOAL!":hud.events[0]?.team==="ai"?"GOAL CONCEDED":hud.message}</h2>{hud.events[0]?.team&&<p className="mt-2 text-lg">{hud.message}</p>}<p className="mt-3 text-2xl font-black">{hud.score.user} — {hud.score.ai}</p></div></div>}
        {hud.paused&&hud.scene!=="fulltime"&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75"><div className="rounded-2xl bg-[#122334] p-8 text-center"><h2 className="mb-6 text-3xl font-black">Paused</h2><button onClick={pause} className="block w-full rounded-xl bg-cyan-400 px-8 py-3 font-black text-black">Resume</button><button onClick={stop} className="mt-3 block w-full rounded-xl bg-white/10 px-8 py-3 font-bold">Difficulty menu</button></div></div>}
        {hud.scene==="fulltime"&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#122334] p-8 text-center"><p className="text-sm font-black uppercase tracking-[.3em] text-cyan-300">Full time</p><h2 className="mt-3 text-4xl font-black">{result}</h2><p className="my-6 text-6xl font-black">{hud.score.user} — {hud.score.ai}</p><p className="text-sm text-slate-300">Chances: {hud.chances.user} – {hud.chances.ai}</p><div className="mt-7 flex gap-3"><button onClick={stop} className="flex-1 rounded-xl bg-white/10 p-3 font-bold">Difficulty</button><button onClick={()=>start(difficulty)} className="flex-1 rounded-xl bg-cyan-400 p-3 font-black text-black">Play again</button></div></div></div>}
      </div>
      {playing&&<PlayerStats player={hud.player} defending={hud.scene==="defense"}/>}
      </div>
      <footer className="z-20 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#122334] px-3 py-2 text-xs sm:px-6">
        <div className="min-w-0"><p className="truncate font-bold text-cyan-200">{hud.scene==="attack"?(hud.ready?`${hud.owner} · Choose your move`:"Attack in motion"):hud.scene==="defense"?"Win the ball back": "Football Highlights"}</p><p className="mt-1 text-slate-300">{hud.scene==="defense"?"Swipe a defender to tackle · K / tap ball":`Tap teammate: pass · Tap grass: dribble · ${pullMode?"Pull back":"Swipe"}: shoot / through ball`}</p></div>
        <button className="shrink-0 rounded-lg bg-white/10 px-3 py-2 font-bold" onClick={()=>{cancel();const g=gameRef.current;if(g&&g.scene==="attack")g.carry=null}}>Cancel</button>
      </footer>
    </main>
  )
}
