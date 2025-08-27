# CloudContext Python Client

<div align="center">
  <img src="../../docs/images/CloudContext.png" alt="CloudContext Logo" width="300"/>
  <br><br>
  
  **Official Python client for CloudContext**
  
  Secure, distributed AI context storage with async/await support
  
  <br>
  
  [![PyPI version](https://badge.fury.io/py/cloudcontext.svg)](https://pypi.org/project/cloudcontext/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

## Installation

```bash
pip install cloudcontext
```

## Quick Start

```python
import asyncio
from cloudcontext import CloudContext

async def main():
    client = CloudContext(
        endpoint='https://your-worker.your-subdomain.workers.dev',
        api_key='your-api-key'
    )
    
    # Save context
    await client.save('user-123', {
        'preferences': {'theme': 'dark', 'language': 'en'},
        'conversation': ['Hello!', 'Hi there!'],
        'metadata': {'last_active': '2024-01-01T00:00:00Z'}
    })
    
    # Retrieve context
    context = await client.get('user-123')
    print(context)
    
    # List all contexts
    contexts = await client.list()
    print(contexts)
    
    # Delete context
    await client.delete('user-123')

# Run the async function
asyncio.run(main())
```

## Synchronous Usage

For non-async environments, use the synchronous wrapper:

```python
from cloudcontext import CloudContextSync

client = CloudContextSync(
    endpoint='https://your-worker.your-subdomain.workers.dev',
    api_key='your-api-key'
)

# All methods work synchronously
client.save('user-123', {'data': 'example'})
context = client.get('user-123')
```

## API Reference

### Constructor

```python
client = CloudContext(
    endpoint: str,
    api_key: str,
    timeout: int = 30,
    max_retries: int = 3,
    retry_delay: float = 1.0
)
```

**Parameters:**
- `endpoint` (str): Your CloudContext worker endpoint
- `api_key` (str): Your API key for authentication
- `timeout` (int): Request timeout in seconds (default: 30)
- `max_retries` (int): Maximum number of retry attempts (default: 3)
- `retry_delay` (float): Delay between retries in seconds (default: 1.0)

### Methods

#### `save(key, data, ttl=None, metadata=None)`

Save context data for a given key.

```python
await client.save(
    'user-123',
    {
        'preferences': {'theme': 'dark'},
        'history': ['message1', 'message2']
    },
    ttl=3600,  # Optional: TTL in seconds
    metadata={'version': '1.0'}  # Optional: additional metadata
)
```

**Parameters:**
- `key` (str): Unique identifier for the context
- `data` (dict): The context data to store
- `ttl` (int, optional): Time-to-live in seconds
- `metadata` (dict, optional): Additional metadata

**Returns:** None

#### `get(key)`

Retrieve context data for a given key.

```python
context = await client.get('user-123')
```

**Parameters:**
- `key` (str): Unique identifier for the context

**Returns:** dict | None

#### `delete(key)`

Delete context data for a given key.

```python
await client.delete('user-123')
```

**Parameters:**
- `key` (str): Unique identifier for the context

**Returns:** None

#### `list(prefix=None, limit=None)`

List all available context keys.

```python
contexts = await client.list(prefix='user-', limit=100)
```

**Parameters:**
- `prefix` (str, optional): Filter keys by prefix
- `limit` (int, optional): Maximum number of keys to return

**Returns:** List[str]

#### `exists(key)`

Check if a context exists.

```python
exists = await client.exists('user-123')
```

**Parameters:**
- `key` (str): Unique identifier for the context

**Returns:** bool

#### `bulk_save(contexts)`

Save multiple contexts in a single operation.

```python
contexts = {
    'user-1': {'data': 'context1'},
    'user-2': {'data': 'context2'},
    'user-3': {'data': 'context3'}
}
await client.bulk_save(contexts)
```

**Parameters:**
- `contexts` (dict): Dictionary mapping keys to context data

**Returns:** None

#### `bulk_get(keys)`

Retrieve multiple contexts in a single operation.

```python
contexts = await client.bulk_get(['user-1', 'user-2', 'user-3'])
```

**Parameters:**
- `keys` (List[str]): List of context keys to retrieve

**Returns:** Dict[str, dict]

## Error Handling

The client provides specific exception types:

```python
from cloudcontext.exceptions import (
    CloudContextError,
    NetworkError,
    AuthenticationError,
    ValidationError,
    NotFoundError
)

try:
    await client.save('key', data)
except NetworkError as e:
    print(f"Network connection failed: {e}")
except AuthenticationError as e:
    print(f"Invalid API key: {e}")
except ValidationError as e:
    print(f"Invalid data format: {e}")
except NotFoundError as e:
    print(f"Context not found: {e}")
except CloudContextError as e:
    print(f"General error: {e}")
```

## Advanced Usage

### Context Manager

Use the client as a context manager for automatic cleanup:

```python
async with CloudContext(endpoint, api_key) as client:
    await client.save('key', data)
    context = await client.get('key')
    # Client automatically closes when exiting the context
```

### Custom Session Configuration

```python
import aiohttp

# Custom session with specific settings
connector = aiohttp.TCPConnector(
    limit=100,
    limit_per_host=10,
    ttl_dns_cache=300
)

client = CloudContext(
    endpoint=endpoint,
    api_key=api_key,
    session=aiohttp.ClientSession(connector=connector)
)
```

### Batch Operations with Progress

```python
import asyncio
from typing import List, Dict, Any

async def save_contexts_with_progress(
    client: CloudContext,
    contexts: Dict[str, Any],
    batch_size: int = 10
) -> None:
    """Save contexts in batches with progress reporting."""
    items = list(contexts.items())
    
    for i in range(0, len(items), batch_size):
        batch = dict(items[i:i + batch_size])
        await client.bulk_save(batch)
        print(f"Saved batch {i // batch_size + 1}/{(len(items) + batch_size - 1) // batch_size}")
```

### Data Serialization

The client automatically handles JSON serialization, but you can customize it:

```python
import json
from datetime import datetime

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Custom serialization
client = CloudContext(
    endpoint=endpoint,
    api_key=api_key,
    json_encoder=DateTimeEncoder
)
```

### Caching

Enable local caching for improved performance:

```python
from cloudcontext import CloudContext
from cloudcontext.cache import MemoryCache

cache = MemoryCache(max_size=1000, ttl=300)  # 5-minute TTL
client = CloudContext(
    endpoint=endpoint,
    api_key=api_key,
    cache=cache
)

# Cached operations
await client.save('key', data)
context = await client.get('key')  # Retrieved from cache if available
```

## Configuration

### Environment Variables

Set default configuration using environment variables:

```bash
export CLOUDCONTEXT_ENDPOINT="https://your-worker.your-subdomain.workers.dev"
export CLOUDCONTEXT_API_KEY="your-api-key"
export CLOUDCONTEXT_TIMEOUT="30"
```

```python
from cloudcontext import CloudContext

# Automatically uses environment variables
client = CloudContext.from_env()
```

### Configuration File

Use a configuration file:

```python
# config.yaml
cloudcontext:
  endpoint: "https://your-worker.your-subdomain.workers.dev"
  api_key: "your-api-key"
  timeout: 30
  max_retries: 3
```

```python
import yaml
from cloudcontext import CloudContext

with open('config.yaml') as f:
    config = yaml.safe_load(f)['cloudcontext']

client = CloudContext(**config)
```

## Testing

The client includes utilities for testing:

```python
from cloudcontext.testing import MockCloudContext

# Use mock client in tests
async def test_my_function():
    mock_client = MockCloudContext()
    mock_client.set_response('user-123', {'data': 'test'})
    
    result = await my_function(mock_client)
    assert result == expected_result
```

## Requirements

- Python 3.8+
- aiohttp >= 3.8.0
- pydantic >= 1.10.0 (for data validation)

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
