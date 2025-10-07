// app.js
class CaseTrainerApp {
    constructor() {
        this.cases = [];
        this.currentCase = null;
        this.currentCaseIndex = 0;
        this.selectedQuestions = new Set();
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.currentClarifyingHint = '';
        this.ttsProvider = typeof window !== 'undefined' ? window.tts : null;
        this.handleTTSEnd = this.onTTSEnd.bind(this);
        
        this.initElements();
        this.initEventListeners();
        this.setupTTS();
        this.loadCasesFromStorage();
    }

    initElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            importBtn: document.getElementById('importBtn'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            caseSelector: document.getElementById('caseSelector'),
            welcomeView: document.getElementById('welcomeView'),
            caseView: document.getElementById('caseView'),
            errorContainer: document.getElementById('errorContainer'),
            errorList: document.getElementById('errorList'),
            
            caseTitle: document.getElementById('caseTitle'),
            caseScenario: document.getElementById('caseScenario'),
            caseInstructions: document.getElementById('caseInstructions'),
            ttsToggleBtn: document.getElementById('ttsToggleBtn'),
            
            clarifyingBtn: document.getElementById('clarifyingBtn'),
            skipBtn: document.getElementById('skipBtn'),
            
            clarifyingSection: document.getElementById('clarifyingSection'),
            questionsList: document.getElementById('questionsList'),
            
            timerSection: document.getElementById('timerSection'),
            timerDisplay: document.getElementById('timerDisplay'),
            pauseBtn: document.getElementById('pauseBtn'),
            
            solutionSection: document.getElementById('solutionSection'),
            solutionTree: document.getElementById('solutionTree'),
            solutionExplanation: document.getElementById('solutionExplanation'),
            solutionPitfalls: document.getElementById('solutionPitfalls')
        };
    }

    initEventListeners() {
        this.elements.importBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e.target.files[0]);
        });

        this.elements.clearCacheBtn.addEventListener('click', () => {
            this.handleClearCache();
        });

        this.elements.caseSelector.addEventListener('change', (e) => {
            const caseId = e.target.value;
            if (caseId) {
                const caseObj = this.cases.find(c => c.id === caseId);
                if (caseObj) {
                    this.loadCase(caseObj);
                }
            }
        });

        this.elements.clarifyingBtn.addEventListener('click', () => {
            this.handleClarifyingButton();
        });

        this.elements.skipBtn.addEventListener('click', () => {
            this.skipCase();
        });

        this.elements.pauseBtn.addEventListener('click', () => {
            this.toggleTimer();
        });

        if (this.elements.ttsToggleBtn) {
            this.elements.ttsToggleBtn.addEventListener('click', () => {
                this.handleTTSToggle();
            });
        }
    }

    async handleFileImport(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const schemaResponse = await fetch('schema.json');
            const schema = await schemaResponse.json();
            
            const validator = new SchemaValidator(schema);
            const result = validator.validate(text);

            if (result.valid) {
                // Alte Daten aus dem Cache löschen
                this.clearAllCachedData();
                
                this.cases = result.data.cases;
                localStorage.setItem(APP_CONFIG.storageKeys.cases, JSON.stringify(result.data));
                this.updateCaseSelector();
                this.hideError();
                
                if (this.cases.length > 0) {
                    this.loadCase(this.cases[0]);
                }
            } else {
                this.showErrors(result.errors);
            }
        } catch (error) {
            this.showErrors([{ path: '', message: error.message }]);
        }

        this.elements.fileInput.value = '';
    }

    loadCasesFromStorage() {
        const stored = localStorage.getItem(APP_CONFIG.storageKeys.cases);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.cases = data.cases || [];
                this.updateCaseSelector();
                
                const lastCaseId = localStorage.getItem(APP_CONFIG.storageKeys.currentCaseId);
                if (lastCaseId) {
                    const caseObj = this.cases.find(c => c.id === lastCaseId);
                    if (caseObj) {
                        this.loadCase(caseObj);
                    }
                }
            } catch (error) {
                console.error('Failed to load cases from storage:', error);
            }
        }
    }

    updateCaseSelector() {
        this.elements.caseSelector.innerHTML = '<option value="">-- Case wählen --</option>';
        this.cases.forEach(caseObj => {
            const option = document.createElement('option');
            option.value = caseObj.id;
            option.textContent = caseObj.title;
            this.elements.caseSelector.appendChild(option);
        });
    }

    loadCase(caseObj) {
        this.resetState();
        this.currentCase = caseObj;
        this.currentCaseIndex = this.cases.indexOf(caseObj);
        
        localStorage.setItem(APP_CONFIG.storageKeys.currentCaseId, caseObj.id);
        
        this.elements.caseTitle.textContent = caseObj.title;
        this.elements.caseScenario.textContent = caseObj.scenario;
        this.elements.caseInstructions.textContent = caseObj.instructions;
        
        this.elements.caseSelector.value = caseObj.id;
        
        this.elements.welcomeView.style.display = 'none';
        this.elements.caseView.style.display = 'block';
    }

    resetState() {
        if (this.ttsProvider && typeof this.ttsProvider.cancel === 'function') {
            this.ttsProvider.cancel({ emitEnd: false });
        }
        this.setTTSButtonState(false);
        
        this.selectedQuestions.clear();
        this.stopTimer();
        this.timerSeconds = 0;
        this.isPaused = false;
        this.currentClarifyingHint = '';
        
        this.elements.clarifyingSection.style.display = 'none';
        this.elements.timerSection.style.display = 'none';
        this.elements.solutionSection.style.display = 'none';
        this.elements.clarifyingBtn.textContent = 'Klärende Fragen';
        this.elements.pauseBtn.textContent = 'Pause';
        this.elements.timerDisplay.textContent = '00:00';
        this.updateTTSAvailability();
    }

    handleClarifyingButton() {
        const section = this.elements.clarifyingSection;
        
        if (section.style.display === 'none') {
            this.showClarifyingQuestions();
            this.elements.clarifyingBtn.textContent = 'Bearbeitung starten';
        } else if (this.elements.clarifyingBtn.textContent === 'Bearbeitung starten') {
            this.handleStartSolving();
        } else if (this.elements.clarifyingBtn.textContent === 'Strukturieren starten') {
            // Nach falscher Frage: Timer starten und dann zur Lösung
            this.startTimer();
            this.elements.clarifyingBtn.textContent = 'Lösung anzeigen';
        } else if (this.elements.clarifyingBtn.textContent === 'Lösung anzeigen') {
            this.showSolution();
        }
    }

    handleStartSolving() {
        if (!this.currentCase) {
            return;
        }

        const clarifying = this.currentCase.clarifying;
        const maxQuestions = this.getClarifyingMaxQuestions();
        const hintElement = this.elements.clarifyingSection.querySelector('.clarifying-hint');
        const selectedIndices = Array.from(this.selectedQuestions);

        this.resetClarifyingFeedback();

        if (selectedIndices.length === 0) {
            hintElement.textContent = maxQuestions === 1
                ? 'Bitte wählen Sie eine Frage aus.'
                : `Bitte wählen Sie mindestens eine Frage aus (max. ${maxQuestions}).`;
            return;
        }

        this.setClarifyingInputsDisabled(true);

        const incorrectIndices = selectedIndices.filter(index => !clarifying.questions[index].isCorrect);

        if (incorrectIndices.length > 0) {
            incorrectIndices.forEach(index => this.markClarifyingQuestionIncorrect(index));
            this.revealCorrectQuestions();
            hintElement.textContent = 'Mindestens eine Ihrer ausgewählten Fragen war nicht hilfreich.';
            this.elements.clarifyingBtn.textContent = 'Strukturieren starten';
            return;
        }

        hintElement.textContent = 'Super – starten Sie jetzt mit der Bearbeitung.';
        this.startTimer();
        this.elements.clarifyingBtn.textContent = 'Lösung anzeigen';
    }

    setClarifyingInputsDisabled(disabled) {
        if (!this.currentCase) {
            return;
        }

        this.currentCase.clarifying.questions.forEach((_, index) => {
            const checkbox = document.getElementById(`question-${index}`);
            if (checkbox) {
                checkbox.disabled = disabled;
            }
        });
    }

    resetClarifyingFeedback() {
        if (!this.currentCase) {
            return;
        }

        this.currentCase.clarifying.questions.forEach((_, index) => {
            const checkbox = document.getElementById(`question-${index}`);
            if (!checkbox) {
                return;
            }

            const item = checkbox.closest('.question-item');
            if (item) {
                item.classList.remove('incorrect', 'revealed-correct');
                const label = item.querySelector('.question-label');
                if (label) {
                    label.style.removeProperty('color');
                    label.style.removeProperty('text-decoration');
                    label.style.removeProperty('font-weight');
                }
                if (checkbox.checked) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            }

            const answer = document.getElementById(`answer-${index}`);
            if (answer) {
                answer.style.display = checkbox.checked ? 'block' : 'none';
            }
        });
    }

    markClarifyingQuestionIncorrect(index) {
        const checkbox = document.getElementById(`question-${index}`);
        if (!checkbox) {
            return;
        }

        const item = checkbox.closest('.question-item');
        if (item) {
            item.classList.add('incorrect');
            item.classList.remove('selected');
        }

        this.selectedQuestions.delete(index);

        const answer = document.getElementById(`answer-${index}`);
        if (answer) {
            answer.style.display = 'block';
        }
    }

    revealCorrectQuestions() {
        if (!this.currentCase) {
            return;
        }

        this.currentCase.clarifying.questions.forEach((question, index) => {
            if (!question.isCorrect) {
                return;
            }

            const checkbox = document.getElementById(`question-${index}`);
            if (!checkbox) {
                return;
            }

            checkbox.checked = true;
            this.selectedQuestions.add(index);

            const item = checkbox.closest('.question-item');
            if (item) {
                item.classList.add('revealed-correct');
                item.classList.remove('incorrect');
                item.classList.remove('selected');
            }

            const answer = document.getElementById(`answer-${index}`);
            if (answer) {
                answer.style.display = 'block';
            }
        });
    }

    showClarifyingQuestions() {
        this.elements.clarifyingSection.style.display = 'block';
        this.elements.questionsList.innerHTML = '';
        this.selectedQuestions.clear();
        
        const maxQuestions = this.getClarifyingMaxQuestions();
        const hintText = maxQuestions === 1 
            ? 'Wählen Sie 1 Frage aus:' 
            : `Wählen Sie bis zu ${maxQuestions} Fragen aus:`;
        
        const hintElement = this.elements.clarifyingSection.querySelector('.clarifying-hint');
        this.currentClarifyingHint = hintText;
        hintElement.textContent = hintText;
        
        this.currentCase.clarifying.questions.forEach((q, index) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            
            const label = document.createElement('label');
            label.className = 'question-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = maxQuestions === 1 ? 'radio' : 'checkbox';
            checkbox.name = 'clarifying-questions';
            checkbox.id = `question-${index}`;
            checkbox.addEventListener('change', () => this.handleQuestionSelect(index, checkbox.checked));
            
            const span = document.createElement('span');
            span.className = 'question-label';
            span.textContent = q.question;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            div.appendChild(label);
            
            const answer = document.createElement('div');
            answer.className = 'question-answer';
            answer.id = `answer-${index}`;
            answer.textContent = q.answer;
            answer.style.display = 'none';
            div.appendChild(answer);
            
            this.elements.questionsList.appendChild(div);
        });

        this.setClarifyingInputsDisabled(false);
    }

    handleQuestionSelect(index, checked) {
        const maxQuestions = this.getClarifyingMaxQuestions();
        const checkbox = document.getElementById(`question-${index}`);
        const answer = document.getElementById(`answer-${index}`);
        if (!checkbox || !answer) {
            return;
        }

        const item = checkbox.closest('.question-item');
        if (!item) {
            return;
        }
        const hintElement = this.elements.clarifyingSection.querySelector('.clarifying-hint');
        if (hintElement && this.currentClarifyingHint) {
            hintElement.textContent = this.currentClarifyingHint;
        }
        
        if (checked) {
            // Wenn maxQuestions = 1, wird automatisch nur eine Frage ausgewählt (Radio-Buttons)
            if (maxQuestions === 1) {
                // Bei Radio-Buttons wird automatisch nur eine Frage ausgewählt
                this.selectedQuestions.clear();
                // Alle anderen Antworten ausblenden
                this.currentCase.clarifying.questions.forEach((q, i) => {
                    if (i !== index) {
                        const otherCheckbox = document.getElementById(`question-${i}`);
                        const otherAnswer = document.getElementById(`answer-${i}`);
                        const otherItem = otherCheckbox ? otherCheckbox.closest('.question-item') : null;
                        if (otherAnswer) {
                            otherAnswer.style.display = 'none';
                        }
                        if (otherItem) {
                            otherItem.classList.remove('selected');
                        }
                    }
                });
            } else if (this.selectedQuestions.size >= maxQuestions) {
                const firstSelected = Array.from(this.selectedQuestions)[0];
                const firstCheckbox = document.getElementById(`question-${firstSelected}`);
                const firstAnswer = document.getElementById(`answer-${firstSelected}`);
                const firstItem = firstCheckbox ? firstCheckbox.closest('.question-item') : null;
                if (firstCheckbox) {
                    firstCheckbox.checked = false;
                }
                if (firstAnswer) {
                    firstAnswer.style.display = 'none';
                }
                if (firstItem) {
                    firstItem.classList.remove('selected');
                }
                this.selectedQuestions.delete(firstSelected);
            }
            this.selectedQuestions.add(index);
            answer.style.display = 'block';
            item.classList.add('selected');
        } else {
            this.selectedQuestions.delete(index);
            answer.style.display = 'none';
            item.classList.remove('selected');
        }
    }

    getClarifyingMaxQuestions() {
        if (!this.currentCase || !this.currentCase.clarifying) {
            return 0;
        }

        const value = Number(this.currentCase.clarifying.maxQuestions);
        return Number.isNaN(value) ? 0 : value;
    }

    startTimer() {
        this.elements.timerSection.style.display = 'block';
        this.timerSeconds = 0;
        this.isPaused = false;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.timerSeconds++;
                this.updateTimerDisplay();
            }
        }, APP_CONFIG.timer.updateInterval);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    toggleTimer() {
        this.isPaused = !this.isPaused;
        this.elements.pauseBtn.textContent = this.isPaused ? 'Fortsetzen' : 'Pause';
    }

    updateTimerDisplay() {
        this.elements.timerDisplay.textContent = formatTime(this.timerSeconds);
    }

    showSolution() {
        this.stopTimer();
        this.elements.solutionSection.style.display = 'block';
        
        const solution = this.currentCase.solution;
        this.elements.solutionTree.innerHTML = createTreeHTML(solution.tree);
        this.elements.solutionExplanation.textContent = solution.explanation;
        
        this.elements.solutionPitfalls.innerHTML = '';
        solution.pitfalls.forEach(pitfall => {
            const li = document.createElement('li');
            li.textContent = pitfall;
            this.elements.solutionPitfalls.appendChild(li);
        });
    }

    skipCase() {
        let nextIndex;
        
        if (APP_CONFIG.skipBehavior === 'random') {
            nextIndex = Math.floor(Math.random() * this.cases.length);
        } else {
            nextIndex = (this.currentCaseIndex + 1) % this.cases.length;
        }
        
        if (this.cases[nextIndex]) {
            this.loadCase(this.cases[nextIndex]);
        }
    }

    setupTTS() {
        this.ttsProvider = typeof window !== 'undefined' ? window.tts : null;
        this.updateTTSAvailability();

        if (typeof window !== 'undefined') {
            window.addEventListener('azure-tts-ready', (event) => {
                this.ttsProvider = typeof window !== 'undefined' ? window.tts : null;
                const reason = event && event.detail ? event.detail.reason : undefined;
                this.updateTTSAvailability(reason);
            });
        }
    }

    updateTTSAvailability(reasonCode) {
        const button = this.elements.ttsToggleBtn;
        if (!button) {
            return;
        }

        const available = this.isTTSEnabled();
        button.disabled = !available;

        if (available) {
            button.title = '';
            if (this.ttsProvider && typeof this.ttsProvider.onEnd === 'function') {
                this.ttsProvider.onEnd(this.handleTTSEnd);
            }
        } else {
            button.title = this.getTTSUnavailableMessage(reasonCode);
        }

        this.setTTSButtonState(false);
    }

    isTTSEnabled() {
        return !!(
            this.ttsProvider &&
            typeof this.ttsProvider.speak === 'function' &&
            (!this.ttsProvider.isAvailable || this.ttsProvider.isAvailable())
        );
    }

    handleTTSToggle() {
        if (!this.currentCase) {
            return;
        }

        if (!this.isTTSEnabled()) {
            this.updateTTSAvailability();
            return;
        }

        if (this.ttsProvider && typeof this.ttsProvider.isSpeaking === 'function' && this.ttsProvider.isSpeaking()) {
            if (typeof this.ttsProvider.cancel === 'function') {
                this.ttsProvider.cancel();
            }
            return;
        }

        const text = this.composeSpeechText(this.currentCase);
        if (!text) {
            this.setTTSButtonState(false);
            return;
        }

        this.setTTSButtonState(true);

        const languageCode = this.getCaseLanguageCode(this.currentCase);
        const voiceName = this.getVoiceForLanguage(languageCode);

        this.ttsProvider.speak(text, { languageCode, voiceName }).catch(error => {
            console.error('Sprachausgabe fehlgeschlagen:', error);
            this.setTTSButtonState(false);
        });
    }

    composeSpeechText(caseObj) {
        if (!caseObj) {
            return '';
        }

        const blocks = [];
        if (caseObj.scenario) {
            blocks.push(caseObj.scenario);
        }
        if (caseObj.instructions) {
            blocks.push(`${caseObj.instructions}`);
        }
        return blocks.join('\n\n');
    }

    getCaseLanguageCode(caseObj) {
        const fallback = APP_CONFIG.tts.azure.defaultLanguage || 'de-DE';
        if (!caseObj || !caseObj.language) {
            return fallback;
        }

        const language = caseObj.language;
        if (language.includes('-')) {
            return language;
        }

        switch (language) {
            case 'de':
                return 'de-DE';
            case 'en':
                return 'en-US';
            default:
                return `${language}-${language.toUpperCase()}`;
        }
    }

    getVoiceForLanguage(languageCode) {
        const voices = APP_CONFIG.tts.azure.voiceByLanguage || {};
        if (voices[languageCode]) {
            return voices[languageCode];
        }

        const short = languageCode && languageCode.slice(0, 2);
        if (short && voices[short]) {
            return voices[short];
        }

        return APP_CONFIG.tts.azure.defaultVoiceName;
    }

    setTTSButtonState(isSpeaking) {
        const button = this.elements.ttsToggleBtn;
        if (!button) {
            return;
        }

        if (isSpeaking) {
            button.textContent = 'Stop';
            button.classList.add('is-speaking');
            button.setAttribute('aria-pressed', 'true');
            button.setAttribute('aria-label', 'Stop');
        } else {
            button.textContent = 'Play';
            button.classList.remove('is-speaking');
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', 'Play');
        }
    }

    getTTSUnavailableMessage(code) {
        if (this.ttsProvider && typeof this.ttsProvider.getReason === 'function') {
            const providerReason = this.ttsProvider.getReason();
            if (providerReason) {
                return providerReason;
            }
        }

        switch (code) {
            case 'sdk-load-failed':
            case 'sdk-missing':
                return 'Die Azure Speech SDK konnte nicht geladen werden.';
            case 'config-missing':
                return 'Bitte hinterlegen Sie gültige Azure-Anmeldedaten für die Sprachausgabe.';
            case 'init-error':
                return 'Die Sprachausgabe konnte nicht initialisiert werden.';
            default:
                return 'Text-to-Speech derzeit nicht verfügbar.';
        }
    }

    onTTSEnd() {
        this.setTTSButtonState(false);
    }

    showErrors(errors) {
        this.elements.errorContainer.style.display = 'block';
        this.elements.errorList.innerHTML = '';
        
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = `${error.path}: ${error.message}`;
            this.elements.errorList.appendChild(li);
        });
    }

    hideError() {
        this.elements.errorContainer.style.display = 'none';
    }

    clearAllCachedData() {
        // Alle gespeicherten Cases und den aktuellen Case-Index löschen
        localStorage.removeItem(APP_CONFIG.storageKeys.cases);
        localStorage.removeItem(APP_CONFIG.storageKeys.currentCaseId);
        
        // State zurücksetzen
        this.cases = [];
        this.currentCase = null;
        this.currentCaseIndex = 0;
        this.updateCaseSelector();
        
        console.log('Alle gecachten Daten wurden gelöscht');
    }

    handleClearCache() {
        if (confirm('Möchten Sie wirklich alle gespeicherten Daten löschen?')) {
            this.clearAllCachedData();
            
            // Zur Willkommensansicht zurückkehren
            this.elements.caseView.style.display = 'none';
            this.elements.welcomeView.style.display = 'block';
            
            alert('Cache wurde erfolgreich geleert');
        }
    }
}