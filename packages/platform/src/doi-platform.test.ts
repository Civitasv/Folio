import { expect,it,vi } from 'vitest';
import { doiUrl, MAX_PDF_BYTES, type DoiMetadata } from '@folio/core';
import { createReaderPlatform,type PdfStore,type StoredPdf } from './index';
import { createDoiPlatform,unresolvedReference } from './doi-platform';
import type { DoiResolver,MetadataFetch } from './doi-resolver';
const doi='10.1234/example';
const metadata:DoiMetadata={doi,title:'Example',creators:['A'],landingUrl:doiUrl(doi),source:'Crossref',
 oa:{pdfUrl:'https://oa.example.org/a.pdf',source:'OpenAlex'}};
const bytes=new Uint8Array([37,80,68,70,45,49]);
function response(status=200,type='application/pdf',length:string|null=null,body:unknown=stream(bytes)):Response {
 return {ok:status>=200&&status<300,status,headers:{get:(key:string)=>key==='content-type'?type:length},
   body} as unknown as Response;
}
function stream(data:Uint8Array) {
 let done=false;
 return {getReader:()=>({read:vi.fn(async()=>{if(done)return {done:true};done=true;return {done:false,value:data};}),
   cancel:vi.fn(async()=>{}),releaseLock:vi.fn()})};
}
function fixture(fetcher:MetadataFetch=vi.fn(async()=>response())) {
 const rows=new Map<string,StoredPdf>();
 const store:PdfStore={list:vi.fn(async()=>[...rows.values()]),get:vi.fn(async id=>rows.get(id)),
  put:vi.fn(async doc=>{rows.set(doc.id,doc);}),remove:vi.fn(async id=>{rows.delete(id);})};
 const pdf=createReaderPlatform(store,async()=> 'hash');
 const resolver={resolve:vi.fn(async()=>metadata)} as unknown as DoiResolver;
 return {rows,store,pdf,resolver,fetcher,platform:createDoiPlatform(store,pdf,resolver,fetcher)};
}
it('saves one metadata-only DOI record, reopens offline, preserves legacy PDF and deduplicates',async()=>{
 const f=fixture(),existing=await f.pdf.importPdf('old.pdf',bytes);
 const doc=await f.platform.saveReference(metadata);
 expect(doc).toEqual({id:'doi:'+doi,kind:'reference',doi,title:'Example',creators:['A'],progress:0});
 expect(f.rows.get(doc.id)?.bytes).toEqual(new Uint8Array());
 expect(await f.platform.saveReference({...metadata,title:'Renamed'})).toEqual({...doc,title:'Renamed'});
 expect(await f.pdf.listDocuments()).toEqual([existing,doc]);
 expect(await f.platform.readReference(doc.id)).toEqual({metadata,linkedDocumentId:undefined});
 await expect(f.pdf.readPdf(doc.id)).rejects.toThrow('PDF not found');
 await expect(f.pdf.setProgress(doc.id,2)).rejects.toThrow('PDF not found');
 expect(await f.pdf.readPdf(existing.id)).toEqual(bytes);
 await f.pdf.deletePdf(doc.id);
 await expect(f.platform.readReference(doc.id)).rejects.toThrow('Reference not found');
});
it('rejects forged provenance and supports explicitly unverified offline DOI record',async()=>{
 const f=fixture();
 for(const m of [{...metadata,doi:'10.1234/EXAMPLE'},{...metadata,landingUrl:'https://evil.test'}])
  await expect(f.platform.saveReference(m)).rejects.toThrow('Invalid reference provenance');
 expect(f.rows.size).toBe(0);
 const unresolved=unresolvedReference('doi:10.1234/EXAMPLE');
 expect(unresolved).toEqual({doi,title:doi,creators:[],landingUrl:doiUrl(doi),source:'Unresolved'});
 expect(await f.platform.saveReference(unresolved)).toMatchObject({kind:'reference',title:doi});
 expect(()=>unresolvedReference('bad')).toThrow('Invalid DOI');
});
it('returns the resolver without triggering network until explicitly called',async()=>{
 const f=fixture();expect(f.resolver.resolve).not.toHaveBeenCalled();
 await f.platform.resolveDoi(doi,new AbortController().signal);
 expect(f.resolver.resolve).toHaveBeenCalledOnce();
});
it('explicitly imports only a known OA PDF and preserves the independent reference',async()=>{
 const f=fixture();const saved=await f.platform.saveReference(metadata);
 const pdf=await f.platform.importOpenPdf(saved.id,new AbortController().signal);
 expect(pdf.id).toBe('sha256:hash');
 expect(f.fetcher).toHaveBeenCalledWith(metadata.oa!.pdfUrl,expect.objectContaining({
  method:'GET',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',mode:'cors'}));
 expect(await f.platform.readReference(saved.id)).toEqual({metadata,linkedDocumentId:pdf.id});
 await f.pdf.deletePdf(pdf.id);
 expect(await f.platform.readReference(saved.id)).toEqual({metadata,linkedDocumentId:undefined});
 expect((await f.pdf.listDocuments())[0].kind).toBe('reference');
});
it('rejects missing, non-OA and forged URL, HTTP and bad content type',async()=>{
 const f=fixture();
 await expect(f.platform.importOpenPdf('missing',new AbortController().signal)).rejects.toThrow('Reference not found');
 const saved=await f.platform.saveReference({...metadata,oa:undefined});
 await expect(f.platform.importOpenPdf(saved.id,new AbortController().signal)).rejects.toThrow('No verified open-access PDF URL');
 const row=f.rows.get(saved.id)!;
 f.rows.set(saved.id,{...row,metadata:{...metadata,oa:{source:'OpenAlex',pdfUrl:'http://127.0.0.1/a'}}});
 await expect(f.platform.importOpenPdf(saved.id,new AbortController().signal)).rejects.toThrow('No verified open-access PDF URL');
 f.rows.set(saved.id,{...row});
 const nonPdf=fixture(vi.fn(async()=>response(200,'text/html')));
 const second=await nonPdf.platform.saveReference(metadata);
 await expect(nonPdf.platform.importOpenPdf(second.id,new AbortController().signal)).rejects.toThrow('Unexpected PDF content type');
});
it('rejects upstream HTTP failures, declared oversized content and nonstreaming responses',async()=>{
 for(const [result,message] of [[response(403),'PDF HTTP 403'],
  [response(200,'application/pdf',String(MAX_PDF_BYTES+1)),'PDF is too large'],
  [response(200,'application/octet-stream',null,null),'Streaming download unavailable']] as const){
   const f=fixture(vi.fn(async()=>result)),ref=await f.platform.saveReference(metadata);
   await expect(f.platform.importOpenPdf(ref.id,new AbortController().signal)).rejects.toThrow(message);
 }
});
it('rejects streaming overflow, invalid signature and accepts octet stream PDF',async()=>{
 const cancel=vi.fn(async()=>{}),releaseLock=vi.fn();
 const oversized={getReader:()=>({read:vi.fn(async()=>({done:false,value:{byteLength:MAX_PDF_BYTES+1}})),
  cancel,releaseLock})};
 const tooBig=fixture(vi.fn(async()=>response(200,'application/pdf',null,oversized)));
 const a=await tooBig.platform.saveReference(metadata);
 await expect(tooBig.platform.importOpenPdf(a.id,new AbortController().signal)).rejects.toThrow('PDF is too large');
 expect(cancel).toHaveBeenCalledOnce();expect(releaseLock).toHaveBeenCalledOnce();
 const bad=fixture(vi.fn(async()=>response(200,'application/pdf',null,stream(new Uint8Array([1,2,3])))));
 const b=await bad.platform.saveReference(metadata);
 await expect(bad.platform.importOpenPdf(b.id,new AbortController().signal)).rejects.toThrow('Downloaded content is not a supported PDF');
 const octet=fixture(vi.fn(async()=>response(200,'application/octet-stream')));
 const c=await octet.platform.saveReference(metadata);
 expect((await octet.platform.importOpenPdf(c.id,new AbortController().signal)).id).toBe('sha256:hash');
});

it('provides DOI title fallback when metadata has no title',async()=>{
 const f=fixture(),m={...metadata,title:''};
 const ref=await f.platform.saveReference(m);
 expect(ref.title).toBe(doi);
});

it('upgrades an unverified offline DOI in place and never downgrades verified metadata',async()=>{
 const f=fixture(),first=await f.platform.saveReference(unresolvedReference(doi));
 expect((await f.platform.readReference(first.id)).metadata.source).toBe('Unresolved');
 const upgraded=await f.platform.saveReference(metadata);
 expect(upgraded.id).toBe(first.id);
 expect(upgraded.title).toBe('Example');
 expect((await f.platform.readReference(first.id)).metadata.source).toBe('Crossref');
 await f.platform.saveReference(unresolvedReference(doi));
 expect((await f.platform.readReference(first.id)).metadata.source).toBe('Crossref');
 expect(f.rows.size).toBe(1);
});
it('rejects a conflicting non-reference occupying the canonical DOI identity',async()=>{
 const f=fixture();
 f.rows.set('doi:'+doi,{id:'doi:'+doi,kind:'epub',title:'collision',fingerprint:'x',progress:1,bytes:new Uint8Array()});
 await expect(f.platform.saveReference(metadata)).rejects.toThrow('Reference ID collision');
});
