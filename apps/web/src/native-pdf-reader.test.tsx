import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {DEFAULT_LANGUAGE_PREFERENCES,type PdfDocumentIR,type DocumentSummary,type TranslationProvider} from '@folio/core';
import {parseLocalPdf} from './pdf-extract';
import {NativePdfReader,sourceIdentity} from './native-pdf-reader';
vi.mock('./pdf-extract',()=>({parseLocalPdf:vi.fn(),pdfFailureMessage:(error:unknown)=>'Unable to rebuild this PDF. '+(error instanceof Error?error.message:'Unknown PDF engine error')+'. The original file remains stored locally.'}));
const doc:DocumentSummary={id:'sha256:a',title:'Paper',progress:1};
const bytes=new Uint8Array([37,80,68,70]);
const blocks=[
 {id:'p1-b1',kind:'title' as const,page:1,text:'Drought Research',confidence:1,rect:{x:.1,y:.1,width:.6,height:.04}},
 {id:'p1-b2',kind:'paragraph' as const,page:1,text:'Source paragraph.',confidence:1,rect:{x:.1,y:.2,width:.6,height:.05}},
 {id:'p2-b1',kind:'caption' as const,page:2,text:'Figure 1: Original evidence.',confidence:1,rect:{x:.1,y:.2,width:.6,height:.05}}
];
const ir:PdfDocumentIR={version:1,documentId:doc.id,pages:2,blocks,warnings:[]};
const destroy=vi.fn(async()=>{}),pageImage=vi.fn(async()=> 'data:image/png;base64,AA==');
const regionImage=vi.fn(async()=> 'data:image/png;base64,BB==');
const parsed={ir,destroy,pageImage,regionImage};
const langs={...DEFAULT_LANGUAGE_PREFERENCES,source:'en',target:'zh-Hans'};
function platform(){
 return {getLanguages:vi.fn(async()=>langs),setLanguages:vi.fn(async p=>p),
 findTranslation:vi.fn(async identity=>identity.unit.text==='Source paragraph.'?{
  key:'x',identity,sourceHash:'hash',translatedText:'译文段落。',provenance:'manual' as const
 }:undefined),
 saveManualTranslation:vi.fn(async(identity,text)=>({key:'manual',identity,sourceHash:'hash',translatedText:text,provenance:'manual' as const})),
 translate:vi.fn(async(identity)=>({key:'provider',identity,sourceHash:'hash',translatedText:'模型译文。',provenance:'provider' as const}))};
}
beforeEach(()=>{vi.mocked(parseLocalPdf).mockReset();vi.mocked(parseLocalPdf).mockResolvedValue(parsed);destroy.mockClear();pageImage.mockClear();regionImage.mockClear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
it('derives an exact page/block translation identity independent of presentation',()=>{
 expect(sourceIdentity(doc,blocks[1],langs)).toMatchObject({documentId:doc.id,target:'zh-Hans',providerId:'manual',
  unit:{anchor:{kind:'pdf',page:1},unitIndex:2,text:'Source paragraph.'}});
 const provider:TranslationProvider={id:'codex',model:'test',supportsAutoSource:true,translate:vi.fn(async()=> 'ok')};
 expect(sourceIdentity(doc,blocks[2],langs,provider)).toMatchObject({providerId:'codex',model:'test',unit:{unitIndex:1}});
});
it('renders two semantic article streams and a single alternating stream without requesting AI on switch',async()=>{
 const p=platform(),onLocation=vi.fn();
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} onLocation={onLocation}/>);
 const original=await screen.findByRole('region',{name:'Original article'});
 const translation=screen.getByRole('region',{name:'Translated article'});
 expect(within(original).getByText('Source paragraph.')).toBeTruthy();
 expect(await within(translation).findByText('译文段落。')).toBeTruthy();
 expect(p.translate).not.toHaveBeenCalled();
 fireEvent.focus(within(original).getByText('Source paragraph.').parentElement!);
 expect(onLocation).toHaveBeenCalledWith(1);
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 const feed=screen.getByRole('region',{name:'Interleaved article'});
 const text=feed.textContent??'';
 expect(text.indexOf('Drought Research')).toBeLessThan(text.indexOf('Source paragraph.'));
 expect(text.indexOf('Source paragraph.')).toBeLessThan(text.indexOf('译文段落。'));
 expect(text.indexOf('译文段落。')).toBeLessThan(text.indexOf('Figure 1: Original evidence.'));
 expect(feed.querySelectorAll('.folio-native-pair')).toHaveLength(3);
 expect(p.translate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Parallel · 双栏'}));
 expect(screen.getByRole('region',{name:'Original article'})).toBeTruthy();
 expect(vi.mocked(parseLocalPdf)).toHaveBeenCalledTimes(1);
});
it('shows an original page audit without embedding a PDF preview',async()=>{
 render(<NativePdfReader doc={doc} bytes={bytes}/>);
 const button=await screen.findByRole('button',{name:'Review original page 1 for p1-b2'});
 fireEvent.click(button);
 expect(await screen.findByRole('dialog',{name:'Original PDF page 1'})).toBeTruthy();
 expect(pageImage).toHaveBeenCalledWith(1);
 expect(screen.getByAltText('Unmodified PDF page 1')).toBeTruthy();
 fireEvent.click(screen.getByText('Close original page'));
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.queryByTitle('PDF document')).toBeNull();
});
it('renders and saves a local translation while language changes only update local preferences',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 const translated=await screen.findByRole('region',{name:'Translated article'});
 await waitFor(()=>expect(within(translated).getAllByText('Not translated')).toHaveLength(3));
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'ja'}});
 await waitFor(()=>expect(p.setLanguages).toHaveBeenCalledWith(expect.objectContaining({target:'ja'})));
 fireEvent.click(within(translated).getAllByText('Translate this block')[0]);
 fireEvent.change(screen.getByLabelText('Local translation p1-b1'),{target:{value:'研究'}});
 fireEvent.click(within(translated).getAllByText('Save local translation')[0]);
 await waitFor(()=>expect(p.saveManualTranslation).toHaveBeenCalledWith(expect.objectContaining({target:'ja'}),'研究'));
 expect(await within(translated).findByText('研究')).toBeTruthy();
 expect(p.translate).not.toHaveBeenCalled();
});
it('does not invoke a provider without explicit consent and shows saved provider output',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 const provider:TranslationProvider={id:'provider',model:'model',supportsAutoSource:true,dataFlow:'remote',
  translate:vi.fn(async()=> 'ok')};
 const confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const view=await screen.findByRole('region',{name:'Translated article'});
 fireEvent.click(within(view).getAllByText('Translate this block')[0]);
 fireEvent.click(within(view).getAllByText('Translate with provider')[0]);
 expect(p.translate).not.toHaveBeenCalled();
 fireEvent.click(within(view).getAllByText('Translate with provider')[0]);
 await waitFor(()=>expect(p.translate).toHaveBeenCalledOnce());
 expect(await within(view).findByText('模型译文。')).toBeTruthy();
 expect(confirm).toHaveBeenCalledTimes(2);
});
it('reports empty scans and parse errors without fabricating source text',async()=>{
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[],warnings:['Page 1: no selectable text.']}});
 const a=render(<NativePdfReader doc={doc} bytes={bytes}/>);
 expect(await screen.findByText('No selectable text detected. Scanned documents need an explicit OCR engine.')).toBeTruthy();
 fireEvent.click(screen.getByText('Inspect original page'));
 expect(await screen.findByRole('dialog')).toBeTruthy();
 a.unmount();
 vi.mocked(parseLocalPdf).mockRejectedValueOnce(new Error('corrupt'));
 render(<NativePdfReader doc={doc} bytes={bytes}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('corrupt'));
});


