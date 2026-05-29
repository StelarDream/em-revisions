import { _el } from './markdown.js';

export function _renderTF(q, container) {
  container.innerHTML = `
    <div class="qz-options qz-tf" role="radiogroup">
      <label class="qz-option" data-value="true"  tabindex="0">
        <span class="qz-opt-key">V</span>
        <span class="qz-opt-text">Vrai</span>
      </label>
      <label class="qz-option" data-value="false" tabindex="0">
        <span class="qz-opt-key">F</span>
        <span class="qz-opt-text">Faux</span>
      </label>
    </div>`;

  const options = [...container.querySelectorAll('.qz-option')];

  options.forEach((lbl, idx) => {
    lbl.addEventListener('click', () => {
      options.forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
      const btn = _el('#qz-submit');
      if (btn) btn.disabled = false;
    });

    lbl.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        lbl.click();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        options[1 - idx].focus(); // toggle between the two
      }
    });
  });

  // Auto-focus first option
  setTimeout(() => options[0].focus(), 0);
}

export function _checkTF(q, container) {
  const sel = container.querySelector('.qz-option.selected');
  return sel ? sel.dataset.value : null;
}
