import {expect,it} from 'vitest';
import {paintedImageRegions,type ImagePaintCodes} from './pdf-media';
const c:ImagePaintCodes={save:1,restore:2,transform:3,paintImageXObject:4,paintInlineImageXObject:5,paintJpegXObject:6};
const viewport:[number,number,number,number,number,number]=[1,0,0,-1,0,100];
it('maps painted image CTM into normalized top-left source-page coordinates',()=>{
 const a=paintedImageRegions({fnArray:[1,3,4,2],argsArray:[[],[40,0,0,20,10,50],['Im1'],[]]},c,viewport,100,100);
 expect(a).toHaveLength(1);
 expect(a[0]).toEqual({x:.1,y:.3,width:.4,height:.2});
});
it('supports nested CTMs, JPEG and inline images but excludes tiny logos and outside-page placements',()=>{
 const a=paintedImageRegions({fnArray:[1,3,1,3,5,2,6,3,4,2,3,4],
  argsArray:[[],[50,0,0,50,10,20],[],[.5,0,0,.5,0,0],['inline'],[],['jpeg'],
   [0.01,0,0,.01,0,0],['tiny'],[],[50,0,0,30,200,50],['outside']]},c,viewport,100,100);
 expect(a).toHaveLength(2);
 expect(a[0].x).toBeCloseTo(.1);expect(a[0].width).toBeCloseTo(.25);
 expect(a[1].width).toBeCloseTo(.5);
});
it('does not trust invalid transform args and restores safely with an empty stack',()=>{
 const a=paintedImageRegions({fnArray:[3,2,4,77,3,4],argsArray:[[1,2,3],[],['plain'],[],[50,0,0,30,20,40],['valid']]},c,viewport,100,100);
 expect(a).toHaveLength(1); // An untransformed 1pt image is intentionally too small.
 expect(a[0].x).toBeCloseTo(.2);
});
it('rotated painted images use all four corners and clamp to the physical page',()=>{
 const a=paintedImageRegions({fnArray:[3,4],argsArray:[[0,40,-30,0,90,40],['rotate']]},c,viewport,100,100);
 expect(a).toHaveLength(1);
 expect(a[0].x).toBeCloseTo(.6);
 expect(a[0].y).toBeCloseTo(.2);
 expect(a[0].width).toBeCloseTo(.3);
 expect(a[0].height).toBeCloseTo(.4);
});
