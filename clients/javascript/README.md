# CloudContext JavaScript Client

<div align="center">
  <img src="../../docs/images/CloudContext.png" alt="CloudContext Logo" width="300"/>
  <br><br>
  
  **Official JavaScript client for CloudContext**
  
  Secure, distributed AI context storage with military-grade encryption
  
  <br>
  
  [![npm version](https://badge.fury.io/js/cloudcontext.svg)](https://www.npmjs.com/package/cloudcontext)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

## Installation

```bash
npm install cloudcontext
```

## Quick Start

```javascript
import CloudContext from 'cloudcontext';

const client = new CloudContext({
  endpoint: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});

// Save context
await client.save('user-123', {
  preferences: { theme: 'dark', language: 'en' },
  conversation: ['Hello!', 'Hi there!'],
  metadata: { lastActive: new Date().toISOString() }
});

// Retrieve context
const context = await client.get('user-123');
console.log(context);

// List all contexts
const contexts = await client.list();
console.log(contexts);

// Delete context
await client.delete('user-123');
```

## API Reference

### Constructor

```javascript
const client = new CloudContext(options)
```

**Options:**
- `endpoint` (string, required): Your CloudContext worker endpoint
- `apiKey` (string, required): Your API key for authentication
- `timeout` (number, optional): Request timeout in milliseconds (default: 30000)

### Methods

#### `save(key, data, options?)`

Save context data for a given key.

```javascript
await client.save('user-123', {
  preferences: { theme: 'dark' },
  history: ['message1', 'message2']
}, {
  ttl: 3600, // Optional: TTL in seconds
  metadata: { version: '1.0' } // Optional: additional metadata
});
```

**Parameters:**
- `key` (string): Unique identifier for the context
- `data` (object): The context data to store
- `options` (object, optional): Additional options
  - `ttl` (number): Time-to-live in seconds
  - `metadata` (object): Additional metadata

**Returns:** Promise<void>

#### `get(key)`

Retrieve context data for a given key.

```javascript
const context = await client.get('user-123');
```

**Parameters:**
- `key` (string): Unique identifier for the context

**Returns:** Promise<object | null>

#### `delete(key)`

Delete context data for a given key.

```javascript
await client.delete('user-123');
```

**Parameters:**
- `key` (string): Unique identifier for the context

**Returns:** Promise<void>

#### `list(options?)`

List all available context keys.

```javascript
const contexts = await client.list({
  prefix: 'user-',
  limit: 100
});
```

**Parameters:**
- `options` (object, optional): Filtering options
  - `prefix` (string): Filter keys by prefix
  - `limit` (number): Maximum number of keys to return

**Returns:** Promise<string[]>

## Error Handling

The client throws specific error types for different scenarios:

```javascript
try {
  await client.save('key', data);
} catch (error) {
  if (error.name === 'NetworkError') {
    console.error('Network connection failed:', error.message);
  } else if (error.name === 'AuthenticationError') {
    console.error('Invalid API key:', error.message);
  } else if (error.name === 'ValidationError') {
    console.error('Invalid data format:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Advanced Usage

### Batch Operations

```javascript
// Save multiple contexts
const operations = [
  client.save('user-1', { data: 'context1' }),
  client.save('user-2', { data: 'context2' }),
  client.save('user-3', { data: 'context3' })
];

await Promise.all(operations);
```

### Context Versioning

```javascript
// Save with version metadata
await client.save('user-123', contextData, {
  metadata: { 
    version: '2.1',
    timestamp: new Date().toISOString(),
    source: 'web-app'
  }
});
```

### Encryption

All data is automatically encrypted using AES-256-GCM before transmission. The client handles encryption/decryption transparently.

## Browser Support

This client works in all modern browsers and Node.js environments:

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Node.js 14+

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
