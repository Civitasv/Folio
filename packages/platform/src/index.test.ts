import { expect, it } from 'vitest';
import { browserPlatform } from './index';
it('starts with an empty local preview library', async () => { expect(await browserPlatform.listDocuments()).toEqual([]); });
