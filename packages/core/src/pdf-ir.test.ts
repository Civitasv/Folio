import {expect,it} from 'vitest';
import {buildPdfIR,readingPairs,boundedReadingIR,MAX_TRANSLATION_UNIT_CHARS,type PdfPageInput,type PdfTextSpan} from './pdf-ir';
const span=(text:string,x:number,y:number,width=.38,fontSize=.02):PdfTextSpan=>({text,fontSize,rect:{x,y,width,height:.02}});
const page=(n:number,spans:PdfTextSpan[]):PdfPageInput=>({page:n,width:600,height:800,spans});
it('keeps immutable source blocks and joins only nearby paragraph lines',()=>{
 const input=page(1,[span('A long introduction',.1,.22),span('that continues',.1,.245),span('Methods',.1,.39,.25,.04),span('New paragraph',.1,.47)]);
 const ir=buildPdfIR('sha256:a',[input]);
 expect(ir.version).toBe(1);expect(ir.documentId).toBe('sha256:a');
 expect(ir.pages).toBe(1);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['paragraph','heading','paragraph']);
 expect(ir.warnings).toContain('Conservative reflow: only verified scientific regions are shown as original-page assets. Unidentified table grids, vectors and equations still require original-page fidelity review.');
 expect(ir.blocks[0].text).toBe('A long introduction that continues');
 expect(ir.blocks.map(b=>b.id)).toEqual(['p1-b1','p1-b2','p1-b3']);
 expect(ir.blocks[1].confidence).toBe(.65);
 const pairs=readingPairs(ir,new Map([[ir.blocks[0].id,'这是第一段'],[ir.blocks[1].id,'   ']]));
 expect(pairs.map(p=>p.status)).toEqual(['ready','missing','missing']);
 expect(pairs[0].target).toBe('这是第一段');
 expect(pairs[1].target).toBeUndefined();
 expect(ir.blocks[0].text).toBe(input.spans[0].text+' '+input.spans[1].text);
});
it('orders a double-column page by reading lane and preserves wider title and caption',()=>{
 const spans=[
  span('Study of Drylands',.08,.02,.83,.047),
  span('R1',.56,.20,.33),span('L1',.08,.20,.33),
  span('R2',.56,.32,.33),span('L2',.08,.32,.33),
  span('R3',.56,.44,.33),span('L3',.08,.44,.33),
  span('Fig. 1: Full original graph remains auditable',.08,.7,.78,.018),
  span('1',.94,.97,.02)
 ];
 const ir=buildPdfIR('doc',[page(1,spans)]);
 expect(ir.blocks[0].kind).toBe('title');
 expect(ir.blocks.map(x=>x.text)).toEqual(['Study of Drylands','L1','L2','L3','R1','R2','R3','Fig. 1: Full original graph remains auditable']);
 expect(ir.blocks.at(-1)?.kind).toBe('caption');
 expect(ir.warnings.some(x=>x.includes('Conservative reflow'))).toBe(true);
});
it('reports missing pages, invalid rectangles, empty inputs and nonempty cross-page order',()=>{
 const invalid=span('bad',-1,0);
 const tooFar=span('bad2',.8,.1,.4);
 const nan={...span('bad3',.1,.2),fontSize:NaN};
 const empty=buildPdfIR('id',[]);
 expect(empty.pages).toBe(0);expect(empty.blocks).toHaveLength(0);
 const ir=buildPdfIR('id',[page(1,[invalid,tooFar,nan]),page(2,[span('The second page',.12,.24)])]);
 expect(ir.warnings.some(x=>x.includes('invalid source geometry'))).toBe(true);
 expect(ir.warnings.some(x=>x.includes('no selectable text'))).toBe(true);
 expect(ir.blocks[0].page).toBe(2);expect(ir.pages).toBe(2);
});
it('retains overlapping and hyphenated source without discarding a block',()=>{
 const ir=buildPdfIR('d',[page(1,[span('geo-',.1,.1),span('graphy',.1,.123),span('2 Notes',.1,.3,.22,.025)])]);
 expect(ir.blocks.length).toBeGreaterThan(0);
 expect(ir.blocks[0].text).toMatch(/geo/);
});


