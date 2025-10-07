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
        this.elements.caseScenario.textContent = caseObj.scenario;
        this.elements.caseInstructions.textContent = caseObj.instructions;
        
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
        } else {
            const text = `${this.currentCase.scenario} ${this.currentCase.instructions}`;
            const lang = this.currentCase.tts.languageCode;
            
            this.elements.ttsBtnText.textContent = 'Stopp';
            
            tts.speak(text, { languageCode: lang })
                .catch(err => {
                    console.error('Azure TTS error:', err);
                    this.showErrors([{ path: '', message: 'Azure Text-to-Speech ist fehlgeschlagen. Überprüfen Sie Ihren API-Schlüssel und die Region.' }]);
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
            this.handleStartSolving();
        } else if (this.elements.clarifyingBtn.textContent === 'Weiter zur Lösung') {
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
        const maxQuestions = clarifying.maxQuestions;
        const hintElement = this.elements.clarifyingSection.querySelector('.clarifying-hint');
        const selectedIndices = Array.from(this.selectedQuestions);

        this.resetClarifyingFeedback();

        if (selectedIndices.length === 0) {
            hintElement.textContent = `Bitte wählen Sie mindestens eine Frage aus (max. ${maxQuestions}).`;
            return;
        }

        this.setClarifyingInputsDisabled(true);

        const incorrectIndices = selectedIndices.filter(index => !clarifying.questions[index].isCorrect);

        if (incorrectIndices.length > 0) {
            incorrectIndices.forEach(index => this.markClarifyingQuestionIncorrect(index));
            this.revealCorrectQuestions();
            hintElement.textContent = 'Mindestens eine Ihrer ausgewählten Fragen war nicht hilfreich.';
            this.elements.clarifyingBtn.textContent = 'Weiter zur Lösung';
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
        
        const maxQuestions = this.currentCase.clarifying.maxQuestions;
        const hintText = parseInt(maxQuestions, 10) === 1 
            ? 'Wählen Sie eine Frage aus:' 
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
        const maxQuestions = this.currentCase.clarifying.maxQuestions;
        const checkbox = document.getElementById(`question-${index}`);
        const answer = document.getElementById(`answer-${index}`);
        const item = checkbox.closest('.question-item');
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
                        const otherAnswer = document.getElementById(`answer-${i}`);
                        const otherItem = document.getElementById(`question-${i}`).closest('.question-item');
                        otherAnswer.style.display = 'none';
                        otherItem.classList.remove('selected');
                    }
                });
            } else if (this.selectedQuestions.size >= maxQuestions) {
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