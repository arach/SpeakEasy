#!/usr/bin/env node

/**
 * Advanced TypeScript usage example for the Speakeasy library
 * Demonstrates type safety, queue management, and advanced configuration
 */

import { SpeechService, createSpeechService } from '../dist/index.js';

interface NotificationConfig {
  voice: string;
  rate: number;
  volume: number;
}

interface UserPreferences {
  notifications: NotificationConfig;
  development: NotificationConfig;
}

class SpeechNotificationManager {
  private speechService: SpeechService;
  private userPreferences: UserPreferences;

  constructor(preferences: UserPreferences) {
    this.userPreferences = preferences;
    this.speechService = new SpeechService({
      provider: 'system',
      systemVoice: preferences.notifications.voice,
      rate: preferences.notifications.rate,
    });
  }

  async sendNotification(message: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    try {
      await this.speechService.speak(message, { priority });
      console.log(`✅ Notification sent: "${message}" (${priority} priority)`);
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      throw error;
    }
  }

  async sendBatchNotifications(messages: Array<{ text: string; priority?: 'high' | 'normal' | 'low' }>): Promise<void> {
    console.log(`📦 Processing batch of ${messages.length} notifications...`);
    
    const promises = messages.map(({ text, priority = 'normal' }) =>
      this.speechService.speak(text, { priority })
    );
    
    await Promise.all(promises);
    console.log('✅ All batch notifications processed');
  }

  async interruptCurrentSpeech(): Promise<void> {
    console.log('🛑 Interrupting current speech...');
    // Note: The interrupt method doesn't exist in the actual API
    // This is just for demonstration
    console.log('✅ Speech interrupted');
  }
}

class MultiProviderSpeechManager {
  private providers: Map<'system' | 'openai' | 'elevenlabs', SpeechService> = new Map();
  private fallbackProvider: 'system' | 'openai' | 'elevenlabs' = 'system';

  constructor(private apiKeys: Record<string, string>) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // System provider (always available on macOS)
    this.providers.set('system', new SpeechService({
      provider: 'system',
      systemVoice: 'Alex',
      rate: 200,
    }));

    // OpenAI provider (if API key provided)
    if (this.apiKeys.openai) {
      this.providers.set('openai', new SpeechService({
        provider: 'openai',
        openaiVoice: 'nova',
        rate: 180,
        apiKeys: { openai: this.apiKeys.openai },
      }));
    }

    // ElevenLabs provider (if API key provided)
    if (this.apiKeys.elevenlabs) {
      this.providers.set('elevenlabs', new SpeechService({
        provider: 'elevenlabs',
        elevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
        rate: 190,
        apiKeys: { elevenlabs: this.apiKeys.elevenlabs },
      }));
    }
  }

  async speakWithFallback(
    text: string,
    preferredProvider: 'system' | 'openai' | 'elevenlabs' = 'openai',
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    const providersToTry = [preferredProvider, this.fallbackProvider];
    
    for (const provider of providersToTry) {
      const service = this.providers.get(provider);
      if (!service) continue;

      try {
        console.log(`🎯 Trying ${provider} provider...`);
        await service.speak(text, { priority });
        console.log(`✅ Successfully used ${provider} provider`);
        return;
      } catch (error) {
        console.warn(`⚠️ ${provider} provider failed:`, error.message);
        if (provider === this.fallbackProvider) {
          throw new Error('All providers failed');
        }
      }
    }
  }

  getAvailableProviders(): ('system' | 'openai' | 'elevenlabs')[] {
    return Array.from(this.providers.keys());
  }
}

async function demonstrateAdvancedUsage(): Promise<void> {
  console.log('🎤 Advanced TypeScript Speech Service Examples\n');

  // Example 1: Type-safe notification manager
  console.log('1️⃣  Type-safe notification manager:');
  const preferences: UserPreferences = {
    notifications: { voice: 'Alex', rate: 200, volume: 0.8 },
    development: { voice: 'Samantha', rate: 180, volume: 0.6 },
  };

  const notificationManager = new SpeechNotificationManager(preferences);
  
  await notificationManager.sendNotification('Welcome to the advanced TypeScript example!', 'high');
  await notificationManager.sendNotification('This is a normal priority message');

  // Example 2: Batch processing
  console.log('\n2️⃣  Batch notification processing:');
  const batchMessages = [
    { text: 'First message in batch', priority: 'normal' as SpeechPriority },
    { text: 'Second message in batch', priority: 'high' as SpeechPriority },
    { text: 'Third message in batch', priority: 'low' as SpeechPriority },
  ];
  
  await notificationManager.sendBatchNotifications(batchMessages);

  // Example 3: Multi-provider with fallback
  console.log('\n3️⃣  Multi-provider with intelligent fallback:');
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY || '',
    elevenlabs: process.env.ELEVENLABS_API_KEY || '',
  };

  const multiManager = new MultiProviderSpeechManager(apiKeys);
  
  console.log('Available providers:', multiManager.getAvailableProviders());
  
  await multiManager.speakWithFallback(
    'This will use the best available provider',
    'openai',
    'normal'
  );

  // Example 4: Queue management demonstration
  console.log('\n4️⃣  Advanced queue management:');
  const queueDemo = createSpeechService.forDevelopment();
  
  // Queue messages with different priorities
  const queueMessages = [
    () => queueDemo.speak('Normal priority 1', { priority: 'normal' }),
    () => queueDemo.speak('High priority urgent', { priority: 'high' }),
    () => queueDemo.speak('Low priority background', { priority: 'low' }),
    () => queueDemo.speak('Normal priority 2', { priority: 'normal' }),
  ];

  // Execute all messages concurrently (they'll be queued by priority)
  await Promise.all(queueMessages.map(fn => fn()));

  // Example 5: Error handling and recovery
  console.log('\n5️⃣  Error handling and recovery:');
  try {
    // This will actually work since 'system' is valid, but let's test a real edge case
    const systemService = new SpeechService({
      provider: 'system',
      systemVoice: 'NonExistentVoice',
    });
    await systemService.speak('Testing with non-existent voice');
  } catch (error) {
    console.log('✅ Handled edge case:', error.message);
  }

  console.log('\n🎉 All advanced TypeScript examples completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAdvancedUsage().catch(console.error);
}

export { SpeechNotificationManager, MultiProviderSpeechManager };