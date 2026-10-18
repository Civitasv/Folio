import {expect,it} from 'vitest';
import {scientificRegions,sourceMediaKind,belongsToScientificRegion,scientificAssetId,type LayoutObservation} from './pdf-layout';
import type {PdfTextSpan} from './pdf-ir';
const rect=(x:number,y:number,width=.3,height=.2)=>({x,y,width,height});
const observation=(label:LayoutObservation['label'],x:number,y:number,confidence=.95,order=2):LayoutObservation=>
 ({label,rect:rect(x,y),confidence,order});
const span=(text:string,x:number,y:number,width=.1,height=.02):PdfTextSpan=>
 ({text,fontSize:.02,rect:rect(x,y,width,height)});
it('preserves observed scientific classes, model order and immutable source-span text for audit only',()=>{
 const observations=[
  observation('table',.1,.5,.95,3),observation('figure',.1,.1,.9,1),
  observation('chart',.55,.1,.95,2),observation('display_formula',.1,.78,.92,4),
  observation('algorithm',.55,.78,.9,5),observation('header_image',.6,.02),
  observation('footer_image',.6,.93)
 ];
 const source=[span('12.0',.12,.52),span('Figure',.12,.13),span('outside',.9,.9)];
 const regions=scientificRegions(observations,source);
 expect(regions.map(x=>x.kind)).toEqual(['figure','chart','table','formula','algorithm']);
 expect(regions.find(x=>x.kind==='table')?.sourceText).toBe('12.0');
 expect(regions[0].rect).not.toBe(observations[1].rect);
 expect(regions[0].sourceText).toBe('Figure');
 expect(regions[1].sourceText).toBe('');
 expect(sourceMediaKind('figure')).toBe(true);
 expect(sourceMediaKind('chart')).toBe(true);
 expect(sourceMediaKind('table')).toBe(true);
 expect(sourceMediaKind('formula')).toBe(true);
 expect(sourceMediaKind('algorithm')).toBe(true);
 expect(sourceMediaKind('paragraph')).toBe(false);
});
it('filters invalid geometry/score/order and suppresses duplicate same-class regions by IoU',()=>{
 const input=[
  observation('figure',.1,.1,.95,3),observation('figure',.1,.1,.65,4),
  observation('table',.1,.1,.72,5),observation('header_image',.2,.1),
  {...observation('table',-.1,.1),order:2},
  {...observation('table',.1,.1),rect:rect(.9,.9)},
  {...observation('table',.1,.1),rect:rect(.2,.2,0,.1)},
  {...observation('table',.1,.1),rect:rect(.2,.2,.1,NaN)},
  {...observation('table',.1,.1),confidence:NaN},
  {...observation('table',.1,.1),confidence:.49},
  {...observation('table',.1,.1),order:Infinity}
 ];
 const result=scientificRegions(input,[]);
 expect(result.map(x=>x.kind)).toEqual(['figure','table']);
 expect(result[0].confidence).toBe(.95);
});
it('discards an effectively identical cross-class overlap but preserves distinct page regions',()=>{
 const input=[observation('figure',.2,.2,.99,2),observation('table',.2,.2,.7,1),observation('table',.6,.4,.8,3)];
 expect(scientificRegions(input,[]).map(x=>x.kind)).toEqual(['figure','table']);
});
it('keeps source text/search identity only for spans genuinely inside the entire visual region',()=>{
 const region=scientificRegions([observation('table',.1,.1)],[
  span('left',.12,.12),span('right',.35,.12),span('part',.37,.15),
  {...span('invalid',.2,.12),rect:rect(NaN,.12)},
  span('outside',.8,.15)
 ]);
 expect(region[0].sourceText).toBe('left');
 expect(belongsToScientificRegion(span('12',.12,.12),region)).toBe(true);
 expect(belongsToScientificRegion(span('edge',.35,.12),region)).toBe(false);
 expect(belongsToScientificRegion(span('invalid',NaN,.12),region)).toBe(false);
 expect(belongsToScientificRegion(span('outside',.9,.12),[])).toBe(false);
 expect(scientificAssetId(4,region[0])).toBe('p4-table-1000-1000-3000-2000');
 expect(scientificAssetId(4,region[0])).toBe(scientificAssetId(4,{...region[0],sourceText:'modified index string'}));
});
it('breaks ties using physical y and x order without modifying supplied observations',()=>{
 const input=[observation('figure',.7,.3,.7,1),observation('chart',.1,.3,.7,1),observation('table',.1,.2,.7,1)];
 expect(scientificRegions(input,[]).map(x=>x.kind)).toEqual(['table','chart','figure']);
 expect(input[0].label).toBe('figure');
});
