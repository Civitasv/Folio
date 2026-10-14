import React from 'react';
import { afterEach, expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { EpubReader } from './epub-reader';
import type { EpubReaderPlatform, SavedEpub } from '@folio/platform';

const doc={id:'epub:1',title:'Book',kind:'epub' as const,progress:1};
const saved:SavedEpub={
 book:{
  metadata:{title:'Book',creators:['Alice'],spine:[{id:'1',href:'one'},{id:'2',href:'two'}],
    toc:[{label:'First',href:'one',children:[{label:'Second',href:'two',children:[]}]},{label:'Unavailable',href:'',children:[]}]},
  chapters:[{id:'1',href:'one',html:'<p>First chapter</p>'},{id:'2',href:'two',html:'<p>Second chapter</p>'}]
 },
 anchor:{kind:'epub',spineIndex:0,cfi:'epubcfi(/6/2)'},preferences:{fontSize:18,theme:'light'}
};
function fixture(){
 let state:SavedEpub=structuredClone(saved);
 const platform:EpubReaderPlatform={
  importEpub:vi.fn(async()=>doc),readEpub:vi.fn(async()=>structuredClone(state)),
  setEpubLocation:vi.fn(async (_id,anchor)=>{state={...state,anchor};}),
  setEpubPreferences:vi.fn(async (_id,preferences)=>{state={...state,preferences};})
 };
 return {platform,refresh:vi.fn(async()=>{}),state:()=>state};
}
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('renders a sandboxed reflowable chapter and persists TOC navigation, font and theme',async()=>{
 const f=fixture();
 render(<EpubReader doc={doc} platform={f.platform} onRefresh={f.refresh}/>);
 expect(screen.getByText('Loading EPUB…')).toBeTruthy();
 const frame=await screen.findByTitle('EPUB chapter');
 expect(frame.getAttribute('sandbox')).toBe('');
 expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
 expect(frame.getAttribute('srcdoc')).toContain("default-src &#39;none&#39;");
 expect(frame.getAttribute('srcdoc')).toContain('First chapter');
 fireEvent.click(screen.getByText('Next chapter'));
 await waitFor(()=>expect(f.platform.setEpubLocation).toHaveBeenCalledWith(doc.id,{kind:'epub',spineIndex:1,cfi:'epubcfi(/6/4)'}));
 expect(await screen.findByText('Chapter 2 of 2')).toBeTruthy();
 expect(f.refresh).toHaveBeenCalled();
 fireEvent.click(screen.getByText('Previous chapter'));
 await waitFor(()=>expect(f.platform.setEpubLocation).toHaveBeenCalledTimes(2));
 fireEvent.change(screen.getByLabelText('EPUB font size'),{target:{value:'20'}});
 await waitFor(()=>expect(f.platform.setEpubPreferences).toHaveBeenCalledWith(doc.id,{fontSize:20,theme:'light'}));
 fireEvent.change(screen.getByLabelText('EPUB theme'),{target:{value:'sepia'}});
 await waitFor(()=>expect(f.platform.setEpubPreferences).toHaveBeenCalledWith(doc.id,{fontSize:20,theme:'sepia'}));
 expect(screen.getByTitle('EPUB chapter').getAttribute('srcdoc')).toContain('#f6efe0');
 fireEvent.click(screen.getByText('Table of contents'));
 fireEvent.click(screen.getByText('Second'));
 await waitFor(()=>expect(f.platform.setEpubLocation).toHaveBeenLastCalledWith(doc.id,{kind:'epub',spineIndex:1,cfi:'epubcfi(/6/4)'}));
 expect(screen.getByText('Unavailable')).toBeTruthy();
});
it('handles load, position and appearance errors without silently losing the book',async()=>{
 const f=fixture();
 vi.mocked(f.platform.readEpub).mockRejectedValueOnce(Error('bad'));
 const v=render(<EpubReader doc={doc} platform={f.platform} onRefresh={f.refresh}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to open EPUB.');
 v.unmount();
 vi.mocked(f.platform.setEpubLocation).mockRejectedValueOnce(Error('disk'));
 vi.mocked(f.platform.setEpubPreferences).mockRejectedValueOnce(Error('disk'));
 render(<EpubReader doc={doc} platform={f.platform} onRefresh={f.refresh}/>);
 await screen.findByTitle('EPUB chapter');
 fireEvent.click(screen.getByText('Next chapter'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to save EPUB reading position.');
 fireEvent.change(screen.getByLabelText('EPUB theme'),{target:{value:'dark'}});
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to save reader appearance.');
});
it('fallback metadata and TOC and ignores an unmounted asynchronous load',async()=>{
 const f=fixture();
 const without={...saved,book:{metadata:{...saved.book.metadata,title:undefined,creators:[],toc:[]},chapters:saved.book.chapters}};
 vi.mocked(f.platform.readEpub).mockResolvedValue(without);
 const view=render(<EpubReader doc={doc} platform={f.platform} onRefresh={f.refresh}/>);
 await screen.findByTitle('EPUB chapter');
 expect(screen.getByText('Chapter 1')).toBeTruthy();
 expect(screen.getByText('Book')).toBeTruthy();
 view.unmount();
 let finish!:(value:SavedEpub)=>void;
 vi.mocked(f.platform.readEpub).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const late=render(<EpubReader doc={doc} platform={f.platform} onRefresh={f.refresh}/>);
 late.unmount();finish(saved);
});
