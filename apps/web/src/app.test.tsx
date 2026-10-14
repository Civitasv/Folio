import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './app';
import { MAX_PDF_BYTES, type DocumentSummary, type ReaderPlatform } from '@folio/core';

const valid = new Uint8Array([37,80,68,70,45,49]);
function file(name = 'Paper.pdf', data = valid) {
  const result = new File([Uint8Array.from(data).buffer],name,{type:'application/pdf'});
  Object.defineProperty(result,'arrayBuffer',{configurable:true,value: vi.fn(async () => Uint8Array.from(data).buffer)});
  return result;
}
function fixture(initial: DocumentSummary[] = []) {
  const rows = new Map(initial.map(doc => [doc.id,doc]));
  const platform: ReaderPlatform = {
    listDocuments: vi.fn(async () => [...rows.values()]),
    importPdf: vi.fn(async title => {
      const doc={id:'sha256:a',title:title.replace(/\.pdf$/i,''),progress:1};
      if (!rows.has(doc.id)) rows.set(doc.id,doc);
      return rows.get(doc.id)!;
    }),
    readPdf: vi.fn(async () => valid),
    deletePdf: vi.fn(async id => { rows.delete(id); }),
    setProgress: vi.fn(async (id,page) => { rows.set(id,{...rows.get(id)!,progress:page}); })
  };
  return {platform,rows};
}
function setupUrls() {
  const create=vi.fn(()=>'blob:folio');
  const revoke=vi.fn();
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:revoke}));
  return {create,revoke};
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('renders local library, search, drag-and-drop empty guards and file input empty guard', async () => {
  const {platform}=fixture();
  const {container}=render(<App platform={platform}/>);
  expect(await screen.findByText('Your library is empty. Import a PDF to begin.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search titles'),{target:{value:'none'}});
  expect(screen.getByText('No matching documents.')).toBeTruthy();
  fireEvent.dragOver(screen.getByRole('region',{name:'Import PDF'}));
  fireEvent.drop(screen.getByRole('region',{name:'Import PDF'}),{dataTransfer:{files:[]}});
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[]}});
  expect(container.querySelectorAll('iframe')).toHaveLength(0);
});
it('imports, reopens, filters, saves position, closes and confirms deletion', async () => {
  const {platform}=fixture();
  const urls=setupUrls();
  vi.spyOn(window,'confirm').mockReturnValue(true);
  const {unmount}=render(<App platform={platform}/>);
  await screen.findByText('Your library is empty. Import a PDF to begin.');
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file()]}});
  expect(await screen.findByText('PDF imported locally.')).toBeTruthy();
  expect(await screen.findByTitle('PDF document')).toHaveProperty('src','blob:folio#page=1');
  expect(screen.getByText('Paper')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Saved page'),{target:{value:'3'}});
  fireEvent.click(screen.getByText('Save page'));
  await waitFor(()=>expect(platform.setProgress).toHaveBeenCalledWith('sha256:a',3));
  expect(await screen.findByText('Reading position saved.')).toBeTruthy();
  expect(screen.getByTitle('PDF document')).toHaveProperty('src','blob:folio#page=3');
  fireEvent.change(screen.getByLabelText('Search titles'),{target:{value:'pap'}});
  expect(screen.getByText('Paper')).toBeTruthy();
  fireEvent.click(screen.getByText('Close'));
  await waitFor(()=>expect(urls.revoke).toHaveBeenCalledWith('blob:folio'));
  fireEvent.click(screen.getByText('Paper'));
  expect(await screen.findByTitle('PDF document')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Delete Paper'}));
  await waitFor(()=>expect(screen.getByText('PDF deleted from the local library.')).toBeTruthy());
  expect(screen.queryByTitle('PDF document')).toBeNull();
  unmount();
});
it('handles duplicate import, invalid bytes, oversized file and dragged PDF', async () => {
  const {platform}=fixture([{id:'sha256:a',title:'Paper',progress:4}]);
  setupUrls();
  render(<App platform={platform}/>);
  await screen.findByText('Paper');
  fireEvent.drop(screen.getByRole('region',{name:'Import PDF'}),{dataTransfer:{files:[file()]}});
  expect(await screen.findByText('This PDF is already in your library.')).toBeTruthy();
  const bad=file('bad.pdf',new Uint8Array([1,2,3]));
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[bad]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','PDF import rejected: invalid_signature');
  const large=file();
  Object.defineProperty(large,'size',{value:MAX_PDF_BYTES+1});
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[large]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','PDF import rejected: too_large');
});
it('reports library load, import, reader, save and delete failures', async () => {
  const {platform}=fixture([{id:'other',title:'Other',progress:1}]);
  setupUrls();
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.spyOn(platform,'listDocuments').mockRejectedValueOnce(new Error('quota'));
  vi.spyOn(platform,'readPdf').mockRejectedValue(new Error('corrupt'));
  vi.spyOn(platform,'setProgress').mockRejectedValue(new Error('quota'));
  vi.spyOn(platform,'deletePdf').mockRejectedValue(new Error('locked'));
  render(<App platform={platform}/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to open the local library.');
  // Import succeeds and supplies a visible document even if initial library load failed.
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file()]}});
  expect(await screen.findByText('PDF imported locally.')).toBeTruthy();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to open this PDF.');
  fireEvent.change(screen.getByLabelText('Saved page'),{target:{value:'0'}});
  fireEvent.click(screen.getByText('Save page'));
  expect(screen.getByRole('alert')).toHaveProperty('textContent','Enter a valid page number (1 or greater).');
  fireEvent.change(screen.getByLabelText('Saved page'),{target:{value:'2'}});
  fireEvent.click(screen.getByText('Save page'));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Could not save reading position.');
  fireEvent.click(screen.getByRole('button',{name:'Delete Paper'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to delete the local document.');
  vi.spyOn(platform,'importPdf').mockRejectedValueOnce(new Error('quota'));
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file('second.pdf')]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','PDF import failed. Check available browser storage.');
});
it('respects delete cancellation and deleting inactive documents', async () => {
  const {platform,rows}=fixture([{id:'other',title:'Other',progress:1},{id:'sha256:a',title:'Paper',progress:1}]);
  setupUrls();
  const confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValue(true);
  render(<App platform={platform}/>);
  await screen.findByText('Other');
  fireEvent.click(screen.getByText('Paper'));
  await screen.findByTitle('PDF document');
  fireEvent.click(screen.getByRole('button',{name:'Delete Other'}));
  expect(rows.has('other')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Delete Other'}));
  await waitFor(()=>expect(rows.has('other')).toBe(false));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(screen.getByTitle('PDF document')).toBeTruthy();
});
it('ignores late library and reader responses after unmount, and surfaces file read failures', async () => {
  let finishList!: (value: DocumentSummary[])=>void;
  const {platform}=fixture();
  vi.spyOn(platform,'listDocuments').mockImplementationOnce(()=>new Promise(resolve=>{finishList=resolve;}));
  const view=render(<App platform={platform}/>);
  view.unmount();
  finishList([]);
  const second=render(<App platform={platform}/>);
  const broken=file();
  Object.defineProperty(broken,'arrayBuffer',{value:vi.fn(async()=>{throw new Error('read failed');})});
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[broken]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','PDF import failed. Check available browser storage.');
  second.unmount();
});
it('ignores a document read that settles after the reader is closed', async () => {
  const {platform}=fixture([{id:'one',title:'One',progress:1}]);
  let finish!: (bytes: Uint8Array)=>void;
  vi.spyOn(platform,'readPdf').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  setupUrls();
  render(<App platform={platform}/>);
  await screen.findByText('One');
  fireEvent.click(screen.getByText('One'));
  expect(screen.getByText('Loading local PDF…')).toBeTruthy();
  fireEvent.click(screen.getByText('Close'));
  finish(valid);
  expect(screen.queryByTitle('PDF document')).toBeNull();
});

it('imports EPUB through the shared picker and keeps PDF behavior intact', async () => {
  const base=fixture();
  const epub={id:'epub:sha256:a',title:'Example Book',progress:1,kind:'epub' as const,creators:['Alice']};
  const platform={...base.platform,
    importEpub:vi.fn(async()=>{base.rows.set(epub.id,epub);return epub;}),
    readEpub:vi.fn(async()=>({book:{metadata:{title:'Example Book',creators:['Alice'],spine:[{id:'a',href:'one'}],toc:[]},chapters:[{id:'a',href:'one',html:'<p>Hi</p>'}]},anchor:{kind:'epub' as const,spineIndex:0,cfi:'epubcfi(/6/2)'},preferences:{fontSize:18,theme:'light' as const}})),
    setEpubLocation:vi.fn(async()=>{}),setEpubPreferences:vi.fn(async()=>{})
  };
  setupUrls();vi.spyOn(window,'confirm').mockReturnValue(true);
  render(<App platform={platform}/>);
  await screen.findByText('Your library is empty. Import a PDF to begin.');
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file('Example.epub')]}});
  expect(await screen.findByText('EPUB imported locally.')).toBeTruthy();
  expect(await screen.findByTitle('EPUB chapter')).toBeTruthy();
  expect(screen.queryByTitle('PDF document')).toBeNull();
  fireEvent.change(screen.getByLabelText('Search titles'),{target:{value:'Alice'}});
  expect(screen.getByRole('button',{name:'Example Book'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Delete Example Book'}));
  expect(await screen.findByText('EPUB deleted from the local library.')).toBeTruthy();
});
it('reports unsupported EPUB platform and EPUB import failures',async()=>{
  const {platform}=fixture();render(<App platform={platform}/>);
  await screen.findByText('Your library is empty. Import a PDF to begin.');
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file('Book.epub')]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','EPUB import is unavailable on this platform.');
  const x={...platform,importEpub:vi.fn(async()=>{throw Error('bad EPUB');})};
  cleanup();render(<App platform={x}/>);
  fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file('Book.epub')]}});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','EPUB import failed. The file may be invalid, unsupported or exceed local storage.');
});