it('joins close adjacent fragments within one PDF text line in source order',()=>{
 const ir=buildPdfIR('same-line',[page(1,[span('Hello',.1,.2,.12),span('world',.23,.2,.12)])]);
 expect(ir.blocks).toHaveLength(1);
 expect(ir.blocks[0].text).toBe('Hello world');
 expect(ir.blocks[0].rect.width).toBeCloseTo(.25);
});


it('recognizes references as a section heading and treats whitespace-only pages as unextractable',()=>{
 const ir=buildPdfIR('refs',[page(1,[span('References',.1,.1,.35),span('Bibliography item',.1,.3,.3)]),
  page(2,[span('    ',.1,.2)])]);
 expect(ir.blocks[0].kind).toBe('heading');
 expect(ir.blocks[1].text).toBe('Bibliography item');
 expect(ir.warnings).toContain('Page 2: no selectable text. Original page review required.');
});


it('uses a defensive font median when embedded PDF metrics are zero',()=>{
 const ir=buildPdfIR('zero-font',[page(1,[span('Text with unavailable font size',.1,.2,.4,0)])]);
 expect(ir.blocks).toHaveLength(1);
 expect(ir.blocks[0].kind).toBe('paragraph');
});

it('associates the supplied-paper-style Figure captions with source media, but never mislabels a publisher logo',()=>{
 const p1={...page(1,[span('Title',.1,.2,.5,.04)]),images:[{x:.63,y:.043,width:.31,height:.066}]};
 const p2={...page(2,[span('Figure 1. Clinical panels',.06,.436,.7),span('Figure 2. Four clinical panels',.06,.652,.8)]),
  images:[{x:.188,y:.460,width:.625,height:.181},{x:.244,y:.708,width:.513,height:.238}]};
 const ir=buildPdfIR('fixture',[p1,p2]);
 expect(ir.blocks.filter(b=>b.kind==='figure')).toHaveLength(2);
 expect(ir.blocks.filter(b=>b.kind==='figure').map(b=>b.id)).toEqual(['p2-figure-1','p2-figure-2']);
 const figure=ir.blocks.find(b=>b.id==='p2-figure-1')!;
 expect(figure.mediaRect).toEqual(p2.images[0]);
 expect(ir.blocks.indexOf(figure)).toBeLessThan(ir.blocks.findIndex(b=>b.text.startsWith('Figure 1.')));
 expect(ir.blocks.some(b=>b.kind==='figure'&&b.page===1)).toBe(false);
 expect(ir.warnings.some(w=>w.includes('Page 1: 1 unpaired'))).toBe(false);
 expect(readingPairs(ir,new Map()).find(p=>p.block.id==='p2-figure-1')?.status).toBe('source-only');
});
it('groups adjacent image panels under one figure while preserving caption and table warnings',()=>{
 const p={...page(4,[span('Figure 3. Flowchart',.06,.15,.67),span('Table 1. Data',.06,.55,.45)]),
 images:[{x:.15,y:.18,width:.30,height:.28},{x:.48,y:.18,width:.34,height:.28},{x:.10,y:.70,width:.22,height:.09}]};
 const ir=buildPdfIR('doc',[p]);
 const figure=ir.blocks.find(b=>b.kind==='figure')!;
 expect(figure.mediaRect).toMatchObject({x:.15,y:.18});
 expect(figure.mediaRect!.width).toBeCloseTo(.67);
 expect(ir.warnings.some(w=>w.includes('unpaired embedded image'))).toBe(true);
 expect(ir.warnings.some(w=>w.includes('PDF table grid'))).toBe(true);
});

it('keeps a wrapped three-line Figure 2 caption together as one translatable source block',()=>{
 const p={...page(2,[
  span('Figure 2. Dermatitis herpetiformis lesions on elbows',.06,.652,.88),
  span('due to scratching. c) A close-up view of a small blister.',.06,.669,.88),
  span('pathognomonic granular immunoglobulin A deposits.',.06,.686,.67)
 ]),images:[{x:.244,y:.708,width:.512,height:.237}]};
 const ir=buildPdfIR('scientific',[p]);
 const caption=ir.blocks.find(b=>b.kind==='caption')!;
 expect(caption.text).toContain('due to scratching.');
 expect(caption.text).toContain('pathognomonic granular');
 expect(ir.blocks.filter(b=>b.kind==='figure')).toHaveLength(1);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['figure','caption']);
});

