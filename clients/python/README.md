# CloudContext Python Client

An async Python client for CloudContext - secure, global AI context storage using Cloudflare R2.

## Installation

```bash
pip install cloudcontext-python-client
```

## Usage

### Basic Setup

```python
import asyncio
from client import CloudContext

async def main():
    async with CloudContext(
        base_url='https://your-cloudcontext-api.com',
        api_key='your-api-key',
        context_id='my-context'  # optional, defaults to 'default'
    ) as client:
        # Your operations here
        pass

asyncio.run(main())
```

### Save Context

```python
async with CloudContext(base_url='...', api_key='...') as client:
    content = {
        'message': 'Hello, world!',
        'data': [1, 2, 3, 4, 5]
    }
    
    metadata = {
        'timestamp': time.time(),
        'source': 'user-input',
        'tags': ['important', 'ai-context']
    }
    
    result = await client.save(content, metadata)
    print(f"Saved: {result.success}, ID: {result.context_id}")
```

### Retrieve Context

```python
async with CloudContext(base_url='...', api_key='...') as client:
    # Get default context
    context = await client.get()
    print(f"Content: {context['content']}")
    print(f"Metadata: {context['metadata']}")
    
    # Get specific context
    specific_context = await client.get('another-context')
```

### List All Contexts

```python
async with CloudContext(base_url='...', api_key='...') as client:
    contexts = await client.list()
    print(f"Available contexts: {contexts}")
```

### Delete Context

```python
async with CloudContext(base_url='...', api_key='...') as client:
    # Delete default context
    await client.delete()
    
    # Delete specific context
    await client.delete('specific-context')
```

## Development

### Running Tests

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=client --cov-report=html

# Run only unit tests
pytest -m "not integration"

# Run only integration tests (requires real API)
CLOUDCONTEXT_BASE_URL=https://your-api.com CLOUDCONTEXT_API_KEY=your-key pytest -m integration
```

### Test Configuration

Set environment variables for integration tests:
- `CLOUDCONTEXT_BASE_URL`: Your CloudContext API endpoint
- `CLOUDCONTEXT_API_KEY`: Your API key

## Error Handling

```python
async with CloudContext(base_url='...', api_key='...') as client:
    try:
        result = await client.save({'test': 'data'})
    except Exception as e:
        print(f"Error: {e}")
```

## Data Types

The client uses Python dataclasses for structured responses:

```python
from client import SaveResult

# SaveResult contains:
# - success: bool
# - context_id: str  
# - version: int
# - timestamp: str
```

## License

MIT
