/**
 * CloudContext JavaScript Client
 */

class CloudContext {
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.contextId = config.contextId || 'default';
    this.cache = new Map();
  }

  async save(content, metadata = {}, contextId = null) {
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

    const result = await response.json();
    this.cache.set(id, { content, metadata });
    return result;
  }

  async get(contextId = null) {
    const id = contextId || this.contextId;
    
    if (this.cache.has(id)) {
      return this.cache.get(id);
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

    const context = await response.json();
    this.cache.set(id, context);
    return context;
  }

  async delete(contextId = null) {
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

  async list() {
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudContext;
}

export default CloudContext;
