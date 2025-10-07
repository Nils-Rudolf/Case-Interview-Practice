// tts.js
class NoopTTSProvider {
    constructor(reason) {
        this.reason = reason || 'Text-to-Speech ist nicht verfügbar.';
        this.onEndCallback = () => {};
    }

    speak() {
        return Promise.reject(new Error(this.reason));
    }

    cancel(options = {}) {
        const { emitEnd = true } = options || {};
        if (emitEnd && typeof this.onEndCallback === 'function') {
            this.onEndCallback();
        }
    }

    isSpeaking() {
        return false;
    }

    onEnd(callback) {
        if (typeof callback === 'function') {
            this.onEndCallback = callback;
        }
    }

    isAvailable() {
        return false;
    }

    getReason() {
        return this.reason;
    }
}

let tts = new NoopTTSProvider('Text-to-Speech noch nicht initialisiert.');
updateGlobalTTS(tts);

function initializeTTS() {
    const runInitialization = () => {
        try {
            if (typeof SpeechSDK === 'undefined') {
                console.error('Azure Speech SDK nicht geladen. Stellen Sie sicher, dass die Bibliothek erreichbar ist.');
                updateGlobalTTS(new NoopTTSProvider('Azure Speech SDK konnte nicht geladen werden.'));
                dispatchTTSReady(false, 'sdk-missing');
                return;
            }

            const config = APP_CONFIG && APP_CONFIG.tts && APP_CONFIG.tts.azure;
            if (!config || !config.subscriptionKey || !config.region || config.subscriptionKey === 'DEIN_AZURE_KEY') {
                console.error('Azure TTS Konfiguration fehlt oder ist unvollständig.');
                updateGlobalTTS(new NoopTTSProvider('Azure TTS ist nicht konfiguriert.'));
                dispatchTTSReady(false, 'config-missing');
                return;
            }

            const provider = new AzureTTSProvider(config);
            updateGlobalTTS(provider);
            dispatchTTSReady(provider.isAvailable(), provider.isAvailable() ? 'ok' : 'init-failed');
        } catch (error) {
            console.error('Fehler bei der Initialisierung von Azure TTS:', error);
            updateGlobalTTS(new NoopTTSProvider('Azure TTS Initialisierung fehlgeschlagen.'));
            dispatchTTSReady(false, 'init-error');
        }
    };

    const loaderPromise = typeof window !== 'undefined' ? window.azureSpeechSdkLoader : null;
    if (loaderPromise && typeof loaderPromise.then === 'function') {
        loaderPromise
            .then(() => {
                runInitialization();
            })
            .catch((error) => {
                console.error('Azure Speech SDK konnte nicht geladen werden:', error);
                updateGlobalTTS(new NoopTTSProvider('Azure Speech SDK konnte nicht geladen werden.'));
                dispatchTTSReady(false, 'sdk-load-failed');
            });
        return;
    }

    runInitialization();
}

function dispatchTTSReady(available, reason) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }

    window.dispatchEvent(new CustomEvent('azure-tts-ready', {
        detail: { available, reason }
    }));
}

function updateGlobalTTS(instance) {
    tts = instance;
    if (typeof window !== 'undefined') {
        window.tts = instance;
    }
    return instance;
}

