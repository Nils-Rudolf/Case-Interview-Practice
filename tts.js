// tts.js
let tts;

function initializeTTS() {
    if (typeof SpeechSDK !== 'undefined') {
        class AzureTTSProvider {
            constructor(config) {
                if (!config || !config.subscriptionKey || !config.region || config.subscriptionKey === 'DEIN_AZURE_KEY') {
                    console.error('Azure TTS config is missing or incomplete.');
                    return;
                }
                this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.subscriptionKey, config.region);
                this.audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
                this.synthesizer = null;
                this.onEndCallback = null;
                this.endTimeout = null; // To hold the timeout for resetting the button
            }

            speak(text, { languageCode = 'de-DE' }) {
                return new Promise((resolve, reject) => {
                    if (!this.speechConfig) {
                        return reject(new Error('Azure TTS not configured.'));
                    }

                    this.cancel(); // Cancel any ongoing speech

                    this.synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);

                    this.synthesizer.synthesisCompleted = (s, e) => {
                        const result = e.result;

                        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                            resolve();
                            const audioDurationMs = result.audioDuration / 10000; // Convert ticks to ms
                            this.endTimeout = setTimeout(() => {
                                if (this.onEndCallback) this.onEndCallback();
                                if (this.synthesizer) {
                                    this.synthesizer.close();
                                    this.synthesizer = null;
                                }
                            }, audioDurationMs);

                        } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                            resolve();
                            if (this.onEndCallback) this.onEndCallback();
                            if (this.synthesizer) {
                                this.synthesizer.close();
                                this.synthesizer = null;
                            }

                        } else {
                            const errorDetails = result.errorDetails;
                            console.error(`Speech synthesis failed: ${errorDetails}`);
                            reject(new Error(`Speech synthesis failed: ${errorDetails}`));
                            if (this.onEndCallback) this.onEndCallback();
                            if (this.synthesizer) {
                                this.synthesizer.close();
                                this.synthesizer = null;
                            }
                        }
                    };
                    
                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${languageCode}"><voice name="de-DE-KatjaNeural">${text}</voice></speak>`;

                    this.synthesizer.speakSsmlAsync(ssml, () => {}, error => {
                        console.error(`Speech synthesis error: ${error}`);
                        reject(error);
                    });
                });
            }

            cancel() {
                if (this.endTimeout) {
                    clearTimeout(this.endTimeout);
                    this.endTimeout = null;
                }
                if (this.synthesizer) {
                    try {
                        // Use stopSpeakingAsync to halt playback. This will trigger the 
                        // synthesisCompleted event with a "Canceled" reason.
                        this.synthesizer.stopSpeakingAsync();
                    } catch (error) {
                        // console.warn("Error stopping synthesizer", error);
                        // Fallback for cleanup if stop fails
                        this.synthesizer.close();
                        this.synthesizer = null;
                    }
                }
            }

            isSpeaking() {
                return !!this.synthesizer;
            }

            onEnd(callback) {
                this.onEndCallback = callback;
            }
        }
        tts = new AzureTTSProvider(APP_CONFIG.tts.azure);
    } else {
        console.error('Azure Speech SDK not loaded. Make sure you are connected to the internet and the script from aka.ms is not blocked.');
        // Create a dummy tts object to avoid errors in app.js
        tts = {
            speak: () => Promise.reject(new Error('Azure Speech SDK not loaded.')),
            cancel: () => {},
            isSpeaking: () => false,
            onEnd: () => {}
        };
    }
}