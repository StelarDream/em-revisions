/**
 * QuizEngine — EM Revision quiz library
 * Supports: MCQ (single/multi-answer), true/false, fill-in-blank, numeric
 * Persistent scoring via localStorage
 */

import { Storage }                                         from './quiz/storage.js';
import { _el, _renderMath, _renderField }                  from './quiz/markdown.js';
import { _renderMCQ, _checkMCQ,
         _resolveAnswers }                                 from './quiz/mcq.js';
import { _renderTF, _checkTF }                             from './quiz/tf.js';
import { _renderFillBlank, _checkFill }                    from './quiz/fill.js';
import { _renderNumeric, _checkNumeric }                   from './quiz/numeric.js';
import { _showFeedback, _showWrongFeedback }               from './quiz/feedback.js';
import { _updateProgress, _renderPastAttempts,
         _showResults }                                    from './quiz/results.js';
import { setTokenSets, setNormSpec, _mergeNormSpecs }      from './quiz/normalize.js';
import { calcPoints, calcMCQPoints,
         loadScoringConfig, saveScoringConfig }            from './quiz/scoring.js';

const state = {
  quizId:       null,
  questions:    [],
  current:      0,
  answers:      [],   // { given, correct, points }
  started:      null,
  exercise:     null,
  triedWrong:   [],   // per question: array of wrong submissions (normalized str / float / option str)
  hintUsed:     [],   // boolean per question
  foundCorrect: [],   // array of string[] — correct options found so far (MCQ)
};

let _scoringCfg = loadScoringConfig();

const _jsonCache = new Map();

function _fetchJson(url) {
  if (!_jsonCache.has(url)) {
    _jsonCache.set(url, fetch(url).then(r => r.json()).catch(() => ({})));
  }
  return _jsonCache.get(url);
}

async function _ensureSets(setsFile, extraSets) {
  const defaults = setsFile ? await _fetchJson(setsFile) : {};
  setTokenSets({ ...defaults, ...extraSets });
}

async function _ensureNorm(normFile, extraNorm) {
  const fromFile = normFile ? await _fetchJson(normFile) : null;
  const specs    = [fromFile, extraNorm].filter(Boolean);
  if (specs.length > 0) setNormSpec(_mergeNormSpecs(...specs));
}

function _isCorrect(q, given) {
  if (given === null) return false;
  if (q.type === 'tf') return given === String(q.answer);
  return given === q.answer;
}

function _renderQuestion() {
  if (state.current >= state.questions.length) { _showResults(state); return; }

  const q = state.questions[state.current];
  _el('#qz-question-area').style.display = 'block';
  _el('#qz-results').style.display = 'none';

  const typeLabel = { mcq: 'QCM', tf: 'Vrai / Faux', fill: 'Compléter', numeric: 'Numérique' };
  _el('#qz-qnum').textContent  = `Question ${state.current + 1} / ${state.questions.length}`;
  _el('#qz-qtype').textContent = typeLabel[q.type] || q.type;
  _el('#qz-qtype').className   = `qz-type-badge qz-type-${q.type}`;

  _renderField(_el('#qz-qtext'), q.question);

  const ctx = _el('#qz-context');
  if (q.context) {
    _renderField(ctx, q.context);
    ctx.style.display = 'block';
  } else {
    ctx.style.display = 'none';
  }

  const inp = _el('#qz-input-area');
  inp.innerHTML = '';
  if      (q.type === 'mcq')        _renderMCQ(q, inp);
  else if (q.type === 'tf')         _renderTF(q, inp);
  else if (q.type === 'fill')       _renderFillBlank(q, inp);
  else if (q.type === 'numeric')    _renderNumeric(q, inp);
  _renderMath(inp);

  // Hint button — injected once, reused each question
  let hintArea = _el('#qz-hint-area');
  if (!hintArea) {
    hintArea = document.createElement('div');
    hintArea.id = 'qz-hint-area';
    _el('#qz-feedback').insertAdjacentElement('beforebegin', hintArea);
  }
  hintArea.innerHTML = '';
  if (q.hint) {
    const alreadyUsed = state.hintUsed[state.current];
    hintArea.innerHTML = `
      <button class="qz-btn qz-btn-hint" id="qz-hint-btn" onclick="QuizEngine.showHint()"
              ${alreadyUsed ? 'style="display:none"' : ''}>💡 Indice</button>
      <div class="qz-hint-content" id="qz-hint-content"
           ${alreadyUsed ? '' : 'style="display:none"'}></div>
    `;
    _renderField(_el('#qz-hint-content'), q.hint);
    _renderMath(_el('#qz-hint-content'));
  }

  const actions = _el('#qz-actions-row');
  if (actions) {
    actions.innerHTML = `
      <button id="qz-submit" class="qz-btn qz-btn-primary" onclick="QuizEngine.submit()">Valider</button>
      <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.next()">Suivant →</button>
    `;
    _el('#qz-submit').disabled = q.type === 'fill' || q.type === 'numeric';
  }
  const fb = _el('#qz-feedback');
  fb.style.display = 'none';
  fb.innerHTML = '';
}

