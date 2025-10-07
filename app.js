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
        
        this.initElements();
        this.initEventListeners();
        this.loadCasesFromStorage();
    }

    initElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            importBtn: document.getElementById('importBtn'),
            caseSelector: document.getElementById('caseSelector'),
            welcomeView: document.getElementById('welcomeView'),
            caseView: document.getElementById('caseView'),
            errorContainer: document.getElementById('errorContainer'),
            errorList: document.getElementById('errorList'),
            
            caseTitle: document.getElementById('caseTitle'),
            caseClient: document.getElementById('caseClient'),
            caseDifficulty: document.getElementById('caseDifficulty'),
            caseScenario: document.getElementById('caseScenario'),
            caseInstructions: document.getElementById('caseInstructions'),
            
            ttsBtn: document.getElementById('ttsBtn'),
            ttsBtnText: document.getElementById('ttsBtnText'),
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

        this.elements.caseSelector.addEventListener('change', (e) => {
            const caseId = e.target.value;
            if (caseId) {
                const caseObj = this.cases.find(c => c.id === caseId);
                if (caseObj) {
                    this.loadCase(caseObj);
                }
            }
        });

        this.elements.ttsBtn.addEventListener('click', () => {
            this.toggleTTS();
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

        tts.onEnd(() => {
            this.elements.ttsBtnText.textContent = 'Vorlesen';
        });
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
        this.elements.caseClient.textContent = caseObj.client;
        this.elements.caseScenario.textContent = caseObj.scenario;
        this.elements.caseInstructions.textContent = caseObj.instructions;
        
        const difficultyClass = caseObj.difficulty.toLowerCase();
        this.elements.caseDifficulty.textContent = caseObj.difficulty;
        this.elements.caseDifficulty.className = `difficulty-badge ${difficultyClass}`;
        
        this.elements.caseSelector.value = caseObj.id;
        
        this.elements.welcomeView.style.display = 'none';
        this.elements.caseView.style.display = 'block';
    }

    resetState() {
        this.selectedQuestions.clear();
        this.stopTimer();
        this.timerSeconds = 0;
        this.isPaused = false;
        
        tts.cancel();
        this.elements.ttsBtnText.textContent = 'Vorlesen';
        
        this.elements.clarifyingSection.style.display = 'none';
        this.elements.timerSection.style.display = 'none';
        this.elements.solutionSection.style.display = 'none';
        this.elements.clarifyingBtn.textContent = 'Klärende Fragen';
        this.elements.pauseBtn.textContent = 'Pause';
        this.elements.timerDisplay.textContent = '00:00';
    }

    toggleTTS() {
        if (tts.isSpeaking()) {
            tts.cancel();
            this.elements.ttsBtnText.textContent = 'Vorlesen';
        } else {
            const text = this.currentCase.scenario;
            this.elements.ttsBtnText.textContent = 'Stopp';
            tts.speak(text, { languageCode: this.currentCase.tts.languageCode }).catch(err => {
                console.error('TTS error:', err);
                this.showErrors([{ path: '', message: 'Text-to-Speech nicht verfügbar. Bitte überprüfen Sie Ihre Browsereinstellungen.' }]);
                this.elements.ttsBtnText.textContent = 'Vorlesen';
            });
        }
    }

    handleClarifyingButton() {
        const section = this.elements.clarifyingSection;
        
        if (section.style.display === 'none') {
            this.showClarifyingQuestions();
            this.elements.clarifyingBtn.textContent = 'Bearbeitung starten';
        } else if (this.elements.clarifyingBtn.textContent === 'Bearbeitung starten') {
            this.startTimer();
            this.elements.clarifyingBtn.textContent = 'Lösung anzeigen';
        } else if (this.elements.clarifyingBtn.textContent === 'Lösung anzeigen') {
            this.showSolution();
        }
    }

    showClarifyingQuestions() {
        this.elements.clarifyingSection.style.display = 'block';
        this.elements.questionsList.innerHTML = '';
        
        this.currentCase.clarifying.questions.forEach((q, index) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            
            const label = document.createElement('label');
            label.className = 'question-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
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
    }

    handleQuestionSelect(index, checked) {
        const checkbox = document.getElementById(`question-${index}`);
        const answer = document.getElementById(`answer-${index}`);
        const item = checkbox.closest('.question-item');
        
        if (checked) {
            if (this.selectedQuestions.size >= 2) {
                const firstSelected = Array.from(this.selectedQuestions)[0];
                document.getElementById(`question-${firstSelected}`).checked = false;
                document.getElementById(`answer-${firstSelected}`).style.display = 'none';
                document.getElementById(`question-${firstSelected}`).closest('.question-item').classList.remove('selected');
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
}

document.addEventListener('DOMContentLoaded', () => {
    new CaseTrainerApp();
});