// app.js
import { state, answerCurrentWord, rewind, resetState } from "./engine.js";
import { valuesData } from "./valuesData.js";
import { createPrioritizer } from "./prioritizationEngine.js";

document.addEventListener("DOMContentLoaded", () => {

  /* DOM */
  const startBtn = document.getElementById("startBtn");
  const startOptions = document.getElementById("startOptions");
  const startQuickBtn = document.getElementById("startQuickBtn");
  const startFullBtn = document.getElementById("startFullBtn");
  const orientation = document.getElementById("orientation");
  const app = document.getElementById("app");
  const contextFrame = document.getElementById("contextFrame");
  const contextToggleBtn = document.getElementById("contextToggleBtn");
  const contextSelection = document.getElementById("contextSelection");
  const contextSelectionValue = document.getElementById("contextSelectionValue");
  const contextPanel = document.getElementById("contextPanel");
  const contextCloseBtn = document.getElementById("contextCloseBtn");
  const contextCustomInput = document.getElementById("contextCustomInput");
  const contextOptionBtns = Array.from(document.querySelectorAll(".contextOption"));
  const wordEl = document.getElementById("word");
  const breathPauseEl = document.getElementById("breathPause");
  const mainButtons = document.getElementById("mainButtons");

  const feelsBtn = document.getElementById("feelsBtn");
  const notBtn = document.getElementById("notBtn");
  const prevBtn = document.getElementById("prevBtn");

  // const checkpointOverlay = document.getElementById("checkpointOverlay"); // TODO: Premium feature
  // const revisitBtn = document.getElementById("revisitBtn"); // TODO: Premium feature
  // const keepGoingBtn = document.getElementById("keepGoingBtn"); // TODO: Premium feature

  const restartOverlay = document.getElementById("restartOverlay");
  const restartConfirmBtn = document.getElementById("restartConfirmBtn");
  const restartCancelBtn = document.getElementById("restartCancelBtn");

  const resultsView = document.getElementById("resultsView");
  const resultsList = document.getElementById("resultsList");
  const prioritizeBtn = document.getElementById("prioritizeBtn");

  const resultsPrintBtn = document.getElementById("resultsPrintBtn");

  const prioritizeView = document.getElementById("prioritizeView");
  const optionABtn = document.getElementById("optionA");
  const optionBBtn = document.getElementById("optionB");

  const finalView = document.getElementById("finalView");
  const finalList = document.getElementById("finalList");
  const printBtn = document.getElementById("printBtn");

  const reflectBtnResults = document.getElementById("reflectBtnResults");
  const reflectCardResults = document.getElementById("reflectCardResults");
  const reflectPromptResults = document.getElementById("reflectPromptResults");
  const reflectCloseResults = document.getElementById("reflectCloseResults");

  const footerRestartBtn = document.getElementById("footerRestartBtn");
  const RETURN_TO_START_KEY = "birdleaf-return-start";
  const PROGRESS_STORAGE_KEY = "birdleaf-progress";
  const CONTEXT_STORAGE_KEY = "birdleaf-reflection-context";
  const BREATH_PAUSE_TRIGGER_KEY = "birdleaf-breath-pause-trigger";
  const BREATH_PAUSE_SHOWN_KEY = "birdleaf-breath-pause-shown";
  const SAVE_SCHEMA_VERSION = 2;

  let skipCheckpoint = false;
  const START_LABEL = "Start/Continue";
  const CONTINUE_LABEL = "Start/Continue";
  const PHASE_TRANSITION_DELAY_MS = 340;
  const REFLECT_PROMPTS = [
    "Which value feels most alive right now?",
    "Which one feels tender or vulnerable?",
    "Which value do you protect the most?",
    "Which one feels hardest to live by lately?",
    "Which value feels new?",
    "Which one feels steady, like it has always been there?",
    "Which value shows up in your body first?",
    "Which value do you wish you had more space for?",
    "Which value feels quiet but present right now?",
    "Which value feels like it needs your gentleness today?"
  ];

  /* DATA */
  // Centralized function to generate shuffled words from valuesData
  // count: optional number of words (default: all words)
  function generateWords(count = null) {
    const allWords = shuffle(
      Object.entries(valuesData).flatMap(([value, list]) =>
        list.map(word => ({ word, value }))
      )
    );
    if (count && count < allWords.length) {
      return allWords.slice(0, count);
    }
    return allWords;
  }

  let hasSavedWordProgress = false;
  let words = null; // Will be set when user chooses a mode
  let saveTimeoutId = null;

  try {
    const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (saved) {
      const progress = JSON.parse(saved);
      if (hasValidSavedWords(progress.words)) {
        words = progress.words;
        // Restore saved session
        startOptions.classList.add("hidden");
        startBtn.classList.remove("hidden");
        startBtn.textContent = "Continue";
        startBtn.onclick = () => {
          loadProgress();
          if (state.mode === "words") {
            runPhaseTransition(() => {
              showWordScreen();
              renderWord();
            });
          }
        };
      }
    }
  } catch (e) {
    // No words yet, user will choose a mode
  }

  /* UTILITY */

  let prioritizer = null;
  let currentComparison = null;
  let displayedOptionA = null;
  let displayedOptionB = null;
  let finalRanking = null;
  let autoSaveSuspended = false;
  let breathPauseTriggerIndex = null;
  let hasShownBreathPause = sessionStorage.getItem(BREATH_PAUSE_SHOWN_KEY) === "1";
  let lastReflectPrompt = null;
  let selectedContext = null;
  let phaseTransitionTimeoutId = null;
  let phaseTransitionNonce = 0;
  const wordLastSide = new Map();
  const reflectPanels = {
    results: {
      button: reflectBtnResults,
      card: reflectCardResults,
      prompt: reflectPromptResults,
      close: reflectCloseResults
    }
  };

  loadProgress();

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      loadProgress();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveProgress();
    }
  });

  window.addEventListener("pagehide", () => {
    saveProgress();
  });

  setupReflectControls();
  setupContextControls();

  /* START */
  startBtn.onclick = () => {
    // If we intentionally returned to the start screen from About/Instructions,
    // a click on Start/Continue should restore the saved mode instead of resetting.
    loadProgress();
    if (startBtn.classList.contains("hidden")) {
      return;
    }

    state.mode = "words";
    finalRanking = null;
    runPhaseTransition(() => {
      showWordScreen();
      renderWord();
      saveProgress();
    });
  };

  // Quick mode: ~150 words
  startQuickBtn.onclick = () => {
    words = generateWords(150);
    startOptions.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Start Quick";
    startBtn.onclick = () => {
      state.mode = "words";
      finalRanking = null;
      runPhaseTransition(() => {
        showWordScreen();
        renderWord();
        saveProgress();
      });
    };
  };

  // Full mode: all words
  startFullBtn.onclick = () => {
    words = generateWords();
    startOptions.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Start Full";
    startBtn.onclick = () => {
      state.mode = "words";
      finalRanking = null;
      runPhaseTransition(() => {
        showWordScreen();
        renderWord();
        saveProgress();
      });
    };
  };

  /* WORD PHASE */
  function renderWord() {
    hideBreathPause();

    if (!words || !Array.isArray(words) || words.length === 0) {
      wordEl.textContent = "Error: No words loaded";
      return;
    }

    ensureBreathPauseTrigger();

    if (state.currentIndex >= words.length) {
      runPhaseTransition(() => {
        showResults();
      });
      return;
    }
    const currentWord = words[state.currentIndex];
    if (!currentWord || !currentWord.word) {
      wordEl.textContent = "Error: Invalid word data";
      return;
    }

    wordEl.classList.remove("fade-in");
    void wordEl.offsetWidth;

    wordEl.textContent = currentWord.word;
    wordEl.classList.add("fade-in");

    // Show/hide Previous button based on position
    prevBtn.style.visibility = state.currentIndex > 0 ? "visible" : "hidden";

    // Only show checkpoint on regular word progression, not after revisit
    // TODO: Premium feature - re-enable later
    // if (state.currentIndex > 0 && state.currentIndex % 50 === 0 && !skipCheckpoint) {
    //   checkpointOverlay.classList.remove("hidden");
    // }
    // Reset the flag after checking
    // skipCheckpoint = false;
  }

  function handleAnswer(delta) {
    const answeredIndex = state.currentIndex;
    const { value } = words[answeredIndex];
    answerCurrentWord(value, delta);
    renderWord();

    if (answeredIndex === breathPauseTriggerIndex) {
      showBreathPause();
    }

    // Use throttled save for word answers
    throttledSave();
  }

  feelsBtn.onclick = () => handleAnswer(1);
  notBtn.onclick = () => handleAnswer(0); // 0 means delete

  prevBtn.onclick = () => {
    if (state.currentIndex > 0) {
      rewind(1);
      renderWord();
      saveProgress();
    }
  };

  // revisitBtn.onclick = () => { // TODO: Premium feature
  //   checkpointOverlay.classList.add("hidden");
  //   skipCheckpoint = true;
  //   rewind(50);
  //   renderWord();
  //   saveProgress();
  // };

  // keepGoingBtn.onclick = () => { // TODO: Premium feature
  //   checkpointOverlay.classList.add("hidden");
  // };

  resultsPrintBtn.onclick = () => window.print();

  /* RESULTS */
  function showResults() {
    cancelPhaseTransition();
    state.mode = "results";
    prioritizer = null;
    currentComparison = null;
    displayedOptionA = null;
    displayedOptionB = null;
    finalRanking = null;
    wordLastSide.clear();

    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");

    resultsList.innerHTML = "";

    const topValues = Object.entries(state.scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    topValues.forEach(([value]) => {
      const li = document.createElement("li");
      li.textContent = value;
      li.classList.add("fade-in");
      resultsList.appendChild(li);
    });

    // Add print date for PDF
    const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    resultsView.querySelector("h2").setAttribute("data-print-date", printDate);

    resultsView.classList.remove("hidden");
    fadeInPhase(resultsView);
    saveProgress();
  }

  /* PRIORITIZATION */
  prioritizeBtn.onclick = () => {
    const values = Array.from(resultsList.children).map(li => li.textContent);
    state.mode = "prioritize";
    finalRanking = null;
    prioritizer = createPrioritizer(values);
    wordLastSide.clear();
    currentComparison = null;
    displayedOptionA = null;
    displayedOptionB = null;
    runPhaseTransition(() => {
      showPrioritizeScreen();
      nextComparison();
    });
  };

  function nextComparison() {
    if (!prioritizer) {
      return;
    }

    currentComparison = prioritizer.getNextComparison();
    if (!currentComparison) {
      runPhaseTransition(() => {
        showFinal();
      });
      return;
    }

    const displayOrder = chooseDisplayOrder(currentComparison);
    displayedOptionA = displayOrder.a;
    displayedOptionB = displayOrder.b;

    optionABtn.textContent = displayedOptionA;
    optionBBtn.textContent = displayedOptionB;

    optionABtn.classList.add("fade-in");
    optionBBtn.classList.add("fade-in");
    saveProgress();
  }

  function chooseDisplayOrder(comparison) {
    const keepOrder = { a: comparison.a, b: comparison.b };
    const swapOrder = { a: comparison.b, b: comparison.a };

    const keepRepeats =
      (wordLastSide.get(keepOrder.a) === "A" ? 1 : 0) +
      (wordLastSide.get(keepOrder.b) === "B" ? 1 : 0);
    const swapRepeats =
      (wordLastSide.get(swapOrder.a) === "A" ? 1 : 0) +
      (wordLastSide.get(swapOrder.b) === "B" ? 1 : 0);

    let chosenOrder = keepOrder;
    if (swapRepeats < keepRepeats || (swapRepeats === keepRepeats && Math.random() < 0.5)) {
      chosenOrder = swapOrder;
    }

    wordLastSide.set(chosenOrder.a, "A");
    wordLastSide.set(chosenOrder.b, "B");

    return chosenOrder;
  }

  optionABtn.onclick = () => {
    if (!prioritizer || typeof displayedOptionA !== "string" || typeof displayedOptionB !== "string") {
      return;
    }
    prioritizer.submitResult(displayedOptionA, displayedOptionB);
    currentComparison = null;
    displayedOptionA = null;
    displayedOptionB = null;
    saveProgress();
    nextComparison();
  };

  optionBBtn.onclick = () => {
    if (!prioritizer || typeof displayedOptionA !== "string" || typeof displayedOptionB !== "string") {
      return;
    }
    prioritizer.submitResult(displayedOptionB, displayedOptionA);
    currentComparison = null;
    displayedOptionA = null;
    displayedOptionB = null;
    saveProgress();
    nextComparison();
  };

  /* FINAL */
  function showFinal(ranking = null) {
    cancelPhaseTransition();
    state.mode = "final";
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.remove("hidden");

    finalRanking = Array.isArray(ranking)
      ? [...ranking]
      : (prioritizer ? prioritizer.finalize() : []);

    renderFinalRanking(finalRanking);

    // Add print date for PDF
    const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    finalView.querySelector("h2").setAttribute("data-print-date", printDate);

    fadeInPhase(finalView);
    saveProgress();
  }

  function renderFinalRanking(ranking) {
    finalList.innerHTML = "";
    ranking.forEach(value => {
      const li = document.createElement("li");
      li.textContent = value;
      li.classList.add("fade-in");
      finalList.appendChild(li);
    });
  }

  printBtn.onclick = () => window.print();

  function setupReflectControls() {
    Object.entries(reflectPanels).forEach(([panelKey, panel]) => {
      if (!panel.button || !panel.close) {
        return;
      }

      panel.button.onclick = () => {
        openReflectPanel(panelKey, panel);
      };

      panel.close.onclick = () => {
        closeReflectPanel(panelKey, panel);
      };
    });
  }

  function pickReflectPrompt() {
    if (REFLECT_PROMPTS.length === 0) {
      return "";
    }

    if (REFLECT_PROMPTS.length === 1) {
      lastReflectPrompt = REFLECT_PROMPTS[0];
      return lastReflectPrompt;
    }

    let prompt = REFLECT_PROMPTS[Math.floor(Math.random() * REFLECT_PROMPTS.length)];
    if (prompt === lastReflectPrompt) {
      const alternatives = REFLECT_PROMPTS.filter(item => item !== lastReflectPrompt);
      prompt = alternatives[Math.floor(Math.random() * alternatives.length)];
    }

    lastReflectPrompt = prompt;
    return prompt;
  }

  function openReflectPanel(panelKey, panel) {
    if (!panel.card || !panel.prompt) {
      return;
    }

    panel.prompt.textContent = pickReflectPrompt();
    panel.card.classList.remove("hidden");
    panel.card.classList.remove("fade-in");
    void panel.card.offsetWidth;
    panel.card.classList.add("fade-in");
  }

  function closeReflectPanel(panelKey, panel) {
    if (!panel.card) {
      return;
    }

    panel.card.classList.add("hidden");
  }

  function resetReflectPanels() {
    Object.values(reflectPanels).forEach((panel) => {
      if (panel.card) {
        panel.card.classList.add("hidden");
      }
      if (panel.prompt) {
        panel.prompt.textContent = "";
      }
    });
  }

  function setupContextControls() {
    if (!contextFrame || !contextToggleBtn || !contextPanel) {
      return;
    }

    selectedContext = loadSavedContext();
    updateContextUI();
    setContextPanelOpen(false);

    contextToggleBtn.onclick = () => {
      const shouldOpen = contextPanel.classList.contains("hidden");
      setContextPanelOpen(shouldOpen);
      // If opening and 'Something specific' is selected, focus the input
      if (shouldOpen && selectedContext === "Something specific" && contextCustomInput) {
        contextCustomInput.focus();
      }
    };

    if (contextCloseBtn) {
      contextCloseBtn.onclick = () => {
        setContextPanelOpen(false);
      };
    }

    contextOptionBtns.forEach((button) => {
      button.onclick = () => {
        const nextContext = typeof button.dataset.contextValue === "string"
          ? button.dataset.contextValue.trim()
          : "";

        if (!nextContext) {
          return;
        }

        // If clicking "Something specific", open input instead of closing
        if (nextContext === "Something specific") {
          contextCustomInput.focus();
          return;
        }

        if (selectedContext === nextContext) {
          selectedContext = null;
        } else {
          selectedContext = nextContext;
        }

        saveSelectedContext();
        updateContextUI();
        setContextPanelOpen(false);
      };
    });

    // Custom input handling
    if (contextCustomInput) {
      contextCustomInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const customValue = contextCustomInput.value.trim();
          if (customValue) {
            if (selectedContext === customValue) {
              selectedContext = null;
            } else {
              selectedContext = customValue;
            }
            contextCustomInput.value = "";
            saveSelectedContext();
            updateContextUI();
            setContextPanelOpen(false);
          }
        }
      });

      // Update UI when custom input changes
      contextCustomInput.addEventListener("input", () => {
        const customValue = contextCustomInput.value.trim();
        // Highlight input if it matches current selection
        if (customValue && customValue === selectedContext) {
          contextCustomInput.classList.add("selected");
        } else {
          contextCustomInput.classList.remove("selected");
        }
      });
    }
  }

  function setContextPanelOpen(isOpen) {
    if (!contextPanel || !contextToggleBtn) {
      return;
    }

    if (isOpen) {
      contextPanel.classList.remove("hidden");
    } else {
      contextPanel.classList.add("hidden");
    }

    contextToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function updateContextUI() {
    const hasContext = typeof selectedContext === "string" && selectedContext.length > 0;

    if (contextSelection && contextSelectionValue) {
      if (hasContext) {
        contextSelectionValue.textContent = selectedContext;
        contextSelection.classList.remove("hidden");
      } else {
        contextSelectionValue.textContent = "";
        contextSelection.classList.add("hidden");
      }
    }

    contextOptionBtns.forEach((button) => {
      const value = typeof button.dataset.contextValue === "string"
        ? button.dataset.contextValue
        : "";
      const isSelected = hasContext && value === selectedContext;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    // Handle custom input styling
    if (contextCustomInput) {
      if (hasContext && !contextOptionBtns.some(btn => btn.dataset.contextValue === selectedContext)) {
        // Custom value is selected - style the input
        contextCustomInput.classList.add("selected");
        contextCustomInput.placeholder = selectedContext;
      } else {
        contextCustomInput.classList.remove("selected");
        contextCustomInput.placeholder = "Or type your own...";
      }
    }
  }

  function loadSavedContext() {
    try {
      const saved = localStorage.getItem(CONTEXT_STORAGE_KEY);
      return (typeof saved === "string" && saved.trim().length > 0) ? saved.trim() : null;
    } catch (e) {
      return null;
    }
  }

  function saveSelectedContext() {
    try {
      if (typeof selectedContext === "string" && selectedContext.length > 0) {
        localStorage.setItem(CONTEXT_STORAGE_KEY, selectedContext);
      } else {
        localStorage.removeItem(CONTEXT_STORAGE_KEY);
      }
    } catch (e) {
      // Ignore persistence failures to keep flow uninterrupted.
    }
  }

  footerRestartBtn.onclick = confirmRestart;
  restartConfirmBtn.onclick = performRestart;
  restartCancelBtn.onclick = () => {
    restartOverlay.classList.add("hidden");
  };

  function saveProgressForInfoNav() {
    saveProgress();
    sessionStorage.setItem(RETURN_TO_START_KEY, "1");
  }

  // Throttled save - waits 500ms after last call before actually saving
  function throttledSave() {
    if (autoSaveSuspended) {
      return;
    }

    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }

    saveTimeoutId = setTimeout(() => {
      saveProgress();
      saveTimeoutId = null;
    }, 500);
  }

  // Immediate save for critical operations
  function saveProgress() {
    if (autoSaveSuspended) {
      return;
    }

    const progress = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      mode: state.mode,
      currentIndex: state.currentIndex,
      history: state.history,
      scores: state.scores,
      words,
      prioritize: null,
      finalRanking: Array.isArray(finalRanking) ? [...finalRanking] : null
    };

    if (state.mode === "prioritize" && prioritizer) {
      progress.prioritize = {
        engineSnapshot: prioritizer.serialize(),
        currentComparison: isComparisonEntry(currentComparison) ? { ...currentComparison } : null,
        displayedOrder: (typeof displayedOptionA === "string" && typeof displayedOptionB === "string")
          ? { a: displayedOptionA, b: displayedOptionB }
          : null,
        wordLastSide: mapWordLastSide(wordLastSide)
      };
    }

    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      // Ignore persistence failures to avoid interrupting the flow.
    }
  }

  window.saveProgress = saveProgress;
  window.saveProgressForInfoNav = saveProgressForInfoNav;

  function hasResumableWordProgress(progress) {
    return (
      progress &&
      typeof progress === "object" &&
      Array.isArray(progress.words) &&
      progress.words.length > 0 &&
      Number.isInteger(progress.currentIndex) &&
      progress.currentIndex > 0 &&
      progress.currentIndex < progress.words.length
    );
  }

  function updateStartButtonLabel() {
    startBtn.textContent = hasSavedWordProgress ? CONTINUE_LABEL : START_LABEL;
  }

  function ensureBreathPauseTrigger() {
    if (hasShownBreathPause || !Array.isArray(words) || words.length < 2) {
      return;
    }

    const maxTriggerIndex = words.length - 2;
    const minTriggerIndex = Math.min(Math.max(0, state.currentIndex), maxTriggerIndex);

    if (
      Number.isInteger(breathPauseTriggerIndex) &&
      breathPauseTriggerIndex >= minTriggerIndex &&
      breathPauseTriggerIndex <= maxTriggerIndex
    ) {
      return;
    }

    const savedTrigger = Number.parseInt(sessionStorage.getItem(BREATH_PAUSE_TRIGGER_KEY) || "", 10);
    if (
      Number.isInteger(savedTrigger) &&
      savedTrigger >= minTriggerIndex &&
      savedTrigger <= maxTriggerIndex
    ) {
      breathPauseTriggerIndex = savedTrigger;
      return;
    }

    breathPauseTriggerIndex = randomInt(minTriggerIndex, maxTriggerIndex);
    sessionStorage.setItem(BREATH_PAUSE_TRIGGER_KEY, String(breathPauseTriggerIndex));
  }

  function showBreathPause() {
    if (hasShownBreathPause || !breathPauseEl) {
      return;
    }

    hasShownBreathPause = true;
    sessionStorage.setItem(BREATH_PAUSE_SHOWN_KEY, "1");
    breathPauseEl.classList.remove("hidden");
  }

  function hideBreathPause() {
    if (!breathPauseEl) {
      return;
    }
    breathPauseEl.classList.add("hidden");
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function runPhaseTransition(showNextPhase) {
    if (typeof showNextPhase !== "function") {
      return;
    }

    cancelPhaseTransition();
    hideTransientOverlays();
    hidePrimaryViewsForTransition();

    const activeNonce = phaseTransitionNonce;
    phaseTransitionTimeoutId = setTimeout(() => {
      if (activeNonce !== phaseTransitionNonce) {
        return;
      }

      phaseTransitionTimeoutId = null;
      showNextPhase();
    }, PHASE_TRANSITION_DELAY_MS);
  }

  function cancelPhaseTransition() {
    if (phaseTransitionTimeoutId) {
      clearTimeout(phaseTransitionTimeoutId);
      phaseTransitionTimeoutId = null;
    }

    phaseTransitionNonce += 1;
  }

  function hidePrimaryViewsForTransition() {
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");
    hideBreathPause();
  }

  function fadeInPhase(element) {
    if (!element) {
      return;
    }

    element.classList.remove("fade-in");
    void element.offsetWidth;
    element.classList.add("fade-in");
  }

  function showWordScreen() {
    cancelPhaseTransition();
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");

    app.classList.remove("hidden");
    wordEl.classList.remove("hidden");
    mainButtons.classList.remove("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");
    fadeInPhase(app);
  }

  function showPrioritizeScreen() {
    cancelPhaseTransition();
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    finalView.classList.add("hidden");
    prioritizeView.classList.remove("hidden");
    fadeInPhase(prioritizeView);
  }

  function showStartScreen() {
    cancelPhaseTransition();
    hideTransientOverlays();
    updateStartButtonLabel();
    // Only show mode options at the very beginning (before any words chosen)
    // After that, show Continue button
    if (words && words.length > 0) {
      startOptions.classList.add("hidden");
      startBtn.classList.remove("hidden");
      startBtn.textContent = "Continue";
      startBtn.onclick = () => {
        loadProgress();
        if (state.mode === "words") {
          runPhaseTransition(() => {
            showWordScreen();
            renderWord();
          });
        }
      };
    } else {
      startOptions.classList.remove("hidden");
      startBtn.classList.add("hidden");
    }
    orientation.classList.remove("hidden");

    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");
    fadeInPhase(orientation);
  }

  function hideTransientOverlays() {
    // checkpointOverlay.classList.add("hidden"); // TODO: Premium feature
    restartOverlay.classList.add("hidden");
    hideBreathPause();
    setContextPanelOpen(false);
    resetReflectPanels();
  }

  function isComparisonEntry(value) {
    return (
      value &&
      typeof value === "object" &&
      typeof value.a === "string" &&
      typeof value.b === "string"
    );
  }

  function isDisplayOrderForComparison(order, comparison) {
    return (
      isComparisonEntry(order) &&
      isComparisonEntry(comparison) &&
      (
        (order.a === comparison.a && order.b === comparison.b) ||
        (order.a === comparison.b && order.b === comparison.a)
      )
    );
  }

  function mapWordLastSide(map) {
    const serialized = {};
    map.forEach((side, value) => {
      if ((side === "A" || side === "B") && typeof value === "string") {
        serialized[value] = side;
      }
    });
    return serialized;
  }

  function objectToWordLastSide(data) {
    const restored = new Map();
    if (!data || typeof data !== "object") {
      return restored;
    }

    Object.entries(data).forEach(([value, side]) => {
      if ((side === "A" || side === "B") && typeof value === "string") {
        restored.set(value, side);
      }
    });

    return restored;
  }

  function hasValidSavedWords(savedWords) {
    return (
      Array.isArray(savedWords) &&
      savedWords.length > 0 &&
      savedWords[0] &&
      typeof savedWords[0] === "object" &&
      typeof savedWords[0].word === "string" &&
      typeof savedWords[0].value === "string"
    );
  }

  function restorePrioritizeState(progress) {
    try {
      const prioritizeState = progress.prioritize;
      if (!prioritizeState || typeof prioritizeState !== "object") {
        console.warn("Invalid prioritize state - missing or invalid");
        return false;
      }

      const snapshot = prioritizeState.engineSnapshot;
      if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.values)) {
        console.warn("Invalid prioritize state - missing snapshot");
        return false;
      }

      const snapshotValues = snapshot.values.filter(value => typeof value === "string");
      if (snapshotValues.length === 0) {
        console.warn("Invalid prioritize state - no valid values");
        return false;
      }

      prioritizer = createPrioritizer(snapshotValues, snapshot);
      wordLastSide.clear();
      objectToWordLastSide(prioritizeState.wordLastSide).forEach((side, value) => {
        wordLastSide.set(value, side);
      });

      const restoredComparison = isComparisonEntry(prioritizeState.currentComparison)
        ? { ...prioritizeState.currentComparison }
        : null;
      currentComparison = restoredComparison || prioritizer.getNextComparison();

      if (!currentComparison) {
        showFinal();
        return true;
      }

      if (isDisplayOrderForComparison(prioritizeState.displayedOrder, currentComparison)) {
        displayedOptionA = prioritizeState.displayedOrder.a;
        displayedOptionB = prioritizeState.displayedOrder.b;
      } else {
        const displayOrder = chooseDisplayOrder(currentComparison);
        displayedOptionA = displayOrder.a;
        displayedOptionB = displayOrder.b;
      }

      wordLastSide.set(displayedOptionA, "A");
      wordLastSide.set(displayedOptionB, "B");

      optionABtn.textContent = displayedOptionA;
      optionBBtn.textContent = displayedOptionB;

      showPrioritizeScreen();
      saveProgress();
      return true;
    } catch (error) {
      console.error("Failed to restore prioritize state:", error);
      return false;
    }
  }

  function loadProgress() {
    try {
      const shouldReturnToStart = sessionStorage.getItem(RETURN_TO_START_KEY) === "1";
      if (shouldReturnToStart) {
        sessionStorage.removeItem(RETURN_TO_START_KEY);
      }

      hasSavedWordProgress = false;
      const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (saved) {
        const progress = JSON.parse(saved);
        if (progress && typeof progress === "object" && typeof progress.mode === "string") {
          if (hasValidSavedWords(progress.words)) {
            words = progress.words;
          }

          hasSavedWordProgress = hasResumableWordProgress(progress);
          state.mode = progress.mode;
          state.currentIndex = Number.isInteger(progress.currentIndex) ? progress.currentIndex : 0;
          state.history = Array.isArray(progress.history) ? progress.history : [];
          state.scores = (progress.scores && typeof progress.scores === "object") ? progress.scores : {};
          finalRanking = Array.isArray(progress.finalRanking) ? [...progress.finalRanking] : null;

          if (shouldReturnToStart) {
            showStartScreen();
            return;
          }

          // Restore UI based on mode
          if (state.mode === "words") {
            showWordScreen();
            renderWord();
          } else if (state.mode === "results") {
            showResults();
          } else if (state.mode === "prioritize") {
            if (!restorePrioritizeState(progress)) {
              showResults();
            }
          } else if (state.mode === "final") {
            if (Array.isArray(finalRanking)) {
              showFinal(finalRanking);
            } else {
              showResults();
            }
          } else {
            showStartScreen();
          }
        }
      }

      if (shouldReturnToStart) {
        showStartScreen();
      }
    } catch (e) {
      hasSavedWordProgress = false;
      updateStartButtonLabel();
      // Ignore errors, start fresh
    }
  }

  function confirmRestart() {
    restartOverlay.classList.remove("hidden");
  }

  function performRestart() {
    restartOverlay.classList.add("hidden");
    autoSaveSuspended = true;
    // Clear any pending throttled saves
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    sessionStorage.removeItem(RETURN_TO_START_KEY);
    resetState();
    location.reload();
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

});