it('rejects oversized EPUB before reading and recognizes an existing import',async()=>{
 const base=fixture([{id:'epub:sha256:a',title:'Example',progress:2,kind:'epub',creators:['Alice']}]);
 const x={...base.platform,importEpub:vi.fn(async()=>base.rows.get('epub:sha256:a')!)};
 render(<App platform={x}/>);
 await screen.findByRole('button',{name:'Example'});
 const large=file('large.epub');
 Object.defineProperty(large,'size',{value:MAX_PDF_BYTES+1});
 fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[large]}});
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','EPUB import rejected: too_large');
 fireEvent.change(screen.getByLabelText('Import PDF file'),{target:{files:[file('Example.epub')]}});
 expect(await screen.findByText('This EPUB is already in your library.')).toBeTruthy();
 expect(x.importEpub).toHaveBeenCalledTimes(1);
});

it('supports actual drag/drop import and refreshes chapter progress through the parent library',async()=>{
 const base=fixture();
 const doc={id:'epub:sha256:d',title:'Dropped',progress:1,kind:'epub' as const,creators:['Author']};
 const state={...doc};
 const platform={...base.platform,
  importEpub:vi.fn(async()=>{base.rows.set(doc.id,{...state});return {...state};}),
  readEpub:vi.fn(async()=>({book:{metadata:{title:'Dropped',creators:['Author'],spine:[{id:'one',href:'one'},{id:'two',href:'two'}],toc:[]},
   chapters:[{id:'one',href:'one',html:'<p>one</p>'},{id:'two',href:'two',html:'<p>two</p>'}]},
   anchor:{kind:'epub' as const,spineIndex:state.progress-1,cfi:'epubcfi(/6/2)'},preferences:{fontSize:18,theme:'light' as const}})),
  setEpubLocation:vi.fn(async(_id:string,loc:{spineIndex:number})=>{state.progress=loc.spineIndex+1;base.rows.set(doc.id,{...state});}),
  setEpubPreferences:vi.fn(async()=>{})
 };
 render(<App platform={platform}/>);
 await screen.findByText('Your library is empty. Import a PDF to begin.');
 fireEvent.drop(screen.getByRole('region',{name:'Import PDF'}),{dataTransfer:{files:[file('Dropped.epub')]}});
 expect(await screen.findByText('EPUB imported locally.')).toBeTruthy();
 expect(await screen.findByTitle('EPUB chapter')).toBeTruthy();
 fireEvent.click(screen.getByText('Next chapter'));
 await waitFor(()=>expect(base.rows.get(doc.id)?.progress).toBe(2));
 expect(screen.getByText(/EPUB chapter 2/)).toBeTruthy();
});