class AzureTTSProvider {
    constructor(config) {
        this.config = config;
        this.available = false;
        this.onEndCallback = () => {};
        this.synthesizer = null;
        this.endTimeout = null;
        this.sessionCounter = 0;
        this.activeSessionId = 0;
        this.audioPlayer = null;

        try {
            const language = this.resolveLanguage(config.defaultLanguage);
            this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.subscriptionKey, config.region);
            if (language) {
                this.speechConfig.speechSynthesisLanguage = language;
            }
            if (config.defaultVoiceName) {
                this.speechConfig.speechSynthesisVoiceName = config.defaultVoiceName;
            }
            this.available = true;
        } catch (error) {
            console.error('Azure Speech SDK konnte nicht initialisiert werden:', error);
        }
    }

    isAvailable() {
        return this.available;
    }

    onEnd(callback) {
        if (typeof callback === 'function') {
            this.onEndCallback = callback;
        }
    }

    speak(text, options = {}) {
        if (!this.available) {
            return Promise.reject(new Error('Azure TTS nicht verfügbar.'));
        }

        const preparedText = this.prepareText(text);
        if (!preparedText) {
            this.invokeOnEnd();
            return Promise.resolve();
        }

        const languageCode = this.resolveLanguage(options.languageCode);
        const voiceName = this.resolveVoice(options.voiceName, languageCode);
        const ssml = this.buildSsml(preparedText, languageCode, voiceName);

        // Stoppe ggf. laufende Wiedergabe (ohne End-Callback).
        this.cancel({ emitEnd: false });

    const sessionId = ++this.sessionCounter;
    this.activeSessionId = sessionId;

    const audioConfig = this.prepareAudioConfig();
    const synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig, audioConfig);
        this.synthesizer = synthesizer;

        return new Promise((resolve, reject) => {
            synthesizer.speakSsmlAsync(
                ssml,
                result => {
                    if (this.activeSessionId !== sessionId || this.synthesizer !== synthesizer) {
                        synthesizer.close();
                        resolve();
                        return;
                    }

                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        const audioDurationMs = this.extractDuration(result.audioDuration);
                        this.scheduleFinish(sessionId, synthesizer, audioDurationMs);
                        resolve();
                    } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                        const details = SpeechSDK.CancellationDetails.fromResult(result);
                        console.warn('Sprachausgabe abgebrochen:', details.reason, details.errorDetails);
                        this.cleanupAfterSession(sessionId, synthesizer, true);
                        resolve();
                    } else {
                        const errorMsg = result.errorDetails || 'Unbekannter Fehler bei der Sprachausgabe.';
                        this.cleanupAfterSession(sessionId, synthesizer, true);
                        reject(new Error(errorMsg));
                    }
                },
                error => {
                    if (this.synthesizer === synthesizer) {
                        this.cleanupAfterSession(sessionId, synthesizer, true);
                    } else {
                        synthesizer.close();
                    }
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            );
        });
    }

    cancel(options = {}) {
        const { emitEnd = true } = options || {};
        this.clearEndTimeout();

        const synthesizer = this.synthesizer;
        this.synthesizer = null;
        this.activeSessionId = 0;

        if (!synthesizer) {
            if (emitEnd) {
                this.invokeOnEnd();
            }
            return;
        }

        synthesizer.synthesisCompleted = null;
        synthesizer.SynthesisCanceled = null;

        const finalize = () => {
            this.stopAudioPlayback(true);
            try {
                synthesizer.close();
            } catch (closeError) {
                console.warn('Schließen des Synthesizers führte zu einer Ausnahme:', closeError);
            }
            if (emitEnd) {
                this.invokeOnEnd();
            }
        };

        const stopFn = typeof synthesizer.stopSpeakingAsync === 'function'
            ? synthesizer.stopSpeakingAsync.bind(synthesizer)
            : null;

        if (!stopFn) {
            console.warn('stopSpeakingAsync nicht verfügbar – verwende close() als Fallback.');
            finalize();
            return;
        }

        try {
            stopFn(
                () => finalize(),
                error => {
                    console.warn('stopSpeakingAsync Fehlermeldung:', error);
                    finalize();
                }
            );
        } catch (error) {
            console.warn('stopSpeakingAsync hat eine Ausnahme ausgelöst:', error);
            finalize();
        }
    }

    isSpeaking() {
        return !!this.synthesizer;
    }

    prepareAudioConfig() {
        this.stopAudioPlayback(true);

        if (typeof SpeechSDK.SpeakerAudioDestination === 'function') {
            const player = new SpeechSDK.SpeakerAudioDestination();
            this.audioPlayer = player;
            try {
                return SpeechSDK.AudioConfig.fromSpeakerOutput(player);
            } catch (error) {
                console.warn('Konnte SpeakerAudioDestination nicht nutzen, falle auf Standardausgabe zurück:', error);
            }
        }

        this.audioPlayer = null;
        return SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    }

    stopAudioPlayback(forceClose = false) {
        const player = this.audioPlayer;
        if (!player) {
            return;
        }

        try {
            if (typeof player.pause === 'function') {
                player.pause();
            }
        } catch (error) {
            console.warn('AudioPlayer konnte nicht pausiert werden:', error);
        }

        if (forceClose) {
            try {
                if (typeof player.close === 'function') {
                    player.close();
                }
            } catch (error) {
                console.warn('AudioPlayer konnte nicht geschlossen werden:', error);
            }
            this.audioPlayer = null;
        }
    }

    scheduleFinish(sessionId, synthesizer, durationMs) {
        this.clearEndTimeout();
        const bufferMs = 150;
        const delay = Math.max(durationMs + bufferMs, bufferMs);

        this.endTimeout = setTimeout(() => {
            if (this.activeSessionId !== sessionId || this.synthesizer !== synthesizer) {
                synthesizer.close();
                return;
            }
            this.cleanupAfterSession(sessionId, synthesizer, true);
        }, delay);
    }

    cleanupAfterSession(sessionId, synthesizer, emitEnd) {
        this.clearEndTimeout();
        this.stopAudioPlayback(true);
        if (this.synthesizer === synthesizer) {
            this.synthesizer = null;
        }
        if (this.activeSessionId === sessionId) {
            this.activeSessionId = 0;
        }
        synthesizer.close();
        if (emitEnd) {
            this.invokeOnEnd();
        }
    }

    clearEndTimeout() {
        if (this.endTimeout) {
            clearTimeout(this.endTimeout);
            this.endTimeout = null;
        }
    }

    invokeOnEnd() {
        if (typeof this.onEndCallback === 'function') {
            this.onEndCallback();
        }
    }

    prepareText(text) {
        if (text === undefined || text === null) {
            return '';
        }
        return String(text).trim();
    }

    resolveLanguage(languageCode) {
        const fallback = this.config.defaultLanguage || 'de-DE';
        const mapping = Object.assign({
            de: 'de-DE',
            en: 'en-US'
        }, this.config.languageMap || {});

        if (!languageCode) {
            return fallback;
        }

        if (languageCode.includes('-')) {
            return languageCode;
        }

        return mapping[languageCode] || `${languageCode}-${languageCode.toUpperCase()}`;
    }

    resolveVoice(voiceName, languageCode) {
        if (voiceName) {
            return voiceName;
        }

        const voices = this.config.voiceByLanguage || {};
        if (voices[languageCode]) {
            return voices[languageCode];
        }

        const short = languageCode && languageCode.slice(0, 2);
        if (short && voices[short]) {
            return voices[short];
        }

        return this.config.defaultVoiceName || 'de-DE-ConradNeural';
    }

    buildSsml(text, languageCode, voiceName) {
        const payload = this.escapeForSsml(text);
        return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${languageCode}">
    <voice name="${voiceName}">${payload}</voice>
</speak>`;
    }

    escapeForSsml(text) {
        const normalized = text.replace(/\r\n?/g, '\n').trim();
        if (!normalized) {
            return '';
        }

        const paragraphs = normalized.split(/\n{2,}/);
        return paragraphs
            .map(paragraph => paragraph
                .split(/\n/)
                .map(line => this.escapeXml(line.trim()))
                .filter(Boolean)
                .join('<break strength="medium"/>')
            )
            .filter(Boolean)
            .join('<break strength="strong"/>');
    }

    escapeXml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    extractDuration(audioDuration) {
        const ticks = Number(audioDuration);
        if (!Number.isFinite(ticks) || ticks <= 0) {
            return 0;
        }
        return ticks / 10000; // Ticks -> Millisekunden
    }
}