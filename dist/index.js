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
exports.defaultSpeechService = exports.createSpeechService = exports.SpeechService = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speech');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
function loadGlobalConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(configData);
        }
    }
    catch (error) {
        console.warn('Failed to load global config:', error);
    }
    return {};
}
class SpeechService {
    constructor(config) {
        this.isPlaying = false;
        this.queue = [];
        const globalConfig = loadGlobalConfig();
        this.config = {
            provider: config.provider || globalConfig.provider || 'system',
            systemVoice: config.systemVoice || globalConfig.systemVoice || 'Samantha',
            openaiVoice: config.openaiVoice || globalConfig.openaiVoice || 'nova',
            elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL',
            rate: config.rate || globalConfig.rate || 180,
            apiKeys: {
                openai: config.apiKeys?.openai || globalConfig.apiKeys?.openai || process.env.OPENAI_API_KEY,
                elevenlabs: config.apiKeys?.elevenlabs || globalConfig.apiKeys?.elevenlabs || process.env.ELEVENLABS_API_KEY,
            },
            tempDir: config.tempDir || globalConfig.tempDir || '/tmp',
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
        if (!this.config.apiKeys.openai) {
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
        if (!this.config.apiKeys.elevenlabs) {
            console.warn('No ElevenLabs API key, falling back to system voice');
            return this.speakWithSystem(text);
        }
        try {
            const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
            const response = await (0, node_fetch_1.default)(`https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabsVoiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.config.apiKeys.elevenlabs,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5,
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
    stopSpeaking() {
        try {
            // Kill any running 'say' or 'afplay' processes
            (0, child_process_1.execSync)('pkill -f "say|afplay"', { stdio: 'ignore' });
        }
        catch (error) {
            // Ignore if no processes to kill
        }
    }
    clearQueue() {
        this.queue = [];
    }
}
exports.SpeechService = SpeechService;
// Factory function for common configurations
exports.createSpeechService = {
    forNotifications: () => new SpeechService({
        provider: 'openai',
        openaiVoice: 'nova',
        rate: 180,
    }),
    forDevelopment: () => new SpeechService({
        provider: 'system',
        systemVoice: 'Samantha',
        rate: 200,
    }),
    forProduction: () => new SpeechService({
        provider: 'elevenlabs',
        elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
        rate: 170,
    }),
};
// Default instance
exports.defaultSpeechService = exports.createSpeechService.forNotifications();
//# sourceMappingURL=index.js.map