it('reports preference load/save, cache lookup and original-page rendering errors independently',async()=>{
 const p=platform();
 p.getLanguages.mockRejectedValueOnce(new Error('settings'));
 p.findTranslation.mockRejectedValue(new Error('cache'));
 p.setLanguages.mockRejectedValueOnce(new Error('disk'));
 pageImage.mockRejectedValueOnce(new Error('canvas'));
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Cannot load saved language settings.');
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'ja'}});
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to save target language.');
 fireEvent.click(await screen.findByRole('button',{name:'Review original page 1 for p1-b1'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Original page could not be rendered.');
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('reports translation failure and cancellation without inventing translated output',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 p.saveManualTranslation.mockRejectedValueOnce(new Error('quota'));
 const provider:TranslationProvider={id:'api',model:'m',supportsAutoSource:true,translate:vi.fn(async()=> 'ok')};
 let finish!:(value:ReturnType<typeof p.translate> extends Promise<infer T>?T:never)=>void;
 p.translate.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const view=await screen.findByRole('region',{name:'Translated article'});
 fireEvent.click(within(view).getAllByText('Translate this block')[0]);
 fireEvent.change(within(view).getByLabelText('Local translation p1-b1'),{target:{value:'Local'}});
 fireEvent.click(within(view).getAllByText('Save local translation')[0]);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to save or generate this block translation.');
 fireEvent.click(within(view).getAllByText('Translate with api')[0]);
 expect(within(view).getByText('Cancel')).toBeTruthy();
 fireEvent.click(within(view).getByText('Cancel'));
 finish({key:'provider',identity:sourceIdentity(doc,blocks[0],langs,provider),translatedText:'Should not persist',sourceHash:'h',provenance:'provider'});
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Translation cancelled.');
 expect(within(view).queryByText('Should not persist')).toBeNull();
});
it('reports a long untranslatable source unit honestly and preserves one-column layout',async()=>{
 const long={...blocks[0],id:'other',text:'x'.repeat(4001)};
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[long]}});
 const p=platform();render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 const view=await screen.findByRole('region',{name:'Translated article'});
 expect(within(view).getByText('Long passage requires a smaller verified unit.')).toBeTruthy();
 expect(within(view).queryByText('Translate this block')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 expect(screen.getByRole('region',{name:'Interleaved article'})).toBeTruthy();
 expect(sourceIdentity(doc,long,langs).unit.unitIndex).toBe(0);
});
it('does not resuscitate a parsed result or late language preferences after unmount',async()=>{
 let complete!:(value:typeof parsed)=>void;
 vi.mocked(parseLocalPdf).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 const p=platform();
 let setPrefs!:(value:typeof langs)=>void;
 p.getLanguages.mockImplementationOnce(()=>new Promise(resolve=>{setPrefs=resolve;}));
 const view=render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 view.unmount();
 complete(parsed);setPrefs(langs);
 await waitFor(()=>expect(destroy).toHaveBeenCalled());
});
it('focuses matching blocks across two panes and within the one-column feed',async()=>{
 const onLocation=vi.fn(),scroll=vi.fn();
 vi.stubGlobal('scrollTo',scroll);
 const original=HTMLElement.prototype.scrollIntoView;
 HTMLElement.prototype.scrollIntoView=scroll;
 try{
  render(<NativePdfReader doc={doc} bytes={bytes} onLocation={onLocation}/>);
  const source=await screen.findByRole('region',{name:'Original article'});
  fireEvent.click(within(source).getByText('Source paragraph.'));
  expect(onLocation).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
  const feed=screen.getByRole('region',{name:'Interleaved article'});
  fireEvent.click(within(feed).getByText('Source paragraph.'));
  expect(scroll).toHaveBeenCalled();
 }finally{HTMLElement.prototype.scrollIntoView=original;}
});


