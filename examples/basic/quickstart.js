/**
 * CloudContext Quick Start Example
 * 
 * This example demonstrates the basic usage of CloudContext API
 * for storing and retrieving AI conversation contexts.
 */

const fetch = require('node-fetch');

// Configuration - Replace with your actual values
const CONFIG = {
  apiUrl: 'https://your-cloudcontext-api.com',
  apiKey: 'your-api-key-here',
  contextId: 'quickstart-demo'
};

class CloudContextClient {
  constructor(config) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.contextId = config.contextId;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Context-ID': this.contextId,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error}`);
    }

    return response.json();
  }

  async saveContext(content, metadata = {}) {
    return this.makeRequest('/api/context', {
      method: 'POST',
      body: JSON.stringify({
        content,
        metadata
      })
    });
  }

  async getContext() {
    return this.makeRequest('/api/context');
  }

  async deleteContext() {
    return this.makeRequest('/api/context', { method: 'DELETE' });
  }

  async listContexts() {
    return this.makeRequest('/api/context/list');
  }
}

async function quickStartDemo() {
  console.log('CloudContext Quick Start Demo');
  console.log('================================');

  const client = new CloudContextClient(CONFIG);

  try {
    // Step 1: Save a conversation context
    console.log('\n1. Saving conversation context...');
    
    const conversationContext = {
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you help me understand how CloudContext works?'
        },
        {
          role: 'assistant',
          content: 'Certainly! CloudContext is a secure system for storing and retrieving AI conversation contexts. It allows you to maintain context across multiple interactions with AI models.'
        },
        {
          role: 'user',
          content: 'That sounds useful. How do I get started?'
        }
      ],
      settings: {
        model: 'claude-3',
        temperature: 0.7,
        maxTokens: 1000
      }
    };

    const saveResult = await client.saveContext(conversationContext, {
      source: 'quickstart-demo',
      tags: ['demo', 'conversation'],
      description: 'Initial quickstart conversation'
    });

    console.log('✓ Context saved successfully!');
    console.log('  Version:', saveResult.version);
    console.log('  Timestamp:', saveResult.timestamp);

    // Step 2: Retrieve the context
    console.log('\n2. Retrieving context...');
    
    const retrievedContext = await client.getContext();
    console.log('✓ Context retrieved successfully!');
    console.log('  Messages count:', retrievedContext.content.messages.length);
    console.log('  Last message:', retrievedContext.content.messages[retrievedContext.content.messages.length - 1].content);

    // Step 3: Add more to the conversation
    console.log('\n3. Adding more to the conversation...');
    
    const updatedContext = {
      ...retrievedContext.content,
      messages: [
        ...retrievedContext.content.messages,
        {
          role: 'assistant',
          content: 'Getting started is easy! Just use the API endpoints to save and retrieve your conversation contexts. The system handles encryption, versioning, and synchronization automatically.'
        },
        {
          role: 'user',
          content: 'Perfect! This will be very helpful for my AI application.'
        }
      ]
    };

    const updateResult = await client.saveContext(updatedContext, {
      source: 'quickstart-demo',
      tags: ['demo', 'conversation', 'updated'],
      description: 'Updated conversation with more messages'
    });

    console.log('✓ Context updated successfully!');
    console.log('  New version:', updateResult.version);

    // Step 4: List all contexts (if you have multiple)
    console.log('\n4. Listing all contexts...');
    
    const contextList = await client.listContexts();
    console.log('✓ Found contexts:', contextList.contexts.length);
    contextList.contexts.forEach(ctx => {
      console.log(`  - ${ctx.contextId} (last modified: ${ctx.lastModified})`);
    });

    // Step 5: Clean up (optional)
    console.log('\n5. Cleaning up demo context...');
    
    const deleteResult = await client.deleteContext();
    console.log('✓ Demo context deleted successfully!');
    console.log('  Files deleted:', deleteResult.deleted);

    console.log('\n🎉 Quick start demo completed successfully!');
    console.log('\nNext steps:');
    console.log('- Replace the CONFIG values with your actual API details');
    console.log('- Integrate CloudContext into your AI application');
    console.log('- Explore advanced features like synchronization and versioning');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Check your API URL and API key');
    console.log('- Ensure your CloudContext service is running');
    console.log('- Verify network connectivity');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  quickStartDemo();
}

module.exports = { CloudContextClient, quickStartDemo };
