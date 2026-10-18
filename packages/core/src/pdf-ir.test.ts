import {expect,it} from 'vitest';
import {buildPdfIR,readingPairs,type PdfPageInput,type PdfTextSpan} from './pdf-ir';
const span=(text:string,x:number,y:number,width=.38,fontSize=.02):PdfTextSpan=>({text,fontSize,rect:{x,y,width,height:.02}});
const page=(n:number,spans:PdfTextSpan[]):PdfPageInput=>({page:n,width:600,height:800,spans});
it('keeps immutable source blocks and joins only nearby paragraph lines',()=>{
 const input=page(1,[span('A long introduction',.1,.22),span('that continues',.1,.245),span('Methods',.1,.39,.25,.04),span('New paragraph',.1,.47)]);
 const ir=buildPdfIR('sha256:a',[input]);
 expect(ir.version).toBe(1);expect(ir.documentId).toBe('sha256:a');
 expect(ir.pages).toBe(1);
 expect(ir.blocks.map(b=>b.kind)).toEqual(['paragraph','heading','paragraph']);
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
 expect(ir.warnings.some(x=>x.includes('figure/table visuals'))).toBe(true);
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
