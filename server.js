import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTelegramInitData } from './src/telegram-auth.js';
import { initDb,migrate,upsertTelegramUser,createSession,getUserBySession,deleteSession,cleanupExpiredSessions,withPlayerTransaction,recordOperation,assertOperationNotProcessed,getPool } from './src/db.js';
import { validateOperationId, OPERATION_TYPES } from './src/operations.js';
import { createPlayer,claimTask,buyBusiness,upgradeBusiness,collectOfflineIncome,hourlyProfit,availableTasks,availableAchievements,availableGoals,claimAchievement,claimGoal,currentEvent,claimEvent,BUSINESS,canBuyBusiness,businessUnlockLevel,xpForLevel,hireEmployee,expandBusiness,addInvestment,activateBusinessBoost,availableShop,buyShopItem,dailyActivity,claimDailyActivity } from './src/economy.js';
import { checkRateLimit,validateSameOrigin,validateFetchMetadata,securityHeaders,clearRateLimitBuckets } from './src/http-security.js';
import { getRankings,getProfile,isAdminTelegramId,getAdminSnapshot,searchAdminUsers,setBlocked,writeAudit,writeError } from './src/social.js';

const root=join(fileURLToPath(new URL('.',import.meta.url)),'public');
const port=Number(process.env.PORT||8080),botToken=process.env.TELEGRAM_BOT_TOKEN,demoMode=process.env.DEMO_MODE==='true';
const runtimeMetrics={requests:0,apiErrors:0,rateLimited:0,dbErrors:0,activeUsers:0};
let dbReady=demoMode,dbStartupError=null,dbReadyPromise=Promise.resolve();
if(!botToken&&!demoMode)throw new Error('TELEGRAM_BOT_TOKEN is required');
if(!process.env.DATABASE_URL&&!demoMode)throw new Error('DATABASE_URL is required');
if(!demoMode){dbReadyPromise=Promise.resolve();}
const demoPlayers=new Map(),demoOperations=new Set();
const cookieOptions=()=>`Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}`;
function parseCookies(header=''){const out={};for(const part of header.split(';')){const i=part.indexOf('=');if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v)}catch{}}return out}
function sendJson(res,status,payload,extra={}){res.writeHead(status,{...securityHeaders(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(payload))}
async function readJson(req){
  const contentType=String(req.headers['content-type']||'').split(';',1)[0].trim().toLowerCase();
  if(contentType!=='application/json')throw new Error('Content-Type must be application/json');
  let body='';
  for await(const chunk of req){body+=chunk;if(body.length>20000)throw new Error('Payload too large')}
  if(!body)throw new Error('Invalid JSON body');
  let value;
  try{value=JSON.parse(body)}catch{throw new Error('Invalid JSON body')}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid JSON body');
  return value;
}
function serialize(player,user){const event=currentEvent();return{id:String(user?.telegram_id??player.id),isAdmin:!!user&&isAdminTelegramId(user.telegram_id),name:[user?.first_name,user?.last_name].filter(Boolean).join(' ')||'Игрок',username:user?.username??null,photoUrl:user?.photo_url??null,balance:player.balance,xp:player.xp,level:player.level,businesses:Object.values(player.businesses).map(b=>({...b,profitPerHour:hourlyProfit(player,b.id)})),businessCatalog:Object.values(BUSINESS).map(b=>({id:b.id,name:b.name,description:b.description,cost:b.baseCost,unlockLevel:businessUnlockLevel(b.id),unlocked:canBuyBusiness(player,b.id),owned:!!player.businesses[b.id]})),claimedTasks:[...player.claimedTasks],tasks:availableTasks(player),achievements:availableAchievements(player),goals:availableGoals(player),event:{...event,claimed:!!player.eventClaims[event.dateKey]},stats:player.stats,shop:availableShop(player),profile:{name:[user?.first_name,user?.last_name].filter(Boolean).join(' ')||'Игрок',username:user?.username??null,photoUrl:user?.photo_url??null,createdAt:user?.created_at??null},inventory:player.inventory,daily:dailyActivity(player),xpProgress:{current:xpForLevel(player.level),next:xpForLevel(player.level+1),percent:player.level>=100?100:Math.max(0,Math.min(100,Math.round((player.xp-xpForLevel(player.level))/Math.max(1,xpForLevel(player.level+1)-xpForLevel(player.level))*100)))}}}
async function getProfileByDbId(id){const r=await getPool().then(p=>p.query('SELECT telegram_id FROM users WHERE id=$1',[id]));return r.rows[0]||null}
async function auth(req,res){const cookies=parseCookies(req.headers.cookie);if(demoMode&&cookies.mfz_demo==='1'){const player=demoPlayers.get('demo-user')||createPlayer('demo-user');demoPlayers.set('demo-user',player);return{user:{id:'demo-user',telegram_id:'demo-user',first_name:'Демо',last_name:'Игрок',username:'demo'},player,demo:true}}const user=await getUserBySession(cookies.mfz_session);if(!user){sendJson(res,401,{error:'Authentication required'});return null}if(user.blocked){sendJson(res,403,{error:'Account blocked'});return null}return{user,sessionToken:cookies.mfz_session}}
function errorStatus(message){if(message==='Operation already processed')return 409;if(message==='Authentication required')return 401;if(message==='Endpoint not found')return 404;if(message==='Content-Type must be application/json')return 415;if(/authentication|required|invalid|expired|already|insufficient|maximum|clock|task|business|achievement|goal|event|locked|overflow|payload|json|origin|site|too many/i.test(message))return 400;return 500}
function publicError(message){return errorStatus(message)===500?'Internal server error':message}

const server=http.createServer(async(req,res)=>{const startedAt=Date.now();try{runtimeMetrics.requests++;
clearRateLimitBuckets();
const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
if(url.pathname.startsWith('/api/') && (req.method==='POST'||req.method==='PUT'||req.method==='PATCH'||req.method==='DELETE'||url.pathname==='/api/state')){
  if(url.pathname!=='/api/auth/telegram'){
    validateSameOrigin(req);
    validateFetchMetadata(req,{stateChanging:true});
  }
  const limit=checkRateLimit(req,{mutation:true});
  if(!limit.allowed){runtimeMetrics.rateLimited++;writeError({path:url.pathname,message:'Rate limit exceeded',severity:'warn',details:{method:req.method,ip:req.socket.remoteAddress||'unknown',limit:'request/mutation'}});return sendJson(res,429,{error:'Too many requests'},{'Retry-After':String(limit.retryAfter)});}
}
if(req.method==='GET'&&url.pathname==='/health'){if(!demoMode&&!dbReady)return sendJson(res,503,{ok:false,service:'Mr.Gus',status:'starting',database:'starting',error:dbStartupError?'database initialization failed':'database initializing',metrics:runtimeMetrics});if(!demoMode)await (await getPool()).query('SELECT 1');return sendJson(res,200,{ok:true,service:'Mr.Gus',status:'healthy',database:demoMode?'demo':'ok',metrics:runtimeMetrics})}
if(req.method==='POST'&&url.pathname==='/api/auth/telegram'){
if(demoMode&&!req.headers['x-telegram-init-data']){res.setHeader('Set-Cookie',`mfz_demo=1; ${cookieOptions()}; Max-Age=604800`);return sendJson(res,200,{ok:true,demo:true,user:{first_name:'Демо',last_name:'Игрок',username:'demo'}})}
const verified=validateTelegramInitData(String(req.headers['x-telegram-init-data']||''),botToken),user=await upsertTelegramUser(verified.user),token=await createSession(user.id);
res.setHeader('Set-Cookie',`mfz_session=${encodeURIComponent(token)}; ${cookieOptions()}; Max-Age=604800`);return sendJson(res,200,{ok:true,user:{id:String(user.telegram_id),firstName:user.first_name,lastName:user.last_name,username:user.username,photoUrl:user.photo_url}});
}
if(req.method==='POST'&&url.pathname==='/api/auth/logout'){const c=parseCookies(req.headers.cookie);if(!demoMode)await deleteSession(c.mfz_session);else demoPlayers.delete('demo-user');res.setHeader('Set-Cookie',[`mfz_session=; ${cookieOptions()}; Max-Age=0`,`mfz_demo=; ${cookieOptions()}; Max-Age=0`]);return sendJson(res,200,{ok:true})}
if(url.pathname.startsWith('/api/')){
const a=await auth(req,res);if(!a)return;
if(a.demo){const player=a.player;if(req.method==='GET'&&url.pathname==='/api/rankings'){const a=await auth(req,res);if(!a)return;return sendJson(res,200,await getRankings(url.searchParams.get('limit'),a.user.telegram_id))}
if(req.method==='GET'&&url.pathname==='/api/profile'){const a=await auth(req,res);if(!a)return;return sendJson(res,200,await getProfile(a.user.telegram_id))}
if(req.method==='GET'&&url.pathname==='/api/admin/users'){const a=await auth(req,res);if(!a)return;if(!isAdminTelegramId(a.user.telegram_id)){writeAudit({userId:a.user.id,telegramId:a.user.telegram_id,action:'admin_forbidden',details:{path:url.pathname}});return sendJson(res,403,{error:'Forbidden'})}return sendJson(res,200,{users:await searchAdminUsers(url.searchParams.get('q'),url.searchParams.get('limit'))})}
if(req.method==='GET'&&url.pathname==='/api/admin'){const a=await auth(req,res);if(!a)return;if(!isAdminTelegramId(a.user.telegram_id)){writeAudit({userId:a.user.id,telegramId:a.user.telegram_id,action:'admin_forbidden',details:{path:url.pathname}});return sendJson(res,403,{error:'Forbidden'})}return sendJson(res,200,await getAdminSnapshot())}
if(req.method==='GET'&&url.pathname==='/api/state'){{const now=Date.now();collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);return sendJson(res,200,serialize(player,a.user))}}
if(req.method==='POST'){const body=await readJson(req),operationId=String(body.operationId||'');validateOperationId(operationId);if(demoOperations.has(`demo-user:${operationId}`))throw new Error('Operation already processed');let action;
if(url.pathname==='/api/task/claim')action=claimTask(player,String(body.taskId||''));else if(url.pathname==='/api/business/buy')action=buyBusiness(player,String(body.businessId||''),Date.now());else if(url.pathname==='/api/business/upgrade')action=upgradeBusiness(player,String(body.businessId||''),Date.now());else if(url.pathname==='/api/income/collect'){const now=Date.now();action=collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);}
else if(url.pathname==='/api/achievement/claim')action=claimAchievement(player,String(body.achievementId||''));
else if(url.pathname==='/api/goal/claim')action=claimGoal(player,String(body.goalId||''));
else if(url.pathname==='/api/event/claim')action=claimEvent(player,Date.now());
else if(url.pathname==='/api/business/employee/hire')action=hireEmployee(player,String(body.businessId||''),String(body.role||''),Date.now());
else if(url.pathname==='/api/business/expand')action=expandBusiness(player,String(body.businessId||''),Date.now());
else if(url.pathname==='/api/business/invest')action=addInvestment(player,String(body.businessId||''),Number(body.amount));
else if(url.pathname==='/api/business/boost')action=activateBusinessBoost(player,String(body.businessId||''),Date.now());
else if(url.pathname==='/api/shop/buy')action=buyShopItem(player,String(body.itemId||''),Date.now());
else if(url.pathname==='/api/daily/claim')action=claimDailyActivity(player,Date.now());
else return sendJson(res,404,{error:'Endpoint not found'});
demoOperations.add(`demo-user:${operationId}`);demoPlayers.set('demo-user',player);return sendJson(res,200,{...serialize(player,a.user),action})}return sendJson(res,405,{error:'Method not allowed'})}
if(req.method==='GET'&&url.pathname==='/api/state'){const tx=await withPlayerTransaction(a.user.id,async(player,client)=>{const from=player.lastIncomeAt,now=Date.now(),out=collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);if(out.seconds>0&&from!==null){const operationId=`income_auto_${from}_${player.lastIncomeAt}`;await recordOperation(client,{operationId,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:out.income,at:now})}return out});return sendJson(res,200,{...serialize(tx.player,a.user),action:tx.result})}
if(req.method==='POST'){
const allowedPostEndpoints=new Set(['/api/admin/block','/api/admin/unblock','/api/task/claim','/api/business/buy','/api/business/upgrade','/api/income/collect','/api/achievement/claim','/api/goal/claim','/api/event/claim','/api/business/employee/hire','/api/business/expand','/api/business/invest','/api/business/boost','/api/shop/buy','/api/daily/claim']);
if(!allowedPostEndpoints.has(url.pathname))return sendJson(res,404,{error:'Endpoint not found'});
if(url.pathname==='/api/admin/block'||url.pathname==='/api/admin/unblock'){const a=await auth(req,res);if(!a)return;if(!isAdminTelegramId(a.user.telegram_id))return sendJson(res,403,{error:'Forbidden'});const body=await readJson(req);if(!/^[1-9]\d*$/.test(String(body.userId||'')))throw new Error('Invalid user id');const target=await getProfileByDbId(Number(body.userId));if(!target)throw new Error('User not found');if(isAdminTelegramId(target.telegram_id))throw new Error('Cannot block administrator');const tx=await setBlocked(Number(body.userId),url.pathname.endsWith('/block'));await writeAudit({userId:a.user.id,telegramId:a.user.telegram_id,action:url.pathname.slice('/api/admin/'.length),details:{targetUserId:body.userId,blocked:url.pathname.endsWith('/block')}});return sendJson(res,200,{ok:true,user:tx})}
const body=await readJson(req),operationId=String(body.operationId||'');validateOperationId(operationId);let out;const tx=await withPlayerTransaction(a.user.id,async(player,client)=>{
const now=Date.now();
await assertOperationNotProcessed(client,{operationId,userId:a.user.id});
if(url.pathname==='/api/task/claim')out=claimTask(player,String(body.taskId||''));
else if(url.pathname==='/api/business/buy'){
  const before=player.lastIncomeAt; const income=collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);
  if(income.income>0&&before!==null) await recordOperation(client,{operationId:`income_auto_${before}_${player.lastIncomeAt}`,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:income.income,at:now});
  out=buyBusiness(player,String(body.businessId||''),now);
}
else if(url.pathname==='/api/business/upgrade'){
  const before=player.lastIncomeAt; const income=collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);
  if(income.income>0&&before!==null) await recordOperation(client,{operationId:`income_auto_${before}_${player.lastIncomeAt}`,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:income.income,at:now});
  out=upgradeBusiness(player,String(body.businessId||''),now);
}
else if(url.pathname==='/api/income/collect')out=collectOfflineIncome(player,now,currentEvent(now).incomeMultiplier);
else if(url.pathname==='/api/achievement/claim')out=claimAchievement(player,String(body.achievementId||''));
else if(url.pathname==='/api/goal/claim')out=claimGoal(player,String(body.goalId||''));
else if(url.pathname==='/api/event/claim')out=claimEvent(player,now);
else if(url.pathname==='/api/business/employee/hire')out=hireEmployee(player,String(body.businessId||''),String(body.role||''),now);
else if(url.pathname==='/api/business/expand')out=expandBusiness(player,String(body.businessId||''),now);
else if(url.pathname==='/api/business/invest')out=addInvestment(player,String(body.businessId||''),Number(body.amount));
else if(url.pathname==='/api/business/boost')out=activateBusinessBoost(player,String(body.businessId||''),now);
else if(url.pathname==='/api/shop/buy')out=buyShopItem(player,String(body.itemId||''),now);
else if(url.pathname==='/api/daily/claim')out=claimDailyActivity(player,now);
else throw new Error('Endpoint not found');
const type=url.pathname==='/api/task/claim'?OPERATION_TYPES.TASK_REWARD:url.pathname==='/api/business/buy'?OPERATION_TYPES.BUSINESS_PURCHASE:url.pathname==='/api/business/upgrade'?OPERATION_TYPES.BUSINESS_UPGRADE:url.pathname==='/api/business/employee/hire'?OPERATION_TYPES.EMPLOYEE_HIRE:url.pathname==='/api/business/expand'?OPERATION_TYPES.BUSINESS_EXPANSION:url.pathname==='/api/business/invest'?OPERATION_TYPES.BUSINESS_INVESTMENT:url.pathname==='/api/business/boost'?OPERATION_TYPES.BUSINESS_BOOST:url.pathname==='/api/shop/buy'?OPERATION_TYPES.SHOP_PURCHASE:url.pathname==='/api/daily/claim'?OPERATION_TYPES.DAILY_REWARD:url.pathname==='/api/achievement/claim'?OPERATION_TYPES.ACHIEVEMENT_REWARD:url.pathname==='/api/goal/claim'?OPERATION_TYPES.GOAL_REWARD:url.pathname==='/api/event/claim'?OPERATION_TYPES.EVENT_REWARD:OPERATION_TYPES.INCOME_COLLECTION;
const reward=Number(out?.reward??out?.income??0);await recordOperation(client,{operationId,type,userId:a.user.id,reward});await writeAudit({userId:a.user.id,telegramId:a.user.telegram_id,action:type,details:{operationId,reward,path:url.pathname}});if(reward>100000)await writeAudit({userId:a.user.id,telegramId:a.user.telegram_id,action:'suspicious_high_reward',details:{operationId,reward,path:url.pathname}});return out});
return sendJson(res,200,{...serialize(tx.player,a.user),action:out})}
return sendJson(res,405,{error:'Method not allowed'})}
const requested=url.pathname==='/'?'/index.html':url.pathname,safe=normalize(requested).replace(/^\.\.(\/|\\)+/,'');const file=join(root,safe),data=await readFile(file);res.writeHead(200,{...securityHeaders(),'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch(e){const msg=e?.message||'Server error';if(e?.code?.startsWith('08')||e?.code==='25P02')runtimeMetrics.dbErrors++;if(req.url?.startsWith('/api/')){runtimeMetrics.apiErrors++;console.error(JSON.stringify({type:'api_error',path:req.url,message:msg,code:e?.code||null}));writeError({path:req.url,message:msg,details:{code:e?.code||null}});return sendJson(res,errorStatus(msg),{error:publicError(msg)})}res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Server error')}});
if(!demoMode){setInterval(()=>cleanupExpiredSessions().catch(()=>{}),15*60*1000).unref()}
process.on('uncaughtException',e=>{runtimeMetrics.apiErrors++;console.error(JSON.stringify({type:'uncaught_exception',message:e?.message||'unknown'}));writeError({path:'process',message:e?.message||'uncaught exception',severity:'critical'}).catch(()=>{})});
process.on('unhandledRejection',e=>{runtimeMetrics.apiErrors++;console.error(JSON.stringify({type:'unhandled_rejection',message:e?.message||String(e)}));writeError({path:'process',message:e?.message||String(e),severity:'critical'}).catch(()=>{})});
server.listen(port,'0.0.0.0',()=>{
  console.log(`Mr.Gus — listening on ${port}`);
  if(!demoMode){
    dbReadyPromise=initDb().then(()=>migrate()).then(()=>{dbReady=true;console.log('Mr.Gus — database ready')}).catch(e=>{dbStartupError=e?.message||String(e);runtimeMetrics.dbErrors++;console.error(JSON.stringify({type:'database_startup_error',message:dbStartupError}));});
  }
});