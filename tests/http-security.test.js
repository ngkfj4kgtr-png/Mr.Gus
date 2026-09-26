import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRateLimit,validateSameOrigin,securityHeaders,clearRateLimitBuckets} from '../src/http-security.js';

function req(ip='203.0.113.10',headers={}){return{headers:{'x-forwarded-for':ip,...headers},socket:{remoteAddress:ip}}}

test('rate limit allows normal traffic and blocks mutation spam',()=>{
  const now=1_000_000;
  clearRateLimitBuckets(now);
  for(let i=0;i<30;i++)assert.equal(checkRateLimit(req('198.51.100.1'),{mutation:true,now}).allowed,true);
  assert.equal(checkRateLimit(req('198.51.100.1'),{mutation:true,now}).allowed,false);
});

test('rate limits are isolated by client address',()=>{
  const now=2_000_000;
  clearRateLimitBuckets(now);
  for(let i=0;i<30;i++)checkRateLimit(req('198.51.100.2'),{mutation:true,now});
  assert.equal(checkRateLimit(req('198.51.100.3'),{mutation:true,now}).allowed,true);
});

test('rate limit resets after the window',()=>{
  const now=3_000_000;
  clearRateLimitBuckets(now);
  for(let i=0;i<30;i++)checkRateLimit(req('198.51.100.4'),{mutation:true,now});
  assert.equal(checkRateLimit(req('198.51.100.4'),{mutation:true,now:now+60_001}).allowed,true);
});

test('cross-site state-changing origin is blocked',()=>{
  assert.throws(()=>validateSameOrigin(req('198.51.100.5',{
    origin:'https://evil.example',
    host:'game.example'
  }),),/Cross-site request blocked/);
});

test('same origin is accepted',()=>{
  assert.doesNotThrow(()=>validateSameOrigin(req('198.51.100.6',{
    origin:'https://game.example',
    host:'game.example'
  })));
});

test('security headers are defined',()=>{
  const h=securityHeaders();
  assert.equal(h['X-Content-Type-Options'],'nosniff');
  assert.equal(h['X-Frame-Options'],'DENY');
  assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);
});