it('aborts an active provider operation when leaving the reader without saving a late result',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 let complete!:(value:Awaited<ReturnType<typeof p.translate>>)=>void;
 p.translate.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 const provider:TranslationProvider={id:'api',model:'m',supportsAutoSource:true,translate:vi.fn(async()=> 'x')};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const view=render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const target=await screen.findByRole('region',{name:'Translated article'});
 fireEvent.click(within(target).getAllByText('Translate this block')[0]);
 fireEvent.click(within(target).getAllByText('Translate with api')[0]);
 expect(await within(target).findByText('Translating…')).toBeTruthy();
 const signal=(p.translate.mock.calls[0] as unknown as [unknown,unknown,AbortSignal])[2];
 view.unmount();
 expect(signal.aborted).toBe(true);
 complete({key:'provider',identity:sourceIdentity(doc,blocks[0],langs,provider),translatedText:'late',sourceHash:'x',provenance:'provider'});
});
it('does not surface a parsing error that arrives after the reading view unmounted',async()=>{
 let reject!:(err:Error)=>void;
 vi.mocked(parseLocalPdf).mockImplementationOnce(()=>new Promise((_,bad)=>{reject=bad;}));
 const view=render(<NativePdfReader doc={doc} bytes={bytes}/>);
 view.unmount();
 reject(new Error('late parsing error'));
 expect(screen.queryByText(/Unable to rebuild this PDF/)).toBeNull();
});
it('renders a semantic subheading and supports source focus without a page-save callback',async()=>{
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[...blocks,
  {...blocks[1],id:'p2-b2',kind:'heading',text:'Methods'}]}});
 render(<NativePdfReader doc={doc} bytes={bytes}/>);
 const source=await screen.findByRole('region',{name:'Original article'});
 expect(within(source).getByRole('heading',{name:'Methods'})).toBeTruthy();
 fireEvent.click(within(source).getByText('Source paragraph.'));
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 expect(screen.getByRole('region',{name:'Interleaved article'})).toBeTruthy();
});


