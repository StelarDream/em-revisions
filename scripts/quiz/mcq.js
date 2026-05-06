import { _el } from './markdown.js';

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _esc(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Resolve q.answer to an array of option strings.
// Accepts: string, number (1-indexed), or array of either.
export function _resolveAnswers(q) {
  const raw = Array.isArray(q.answer) ? q.answer : [q.answer];
  return raw.map(v => (typeof v === 'number' ? (q.options[v - 1] ?? String(v)) : v));
}

function _wireOptions(container, isMulti, enforceCount) {
  const optDiv  = container.querySelector('.qz-options');
  const options = [...container.querySelectorAll('.qz-option')];

  const _updateSubmit = () => {
    const selectedCount = options.filter(l => l.classList.contains('selected')).length;
    const btn = _el('#qz-submit');
    if (!btn) return;
    if (enforceCount) {
      const required = parseInt(optDiv?.dataset.required ?? '1');
      btn.disabled = selectedCount !== required;
    } else {
      btn.disabled = selectedCount === 0;
    }
  };

  options.forEach((lbl, idx) => {
    lbl.addEventListener('click', () => {
      if (lbl.classList.contains('answer-wrong') || lbl.classList.contains('answer-correct')) return;
      if (isMulti) {
        lbl.classList.toggle('selected');
      } else {
        options.forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
      }
      _updateSubmit();
    });

    lbl.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        lbl.click();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const avail = options.filter(l => !l.classList.contains('answer-wrong') && !l.classList.contains('answer-correct'));
        const i = avail.indexOf(lbl);
        if (i < avail.length - 1) avail[i + 1].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const avail = options.filter(l => !l.classList.contains('answer-wrong') && !l.classList.contains('answer-correct'));
        const i = avail.indexOf(lbl);
        if (i > 0) avail[i - 1].focus();
      }
    });
  });

  setTimeout(() => {
    const first = options.find(l => !l.classList.contains('answer-wrong') && !l.classList.contains('answer-correct'));
    if (first) first.focus();
  }, 0);
}

export function _renderMCQ(q, container) {
  const answers      = _resolveAnswers(q);
  const isMulti      = answers.length > 1 || q.reveal_right_amount === false;
  const enforceCount = isMulti && q.reveal_right_amount !== false;
  const shuffled     = q.shuffleAnswers !== false ? _shuffle([...q.options]) : [...q.options];

  container.innerHTML = `
    <div class="qz-options${isMulti ? ' qz-multi' : ''}" role="${isMulti ? 'group' : 'radiogroup'}"
         ${enforceCount ? `data-required="${answers.length}"` : ''}>
      ${shuffled.map((opt, i) => `
        <label class="qz-option" data-value="${_esc(opt)}" tabindex="0">
          <span class="qz-opt-key">${String.fromCharCode(65 + i)}</span>
          <span class="qz-opt-text">${opt}</span>
        </label>
      `).join('')}
    </div>
    ${enforceCount ? `
      <div class="qz-multi-hint">
        Sélectionne <span id="qz-multi-remaining">${answers.length}</span> réponse${answers.length > 1 ? 's' : ''}
      </div>` : ''}
  `;

  _wireOptions(container, isMulti, enforceCount);
}

export function _renderConceptual(q, container) {
  _renderMCQ(q, container);
}

// Returns array of selected string values, or null if nothing selected.
export function _checkMCQ(q, container) {
  const selected = [...container.querySelectorAll('.qz-option.selected')];
  return selected.length > 0 ? selected.map(l => l.dataset.value) : null;
}
