# CloudContext TypeScript Client

A fully typed TypeScript client for CloudContext - secure, global AI context storage using Cloudflare R2.

## Installation

```bash
npm install @cloudcontext/typescript-client
```

## Usage

### Basic Setup

```typescript
import { CloudContext } from '@cloudcontext/typescript-client';

const client = new CloudContext({
  baseUrl: 'https://your-cloudcontext-api.com',
  apiKey: 'your-api-key',
  contextId: 'my-context' // optional, defaults to 'default'
});
```

### Save Context

```typescript
const response = await client.save('Hello, world!', {
  timestamp: Date.now(),
  source: 'user-input'
});

console.log(response.success); // true
console.log(response.contextId); // 'my-context'
```

### Retrieve Context

```typescript
const context = await client.get();
console.log(context.content); // 'Hello, world!'
console.log(context.metadata); // { timestamp: ..., source: 'user-input' }

// Get specific context
const specificContext = await client.get('another-context');
```

### List All Contexts

```typescript
const contexts = await client.list();
console.log(contexts); // ['my-context', 'another-context', ...]
```

### Delete Context

```typescript
await client.delete(); // deletes default context
await client.delete('specific-context'); // deletes specific context
```

### Cache Management

```typescript
// Check if context is cached
const isCached = client.hasCached('my-context');

// Clear all cached data
client.clearCache();

// Get cache size
const cacheSize = client.getCacheSize();
```

## TypeScript Support

This client provides full TypeScript support with proper type definitions:

```typescript
import { CloudContextConfig, ContextMetadata, ContextData } from '@cloudcontext/typescript-client';

const config: CloudContextConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: 'key',
  contextId: 'optional-id'
};

const metadata: ContextMetadata = {
  tags: ['important', 'ai-context'],
  priority: 'high'
};
```

## Building

```bash
npm run build
```

## Development

```bash
npm run build:watch
```

## License

MIT