it('surfaces a provider rejection after cancellation rather than replacing a cached passage',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 let reject!:(reason:Error)=>void;
 p.translate.mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
 const provider:TranslationProvider={id:'localcli',model:'m',supportsAutoSource:true,translate:vi.fn(async()=> 'x')};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const t=await screen.findByRole('region',{name:'Translated article'});
 fireEvent.click(within(t).getAllByText('Translate this block')[0]);
 fireEvent.click(within(t).getAllByText('Translate with localcli')[0]);
 const cancel=await within(t).findByText('Cancel');fireEvent.click(cancel);
 reject(new Error('aborted upstream'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Translation cancelled.');
 expect(within(t).queryByText('aborted upstream')).toBeNull();
});
it('closes expanded per-block translation controls without changing the reading layout',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 const t=await screen.findByRole('region',{name:'Translated article'});
 const summary=within(t).getAllByText('Translate this block')[0];
 fireEvent.click(summary);
 await waitFor(()=>expect(summary.closest('details')?.open).toBe(true));
 fireEvent.click(summary);
 await waitFor(()=>expect(summary.closest('details')?.open).toBe(false));
 expect(screen.getByRole('button',{name:'Parallel · 双栏'}).getAttribute('aria-pressed')).toBe('true');
});


it('aborts old-language translation and rejects a late old-language result after target changes',async()=>{
 const p=platform();p.findTranslation.mockResolvedValue(undefined);
 let finish!:(entry:Awaited<ReturnType<typeof p.translate>>)=>void;
 p.translate.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const provider:TranslationProvider={id:'api',model:'m',supportsAutoSource:true,translate:vi.fn(async()=> 'x')};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const t=await screen.findByRole('region',{name:'Translated article'});
 fireEvent.click(within(t).getAllByText('Translate this block')[0]);
 fireEvent.click(within(t).getAllByText('Translate with api')[0]);
 const request=p.translate.mock.calls[0] as unknown as [unknown,unknown,AbortSignal];
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'ja'}});
 await waitFor(()=>expect(request[2].aborted).toBe(true));
 await waitFor(()=>expect(p.setLanguages).toHaveBeenCalledWith(expect.objectContaining({target:'ja'})));
 finish({key:'old',identity:sourceIdentity(doc,blocks[0],langs,provider),translatedText:'Old language should never show',sourceHash:'hash',provenance:'provider'});
 await waitFor(()=>expect(t.querySelector('.folio-native-missing')).toBeTruthy());
 expect(within(t).queryByText('Old language should never show')).toBeNull();
});
it('shows a saved local draft when the optional provider has no corresponding result',async()=>{
 const p=platform();p.findTranslation.mockImplementation(async identity=>identity.providerId==='manual'&&identity.unit.text==='Source paragraph.'?{
  key:'manual',identity,sourceHash:'hash',translatedText:'本地草稿',provenance:'manual' as const
 }:undefined);
 const provider:TranslationProvider={id:'api',model:'m',supportsAutoSource:true,translate:vi.fn(async()=> 'x')};
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p} provider={provider}/>);
 const t=await screen.findByRole('region',{name:'Translated article'});
 expect(await within(t).findByText('本地草稿')).toBeTruthy();
 expect(p.findTranslation).toHaveBeenCalledWith(expect.objectContaining({providerId:'api'}));
 expect(p.findTranslation).toHaveBeenCalledWith(expect.objectContaining({providerId:'manual'}));
 expect(p.translate).not.toHaveBeenCalled();
});

it('remembers explicit reading mode when the same PDF is reopened, without affecting a different PDF',async()=>{
 const original=render(<NativePdfReader doc={doc} bytes={bytes}/>);
 await screen.findByRole('region',{name:'Original article'});
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 expect(localStorage.getItem('folio:reader-mode:v1:sha256%3Aa')).toBe('interleaved');
 original.unmount();
 const reopened=render(<NativePdfReader doc={doc} bytes={bytes}/>);
 expect(await screen.findByRole('region',{name:'Interleaved article'})).toBeTruthy();
 reopened.unmount();
 render(<NativePdfReader doc={{...doc,id:'another'}} bytes={bytes}/>);
 expect(await screen.findByRole('region',{name:'Original article'})).toBeTruthy();
});