it('closes and reopens an EPUB without invoking the PDF viewer',async()=>{
 const base=fixture([{id:'epub:sha256:b',title:'Ebook',progress:1,kind:'epub',creators:['A']}]);
 const platform={...base.platform,
   readEpub:vi.fn(async()=>({book:{metadata:{title:'Ebook',creators:['A'],spine:[{id:'one',href:'one'}],toc:[]},
     chapters:[{id:'one',href:'one',html:'<p>Hello</p>'}]},anchor:{kind:'epub' as const,spineIndex:0,cfi:'epubcfi(/6/2)'},
     preferences:{fontSize:18,theme:'light' as const}})),
   importEpub:vi.fn(async()=>base.rows.get('epub:sha256:b')!),
   setEpubLocation:vi.fn(async()=>{}),setEpubPreferences:vi.fn(async()=>{})
 };
 render(<App platform={platform}/>);
 await screen.findByRole('button',{name:'Ebook'});
 fireEvent.click(screen.getByRole('button',{name:'Ebook'}));
 expect(await screen.findByTitle('EPUB chapter')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));
 expect(screen.queryByTitle('EPUB chapter')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Ebook'}));
 expect(await screen.findByTitle('EPUB chapter')).toBeTruthy();
 expect(platform.readPdf).not.toHaveBeenCalled();
});

