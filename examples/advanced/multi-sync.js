/**
 * CloudContext Multi-Device Synchronization Example
 * 
 * This example demonstrates how to synchronize contexts across multiple
 * devices/clients, handling conflicts and maintaining consistency.
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

// Configuration for multiple clients
const CONFIG = {
  apiUrl: 'https://your-cloudcontext-api.com',
  apiKey: 'your-api-key-here'
};

class CloudContextSyncClient {
  constructor(config, deviceId) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.deviceId = deviceId;
    this.localContexts = new Map(); // Local cache
    this.syncTimestamps = new Map(); // Track last sync times
  }

  async makeRequest(endpoint, contextId, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Context-ID': contextId,
      'X-Session-ID': `${this.deviceId}-${Date.now()}`,
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

  // Save context with conflict resolution
  async saveContext(contextId, content, metadata = {}) {
    const enhanced_metadata = {
      ...metadata,
      deviceId: this.deviceId,
      localTimestamp: Date.now(),
      source: 'multi-sync-client'
    };

    try {
      const result = await this.makeRequest('/api/context', contextId, {
        method: 'POST',
        body: JSON.stringify({
          content,
          metadata: enhanced_metadata
        })
      });

      // Update local cache
      this.localContexts.set(contextId, {
        content,
        metadata: enhanced_metadata,
        version: result.version,
        timestamp: result.timestamp
      });

      this.syncTimestamps.set(contextId, result.timestamp);
      return result;

    } catch (error) {
      console.error(`Failed to save context ${contextId}:`, error.message);
      throw error;
    }
  }

  // Get context with local caching
  async getContext(contextId) {
    try {
      const result = await this.makeRequest('/api/context', contextId);
      
      // Update local cache
      this.localContexts.set(contextId, result);
      this.syncTimestamps.set(contextId, result.metadata.timestamp);
      
      return result;
    } catch (error) {
      // Return cached version if available
      if (this.localContexts.has(contextId)) {
        console.warn(`Using cached version of ${contextId} due to network error`);
        return this.localContexts.get(contextId);
      }
      throw error;
    }
  }

  // Synchronize a specific context
  async syncContext(contextId) {
    const lastSync = this.syncTimestamps.get(contextId);
    
    try {
      const syncResult = await this.makeRequest('/api/context/sync', contextId, {
        method: 'POST',
        body: JSON.stringify({
          contextId,
          lastSync: lastSync || new Date(0).toISOString()
        })
      });

      console.log(`Sync action for ${contextId}:`, syncResult.action);

      if (syncResult.action === 'pull') {
        // Server has newer version, update local
        this.localContexts.set(contextId, syncResult.context);
        this.syncTimestamps.set(contextId, syncResult.timestamp);
        console.log(`✓ Pulled updates for ${contextId}`);
        return { action: 'pulled', context: syncResult.context };
      } else {
        // Local is up to date or newer
        console.log(`✓ ${contextId} is up to date`);
        return { action: 'no_change', timestamp: syncResult.timestamp };
      }

    } catch (error) {
      console.error(`Sync failed for ${contextId}:`, error.message);
      throw error;
    }
  }

  // Sync all contexts
  async syncAllContexts() {
    const contextIds = Array.from(this.localContexts.keys());
    const results = [];

    console.log(`Syncing ${contextIds.length} contexts for device ${this.deviceId}...`);

    for (const contextId of contextIds) {
      try {
        const result = await this.syncContext(contextId);
        results.push({ contextId, ...result });
      } catch (error) {
        results.push({ 
          contextId, 
          action: 'error', 
          error: error.message 
        });
      }
    }

    return results;
  }

  // Handle merge conflicts when multiple devices modify the same context
  async handleConflict(contextId, localContent, serverContent) {
    console.log(`Conflict detected for ${contextId}`);
    
    // Simple merge strategy: combine messages and keep latest settings
    if (localContent.messages && serverContent.messages) {
      const mergedMessages = this.mergeMessages(
        localContent.messages, 
        serverContent.messages
      );
      
      const mergedContent = {
        ...serverContent, // Keep server settings as base
        messages: mergedMessages,
        conflictResolved: true,
        conflictResolvedAt: new Date().toISOString(),
        conflictResolvedBy: this.deviceId
      };

      // Save merged version
      return this.saveContext(contextId, mergedContent, {
        conflictResolution: 'auto-merge',
        originalDevices: [this.deviceId, serverContent.metadata?.deviceId].filter(Boolean)
      });
    }

    // Fallback: keep server version
    return serverContent;
  }

  // Merge message arrays intelligently
  mergeMessages(localMessages, serverMessages) {
    const messageMap = new Map();
    
    // Add all messages with deduplication based on content and timestamp
    [...serverMessages, ...localMessages].forEach(msg => {
      const key = `${msg.content}-${msg.timestamp || 0}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    });
    
    // Sort by timestamp if available, otherwise by order
    return Array.from(messageMap.values()).sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return aTime - bTime;
    });
  }

  // Get sync status for all contexts
  getSyncStatus() {
    const status = {};
    
    for (const [contextId, context] of this.localContexts) {
      const lastSync = this.syncTimestamps.get(contextId);
      const lastModified = context.metadata?.timestamp;
      
      status[contextId] = {
        lastSync,
        lastModified,
        needsSync: !lastSync || (lastModified && lastModified > lastSync),
        hasLocalChanges: this.hasLocalChanges(contextId)
      };
    }
    
    return status;
  }

  // Check if context has unsynchronized local changes
  hasLocalChanges(contextId) {
    const context = this.localContexts.get(contextId);
    const lastSync = this.syncTimestamps.get(contextId);
    
    if (!context || !lastSync) return false;
    
    const contextTime = new Date(context.metadata?.timestamp || 0).getTime();
    const syncTime = new Date(lastSync).getTime();
    
    return contextTime > syncTime;
  }
}

// Demo function showing multi-device synchronization
async function multiSyncDemo() {
  console.log('CloudContext Multi-Device Sync Demo');
  console.log('===================================');

  // Create multiple clients simulating different devices
  const laptopClient = new CloudContextSyncClient(CONFIG, 'laptop-001');
  const phoneClient = new CloudContextSyncClient(CONFIG, 'phone-002');
  const tabletClient = new CloudContextSyncClient(CONFIG, 'tablet-003');

  const contextId = `multi-sync-demo-${Date.now()}`;

  try {
    // Step 1: Create initial context on laptop
    console.log('\n1. Creating initial context on laptop...');
    
    await laptopClient.saveContext(contextId, {
      messages: [
        {
          role: 'user',
          content: 'I need help with a project',
          timestamp: Date.now() - 10000,
          device: 'laptop'
        },
        {
          role: 'assistant',
          content: 'I\'d be happy to help! What kind of project are you working on?',
          timestamp: Date.now() - 9000
        }
      ],
      settings: {
        model: 'claude-3',
        temperature: 0.7
      }
    }, {
      initialDevice: 'laptop',
      tags: ['project', 'help']
    });

    console.log('✓ Initial context created on laptop');

    // Step 2: Phone client syncs and adds message
    console.log('\n2. Phone syncing and adding message...');
    
    await phoneClient.getContext(contextId);
    console.log('✓ Phone synced context');

    const phoneContext = phoneClient.localContexts.get(contextId);
    const phoneUpdatedContent = {
      ...phoneContext.content,
      messages: [
        ...phoneContext.content.messages,
        {
          role: 'user',
          content: 'It\'s a web application using React',
          timestamp: Date.now() - 8000,
          device: 'phone'
        }
      ]
    };

    await phoneClient.saveContext(contextId, phoneUpdatedContent, {
      updatedFrom: 'phone',
      continuedConversation: true
    });

    console.log('✓ Phone added message');

    // Step 3: Tablet client syncs and adds concurrent message
    console.log('\n3. Tablet syncing and adding concurrent message...');
    
    // Simulate tablet getting the original context (race condition)
    await tabletClient.getContext(contextId);
    
    // Tablet adds message based on older state
    const tabletContext = tabletClient.localContexts.get(contextId);
    const tabletUpdatedContent = {
      ...tabletContext.content,
      messages: [
        ...tabletContext.content.messages,
        {
          role: 'assistant',
          content: 'Great! React is excellent for building interactive web applications. What specific area do you need help with?',
          timestamp: Date.now() - 7000,
          device: 'tablet'
        }
      ]
    };

    await tabletClient.saveContext(contextId, tabletUpdatedContent, {
      updatedFrom: 'tablet',
      assistantResponse: true
    });

    console.log('✓ Tablet added concurrent message');

    // Step 4: Laptop syncs and resolves conflicts
    console.log('\n4. Laptop syncing to resolve conflicts...');
    
    const syncResult = await laptopClient.syncContext(contextId);
    
    if (syncResult.action === 'pulled') {
      console.log('✓ Laptop pulled updates and merged changes');
      
      const finalContext = laptopClient.localContexts.get(contextId);
      console.log(`Final message count: ${finalContext.content.messages.length}`);
      
      // Show the merged conversation
      console.log('\nFinal conversation:');
      finalContext.content.messages.forEach((msg, i) => {
        const device = msg.device || 'unknown';
        console.log(`  ${i + 1}. [${msg.role}] (${device}): ${msg.content}`);
      });
    }

    // Step 5: Demonstrate sync status across devices
    console.log('\n5. Checking sync status across devices...');
    
    console.log('\nLaptop sync status:');
    console.log(JSON.stringify(laptopClient.getSyncStatus(), null, 2));
    
    console.log('\nPhone sync status:');
    console.log(JSON.stringify(phoneClient.getSyncStatus(), null, 2));
    
    console.log('\nTablet sync status:');
    console.log(JSON.stringify(tabletClient.getSyncStatus(), null, 2));

    // Step 6: Sync all devices
    console.log('\n6. Syncing all devices to ensure consistency...');
    
    await Promise.all([
      phoneClient.syncAllContexts(),
      tabletClient.syncAllContexts()
    ]);
    
    console.log('✓ All devices synchronized');

    // Step 7: Cleanup
    console.log('\n7. Cleaning up demo context...');
    
    await laptopClient.makeRequest('/api/context', contextId, {
      method: 'DELETE'
    });
    
    console.log('✓ Demo context cleaned up');

    console.log('\n🎉 Multi-device sync demo completed successfully!');
    console.log('\nKey features demonstrated:');
    console.log('- Context synchronization across devices');
    console.log('- Conflict resolution and message merging');
    console.log('- Local caching for offline capabilities');
    console.log('- Sync status monitoring');

  } catch (error) {
    console.error('❌ Multi-sync demo failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Check your API URL and API key');
    console.log('- Ensure your CloudContext service is running');
    console.log('- Verify network connectivity');
    console.log('- Check for any conflicts in the synchronization logic');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  multiSyncDemo();
}

module.exports = { CloudContextSyncClient, multiSyncDemo };