it('renders a source-preserving figure in both parallel articles and only once in interleaved reading',async()=>{
 const rect={x:.2,y:.3,width:.6,height:.4},figure={
  id:'p2-figure-1',kind:'figure' as const,page:2,text:'',confidence:.9,rect,mediaRect:rect};
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[...blocks.slice(0,2),figure,blocks[2]]}});
 const p=platform();render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 expect(await screen.findByRole('region',{name:'Original article'})).toBeTruthy();
 expect(await screen.findByAltText('Original scientific figure p2-figure-1')).toBeTruthy();
 expect(screen.getByAltText('Unmodified scientific figure p2-figure-1')).toBeTruthy();
 expect(regionImage).toHaveBeenCalledWith(2,rect);
 expect(p.findTranslation.mock.calls.some(([identity])=>identity.unit.text==='')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 const feed=screen.getByRole('region',{name:'Interleaved article'});
 expect(within(feed).getAllByRole('img')).toHaveLength(1);
 expect(within(feed).getByAltText('Original scientific figure p2-figure-1')).toBeTruthy();
 expect(within(feed).queryByAltText('Unmodified scientific figure p2-figure-1')).toBeNull();
 const text=feed.textContent??'';
 expect(text.indexOf('Figure 1: Original evidence.')).toBeGreaterThan(text.indexOf('Original figure'));
});
it('retains original-page evidence when a figure crop is unavailable',async()=>{
 
it('preserves scientific table regions in both Parallel streams and renders them once in Interleaved',async()=>{
 const rect={x:.1,y:.2,width:.7,height:.4};
 const scientific={id:'p6-table-1000-2000-7000-4000',kind:'table' as const,page:6,text:'',
  sourceText:'< 0.001',confidence:.96,rect,mediaRect:rect};
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[scientific]}});
 const p=platform();render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 expect(await screen.findByAltText('Original scientific table p6-table-1000-2000-7000-4000')).toBeTruthy();
 expect(screen.getByAltText('Unmodified scientific table p6-table-1000-2000-7000-4000')).toBeTruthy();
 expect(p.findTranslation).not.toHaveBeenCalled();
 expect(regionImage).toHaveBeenCalledWith(6,rect);
 fireEvent.click(screen.getByRole('button',{name:'Interleaved · 单栏'}));
 const feed=screen.getByRole('region',{name:'Interleaved article'});
 expect(within(feed).getAllByRole('img')).toHaveLength(1);
 expect(within(feed).queryByText('< 0.001')).toBeNull();
});

const rect={x:.2,y:.3,width:.6,height:.4},figure={
  id:'p2-figure-2',kind:'figure' as const,page:2,text:'',confidence:.9,rect,mediaRect:rect};
 regionImage.mockRejectedValueOnce(new Error('unrenderable image'));
 vi.mocked(parseLocalPdf).mockResolvedValueOnce({...parsed,ir:{...ir,blocks:[figure]}});
 render(<NativePdfReader doc={doc} bytes={bytes}/>);
 const source=await screen.findByRole('region',{name:'Original article'});
 expect(await within(source).findByText('Original figure region is loading or unavailable. Inspect the original page.')).toBeTruthy();
 fireEvent.click(within(source).getByRole('button',{name:'Review original page 2 for p2-figure-2'}));
 expect(await screen.findByRole('dialog',{name:'Original PDF page 2'})).toBeTruthy();
});

it('exposes a local parse failure and retries the stored PDF without reimporting or remote calls',async()=>{
 vi.mocked(parseLocalPdf).mockRejectedValueOnce(new Error('PDF worker unavailable')).mockResolvedValueOnce(parsed);
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 const p=platform();
 render(<NativePdfReader doc={doc} bytes={bytes} platform={p}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('PDF worker unavailable'));
 expect(screen.getByRole('button',{name:'Retry local PDF reading'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Retry local PDF reading'}));
 expect(await screen.findByRole('region',{name:'Original article'})).toBeTruthy();
 expect(vi.mocked(parseLocalPdf)).toHaveBeenCalledTimes(2);
 expect(vi.mocked(parseLocalPdf).mock.calls.every(([id,source])=>id===doc.id&&source===bytes)).toBe(true);
 expect(p.translate).not.toHaveBeenCalled();
 expect(log).toHaveBeenCalled();
});
