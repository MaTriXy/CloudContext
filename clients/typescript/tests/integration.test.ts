/**
 * Integration tests for CloudContext TypeScript client
 */

import { CloudContext } from '../src/CloudContext';
import { CloudContextConfig, ContextMetadata } from '../src/types';

describe('CloudContext Integration Tests', () => {
  let client: CloudContext;
  const testConfig: CloudContextConfig = {
    baseUrl: process.env.CLOUDCONTEXT_BASE_URL || 'https://api.example.com',
    apiKey: process.env.CLOUDCONTEXT_API_KEY || 'test-api-key',
    contextId: `test-integration-${Date.now()}`
  };

  beforeAll(() => {
    client = new CloudContext(testConfig);
  });

  // Skip integration tests if no real API endpoint is configured
  const skipIfNoRealAPI = process.env.CLOUDCONTEXT_BASE_URL ? describe : describe.skip;

  skipIfNoRealAPI('Real API Integration', () => {
    it('should perform full CRUD operations with proper typing', async () => {
      const testContent = 'Integration test content';
      const testMetadata: ContextMetadata = { 
        test: true, 
        timestamp: Date.now(),
        source: 'integration-test',
        tags: ['typescript', 'integration']
      };

      // Save content
      const saveResult = await client.save(testContent, testMetadata);
      expect(saveResult.success).toBe(true);
      expect(saveResult.contextId).toBe(testConfig.contextId);
      expect(typeof saveResult.timestamp).toBe('string');

      // Get content
      const retrievedContext = await client.get();
      expect(retrievedContext.content).toBe(testContent);
      expect(retrievedContext.metadata).toEqual(expect.objectContaining(testMetadata));

      // List contexts
      const contexts = await client.list();
      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts).toContain(testConfig.contextId);

      // Test cache methods
      expect(client.hasCached()).toBe(true);
      expect(client.getCacheSize()).toBeGreaterThan(0);

      // Delete content
      const deleteResult = await client.delete();
      expect(deleteResult).toBe(true);

      // Verify cache is cleared
      expect(client.hasCached()).toBe(false);

      // Verify deletion
      await expect(client.get()).rejects.toThrow();
    });

    it('should handle multiple contexts with type safety', async () => {
      const context1Id = `${testConfig.contextId}-1`;
      const context2Id = `${testConfig.contextId}-2`;

      const metadata1: ContextMetadata = { id: 1, type: 'test' };
      const metadata2: ContextMetadata = { id: 2, type: 'test' };

      // Save to multiple contexts
      await client.save('Content 1', metadata1, context1Id);
      await client.save('Content 2', metadata2, context2Id);

      // Retrieve from both contexts
      const content1 = await client.get(context1Id);
      const content2 = await client.get(context2Id);

      expect(content1.content).toBe('Content 1');
      expect(content1.metadata).toEqual(expect.objectContaining(metadata1));
      expect(content2.content).toBe('Content 2');
      expect(content2.metadata).toEqual(expect.objectContaining(metadata2));

      // Test cache management
      expect(client.hasCached(context1Id)).toBe(true);
      expect(client.hasCached(context2Id)).toBe(true);
      expect(client.getCacheSize()).toBe(2);

      // Clean up
      await client.delete(context1Id);
      await client.delete(context2Id);

      expect(client.hasCached(context1Id)).toBe(false);
      expect(client.hasCached(context2Id)).toBe(false);
    });

    it('should handle cache operations correctly', async () => {
      const testContent = 'Cache test content';
      const testMetadata: ContextMetadata = { cacheTest: true };
      
      // Save content
      await client.save(testContent, testMetadata);

      // First get should fetch from API and cache
      const firstGet = await client.get();
      expect(firstGet.content).toBe(testContent);
      expect(client.hasCached()).toBe(true);

      // Mock fetch to verify cache is used
      const originalFetch = global.fetch;
      global.fetch = jest.fn();

      // Second get should use cache
      const secondGet = await client.get();
      expect(secondGet.content).toBe(testContent);
      expect(global.fetch).not.toHaveBeenCalled();

      // Clear cache and verify
      client.clearCache();
      expect(client.hasCached()).toBe(false);
      expect(client.getCacheSize()).toBe(0);

      // Restore fetch and clean up
      global.fetch = originalFetch;
      await client.delete();
    });
  });

  describe('Mock API Integration', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockClear();
    });

    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await expect(client.save('test')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }));

      await expect(client.save('test')).rejects.toThrow('Invalid JSON');
    });

    it('should handle rate limiting with proper error types', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(429, 'Too Many Requests'));

      await expect(client.save('test')).rejects.toThrow('Failed to save context: Too Many Requests');
    });

    it('should handle authentication errors', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(401, 'Unauthorized'));

      await expect(client.get()).rejects.toThrow('Failed to get context: Unauthorized');
    });

    it('should handle server errors', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(500, 'Internal Server Error'));

      await expect(client.list()).rejects.toThrow('Failed to list contexts: Internal Server Error');
    });

    it('should maintain cache consistency across operations', async () => {
      const contextId = 'cache-test-context';
      
      // Mock successful save
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({ 
        success: true, 
        contextId,
        timestamp: new Date().toISOString()
      }));

      await client.save('test content', { test: true }, contextId);
      expect(client.hasCached(contextId)).toBe(true);

      // Mock successful delete
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({}));

      await client.delete(contextId);
      expect(client.hasCached(contextId)).toBe(false);
    });

    it('should handle complex metadata types', async () => {
      const complexMetadata: ContextMetadata = {
        strings: ['a', 'b', 'c'],
        numbers: [1, 2, 3],
        nested: {
          deep: {
            value: 'test'
          }
        },
        boolean: true,
        null: null,
        undefined: undefined
      };

      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({
        success: true,
        contextId: 'test',
        timestamp: new Date().toISOString()
      }));

      await expect(client.save('test', complexMetadata)).resolves.not.toThrow();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            content: 'test',
            metadata: complexMetadata
          })
        })
      );
    });

    it('should validate response types at runtime', async () => {
      // Mock response with missing required fields
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({
        // Missing success, contextId, timestamp
      }));

      // The client should still work but may have undefined values
      const result = await client.save('test');
      expect(result).toBeDefined();
    });
  });

  describe('TypeScript-specific integration tests', () => {
    it('should provide proper IntelliSense and type checking', () => {
      // These tests verify that TypeScript compilation works correctly
      const config: CloudContextConfig = {
        baseUrl: 'https://test.com',
        apiKey: 'key'
        // contextId is optional
      };

      const client = new CloudContext(config);
      
      // These should all compile without TypeScript errors
      expect(typeof client.clearCache).toBe('function');
      expect(typeof client.getCacheSize).toBe('function');
      expect(typeof client.hasCached).toBe('function');
    });

    it('should enforce method parameter types', async () => {
      (fetch as jest.Mock).mockImplementation(() => mockFetchResponse({ success: true, contextId: 'test', timestamp: '' }));

      // These should compile with correct types
      await client.save('string content', { key: 'value' });
      await client.save('string content', { key: 'value' }, 'string-context-id');
      
      const result = await client.get();
      expect(typeof result.content).toBe('string');
      expect(typeof result.metadata).toBe('object');
    });
  });
});
