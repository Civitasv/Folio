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
  expect(screen.getByText('No matching PDFs.')).toBeTruthy();
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
  expect(await screen.findByTitle('PDF document')).toHaveProperty('src','blob:folio/#page=1');
  expect(screen.getByText('Paper')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Saved page'),{target:{value:'3'}});
  fireEvent.click(screen.getByText('Save page'));
  await waitFor(()=>expect(platform.setProgress).toHaveBeenCalledWith('sha256:a',3));
  expect(await screen.findByText('Reading position saved.')).toBeTruthy();
  expect(screen.getByTitle('PDF document')).toHaveProperty('src','blob:folio/#page=3');
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
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to delete the local PDF.');
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
