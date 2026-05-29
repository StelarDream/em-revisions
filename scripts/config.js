/* Central color configuration — single source of truth for chapters and TD quizzes */

export const CHAPTERS = {
  ch1: { css: '--accent', ic: 'ic-1' },
  ch2: { css: '--accent2', ic: 'ic-2' },
  ch3: { css: '--accent3', ic: 'ic-3' },
  ch4: { css: '--accent4', ic: 'ic-4' },
  ch5: { css: '--accent5', ic: 'ic-5' },
  ch6: { css: '--accent', ic: 'ic-6' },
};

export const QUIZZES = {
  td1: { css: '--accent', ic: 'ic-1', ch: 'ch1' },
  td2: { css: '--accent2', ic: 'ic-2', ch: 'ch2' },
  td3: { css: '--accent3', ic: 'ic-3', ch: 'ch3' },
  td4: { css: '--accent4', ic: 'ic-4', ch: 'ch4' },
  td5: { css: '--accent4b', ic: 'ic-4b', ch: 'ch4' },
  td6: { css: '--accent4c', ic: 'ic-4c', ch: 'ch4' },
  td7: { css: '--accent5', ic: 'ic-5', ch: 'ch5' },
};
