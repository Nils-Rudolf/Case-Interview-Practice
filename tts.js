// tts.js
class WebSpeechProvider {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.utterance = null;
        this.voices = [];
        this.isReady = false;
        this.onEndCallback = null;
        
        if (this.synthesis) {
            this.loadVoices();
            this.synthesis.addEventListener('voiceschanged', () => this.loadVoices());
        }
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();
        this.isReady = this.voices.length > 0;
    }

    getVoices() {
        return new Promise((resolve) => {
            if (this.isReady) {
                resolve(this.voices.map(v => ({
                    name: v.name,
                    lang: v.lang,
                    default: v.default,
                    local: v.localService
                })));
            } else {
                setTimeout(() => {
                    this.loadVoices();
                    resolve(this.voices.map(v => ({
                        name: v.name,
                        lang: v.lang,
                        default: v.default,
                        local: v.localService
                    })));
                }, 100);
            }
        });
    }

    findBestVoice(languageCode = 'de-DE') {
        const voices = this.synthesis.getVoices();
        
        // First try exact match
        let voice = voices.find(v => v.lang === languageCode);
        
        // Then try language prefix match
        if (!voice) {
            const langPrefix = languageCode.split('-')[0];
            voice = voices.find(v => v.lang.startsWith(langPrefix));
        }
        
        // Fall back to default voice
        if (!voice) {
            voice = voices.find(v => v.default);
        }
        
        return voice || voices[0];
    }

    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.synthesis) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            this.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            this.utterance = utterance;

            const voice = options.voiceName 
                ? this.voices.find(v => v.name === options.voiceName)
                : this.findBestVoice(options.languageCode || APP_CONFIG.tts.defaultLanguage);

            if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang;
            } else {
                utterance.lang = options.languageCode || APP_CONFIG.tts.defaultLanguage;
            }

            utterance.rate = options.rate || APP_CONFIG.tts.defaultRate;
            utterance.pitch = options.pitch || APP_CONFIG.tts.defaultPitch;
            utterance.volume = options.volume || APP_CONFIG.tts.defaultVolume;

            utterance.onend = () => {
                this.utterance = null;
                if (this.onEndCallback) {
                    this.onEndCallback();
                }
                resolve();
            };

            utterance.onerror = (event) => {
                this.utterance = null;
                reject(new Error(`Speech synthesis error: ${event.error}`));
            };

            this.synthesis.speak(utterance);
        });
    }

    cancel() {
        if (this.synthesis && this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.utterance = null;
    }

    isSpeaking() {
        return this.synthesis && this.synthesis.speaking;
    }

    onEnd(callback) {
        this.onEndCallback = callback;
    }
}

const tts = new WebSpeechProvider();