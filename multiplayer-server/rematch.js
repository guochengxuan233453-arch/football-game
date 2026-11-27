const {createOnline}=require('./engine');
function start(r){r.game=createOnline(structuredClone(r.members.find(m=>m.team==='user').players),structuredClone(r.members.find(m=>m.team==='ai').players));r.startedAt=Date.now();r.finishedAt=null;for(const m of r.members)m.rematch=false;}
function vote(r,id){if(!r||r.game?.scene!=='fulltime'||r.members.length!==2)throw Error('Both opponents must remain in the finished match');const m=r.members.find(m=>m.id===id);if(!m)throw Error('Not in room');m.rematch=true;if(!r.members.every(m=>m.rematch))return false;r.round=(r.round||1)+1;start(r);return true;}
module.exports={start,vote};
