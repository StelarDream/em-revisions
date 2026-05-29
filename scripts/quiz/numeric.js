import { _el, _renderField } from './markdown.js';

// Evaluate a simple numeric expression typed by the student.
// Accepts: digits, operators, parens, ^, and the identifiers below.
// Returns a finite number, or null if invalid/unsafe.
export function _evalNumericExpr(raw) {
  const s = raw.trim();
  if (!s) return null;

  // Whitelist: only allow these characters before keyword substitution
  if (!/^[\d\s\.\+\-\*\/\^\(\)pigesqrtabsincostanlog,]*$/i.test(s)) return null;

  const expr = s
    .replace(/\bpi\b/gi, String(Math.PI))
    .replace(/\be\b/g, String(Math.E))
    .replace(/\bsqrt\b/gi, 'Math.sqrt')
    .replace(/\babs\b/gi, 'Math.abs')
    .replace(/\bsin\b/gi, 'Math.sin')
    .replace(/\bcos\b/gi, 'Math.cos')
    .replace(/\btan\b/gi, 'Math.tan')
    .replace(/\blog\b/gi, 'Math.log')
    .replace(/\^/g, '**');

  try {
    // eslint-disable-next-line no-new-func
    const val = Function('"use strict"; return (' + expr + ')')();
    return typeof val === 'number' && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function _renderNumeric(q, container) {
  container.innerHTML = `
    <div class="qz-fill">
      <div class="qz-fill-input-row">
        <input class="qz-input" id="qz-blank" type="text"
               placeholder="votre réponse…" autocomplete="off" spellcheck="false"
               inputmode="decimal">
        <span class="qz-fill-status" id="qz-fill-status"></span>
      </div>
      <div class="qz-fill-hint" id="qz-fill-hint"></div>
      <div class="qz-fill-format-warn" id="qz-fill-format-warn" style="display:none"></div>
    </div>`;

  _renderField(
    container.querySelector('#qz-fill-hint'),
    'Entrez un nombre ou une expression (ex: `1/3`, `2*pi`)'
  );

  const inp = container.querySelector('#qz-blank');
  const status = container.querySelector('#qz-fill-status');

  inp.addEventListener('input', () => {
    const v = inp.value.trim();
    _el('#qz-submit').disabled = v.length === 0;
    _el('#qz-fill-format-warn').style.display = 'none';

    if (!v) {
      status.textContent = '';
      status.className = 'qz-fill-status';
      inp.className = 'qz-input';
    } else if (_evalNumericExpr(v) !== null) {
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
    if (e.key === 'Enter' && inp.value.trim()) {
      const btn = _el('#qz-submit');
      if (btn && !btn.disabled) btn.click();
    }
  });

  setTimeout(() => inp.focus(), 0);
}

// Returns { raw, correct } if valid expression, null if invalid (shows warning).
export function _checkNumeric(q) {
  const inp = _el('#qz-blank');
  if (!inp) return null;
  const raw = inp.value.trim();
  if (!raw) return null;

  const given = _evalNumericExpr(raw);
  if (given === null) {
    const warn = _el('#qz-fill-format-warn');
    if (warn) {
      warn.innerHTML = `⚠ Expression non reconnue. Exemples valides : <code>3</code>, <code>1/3</code>, <code>2*pi</code>, <code>sqrt(2)</code>.`;
      warn.style.display = 'block';
    }
    return null;
  }

  const expected = q.answer;
  const tolerance = q.tolerance ?? (Number.isInteger(expected) ? 0 : 1e-9);
  const correct = Math.abs(given - expected) <= tolerance;
  return { raw, correct, value: given, tolerance };
}
