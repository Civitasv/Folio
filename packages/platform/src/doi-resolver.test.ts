import { expect,it,vi } from 'vitest';
import { createDoiResolver,type MetadataFetch } from './doi-resolver';
const doi='10.1234/example';
const crossref={message:{DOI:doi,title:['Example Work'],author:[{given:'A',family:'Writer'},{family:'Solo'}],
  'container-title':['Journal'],publisher:'Publisher',published:{'date-parts':[[2024,3,2]]},language:'en'}};
const datacite={data:{attributes:{doi,titles:[{title:'Data Work'}],creators:[{name:'Writer, A'}],
  publisher:'Repository',publicationYear:2022,language:'fr',container:{title:'Dataset series'}}}};
const openalex={doi:'https://doi.org/'+doi,open_access:{is_oa:true},best_oa_location:{
  is_oa:true,pdf_url:'https://oa.example.org/article.pdf',landing_page_url:'https://oa.example.org/article',license:'cc-by'}};
function ok(value:unknown,status=200):Response{
 return {ok:status>=200&&status<300,status,json:vi.fn(async()=>value)} as unknown as Response;
}
function fake(cross:Response,dc:Response,oa:Response):MetadataFetch{
 return vi.fn(async url=>url.includes('crossref.org')?cross:url.includes('datacite.org')?dc:oa);
}
it('resolves Crossref and an exact-DOI OpenAlex OA location using only fixed service origins',async()=>{
 const fetcher=fake(ok(crossref),ok(datacite),ok(openalex)),controller=new AbortController();
 const record=await createDoiResolver(fetcher).resolve(' DOI: 10.1234/EXAMPLE ',controller.signal);
 expect(record).toEqual({doi,title:'Example Work',creators:['A Writer','Solo'],containerTitle:'Journal',publisher:'Publisher',
   year:2024,language:'en',landingUrl:'https://doi.org/'+doi,source:'Crossref',
   oa:{pdfUrl:'https://oa.example.org/article.pdf',landingUrl:'https://oa.example.org/article',license:'cc-by',source:'OpenAlex'}});
 expect(fetcher).toHaveBeenCalledTimes(2);
 expect(vi.mocked(fetcher).mock.calls[1][0]).toBe('https://api.openalex.org/works/doi:10.1234/example');
 expect(vi.mocked(fetcher).mock.calls[0][0]).toBe('https://api.crossref.org/works/10.1234%2Fexample');
 expect(vi.mocked(fetcher).mock.calls[0][1]).toMatchObject({credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
});
it('falls back to DataCite when Crossref misses and tolerates missing OA data',async()=>{
 const fetcher=fake(ok({},404),ok(datacite),ok({},404));
 const value=await createDoiResolver(fetcher).resolve(doi,new AbortController().signal);
 expect(value).toEqual({doi,title:'Data Work',creators:['Writer, A'],containerTitle:'Dataset series',
  publisher:'Repository',year:2022,language:'fr',landingUrl:'https://doi.org/'+doi,source:'DataCite'});
 expect(fetcher).toHaveBeenCalledTimes(3);
});
it('never mislabels mismatched, closed or unsafe OA metadata',async()=>{
 for(const oa of [{...openalex,doi:'https://doi.org/10.1111/wrong'},
   {...openalex,open_access:{is_oa:false}},
   {...openalex,best_oa_location:{...openalex.best_oa_location,is_oa:false}},
   {...openalex,best_oa_location:{is_oa:true,pdf_url:'http://unsafe.test/a',landing_page_url:'https://localhost/a'}}]){
  const result=await createDoiResolver(fake(ok(crossref),ok(datacite),ok(oa))).resolve(doi,new AbortController().signal);
  expect(result.oa).toBeUndefined();
 }
});
it('supports optional OA landing only and missing Crossref fields',async()=>{
 const minimal={message:{DOI:doi,title:['Basic'],author:[{given:'',family:'B'},null],published:{}}};
 const oa={...openalex,best_oa_location:{is_oa:true,landing_page_url:'https://repo.example.net/page'}};
 const result=await createDoiResolver(fake(ok(minimal),ok(datacite),ok(oa))).resolve(doi,new AbortController().signal);
 expect(result).toMatchObject({title:'Basic',creators:['B'],year:undefined,
   oa:{landingUrl:'https://repo.example.net/page',pdfUrl:undefined,license:undefined}});
});
it('rejects mismatched registry identifiers, missing titles and absence of fallback',async()=>{
 for(const first of [{message:{DOI:'10.1111/bad',title:['Wrong']}},{message:{DOI:doi,title:[]}}]){
  await expect(createDoiResolver(fake(ok(first),ok({},404),ok(openalex))).resolve(doi,new AbortController().signal)).rejects.toThrow('Metadata HTTP 404');
 }
 await expect(createDoiResolver(fake(ok({},404),ok({...datacite,data:{attributes:{doi:'10.2222/other',titles:[{title:'Wrong'}]}}}),ok(openalex))).resolve(doi,new AbortController().signal)).rejects.toThrow('DataCite DOI mismatch');
 await expect(createDoiResolver(fake(ok({},404),ok({data:{attributes:{doi,titles:[]}}}),ok(openalex))).resolve(doi,new AbortController().signal)).rejects.toThrow('Missing title');
});
it('does not silently retry a cancelled Crossref lookup or ignore cancelled OA discovery',async()=>{
 const controller=new AbortController();
 const fetcher:MetadataFetch=vi.fn(async()=>{controller.abort();throw Error('cancelled');});
 await expect(createDoiResolver(fetcher).resolve(doi,controller.signal)).rejects.toThrow('cancelled');
 expect(fetcher).toHaveBeenCalledOnce();
 const later=new AbortController();
 const fetcher2:MetadataFetch=vi.fn(async url=>{
  if(url.includes('openalex')){later.abort();throw Error('cancelled OA');}
  return ok(crossref);
 });
 await expect(createDoiResolver(fetcher2).resolve(doi,later.signal)).rejects.toThrow('cancelled OA');
});

it('handles incomplete Crossref and DataCite metadata without manufacturing authors or dates',async()=>{
 const minimal={message:{DOI:doi,title:['Minimal'],published:{},author:undefined,
   publisher:'',language:'', 'container-title':[]}};
 const value=await createDoiResolver(fake(ok(minimal),ok(datacite),ok({},404))).resolve(doi,new AbortController().signal);
 expect(value).toEqual({doi,title:'Minimal',creators:[],containerTitle:undefined,publisher:undefined,year:undefined,
   language:undefined,landingUrl:'https://doi.org/'+doi,source:'Crossref'});
 const data={data:{attributes:{doi,titles:[{title:'Standalone'}]}}};
 const result=await createDoiResolver(fake(ok({},404),ok(data),ok({},404))).resolve(doi,new AbortController().signal);
 expect(result).toMatchObject({title:'Standalone',creators:[],year:undefined,containerTitle:undefined,
   publisher:undefined,language:undefined});
});
it('rejects DataCite records without an array of titles and handles alternative Crossref date shape',async()=>{
 const missing={data:{attributes:{doi,titles:{title:'wrong'}}}};
 await expect(createDoiResolver(fake(ok({},404),ok(missing),ok({},404))).resolve(doi,new AbortController().signal)).rejects.toThrow('Missing title');
 const date={message:{DOI:doi,title:'String title','container-title':'String venue',published:{'date-parts':null}}};
 const value=await createDoiResolver(fake(ok(date),ok(datacite),ok({},404))).resolve(doi,new AbortController().signal);
 expect(value).toMatchObject({title:'String title',containerTitle:'String venue',year:undefined});
});
