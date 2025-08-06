// Test rate calculations to check precision and ranges

console.log('🔍 Testing SpeakEasy rate → OpenAI speed conversion');
console.log('Formula: speed = rate / 200\n');

const testRates = [80, 120, 150, 180, 200, 220, 250, 300, 400, 450];

console.log('Rate (WPM) → Speed (OpenAI) → Precision');
console.log('=======================================');

testRates.forEach(rate => {
  const speed = rate / 200;
  const isInteger = Number.isInteger(speed);
  const precision = speed.toString().split('.')[1]?.length || 0;
  
  console.log(`${rate.toString().padStart(3)} WPM    → ${speed.toFixed(3).padStart(5)}         → ${precision} decimal places ${isInteger ? '(integer)' : ''}`);
});

console.log('\n🔍 OpenAI Speed Parameter Analysis:');
console.log('- Valid range: 0.25 to 4.0 (according to typical TTS APIs)');
console.log('- Data type: Floating point number');
console.log('- Default: 1.0 (normal speed)');

console.log('\n🔍 Current Implementation Analysis:');
console.log('- Uses floating point division: config.rate / 200');
console.log('- No rounding applied');
console.log('- No bounds checking');

// Test edge cases
console.log('\n🔍 Edge Cases:');
const edgeCases = [50, 100, 800, 1000];
edgeCases.forEach(rate => {
  const speed = rate / 200;
  const inRange = speed >= 0.25 && speed <= 4.0;
  console.log(`${rate} WPM → ${speed} speed ${inRange ? '✅ in range' : '❌ out of range'}`);
});

console.log('\n💡 Recommendations:');
console.log('1. Add bounds checking: clamp speed between 0.25 and 4.0');
console.log('2. Consider rounding to 2 decimal places for consistency');
console.log('3. Document the 200 WPM = 1.0 speed baseline');