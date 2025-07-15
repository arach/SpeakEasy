"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.speak = exports.say = exports.SpeakEasy = exports.CONFIG_FILE = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
exports.CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
function loadGlobalConfig() {
    try {
        if (fs.existsSync(exports.CONFIG_FILE)) {
            const configData = fs.readFileSync(exports.CONFIG_FILE, 'utf8');
            return JSON.parse(configData);
        }
    }
    catch (error) {
        console.warn('Failed to load global config:', error);
    }
    return {};
}
class SpeakEasy {
    constructor(config) {
        this.isPlaying = false;
        this.queue = [];
        const globalConfig = loadGlobalConfig();
        this.config = {
            provider: config.provider || globalConfig.defaults?.provider || 'system',
            systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || 'Samantha',
            openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || 'nova',
            elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || 'EXAVITQu4vr4xnSDxMaL',
            rate: config.rate || globalConfig.defaults?.rate || 180,
            apiKeys: {
                openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || '',
                elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || '',
                groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || '',
            },
            tempDir: config.tempDir || globalConfig.global?.tempDir || '/tmp',
        };
    }
    async speak(text, options = {}) {
        const cleanText = this.cleanTextForSpeech(text);
        if (options.interrupt && this.isPlaying) {
            this.stopSpeaking();
        }
        if (options.priority === 'high') {
            this.queue.unshift({ text: cleanText, options });
        }
        else {
            this.queue.push({ text: cleanText, options });
        }
        if (!this.isPlaying) {
            await this.processQueue();
        }
    }
    async processQueue() {
        if (this.queue.length === 0)
            return;
        this.isPlaying = true;
        const { text, options } = this.queue.shift();
        try {
            await this.speakText(text);
        }
        catch (error) {
            console.error('Speech error:', error);
        }
        finally {
            this.isPlaying = false;
            // Process next item in queue
            if (this.queue.length > 0) {
                await this.processQueue();
            }
        }
    }
    async speakText(text) {
        switch (this.config.provider) {
            case 'openai':
                await this.speakWithOpenAI(text);
                break;
            case 'elevenlabs':
                await this.speakWithElevenLabs(text);
                break;
            case 'groq':
                await this.speakWithGroq(text);
                break;
            case 'system':
            default:
                await this.speakWithSystem(text);
                break;
        }
    }
    cleanTextForSpeech(text) {
        return text
            .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
            .replace(/[^\w\s.,!?'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    async speakWithSystem(text) {
        try {
            const command = `say -v ${this.config.systemVoice} -r ${this.config.rate} "${text.replace(/"/g, '\\"')}"`;
            (0, child_process_1.execSync)(command);
        }
        catch (error) {
            throw new Error(`System TTS failed: ${error}`);
        }
    }
    async speakWithOpenAI(text) {
        const openaiKey = this.config.apiKeys.openai;
        console.log('speakWithOpenAI: checking API key...');
        console.log('  config.apiKeys.openai:', this.config.apiKeys.openai);
        console.log('  resolved openaiKey:', openaiKey);
        console.log('  process.env.OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
        if (!openaiKey) {
            console.warn('No OpenAI API key, falling back to system voice');
            return this.speakWithSystem(text);
        }
        try {
            const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKeys.openai}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    voice: this.config.openaiVoice,
                    input: text,
                    speed: this.config.rate / 200,
                }),
            });
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }
            const audioBuffer = await response.arrayBuffer();
            fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
            (0, child_process_1.execSync)(`afplay "${tempFile}"`);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
        catch (error) {
            console.warn('OpenAI TTS failed, falling back to system voice:', error);
            return this.speakWithSystem(text);
        }
    }
    async speakWithElevenLabs(text) {
        const elevenlabsKey = this.config.apiKeys.elevenlabs;
        console.log('speakWithElevenLabs: checking API key...');
        console.log('  config.apiKeys.elevenlabs:', this.config.apiKeys.elevenlabs);
        console.log('  resolved elevenlabsKey:', elevenlabsKey);
        console.log('  process.env.ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY);
        if (!elevenlabsKey) {
            console.warn('No ElevenLabs API key, falling back to system voice');
            return this.speakWithSystem(text);
        }
        const BALANCED = 0.5;
        const NATURAL = 0.5;
        try {
            const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
            const response = await (0, node_fetch_1.default)(`https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabsVoiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.config.apiKeys.elevenlabs || '',
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: BALANCED,
                        similarity_boost: NATURAL,
                    },
                }),
            });
            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }
            const audioBuffer = await response.arrayBuffer();
            fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
            (0, child_process_1.execSync)(`afplay "${tempFile}"`);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
        catch (error) {
            console.warn('ElevenLabs TTS failed, falling back to system voice:', error);
            return this.speakWithSystem(text);
        }
    }
    async speakWithGroq(text) {
        const groqKey = this.config.apiKeys.groq;
        console.log('speakWithGroq - API key:', groqKey);
        if (!groqKey) {
            console.warn('No Groq API key, falling back to system voice');
            return this.speakWithSystem(text);
        }
        try {
            const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
            const response = await (0, node_fetch_1.default)('https://api.groq.com/openai/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'playai-tts',
                    voice: 'Celeste-PlayAI',
                    input: text,
                    speed: this.config.rate / 200,
                }),
            });
            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status}`);
            }
            const audioBuffer = await response.arrayBuffer();
            fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
            (0, child_process_1.execSync)(`afplay "${tempFile}"`);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
        catch (error) {
            console.warn('***** Groq TTS failed, falling back to system voice:', error);
            return this.speakWithSystem(text);
        }
    }
    stopSpeaking() {
        try {
            // Kill any running 'say' or 'afplay' processes
            (0, child_process_1.execSync)('pkill -f "say|afplay"', { stdio: 'ignore' });
        }
        catch (error) {
        }
    }
    clearQueue() {
        this.queue = [];
    }
}
exports.SpeakEasy = SpeakEasy;
// Convenience functions with provider override
const say = (text, provider) => {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Text argument is required for say()');
    }
    return new SpeakEasy({ provider: provider || 'system' }).speak(text);
};
exports.say = say;
const speak = (text, options) => {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Text argument is required for speak()');
    }
    const { provider, ...speakOptions } = options || {};
    return new SpeakEasy({ provider: provider || 'system' }).speak(text, speakOptions);
};
exports.speak = speak;
//# sourceMappingURL=index.js.map