"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CONFIG_FILE: () => CONFIG_FILE,
  ElevenLabsProvider: () => ElevenLabsProvider,
  GroqProvider: () => GroqProvider,
  OpenAIProvider: () => OpenAIProvider,
  SpeakEasy: () => SpeakEasy,
  SpeakEasyBuilder: () => SpeakEasyBuilder,
  SystemProvider: () => SystemProvider,
  say: () => say,
  speak: () => speak
});
module.exports = __toCommonJS(src_exports);
var import_child_process5 = require("child_process");
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// src/providers/system.ts
var import_child_process = require("child_process");
var SystemProvider = class {
  voice;
  constructor(voice = "Samantha") {
    this.voice = voice;
  }
  async speak(config) {
    try {
      const command = `say -v ${this.voice} -r ${config.rate} "${config.text.replace(/"/g, '\\"')}"`;
      (0, import_child_process.execSync)(command);
    } catch (error) {
      throw new Error(`System TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return true;
  }
  getErrorMessage(error) {
    return `System voice failed: ${error.message}. Ensure 'say' command is available.`;
  }
};

// src/providers/openai.ts
var import_child_process2 = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_node_fetch = __toESM(require("node-fetch"));
var OpenAIProvider = class {
  apiKey;
  voice;
  constructor(apiKey = "", voice = "nova") {
    this.apiKey = apiKey;
    this.voice = voice;
  }
  async speak(config) {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    try {
      const tempFile = path.join(config.tempDir, `speech_${Date.now()}.mp3`);
      const response = await (0, import_node_fetch.default)("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.`);
        } else if (response.status === 429) {
          throw new Error(`OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.`);
        }
        throw new Error(`OpenAI API error: ${response.status}. Check your API key and rate limits.`);
      }
      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
      (0, import_child_process2.execSync)(`afplay "${tempFile}"`);
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      throw new Error(`OpenAI TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!this.apiKey;
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid OpenAI API key. Set OPENAI_API_KEY environment variable or provide apiKeys.openai in config.";
    }
    return `OpenAI TTS failed: ${error.message}`;
  }
};

// src/providers/elevenlabs.ts
var import_child_process3 = require("child_process");
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_node_fetch2 = __toESM(require("node-fetch"));
var ElevenLabsProvider = class {
  apiKey;
  voiceId;
  constructor(apiKey = "", voiceId = "EXAVITQu4vr4xnSDxMaL") {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }
  async speak(config) {
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key is required");
    }
    const BALANCED = 0.5;
    const NATURAL = 0.5;
    try {
      const tempFile = path2.join(config.tempDir, `speech_${Date.now()}.mp3`);
      const response = await (0, import_node_fetch2.default)(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey
        },
        body: JSON.stringify({
          text: config.text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL
          }
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("ElevenLabs API error: Invalid API key");
        } else if (response.status === 429) {
          throw new Error("ElevenLabs API error: Rate limit exceeded");
        }
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }
      const audioBuffer = await response.arrayBuffer();
      fs2.writeFileSync(tempFile, Buffer.from(audioBuffer));
      (0, import_child_process3.execSync)(`afplay "${tempFile}"`);
      if (fs2.existsSync(tempFile)) {
        fs2.unlinkSync(tempFile);
      }
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!this.apiKey;
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid ElevenLabs API key. Set ELEVENLABS_API_KEY environment variable or provide apiKeys.elevenlabs in config.";
    }
    return `ElevenLabs TTS failed: ${error.message}`;
  }
};

// src/providers/groq.ts
var import_child_process4 = require("child_process");
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_node_fetch3 = __toESM(require("node-fetch"));
var GroqProvider = class {
  apiKey;
  voice;
  constructor(apiKey = "", voice = "Celeste-PlayAI") {
    this.apiKey = apiKey;
    this.voice = voice;
  }
  async speak(config) {
    if (!this.apiKey) {
      throw new Error("Groq API key is required");
    }
    try {
      const tempFile = path3.join(config.tempDir, `speech_${Date.now()}.mp3`);
      const response = await (0, import_node_fetch3.default)("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "playai-tts",
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Groq API error: Invalid API key");
        } else if (response.status === 429) {
          throw new Error("Groq API error: Rate limit exceeded");
        }
        throw new Error(`Groq API error: ${response.status}`);
      }
      const audioBuffer = await response.arrayBuffer();
      fs3.writeFileSync(tempFile, Buffer.from(audioBuffer));
      (0, import_child_process4.execSync)(`afplay "${tempFile}"`);
      if (fs3.existsSync(tempFile)) {
        fs3.unlinkSync(tempFile);
      }
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!this.apiKey;
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid Groq API key. Set GROQ_API_KEY environment variable or provide apiKeys.groq in config.";
    }
    return `Groq TTS failed: ${error.message}`;
  }
};

// src/index.ts
var CONFIG_DIR = path4.join(require("os").homedir(), ".config", "speakeasy");
var CONFIG_FILE = path4.join(CONFIG_DIR, "settings.json");
function loadGlobalConfig() {
  try {
    if (fs4.existsSync(CONFIG_FILE)) {
      const configData = fs4.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn("Failed to load global config:", error);
  }
  return {};
}
function cleanTextForSpeech(text) {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, "").replace(/[^\w\s.,!?'-]/g, " ").replace(/\s+/g, " ").trim();
}
var SpeakEasy = class {
  config;
  providers;
  isPlaying = false;
  queue = [];
  constructor(config) {
    const globalConfig = loadGlobalConfig();
    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || "system",
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || "Samantha",
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || "nova",
      elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || "EXAVITQu4vr4xnSDxMaL",
      rate: config.rate || globalConfig.defaults?.rate || 180,
      apiKeys: {
        openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || "",
        elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || "",
        groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || ""
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || "/tmp"
    };
    this.providers = /* @__PURE__ */ new Map();
    this.initializeProviders();
  }
  initializeProviders() {
    this.providers.set("system", new SystemProvider(this.config.systemVoice));
    this.providers.set("openai", new OpenAIProvider(this.config.apiKeys.openai || "", this.config.openaiVoice));
    this.providers.set("elevenlabs", new ElevenLabsProvider(this.config.apiKeys.elevenlabs || "", this.config.elevenlabsVoiceId));
    this.providers.set("groq", new GroqProvider(this.config.apiKeys.groq || ""));
  }
  static builder() {
    return new SpeakEasyBuilder();
  }
  async speak(text, options = {}) {
    const cleanText = cleanTextForSpeech(text);
    if (options.interrupt && this.isPlaying) {
      this.stopSpeaking();
    }
    if (options.priority === "high") {
      this.queue.unshift({ text: cleanText, options });
    } else {
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
    } catch (error) {
      console.error("Speech error:", error);
    } finally {
      this.isPlaying = false;
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }
  async speakText(text) {
    const providers = ["system", "openai", "elevenlabs", "groq"];
    let lastError = null;
    for (const providerName of providers) {
      if (providerName === this.config.provider || lastError) {
        try {
          const provider = this.providers.get(providerName);
          if (provider && provider.validateConfig()) {
            await provider.speak({
              text,
              rate: this.config.rate,
              tempDir: this.config.tempDir,
              voice: this.getVoiceForProvider(providerName),
              apiKey: this.getApiKeyForProvider(providerName) || ""
            });
            return;
          }
        } catch (error) {
          console.warn(`${providerName} provider failed:`, error);
          lastError = error;
          continue;
        }
      }
    }
    if (lastError) {
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }
    const systemProvider = this.providers.get("system");
    if (systemProvider) {
      await systemProvider.speak({
        text,
        rate: this.config.rate,
        tempDir: this.config.tempDir,
        voice: this.config.systemVoice
      });
    }
  }
  getVoiceForProvider(provider) {
    switch (provider) {
      case "openai":
        return this.config.openaiVoice;
      case "elevenlabs":
        return this.config.elevenlabsVoiceId;
      case "system":
        return this.config.systemVoice;
      case "groq":
        return "Celeste-PlayAI";
      default:
        return this.config.systemVoice;
    }
  }
  getApiKeyForProvider(provider) {
    switch (provider) {
      case "openai":
        return this.config.apiKeys.openai || "";
      case "elevenlabs":
        return this.config.apiKeys.elevenlabs || "";
      case "groq":
        return this.config.apiKeys.groq || "";
      default:
        return "";
    }
  }
  stopSpeaking() {
    try {
      (0, import_child_process5.execSync)('pkill -f "say|afplay"', { stdio: "ignore" });
    } catch (error) {
    }
  }
  clearQueue() {
    this.queue = [];
  }
};
var SpeakEasyBuilder = class {
  config = {};
  withProvider(provider) {
    this.config.provider = provider;
    return this;
  }
  withSystemVoice(voice) {
    this.config.systemVoice = voice;
    return this;
  }
  withOpenAIVoice(voice) {
    this.config.openaiVoice = voice;
    return this;
  }
  withElevenLabsVoice(voiceId) {
    this.config.elevenlabsVoiceId = voiceId;
    return this;
  }
  withRate(rate) {
    this.config.rate = rate;
    return this;
  }
  withApiKeys(keys) {
    this.config.apiKeys = { ...this.config.apiKeys, ...keys };
    return this;
  }
  withTempDir(dir) {
    this.config.tempDir = dir;
    return this;
  }
  build() {
    return new SpeakEasy(this.config);
  }
};
var say = (text, provider) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for say()");
  }
  return new SpeakEasy({ provider: provider || "system" }).speak(text);
};
var speak = (text, options) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for speak()");
  }
  const { provider, ...speakOptions } = options || {};
  return new SpeakEasy({ provider: provider || "system" }).speak(text, speakOptions);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIG_FILE,
  ElevenLabsProvider,
  GroqProvider,
  OpenAIProvider,
  SpeakEasy,
  SpeakEasyBuilder,
  SystemProvider,
  say,
  speak
});
