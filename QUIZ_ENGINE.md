# QuizEngine — JS API Reference

A self-contained quiz engine for HTML pages. Supports MCQ (single / multi-answer), True/False, fill-in-the-blank, and numeric questions, with persistent scoring via `localStorage`.

---

## 1. Page setup

Every quiz page needs this DOM skeleton (copy from any existing quiz file):

```html
<div id="qz-past-attempts"></div>

<div class="qz-progress">
  <div class="qz-progress-track"><div id="qz-progress-fill"></div></div>
  <span id="qz-progress-label"></span>
</div>

<div id="qz-question-area">
  <div class="qz-card">
    <div class="qz-card-header">
      <span id="qz-qnum"></span>
      <span id="qz-qtype" class="qz-type-badge"></span>
    </div>
    <div id="qz-context"></div>
    <div id="qz-qtext"></div>
    <div id="qz-input-area"></div>
    <div id="qz-feedback" class="qz-feedback"></div>
    <div class="qz-actions" id="qz-actions-row">
      <button id="qz-submit" class="qz-btn qz-btn-primary" onclick="QuizEngine.submit()">Valider</button>
      <button id="qz-next"   class="qz-btn qz-btn-primary" style="display:none"        onclick="QuizEngine.next()">Suivant →</button>
    </div>
  </div>
</div>

<div id="qz-results"></div>
```

Load the engine as an ES module:

```html
<script type="module">
  import { QuizEngine } from '/em-revisions/scripts/quiz.js';
  const questions = [ /* ... */ ];
  QuizEngine.loadQuiz('my_quiz_id', questions, 'Exercise title');
</script>
```

---

## 2. `QuizEngine.loadQuiz(id, questions, title, options?)`

Initialises and starts the quiz.

| Parameter   | Type     | Description |
|-------------|----------|-------------|
| `id`        | `string` | Unique key used for `localStorage` persistence. No spaces. |
| `questions` | `array`  | Array of question objects (see §3). |
| `title`     | `string` | Exercise label shown in past-attempts header. |
| `options`   | `object` | Optional config (see §2.1). |

### 2.1 Options

```js
QuizEngine.loadQuiz('td1_ex1', questions, 'TD1 · Ex 1', {
  setsFile: 'config/token_sets.json',  // JSON file of named token sets for fill validation
  normFile: 'config/norm_rules.json',  // JSON file of normalisation rules for fill answers
  sets:     { mySet: ['word1', 'word2'] },  // inline token sets, merged with setsFile
  norm:     { aliases: { 'µ': 'mu' } },     // inline norm rules, merged with normFile
});
```

Both `setsFile`/`sets` and `normFile`/`norm` are optional. Omit entirely for numeric-only or TF-only quizzes.

---

## 3. Question objects

### Common fields (all types)

```js
{
  type:        string,   // required — 'mcq' | 'tf' | 'fill' | 'numeric'
  question:    string,   // required — question text (see §3.1 for text format)
  answer:      any,      // required — see per-type docs
  explanation: string,   // optional — shown in feedback after answering
  hint:        string,   // optional — hidden behind 💡 button; costs hintPenalty pts
  context:     string,   // optional — greyed context block shown above the question
}
```

### 3.1 Text format

All `string` fields (`question`, `explanation`, `hint`, `context`) accept two formats:

- **Plain text** — `"Le champ est nul."` — rendered as-is.
- **Markdown + KaTeX** — prefix with `"md:"` — `"md:Calculez $\\vec{\\nabla} \\cdot \\vec{R}$."` — renders Markdown and inline/block LaTeX.

---

### 3.2 `mcq` — Multiple choice

```js
{
  type:    'mcq',
  question: 'md:Que vaut $\\nabla \\cdot \\vec{R}$ en 3D ?',
  options: ['1', '2', '3', 'md:$R^2$'],
  answer:  3,          // 1-indexed position in options  (or exact option string)
  explanation: 'md:La divergence de $\\vec{R}$ vaut toujours 3 en 3D.'
}
```

**`answer` accepts:**

| Value | Meaning |
|-------|---------|
| `1` | 1-indexed position in `options` |
| `"3"` | Exact option string |
| `[1, 3]` | Multiple correct answers (positions) |
| `["1", "md:$R^2$"]` | Multiple correct answers (strings) |

**Additional fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `shuffleAnswers` | `true` | Randomise option order each render. |
| `reveal_right_amount` | `true` | Show "Sélectionne N réponses" hint and enforce count before enabling Valider. Set `false` to hide how many answers are needed. |

**Retry mechanic:** wrong picks are locked red (penalised), correct picks are locked green (free). The student keeps submitting until all correct answers are found.

**Scoring:** `max(0, (N_wrong_options − wrong_picks) / N_wrong_options) − hintPenalty?`

---

### 3.3 `tf` — True / False

```js
{
  type:     'tf',
  question: 'md:$\\vec{\\nabla} \\times (\\vec{\\nabla} f) = \\vec{0}$.',
  answer:   'true',    // 'true' or 'false'  (strings, not booleans)
  explanation: 'md:Le rotationnel d\'un gradient est toujours nul.'
}
```

Final immediately — no retry. **Scoring:** `1 − hintPenalty?` if correct, `0` if wrong.

---

### 3.4 `fill` — Fill in the blank

