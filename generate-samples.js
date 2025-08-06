const { SpeakEasy } = require('./dist/index.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

  // We'll use the CLI to generate files since the library currently doesn't support file output
  for (const sample of samples) {
    try {
      console.log(`🔊 Generating: ${sample.description}`);
      console.log(`💬 Text: "${sample.text}"`);
      
      const outputFile = path.join(audioDir, `${sample.name}.mp3`);
      
      // Use the CLI with a custom temp directory we can access  
      const tempDir = path.join(__dirname, 'temp-audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Use the CLI directly to generate and save files
      const command = `node dist/bin/speakeasy-cli.js "${sample.text}" --provider openai --voice nova --output "${outputFile}"`;
      console.log(`🔧 Running: ${command}`);
      
      try {
        execSync(command, { stdio: 'inherit' });
        
        // Check if file was created
        if (fs.existsSync(outputFile)) {
          console.log(`✅ Generated: ${sample.name}.mp3`);
        } else {
          console.error(`❌ File not created: ${sample.name}.mp3`);
        }
      } catch (cliError) {
        console.error(`❌ CLI error for ${sample.name}:`, cliError.message);
        
        // Fallback: try the library approach and manually copy
        const { SpeakEasy } = require('./dist/index.js');
        const speakEasy = new SpeakEasy({
          provider: 'openai',
          openaiVoice: 'nova',
          tempDir: tempDir
        });
        
        // Monitor temp directory before calling speak
        const beforeFiles = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
        
        await speakEasy.speak(sample.text);
        
        // Check for new files
        const afterFiles = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
        const newFiles = afterFiles.filter(f => !beforeFiles.includes(f) && f.startsWith('speech_') && f.endsWith('.mp3'));
        
        if (newFiles.length > 0) {
          const sourcePath = path.join(tempDir, newFiles[0]);
          fs.copyFileSync(sourcePath, outputFile);
          console.log(`✅ Generated (fallback): ${sample.name}.mp3`);
          fs.unlinkSync(sourcePath);
        } else {
          console.error(`❌ No temp file found for ${sample.name}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${sample.name}:`, error.message);
    }
  }
  
  // Clean up temp directory
  const tempDir = path.join(__dirname, 'temp-audio');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  
  console.log('🎉 Sample generation complete!');
}

generateSamples().catch(console.error);