/**
 * CloudContext TypeScript Client Example
 */

import { CloudContext, CloudContextConfig, ContextMetadata } from './src/index';

// Example usage
async function example() {
  // Configuration with proper typing
  const config: CloudContextConfig = {
    baseUrl: 'https://your-cloudcontext-api.com',
    apiKey: 'your-api-key',
    contextId: 'example-context'
  };

  // Create client instance
  const client = new CloudContext(config);

  try {
    // Save context with metadata
    const metadata: ContextMetadata = {
      timestamp: Date.now(),
      source: 'typescript-example',
      tags: ['demo', 'typescript']
    };

    const saveResponse = await client.save('Hello from TypeScript!', metadata);
    console.log('Saved:', saveResponse);

    // Retrieve context
    const context = await client.get();
    console.log('Retrieved:', context);

    // List all contexts
    const contexts = await client.list();
    console.log('All contexts:', contexts);

    // Cache operations
    console.log('Is cached:', client.hasCached());
    console.log('Cache size:', client.getCacheSize());

    // Clean up
    await client.delete();
    console.log('Context deleted');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run example (uncomment to test)
// example();
