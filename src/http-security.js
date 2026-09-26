const buckets=new Map();
const WINDOW_MS=60_000;
const MAX_REQUESTS=120;
const MAX_MUTATIONS=30;

function bucketKey(req,kind){return `${kind}:${req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress||'unknown'}`;}

function consume(key,limit,now=Date.now()){
  const current=buckets.get(key);
  if(!current||now-current.startedAt>=WINDOW_MS){
    buckets.set(key,{startedAt:now,count:1});
    return {allowed:true,retryAfter:60};
  }
  current.count+=1;
  return {allowed:current.count<=limit,retryAfter:Math.max(1,Math.ceil((WINDOW_MS-(now-current.startedAt))/1000))};
}

export function checkRateLimit(req,{mutation=false,now=Date.now()}={}){
  const request=consume(bucketKey(req,'request'),MAX_REQUESTS,now);
  if(!request.allowed)return request;
  if(mutation)return consume(bucketKey(req,'mutation'),MAX_MUTATIONS,now);
  return request;
}

export function validateSameOrigin(req){
  const origin=req.headers.origin;
  if(!origin)return;
  const host=req.headers.host;
  if(!host)throw new Error('Invalid request origin');
  let parsed;
  try{parsed=new URL(origin)}catch{throw new Error('Invalid request origin')}
  const forwardedProto=req.headers['x-forwarded-proto'];
  const proto=forwardedProto==='https'?'https':forwardedProto==='http'?'http':(process.env.NODE_ENV==='production'?'https':'http');
  if(parsed.origin!==`${proto}://${host}`)throw new Error('Cross-site request blocked');
}

export function securityHeaders(){
  return {
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org https://*.telegram.org; connect-src 'self'; img-src 'self' data: https://t.me https://*.telegram.org; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}

export function clearRateLimitBuckets(now=Date.now()){
  for(const [key,value] of buckets)if(now-value.startedAt>=WINDOW_MS)buckets.delete(key);
}
