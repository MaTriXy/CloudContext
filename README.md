# CloudContext

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A simple, secure API for storing and retrieving AI conversation contexts using Cloudflare Workers and R2 storage.

## What is CloudContext?

CloudContext solves a basic problem: AI assistants forget everything between conversations. This service provides a persistent storage layer for AI contexts, conversation history, and user preferences that survives across sessions.

I built this because I was tired of having to re-explain context to AI assistants every time I started a new conversation. It runs on Cloudflare's infrastructure, so it's fast and has good global coverage.

## How it works

- Store AI contexts, conversation history, and user data via a REST API
- Data is stored in Cloudflare R2 (S3-compatible object storage)
- Basic authentication with API keys
- Versioning support for tracking context changes
- JavaScript/TypeScript client library included

## Current Features

- REST API for storing/retrieving contexts
- Bearer token authentication
- Context versioning and history
- CORS support for browser usage
- JavaScript client library
- Automated deployment script

## Getting Started

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Basic knowledge of Cloudflare Workers

### Deployment

1. Clone this repository
2. Copy `wrangler.example.toml` to `wrangler.toml` and configure your settings
3. Run the setup script:

```bash
./setup.sh
```

Or deploy manually:

```bash
npm install -g wrangler
wrangler deploy
```

### Basic Usage

```javascript
import CloudContext from './clients/javascript/index.js';

const client = new CloudContext({
  baseUrl: 'https://your-worker.your-subdomain.workers.dev',
  apiKey: 'your-api-key'
});

// Save some context
await client.save({
  conversation: ['Hello', 'Hi there!'],
  preferences: { theme: 'dark' }
});

// Retrieve it later
const context = await client.get();
console.log(context.preferences.theme); // 'dark'
```

### API Endpoints

- `POST /api/context` - Save context data
- `GET /api/context` - Retrieve context data
- `GET /api/context/list` - List all contexts for a user
- `GET /api/context/version` - Get context version history
- `POST /api/context/restore` - Restore a previous version
- `POST /api/context/sync` - Sync context data
- `GET /api/health` - Health check

## Project Status

This is a working implementation but still evolving. The core functionality is stable, but I'm continuing to add features and improve the API.

Currently implemented:
- ✅ Core storage and retrieval
- ✅ Authentication system
- ✅ Context versioning
- ✅ JavaScript client
- ✅ Automated deployment

## Client Libraries

- **JavaScript/TypeScript**: Ready to use (see `clients/javascript/`)
- **Python**: Planned
- **Go**: Planned

## Configuration

Copy `wrangler.example.toml` to `wrangler.toml` and update with your settings:

```toml
name = "your-cloudcontext-worker"
main = "src/worker.js"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.r2_buckets]]
binding = "CONTEXT_BUCKET"
bucket_name = "your-context-bucket"
```

## Development

```bash
# Start local development server
wrangler dev

# Run tests
npm test

# Deploy to production
wrangler deploy
```

## Cost

Using Cloudflare's free tier, this should handle thousands of requests per day at no cost. R2 storage is very affordable - typically under $1/month for most personal use cases.

## Contributing

Pull requests welcome. This is a fairly simple project, so please keep contributions focused and well-tested.

## License

MIT License - see [LICENSE](LICENSE) file.
