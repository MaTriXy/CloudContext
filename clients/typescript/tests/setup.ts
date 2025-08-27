/**
 * Jest setup file for TypeScript client tests
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Reset fetch mock before each test
beforeEach(() => {
  mockFetch.mockClear();
});

// Helper to create mock fetch responses
global.mockFetchResponse = (data: any, status = 200, statusText = 'OK') => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
};

// Helper to create mock fetch error
global.mockFetchError = (status = 500, statusText = 'Internal Server Error', errorText = 'Server Error') => {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(errorText)
  });
};

// Extend global types for TypeScript
declare global {
  var mockFetchResponse: (data: any, status?: number, statusText?: string) => Promise<Response>;
  var mockFetchError: (status?: number, statusText?: string, errorText?: string) => Promise<Response>;
}
