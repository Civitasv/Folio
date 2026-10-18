import {expect,it} from 'vitest';
import {parseLocalPdf} from './pdf-extract';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// The real worker module is preloaded for PDF.js's Node fake-worker path;
// production still uses the version-matched local Vite worker asset.
// @ts-expect-error The distributed worker module has no separate public TS declaration.
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
// Node 22 CI does not yet expose Promise.try, required by PDF.js 6's fake Worker.
// Test-only polyfill; production uses macOS WebView's native API.
if(!('try' in Promise))Object.assign(Promise,{try:(callback:(...args:unknown[])=>unknown,...args:unknown[])=>
 new Promise((resolve,reject)=>{try{resolve(callback(...args));}catch(error){reject(error);}})});
Object.assign(globalThis,{pdfjsWorker:pdfWorker});

/** A real, deterministic, redistributable selectable-text PDF; no PDF.js mocks. */
function fixturePdf():Uint8Array{
 const drawing=[
  'BT /F1 24 Tf 70 742 Td (Drought Study) Tj ET',
  'BT /F1 12 Tf 72 690 Td (Left paragraph one) Tj ET',
  'BT /F1 12 Tf 72 668 Td (Left paragraph two) Tj ET',
  'BT /F1 12 Tf 315 690 Td (Right paragraph one) Tj ET',
  'BT /F1 12 Tf 315 668 Td (Right paragraph two) Tj ET',
  '0 0 1 RG 70 350 m 500 350 l S',
  'BT /F1 11 Tf 72 318 Td (Figure 1: Example chart.) Tj ET'
 ].join('\n')+'\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+drawing.length+' >>\nstream\n'+drawing+'endstream'
 ];
 let output='%PDF-1.4\n',offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(output.length);
  output+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const xref=output.length;
 output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))output+=String(off).padStart(10,'0')+' 00000 n \n';
 output+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return new TextEncoder().encode(output);
}
it('parses an actual local two-column PDF, never uploading content or embedding a viewer',async()=>{
 const bytes=fixturePdf(),p=await parseLocalPdf('fixture:one',bytes);
 try{
  expect(p.ir.version).toBe(1);
  expect(p.ir.pages).toBe(1);
  expect(p.ir.blocks.some(b=>b.text.includes('Drought Study'))).toBe(true);
  const text=p.ir.blocks.map(b=>b.text).join(' | ');
  expect(text).toContain('Left paragraph one');
  expect(text).toContain('Right paragraph one');
  // Actual selectable-text geometry, not source drawing-command sequence, owns reading order.
  expect(text.indexOf('Left paragraph one')).toBeLessThan(text.indexOf('Left paragraph two'));
  expect(text.indexOf('Left paragraph two')).toBeLessThan(text.indexOf('Right paragraph one'));
  expect(text.indexOf('Right paragraph one')).toBeLessThan(text.indexOf('Right paragraph two'));
  expect(text.indexOf('Right paragraph two')).toBeLessThan(text.indexOf('Figure 1: Example chart.'));
  expect(p.ir.blocks.every(b=>b.page===1&&b.rect.x>=0&&b.rect.x+b.rect.width<=1.01)).toBe(true);
  expect(text).toContain('Figure 1: Example chart.');
  expect(p.ir.blocks.find(b=>b.text.includes('Figure 1:'))?.kind).toBe('caption');
  expect(p.ir.warnings.some(w=>w.includes('Conservative reflow'))).toBe(true);
 }finally{await p.destroy();}
});
