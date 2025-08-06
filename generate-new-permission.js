const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generateNewPermission() {
  console.log('🔊 Generating corrected permission audio...');
  
  const audioDir = path.join(__dirname, 'landing', 'public', 'audio');
  const cacheDir = '/tmp/speakeasy-cache';
  
  // Generate the audio
  console.log('Generating: "In SpeakEasy, Claude needs your permission"');
  execSync('speakeasy "In SpeakEasy, Claude needs your permission" --provider openai --voice nova', { stdio: 'inherit' });
  
  // Find the most recent cache file
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
      const targetFile = path.join(audioDir, 'permission.mp3');
      fs.copyFileSync(files[0].path, targetFile);
      console.log(`✅ Updated: permission.mp3`);
      
      const stats = fs.statSync(targetFile);
      console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
    } else {
      console.error('❌ No cache files found');
    }
  } else {
    console.error('❌ Cache directory not found');
  }
}

generateNewPermission().catch(console.error);