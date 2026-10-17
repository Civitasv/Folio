import {expect,it,vi} from 'vitest';
import {createCodexProvider} from './cli-provider';
const bridge={status:vi.fn(async()=>({installed:true,authenticated:true,version:'codex 1.0'})),
 translate:vi.fn(async()=> ' Bonjour ')};
it('validates explicit model and uses a provider-specific cache identity and disclosure',async()=>{
 const provider=createCodexProvider(' gpt-5 ',bridge);
 expect(provider).toMatchObject({id:'cli:codex',model:'gpt-5',supportsAutoSource:true});
 expect(provider.dataFlow).toContain('remote model provider');
 expect(await provider.translate({text:'Hello',source:'en',target:'fr',promptVersion:'v1'},new AbortController().signal)).toBe(' Bonjour ');
 expect(bridge.translate).toHaveBeenCalledWith('gpt-5',{text:'Hello',source:'en',target:'fr',promptVersion:'v1'},expect.any(AbortSignal));
 for(const bad of ['', 'bad model','--yolo','a'.repeat(101),'x\ny'])
  expect(()=>createCodexProvider(bad,bridge)).toThrow('Invalid Codex model');
});
