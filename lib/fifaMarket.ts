import { getInventory,getSquad,getUserData,saveInventory,saveUserData,type InventoryPlayer } from "@/lib/storage"
import { players } from "@/lib/players"
import { getMarketBuyPrice,getQuickSellPrice } from "@/lib/market"

export type Auction={id:string;player:InventoryPlayer;start:number;buyNow:number;bid:number;leader:"you"|"ai"|null;end:number;nextBid:number;source:"ai"|"you";status:"active"|"sold"|"expired"|"won"|"outbid";claimed:boolean}
type Market={auctions:Auction[];refreshAt:number;watch:string[]}
const KEY="football-fifa-auctions-v1", REFRESH=120000, TAX=.05
const uid=()=>crypto.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`
const read=():Market=>{try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r) as Market;if(Array.isArray(s.auctions)&&Array.isArray(s.watch))return s}}catch{}return {auctions:[],refreshAt:0,watch:[]}}
const save=(s:Market)=>localStorage.setItem(KEY,JSON.stringify(s))
const round=(x:number)=>Math.max(100,Math.round(x/100)*100)
const random=(a:number,b:number)=>a+Math.random()*(b-a)
const validPrice=(v:number)=>Number.isSafeInteger(v)&&v>=100&&v<=1e9&&v%100===0
const money=(n:number)=>{const u=getUserData();if(!Number.isSafeInteger(n)||u.coins+n<0)throw Error("Not enough coins");saveUserData({...u,coins:u.coins+n})}
const award=(p:InventoryPlayer)=>{const inv=getInventory();if(!inv.some(q=>q.id===p.id))saveInventory([...inv,p])}
const remove=(id:string)=>saveInventory(getInventory().filter(p=>p.id!==id))
export const minBid=(a:Auction)=>a.bid?Math.min(a.buyNow,a.bid+Math.max(100,Math.ceil(a.bid*.05/100)*100)):a.start
export function value(p:InventoryPlayer){return Math.max(100,round(getMarketBuyPrice(p)||100))}
export function inSquad(id:string){return Object.values(getSquad().slots).includes(id)}
export function canSell(p:InventoryPlayer){return !inSquad(p.id)&&p.inPacks!==false}
function spawn(now:number):Auction|null{
  const r=Math.random(),rarity=r<.79?"gold":r<.99?"elite":"icon"
  const pool=players.filter(p=>p.rarity===rarity&&p.inPacks!==false),p=pool[Math.floor(Math.random()*pool.length)]
  if(!p)return null
  const card={...p,id:uid()} as InventoryPlayer,price=value(card),start=round(price*random(.62,.92)),buyNow=Math.max(start+100,round(price*random(1.05,1.4)))
  return {id:uid(),player:card,start,buyNow,bid:0,leader:null,end:now+Math.floor(random(90,300))*1000,nextBid:now+Math.floor(random(15,45))*1000,source:"ai",status:"active",claimed:false}
}
// AI auctions and bids are browser-local. Settlement is performed on return to the market.
export function syncMarket(now=Date.now()):Market{
  const s=read();let changed=false
  for(const a of s.auctions){if(a.status!=="active")continue
    // Settle scheduled AI bids even if the market was closed. Simulate only
    // until the auction deadline, not indefinitely after expiration.
    let steps=0
    while(a.status==="active"&&a.nextBid<=now&&a.nextBid<a.end&&steps++<400){
      a.nextBid+=Math.floor(random(12,38))*1000;changed=true
      const ceiling=Math.min(a.buyNow,round(value(a.player)*random(.78,1.22))),bid=ceiling>=a.buyNow&&Math.random()<.18?a.buyNow:minBid(a)
      if(bid<=ceiling&&Math.random()<.50&&(a.leader!=="ai"||Math.random()<.35)){
        if(a.leader==="you")money(a.bid)
        a.bid=bid;a.leader="ai"
        if(bid>=a.buyNow)a.status=a.source==="you"?"sold":"expired"
      }
    }
    if(a.status==="active"&&now>=a.end){a.status=a.source==="you"?(a.leader==="ai"?"sold":"expired"):a.leader==="you"?"won":"expired";changed=true}
  }
  if(now>=s.refreshAt){s.refreshAt=now+REFRESH;changed=true;for(let i=0;i<24;i++){const a=spawn(now);if(a)s.auctions.push(a)}}
  // Keep all owned transfer-list entries and unresolved winning bids; discard old NPC listings.
  const keep=s.auctions.filter(a=>a.status==="active"||a.source==="you"||a.status==="won"||s.watch.includes(a.id)||(!a.claimed&&a.leader==="you"))
  if(keep.length!==s.auctions.length){s.auctions=keep;changed=true}
  if(changed)save(s);return s
}
function active(id:string){const s=syncMarket(),a=s.auctions.find(a=>a.id===id);if(!a||a.status!=="active"||a.end<=Date.now())throw Error("This auction has ended");return {s,a}}
export function bidOn(id:string,amount:number){const {s,a}=active(id);if(a.source!=="ai")throw Error("Cannot bid on your own listing");if(a.leader==="you")throw Error("You already have the highest bid");if(!validPrice(amount)||amount<minBid(a)||amount>=a.buyNow)throw Error("Enter a valid bid below Buy Now (increments of 100)");money(-amount);a.bid=amount;a.leader="you";if(!s.watch.includes(id))s.watch.push(id);save(s)}
export function buyNow(id:string){const {s,a}=active(id);if(a.source!=="ai")throw Error("Cannot buy your own listing");const due=a.buyNow-(a.leader==="you"?a.bid:0);money(-due);a.bid=a.buyNow;a.leader="you";a.status="won";if(!s.watch.includes(id))s.watch.push(id);save(s)}
export function listCard(id:string,start:number,buy:number,minutes:number){const s=syncMarket(),p=getInventory().find(p=>p.id===id);if(!p||!canSell(p))throw Error("Remove this card from your squad first; exclusive cards are untradeable");if(!validPrice(start)||!validPrice(buy)||start>=buy)throw Error("Buy Now must exceed starting bid; use multiples of 100");if(![1,3,5,15,60].includes(minutes))throw Error("Invalid duration");if(s.auctions.filter(a=>a.source==="you"&&!a.claimed).length>=30)throw Error("Transfer list is full (30 cards)");remove(id);s.auctions.push({id:uid(),player:p,start,buyNow:buy,bid:0,leader:null,end:Date.now()+minutes*60000,nextBid:Date.now()+10000,source:"you",status:"active",claimed:false});save(s)}
export function cancelListing(id:string){const {s,a}=active(id);if(a.source!=="you"||a.bid>0)throw Error("Cannot cancel once a bid has been placed");a.status="expired";save(s)}
export function claim(id:string){const s=syncMarket(),a=s.auctions.find(a=>a.id===id);if(!a||a.claimed||a.status==="active")throw Error("Nothing to claim");if(a.source==="you"&&a.status==="sold")money(Math.floor(a.bid*(1-TAX)));else if(a.source==="you"&&a.status==="expired")award(a.player);else if(a.source==="ai"&&a.status==="won")award(a.player);else throw Error("Nothing to claim");a.claimed=true;save(s)}
export function toggleWatch(id:string){const s=syncMarket();s.watch=s.watch.includes(id)?s.watch.filter(x=>x!==id):[...s.watch,id];save(s)}
export function clearFinished(id:string){const s=syncMarket(),a=s.auctions.find(a=>a.id===id);if(!a||a.status==="active"||(!a.claimed&&(a.source==="you"||a.status==="won")))throw Error("Claim the card or coins first");s.auctions=s.auctions.filter(a=>a.id!==id);s.watch=s.watch.filter(x=>x!==id);save(s)}
export function quickSell(id:string){const p=getInventory().find(p=>p.id===id);if(!p||inSquad(id))throw Error("Remove this card from your squad first");money(getQuickSellPrice(p));remove(id)}
export const marketInventory=()=>getInventory()
export const marketCoins=()=>getUserData().coins
