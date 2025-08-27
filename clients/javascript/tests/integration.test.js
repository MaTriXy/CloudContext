/**
 * Integration tests for CloudContext JavaScript client
 */

import { jest } from '@jest/globals';
import CloudContext from '../index.js';

describe('CloudContext Integration Tests', () => {
  let client;
  const testConfig = {
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
    it('should perform full CRUD operations', async () => {
      const testContent = 'Integration test content';
      const testMetadata = { 
        test: true, 
        timestamp: Date.now(),
        source: 'integration-test'
      };

      // Save content
      const saveResult = await client.save(testContent, testMetadata);
      expect(saveResult.success).toBe(true);
      expect(saveResult.contextId).toBe(testConfig.contextId);

      // Get content
      const retrievedContext = await client.get();
      expect(retrievedContext.content).toBe(testContent);
      expect(retrievedContext.metadata).toEqual(expect.objectContaining(testMetadata));

      // List contexts
      const contexts = await client.list();
      expect(contexts).toContain(testConfig.contextId);

      // Delete content
      const deleteResult = await client.delete();
      expect(deleteResult).toBe(true);

      // Verify deletion
      await expect(client.get()).rejects.toThrow();
    });

    it('should handle multiple contexts', async () => {
      const context1Id = `${testConfig.contextId}-1`;
      const context2Id = `${testConfig.contextId}-2`;

      // Save to multiple contexts
      await client.save('Content 1', { id: 1 }, context1Id);
      await client.save('Content 2', { id: 2 }, context2Id);

      // Retrieve from both contexts
      const content1 = await client.get(context1Id);
      const content2 = await client.get(context2Id);

      expect(content1.content).toBe('Content 1');
      expect(content2.content).toBe('Content 2');

      // Clean up
      await client.delete(context1Id);
      await client.delete(context2Id);
    });

    it('should handle cache correctly', async () => {
      const testContent = 'Cache test content';
      
      // Save content
      await client.save(testContent, {});

      // First get should fetch from API
      const firstGet = await client.get();
      expect(firstGet.content).toBe(testContent);

      // Mock fetch to verify cache is used
      const originalFetch = global.fetch;
      global.fetch = jest.fn();

      // Second get should use cache
      const secondGet = await client.get();
      expect(secondGet.content).toBe(testContent);
      expect(global.fetch).not.toHaveBeenCalled();

      // Restore fetch and clean up
      global.fetch = originalFetch;
      await client.delete();
    });
  });

  describe('Mock API Integration', () => {
    beforeEach(() => {
      fetch.mockClear();
    });

    it('should handle network errors gracefully', async () => {
      fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await expect(client.save('test')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      fetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }));

      await expect(client.save('test')).rejects.toThrow('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(429, 'Too Many Requests'));

      await expect(client.save('test')).rejects.toThrow('Failed to save context: Too Many Requests');
    });

    it('should handle authentication errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(401, 'Unauthorized'));

      await expect(client.get()).rejects.toThrow('Failed to get context: Unauthorized');
    });

    it('should handle server errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(500, 'Internal Server Error'));

      await expect(client.list()).rejects.toThrow('Failed to list contexts: Internal Server Error');
    });

    it('should maintain cache consistency across operations', async () => {
      const contextId = 'cache-test-context';
      
      // Mock successful save
      fetch.mockImplementationOnce(() => mockFetchResponse({ 
        success: true, 
        contextId 
      }));

      await client.save('test content', { test: true }, contextId);
      expect(client.cache.has(contextId)).toBe(true);

      // Mock successful delete
      fetch.mockImplementationOnce(() => mockFetchResponse({}));

      await client.delete(contextId);
      expect(client.cache.has(contextId)).toBe(false);
    });
  });
});
