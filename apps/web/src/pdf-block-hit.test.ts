import {expect,it} from 'vitest';
import {pickPdfBlockAtPoint} from './pdf-block-hit';
import type {PdfBlock} from '@folio/core';
const block=(id:string,page:number,x:number,y:number,w=.4,h=.08,confidence=.8):PdfBlock=>
 ({id,page,kind:'paragraph',text:id,rect:{x,y,width:w,height:h},confidence});
it('hits exact normalized original geometry on the correct source page',()=>{
 const blocks=[block('left',1,.08,.2),block('right',1,.55,.2,.35),block('next',2,.08,.2)];
 expect(pickPdfBlockAtPoint(blocks,1,.2,.23)?.id).toBe('left');
 expect(pickPdfBlockAtPoint(blocks,1,.7,.23)?.id).toBe('right');
 expect(pickPdfBlockAtPoint(blocks,2,.2,.23)?.id).toBe('next');
 expect(pickPdfBlockAtPoint(blocks,1,.4,.8)).toBeUndefined();
});
it('prefers exact and smallest overlapping scientific region with stable ties',()=>{
 const big=block('figure',3,.1,.1,.8,.7);
 const small=block('caption',3,.15,.25,.3,.06);
 expect(pickPdfBlockAtPoint([big,small],3,.2,.27)?.id).toBe('caption');
 expect(pickPdfBlockAtPoint([small,big],3,.85,.5)?.id).toBe('figure');
 const near=block('near',3,.02,.02,.1,.03);
 expect(pickPdfBlockAtPoint([near,big],3,.018,.025)?.id).toBe('near');
 const tie=block('a',3,.15,.25,.3,.06,.95);
 expect(pickPdfBlockAtPoint([small,tie],3,.2,.27)?.id).toBe('a');
 expect(pickPdfBlockAtPoint([{...tie,confidence:.8},small],3,.2,.27)?.id).toBe('a');
});
it('rejects invalid pointer positions, pages, geometry and unrelated fallback hits',()=>{
 const good=block('valid',1,.1,.2);
 const bad={...good,id:'invalid',rect:{x:NaN,y:.2,width:.3,height:.05}};
 for(const [page,x,y] of [[0,.2,.21],[1,NaN,.21],[1,.2,Infinity],[1,-.1,.21],[1,1.1,.21],[1,.2,-.1],[1,.2,1.1],[1.5,.2,.21]]){
  expect(pickPdfBlockAtPoint([good],page,x,y)).toBeUndefined();
 }
 expect(pickPdfBlockAtPoint([{...bad},good],1,.2,.22)?.id).toBe('valid');
 expect(pickPdfBlockAtPoint([{...good,rect:{x:.1,y:.2,width:0,height:.1}}],1,.2,.22)).toBeUndefined();
 expect(pickPdfBlockAtPoint([good],1,.2,.6)).toBeUndefined();
});

it('prefers a precise hit over an earlier padded near miss when areas and page overlap',()=>{
 const padded=block('padded',1,.11,.2,.18,.08);
 const exact=block('exact',1,.1,.2,.18,.08);
 expect(pickPdfBlockAtPoint([padded,exact],1,.102,.24)?.id).toBe('exact');
 expect(pickPdfBlockAtPoint([exact,padded],1,.102,.24)?.id).toBe('exact');
});
