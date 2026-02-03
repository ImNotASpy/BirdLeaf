// engine.js

export const state = {
  mode: "words", // "words" | "results" | "prioritize" | "final"
  currentIndex: 0,
  history: [],
  scores: {}
};

export function answerCurrentWord(valueName, delta) {
  if (!state.scores[valueName]) {
    state.scores[valueName] = 0;
  }
  state.scores[valueName] += delta;

  state.history.push({
    index: state.currentIndex,
    value: valueName,
    delta
  });

  state.currentIndex++;
}

export function rewind(count) {
  for (let i = 0; i < count; i++) {
    const last = state.history.pop();
    if (!last) break;

    state.currentIndex = last.index;
    state.scores[last.value] -= last.delta;
  }
}

export function resetState() {
  state.mode = "words";
  state.currentIndex = 0;
  state.history = [];
  state.scores = {};
}
