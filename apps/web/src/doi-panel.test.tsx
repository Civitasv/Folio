import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {DoiPanel} from './doi-panel';
import type {DoiPlatform} from '@folio/platform';
import {doiUrl,type DoiMetadata} from '@folio/core';
const doi='10.1234/example';
const metadata:DoiMetadata={doi,title:'Example article',creators:['Alice'],publisher:'Publisher',year:2024,
 source:'Crossref',landingUrl:doiUrl(doi),oa:{source:'OpenAlex',pdfUrl:'https://oa.example.org/p.pdf',
 landingUrl:'https://oa.example.org/page',license:'cc-by'}};
const ref={id:'doi:'+doi,title:metadata.title,creators:metadata.creators,kind:'reference' as const,doi,progress:0};
const pdf={id:'sha256:pdf',title:'Example article',progress:1};
function fixture(){
 const platform:DoiPlatform={
  resolveDoi:vi.fn(async()=>metadata),saveReference:vi.fn(async()=>ref),
  readReference:vi.fn(async()=>({metadata,linkedDocumentId:undefined})),
  importOpenPdf:vi.fn(async()=>pdf)
 };
 return {platform,onSaved:vi.fn(async()=>{}),onImported:vi.fn(async()=>{})};
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
it('stays offline until Resolve, shows verified sources and saves a reference',async()=>{
 const f=fixture();render(<DoiPanel {...f}/>);
 expect(f.platform.resolveDoi).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:'bad'}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 expect(screen.getByRole('alert')).toHaveProperty('textContent','Invalid DOI.');
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 expect(await screen.findByText('Example article')).toBeTruthy();
 expect(screen.getByText(/Crossref/)).toBeTruthy();
 expect(screen.getByRole('link',{name:'Open DOI / publisher page'}).getAttribute('href')).toBe(doiUrl(doi));
 expect(screen.getByRole('link',{name:'Open reported OA PDF'}).getAttribute('rel')).toBe('noopener noreferrer');
 expect(screen.getByText(/Reported license: cc-by/)).toBeTruthy();
 fireEvent.click(screen.getByText('Save metadata-only reference'));
 await waitFor(()=>expect(f.onSaved).toHaveBeenCalledWith(ref));
 expect(await screen.findByText('Reference saved locally.')).toBeTruthy();
});
it('supports explicit verified OA import and reports failures without fabricating success',async()=>{
 const f=fixture();render(<DoiPanel {...f}/>);
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 await screen.findByText('Example article');
 fireEvent.click(screen.getByText('Import open-access PDF'));
 await waitFor(()=>expect(f.onImported).toHaveBeenCalledWith(pdf));
 expect(f.platform.importOpenPdf).toHaveBeenCalledWith(ref.id,expect.any(AbortSignal));
 expect(await screen.findByText('Open-access PDF imported locally.')).toBeTruthy();
 expect(screen.getByText(/Imported PDF: sha256:pdf/)).toBeTruthy();
 vi.mocked(f.platform.importOpenPdf).mockRejectedValueOnce(Error('CORS'));
 fireEvent.click(screen.getByText('Import open-access PDF'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('CORS'));
});
it('saves unverified metadata after failed lookup and lets users retry',async()=>{
 const f=fixture();
 vi.mocked(f.platform.resolveDoi).mockRejectedValueOnce(Error('offline'));
 render(<DoiPanel {...f}/>);
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Retry'));
 fireEvent.click(screen.getByText('Save DOI only (unverified)'));
 await waitFor(()=>expect(f.platform.saveReference).toHaveBeenCalledWith(expect.objectContaining({source:'Unresolved',title:doi})));
 fireEvent.click(screen.getByText('Resolve DOI'));
 expect(await screen.findByText('Example article')).toBeTruthy();
});
it('reopens saved references without network and displays no-OA state',async()=>{
 const f=fixture();
 vi.mocked(f.platform.readReference).mockResolvedValueOnce({metadata:{...metadata,oa:undefined},linkedDocumentId:'sha256:linked'});
 render(<DoiPanel {...f} referenceId={ref.id}/>);
 expect(await screen.findByText('Example article')).toBeTruthy();
 expect(screen.getByText(/No verified open-access/)).toBeTruthy();
 expect(screen.getByText('Imported PDF: sha256:linked')).toBeTruthy();
 expect(f.platform.resolveDoi).not.toHaveBeenCalled();
 expect(screen.queryByText('Resolve DOI')).toBeNull();
});
it('reports local read and save failures, and invalid fallback identifiers',async()=>{
 const f=fixture();
 vi.mocked(f.platform.readReference).mockRejectedValueOnce(Error('storage'));
 const view=render(<DoiPanel {...f} referenceId={ref.id}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to load local DOI reference.');
 view.unmount();
 vi.mocked(f.platform.resolveDoi).mockRejectedValueOnce(Error('offline'));
 render(<DoiPanel {...f}/>);
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 await screen.findByText('Save DOI only (unverified)');
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:'bad'}});
 fireEvent.click(screen.getByText('Save DOI only (unverified)'));
 expect(screen.getByRole('alert')).toHaveProperty('textContent','Invalid DOI.');
 vi.mocked(f.platform.saveReference).mockRejectedValueOnce(Error('quota'));
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 await screen.findByText('Example article');
 fireEvent.click(screen.getByText('Save metadata-only reference'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to save local reference.');
});
it('supports cancellation and ignores results arriving after abort',async()=>{
 const f=fixture();
 vi.mocked(f.platform.resolveDoi).mockImplementationOnce((_input,signal)=>new Promise((_resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(Error('cancelled')));
 }));
 render(<DoiPanel {...f}/>);
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 fireEvent.click(screen.getByText('Cancel request'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','DOI lookup cancelled or timed out.');
});
it('handles offline PDF and abandoned reference read after unmount',async()=>{
 const f=fixture();
 vi.mocked(f.platform.importOpenPdf).mockRejectedValueOnce(Error('offline'));
 render(<DoiPanel {...f}/>);
 fireEvent.change(screen.getByLabelText('DOI'),{target:{value:doi}});
 fireEvent.click(screen.getByText('Resolve DOI'));
 await screen.findByText('Example article');
 fireEvent.click(screen.getByText('Import open-access PDF'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('PDF import failed'));
 cleanup();
 let finish!:(x:{metadata:DoiMetadata})=>void;
 vi.mocked(f.platform.readReference).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const last=render(<DoiPanel {...f} referenceId={ref.id}/>);
 last.unmount();finish({metadata});
});
