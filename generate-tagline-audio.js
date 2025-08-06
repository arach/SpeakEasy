#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const text = "Simple text-to-speech for all your projects. Multiple providers, smart caching, and volume control.";
const outputPath = path.join(__dirname, 'landing/public/audio/tagline-demo.mp3');

console.log('🎵 Generating tagline audio...');
console.log(`Text: "${text}"`);
console.log(`Output: ${outputPath}`);

try {
  // Build the CLI first to ensure we have the latest version
  console.log('📦 Building SpeakEasy CLI...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Generate the audio using the built CLI
  console.log('🔊 Generating audio...');
  const command = `node dist/bin/speakeasy-cli.js "${text}" --provider openai --voice nova --out "${outputPath}"`;
  console.log(`Running: ${command}`);
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('✅ Tagline audio generated successfully!');
  console.log(`📁 Saved to: ${outputPath}`);
  
} catch (error) {
  console.error('❌ Error generating tagline audio:', error.message);
  console.log('💡 Make sure you have OPENAI_API_KEY set in your environment');
  process.exit(1);
}