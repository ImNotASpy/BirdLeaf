// app.js
import { state, answerCurrentWord, rewind, resetState } from "./engine.js";
import { valuesData } from "./valuesData.js";
import { createPrioritizer } from "./prioritizationEngine.js";

document.addEventListener("DOMContentLoaded", () => {

  /* DOM */
  const startBtn = document.getElementById("startBtn");
  const orientation = document.getElementById("orientation");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const app = document.getElementById("app");
  const wordEl = document.getElementById("word");
  const mainButtons = document.getElementById("mainButtons");

  const feelsBtn = document.getElementById("feelsBtn");
  const neutralBtn = document.getElementById("neutralBtn");
  const notBtn = document.getElementById("notBtn");

  const checkpointOverlay = document.getElementById("checkpointOverlay");
  const revisitBtn = document.getElementById("revisitBtn");
  const keepGoingBtn = document.getElementById("keepGoingBtn");

  const saveOverlay = document.getElementById("saveOverlay");
  const saveOkBtn = document.getElementById("saveOkBtn");
  const restartOverlay = document.getElementById("restartOverlay");
  const restartConfirmBtn = document.getElementById("restartConfirmBtn");
  const restartCancelBtn = document.getElementById("restartCancelBtn");

  const resultsView = document.getElementById("resultsView");
  const resultsList = document.getElementById("resultsList");
  const prioritizeBtn = document.getElementById("prioritizeBtn");

  const resultsPrintBtn = document.getElementById("resultsPrintBtn");

  const prioritizeView = document.getElementById("prioritizeView");
  const prioritizeProgressBar = document.getElementById("prioritizeProgressBar");
  const prioritizeProgressFill = document.getElementById("prioritizeProgressFill");
  const optionABtn = document.getElementById("optionA");
  const optionBBtn = document.getElementById("optionB");

  const finalView = document.getElementById("finalView");
  const finalList = document.getElementById("finalList");
  const printBtn = document.getElementById("printBtn");

  const saveBtn = document.getElementById("saveBtn");
  const footerRestartBtn = document.getElementById("footerRestartBtn");
  const RETURN_TO_START_KEY = "birdleaf-return-start";
  const PROGRESS_STORAGE_KEY = "birdleaf-progress";
  const SAVE_SCHEMA_VERSION = 2;
  const START_LABEL = "Start/Continue";
  const CONTINUE_LABEL = "Start/Continue";

  /* DATA */
  let hasSavedWordProgress = false;
  let words;
  try {
    const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (saved) {
      const progress = JSON.parse(saved);
      if (hasValidSavedWords(progress.words)) {
        words = progress.words;
      } else {
        words = shuffle(
          Object.entries(valuesData).flatMap(([value, list]) =>
            list.map(word => ({ word, value }))
          )
        );
      }
    } else {
      words = shuffle(
        Object.entries(valuesData).flatMap(([value, list]) =>
          list.map(word => ({ word, value }))
        )
      );
    }
  } catch (e) {
    words = shuffle(
      Object.entries(valuesData).flatMap(([value, list]) =>
        list.map(word => ({ word, value }))
      )
    );
  }

  /* UTILITY */

  let prioritizer = null;
  let currentComparison = null;
  let displayedOptionA = null;
  let displayedOptionB = null;
  let finalRanking = null;
  let autoSaveSuspended = false;
  const wordLastSide = new Map();

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
    showWordScreen();
    updateProgress();
    renderWord();
    saveProgress();
  };

  /* WORD PHASE */
  function renderWord() {
    updateProgress();

    if (!words || !Array.isArray(words) || words.length === 0) {
      wordEl.textContent = "Error: No words loaded";
      return;
    }
    if (state.currentIndex >= words.length) {
      showResults();
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

    if (state.currentIndex > 0 && state.currentIndex % 50 === 0) {
      checkpointOverlay.classList.remove("hidden");
    }
  }

  function handleAnswer(delta) {
    const { value } = words[state.currentIndex];
    answerCurrentWord(value, delta);
    renderWord();
    saveProgress();
  }

  feelsBtn.onclick = () => handleAnswer(1);
  neutralBtn.onclick = () => handleAnswer(0);
  notBtn.onclick = () => handleAnswer(-1);

  revisitBtn.onclick = () => {
    checkpointOverlay.classList.add("hidden");
    rewind(50);
    renderWord();
    saveProgress();
  };

  keepGoingBtn.onclick = () => {
    checkpointOverlay.classList.add("hidden");
  };

  saveOkBtn.onclick = () => {
    saveOverlay.classList.add("hidden");
  };

  resultsPrintBtn.onclick = () => window.print();

  /* RESULTS */
  function showResults() {
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
    progressContainer.classList.add("hidden");
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

    resultsView.classList.remove("hidden");
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

    showPrioritizeScreen();

    nextComparison();
  };

  function nextComparison() {
    if (!prioritizer) {
      return;
    }

    updatePrioritizationProgress();
    currentComparison = prioritizer.getNextComparison();
    if (!currentComparison) {
      showFinal();
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
    state.mode = "final";
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    progressContainer.classList.add("hidden");
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

  saveBtn.onclick = () => {
    saveProgress({ force: true });
    saveOverlay.classList.remove("hidden");
  };
  footerRestartBtn.onclick = confirmRestart;
  restartConfirmBtn.onclick = performRestart;
  restartCancelBtn.onclick = () => {
    restartOverlay.classList.add("hidden");
  };

  function saveProgressForInfoNav() {
    saveProgress();
    sessionStorage.setItem(RETURN_TO_START_KEY, "1");
  }

  function saveProgress(options = {}) {
    if (autoSaveSuspended && !options.force) {
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

  function updateProgress() {
    const total = Array.isArray(words) ? words.length : 0;
    const percentage = total > 0
      ? Math.min(100, Math.max(0, (state.currentIndex / total) * 100))
      : 0;

    progressFill.style.width = `${percentage}%`;
    progressBar.setAttribute("aria-valuenow", String(Math.round(percentage)));
  }

  function updatePrioritizationProgress() {
    if (!prioritizer) {
      prioritizeProgressFill.style.width = "0%";
      prioritizeProgressBar.setAttribute("aria-valuenow", "0");
      return;
    }

    const { completed, total } = prioritizer.getProgress();
    const percentage = total > 0 ? (completed / total) * 100 : 100;
    const boundedPercentage = Math.min(100, Math.max(0, percentage));

    prioritizeProgressFill.style.width = `${boundedPercentage}%`;
    prioritizeProgressBar.setAttribute("aria-valuenow", String(Math.round(boundedPercentage)));
  }

  function showWordScreen() {
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    progressContainer.classList.remove("hidden");

    app.classList.remove("hidden");
    wordEl.classList.remove("hidden");
    mainButtons.classList.remove("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");
  }

  function showPrioritizeScreen() {
    hideTransientOverlays();
    startBtn.classList.add("hidden");
    orientation.classList.add("hidden");
    progressContainer.classList.add("hidden");
    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    finalView.classList.add("hidden");
    prioritizeView.classList.remove("hidden");
  }

  function showStartScreen() {
    hideTransientOverlays();
    updateStartButtonLabel();
    startBtn.classList.remove("hidden");
    orientation.classList.remove("hidden");
    progressContainer.classList.add("hidden");

    app.classList.add("hidden");
    wordEl.classList.add("hidden");
    mainButtons.classList.add("hidden");
    resultsView.classList.add("hidden");
    prioritizeView.classList.add("hidden");
    finalView.classList.add("hidden");
  }

  function hideTransientOverlays() {
    checkpointOverlay.classList.add("hidden");
    saveOverlay.classList.add("hidden");
    restartOverlay.classList.add("hidden");
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
    const prioritizeState = progress.prioritize;
    if (!prioritizeState || typeof prioritizeState !== "object") {
      return false;
    }

    const snapshot = prioritizeState.engineSnapshot;
    if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.values)) {
      return false;
    }

    const snapshotValues = snapshot.values.filter(value => typeof value === "string");
    if (snapshotValues.length === 0) {
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
    updatePrioritizationProgress();
    saveProgress();
    return true;
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
            updateProgress();
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
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    sessionStorage.removeItem(RETURN_TO_START_KEY);
    resetState();
    location.reload();
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

});