```js
{
  type:       'fill',
  question:   'md:$\\vec{\\nabla} \\cdot \\vec{R} = $ ___',
  answer:     '3',
  symbols:    ['-', 'u_r', '/', 'R', '^'],  // optional clickable buttons
  recognised: 'spherical',                   // optional token set name for format check
  hint:       'md:Pense à la définition de la divergence.'
}
```

**`answer` accepts an array** for multiple valid forms:

```js
answer: ['u_theta', 'u_φ', 'u_phi'],
```

**`recognised`** names a token set from `token_sets.json`. Input is checked against that set before submission; unrecognised formats show a warning but don't block. Set to `null` to disable format checking entirely.

**Retry + give-up** ("Voir la réponse") available. Duplicate submissions don't incur a penalty.

**Scoring:** `max(0, (1 − decayRate)^wrongAttempts − hintPenalty?)`

---

### 3.5 `numeric` — Numeric answer

```js
{
  type:      'numeric',
  question:  'md:Calculez $\\vec{\\nabla} \\cdot \\vec{A}$ pour $\\vec{A} = x^2 \\hat{u}_x$.',
  answer:    2,          // expected number
  tolerance: 0.01,       // optional — absolute tolerance (default: 0 for integers, 1e-9 otherwise)
  hint:      'md:$\\nabla \\cdot \\vec{A} = \\partial_x A_x + \\partial_y A_y + \\partial_z A_z$'
}
```

Students may enter expressions: `1/3`, `2*pi`, `sqrt(2)`, `sin(pi/6)`, `3e-4`. The engine evaluates them safely before comparing.

Same retry/give-up and scoring as `fill`. Duplicate detection uses the tolerance: re-submitting a value within `tolerance` of a previous attempt doesn't count as a new wrong answer.

---

## 4. Scoring config

Scoring parameters are stored in `localStorage` and persist across sessions for that browser.

```js
// Browser console
QuizEngine.setScoringConfig({
  decayRate:   0.5,    // fill / numeric: multiplies points by (1 − decayRate) per wrong attempt
  hintPenalty: 0.25,   // deducted from any question's final score if hint was used
});
```

**Default:** `decayRate: 0.5`, `hintPenalty: 0.25`

### Points by type

| Type | Formula |
|------|---------|
| `tf` | `correct ? max(0, 1 − hintPenalty?) : 0` |
| `mcq` | `max(0, (N_wrong − wrong_picks) / N_wrong − hintPenalty?)` |
| `fill` | `max(0, (1 − decayRate)^wrongAttempts − hintPenalty?)` |
| `numeric` | same as `fill` |

### Points badge tiers

| Score | Badge |
|-------|-------|
| ≥ 0.9 | Gold ★ |
| 0.1 – 0.9 | Green |
| ≤ 0.1 | Red |

---

## 5. Other `QuizEngine` methods

These are normally called by `onclick` attributes in the HTML, but can also be called programmatically.

| Method | Description |
|--------|-------------|
| `QuizEngine.submit()` | Submit current answer. |
| `QuizEngine.next()` | Advance to next question (or results screen). |
| `QuizEngine.retry()` | Clear wrong feedback and re-enable input for current question. |
| `QuizEngine.giveUp()` | Reveal answer for fill/numeric, score 0 for this question. |
| `QuizEngine.showHint()` | Reveal hint, mark `hintUsed = true` for this question. |
| `QuizEngine.restart()` | Reset all answers and restart from Q1. |
| `QuizEngine.setScoringConfig(cfg)` | Merge `cfg` into scoring config and persist to `localStorage`. |

---

## 6. `QuizEngine.Storage` — Persistent attempts

```js
const Storage = QuizEngine.Storage;

Storage.getAttempts('td1_ex1');
// → [ { score, total, totalPoints, date }, ... ]  (chronological)

Storage.recordAttempt('td1_ex1', score, total, totalPoints);
// Called automatically at end of each quiz run.

Storage.clearAttempts('td1_ex1');
// Wipe history for one quiz.

Storage.clearAll();
// Wipe history for every quiz.
```

The quiz index page reads `getAttempts` to render score badges.

---

## 7. Minimal working example

```html
<script type="module">
import { QuizEngine } from '/em-revisions/scripts/quiz.js';

const questions = [
  {
    type: 'tf',
    question: 'md:$1 + 1 = 2$',
    answer: 'true',
    explanation: 'Correct par définition.'
  },
  {
    type: 'mcq',
    question: 'Quelle est la couleur du ciel ?',
    options: ['Rouge', 'Bleu', 'Vert'],
    answer: 2,
    explanation: 'Diffusion de Rayleigh.'
  },
  {
    type: 'numeric',
    question: 'md:$\\int_0^1 x\\,dx = $',
    answer: 0.5,
    hint: 'md:Formule : $\\dfrac{x^2}{2}\\Big|_0^1$'
  },
  {
    type: 'fill',
    question: 'md:$\\vec{\\nabla} \\cdot \\vec{R} = $ ___',
    answer: '3',
    symbols: ['1', '2', '3'],
    hint: 'md:En 3 dimensions cartésiennes, $\\partial_x x + \\partial_y y + \\partial_z z$.'
  },
];

QuizEngine.loadQuiz('demo_quiz', questions, 'Démo');
</script>
```
