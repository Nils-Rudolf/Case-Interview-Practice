// config.js
const APP_CONFIG = {
    skipBehavior: 'next', // 'next' | 'random'
    storageKeys: {
        cases: 'itConsultingCases',
        currentCaseId: 'currentCaseId'
    },
    tts: {
        azure: {
            subscriptionKey: typeof AZURE_CREDENTIALS !== 'undefined' ? AZURE_CREDENTIALS.subscriptionKey : 'DEIN_AZURE_KEY',
            region: typeof AZURE_CREDENTIALS !== 'undefined' ? AZURE_CREDENTIALS.region : 'DEINE_AZURE_REGION',
            defaultLanguage: 'de-DE',
            defaultVoiceName: 'de-DE-SeraphinaMultilingualNeural',
            voiceByLanguage: {
                'de': 'de-DE-SeraphinaMultilingualNeural',
                'de-DE': 'de-DE-SeraphinaMultilingualNeural',
                'en': 'en-US-GuyNeural',
                'en-US': 'en-US-GuyNeural'
            }
        },
        defaultRate: 1.0,
        defaultPitch: 1.0,
        defaultVolume: 1.0
    },
    timer: {
        updateInterval: 1000 // milliseconds
    }
};