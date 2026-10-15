import { doiUrl, normalizeDoi, safePublicHttps, type DoiMetadata } from '@folio/core';
export type MetadataFetch = (url: string, init: RequestInit) => Promise<Response>;
function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function firstText(value: unknown): string { return Array.isArray(value) ? text(value[0]) : text(value); }
function names(value: unknown, field: 'given' | 'name'): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    const item=object(entry);
    return field==='name' ? text(item.name) : [text(item.given),text(item.family)].filter(Boolean).join(' ');
  }).filter(Boolean);
}
function year(value: unknown): number | undefined {
  const n=Number(value);
  return Number.isInteger(n) && n>=1000 && n<=9999 ? n : undefined;
}
async function getJson(fetcher: MetadataFetch, url: string, signal: AbortSignal): Promise<unknown> {
  const response=await fetcher(url,{method:'GET',headers:{Accept:'application/json'},redirect:'error',
    credentials:'omit',referrerPolicy:'no-referrer',signal});
  if (!response.ok) throw new Error('Metadata HTTP ' + response.status);
  return response.json();
}
function crossref(raw: unknown, doi: string): DoiMetadata {
  const msg=object(object(raw).message);
  if (normalizeDoi(text(msg.DOI))!==doi) throw new Error('Crossref DOI mismatch');
  const title=firstText(msg.title);
  if (!title) throw new Error('Missing title');
  const date=object(msg.published)['date-parts'];
  return {doi,title,creators:names(msg.author,'given'),containerTitle:firstText(msg['container-title'])||undefined,
    publisher:text(msg.publisher)||undefined,year:year(Array.isArray(date) ? date[0]?.[0] : undefined),
    language:text(msg.language)||undefined,landingUrl:doiUrl(doi),source:'Crossref'};
}
function datacite(raw: unknown, doi: string): DoiMetadata {
  const attrs=object(object(object(raw).data).attributes);
  if (normalizeDoi(text(attrs.doi))!==doi) throw new Error('DataCite DOI mismatch');
  const title=text(object(Array.isArray(attrs.titles)?attrs.titles[0]:null).title);
  if (!title) throw new Error('Missing title');
  return {doi,title,creators:names(attrs.creators,'name'),
    containerTitle:text(object(attrs.container).title)||undefined,
    publisher:text(attrs.publisher)||undefined,year:year(attrs.publicationYear),
    language:text(attrs.language)||undefined,landingUrl:doiUrl(doi),source:'DataCite'};
}
/** The only request origins are fixed metadata services. OA hints are verified against the resolved DOI. */
export function createDoiResolver(fetcher: MetadataFetch) {
  return {
    async resolve(input: string, signal: AbortSignal): Promise<DoiMetadata> {
      const doi=normalizeDoi(input), encoded=encodeURIComponent(doi);
      let record: DoiMetadata;
      try {
        record=crossref(await getJson(fetcher,'https://api.crossref.org/works/'+encoded,signal),doi);
      } catch (error) {
        if (signal.aborted) throw error;
        record=datacite(await getJson(fetcher,'https://api.datacite.org/dois/'+encoded,signal),doi);
      }
      try {
        const oa=object(await getJson(fetcher,'https://api.openalex.org/works/doi:'+doi,signal));
        const location=object(oa.best_oa_location);
        if (normalizeDoi(text(oa.doi))===doi && object(oa.open_access).is_oa===true &&
            location.is_oa===true) {
          const pdfUrl=safePublicHttps(location.pdf_url),landingUrl=safePublicHttps(location.landing_page_url);
          if (pdfUrl || landingUrl) record.oa={pdfUrl,landingUrl,license:text(location.license)||undefined,source:'OpenAlex'};
        }
      } catch (error) { if (signal.aborted) throw error; /* discovery is optional, never invent access */ }
      return record;
    }
  };
}
export type DoiResolver = ReturnType<typeof createDoiResolver>;