it('uses observed layout regions for table and formula without flattening scientific text into prose',()=>{
 const p={...page(6,[span('Table 7. Duration and type-II DM',.1,.17,.5),
  span('0.001',.12,.32,.1),span('Narrative retains the original claim',.1,.65,.6)]),
  layoutRegions:[
   {label:'table' as const,rect:{x:.1,y:.25,width:.7,height:.25},confidence:.97,order:1},
   {label:'display_formula' as const,rect:{x:.12,y:.54,width:.4,height:.06},confidence:.9,order:2}
  ]};
 const ir=buildPdfIR('science',[p]);
 const table=ir.blocks.find(b=>b.kind==='table')!;
 expect(table.sourceText).toBe('0.001');
 expect(table.text).toBe('');
 expect(table.mediaRect).toEqual(p.layoutRegions[0].rect);
 expect(ir.blocks.some(b=>b.kind==='paragraph'&&b.text.includes('0.001'))).toBe(false);
 expect(ir.blocks.some(b=>b.text.includes('Narrative retains'))).toBe(true);
 expect(ir.blocks.indexOf(table)).toBeGreaterThan(ir.blocks.findIndex(b=>b.text.startsWith('Table 7.')));
 expect(ir.blocks.find(b=>b.kind==='formula')?.mediaRect).toEqual(p.layoutRegions[1].rect);
 expect(readingPairs(ir,new Map([[table.id,'invented numbers']])).find(pair=>pair.block.id===table.id)?.status).toBe('source-only');
 expect(ir.warnings.some(w=>w.includes('PDF table grid'))).toBe(false);
});
it('preserves a visual-only page and keeps fallback bitmap figures from duplicating detected figures',()=>{
 const region={label:'figure' as const,rect:{x:.2,y:.3,width:.6,height:.3},confidence:.95,order:1};
 const p={...page(3,[]),layoutRegions:[region],images:[region.rect]};
 const ir=buildPdfIR('visual',[p]);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['figure']);
 expect(ir.blocks[0].id).toBe('p3-figure-2000-3000-6000-3000');
 expect(ir.warnings.some(w=>w.includes('no selectable prose text'))).toBe(true);
});
it('anchors source-only chart before an adjacent caption below and retains unsupported image fallback',()=>{
 const p={...page(2,[span('Figure 4. Chart captions can follow a panel',.1,.60,.62)]),
 layoutRegions:[{label:'chart' as const,rect:{x:.1,y:.24,width:.63,height:.3},confidence:.94,order:1}],
 images:[{x:.82,y:.65,width:.09,height:.14}]};
 const ir=buildPdfIR('chart',[p]);
 expect(ir.blocks[0].kind).toBe('chart');
 expect(ir.blocks[1].kind).toBe('caption');
 expect(ir.warnings.some(w=>w.includes('unpaired embedded image'))).toBe(true);
 expect(readingPairs(ir,new Map()).map(p=>p.status)).toEqual(['source-only','missing']);
});
it('orders non-captioned scientific assets relative to nearby text and supports prior-page assets',()=>{
 const p={...page(2,[span('Before',.1,.2),span('After',.1,.8)]),
 layoutRegions:[{label:'algorithm' as const,rect:{x:.1,y:.45,width:.55,height:.15},confidence:.88,order:1}]};
 const ir=buildPdfIR('algorithm',[page(1,[span('Earlier page',.1,.2)]),p]);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['paragraph','paragraph','algorithm','paragraph']);
 expect(ir.blocks[2].id).toContain('p2-algorithm');
});

