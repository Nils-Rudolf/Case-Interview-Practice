// config.js
const APP_CONFIG = {
    skipBehavior: 'next', // 'next' | 'random'
    storageKeys: {
        cases: 'itConsultingCases',
        currentCaseId: 'currentCaseId'
    },
    tts: {
        defaultLanguage: 'de-DE',
        defaultRate: 1.0,
        defaultPitch: 1.0,
        defaultVolume: 1.0
    },
    timer: {
        updateInterval: 1000 // milliseconds
    }
};