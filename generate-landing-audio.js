#!/usr/bin/env node

const { SpeakEasy } = require('./dist/index.js');
const fs = require('fs');
const path = require('path');

async function generateLandingPageAudio() {
  console.log('🎙️  Generating audio files for landing page...');
  
  const speakeasy = new SpeakEasy({
    provider: 'openai',
    openaiVoice: 'nova',
    rate: 180,
    cache: { enabled: true } // Enable cache so we can access the files
  });
  
  const audioFiles = [
    {
      text: "In speakeasy, Claude is waiting for you",
      filename: "permission.mp3",
      description: "Permission request notification"
    },
    {
      text: "In speakeasy, Claude is waiting for your input", 
      filename: "waiting-input.mp3",
      description: "Input waiting notification"
    },
    {
      text: "In speakeasy, Notification received",
      filename: "build-complete.mp3", 
      description: "General notification"
    }
  ];
  
  const outputDir = path.join(__dirname, 'landing', 'public', 'audio');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (const audio of audioFiles) {
    try {
      console.log(`\n📝 Generating: "${audio.text}"`);
      console.log(`📁 Saving as: ${audio.filename}`);
      
      // Generate audio and get cache stats to find the file
      await speakeasy.speak(audio.text);
      const cacheStats = await speakeasy.getCacheStats();
      
      if (!cacheStats.dir) {
        throw new Error('Cache directory not found');
      }
      
      // Find the most recent cache entry for this text
      const { TTSCache } = require('./dist/cache.js');
      const cache = new TTSCache(cacheStats.dir, '7d');
      const recentEntries = await cache.getRecent(5);
      
      // Find the entry that matches our text
      const matchingEntry = recentEntries.find(entry => 
        entry.originalText.toLowerCase().includes(audio.text.toLowerCase().replace(/[^\w\s]/g, ''))
      );
      
      if (!matchingEntry) {
        throw new Error(`No cache entry found for: ${audio.text}`);
      }
      
      const sourceFile = matchingEntry.filePath;
      const outputPath = path.join(outputDir, audio.filename);
      
      // Copy the cached file to the correct location
      if (!fs.existsSync(sourceFile)) {
        throw new Error(`Source file not found: ${sourceFile}`);
      }
      
      fs.copyFileSync(sourceFile, outputPath);
      
      // Get file size for confirmation
      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      console.log(`✅ Generated ${audio.filename} (${sizeKB} KB)`);
      console.log(`   Content: ${audio.description}`);
      console.log(`   Source: ${sourceFile}`);
      
      // Small delay between generations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error generating ${audio.filename}:`, error.message);
    }
  }
  
  console.log('\n🎉 Audio generation complete!');
  console.log(`📁 Files saved to: ${outputDir}`);
  console.log('\n💡 You can now test the landing page with the new audio files.');
}

// Run the generator
generateLandingPageAudio().catch(console.error);