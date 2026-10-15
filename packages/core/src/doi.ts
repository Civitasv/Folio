/** DOI is an identifier, not a document or proof that full text is accessible. */
export function normalizeDoi(input: string): string {
  let value = input.trim();
  if (/^doi\s*:/i.test(value)) value = value.replace(/^doi\s*:\s*/i, '');
  else if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Invalid DOI'); }
    if (!['doi.org', 'dx.doi.org'].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port || url.search || url.hash) throw new Error('Invalid DOI');
    try { value = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error('Invalid DOI'); }
  }
  if (value.length > 255 || !/^10\.\d{4,9}\/[a-z0-9._;():/+\-]+$/i.test(value)) throw new Error('Invalid DOI');
  return value.toLowerCase();
}
export interface DoiMetadata {
  doi: string;
  title: string;
  creators: string[];
  containerTitle?: string;
  publisher?: string;
  year?: number;
  language?: string;
  landingUrl: string;
  source: 'Crossref' | 'DataCite' | 'Unresolved';
  oa?: {
    landingUrl?: string;
    pdfUrl?: string;
    license?: string;
    source: 'OpenAlex';
  };
}
export function doiUrl(doi: string): string { return 'https://doi.org/' + encodeURIComponent(doi).replace(/%2F/gi, '/'); }
/** Check external URL shape before offering it; no remote resource is fetched by this function. */
export function safePublicHttps(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || host === 'localhost' || host.endsWith('.local') ||
        host.endsWith('.internal') || host.includes(':') || /^[\d.]+$/.test(host)) return undefined;
    return url.toString();
  } catch { return undefined; }
}
