import type { ReaderPlatform } from '@folio/core';
/** F00 preview: no documents are persisted until F01. */
export const browserPlatform: ReaderPlatform = { async listDocuments() { return []; } };
