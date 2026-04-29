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
   * Each row = [ left word , right word ] — scrambled together per row.
   * Use '' for one column if that side should empty out (still two entries).
   */
  const phrasePairs = [
    ['Software', 'Engineer'],
    ['Full Stack', 'Developer'],
    ['Frontend', 'Designer'],
    ['Problem', 'Solver'],
    ['Freelance', 'Coder'],
    ['AI-Powered', 'Builder'],
    ['Software', 'Technician'],
  ];

  const fxL = new TextScramble(left);
  const fxR = new TextScramble(right);
  let i = 0;

  /** Readable time before switching to next pair — same delay after every phrase. */
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
