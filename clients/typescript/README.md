# CloudContext TypeScript Client

<div align="center">
  <img src="../../docs/images/CloudContext.png" alt="CloudContext Logo" width="300"/>
  <br><br>
  
  **Official TypeScript client for CloudContext**
  
  Secure, distributed AI context storage with full type safety
  
  <br>
  
  [![npm version](https://badge.fury.io/js/cloudcontext.svg)](https://www.npmjs.com/package/cloudcontext)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

## Installation

```bash
npm install cloudcontext
# or
yarn add cloudcontext
```

## Quick Start

```typescript
import { CloudContext, ContextData, SaveOptions } from 'cloudcontext';

interface UserContext {
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
  conversation: string[];
  metadata: {
    lastActive: string;
    sessionId: string;
  };
}

const client = new CloudContext({
  endpoint: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});

// Save context with full type safety
const userContext: UserContext = {
  preferences: { theme: 'dark', language: 'en' },
  conversation: ['Hello!', 'Hi there!'],
  metadata: { 
    lastActive: new Date().toISOString(),
    sessionId: 'sess_123'
  }
};

await client.save<UserContext>('user-123', userContext);

// Retrieve context with type inference
const context = await client.get<UserContext>('user-123');
if (context) {
  console.log(context.preferences.theme); // TypeScript knows this is 'light' | 'dark'
}
```

## Type Definitions

### Core Interfaces

```typescript
interface CloudContextOptions {
  endpoint: string;
  apiKey: string;
  timeout?: number;
}

interface SaveOptions {
  ttl?: number;
  metadata?: Record<string, any>;
}

interface ListOptions {
  prefix?: string;
  limit?: number;
}

interface ContextMetadata {
  key: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}
```

### Generic Methods

All methods support generic types for better type safety:

```typescript
// Generic save method
save<T extends ContextData>(key: string, data: T, options?: SaveOptions): Promise<void>

// Generic get method
get<T extends ContextData>(key: string): Promise<T | null>

// Typed list with metadata
listWithMetadata<T extends ContextData>(options?: ListOptions): Promise<ContextMetadata[]>
```

## API Reference

### Constructor

```typescript
const client = new CloudContext(options: CloudContextOptions)
```

### Methods

#### `save<T>(key, data, options?)`

```typescript
interface SaveOptions {
  ttl?: number;
  metadata?: Record<string, any>;
}

await client.save<UserPreferences>('user-prefs', {
  theme: 'dark',
  notifications: true
}, {
  ttl: 3600,
  metadata: { version: '1.0' }
});
```

#### `get<T>(key)`

```typescript
const preferences = await client.get<UserPreferences>('user-prefs');
// TypeScript infers the return type as UserPreferences | null
```

#### `delete(key)`

```typescript
await client.delete('user-prefs');
```

#### `list(options?)`

```typescript
const keys = await client.list({
  prefix: 'user-',
  limit: 50
});
```

#### `exists(key)`

```typescript
const exists = await client.exists('user-123');
// Returns: boolean
```

#### `clearCache()`

TypeScript-specific method for cache management:

```typescript
client.clearCache(); // Clear local cache
```

#### `getCacheSize()`

```typescript
const size = client.getCacheSize(); // Returns number of cached items
```

#### `hasCached(key)`

```typescript
const isCached = client.hasCached('user-123'); // Returns boolean
```

## Advanced TypeScript Features

### Custom Context Types

```typescript
interface AIAssistantContext {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  userProfile: {
    name: string;
    preferences: Record<string, any>;
  };
  sessionData: {
    startTime: Date;
    interactions: number;
  };
}

// Type-safe operations
await client.save<AIAssistantContext>('ai-session-123', {
  conversationHistory: [
    { role: 'user', content: 'Hello', timestamp: new Date() }
  ],
  userProfile: { name: 'John', preferences: {} },
  sessionData: { startTime: new Date(), interactions: 1 }
});
```

### Union Types and Discriminated Unions

```typescript
type ContextType = 
  | { type: 'user'; data: UserContext }
  | { type: 'session'; data: SessionContext }
  | { type: 'preferences'; data: PreferencesContext };

await client.save<ContextType>('mixed-context', {
  type: 'user',
  data: userContext
});
```

### Generic Utility Types

```typescript
// Extract context data type
type ExtractContextData<T> = T extends CloudContext<infer U> ? U : never;

// Partial context updates
type PartialContext<T> = {
  [K in keyof T]?: T[K] extends object ? PartialContext<T[K]> : T[K];
};
```

## Error Handling with Types

```typescript
import { 
  CloudContextError, 
  NetworkError, 
  AuthenticationError, 
  ValidationError 
} from 'cloudcontext';

try {
  await client.save('key', data);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
  } else if (error instanceof AuthenticationError) {
    console.error('Auth failed:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  }
}
```

## Configuration

### TypeScript Config

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Building and Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run type checking
npm run type-check

# Run tests
npm test
```

## Browser and Node.js Support

- TypeScript 4.5+
- Node.js 16+
- All modern browsers with ES2020 support

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