async function loadQuiz(quizId, questions, exercise, options = {}) {
  await Promise.all([
    _ensureSets(options.setsFile || null, options.sets || {}),
    _ensureNorm(options.normFile || null, options.norm  || null),
  ]);

  _scoringCfg = loadScoringConfig();

  state.quizId       = quizId;
  state.questions    = questions;
  state.exercise     = exercise || null;
  state.current      = 0;
  state.answers      = [];
  state.triedWrong   = [];
  state.hintUsed     = [];
  state.foundCorrect = [];
  state.started      = Date.now();
  _renderQuestion();
  _updateProgress(state);
  _renderPastAttempts(state);
}

// Helper: find an option label by its value string
function _optionByValue(value) {
  return [..._el('#qz-input-area').querySelectorAll('.qz-option')]
    .find(l => l.dataset.value === value);
}

function submit() {
  const q   = state.questions[state.current];
  const idx = state.current;
  const wrongFlags = (state.triedWrong[idx] || []).length;
  const hintUsed   = state.hintUsed[idx]    || false;

  // ── True / False ──────────────────────────────────────────────────────────
  // Final immediately: 0 or 1 pt, no retry.
  if (q.type === 'tf') {
    const given   = _checkTF(q, _el('#qz-input-area'));
    if (given === null) return;
    const correct = _isCorrect(q, given);
    const points  = correct ? Math.max(0, 1 - (hintUsed ? _scoringCfg.hintPenalty : 0)) : 0;
    state.answers[idx] = { given, correct, points };
    _showFeedback(q, given, correct, correct ? points : null);
    return;
  }

  // ── MCQ / Conceptual ──────────────────────────────────────────────────────
  // Retry by elimination; correct picks locked green (no cost), wrong picks locked red (penalise).
  // Points = (N_wrong - wrongFlags) / N_wrong.
  if (q.type === 'mcq') {
    const selected = _checkMCQ(q, _el('#qz-input-area'));
    if (selected === null) return;

    const correctAnswers = _resolveAnswers(q);
    const correctSet     = new Set(correctAnswers);
    const foundSet       = new Set(state.foundCorrect[idx] || []);

    const wrongPicked  = selected.filter(v => !correctSet.has(v));
    const newlyFound   = selected.filter(v => correctSet.has(v) && !foundSet.has(v));

    // Lock wrong picks
    wrongPicked.forEach(v => {
      const lbl = _optionByValue(v);
      if (lbl) { lbl.style.pointerEvents = 'none'; lbl.classList.add('answer-wrong'); lbl.classList.remove('selected'); }
    });

    // Lock newly found correct picks
    newlyFound.forEach(v => {
      const lbl = _optionByValue(v);
      if (lbl) { lbl.style.pointerEvents = 'none'; lbl.classList.add('answer-correct'); lbl.classList.remove('selected'); }
      foundSet.add(v);
    });

    state.triedWrong[idx]   = [...(state.triedWrong[idx] || []), ...wrongPicked];
    state.foundCorrect[idx] = [...foundSet];

    const allFound = correctAnswers.every(v => foundSet.has(v));

    if (allFound) {
      const points = calcMCQPoints(q.options.length, correctAnswers.length, state.triedWrong[idx].length, hintUsed, _scoringCfg);
      state.answers[idx] = { given: [...foundSet].join(' | '), correct: true, points };
      _showFeedback(q, state.answers[idx].given, true, points);
    } else {
      // Update the remaining-count hint
      const remaining = correctAnswers.length - foundSet.size;
      const optDiv = _el('#qz-input-area').querySelector('.qz-options[data-required]');
      if (optDiv) optDiv.dataset.required = remaining;
      const remEl = _el('#qz-multi-remaining');
      if (remEl) {
        remEl.textContent = remaining;
        const hint = remEl.closest('.qz-multi-hint');
        if (hint) hint.innerHTML =
          `Sélectionne encore <span id="qz-multi-remaining">${remaining}</span> réponse${remaining > 1 ? 's' : ''}`;
      }
      _el('#qz-submit').disabled = true;
      _showWrongFeedback(q, state.triedWrong[idx].length, { onRetry: retry, onGiveUp: null });
      _el('#qz-input-area').querySelectorAll('.qz-option:not(.answer-wrong):not(.answer-correct)')
        .forEach(lbl => { lbl.style.pointerEvents = 'none'; });
    }
    return;
  }

  // ── Fill ──────────────────────────────────────────────────────────────────
  if (q.type === 'fill') {
    const result = _checkFill(q);
    if (result === null) return;

    if (result.correct) {
      const points = calcPoints(wrongFlags, hintUsed, _scoringCfg);
      state.answers[idx] = { given: result.raw, correct: true, points };
      _el('#qz-blank').className = 'qz-input answer-correct-input';
      _showFeedback(q, result.raw, true, points);
    } else {
      const tried = state.triedWrong[idx] || [];
      const isDuplicate = tried.includes(result.normalized);
      if (!isDuplicate) tried.push(result.normalized);
      state.triedWrong[idx] = tried;
      const blankF = _el('#qz-blank');
      blankF.className = 'qz-input answer-wrong-input';
      blankF.disabled = true;
      const warn = _el('#qz-fill-format-warn');
      if (warn && isDuplicate) { warn.textContent = '↩ Vous avez déjà essayé cette réponse.'; warn.style.display = 'block'; }
      _showWrongFeedback(q, tried.length, { onRetry: retry, onGiveUp: giveUp });
    }
    return;
  }

  // ── Numeric ───────────────────────────────────────────────────────────────
  if (q.type === 'numeric') {
    const result = _checkNumeric(q);
    if (result === null) return;

    if (result.correct) {
      const points = calcPoints(wrongFlags, hintUsed, _scoringCfg);
      state.answers[idx] = { given: result.raw, correct: true, points };
      _el('#qz-blank').className = 'qz-input answer-correct-input';
      _showFeedback(q, result.raw, true, points);
    } else {
      const tried = state.triedWrong[idx] || [];
      const isDuplicate = tried.some(v => Math.abs(result.value - v) <= result.tolerance);
      if (!isDuplicate) tried.push(result.value);
      state.triedWrong[idx] = tried;
      const blankN = _el('#qz-blank');
      blankN.className = 'qz-input answer-wrong-input';
      blankN.disabled = true;
      const warn = _el('#qz-fill-format-warn');
      if (warn && isDuplicate) { warn.textContent = '↩ Vous avez déjà essayé cette valeur.'; warn.style.display = 'block'; }
      _showWrongFeedback(q, tried.length, { onRetry: retry, onGiveUp: giveUp });
    }
  }
}

