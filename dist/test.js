"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function testSystem() {
    console.log('\nTesting system provider...');
    await (0, index_1.say)('Testing system voice', 'system');
}
async function testOpenAI() {
    console.log('\nTesting OpenAI provider...');
    await (0, index_1.say)('Testing OpenAI voice', 'openai');
}
async function testElevenLabs() {
    console.log('\nTesting ElevenLabs provider...');
    await (0, index_1.say)('Testing ElevenLabs voice', 'elevenlabs');
}
async function testGroq() {
    console.log('\nTesting Groq provider...');
    await (0, index_1.say)('Testing Groq voice', 'groq');
}
async function testAll() {
    await testSystem();
    await testOpenAI();
    await testElevenLabs();
    await testGroq();
    console.log('Test complete!');
}
if (require.main === module) {
    const [, , ...args] = process.argv;
    const provider = args[0];
    (async () => {
        try {
            switch (provider) {
                case undefined:
                case 'all':
                    await testAll();
                    break;
                case 'system':
                    await testSystem();
                    break;
                case 'openai':
                    await testOpenAI();
                    break;
                case 'elevenlabs':
                    await testElevenLabs();
                    break;
                case 'groq':
                    await testGroq();
                    break;
                default:
                    console.log('Unknown provider:', provider);
                    console.log('Providers: system, openai, elevenlabs, groq, all');
                    process.exit(1);
            }
        }
        catch (err) {
            console.error('Error:', err);
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=test.js.map