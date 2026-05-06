export const Storage = {
  key: id => `em_quiz_${id}`,

  save(id, data) {
    try { localStorage.setItem(this.key(id), JSON.stringify(data)); } catch(e) {}
  },

  load(id) {
    try { return JSON.parse(localStorage.getItem(this.key(id))); } catch(e) { return null; }
  },

  recordAttempt(id, score, total, totalPoints) {
    const key = `em_attempts_${id}`;
    let attempts = [];
    try { attempts = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
    attempts.push({ date: new Date().toISOString(), score, total, totalPoints: totalPoints ?? score });
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
  },

  // Clear data for a specific quiz id, or all em_ keys if no id given.
  // Usage from console: QuizEngine.Storage.clearData() or clearData("td1_ex1")
  clearData(id) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    const prefix = id ? [`em_quiz_${id}`, `em_attempts_${id}`] : null;
    let removed = 0;
    for (const k of keys) {
      if (!k) continue;
      const match = prefix ? prefix.includes(k) : k.startsWith('em_');
      if (match) { localStorage.removeItem(k); removed++; }
    }
    console.log(`[QuizEngine] clearData: removed ${removed} key(s)${id ? ` for "${id}"` : ' (all quizzes)'}.`);
  }
};
