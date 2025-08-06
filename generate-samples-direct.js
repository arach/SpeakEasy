const fs = require('fs');
const path = require('path');

// Import the OpenAI provider directly
const { OpenAIProvider } = require('./dist/providers/openai.js');

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

async function generateSamples() {
  console.log('🎵 Generating audio samples for SpeakEasy demo...');
  
  // Ensure landing/public/audio directory exists
  const audioDir = path.join(__dirname, 'landing', 'public', 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log(`📁 Created directory: ${audioDir}`);
  }

  // Get OpenAI API key from environment
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    return;
  }

  // Create OpenAI provider
  const provider = new OpenAIProvider(openaiApiKey, 'nova');

  for (const sample of samples) {
    try {
      console.log(`🔊 Generating: ${sample.description}`);
      console.log(`💬 Text: "${sample.text}"`);
      
      const outputFile = path.join(audioDir, `${sample.name}.mp3`);
      
      // Generate audio buffer using the provider directly
      const config = {
        text: sample.text,
        voice: 'nova',
        tempDir: '/tmp',
        volume: 0.8
      };
      
      const audioBuffer = await provider.generateAudio(config);
      
      if (audioBuffer) {
        fs.writeFileSync(outputFile, audioBuffer);
        console.log(`✅ Generated: ${sample.name}.mp3 (${audioBuffer.length} bytes)`);
      } else {
        console.error(`❌ Failed to generate audio for ${sample.name}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${sample.name}:`, error.message);
    }
  }
  
  console.log('🎉 Sample generation complete!');
}

generateSamples().catch(console.error);