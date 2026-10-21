import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-social-ai-'));
await fs.copyFile(new URL('../index.ts', import.meta.url), path.join(dir, 'index.mjs'));
const { handleRequest } = await import(path.join(dir, 'index.mjs'));

const env = {
  GATEWAY_CLIENT_KEY:'t'.repeat(40),
  AI_UPSTREAM_API_KEY:'test-private-upstream',
  ALLOWED_MODELS:'openai/gpt-oss-20b',
  MAX_OUTPUT_TOKENS:'1200'
};
const valid = {model:'openai/gpt-oss-20b',messages:[{role:'user',content:'draft'}],max_tokens:99999};
const req = (body=valid,token=env.GATEWAY_CLIENT_KEY) => new Request('https://example.invalid/v1/chat/completions',{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)
});
test('health does not reveal any credential',async()=>{
 const r=await handleRequest(new Request('https://example.invalid/health'),{env});
 assert.equal(r.status,200);
 const text=await r.text();
 assert.ok(!text.includes(env.GATEWAY_CLIENT_KEY));
 assert.ok(!text.includes(env.AI_UPSTREAM_API_KEY));
});
test('readiness returns 503 if credentials are absent',async()=>{
 const r=await handleRequest(new Request('https://example.invalid/ready'),{env:{}});
 assert.equal(r.status,503);
 assert.equal((await r.json()).ready,false);
});
test('model endpoint fails closed if credentials are absent',async()=>{
 assert.equal((await handleRequest(req(),{env:{}})).status,503);
});
test('rejects incorrect bearer token',async()=>{
 assert.equal((await handleRequest(req(valid,'invalid'),{env,fetch:()=>{throw Error('must not call upstream')}})).status,401);
});
test('model allowlist blocks unknown model',async()=>{
 assert.equal((await handleRequest(req({...valid,model:'random-model'}),{env})).status,400);
});
test('authorized request forwards only approved model and clamps max tokens',async()=>{
 let call;
 const r=await handleRequest(req(),{env,fetch:async(url,opts)=>{
   call={url,payload:JSON.parse(opts.body),auth:opts.headers.Authorization};
   return new Response(JSON.stringify({choices:[{message:{content:'ok'}}]}),{headers:{'content-type':'application/json'}});
 }});
 assert.equal(r.status,200);
 assert.equal(call.url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(call.auth,'Bearer test-private-upstream');
 assert.equal(call.payload.max_tokens,1200);
 assert.equal((await r.json()).choices[0].message.content,'ok');
});
test('upstream 429 retains retry-after without retry',async()=>{
 const r=await handleRequest(req(),{env,fetch:async()=>new Response('{"error":"limited"}',{status:429,headers:{'retry-after':'27'}})});
 assert.equal(r.status,429); assert.equal(r.headers.get('retry-after'),'27');
});
test('streaming requests are rejected',async()=>{
 assert.equal((await handleRequest(req({...valid,stream:true}),{env})).status,400);
});
test('oversized body is rejected',async()=>{
 const r=await handleRequest(req({...valid,messages:[{role:'user',content:'X'.repeat(140000)}]}),{env});
 assert.equal(r.status,413);
});
test('non-https upstream disallowed',async()=>{
 assert.equal((await handleRequest(req(),{env:{...env,AI_UPSTREAM_BASE_URL:'http://host.example/v1'}})).status,503);
});
test('unknown provider options rejected to limit spend',async()=>{
 assert.equal((await handleRequest(req({...valid,tools:[]}),{env})).status,400);
});
test('only text messages supported',async()=>{
 assert.equal((await handleRequest(req({...valid,messages:[{role:'user',content:[{type:'image_url'}]}]}),{env})).status,400);
});
