/**
 * Unit tests for CloudContext Worker
 */

// Mock environment setup
const mockEnv = {
  JWT_SECRET: 'test-secret',
  ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
  R2_BUCKET: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    list: jest.fn()
  },
  KV_AUTH: {
    get: jest.fn()
  },
  KV_METADATA: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
};

// Mock crypto for testing
global.crypto = {
  randomUUID: () => 'test-uuid',
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {
    importKey: jest.fn().mockResolvedValue('mock-key'),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
};

// Mock atob/btoa for Node.js environment
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Import worker after mocking
const workerModule = require('../../src/worker.js');

describe('CloudContext Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Handling', () => {
    test('should handle OPTIONS requests with CORS headers', async () => {
      const request = new Request('https://example.com/api/context', {
        method: 'OPTIONS'
      });

      const response = await workerModule.default.fetch(request, mockEnv);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    test('should return 401 for requests without authorization', async () => {
      const request = new Request('https://example.com/api/context', {
        method: 'GET'
      });

      const response = await workerModule.default.fetch(request, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing authorization');
    });

    test('should return 404 for unknown endpoints', async () => {
      const request = new Request('https://example.com/api/unknown', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      mockEnv.KV_AUTH.get.mockResolvedValue('test-user');

      const response = await workerModule.default.fetch(request, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const request = new Request('https://example.com/api/health', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      mockEnv.KV_AUTH.get.mockResolvedValue('test-user');

      const response = await workerModule.default.fetch(request, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle internal errors gracefully', async () => {
      const request = new Request('https://example.com/api/context', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      mockEnv.KV_AUTH.get.mockRejectedValue(new Error('Database error'));

      const response = await workerModule.default.fetch(request, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.errorId).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('should generate consistent checksums', async () => {
      // This would test the generateChecksum function
      const testData = 'test data';
      // Note: In a real implementation, we'd need to export utility functions
      // or restructure the code to make them testable
    });
  });
});
