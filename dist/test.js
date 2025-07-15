"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function test() {
    console.log('Testing speech service...');
    // Test system voice
    const systemSpeech = index_1.createSpeechService.forDevelopment();
    await systemSpeech.speak('Testing system voice');
    // Test OpenAI voice (if API key is available)
    const openaiSpeech = index_1.createSpeechService.forNotifications();
    await openaiSpeech.speak('Testing OpenAI voice with Nova');
    // Test queue and priority
    await openaiSpeech.speak('This is normal priority');
    await openaiSpeech.speak('This is high priority', { priority: 'high' });
    await openaiSpeech.speak('This is also normal priority');
    console.log('Test complete!');
}
test().catch(console.error);
//# sourceMappingURL=test.js.map