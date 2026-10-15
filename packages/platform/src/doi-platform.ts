import { doiUrl, normalizeDoi, preflightPdf, safePublicHttps, MAX_PDF_BYTES, type DocumentSummary, type DoiMetadata, type ReaderPlatform } from '@folio/core';
import type { PdfStore, StoredPdf } from './index';
import { createDoiResolver, type DoiResolver, type MetadataFetch } from './doi-resolver';
export { createDoiResolver } from './doi-resolver';
export type { DoiResolver, MetadataFetch } from './doi-resolver';
export interface SavedReference { metadata: DoiMetadata; linkedDocumentId?: string }
type ReferenceRow = StoredPdf & { kind: 'reference'; metadata: DoiMetadata; linkedDocumentId?: string };
export interface DoiPlatform {
  resolveDoi(input: string, signal: AbortSignal): Promise<DoiMetadata>;
  saveReference(metadata: DoiMetadata): Promise<DocumentSummary>;
  readReference(id: string): Promise<SavedReference>;
  importOpenPdf(referenceId: string, signal: AbortSignal): Promise<DocumentSummary>;
}
/** No automatic network activity; resolver and download are invoked only from explicit user UI. */
export function createDoiPlatform(store: PdfStore, pdf: ReaderPlatform, resolver: DoiResolver,
  fetcher: MetadataFetch): DoiPlatform {
  async function reference(id: string): Promise<ReferenceRow> {
    const doc=await store.get(id);
    if (!doc || doc.kind!=='reference' || !doc.metadata) throw new Error('Reference not found');
    return doc as ReferenceRow;
  }
  return {
    resolveDoi: resolver.resolve,
    async saveReference(metadata) {
      const doi=normalizeDoi(metadata.doi);
      if (metadata.doi !== doi || metadata.landingUrl !== doiUrl(doi)) throw new Error('Invalid reference provenance');
      const id='doi:'+doi, current=await store.get(id);
      if (current) {
        if(current.kind!=='reference') throw new Error('Reference ID collision');
        if(metadata.source==='Unresolved') return {id,title:current.title,progress:0,kind:'reference',doi,creators:current.creators};
        const updated:ReferenceRow={...current,kind:'reference',metadata:structuredClone(metadata),
          title:metadata.title||doi,creators:[...metadata.creators]};
        await store.put(updated);
        return {id,title:updated.title,progress:0,kind:'reference',doi,creators:updated.creators};
      }
      const doc:ReferenceRow={id,kind:'reference',doi,title:metadata.title||doi,creators:[...metadata.creators],
        progress:0,fingerprint:doi,bytes:new Uint8Array(),metadata:structuredClone(metadata)};
      await store.put(doc);
      return {id,kind:'reference',doi,title:doc.title,creators:doc.creators,progress:0};
    },
    async readReference(id) {
      const doc=await reference(id);
      const linkedDocumentId=doc.linkedDocumentId && await store.get(doc.linkedDocumentId) ? doc.linkedDocumentId : undefined;
      return {metadata:structuredClone(doc.metadata),linkedDocumentId};
    },
    async importOpenPdf(referenceId,signal) {
      const doc=await reference(referenceId), url=safePublicHttps(doc.metadata.oa?.pdfUrl);
      if (!url) throw new Error('No verified open-access PDF URL');
      const response=await fetcher(url,{method:'GET',headers:{Accept:'application/pdf'},redirect:'error',
        credentials:'omit',referrerPolicy:'no-referrer',mode:'cors',signal});
      if (!response.ok) throw new Error('PDF HTTP '+response.status);
      const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (type!=='application/pdf' && type!=='application/octet-stream') throw new Error('Unexpected PDF content type');
      const length=Number(response.headers.get('content-length'));
      if (length>MAX_PDF_BYTES) throw new Error('PDF is too large');
      if (!response.body) throw new Error('Streaming download unavailable; open source and import PDF manually');
      const reader=response.body.getReader(), chunks:Uint8Array[]= [];
      let total=0;
      try {
        while(true) {
          const part=await reader.read();
          if (part.done) break;
          total+=part.value.byteLength;
          if(total>MAX_PDF_BYTES) { await reader.cancel(); throw new Error('PDF is too large'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const bytes=new Uint8Array(total);let at=0;
      for(const part of chunks){bytes.set(part,at);at+=part.length;}
      const check=preflightPdf(bytes);
      if(!check.ok) throw new Error('Downloaded content is not a supported PDF: '+check.error);
      const imported=await pdf.importPdf(doc.title+'.pdf',bytes);
      await store.put({...doc,linkedDocumentId:imported.id});
      return imported;
    }
  };
}
export function unresolvedReference(input: string): DoiMetadata {
  const doi=normalizeDoi(input);
  return {doi,title:doi,creators:[],landingUrl:doiUrl(doi),source:'Unresolved'};
}
