import { expect,it } from 'vitest';
import { normalizeDoi,doiUrl,safePublicHttps } from './doi';
it('normalizes DOI and canonical resolver URL forms without network requests',()=>{
  for(const value of ['10.1234/ABC.Def',' doi: 10.1234/ABC.Def ','HTTPS://DOI.ORG/10.1234/ABC.Def',
    'https://dx.doi.org/10.1234/ABC.Def','https://doi.org/10.1234%2FABC.Def'])
    expect(normalizeDoi(value)).toBe('10.1234/abc.def');
  expect(doiUrl('10.1234/abc.def')).toBe('https://doi.org/10.1234/abc.def');
});
it.each(['','doi:','10.123/a','10.1234/','10.1234/with space','https://example.com/10.1234/x',
  'https://doi.org:1234/10.1234/x','https://user@doi.org/10.1234/x',
  'https://doi.org/10.1234/x?x=1','https://doi.org/10.1234/x#bad',
  'https://doi.org/%E0%A4%A','https://doi.org/10.1234/%25','http://foo.com/10.1234/x',
  '10.1234/'+ 'a'.repeat(250)])('rejects noncanonical or unsafe input: %s',input=>
  expect(()=>normalizeDoi(input)).toThrow('Invalid DOI'));
it('accepts safe public HTTPS links but not credentials, HTTP, local or IP targets',()=>{
  expect(safePublicHttps('https://journal.example.org/oa.pdf')).toBe('https://journal.example.org/oa.pdf');
  for(const value of [null,3,'bad','http://journal.example.org/pdf','https://localhost/a',
    'https://foo.local/a','https://foo.internal/a','https://127.0.0.1/a','https://[::1]/a',
    'https://user:secret@journal.example.org/a','https://journal.example.org:444/a',
    'javascript:alert(1)','https://singlelabel/a'])
    expect(safePublicHttps(value)).toBeUndefined();
});
