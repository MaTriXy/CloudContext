/**
 * Unit tests for CloudContext TypeScript client
 */

import { CloudContext } from '../src/CloudContext';
import { CloudContextConfig, ContextMetadata, ContextData, SaveResponse } from '../src/types';

describe('CloudContext', () => {
  let client: CloudContext;
  const mockConfig: CloudContextConfig = {
    baseUrl: 'https://api.example.com/',
    apiKey: 'test-api-key',
    contextId: 'test-context'
  };

  beforeEach(() => {
    client = new CloudContext(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(client['baseUrl']).toBe('https://api.example.com');
      expect(client['apiKey']).toBe('test-api-key');
      expect(client['contextId']).toBe('test-context');
      expect(client['cache']).toBeInstanceOf(Map);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new CloudContext({
        ...mockConfig,
        baseUrl: 'https://api.example.com/'
      });
      expect(clientWithSlash['baseUrl']).toBe('https://api.example.com');
    });

    it('should use default contextId when not provided', () => {
      const clientWithoutContext = new CloudContext({
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key'
      });
      expect(clientWithoutContext['contextId']).toBe('default');
    });
  });

  describe('save', () => {
    it('should save content successfully', async () => {
      const mockResponse: SaveResponse = {
        success: true,
        contextId: 'test-context',
        timestamp: '2023-01-01T00:00:00Z'
      };

      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const metadata: ContextMetadata = { tag: 'test' };
      const result = await client.save('test content', metadata);

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
      expect(client['cache'].get('test-context')).toEqual({
        content: 'test content',
        metadata: { tag: 'test' }
      });
    });

    it('should use provided contextId over default', async () => {
      const mockResponse: SaveResponse = { success: true, contextId: 'custom-context', timestamp: '' };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

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
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(400, 'Bad Request'));

      await expect(client.save('test content')).rejects.toThrow('Failed to save context: Bad Request');
    });

    it('should use empty metadata when not provided', async () => {
      const mockResponse: SaveResponse = { success: true, contextId: 'test', timestamp: '' };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

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
      const cachedData: ContextData = { content: 'cached content', metadata: { cached: true } };
      client['cache'].set('test-context', cachedData);

      const result = await client.get();

      expect(result).toEqual(cachedData);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch content from API when not cached', async () => {
      const mockResponse: ContextData = { content: 'api content', metadata: { from: 'api' } };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.get();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context', {
        headers: {
          'Authorization': 'Bearer test-api-key',
          'X-Context-ID': 'test-context'
        }
      });

      expect(result).toEqual(mockResponse);
      expect(client['cache'].get('test-context')).toEqual(mockResponse);
    });

    it('should use provided contextId', async () => {
      const mockResponse: ContextData = { content: 'custom content', metadata: {} };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

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
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(404, 'Not Found'));

      await expect(client.get()).rejects.toThrow('Failed to get context: Not Found');
    });
  });

  describe('delete', () => {
    it('should delete context successfully', async () => {
      client['cache'].set('test-context', { content: 'test', metadata: {} });
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({}));

      const result = await client.delete();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'X-Context-ID': 'test-context'
        }
      });

      expect(result).toBe(true);
      expect(client['cache'].has('test-context')).toBe(false);
    });

    it('should use provided contextId', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse({}));

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
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(403, 'Forbidden'));

      await expect(client.delete()).rejects.toThrow('Failed to delete context: Forbidden');
    });
  });

  describe('list', () => {
    it('should list contexts successfully', async () => {
      const mockResponse = { contexts: ['context1', 'context2', 'context3'] };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.list();

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/context/list', {
        headers: {
          'Authorization': 'Bearer test-api-key'
        }
      });

      expect(result).toEqual(['context1', 'context2', 'context3']);
    });

    it('should handle list errors', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(500, 'Internal Server Error'));

      await expect(client.list()).rejects.toThrow('Failed to list contexts: Internal Server Error');
    });

    it('should handle empty context list', async () => {
      const mockResponse = { contexts: [] };
      (fetch as jest.Mock).mockImplementationOnce(() => mockFetchResponse(mockResponse));

      const result = await client.list();

      expect(result).toEqual([]);
    });
  });

  describe('TypeScript-specific methods', () => {
    it('should clear cache', () => {
      client['cache'].set('test1', { content: 'test1', metadata: {} });
      client['cache'].set('test2', { content: 'test2', metadata: {} });

      expect(client.getCacheSize()).toBe(2);

      client.clearCache();

      expect(client.getCacheSize()).toBe(0);
      expect(client.hasCached('test1')).toBe(false);
    });

    it('should return correct cache size', () => {
      expect(client.getCacheSize()).toBe(0);

      client['cache'].set('test1', { content: 'test1', metadata: {} });
      expect(client.getCacheSize()).toBe(1);

      client['cache'].set('test2', { content: 'test2', metadata: {} });
      expect(client.getCacheSize()).toBe(2);
    });

    it('should check if context is cached', () => {
      expect(client.hasCached('test-context')).toBe(false);

      client['cache'].set('test-context', { content: 'test', metadata: {} });
      expect(client.hasCached('test-context')).toBe(true);
      expect(client.hasCached()).toBe(true); // uses default contextId
    });
  });

  describe('type safety', () => {
    it('should enforce correct types for config', () => {
      // This test ensures TypeScript compilation catches type errors
      const validConfig: CloudContextConfig = {
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        contextId: 'optional-id'
      };

      const client = new CloudContext(validConfig);
      expect(client).toBeInstanceOf(CloudContext);
    });

    it('should enforce correct types for metadata', () => {
      const validMetadata: ContextMetadata = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        objectField: { nested: 'value' },
        arrayField: [1, 2, 3]
      };

      // This should compile without issues
      expect(typeof validMetadata).toBe('object');
    });
  });
});
