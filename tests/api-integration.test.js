import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port=39123;
let child;
let base;
let cookie;

async function waitForServer(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(base+'/');if(r.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Server did not start');
}

test.before(async()=>{
  child=spawn(process.execPath,['server.js'],{
    cwd:process.cwd(),
    env:{...process.env,DEMO_MODE:'true',NODE_ENV:'production',PORT:String(port)}
  });
  base=`http://127.0.0.1:${port}`;
  await waitForServer();
  const r=await fetch(base+'/api/auth/telegram',{method:'POST'});
  assert.equal(r.status,200);
  cookie=r.headers.get('set-cookie')?.split(';',1)[0];
  assert.ok(cookie);
});

test('API rejects mutation without JSON Content-Type',async()=>{
  const r=await fetch(base+'/api/task/claim',{
    method:'POST',headers:{Cookie:cookie,Origin:base},body:JSON.stringify({operationId:'content-type-test',taskId:'first_order'})
  });
  assert.equal(r.status,415);
  assert.equal((await r.json()).error,'Content-Type must be application/json');
});

test('API rejects malformed JSON with a public 400 error',async()=>{
  const r=await fetch(base+'/api/task/claim',{
    method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{"broken":'
  });
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,'Invalid JSON body');
});

test('API blocks cross-site state-changing fetches',async()=>{
  const r=await fetch(base+'/api/task/claim',{
    method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example','Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:JSON.stringify({operationId:'csrf-test',taskId:'first_order'})
  });
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,'Cross-site request blocked');
});

test('production static responses include HSTS and do not leak internals',async()=>{
  const r=await fetch(base+'/');
  assert.equal(r.status,200);
  assert.equal(r.headers.get('strict-transport-security'),'max-age=31536000; includeSubDomains');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
});

test.after(()=>{if(child&&!child.killed)child.kill('SIGTERM')});
