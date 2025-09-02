/**
 * Jest setup file for JavaScript client tests
 */

import { jest, beforeEach } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Reset fetch mock before each test
beforeEach(() => {
  fetch.mockClear();
});

// Helper to create mock fetch responses
global.mockFetchResponse = (data, status = 200, statusText = 'OK') => {
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
