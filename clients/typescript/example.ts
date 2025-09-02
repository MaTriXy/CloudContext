/**
 * CloudContext TypeScript Client Example
 * 
 * Demonstrates professional usage patterns for the CloudContext client
 * with proper error handling and TypeScript best practices.
 */

import { CloudContext, CloudContextConfig, ContextMetadata } from './src/index';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface ConversationContext {
  messages: ConversationMessage[];
  settings: {
    model: string;
    temperature: number;
    maxTokens?: number;
  };
}

class CloudContextExample {
  private client: CloudContext;
  private contextId: string;

  constructor(config: CloudContextConfig) {
    this.client = new CloudContext(config);
    this.contextId = config.contextId;
  }

  /**
   * Demonstrates saving a conversation context
   */
  async saveConversation(): Promise<void> {
    const conversationData: ConversationContext = {
      messages: [
        {
          role: 'user',
          content: 'What are the best practices for TypeScript development?',
          timestamp: Date.now() - 5000
        },
        {
          role: 'assistant',
          content: 'Here are key TypeScript best practices: 1) Use strict mode, 2) Prefer interfaces over types for object shapes, 3) Use proper typing for async operations, 4) Leverage union types for better type safety.',
          timestamp: Date.now()
        }
      ],
      settings: {
        model: 'claude-3-sonnet',
        temperature: 0.7,
        maxTokens: 1000
      }
    };

    const metadata: ContextMetadata = {
      timestamp: Date.now(),
      source: 'typescript-professional-example',
      tags: ['conversation', 'typescript', 'best-practices'],
      version: '1.0.0'
    };

    await this.client.save(conversationData, metadata);
  }

  /**
   * Demonstrates retrieving and working with contexts
   */
  async processConversation(): Promise<ConversationContext | null> {
    try {
      const context = await this.client.get();
      return context as ConversationContext;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        // Handle missing context gracefully
        return null;
      }
      throw error;
    }
  }

  /**
   * Demonstrates context management operations
   */
  async manageContexts(): Promise<void> {
    // Check if we have cached data
    if (this.client.hasCached()) {
      const cacheSize = this.client.getCacheSize();
      // Use cache information for decisions
    }

    // List available contexts for management
    const contextList = await this.client.list();
    
    // Perform cleanup if needed
    const oldContexts = contextList.contexts.filter(ctx => 
      ctx.lastModified && 
      Date.now() - new Date(ctx.lastModified).getTime() > 30 * 24 * 60 * 60 * 1000 // 30 days
    );

    // Clean up old contexts (in a real app, you might want user confirmation)
    for (const oldContext of oldContexts.slice(0, 5)) { // Limit cleanup
      try {
        await this.client.delete();
        // Log cleanup activity if needed
      } catch (error) {
        // Handle cleanup errors gracefully
        continue;
      }
    }
  }

  /**
   * Complete example workflow
   */
  async runExample(): Promise<boolean> {
    try {
      // Save a sample conversation
      await this.saveConversation();

      // Process the saved conversation
      const conversation = await this.processConversation();
      if (!conversation) {
        return false;
      }

      // Validate the conversation structure
      if (!conversation.messages || !Array.isArray(conversation.messages)) {
        throw new Error('Invalid conversation structure');
      }

      // Perform context management
      await this.manageContexts();

      return true;

    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types appropriately
        switch (true) {
          case error.message.includes('authentication'):
            throw new Error('Authentication failed. Please check your API key.');
          case error.message.includes('network'):
            throw new Error('Network error. Please check your connection.');
          default:
            throw new Error(`CloudContext operation failed: ${error.message}`);
        }
      }
      throw error;
    }
  }
}

// Example usage function
async function demonstrateCloudContext(): Promise<void> {
  const config: CloudContextConfig = {
    baseUrl: process.env.CLOUDCONTEXT_API_URL || 'https://your-cloudcontext-api.com',
    apiKey: process.env.CLOUDCONTEXT_API_KEY || 'your-api-key',
    contextId: `example-${Date.now()}`
  };

  const example = new CloudContextExample(config);

  try {
    const success = await example.runExample();
    if (success) {
      // Success handling
      process.exit(0);
    } else {
      // Failure handling
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Example failed:', error.message);
    } else {
      console.error('Unexpected error occurred');
    }
    process.exit(1);
  }
}

// Export for use as module
export { CloudContextExample, ConversationContext, ConversationMessage };

// Run example if executed directly
if (require.main === module) {
  demonstrateCloudContext();
}
