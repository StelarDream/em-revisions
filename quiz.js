/**
 * QuizEngine — EM Revision quiz library
 * Supports: MCQ, true/false, formula-recall (fill-in-blank), conceptual (multi-step MCQ)
 * Persistent scoring via localStorage
 */

const QuizEngine = (() => {

  // ── Internal state ────────────────────────────────────────
  let _quizId    = null;
  let _questions = [];
  let _current   = 0;
  let _answers   = [];   // {given, correct} per question
  let _started   = null; // timestamp
  let _exercise  = null; // optional full exercise text (md: or HTML)

  // ── Storage helpers ───────────────────────────────────────
  const Storage = {
    key: id => `em_quiz_${id}`,

    save(id, data) {
      try { localStorage.setItem(this.key(id), JSON.stringify(data)); } catch(e) {}
    },

    load(id) {
      try { return JSON.parse(localStorage.getItem(this.key(id))); } catch(e) { return null; }
    },

    // Save a completed attempt summary
    recordAttempt(id, score, total) {
      const key = `em_attempts_${id}`;
      let attempts = [];
      try { attempts = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
      attempts.push({ date: new Date().toISOString(), score, total });
      // Keep last 20 attempts
      if (attempts.length > 20) attempts = attempts.slice(-20);
      try { localStorage.setItem(key, JSON.stringify(attempts)); } catch(e) {}
    },

    getAttempts(id) {
      try { return JSON.parse(localStorage.getItem(`em_attempts_${id}`)) || []; } catch(e) { return []; }
    },

    getAllStats() {
      const stats = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('em_attempts_')) {
            const id = k.replace('em_attempts_', '');
            stats[id] = JSON.parse(localStorage.getItem(k)) || [];
          }
        }
      } catch(e) {}
      return stats;
    }
  };

  // ── Render helpers ────────────────────────────────────────
  function _el(sel) { return document.querySelector(sel); }

  function _renderMath(el) {
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$",  right: "$$",  display: true  },
          { left: "\\[", right: "\\]", display: true  },
          { left: "$",   right: "$",   display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    }
  }

  // ── Markdown parser ───────────────────────────────────────
  // Any string field starting with "md:" is parsed as markdown+KaTeX.
  // All other strings pass through unchanged (raw HTML, backward-compatible).
  // Supports: **bold**, *italic*, `code`, ~~strike~~,
  //           - / * bullet lists, 1. numbered lists,
  //           ## headings, --- hr, blank line paragraph breaks,
  //           $inline$ and $$display$$ math (protected from md processing).
  function _md(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('md:')) return raw;
    let s = raw.slice(3).trim();

    // 1. Stash math so markdown transforms don't touch it
    const stash = [];
    s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => { stash.push(`$$${m}$$`); return `\x00M${stash.length-1}\x00`; });
    s = s.replace(/\$([^\$\n]+?)\$/g,    (_, m) => { stash.push(`$${m}$`);   return `\x00M${stash.length-1}\x00`; });

    // 2. Block-level pass
    const lines = s.split('\n');
    const chunks = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];

      if (/^---+$/.test(l.trim())) { chunks.push('<hr>'); i++; continue; }

      const hm = l.match(/^(#{1,4})\s+(.*)/);
      if (hm) { chunks.push(`<h${hm[1].length+2} class="qz-md-h">${_inlineMd(hm[2])}</h${hm[1].length+2}>`); i++; continue; }

      if (/^[-*]\s/.test(l)) {
        const items = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i]))
          items.push(`<li>${_inlineMd(lines[i++].replace(/^[-*]\s/,''))}</li>`);
        chunks.push(`<ul class="qz-md-ul">${items.join('')}</ul>`);
        continue;
      }

      if (/^\d+\.\s/.test(l)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i]))
          items.push(`<li>${_inlineMd(lines[i++].replace(/^\d+\.\s/,''))}</li>`);
        chunks.push(`<ol class="qz-md-ol">${items.join('')}</ol>`);
        continue;
      }

      if (l.trim() === '') { chunks.push('\x00BR\x00'); i++; continue; }
      chunks.push(_inlineMd(l)); i++;
    }

    // 3. Group text lines into paragraphs
    let html = '';
    let para = [];
    for (const c of chunks) {
      if (c === '\x00BR\x00') {
        if (para.length) { html += `<p class="qz-md-p">${para.join(' ')}</p>`; para = []; }
      } else if (c.startsWith('<')) {
        if (para.length) { html += `<p class="qz-md-p">${para.join(' ')}</p>`; para = []; }
        html += c;
      } else {
        para.push(c);
      }
    }
    if (para.length) html += `<p class="qz-md-p">${para.join(' ')}</p>`;

    // 4. Restore math stash
    html = html.replace(/\x00M(\d+)\x00/g, (_, idx) => stash[+idx]);
    return html;
  }

  function _inlineMd(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`([^`]+)`/g,     '<code class="qz-md-code">$1</code>')
      .replace(/~~(.+?)~~/g,     '<del>$1</del>');
  }

  // Set innerHTML from a field value (md: or raw HTML), then render KaTeX
  function _renderField(el, value) {
    el.innerHTML = _md(value || '');
    _renderMath(el);
  }

  // ── Question renderers ────────────────────────────────────

  function _renderMCQ(q, container) {
    const shuffled = q.shuffleAnswers !== false ? _shuffle([...q.options]) : [...q.options];
    container.innerHTML = `
      <div class="qz-options" role="radiogroup">
        ${shuffled.map((opt, i) => `
          <label class="qz-option" data-value="${_esc(opt)}">
            <span class="qz-opt-key">${String.fromCharCode(65+i)}</span>
            <span class="qz-opt-text">${opt}</span>
          </label>
        `).join('')}
      </div>`;
    container.querySelectorAll('.qz-option').forEach(lbl => {
      lbl.addEventListener('click', () => {
        container.querySelectorAll('.qz-option').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
        _el('#qz-submit').disabled = false;
      });
    });
  }

  function _renderTF(q, container) {
    container.innerHTML = `
      <div class="qz-options qz-tf" role="radiogroup">
        <label class="qz-option" data-value="true">
          <span class="qz-opt-key">V</span>
          <span class="qz-opt-text">Vrai</span>
        </label>
        <label class="qz-option" data-value="false">
          <span class="qz-opt-key">F</span>
          <span class="qz-opt-text">Faux</span>
        </label>
      </div>`;
    container.querySelectorAll('.qz-option').forEach(lbl => {
      lbl.addEventListener('click', () => {
        container.querySelectorAll('.qz-option').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
        _el('#qz-submit').disabled = false;
      });
    });
  }

  // ── Fill-in: normalization ────────────────────────────────
  // Strips spaces, lowercases, unifies common notation variants
  // so "-u_r/R^2" == "-ur/r^2" == "- u_R / R^2" etc.
  function _normFill(s) {
    return s
      .toLowerCase()
      .replace(/\s+/g, '')           // strip all spaces
      .replace(/\*\*/g, '*')         // ** → *
      .replace(/×/g, '*')            // × → *
      .replace(/÷/g, '/')            // ÷ → /
      .replace(/\^2/g, '²')          // ^2 → ²  (superscript token)
      .replace(/\^3/g, '³')          // ^3 → ³
      .replace(/\^n/g, 'ⁿ')          // ^n → ⁿ
      .replace(/vec\{([^}]+)\}/g, '$1') // \vec{x} → x
      .replace(/\\hat\{([^}]+)\}/g, '$1') // \hat{x} → x
      .replace(/hat_/g, '')          // hat_ prefix stripped
      .replace(/_/g, '')             // strip underscores (u_r → ur)
      .replace(/\\varepsilon/g, 'eps')
      .replace(/\\epsilon/g, 'eps')
      .replace(/\\mu/g, 'mu')
      .replace(/\\pi/g, 'pi')
      .replace(/\\vec/g, '')
      .replace(/\\hat/g, '')
      .replace(/[{}\\]/g, '');       // strip remaining LaTeX braces/backslashes
  }

  // Known symbol tokens — used for format validation feedback
  const KNOWN_TOKENS = [
    'u_r','u_theta','u_z','u_x','u_y','u_phi',
    'R','r','z','x','y',
    'pi','eps0','mu0',
    '0','1','2','3',
  ];

  // Heuristic: does the input look like it uses recognizable tokens?
  function _isRecognizedFormat(s) {
    if (!s || s.trim().length === 0) return false;
    // After stripping operators and digits, what remains should be known-ish tokens
    const stripped = s.replace(/[\s\+\-\*\/\^\(\)²³ⁿ0-9\.]/g, ' ').trim();
    if (stripped.length === 0) return true; // pure number/operator is fine
    // Check each remaining word fragment
    const words = stripped.split(/\s+/).filter(Boolean);
    return words.every(w => {
      const wl = w.toLowerCase().replace(/_/g,'');
      return KNOWN_TOKENS.some(t => t.toLowerCase().replace(/_/g,'').includes(wl) || wl.includes(t.toLowerCase().replace(/_/g,'')));
    });
  }

  // Per-question fill attempt counter (reset on each question render)
  let _fillAttempts = 0;

  function _renderFillBlank(q, container) {
    _fillAttempts = 0;

    // Build symbol legend from q.symbols or a sensible default
    const symbols = q.symbols || ['u_r', 'u_theta', 'u_z', 'R', 'r', 'z', '/', '*', '^2', '^3', '-'];
    const legendHtml = symbols.map(s =>
      `<span class="qz-sym-token" title="Cliquer pour insérer" data-sym="${s}">${s}</span>`
    ).join('');

    container.innerHTML = `
      <div class="qz-fill">
        <div class="qz-sym-legend">
          <span class="qz-sym-label">Symboles :</span>
          ${legendHtml}
        </div>
        <div class="qz-fill-input-row">
          <input class="qz-input" id="qz-blank" type="text"
                 placeholder="ex: -u_r/R^2" autocomplete="off" spellcheck="false">
          <span class="qz-fill-status" id="qz-fill-status"></span>
        </div>
        <div class="qz-fill-hint" id="qz-fill-hint"></div>
        <div class="qz-fill-format-warn" id="qz-fill-format-warn" style="display:none"></div>
      </div>`;

    _renderField(container.querySelector('#qz-fill-hint'), q.hint || 'Entrez la formule en utilisant les symboles ci-dessus');

    // Clickable symbol tokens → insert at cursor
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

    // Live format validation
    inp.addEventListener('input', () => {
      const v = inp.value.trim();
      _el('#qz-submit').disabled = v.length === 0;
      _el('#qz-fill-format-warn').style.display = 'none';

      if (v.length === 0) {
        status.textContent = '';
        status.className = 'qz-fill-status';
        inp.className = 'qz-input';
      } else if (_isRecognizedFormat(v)) {
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
      if (e.key === 'Enter' && inp.value.trim().length > 0) _el('#qz-submit').click();
    });
  }

  function _renderConceptual(q, container) {
    _renderMCQ(q, container);
  }

  // ── Answer checkers ───────────────────────────────────────

  function _checkMCQ(q, container) {
    const sel = container.querySelector('.qz-option.selected');
    if (!sel) return null;
    return sel.dataset.value;
  }

  function _checkTF(q, container) {
    const sel = container.querySelector('.qz-option.selected');
    if (!sel) return null;
    return sel.dataset.value;
  }

  function _checkFill(q, container) {
    const inp = container.querySelector('#qz-blank');
    return inp ? inp.value.trim() : null;
  }

  function _isCorrect(q, given) {
    if (given === null) return false;
    if (q.type === 'tf') return given === String(q.answer);
    if (q.type === 'fill') {
      const accepts = Array.isArray(q.answer) ? q.answer : [q.answer];
      const normGiven = _normFill(given);
      return accepts.some(a => _normFill(a) === normGiven);
    }
    return given === q.answer;
  }

  // ── Fill-in specific submit ───────────────────────────────
  // Returns: 'correct' | 'wrong' | 'unrecognized'
  function _submitFill(q) {
    const inp = _el('#qz-blank');
    if (!inp) return;
    const given = inp.value.trim();
    if (!given) return;

    // Phase 1: format check
    if (!_isRecognizedFormat(given)) {
      const warn = _el('#qz-fill-format-warn');
      warn.innerHTML = `⚠ Format non reconnu. Utilise les symboles du tableau ci-dessus (ex: <code>-u_r/R^2</code>).`;
      warn.style.display = 'block';
      return; // not counted as attempt
    }

    _fillAttempts++;
    const correct = _isCorrect(q, given);
    _answers[_current] = { given, correct };

    if (correct) {
      inp.className = 'qz-input answer-correct-input';
      _showFeedback(q, given, true);
    } else if (_fillAttempts >= 1) {
      // Show give-up option after 1 wrong attempt
      inp.className = 'qz-input answer-wrong-input';
      _showFillWrongFeedback(q, given, _fillAttempts);
    }
  }

  function _showFillWrongFeedback(q, given, attempts) {
    const fb = _el('#qz-feedback');
    fb.className = 'qz-feedback incorrect';

    const normGiven  = _normFill(given);
    const firstAccept = Array.isArray(q.answer) ? q.answer[0] : q.answer;

    fb.innerHTML = `
      <div class="qz-fb-header">
        <span class="qz-fb-icon">✗</span>
        <span class="qz-fb-title">Pas tout à fait… <span class="qz-attempt-count">(tentative ${attempts})</span></span>
      </div>
      <div class="qz-fill-retry-hint" id="qz-retry-hint"></div>
    `;
    _renderField(fb.querySelector('#qz-retry-hint'), q.retryHint || 'Vérifie ta notation et réessaie.');
    fb.style.display = 'block';

    // Button row: retry OR give up
    const actions = _el('#qz-actions-row');
    _el('#qz-submit').style.display = 'none';

    // Inject retry + give-up buttons into actions
    actions.innerHTML = `
      <button class="qz-btn qz-btn-secondary" id="qz-retry">↩ Réessayer</button>
      <button class="qz-btn qz-btn-giveup"   id="qz-giveup">Voir la réponse</button>
    `;
    document.getElementById('qz-retry').addEventListener('click', () => {
      fb.style.display = 'none';
      fb.innerHTML = '';
      const inp = _el('#qz-blank');
      inp.className = 'qz-input';
      inp.focus();
      inp.select();
      _el('#qz-fill-format-warn').style.display = 'none';
      actions.innerHTML = `
        <button id="qz-submit" class="qz-btn qz-btn-primary" onclick="QuizEngine.submit()">Valider</button>
        <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.next()">Suivant →</button>
      `;
    });
    document.getElementById('qz-giveup').addEventListener('click', () => {
      _answers[_current] = { given, correct: false }; // lock as wrong
      _showFeedback(q, given, false);
      actions.innerHTML = `
        <button id="qz-next" class="qz-btn qz-btn-primary" onclick="QuizEngine.next()">Suivant →</button>
      `;
    });
  }

  // ── Feedback rendering ────────────────────────────────────

  function _showFeedback(q, given, correct) {
    const fb = _el('#qz-feedback');
    fb.className = `qz-feedback ${correct ? 'correct' : 'incorrect'}`;

    // Highlight options for MCQ/TF
    const container = _el('#qz-input-area');
    if (q.type === 'mcq' || q.type === 'conceptual' || q.type === 'tf') {
      container.querySelectorAll('.qz-option').forEach(lbl => {
        lbl.style.pointerEvents = 'none';
        if (lbl.dataset.value === q.answer) lbl.classList.add('answer-correct');
        else if (lbl.classList.contains('selected') && !correct) lbl.classList.add('answer-wrong');
      });
    }

    fb.innerHTML = `
      <div class="qz-fb-header">
        <span class="qz-fb-icon">${correct ? '✓' : '✗'}</span>
        <span class="qz-fb-title">${correct ? 'Correct !' : 'Pas tout à fait…'}</span>
      </div>
      ${!correct && q.type === 'fill' ? `<div class="qz-fb-answer">Réponse : <strong>${_normFill(Array.isArray(q.answer) ? q.answer[0] : q.answer)}</strong> &nbsp;<span class="qz-fb-answer-raw">(${Array.isArray(q.answer) ? q.answer[0] : q.answer})</span></div>` : ''}
      <div class="qz-fb-explanation"></div>
    `;
    _renderField(fb.querySelector('.qz-fb-explanation'), q.explanation || '');
    fb.style.display = 'block';

    // Restore clean action buttons
    const actions = _el('#qz-actions-row');
    if (actions) {
      actions.innerHTML = `
        <button id="qz-submit" class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.submit()">Valider</button>
        <button id="qz-next"   class="qz-btn qz-btn-primary" onclick="QuizEngine.next()">Suivant →</button>
      `;
    }
  }

  // ── Progress bar ──────────────────────────────────────────

  function _updateProgress() {
    const pct = (_current / _questions.length) * 100;
    const bar = _el('#qz-progress-fill');
    if (bar) bar.style.width = pct + '%';
    const lbl = _el('#qz-progress-label');
    if (lbl) lbl.textContent = `${_current} / ${_questions.length}`;
  }

  // ── Results screen ────────────────────────────────────────

  function _showResults() {
    const score   = _answers.filter(a => a.correct).length;
    const total   = _questions.length;
    const pct     = Math.round((score / total) * 100);
    const elapsed = Math.round((Date.now() - _started) / 1000);
    const mins    = Math.floor(elapsed / 60);
    const secs    = elapsed % 60;

    Storage.recordAttempt(_quizId, score, total);
    const attempts = Storage.getAttempts(_quizId);
    const best = Math.max(...attempts.map(a => a.score));

    const emoji = pct === 100 ? '🏆' : pct >= 75 ? '🎯' : pct >= 50 ? '📚' : '💪';

    _el('#qz-question-area').style.display = 'none';
    const res = _el('#qz-results');
    res.style.display = 'block';

    // Build exercise block HTML if _exercise is defined
    const exBlock = _exercise ? `
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
            stroke-dasharray="${2*Math.PI*50}"
            stroke-dashoffset="${2*Math.PI*50 * (1 - pct/100)}"
            transform="rotate(-90 60 60)"
            style="transition: stroke-dashoffset 1s ease"/>
        </svg>
        <div class="qz-score-text">
          <span class="qz-score-pct">${pct}%</span>
          <span class="qz-score-frac">${score}/${total}</span>
        </div>
      </div>
      <div class="qz-result-emoji">${emoji}</div>
      <div class="qz-result-meta">
        Temps : ${mins > 0 ? mins+'m ' : ''}${secs}s
        &nbsp;·&nbsp; Meilleur : ${best}/${total}
        &nbsp;·&nbsp; ${attempts.length} tentative${attempts.length > 1 ? 's' : ''}
      </div>
      <div class="qz-review">
        <h3>Récapitulatif</h3>
        ${_questions.map((q, i) => `
          <div class="qz-review-item ${_answers[i]?.correct ? 'ok' : 'ko'}">
            <span class="qz-review-icon">${_answers[i]?.correct ? '✓' : '✗'}</span>
            <span class="qz-review-q qz-review-q-${i}"></span>
          </div>
        `).join('')}
      </div>
      ${exBlock}
      <div class="qz-result-actions">
        <button class="qz-btn qz-btn-secondary" onclick="QuizEngine.restart()">↺ Recommencer</button>
        <a class="qz-btn qz-btn-primary" href="quizzes.html">← Quizzes</a>
      </div>
    `;

    // Render each review question text (may contain math/md)
    _questions.forEach((q, i) => {
      const el = res.querySelector(`.qz-review-q-${i}`);
      if (el) _renderField(el, q.question);
    });

    // Render exercise body if present
    if (_exercise) {
      const exBody = res.querySelector('#qz-exercise-body');
      if (exBody) _renderField(exBody, _exercise);
    }
  }

  // ── Public API ────────────────────────────────────────────

  function loadQuiz(quizId, questions, exercise) {
    _quizId    = quizId;
    _questions = questions;
    _exercise  = exercise || null;
    _current   = 0;
    _answers   = [];
    _started   = Date.now();
    _renderQuestion();
    _updateProgress();
    _renderPastAttempts();
  }

  function _renderPastAttempts() {
    const attempts = Storage.getAttempts(_quizId);
    const el = _el('#qz-past-attempts');
    if (!el || attempts.length === 0) return;
    const last3 = attempts.slice(-3).reverse();
    el.innerHTML = `<span class="qz-attempts-label">Dernières tentatives :</span> ` +
      last3.map(a => {
        const pct = Math.round(a.score / a.total * 100);
        const cls = pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-orange' : 'badge-red';
        return `<span class="badge ${cls}">${a.score}/${a.total}</span>`;
      }).join(' ');
  }

  function _renderQuestion() {
    if (_current >= _questions.length) { _showResults(); return; }

    const q = _questions[_current];
    const area = _el('#qz-question-area');
    area.style.display = 'block';
    _el('#qz-results').style.display = 'none';

    // Question number + type badge
    const typeLabel = { mcq: 'QCM', tf: 'Vrai / Faux', fill: 'Compléter', conceptual: 'Réflexion' };
    _el('#qz-qnum').textContent  = `Question ${_current + 1} / ${_questions.length}`;
    _el('#qz-qtype').textContent = typeLabel[q.type] || q.type;
    _el('#qz-qtype').className   = `qz-type-badge qz-type-${q.type}`;

    // Question text
    _renderField(_el('#qz-qtext'), q.question);

    // Context block (optional)
    const ctx = _el('#qz-context');
    if (q.context) {
      _renderField(ctx, q.context);
      ctx.style.display = 'block';
    } else {
      ctx.style.display = 'none';
    }

    // Input area
    const inp = _el('#qz-input-area');
    inp.innerHTML = '';
    if      (q.type === 'mcq')        _renderMCQ(q, inp);
    else if (q.type === 'tf')         _renderTF(q, inp);
    else if (q.type === 'fill')       _renderFillBlank(q, inp);
    else if (q.type === 'conceptual') _renderConceptual(q, inp);
    _renderMath(inp);

    // Reset buttons & feedback
    const actions = _el('#qz-actions-row');
    if (actions) {
      actions.innerHTML = `
        <button id="qz-submit" class="qz-btn qz-btn-primary" onclick="QuizEngine.submit()">Valider</button>
        <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:none" onclick="QuizEngine.next()">Suivant →</button>
      `;
      _el('#qz-submit').disabled = q.type === 'fill';
    }
    const fb = _el('#qz-feedback');
    fb.style.display = 'none';
    fb.innerHTML = '';
  }

  function submit() {
    const q = _questions[_current];
    if (q.type === 'fill') { _submitFill(q); return; }
    const inp = _el('#qz-input-area');
    let given = null;
    if (q.type === 'mcq' || q.type === 'conceptual') given = _checkMCQ(q, inp);
    else if (q.type === 'tf') given = _checkTF(q, inp);
    if (given === null) return;
    const correct = _isCorrect(q, given);
    _answers[_current] = { given, correct };
    _showFeedback(q, given, correct);
  }

  function next() {
    _current++;
    _updateProgress();
    _renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restart() {
    _current = 0;
    _answers = [];
    _started = Date.now();
    _el('#qz-results').style.display    = 'none';
    _el('#qz-question-area').style.display = 'block';
    _updateProgress();
    _renderQuestion();
  }

  // ── Utilities ─────────────────────────────────────────────
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

  return { loadQuiz, submit, next, restart, Storage };
})();
