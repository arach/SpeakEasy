#!/usr/bin/env node

/**
 * Simple TypeScript example for the Speakeasy library
 * Shows basic usage with type safety
 */

import { SpeechService, createSpeechService } from '../dist/index.js';

async function simpleExample() {
  console.log('🎤 Simple TypeScript Speech Service Examples\n');

  // Example 1: Basic usage with factory function
  console.log('1️⃣  Using factory function:');
  const speech = createSpeechService.forDevelopment();
  await speech.speak('Hello from TypeScript!');

  // Example 2: Custom configuration
  console.log('2️⃣  Custom configuration:');
  const custom = new SpeechService({
    provider: 'system',
    systemVoice: 'Alex',
    rate: 200,
  });
  await custom.speak('This uses system voice with custom settings');

  // Example 3: Priority queue
  console.log('3️⃣  Priority queue:');
  await speech.speak('This is normal priority');
  await speech.speak('This is high priority', { priority: 'high' });
  await speech.speak('This is low priority', { priority: 'low' });

  console.log('\n✅ All simple examples completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleExample().catch(console.error);
}