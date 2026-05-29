// ─── Token sets ────────────────────────────────────────────────────────────

let _allSets = {};

export function setTokenSets(sets) {
  _allSets = sets;
}

function _expandSet(name, visited = new Set()) {
  if (visited.has(name)) return [];
  visited.add(name);
  const s = _allSets[name];
  if (!s) return [];
  const inherited = (s.inherits || []).flatMap(n => _expandSet(n, visited));
  return [...inherited, ...(s.values || [])];
}

// Returns null (no restriction) when recognised is absent.
export function _resolveRecognised(recognised) {
  if (!recognised) return null;
  const fromSets = (recognised.sets || []).flatMap(n => _expandSet(n, new Set()));
  return [...new Set([...fromSets, ...(recognised.values || [])])];
}

export function _isRecognizedFormat(s, tokens) {
  if (!s || s.trim().length === 0) return false;
  if (tokens === null) return true;
  const stripped = s.replace(/[\s\+\-\*\/\^\(\)²³ⁿ0-9\.]/g, ' ').trim();
  if (stripped.length === 0) return true;
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.every(w => {
    const wl = w.toLowerCase().replace(/_/g, '');
    return tokens.some(t => {
      const tl = t.toLowerCase().replace(/_/g, '');
      return tl.includes(wl) || wl.includes(tl);
    });
  });
}

// ─── Normalization ──────────────────────────────────────────────────────────

let _normFn = _defaultNorm;

export function setNormSpec(spec) {
  _normFn = _compileNormSpec(spec);
}

// Merge any number of specs: same key → concat their regex and literals lists.
export function _mergeNormSpecs(...specs) {
  const merged = {};
  for (const spec of specs) {
    for (const [key, rule] of Object.entries(spec)) {
      if (key === 'notes') continue; // skip documentation-only key
      if (!merged[key]) merged[key] = { regex: [], literals: [] };
      merged[key].regex = [...(merged[key].regex || []), ...(rule.regex || [])];
      merged[key].literals = [...(merged[key].literals || []), ...(rule.literals || [])];
    }
  }
  return merged;
}

function _escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _compileNormSpec(spec) {
  // Regex rules: applied in document order, output key is the replacement string (supports $1 etc.)
  const regexRules = [];
  // Literal rules: collected then sorted longest-first for single-pass replacement
  const literalRules = [];

  for (const [output, rule] of Object.entries(spec)) {
    if (output === 'notes') continue;
    for (const pattern of rule.regex || []) {
      regexRules.push({ output, re: new RegExp(pattern, 'g') });
    }
    for (const literal of rule.literals || []) {
      literalRules.push({ output, literal });
    }
  }

  literalRules.sort((a, b) => b.literal.length - a.literal.length);

  let litRe = null;
  const litMap = new Map();
  if (literalRules.length > 0) {
    for (const { output, literal } of literalRules) {
      litMap.set(literal.toLowerCase(), output);
    }
    litRe = new RegExp(literalRules.map(r => _escapeForRegex(r.literal)).join('|'), 'gi');
  }

  return function norm(s) {
    s = s.toLowerCase();
    for (const { output, re } of regexRules) {
      re.lastIndex = 0;
      s = s.replace(re, output);
    }
    if (litRe) {
      litRe.lastIndex = 0;
      s = s.replace(litRe, m => litMap.get(m.toLowerCase()) ?? m);
    }
    return s;
  };
}

function _defaultNorm(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\*\*/g, '*')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^n/g, 'ⁿ')
    .replace(/vec\{([^}]+)\}/g, '$1')
    .replace(/\\hat\{([^}]+)\}/g, '$1')
    .replace(/hat_/g, '')
    .replace(/_/g, '')
    .replace(/\\varepsilon/g, 'eps')
    .replace(/\\epsilon/g, 'eps')
    .replace(/\\mu/g, 'mu')
    .replace(/\\pi/g, 'pi')
    .replace(/\\vec/g, '')
    .replace(/\\hat/g, '')
    .replace(/[{}\\]/g, '');
}

export function _normFill(s) {
  return _normFn(s);
}
