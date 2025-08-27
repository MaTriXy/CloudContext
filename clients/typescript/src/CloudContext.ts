/**
 * CloudContext TypeScript Client
 */

import { 
  CloudContextConfig, 
  ContextMetadata, 
  ContextData, 
  SaveResponse, 
  CloudContextClient 
} from './types';

export class CloudContext implements CloudContextClient {
  private baseUrl: string;
  private apiKey: string;
  private contextId: string;
  private cache: Map<string, ContextData>;

  constructor(config: CloudContextConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.contextId = config.contextId || 'default';
    this.cache = new Map<string, ContextData>();
  }

  async save(content: string, metadata: ContextMetadata = {}, contextId?: string): Promise<SaveResponse> {
    const id = contextId || this.contextId;
    
    const response = await fetch(`${this.baseUrl}/api/context`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Context-ID': id
      },
      body: JSON.stringify({ content, metadata })
    });

    if (!response.ok) {
      throw new Error(`Failed to save context: ${response.statusText}`);
    }

    const result: SaveResponse = await response.json();
    this.cache.set(id, { content, metadata });
    return result;
  }

  async get(contextId?: string): Promise<ContextData> {
    const id = contextId || this.contextId;
    
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    const response = await fetch(`${this.baseUrl}/api/context`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Context-ID': id
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get context: ${response.statusText}`);
    }

    const context: ContextData = await response.json();
    this.cache.set(id, context);
    return context;
  }

  async delete(contextId?: string): Promise<boolean> {
    const id = contextId || this.contextId;
    
    const response = await fetch(`${this.baseUrl}/api/context`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Context-ID': id
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete context: ${response.statusText}`);
    }

    this.cache.delete(id);
    return true;
  }

  async list(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/context/list`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list contexts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.contexts;
  }

  // Additional TypeScript-specific methods
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  hasCached(contextId?: string): boolean {
    const id = contextId || this.contextId;
    return this.cache.has(id);
  }
}