it('does not treat an observed table as a substitute for a separate unpaired image',()=>{
 const observed={label:'table' as const,rect:{x:.1,y:.25,width:.6,height:.25},confidence:.91,order:1};
 const p={...page(4,[span('Table 2. Source values',.1,.19,.46)]),layoutRegions:[observed],
  images:[{x:.7,y:.71,width:.19,height:.12}]};
 const ir=buildPdfIR('two-assets',[p]);
 expect(ir.blocks.some(b=>b.kind==='table')).toBe(true);
 expect(ir.warnings.some(w=>w.includes('unpaired embedded image'))).toBe(true);
});
it('places detected figure before its numbered caption when caption is below the painted region',()=>{
 const r={x:.13,y:.40,width:.7,height:.12};
 const p={...page(4,[span('Figure 5. The exact source panel',.12,.49,.62)]),
  layoutRegions:[{label:'figure' as const,rect:r,confidence:.9,order:1}]};
 const ir=buildPdfIR('caption-below',[p]);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['figure','caption']);
 expect(ir.blocks[0].mediaRect).toEqual(r);
});

it('splits lengthy original excerpts into immutable verified chunks without losing a single source character',()=>{
 const original='A'.repeat(3900)+' '+'B'.repeat(5100);
 const ir=buildPdfIR('long',[page(1,[span(original,.1,.2,.7)])]);
 // Source reflow may group an excerpt; the derived translation plan must never mutate it.
 const originalBlock=ir.blocks[0];
 const derived=boundedReadingIR(ir);
 expect(MAX_TRANSLATION_UNIT_CHARS).toBe(4000);
 expect(derived.blocks.length).toBeGreaterThan(2);
 expect(derived.blocks.map(b=>b.text).join('')).toBe(originalBlock.text);
 expect(derived.blocks.every(b=>b.text.length<=MAX_TRANSLATION_UNIT_CHARS)).toBe(true);
 expect(derived.blocks.map(b=>b.id)).toEqual(derived.blocks.map((_,i)=>originalBlock.id+'-chunk'+i));
 expect(derived.blocks.map(b=>b.chunkIndex)).toEqual(derived.blocks.map((_,i)=>i));
 expect(derived.blocks.every(b=>b.parentId===originalBlock.id&&b.page===originalBlock.page&&b.rect===originalBlock.rect)).toBe(true);
 expect(originalBlock.text).toBe(original);
 expect(originalBlock.chunkIndex).toBeUndefined();
 expect(boundedReadingIR(ir).blocks.map(b=>b.text)).toEqual(derived.blocks.map(b=>b.text));
});
it('does not corrupt surrogate pairs when a hard limit cuts a long non-space source',()=>{
 const text='A'+'😀'.repeat(2100);
 const ir={version:1 as const,documentId:'unicode',pages:1,warnings:[],blocks:[
  {id:'p1-b2',kind:'paragraph' as const,page:1,text,rect:{x:.1,y:.1,width:.6,height:.1},confidence:.9}
 ]};
 const chunks=boundedReadingIR(ir).blocks;
 expect(chunks.map(b=>b.text).join('')).toBe(text);
 expect(chunks.every(b=>b.text.length<=4000)).toBe(true);
 expect(chunks[0].text.length).toBe(3999);
 expect(chunks.every(b=>!/[\uD800-\uDBFF]$/.test(b.text)&&! /^[\uDC00-\uDFFF]/.test(b.text))).toBe(true);
});
it('retains legacy exact identity of ordinary source and never chunks visual scientific evidence',()=>{
 const table={id:'p2-table-100-200-300-400',kind:'table' as const,page:2,text:'x'.repeat(5000),
  rect:{x:.1,y:.2,width:.3,height:.4},confidence:.8,mediaRect:{x:.1,y:.2,width:.3,height:.4}};
 const normal={...table,id:'p1-b1',kind:'paragraph' as const,page:1,text:'Short source text',mediaRect:undefined};
 const ir={version:1 as const,documentId:'normal',pages:2,warnings:[],blocks:[normal,table]};
 const derived=boundedReadingIR(ir);
 expect(derived.blocks).toHaveLength(2);
 expect(derived.blocks[0]).toBe(normal);
 expect(derived.blocks[1]).toBe(table);
 expect(ir.blocks).toEqual([normal,table]);
});
