import {expect,it} from 'vitest';
import {createConservativeGridRecognizer,findSourceTableGrids} from './pdf-grid-detector';
const pixels=(w=240,h=180)=>{
 const data=new Uint8ClampedArray(w*h*4);data.fill(255);
 const ink=(x:number,y:number)=>{const p=(y*w+x)*4;data[p]=0;data[p+1]=0;data[p+2]=0;};
 const line=(x0:number,y0:number,x1:number,y1:number)=>{
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)ink(x,y);
 };
 return {width:w,height:h,data,line,image:()=>({width:w,height:h,data} as ImageData)};
};
const cap={x:.14,y:.10,width:.35,height:.08};
it('finds a complete original grid below a numbered table caption without extracting guessed cells',()=>{
 const p=pixels();
 for(const y of [42,62,82,102])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,42,x,102);
 const result=findSourceTableGrids(p.image(),[cap]);
 expect(result).toHaveLength(1);
 expect(result[0].label).toBe('table');
 expect(result[0].confidence).toBe(.72);
 expect(result[0].rect.x).toBeCloseTo(33/240);
 expect(result[0].rect.y).toBeCloseTo(40/180);
 expect(result[0].rect.width).toBeGreaterThan(.65);
 expect(result[0].rect.height).toBeGreaterThan(.34);
 expect(result[0].order).toBe(cap.y*1000);
});
it('rejects horizontal decorations without vertical grid evidence and unknown page dimensions',()=>{
 const p=pixels();for(const y of [42,62,82,102])p.line(35,y,192,y);
 expect(findSourceTableGrids(p.image(),[cap])).toEqual([]);
 expect(findSourceTableGrids({width:0,height:180,data:p.image().data} as ImageData,[cap])).toEqual([]);
 expect(findSourceTableGrids({width:240,height:NaN,data:p.image().data} as ImageData,[cap])).toEqual([]);
 expect(findSourceTableGrids({width:240,height:180,data:new Uint8ClampedArray(3)} as ImageData,[cap])).toEqual([]);
 expect(findSourceTableGrids(p.image(),[])).toEqual([]);
});
it('rejects invalid caption coordinates, a sparse grid, and two neighboring vertical strokes',()=>{
 const p=pixels();p.line(35,42,192,42);p.line(35,62,192,62);
 for(const x of [35,36])p.line(x,42,x,62);
 expect(findSourceTableGrids(p.image(),[cap])).toEqual([]);
 p.line(35,82,192,82);p.line(35,42,35,82);p.line(36,42,36,82);
 expect(findSourceTableGrids(p.image(),[cap])).toEqual([]);
 for(const invalid of [{...cap,x:-.1},{...cap,y:NaN},{...cap,width:0},{...cap,x:.9,width:.3}])
  expect(findSourceTableGrids(p.image(),[invalid])).toEqual([]);
});
it('does not mislabel an unrelated grid above or distant from the table caption',()=>{
 const p=pixels();
 for(const y of [42,62,82,102])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,42,x,102);
 expect(findSourceTableGrids(p.image(),[{x:.14,y:.65,width:.35,height:.08}])).toEqual([]);
 expect(findSourceTableGrids(p.image(),[{x:.8,y:.10,width:.18,height:.08}])).toEqual([]);
});
it('can recognize two distinct tables without consuming later captions',()=>{
 const p=pixels(240,300);
 for(const y of [40,60,80,150,170,190])p.line(35,y,192,y);
 for(const x of [35,93,192]){p.line(x,40,x,80);p.line(x,150,x,190);}
 const a={x:.14,y:.04,width:.35,height:.06},b={x:.14,y:.40,width:.35,height:.06};
 const regions=findSourceTableGrids(p.image(),[a,b]);
 expect(regions).toHaveLength(2);
 expect(regions[0].order).toBeLessThan(regions[1].order);
});
it('recognizer stays local, deterministic and exposes no remote operation',async()=>{
 const p=pixels();for(const y of [42,62,82,102])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,42,x,102);
 const detector=createConservativeGridRecognizer([cap]);
 expect(detector.modelId).toBe('folio-local-grid-v1');
 expect(await detector.recognize(p.image())).toEqual(findSourceTableGrids(p.image(),[cap]));
});

it('coalesces two thick overlapping horizontal scan rows into a single grid rule',()=>{
 const p=pixels();
 for(const y of [42,62,82,102])p.line(35,y,192,y+1);
 for(const x of [35,93,192])p.line(x,42,x,102);
 const result=findSourceTableGrids(p.image(),[cap]);
 expect(result).toHaveLength(1);
 expect(result[0].rect.y).toBeCloseTo(40/180);
});
it('does not join separated short groups into one distant scientific table',()=>{
 const p=pixels();
 for(const y of [42,82,102])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,42,x,102);
 // The first pair is separated beyond a defensible contiguous grid-row gap.
 expect(findSourceTableGrids(p.image(),[cap])).toEqual([]);
});
it('rejects three extremely close, non-overlapping header strokes as a whole table',()=>{
 const p=pixels();
 p.line(35,42,95,42);
 p.line(96,44,158,44);
 p.line(35,46,95,46);
 expect(findSourceTableGrids(p.image(),[cap])).toEqual([]);
});

it('detects light-gray anti-aliased table grid lines from scientific PDFs',()=>{
 const p=pixels();
 for(const y of [42,62,82,102])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,42,x,102);
 // PDF renderers can paint thin table rules around RGB 196 instead of dark ink.
 for(let i=0;i<p.data.length;i+=4)if(p.data[i]===0){
  p.data[i]=196;p.data[i+1]=196;p.data[i+2]=196;
 }
 const region=findSourceTableGrids(p.image(),[cap]);
 expect(region).toHaveLength(1);
 expect(region[0].rect.y).toBeCloseTo(40/180);
});
it('never stretches the last table into a distant full-width page-footer rule',()=>{
 const p=pixels();
 for(const y of [111,125,140,160])p.line(35,y,192,y);
 for(const x of [35,93,192])p.line(x,111,x,160);
 p.line(10,172,230,172); // printed footer divider on same source page
 const nearBottom={x:.14,y:.5,width:.35,height:.06};
 const table=findSourceTableGrids(p.image(),[nearBottom]);
 expect(table).toHaveLength(1);
 expect(table[0].rect.y+table[0].rect.height).toBeLessThan(.93);
});
