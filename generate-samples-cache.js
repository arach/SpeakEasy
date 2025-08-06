const { SpeakEasy } = require('./dist/index.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const samples = [
  {
    name: 'permission',
    text: 'In SpeakEasy, Claude needs your permission',
    description: 'Permission request notification'
  },
  {
    name: 'build-complete', 
    text: 'Build completed successfully in your project',
    description: 'Build completion notification'
  },
  {
    name: 'waiting-input',
    text: 'Claude is waiting for your input',
    description: 'Input waiting notification'
  }
];

function generateCacheKey(text, provider, voice) {
  const content = `${text}:${provider}:${voice}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

async function generateSamples() {
  console.log('🎵 Generating audio samples for SpeakEasy demo...');
  
  // Ensure landing/public/audio directory exists
  const audioDir = path.join(__dirname, 'landing', 'public', 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log(`📁 Created directory: ${audioDir}`);
  }

  const speakEasy = new SpeakEasy({
    provider: 'openai',
    openaiVoice: 'nova',
    cache: {
      enabled: true,
      dir: path.join(__dirname, 'temp-cache')
    },
    debug: false
  });

  for (const sample of samples) {
    try {
      console.log(`🔊 Generating: ${sample.description}`);
      console.log(`💬 Text: "${sample.text}"`);
      
      const outputFile = path.join(audioDir, `${sample.name}.mp3`);
      
      // Generate audio - this will create cache files
      await speakEasy.speak(sample.text);
      
      // Try to find the cached file
      const cacheKey = generateCacheKey(sample.text, 'openai', 'nova');
      const cacheDir = path.join(__dirname, 'temp-cache');
      const cachedAudioFile = path.join(cacheDir, `${cacheKey}.mp3`);
      
      if (fs.existsSync(cachedAudioFile)) {
        fs.copyFileSync(cachedAudioFile, outputFile);
        console.log(`✅ Generated: ${sample.name}.mp3`);
      } else {
        // Try to find any recent mp3 files in cache
        if (fs.existsSync(cacheDir)) {
          const files = fs.readdirSync(cacheDir)
            .filter(f => f.endsWith('.mp3'))
            .map(f => ({
              name: f,
              path: path.join(cacheDir, f),
              time: fs.statSync(path.join(cacheDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);
            
          if (files.length > 0) {
            fs.copyFileSync(files[0].path, outputFile);
            console.log(`✅ Generated (from cache): ${sample.name}.mp3`);
          } else {
            console.error(`❌ No cached file found for ${sample.name}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${sample.name}:`, error.message);
    }
  }
  
  // Clean up temp cache
  const tempCache = path.join(__dirname, 'temp-cache');
  if (fs.existsSync(tempCache)) {
    fs.rmSync(tempCache, { recursive: true });
  }
  
  console.log('🎉 Sample generation complete!');
}

generateSamples().catch(console.error);