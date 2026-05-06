import { _el, _renderField } from './markdown.js';
import { Storage } from './storage.js';

export function _updateProgress(state) {
  const pct = (state.current / state.questions.length) * 100;
  const bar = _el('#qz-progress-fill');
  if (bar) bar.style.width = pct + '%';
  const lbl = _el('#qz-progress-label');
  if (lbl) lbl.textContent = `${state.current} / ${state.questions.length}`;
}

export function _renderPastAttempts(state) {
  const attempts = Storage.getAttempts(state.quizId);
  const el = _el('#qz-past-attempts');
  if (!el || attempts.length === 0) return;
  const last3 = attempts.slice(-3).reverse();
  el.innerHTML = `<span class="qz-attempts-label">Dernières tentatives :</span> ` +
    last3.map(a => {
      const pts  = a.totalPoints ?? a.score;
      const max  = a.total;
      const pct  = pts / max;
      const cls  = pct >= 0.75 ? 'badge-green' : pct >= 0.5 ? 'badge-orange' : 'badge-red';
      const disp = Number.isInteger(pts) && pts === a.score
        ? `${a.score}/${a.total}`
        : `${pts.toFixed(1)}/${a.total} pts`;
      return `<span class="badge ${cls}">${disp}</span>`;
    }).join(' ');
}

export function _showResults(state) {
  const score       = state.answers.filter(a => a.correct).length;
  const total       = state.questions.length;
  const totalPoints = state.answers.reduce((s, a) => s + (a?.points ?? 0), 0);
  const maxPoints   = total;
  const pct         = Math.round((totalPoints / maxPoints) * 100);
  const elapsed     = Math.round((Date.now() - state.started) / 1000);
  const mins        = Math.floor(elapsed / 60);
  const secs        = elapsed % 60;

  Storage.recordAttempt(state.quizId, score, total, totalPoints);
  const attempts = Storage.getAttempts(state.quizId);
  const bestPts  = Math.max(...attempts.map(a => a.totalPoints ?? a.score));

  const emoji = pct === 100 ? '🏆' : pct >= 75 ? '🎯' : pct >= 50 ? '📚' : '💪';

  _el('#qz-question-area').style.display = 'none';
  const res = _el('#qz-results');
  res.style.display = 'block';

  const exBlock = state.exercise ? `
    <details class="qz-exercise">
      <summary class="qz-exercise-summary">
        ✏️ Maintenant, essaie toi-même — énoncé complet
      </summary>
      <div class="qz-exercise-body" id="qz-exercise-body"></div>
    </details>` : '';

  res.innerHTML = `
    <div class="qz-score-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="8"/>
        <circle cx="60" cy="60" r="50" fill="none"
          stroke="${pct >= 75 ? 'var(--accent3)' : pct >= 50 ? 'var(--accent5)' : 'var(--accent)'}"
          stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${2 * Math.PI * 50}"
          stroke-dashoffset="${2 * Math.PI * 50 * (1 - pct / 100)}"
          transform="rotate(-90 60 60)"
          style="transition: stroke-dashoffset 1s ease"/>
      </svg>
      <div class="qz-score-text">
        <span class="qz-score-pct">${pct}%</span>
        <span class="qz-score-frac">${totalPoints.toFixed(1)} / ${maxPoints} pts</span>
      </div>
    </div>
    <div class="qz-result-emoji">${emoji}</div>
    <div class="qz-result-meta">
      ${score}/${total} correctes
      &nbsp;·&nbsp; Temps : ${mins > 0 ? mins + 'm ' : ''}${secs}s
      &nbsp;·&nbsp; Meilleur : ${bestPts.toFixed(1)} pts
      &nbsp;·&nbsp; ${attempts.length} tentative${attempts.length > 1 ? 's' : ''}
    </div>
    <div class="qz-review">
      <h3>Récapitulatif</h3>
      ${state.questions.map((q, i) => {
        const ans = state.answers[i];
        const pts = ans?.points ?? 0;
        const ptsLabel = ans?.correct
          ? (pts >= 0.995 ? '1 pt' : `${pts.toFixed(2)} pt`)
          : '0 pt';
        return `
          <div class="qz-review-item ${ans?.correct ? 'ok' : 'ko'}">
            <span class="qz-review-icon">${ans?.correct ? '✓' : '✗'}</span>
            <span class="qz-review-q qz-review-q-${i}"></span>
            <span class="qz-review-pts">${ptsLabel}</span>
          </div>`;
      }).join('')}
    </div>
    ${exBlock}
    <div class="qz-result-actions">
      <button class="qz-btn qz-btn-secondary" onclick="QuizEngine.restart()">↺ Recommencer</button>
      <a class="qz-btn qz-btn-primary" href="quizzes/">← Quizzes</a>
    </div>
  `;

  state.questions.forEach((q, i) => {
    const el = res.querySelector(`.qz-review-q-${i}`);
    if (el) _renderField(el, q.question);
  });

  if (state.exercise) {
    const exBody = res.querySelector('#qz-exercise-body');
    if (exBody) _renderField(exBody, state.exercise);
  }
}
