import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {DEFAULT_LANGUAGE_PREFERENCES,type PdfDocumentIR,type DocumentSummary,type TranslationProvider} from '@folio/core';
import {parseLocalPdf} from './pdf-extract';
import {NativePdfReader,sourceIdentity} from './native-pdf-reader';
vi.mock('./pdf-extract',()=>({parseLocalPdf:vi.fn()}));
const doc:DocumentSummary={id:'sha256:a',title:'Paper',progress:1};
const bytes=new Uint8Array([37,80,68,70]);
const blocks=[
 {id:'p1-b1',kind:'title' as const,page:1,text:'Drought Research',confidence:1,rect:{x:.1,y:.1,width:.6,height:.04}},
 {id:'p1-b2',kind:'paragraph' as const,page:1,text:'Source paragraph.',confidence:1,rect:{x:.1,y:.2,width:.6,height:.05}},
 {id:'p2-b1',kind:'caption' as const,page:2,text:'Figure 1: Original evidence.',confidence:1,rect:{x:.1,y:.2,width:.6,height:.05}}
];
const ir:PdfDocumentIR={version:1,documentId:doc.id,pages:2,blocks,warnings:[]};
const destroy=vi.fn(async()=>{}),pageImage=vi.fn(async()=> 'data:image/png;base64,AA==');
const parsed={ir,destroy,pageImage};
const langs={...DEFAULT_LANGUAGE_PREFERENCES,source:'en',target:'zh-Hans'};
function platform(){
 return {getLanguages:vi.fn(async()=>langs),setLanguages:vi.fn(async p=>p),
 findTranslation:vi.fn(async identity=>identity.unit.text==='Source paragraph.'?{
  key:'x',identity,sourceHash:'hash',translatedText:'译文段落。',provenance:'manual' as const
 }:undefined),
 saveManualTranslation:vi.fn(async(identity,text)=>({key:'manual',identity,sourceHash:'hash',translatedText:text,provenance:'manual' as const})),
 translate:vi.fn(async(identity)=>({key:'provider',identity,sourceHash:'hash',translatedText:'模型译文。',provenance:'provider' as const}))};
}
beforeEach(()=>{vi.mocked(parseLocalPdf).mockReset();vi.mocked(parseLocalPdf).mockResolvedValue(parsed);destroy.mockClear();pageImage.mockClear();});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
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
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Cannot rebuild this PDF. The original file remains safely stored.');
});
