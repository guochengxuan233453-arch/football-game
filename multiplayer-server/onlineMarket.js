'use strict';
const {fresh,operate}=require('./marketCore');
// One locked row serializes bids, escrow, card ownership and settlements across instances.
// This is intended for a small friends-only game, not a high-volume marketplace.
let pool=null;
if(process.env.DATABASE_URL){const url=new URL(process.env.DATABASE_URL);if(!url.searchParams.has('sslmode')&&process.env.NODE_ENV!=='development')url.searchParams.set('sslmode','require');pool=new (require('pg').Pool)({connectionString:url.toString(),max:5,connectionTimeoutMillis:8000});pool.on('error',e=>console.error('Market pool error:',e.message));}
let initialized;
async function init(){if(!pool)throw Error('Online market is not configured: add DATABASE_URL on Render');if(!initialized)initialized=(async()=>{await pool.query('CREATE SCHEMA IF NOT EXISTS football_private');await pool.query('REVOKE ALL ON SCHEMA football_private FROM PUBLIC');await pool.query('CREATE TABLE IF NOT EXISTS football_private.football_market_v2 (id integer PRIMARY KEY, state jsonb NOT NULL)');await pool.query('INSERT INTO football_private.football_market_v2 (id,state) VALUES (1,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(fresh())]);})().catch(e=>{initialized=null;throw e});await initialized;}
async function market(token,kind,data){await init();const db=await pool.connect();try{await db.query('BEGIN');const {rows}=await db.query('SELECT state FROM football_private.football_market_v2 WHERE id=1 FOR UPDATE');const state=rows[0].state;const result=operate(state,token,kind,data,Date.now());await db.query('UPDATE football_private.football_market_v2 SET state=$1::jsonb WHERE id=1',[JSON.stringify(state)]);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}}
module.exports={market};