it('adds DOI acquisition without a request on boot; saves, searches, opens and deletes a reference',async()=>{
 const base=fixture(),doi='10.1234/example';
 const metadata={doi,title:'DOI Work',creators:['Alice'],landingUrl:'https://doi.org/'+doi,source:'Crossref' as const};
 const reference={id:'doi:'+doi,doi,title:'DOI Work',progress:0,kind:'reference' as const,creators:['Alice']};
 const platform={...base.platform,
  resolveDoi:vi.fn(async()=>metadata),saveReference:vi.fn(async()=>{base.rows.set(reference.id,reference);return reference;}),
  readReference:vi.fn(async()=>({metadata})),importOpenPdf:vi.fn(async()=>{throw Error('no OA');})
 };
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const view=render(<App platform={platform}/>);
 await screen.findByText('Your library is empty. Import a PDF to begin.');
 expect(platform.resolveDoi).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 expect(await screen.findByText('DOI Work')).toBeTruthy();
 fireEvent.click(screen.getByText('Save metadata-only reference'));
 await waitFor(()=>expect(screen.getByRole('button',{name:'DOI Work'})).toBeTruthy());
 fireEvent.change(screen.getByLabelText('Search titles'),{target:{value:doi}});
 expect(screen.getByRole('button',{name:'DOI Work'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'DOI Work'}));
 expect(await screen.findByText('Saved DOI reference')).toBeTruthy();
 expect(platform.readPdf).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Close reference'));
 await screen.findByText('Find by DOI');
 fireEvent.click(screen.getByRole('button',{name:'Delete DOI Work'}));
 expect(await screen.findByText('DOI reference deleted from the local library.')).toBeTruthy();
 view.unmount();
});
