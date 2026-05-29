import { _el, _renderField } from './markdown.js';
import { _normFill, _isRecognizedFormat, _resolveRecognised } from './normalize.js';

export function _renderFillBlank(q, container) {
  const tokens = _resolveRecognised(q.recognised);
  const symbols = q.symbols || [];
  const legendHtml = symbols.length > 0 ? `
    <div class="qz-sym-legend">
      <span class="qz-sym-label">Symboles :</span>
      ${symbols.map(s => `<span class="qz-sym-token" title="Cliquer pour insérer" data-sym="${s}">${s}</span>`).join('')}
    </div>` : '';

  container.innerHTML = `
    <div class="qz-fill">
      ${legendHtml}
      <div class="qz-fill-input-row">
        <input class="qz-input" id="qz-blank" type="text"
               placeholder="votre réponse…" autocomplete="off" spellcheck="false">
        <span class="qz-fill-status" id="qz-fill-status"></span>
      </div>
      <div class="qz-fill-format-warn" id="qz-fill-format-warn" style="display:none"></div>
    </div>`;

  container.querySelectorAll('.qz-sym-token').forEach(tok => {
    tok.addEventListener('click', () => {
      const inp = container.querySelector('#qz-blank');
      const pos = inp.selectionStart;
      const val = inp.value;
      const sym = tok.dataset.sym;
      inp.value = val.slice(0, pos) + sym + val.slice(pos);
      inp.focus();
      inp.setSelectionRange(pos + sym.length, pos + sym.length);
      inp.dispatchEvent(new Event('input'));
    });
  });

  const inp = container.querySelector('#qz-blank');
  const status = container.querySelector('#qz-fill-status');

  inp.addEventListener('input', () => {
    const v = inp.value.trim();
    _el('#qz-submit').disabled = v.length === 0;
    _el('#qz-fill-format-warn').style.display = 'none';

    if (v.length === 0) {
      status.textContent = '';
      status.className = 'qz-fill-status';
      inp.className = 'qz-input';
    } else if (_isRecognizedFormat(v, tokens)) {
      status.textContent = '✓';
      status.className = 'qz-fill-status recognized';
      inp.className = 'qz-input recognized';
    } else {
      status.textContent = '?';
      status.className = 'qz-fill-status unrecognized';
      inp.className = 'qz-input unrecognized';
    }
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim().length > 0) {
      const btn = _el('#qz-submit');
      if (btn && !btn.disabled) btn.click();
    }
  });

  setTimeout(() => inp.focus(), 0);
}

// Returns { raw, correct } if valid format, null if format invalid (shows warning).
export function _checkFill(q) {
  const inp = _el('#qz-blank');
  if (!inp) return null;
  const raw = inp.value.trim();
  if (!raw) return null;

  const tokens = _resolveRecognised(q.recognised);
  if (!_isRecognizedFormat(raw, tokens)) {
    const warn = _el('#qz-fill-format-warn');
    if (warn) {
      warn.innerHTML = `⚠ Format non reconnu.`;
      warn.style.display = 'block';
    }
    return null;
  }

  const normalized = _normFill(raw);
  const accepts = Array.isArray(q.answer) ? q.answer : [q.answer];
  const correct = accepts.some(a => _normFill(a) === normalized);
  return { raw, correct, normalized };
}
