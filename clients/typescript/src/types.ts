/**
 * CloudContext TypeScript Types and Interfaces
 */

export interface CloudContextConfig {
  baseUrl: string;
  apiKey: string;
  contextId?: string;
}

export interface ContextMetadata {
  [key: string]: any;
}

export interface ContextData {
  content: string;
  metadata: ContextMetadata;
}

export interface SaveResponse {
  success: boolean;
  contextId: string;
  timestamp: string;
}

export interface ListResponse {
  contexts: string[];
}

export interface CloudContextClient {
  save(content: string, metadata?: ContextMetadata, contextId?: string): Promise<SaveResponse>;
  get(contextId?: string): Promise<ContextData>;
  delete(contextId?: string): Promise<boolean>;
  list(): Promise<string[]>;
}