function retry() {
  const q = state.questions[state.current];
  const fb = _el('#qz-feedback');
  fb.style.display = 'none';
  fb.innerHTML = '';

  const actions = _el('#qz-actions-row');
  actions.innerHTML = `
    <button id="qz-submit" class="qz-btn qz-btn-primary" onclick="QuizEngine.submit()">Valider</button>
    <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.next()">Suivant →</button>
  `;

  if (q.type === 'fill' || q.type === 'numeric') {
    const inp = _el('#qz-blank');
    if (inp) {
      inp.className = 'qz-input';
      inp.value = '';
      inp.disabled = false;
      const status = _el('#qz-fill-status');
      if (status) { status.textContent = ''; status.className = 'qz-fill-status'; }
      const warn = _el('#qz-fill-format-warn');
      if (warn) warn.style.display = 'none';
      _el('#qz-submit').disabled = true;
      inp.focus();
    }
  } else if (q.type === 'mcq') {
    const available = [..._el('#qz-input-area').querySelectorAll('.qz-option:not(.answer-wrong):not(.answer-correct)')];
    available.forEach(lbl => { lbl.style.pointerEvents = ''; lbl.classList.remove('selected'); });
    _el('#qz-submit').disabled = true;
    setTimeout(() => available[0]?.focus(), 0);
  }
}

function giveUp() {
  const q = state.questions[state.current];
  state.answers[state.current] = { given: null, correct: false, points: 0 };
  const inp = _el('#qz-blank');
  if (inp) { inp.disabled = true; inp.className = 'qz-input answer-wrong-input'; }
  _showFeedback(q, null, false, null);
}

function showHint() {
  state.hintUsed[state.current] = true;
  const btn = _el('#qz-hint-btn');
  if (btn) btn.style.display = 'none';
  const content = _el('#qz-hint-content');
  if (content) content.style.display = 'block';
}

function next() {
  state.current++;
  _updateProgress(state);
  _renderQuestion();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restart() {
  state.current      = 0;
  state.answers      = [];
  state.triedWrong   = [];
  state.hintUsed     = [];
  state.foundCorrect = [];
  state.started      = Date.now();
  _el('#qz-results').style.display       = 'none';
  _el('#qz-question-area').style.display = 'block';
  _updateProgress(state);
  _renderQuestion();
}

// Console helper: QuizEngine.setScoringConfig({ decayRate: 0.3, hintPenalty: 0.1 })
function setScoringConfig(cfg) {
  _scoringCfg = { ..._scoringCfg, ...cfg };
  saveScoringConfig(_scoringCfg);
  console.log('[QuizEngine] Scoring config updated:', _scoringCfg);
}

export const QuizEngine = { loadQuiz, submit, retry, giveUp, showHint, next, restart, Storage, setScoringConfig };
window.QuizEngine = QuizEngine;
