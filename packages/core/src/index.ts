export interface DocumentSummary { id: string; title: string; progress: number }
export interface ReaderPlatform { listDocuments(): Promise<DocumentSummary[]> }
