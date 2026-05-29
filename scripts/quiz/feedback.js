import { _el, _renderField } from './markdown.js';
import { _normFill } from './normalize.js';
import { _resolveAnswers } from './mcq.js';

function _ptsHtml(points) {
  if (points === null || points === undefined) return '';
  const isAmazing = points >= 0.9;
  const isLow = points <= 0.1;
  const label = isAmazing ? '1 pt' : `${points.toFixed(2)} pt`;
  const mod = isAmazing ? ' pts-amazing' : isLow ? ' pts-low' : '';
  return `<span class="qz-earned-pts${mod}">${isAmazing ? '★ ' : ""}+${label}</span>`;
}

export function _showFeedback(q, given, correct, points = null) {
  const fb = _el('#qz-feedback');
  fb.className = `qz-feedback ${correct ? 'correct' : 'incorrect'}`;

  const container = _el('#qz-input-area');
  if (q.type === 'mcq' || q.type === 'tf') {
    const correctValues = new Set(_resolveAnswers(q));
    container.querySelectorAll('.qz-option').forEach(lbl => {
      lbl.style.pointerEvents = 'none';
      if (correctValues.has(lbl.dataset.value)) lbl.classList.add('answer-correct');
      else if (lbl.classList.contains('selected') && !correct) lbl.classList.add('answer-wrong');
    });
  }

  const firstAnswer = Array.isArray(q.answer) ? q.answer[0] : q.answer;
  const firstResolved = (typeof firstAnswer === 'number' && q.options)
    ? (q.options[firstAnswer - 1] ?? String(firstAnswer))
    : String(firstAnswer);
  fb.innerHTML = `
    <div class="qz-fb-header">
      <span class="qz-fb-icon">${correct ? '✓' : '✗'}</span>
      <span class="qz-fb-title">${correct ? 'Correct !' : 'Pas tout à fait…'}</span>
    </div>
    ${!correct && q.type === 'fill' ? `<div class="qz-fb-answer">Réponse : <strong>${_normFill(firstResolved)}</strong> &nbsp;<span class="qz-fb-answer-raw">(${firstResolved})</span></div>` : ''}
    ${!correct && q.type === 'numeric' ? `<div class="qz-fb-answer">Réponse attendue : <strong>${q.answer}</strong></div>` : ''}
    <div class="qz-fb-explanation"></div>
  `;
  _renderField(fb.querySelector('.qz-fb-explanation'), q.explanation || '');
  fb.style.display = 'block';

  const actions = _el('#qz-actions-row');
  if (actions) {
    actions.innerHTML = `
      ${correct ? _ptsHtml(points) : ''}
      <button id="qz-submit" class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.submit()">Valider</button>
      <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:inline-flex" onclick="QuizEngine.next()">Suivant →</button>
    `;
    setTimeout(() => _el('#qz-next')?.focus(), 0);
  }
}

export function _showWrongFeedback(q, wrongCount, { onRetry, onGiveUp }) {
  const fb = _el('#qz-feedback');
  fb.className = 'qz-feedback incorrect';
  fb.innerHTML = `
    <div class="qz-fb-header">
      <span class="qz-fb-icon">✗</span>
      <span class="qz-fb-title">Pas tout à fait… <span class="qz-attempt-count">(tentative ${wrongCount})</span></span>
    </div>
  `;
  fb.style.display = 'block';

  const isFillLike = q.type === 'fill' || q.type === 'numeric';
  const actions = _el('#qz-actions-row');
  actions.innerHTML = `
    <button class="qz-btn qz-btn-secondary" id="qz-retry">↩ Réessayer</button>
    ${isFillLike ? '<button class="qz-btn qz-btn-giveup" id="qz-giveup">Voir la réponse</button>' : ''}
  `;
  document.getElementById('qz-retry').addEventListener('click', onRetry);
  if (isFillLike && onGiveUp) {
    document.getElementById('qz-giveup').addEventListener('click', onGiveUp);
  }
}
