/**
 * Integration tests for CloudContext API
 */

const fetch = require('node-fetch');

// Configuration for integration tests
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_USER_ID = 'test-user-integration';

describe('CloudContext API Integration', () => {
  const contextId = `test-context-${Date.now()}`;
  let lastVersion;

  const makeRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_API_KEY}`,
      'X-Context-ID': contextId,
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  };

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await makeRequest('/api/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Context Management', () => {
    test('should save a new context', async () => {
      const contextData = {
        content: {
          messages: [
            { role: 'user', content: 'Hello, world!' },
            { role: 'assistant', content: 'Hi there! How can I help?' }
          ],
          metadata: {
            model: 'claude-3',
            temperature: 0.7
          }
        },
        metadata: {
          source: 'integration-test',
          tags: ['test', 'api']
        }
      };

      const response = await makeRequest('/api/context', {
        method: 'POST',
        body: JSON.stringify(contextData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.contextId).toBe(contextId);
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();

      lastVersion = result.version;
    });

    test('should retrieve the saved context', async () => {
      const response = await makeRequest('/api/context');
      expect(response.status).toBe(200);

      const context = await response.json();
      expect(context.content).toBeDefined();
      expect(context.content.messages).toHaveLength(2);
      expect(context.metadata.userId).toBe(TEST_USER_ID);
      expect(context.metadata.contextId).toBe(contextId);
    });

    test('should update existing context', async () => {
      const updatedData = {
        content: {
          messages: [
            { role: 'user', content: 'Hello, world!' },
            { role: 'assistant', content: 'Hi there! How can I help?' },
            { role: 'user', content: 'What is the weather like?' }
          ],
          metadata: {
            model: 'claude-3',
            temperature: 0.7,
            updated: true
          }
        }
      };

      const response = await makeRequest('/api/context', {
        method: 'PUT',
        body: JSON.stringify(updatedData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.version).not.toBe(lastVersion);
    });

    test('should list all contexts', async () => {
      const response = await makeRequest('/api/context/list');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.contexts).toBeDefined();
      expect(Array.isArray(data.contexts)).toBe(true);
      
      const testContext = data.contexts.find(c => c.contextId === contextId);
      expect(testContext).toBeDefined();
    });

    test('should handle context synchronization', async () => {
      const syncData = {
        contextId,
        lastSync: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      };

      const response = await makeRequest('/api/context/sync', {
        method: 'POST',
        body: JSON.stringify(syncData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(['pull', 'push']).toContain(result.action);
      expect(result.timestamp).toBeDefined();
    });

    test('should get version history', async () => {
      const versionData = { contextId };

      const response = await makeRequest('/api/context/version', {
        method: 'POST',
        body: JSON.stringify(versionData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.versions).toBeDefined();
      expect(Array.isArray(result.versions)).toBe(true);
      expect(result.versions.length).toBeGreaterThan(0);
    });

    test('should restore from version', async () => {
      if (!lastVersion) {
        throw new Error('No version available for restore test');
      }

      const restoreData = {
        contextId,
        version: lastVersion
      };

      const response = await makeRequest('/api/context/restore', {
        method: 'POST',
        body: JSON.stringify(restoreData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.restoredVersion).toBe(lastVersion.toString());
    });

    test('should delete context', async () => {
      const response = await makeRequest('/api/context', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.deleted).toBeGreaterThan(0);
    });

    test('should return 404 for deleted context', async () => {
      const response = await makeRequest('/api/context');
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Context not found');
    });
  });

  describe('Error Handling', () => {
    test('should return 401 for missing authorization', async () => {
      const response = await fetch(`${API_BASE_URL}/api/context`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Missing authorization');
    });

    test('should return 400 for invalid context data', async () => {
      const invalidData = {
        content: 'invalid structure'
      };

      const response = await makeRequest('/api/context', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Invalid context structure');
    });

    test('should return 404 for unknown endpoints', async () => {
      const response = await makeRequest('/api/nonexistent');
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Not found');
    });
  });

  describe('CORS Headers', () => {
    test('should handle OPTIONS request with proper CORS headers', async () => {
      const response = await makeRequest('/api/context', {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });
  });
});
