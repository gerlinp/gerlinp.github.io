/**
 * Text scramble for .hero-headline — two columns with offset margins (.software-word / .engineer-word)
 */
class TextScramble {
  constructor(el) {
    this.el = el;
    this.chars = '!<>-_\\/[]{}—=+*^?#________';
    this.update = this.update.bind(this);
  }

  setText(newText) {
    const oldText = this.el.innerText;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    // Wider random windows = longer scramble per glyph (same rAF ticker, bigger frame span)
    const startWindow = 42;
    const scrambleSpan = 70;
    this.queue = [];
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random() * startWindow);
      const end = start + Math.floor(Math.random() * scrambleSpan);
      this.queue.push({ from, to, start, end });
    }
    cancelAnimationFrame(this.frameRequest);
    this.frame = 0;
    this.update();
    return promise;
  }

  update() {
    let output = '';
    let complete = 0;
    for (let i = 0, n = this.queue.length; i < n; i++) {
      let { from, to, start, end, char } = this.queue[i];
      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.randomChar();
          this.queue[i].char = char;
        }
        output += `<span>${char}</span>`;
      } else {
        output += from;
      }
    }
    this.el.innerHTML = output;
    if (complete === this.queue.length) {
      this.resolve();
    } else {
      this.frameRequest = requestAnimationFrame(this.update);
      this.frame++;
    }
  }

  randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}

(function initHeroScramble() {
  const left = document.querySelector('.hero-headline .software-word');
  const right = document.querySelector('.hero-headline .engineer-word');
  const headline = document.querySelector('.hero-headline');

  if (!left || !right) return;

  /**
   * Each row = [ left word , right word ] — scramble cycles through these pairs.
   * Hero typography lives in css/style.css (single font family).
   */
  const phrasePairs = [
    ['Software', 'Engineer'],
    ['Full Stack', 'Developer'],
    ['Frontend', 'Designer'],
    ['Problem', 'Solver'],
    ['Freelance', 'Coder'],
    ['AI-Powered', 'Builder'],
    ['IT', 'Technician'],
  ];

  /** Longest pair (by total chars, tie → longer line) — used only for hero fluid sizing, not rotation order. */
  function indexOfLongestPair(pairs) {
    let bestIdx = 0;
    let bestTotal = -1;
    let bestMaxLine = -1;
    pairs.forEach(([a, b], idx) => {
      const total = a.length + b.length;
      const maxLine = Math.max(a.length, b.length);
      if (
        total > bestTotal ||
        (total === bestTotal && maxLine > bestMaxLine)
      ) {
        bestTotal = total;
        bestMaxLine = maxLine;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  /** Hero font = calc(vw * coeff + rem); coeff from baseline (longest) line — no clamp min/max */
  function applyHeroSizingFromBaseline([lw, lr]) {
    const m = Math.max(lw.length, lr.length);
    const n = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const vwCoeff = n(10.5 - m * 0.42, 3.95, 6.65);
    const addRem = n(1.48 - m * 0.055, 0.54, 1.02);

    const root = document.documentElement;
    root.style.setProperty('--hero-fs-vw', vwCoeff.toFixed(3));
    root.style.setProperty('--hero-fs-add', `${addRem.toFixed(3)}rem`);
  }

  const baselineIdx = indexOfLongestPair(phrasePairs);
  applyHeroSizingFromBaseline(phrasePairs[baselineIdx]);

  const fxL = new TextScramble(left);
  const fxR = new TextScramble(right);
  let i = 0;

  /** Readable delay after each phrase settles before switching to the next pair. */
  const PAUSE_BETWEEN_MS = 1850;

  const next = () => {
    const [w1, w2] = phrasePairs[i];
    if (headline) {
      headline.setAttribute(
        'aria-label',
        [w1, w2].filter(Boolean).join(' ').trim(),
      );
      const isAiPowered =
        /ai[-\s]?powered/i.test(w1) ||
        /\bai[-\s]?powered\b/i.test([w1, w2].join(' '));
      headline.classList.toggle('hero-headline--ai', isAiPowered);
    }

    Promise.all([fxL.setText(w1), fxR.setText(w2)]).then(() => {
      if (phrasePairs.length <= 1) return;

      i = (i + 1) % phrasePairs.length;
      setTimeout(next, PAUSE_BETWEEN_MS);
    });
  };

  next();
})();
