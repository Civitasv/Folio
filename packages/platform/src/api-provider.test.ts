import {afterEach,expect,it,vi} from 'vitest';
import {apiResponseText,createApiProvider,createNativeApiProvider,normalizeApiConfig,testApiConnection,translationMessages} from './api-provider';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const config={endpoint:'https://api.example.org/v1',model:'model-1'};
const request={text:'Line [1]',source:'en',target:'fr',promptVersion:'f01d-v1'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
it('accepts only public-looking HTTPS /v1 and strictly bounded model identifiers',()=>{
 expect(normalizeApiConfig({endpoint:' https://api.example.org/v1 ',model:' model-1 '})).toEqual(config);
 for(const endpoint of ['not url','http://api.example.org/v1','https://localhost/v1','https://127.0.0.1/v1',
 'https://foo.local/v1','https://foo.internal/v1','https://[::1]/v1','https://user:pass@api.example.org/v1',
 'https://api.example.org:432/v1','https://api.example.org/v1?x=1','https://api.example.org/v1#x','https://api.example.org/other',
 'https://single/v1'])expect(()=>normalizeApiConfig({...config,endpoint})).toThrow();
 for(const model of ['','bad model','a'.repeat(101),'x\ny'])expect(()=>normalizeApiConfig({...config,model})).toThrow('Invalid model');
});
it('builds a bounded untrusted excerpt message and rejects empty/oversized text',()=>{
 const msgs=translationMessages(request);expect(msgs).toHaveLength(2);
 expect(msgs[1].content).toContain('Line [1]');
 expect(msgs[0].content).toContain('untrusted data');
 for(const text of ['', 'x'.repeat(4001)])expect(()=>translationMessages({...request,text})).toThrow('Invalid excerpt length');
});
it('checks reply shape without pretending missing outputs are translations',()=>{
 expect(apiResponseText({choices:[{message:{content:' Bonjour '}}]})).toBe('Bonjour');
 for(const value of [null,{},{choices:null},{choices:[]},{choices:[{}]},{choices:[{message:{content:null}}]},
  {choices:[{message:{content:' '}}]},{choices:[{message:{content:'x'.repeat(16001)}}]}])
  expect(()=>apiResponseText(value)).toThrow('Missing API translation');
});
it('sends a single bounded user-initiated POST with omitted credentials and forbids redirects',async()=>{
 const fetcher=vi.fn(async(_url:string,_options:RequestInit)=>reply({choices:[{message:{content:' Bonjour '}}]}));
 const provider=createApiProvider(config,()=>' test-key ',fetcher);
 expect(fetcher).not.toHaveBeenCalled();
 expect(provider).toMatchObject({id:'api:https://api.example.org/v1',model:'model-1',supportsAutoSource:true});
 expect(await provider.translate(request,new AbortController().signal)).toBe('Bonjour');
 expect(fetcher).toHaveBeenCalledWith('https://api.example.org/v1/chat/completions',expect.objectContaining({
  method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
  headers:expect.objectContaining({Authorization:'Bearer test-key'})}));
 const body=JSON.parse(fetcher.mock.calls[0][1].body as string);
 expect(body.model).toBe('model-1');expect(body.stream).toBe(false);expect(body.messages).toHaveLength(2);
});
it('gates missing and newline-bearing keys and abort before network activity',async()=>{
 for(const secret of ['','   ','bad\nsecret']){
  const fetcher=vi.fn(async(_url:string,_options:RequestInit)=>reply({}));
  const provider=createApiProvider(config,()=>secret,fetcher);
  await expect(provider.translate(request,new AbortController().signal)).rejects.toThrow('API key');
  expect(fetcher).not.toHaveBeenCalled();
 }
 const fetcher=vi.fn(async(_url:string,_options:RequestInit)=>reply({}));
 const cancelled=new AbortController();cancelled.abort();
 await expect(createApiProvider(config,()=>'key',fetcher).translate(request,cancelled.signal)).rejects.toThrow('cancelled');
 expect(fetcher).not.toHaveBeenCalled();
});
it('reports authorization, rate limit, provider failure, invalid JSON, missing body and oversized replies',async()=>{
 const cases:[Response,string][]=[
  [reply({},401),'authentication'],[reply({},403),'authentication'],[reply({},429),'rate limit'],[reply({},500),'HTTP 500'],
  [new Response('not json'),'Invalid API response JSON'],[reply({choices:[]}), 'Missing API translation'],
  [new Response(null),'body unavailable'],[new Response('x'.repeat(256*1024+1)),'too large']
 ];
 for(const [response,message] of cases){
  const provider=createApiProvider(config,()=>'key',vi.fn(async()=>response));
  await expect(provider.translate(request,new AbortController().signal)).rejects.toThrow(message);
 }
});
it('propagates transport errors, cancellation after response and explicit connection probing',async()=>{
 const failing=createApiProvider(config,()=>'key',vi.fn(async()=>{throw Error('CORS denied');}));
 await expect(failing.translate(request,new AbortController().signal)).rejects.toThrow('CORS denied');
 const controller=new AbortController();
 const canceled=createApiProvider(config,()=>'key',vi.fn(async()=>{controller.abort();throw Error('aborted');}));
 await expect(canceled.translate(request,controller.signal)).rejects.toThrow('cancelled');
 const fetcher=vi.fn(async(_url:string,_options:RequestInit)=>reply({choices:[{message:{content:'Salut'}}]}));
 await expect(testApiConnection(createApiProvider(config,()=>'key',fetcher),new AbortController().signal)).resolves.toBe('Salut');
 expect(JSON.parse(fetcher.mock.calls[0][1].body as string).messages[1].content).toContain('Hello');
});
it('desktop bridge preserves model/endpoint identity while keeping stored secret out of browser requests',async()=>{
 const bridge={saveKey:vi.fn(),hasKey:vi.fn(async()=>true),clearKey:vi.fn(),
  translate:vi.fn(async()=> ' Native result ')};
 const provider=createNativeApiProvider(config,bridge);
 expect(provider.id).toBe('api:https://api.example.org/v1');
 expect(await provider.translate(request,new AbortController().signal)).toBe(' Native result ');
 expect(bridge.translate).toHaveBeenCalledWith(config,request,expect.any(AbortSignal));
});

it('rejects if aborted immediately after fetch settles or after body parsing, without storing output',async()=>{
 const first=new AbortController();
 const p1=createApiProvider(config,()=>'key',vi.fn(async()=>{first.abort();return reply({choices:[]});}));
 await expect(p1.translate(request,first.signal)).rejects.toThrow('cancelled');
 const second=new AbortController();
 const data=JSON.stringify({choices:[{message:{content:'Bonjour'}}]});
 const body=new ReadableStream<Uint8Array>({pull(controller){second.abort();controller.enqueue(new TextEncoder().encode(data));controller.close();}});
 const p2=createApiProvider(config,()=>'key',vi.fn(async()=>new Response(body)));
 await expect(p2.translate(request,second.signal)).rejects.toThrow('cancelled');
});
it('uses a finite timeout even when fetch does not settle until aborted',async()=>{
 vi.useFakeTimers();
 const provider=createApiProvider(config,()=>'key',vi.fn(async(_url:string,options:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
  options.signal!.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 })));
 const result=provider.translate(request,new AbortController().signal);
 const assertion=expect(result).rejects.toThrow('API timeout');
 await vi.advanceTimersByTimeAsync(20001);
 await assertion;
});
