"use client"

import { normalizePlayStyles, styleName, type PlayStyleEntry } from "@/lib/playStyles"
import Link from "next/link"
import { io, type Socket } from "socket.io-client"
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
type Match = { planning:boolean; planId:number; planTime:number; planReady:Record<Team,boolean>; players: Player[]; ball: Point; owner: string | null; flight: Flight | null; carry: Point | null; tackle: { id: string; target: Point } | null; scene: Scene; score: Record<Team, number>; minute: number; schedule: { minute: number; team: Team }[]; next: number; phaseTime: number; activeTime: number; actionCount: number; decisions: number; aiWait: number; aiLast: string | null; aiVisits: Record<string, number>; cooldown: number; message: string; events: EventItem[]; camera: Point; aim: Gesture | null; paused: boolean; difficulty: Difficulty; attackRating: number; defenseRating: number; chanceCount: Record<Team, number>; possessionAge: number; lastTouch: Team; halftime: boolean }
const W = 1050, H = 1600, MID = W / 2, GOAL = 270, NET = 72, BR = 7
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const dist = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.y-b.y)
const unit = (x: number, y: number): Point => { const d = Math.hypot(x,y) || 1; return {x:x/d,y:y/d} }
const opposite = (t: Team): Team => t === "user" ? "ai" : "user"
const slot = (key: string, role: Role, x: number, y: number): Slot => ({key,role,x,y})
const BACK = [slot("gk","GK",.5,.94),slot("lb","LB",.13,.79),slot("cb1","CB",.37,.83),slot("cb2","CB",.63,.83),slot("rb","RB",.87,.79)]
const FORMATIONS: Record<string,Slot[]> = {
  "4-3-3": [...BACK,slot("cm1","CM",.25,.65),slot("cm2","CM",.5,.71),slot("cm3","CM",.75,.65),slot("lw","LW",.15,.55),slot("st","ST",.5,.535),slot("rw","RW",.85,.55)],
  "4-4-2": [...BACK,slot("lm","LM",.13,.62),slot("cm1","CM",.37,.67),slot("cm2","CM",.63,.67),slot("rm","RM",.87,.62),slot("st1","ST",.37,.54),slot("st2","ST",.63,.54)],
  "4-2-3-1": [...BACK,slot("cdm1","CDM",.36,.72),slot("cdm2","CDM",.64,.72),slot("lw","LW",.15,.57),slot("cam","CAM",.5,.625),slot("rw","RW",.85,.57),slot("st","ST",.5,.535)],
}
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
const ownerOf = (g: Match) => g.players.find(p=>p.id===g.owner) ?? null
const teamOf = (g: Match,t: Team) => g.players.filter(p=>p.team===t)
function nearest(g:Match,team:Team,point:Point,excludeGK=true){return teamOf(g,team).filter(p=>!excludeGK||p.role!=="GK").sort((a,b)=>dist(a,point)-dist(b,point))[0]}
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
function paint(g:Match,ctx:CanvasRenderingContext2D,w:number,h:number,v:View,curveMode:boolean,pullMode:boolean,planned?:{from:Point;to:Point;curve:number}){
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#355524";ctx.fillRect(0,0,w,h)
  ctx.save();ctx.translate(v.x,v.y);ctx.scale(v.scale,v.scale);drawPitch(ctx)
  const active=ownerOf(g),def=g.scene==="defense"?controlledPlayer(g):undefined
  for(const p of [...g.players].sort((a,b)=>a.y-b.y))drawPlayer(ctx,p,p.id===g.owner,p.id===def?.id)
  ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(g.ball.x+2,g.ball.y+4,8,5,0,0,Math.PI*2);ctx.fill()
  ctx.fillStyle="#fff";ctx.strokeStyle="#253047";ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(g.ball.x,g.ball.y,BR,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#263047";ctx.fillRect(g.ball.x-2,g.ball.y-2,4,4)
  if(g.carry&&active?.team==="user") {ctx.strokeStyle="#e7f5ff";ctx.lineWidth=2.5;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(active.x,active.y);ctx.lineTo(g.carry.x,g.carry.y);ctx.stroke();ctx.setLineDash([])}
  if(g.aim){const a=g.aim,vec=aimVector(a);let d=vec.d;if(pullMode&&a.mode==="attack")d={x:-d.x,y:-d.y};const start=a.mode==="attack"?g.ball:a.start;const length=dist(a.start,a.end);const end={x:start.x+d.x*length,y:start.y+d.y*length};ctx.strokeStyle=a.mode==="attack"?"#fff6bd":"#9de4ff";ctx.lineWidth=4;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo((start.x+end.x)/2-d.y*(curveMode?vec.curve:0)*length*.25,(start.y+end.y)/2+d.x*(curveMode?vec.curve:0)*length*.25,end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-d.x*16-d.y*9,end.y-d.y*16+d.x*9);ctx.lineTo(end.x-d.x*16+d.y*9,end.y-d.y*16-d.x*9);ctx.closePath();ctx.fill()}
  if(planned&&!g.aim){const {from,to,curve}=planned,d=unit(to.x-from.x,to.y-from.y),len=dist(from,to);ctx.strokeStyle="#fff6bd";ctx.lineWidth=4;ctx.setLineDash([9,7]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.quadraticCurveTo((from.x+to.x)/2-d.y*curve*len*.25,(from.y+to.y)/2+d.x*curve*len*.25,to.x,to.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(to.x,to.y,10,0,Math.PI*2);ctx.stroke()}
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
type HUD = { player:StatPanelData|null; scene:Scene; minute:number; score:Record<Team,number>; message:string; events:EventItem[]; chances:Record<Team,number>; owner:string; paused:boolean; ready:boolean; planning:boolean; planId:number; planTime:number; locked:boolean; opponentLocked:boolean }
function snapshot(g:Match):HUD {const player=controlledPlayer(g);return {player:player?panelData(player):null,scene:g.scene,minute:Math.floor(g.minute),score:{...g.score},message:g.message,events:g.events.slice(0,6),chances:{...g.chanceCount},owner:ownerOf(g)?.name??"",paused:g.paused,ready:g.planning&&!g.planReady.user,planning:g.planning,planId:g.planId,planTime:g.planTime,locked:g.planReady.user,opponentLocked:g.planReady.ai}}

type Lobby = {code:string;members:{team:Team;name:string;ovr:number;ready:boolean;rematch:boolean}[];started:boolean;round:number}
type Reply = {ok:boolean;error?:string;code?:string;team?:Team}
const invert=(p:Point):Point=>({x:W-p.x,y:H-p.y})
function perspective(g:Match,side:Team):Match{
  if(side==="user")return g
  return {...g,planReady:{user:g.planReady.ai,ai:g.planReady.user},players:g.players.map(p=>({...p,...invert(p),home:invert(p.home),team:opposite(p.team),facing:p.facing+Math.PI})),ball:invert(g.ball),carry:g.carry?invert(g.carry):null,tackle:g.tackle?{...g.tackle,target:invert(g.tackle.target)}:null,flight:g.flight?{...g.flight,vx:-g.flight.vx,vy:-g.flight.vy}:null,scene:g.scene==="attack"?"defense":g.scene==="defense"?"attack":g.scene,score:{user:g.score.ai,ai:g.score.user},chanceCount:{user:g.chanceCount.ai,ai:g.chanceCount.user},lastTouch:opposite(g.lastTouch),events:g.events.map(e=>({...e,team:e.team?opposite(e.team):undefined})),camera:invert(g.camera)}
}
export default function MultiplayerPage(){
  const socket=useRef<Socket|null>(null),side=useRef<Team>("user"),game=useRef<Match|null>(null),aim=useRef<Gesture|null>(null),canvas=useRef<HTMLCanvasElement|null>(null),view=useRef<View>({scale:1,x:0,y:0,width:1,height:1}),camera=useRef<number|null>(null)
  const [rematchError,setRematchError]=useState("")
  const [connected,setConnected]=useState(false),[lobby,setLobby]=useState<Lobby|null>(null),[hud,setHud]=useState<HUD|null>(null),[error,setError]=useState(""),[code,setCode]=useState(""),[name,setName]=useState(""),[ovr,setOvr]=useState(0),[busy,setBusy]=useState(false),[pull,setPull]=useState(false),[curve,setCurve]=useState(true),[draft,setDraft]=useState<{planId:number;data:Record<string,unknown>;label:string}|null>(null)
  const draftRef=useRef<typeof draft>(null);const sending=useRef<number|null>(null);
  function clearDraft(){draftRef.current=null;setDraft(null)}
  const settings=useRef({pull,curve});useEffect(()=>{settings.current={pull,curve}},[pull,curve])
  function reset(message=""){clearDraft();sending.current=null;spriteCache.clear();game.current=null;aim.current=null;camera.current=null;setHud(null);setLobby(null);setBusy(false);setRematchError("");setError(message)}
  useEffect(()=>{
    setOvr(squadOVR(loadLineup()));const url=process.env.NEXT_PUBLIC_MULTIPLAYER_URL||"http://localhost:3001";const s=io(url);socket.current=s
    s.on("connect",()=>{setConnected(true);setError("")});s.on("connect_error",()=>{setConnected(false);setError("Cannot reach the multiplayer server. Check its URL and that it is running.")});s.on("disconnect",()=>{setConnected(false);reset("Connection lost. Rejoin a new room.")});s.on("lobby",(l:Lobby)=>setLobby(l));s.on("rematch-start",()=>{clearDraft();sending.current=null;aim.current=null;camera.current=null;setRematchError("")});s.on("ended",(m:string)=>reset(m));s.on("state",(raw:Match)=>{const g=perspective(raw,side.current);if(!g.planning||g.planId!==game.current?.planId){aim.current=null;if(draftRef.current)clearDraft();sending.current=null;setError("")}game.current=g;setHud(snapshot(g))});return()=>{s.disconnect();socket.current=null}
  },[])
  function join(create:boolean){if(!socket.current?.connected||busy)return;setBusy(true);setError("");socket.current.timeout(6000).emit(create?"create":"join",{name:name.trim()||"My team",code:code.trim(),players:loadLineup()},(err:Error|null,r:Reply)=>{setBusy(false);if(err||!r?.ok){setError(r?.error??"Request timed out");return}side.current=r.team??"user"})}
  function rematch(){setRematchError("");socket.current?.timeout(6000).emit("rematch",(err:Error|null,r:Reply)=>{if(err||!r?.ok)setRematchError(r?.error??"Rematch request timed out")})}
  function leave(){socket.current?.emit("leave");reset()}
  function send(data:Record<string,unknown>){const g=game.current;if(!g?.planning||g.planReady.user||sending.current===g.planId)return;if(data.kind==="cancel"){clearDraft();return}const label=data.kind==="pass"?`Pass to ${g.players.find(p=>p.id===data.target)?.name??"teammate"}`:data.kind==="dribble"?"Dribble into space":data.kind==="swipe"?"Aimed kick":data.kind==="hold"?"Hold / auto-defend":`Tackle with ${g.players.find(p=>p.id===data.actor)?.name??"defender"}`;const next={planId:g.planId,data,label};draftRef.current=next;setDraft(next)}
  function lockMove(){const g=game.current,d=draftRef.current;if(!g?.planning||!d||d.planId!==g.planId||g.planReady.user||sending.current===g.planId||!socket.current?.connected)return;sending.current=g.planId;socket.current.timeout(2000).emit("action",{...d.data,planId:g.planId},(err:Error|null,r:Reply)=>{if(game.current?.planId!==g.planId||!game.current.planning)return;if(err||!r?.ok){sending.current=null;setError(r?.error??"Move not confirmed. Try again.")}else setError("")})}
  function world(p:Point){return side.current==="user"?p:invert(p)}
  function tackle(){const g=game.current;if(g?.scene!=="defense")return;const p=nearest(g,"user",g.ball);if(p)send({kind:"tackle",actor:p.id,target:world(g.ball)})}
  function plannedPath(g:Match){const draft=draftRef.current;if(!g.planning||!draft||draft.planId!==g.planId)return undefined;const a=draft.data,own=ownerOf(g);if(a.kind==="hold")return undefined;const actor=a.kind==="tackle"?g.players.find(p=>p.id===a.actor):own;if(!actor)return undefined;const raw=a.kind==="pass"?g.players.find(p=>p.id===a.target):a.target as Point|undefined;if(!raw)return undefined;const target=a.kind==="pass"?{x:raw.x,y:raw.y}:side.current==="user"?raw:invert(raw);const from={x:actor.x,y:actor.y},direction=unit(target.x-from.x,target.y-from.y),length=a.kind==="dribble"||a.kind==="tackle"?Math.min(165,dist(from,target)):dist(from,target);return {from,to:{x:from.x+direction.x*length,y:from.y+direction.y*length},curve:a.kind==="swipe"?Number(a.curve)||0:0}}
  const playing=!!hud
  useEffect(()=>{if(!playing)return;let raf=0,last=performance.now();function loop(now:number){const c=canvas.current,g=game.current;if(c&&g){const ctx=c.getContext("2d");if(ctx){const w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}ctx.setTransform(c.width/w,0,0,c.height/h,0,0);const dt=Math.min(.05,(now-last)/1000),target=g.ball.y+(g.scene==="attack"?-95:95);camera.current=camera.current===null?target:camera.current+(target-camera.current)*Math.min(1,dt*7);const display={...g,camera:{x:MID,y:camera.current},aim:aim.current};const v=viewFor(display,w,h);view.current=v;paint(display,ctx,w,h,v,settings.current.curve,settings.current.pull,plannedPath(g))}}last=now;raf=requestAnimationFrame(loop)}raf=requestAnimationFrame(loop);function key(e:KeyboardEvent){if(e.key.toLowerCase()==="k"&&!e.repeat)tackle();if(e.key==="Enter"&&!e.repeat)lockMove();if(e.key==="Escape"){aim.current=null;send({kind:"cancel"})}}window.addEventListener("keydown",key);return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",key)}},[playing])
  function point(e:ReactPointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return toWorld(view.current,{x:e.clientX-r.left,y:e.clientY-r.top})}
  function down(e:ReactPointerEvent<HTMLCanvasElement>){const g=game.current;if(!g?.planning||g.planReady.user||sending.current===g.planId||e.button!==0||!(g.scene==="attack"||g.scene==="defense"))return;const p=point(e),owner=ownerOf(g);if(g.scene==="attack"&&(owner?.team!=="user"||g.flight))return;const def=g.scene==="defense"?nearest(g,"user",p):undefined;aim.current={start:p,end:p,first:null,pointer:e.pointerId,actor:def?.id??owner?.id??null,mode:g.scene==="attack"?"attack":"defend"};e.currentTarget.setPointerCapture(e.pointerId)}
  function pointerMove(e:ReactPointerEvent<HTMLCanvasElement>){const a=aim.current;if(!a||a.pointer!==e.pointerId)return;a.end=point(e);if(!a.first&&dist(a.start,a.end)>28)a.first={...a.end}}
  function up(e:ReactPointerEvent<HTMLCanvasElement>){const a=aim.current,g=game.current;aim.current=null;if(!a||!g?.planning||g.planReady.user||a.pointer!==e.pointerId)return;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);a.end=point(e);const len=dist(a.start,a.end),tap=len*view.current.scale<12
    if(a.mode==="defend"){if(g.scene!=="defense")return;if(tap){tackle();return}send({kind:"tackle",actor:a.actor,target:world(a.end)});return}
    const p=ownerOf(g);if(g.scene!=="attack"||p?.team!=="user"||p.id!==a.actor)return
    if(tap){const target=teamOf(g,"user").filter(q=>q.id!==p.id).sort((q,r)=>dist(q,a.end)-dist(r,a.end))[0];if(target&&dist(target,a.end)<Math.max(25,19/view.current.scale))send({kind:"pass",target:target.id});else send({kind:"dribble",target:world(a.end)});return}
    const vec=aimVector(a),d=pull?{x:-vec.d.x,y:-vec.d.y}:vec.d;send({kind:"swipe",dir:side.current==="user"?d:{x:-d.x,y:-d.y},power:vec.power,curve:curve?vec.curve:0,target:world({x:p.x+d.x*len,y:p.y+d.y*len})})
  }
  const button="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 disabled:opacity-40", secondary="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-bold"
  if(!hud)return <main className="min-h-screen bg-[#071525] p-6 text-white"><div className="mx-auto max-w-3xl py-8"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Online / Friendly</p><h1 className="mt-2 text-4xl font-black">Play with friends</h1></div><Link href="/" className={secondary}>Home</Link></div><p className="mt-4 text-sm text-slate-300">Your squad: <b>{ovr} OVR</b> · {connected?"Server connected":"Connecting…"}</p>{error&&<p className="my-4 rounded-xl bg-red-900/50 p-3">{error}</p>}
    {!lobby?<div className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"><label className="block text-sm font-bold">Team name<input maxLength={24} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-xl bg-slate-800 p-3" placeholder="My team"/></label><button disabled={!connected||busy} onClick={()=>join(true)} className={button+" w-full"}>Create private room</button><div className="flex gap-3"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit room code" className="min-w-0 flex-1 rounded-xl bg-slate-800 p-3"/><button className={button} disabled={!connected||busy||code.length!==6} onClick={()=>join(false)}>Join</button></div></div>:<div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-300">Share this code with your friend</p><h2 className="my-3 text-5xl font-black tracking-widest">{lobby.code}</h2><button className={secondary} onClick={()=>navigator.clipboard.writeText(lobby.code).catch(()=>setError("Copy the code manually."))}>Copy code</button><div className="my-6 grid grid-cols-2 gap-3">{lobby.members.map(m=><div key={m.team} className="rounded-xl bg-slate-800 p-4"><b>{m.name}</b><p className="text-3xl font-black">{m.ovr}</p><p className="text-sm">{m.ready?"Ready":"Not ready"}</p></div>)}{lobby.members.length===1&&<div className="rounded-xl border border-dashed border-slate-600 p-4">Waiting for friend…</div>}</div><div className="flex flex-wrap gap-3"><button className={button} disabled={lobby.started} onClick={()=>socket.current?.emit("ready")}>{lobby.members.find(m=>m.team===side.current)?.ready?"Not ready":"Ready"}</button><button className={secondary} onClick={leave}>Leave room</button></div></div>}
    <div className="mt-5 flex gap-2"><button className={secondary} onClick={()=>setPull(v=>!v)}>Aim: {pull?"Pull back":"Swipe"}</button><button className={secondary} onClick={()=>setCurve(v=>!v)}>Curve: {curve?"On":"Off"}</button></div><p className="mt-5 text-xs text-slate-400">Casual matches use your local squad. No ranked rewards or verified ownership yet.</p></div></main>
  return <main className="fixed inset-0 z-40 flex flex-col bg-[#122334] text-white"><header className="flex shrink-0 items-center justify-between gap-2 p-3"><b>{hud.minute}′</b><div className="rounded-xl bg-black/40 px-5 py-2 font-black">YOU {hud.score.user} : {hud.score.ai} OPP</div><button className={secondary} onClick={leave}>Leave</button></header><div className="flex min-h-0 flex-1 flex-col lg:flex-row"><div className="relative min-h-0 flex-1 bg-[#355524]"><canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" onPointerDown={down} onPointerMove={pointerMove} onPointerUp={up} onPointerCancel={()=>{aim.current=null}} onContextMenu={e=>{e.preventDefault();aim.current=null;send({kind:"cancel"})}}/>{(hud.scene==="attack"||hud.scene==="defense")&&<div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/70 p-3 text-sm font-bold">{hud.scene==="attack"?"Your attack":"Defend"}{hud.planning?` · ${Math.ceil(hud.planTime)}s`:" · Playing moves"}<p>{hud.planning?(hud.locked?"Move locked — waiting":"Plan your move"):hud.message}</p>{hud.planning&&<p className="mt-1 text-xs text-slate-200">Opponent: {hud.opponentLocked?"Ready":"Planning"}</p>}</div>}{["simulation","result","fulltime"].includes(hud.scene)&&<div className="absolute inset-0 flex items-center justify-center bg-[#081521]/85 p-5"><div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 text-center"><p className="text-cyan-300">{hud.minute}′ · {hud.scene}</p><h2 className="my-4 text-3xl font-black">{hud.scene==="fulltime"?(hud.score.user>hud.score.ai?"YOU WIN":hud.score.user<hud.score.ai?"DEFEAT":"DRAW"):hud.message}</h2><p className="text-5xl font-black">{hud.score.user} : {hud.score.ai}</p><div className="mt-4 space-y-1 text-left text-sm">{hud.events.map((e,i)=><p key={i}>{e.minute}′ {e.text}</p>)}</div>{hud.scene==="fulltime"&&<div className="mt-6 space-y-2"><p className="text-sm text-slate-300">{lobby?.members.length===1?"Opponent left the room":`${lobby?.members.filter(m=>m.rematch).length??0}/2 players agree to rematch`}</p><button className={button+" w-full"} disabled={!connected||lobby?.members.length!==2||!!lobby.members.find(m=>m.team===side.current)?.rematch} onClick={rematch}>{lobby?.members.find(m=>m.team===side.current)?.rematch?"Waiting for opponent…":"Rematch"}</button>{rematchError&&<p className="text-sm text-red-300">{rematchError}</p>}<button className={secondary+" w-full"} onClick={leave}>Return to lobby</button></div>}</div></div>}</div>{(hud.scene==="attack"||hud.scene==="defense")&&<PlayerStats player={hud.player} defending={hud.scene==="defense"}/>}</div><footer className="shrink-0 space-y-2 border-t border-white/10 p-3 text-sm">{hud.planning?<><div className="flex flex-wrap items-center justify-between gap-2"><span>{hud.locked?"Move locked. Both moves execute together.":hud.scene==="defense"?"Swipe a defender or press K to plan a tackle.":"Tap to plan a pass/dribble · Swipe to aim a kick."}</span>{hud.scene==="defense"&&!hud.locked&&<button className={secondary} onClick={()=>send({kind:"hold"})}>Auto-defend</button>}</div><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-bold text-cyan-200">{hud.locked?"Waiting for opponent…":draft?.planId===hud.planId?draft.label:"No move selected"}</span><button className={secondary} disabled={hud.locked} onClick={()=>{aim.current=null;send({kind:"cancel"})}}>Clear</button><button className={button} disabled={hud.locked||draft?.planId!==hud.planId} onClick={lockMove}>{hud.locked?"Locked":"Lock move (Enter)"}</button></div>{error&&<p className="text-red-300">{error}</p>}</>:<p>Moves resolving automatically — next decision starts when the ball is controlled.</p>}</footer></main>
}
