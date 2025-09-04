/**
 * Unit tests for CloudContext JavaScript client
 */

import { jest } from '@jest/globals';
import CloudContext from '../index.js';

describe('CloudContext', () => {
  let client;
  const mockConfig = {
    baseUrl: 'https://api.example.com/',
    apiKey: 'test-api-key',
    contextId: 'test-context'
  };

  beforeEach(() => {
    client = new CloudContext(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(client.baseUrl).toBe('https://api.example.com');
      expect(client.apiKey).toBe('test-api-key');
      expect(client.contextId).toBe('test-context');
      expect(client.cache).toBeInstanceOf(Map);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new CloudContext({
        ...mockConfig,
        baseUrl: 'https://api.example.com/'
      });
      expect(clientWithSlash.baseUrl).toBe('https://api.example.com');
    });

    it('should use default contextId when not provided', () => {
      const clientWithoutContext = new CloudContext({
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key'
      });
      expect(clientWithoutContext.contextId).toBe('default');
    });
  });

  describe('save', () => {
    it('should save content successfully', async () => {
      const mockResponse = {
        success: true,
        contextId: 'test-context',
        timestamp: '2023-01-01T00:00:00Z'
      };

      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.save('test content', { tag: 'test' });

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'X-Context-ID': 'test-context'
        },
        body: JSON.stringify({
          content: 'test content',
          metadata: { tag: 'test' }
        })
      });

      expect(result).toEqual(mockResponse);
      expect(client.cache.get('test-context')).toEqual({
        content: 'test content',
        metadata: { tag: 'test' }
      });
    });

    it('should use provided contextId over default', async () => {
      const mockResponse = { success: true, contextId: 'custom-context' };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      await client.save('test content', {}, 'custom-context');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Context-ID': 'custom-context'
          })
        })
      );
    });

    it('should handle save errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(400, 'Bad Request'));

      await expect(client.save('test content')).rejects.toThrow('Failed to save context: Bad Request');
    });

    it('should use empty metadata when not provided', async () => {
      const mockResponse = { success: true };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      await client.save('test content');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            content: 'test content',
            metadata: {}
          })
        })
      );
    });
  });

  describe('get', () => {
    it('should get content from cache when available', async () => {
      const cachedData = { content: 'cached content', metadata: { cached: true } };
      client.cache.set('test-context', cachedData);

      const result = await client.get();

      expect(result).toEqual(cachedData);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch content from API when not cached', async () => {
      const mockResponse = { content: 'api content', metadata: { from: 'api' } };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.get();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context', {
        headers: {
          'Authorization': 'Bearer test-api-key',
          'X-Context-ID': 'test-context'
        }
      });

      expect(result).toEqual(mockResponse);
      expect(client.cache.get('test-context')).toEqual(mockResponse);
    });

    it('should use provided contextId', async () => {
      const mockResponse = { content: 'custom content' };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      await client.get('custom-context');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Context-ID': 'custom-context'
          })
        })
      );
    });

    it('should handle get errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(404, 'Not Found'));

      await expect(client.get()).rejects.toThrow('Failed to get context: Not Found');
    });
  });

  describe('delete', () => {
    it('should delete context successfully', async () => {
      client.cache.set('test-context', { content: 'test' });
      fetch.mockImplementationOnce(() => mockFetchResponse({}));

      const result = await client.delete();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'X-Context-ID': 'test-context'
        }
      });

      expect(result).toBe(true);
      expect(client.cache.has('test-context')).toBe(false);
    });

    it('should use provided contextId', async () => {
      fetch.mockImplementationOnce(() => mockFetchResponse({}));

      await client.delete('custom-context');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Context-ID': 'custom-context'
          })
        })
      );
    });

    it('should handle delete errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(403, 'Forbidden'));

      await expect(client.delete()).rejects.toThrow('Failed to delete context: Forbidden');
    });
  });

  describe('list', () => {
    it('should list contexts successfully', async () => {
      const mockResponse = { contexts: ['context1', 'context2', 'context3'] };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.list();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context/list', {
        headers: {
          'Authorization': 'Bearer test-api-key'
        }
      });

      expect(result).toEqual(['context1', 'context2', 'context3']);
    });

    it('should handle list errors', async () => {
      fetch.mockImplementationOnce(() => mockFetchError(500, 'Internal Server Error'));

      await expect(client.list()).rejects.toThrow('Failed to list contexts: Internal Server Error');
    });

    it('should handle empty context list', async () => {
      const mockResponse = { contexts: [] };
      fetch.mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.list();

      expect(result).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should maintain separate cache entries for different contexts', async () => {
      const mockResponse1 = { content: 'content1', metadata: {} };
      const mockResponse2 = { content: 'content2', metadata: {} };

      fetch
        .mockImplementationOnce(() => mockFetchResponse(mockResponse1))
        .mockImplementationOnce(() => mockFetchResponse(mockResponse2));

      await client.get('context1');
      await client.get('context2');

      expect(client.cache.get('context1')).toEqual(mockResponse1);
      expect(client.cache.get('context2')).toEqual(mockResponse2);
    });
  });
});
