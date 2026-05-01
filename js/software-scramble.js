/**
 * Text scramble for .hero-headline — two columns with offset margins (.software-word / .engineer-word)
 *
 * Timing: bigger startWindow / scrambleSpan = longer scramble (more rAF ticks per glyph band).
 */
const SCRAMBLE_START_WINDOW_DEFAULT = 42;

const SCRAMBLE_SPAN_DEFAULT = 70;

const HEADLINE_SCRAMBLE_FRAME_SUM =
  SCRAMBLE_START_WINDOW_DEFAULT + SCRAMBLE_SPAN_DEFAULT;

/** Bottom label target duration (rough ceiling scales like startWindow + scrambleSpan @ ~60fps) */
const LABEL_SCRAMBLE_SECONDS = 3;

const LABEL_SCRAMBLE_REFERENCE_FPS = 60;

const labelScrambleFrameBudget =
  LABEL_SCRAMBLE_SECONDS * LABEL_SCRAMBLE_REFERENCE_FPS;

const labelScrambleScale =
  labelScrambleFrameBudget / HEADLINE_SCRAMBLE_FRAME_SUM;

class TextScramble {
  constructor(el, opts = {}) {
    this.el = el;
    this.chars = '!<>-_\\/[]{}—=+*^?#________';
    this.update = this.update.bind(this);
    this.startWindow =
      opts.startWindow ?? SCRAMBLE_START_WINDOW_DEFAULT;
    this.scrambleSpan = opts.scrambleSpan ?? SCRAMBLE_SPAN_DEFAULT;
    this.scatterProb = opts.scatterProb ?? 0.28;
  }

  setText(newText) {
    const oldText = this.el.innerText;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    const { startWindow, scrambleSpan } = this;
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
        if (!char || Math.random() < this.scatterProb) {
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
  const heroTitle = document.querySelector('.hero-title');
  const left = document.querySelector('.hero-headline .software-word');
  const right = document.querySelector('.hero-headline .engineer-word');
  const headline = document.querySelector('.hero-headline');
  const labelBottom = document.querySelector('.hero-scramble-label--bottom');

  if (!left || !right) return;

  /**
   * Each row = [ left word , right word ] — scramble cycles through these pairs.
   * Hero typography lives in css/style.css (single font family).
   */
  const SOFTWARE_ENGINEER = ['Software', 'Engineer'];
  const otherPhrasePairs = [
    ['Problem', 'Solver'],
    ['AI-Powered', 'Builder'],
    ['Code', 'Alchemist'],
    ['Bug', 'Whisperer'],
    ['Pixel', 'Architect'],
    ['Logic', 'Wizard'],
    ['Keyboard', 'Sorcerer'],
    ['Stack', 'Summoner'],
    ['API', 'Artisan'],
    ['Script', 'Sculptor'],
    ['Data', 'Druid'],
    ['Cloud', 'Crafter'],
    ['DevOps', 'Nomad'],
    ['Build', 'Smith'],
    ['Release', 'Ranger'],
    ['Refactor', 'Ninja'],
    ['Framework', 'Tamer'],
    ['Compiler', 'Conjurer'],
    ['Automation', 'Adept'],
    ['Terminal', 'Tactician'],
    ['System', 'Shaper'],
    ['Runtime', 'Riddler'],
    ['Solution', 'Forge'],
    ['Feature', 'Shipwright'],
    ['UI', 'Illusionist'],
    ['Backend', 'Blacksmith'],
    ['Frontend', 'Fox'],
    ['Code', 'Cartographer'],
    ['Digital', 'Mechanic'],
    ['Binary', 'Bard'],
    ['Patch', 'Paladin'],
    ['Chaos', 'Engineer'],
  ];

  const allPhrasePairs = [SOFTWARE_ENGINEER, ...otherPhrasePairs];

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

  const baselineIdx = indexOfLongestPair(allPhrasePairs);
  applyHeroSizingFromBaseline(allPhrasePairs[baselineIdx]);

  const fxL = new TextScramble(left);
  const fxR = new TextScramble(right);

  /** Bottom “Software Engineer” line — ~LABEL_SCRAMBLE_SECONDS of headline timing feel */
  const ENGINEER_LABEL_TEXT = 'Software Engineer';
  const fxLabel = labelBottom
    ? new TextScramble(labelBottom, {
        startWindow: Math.round(
          SCRAMBLE_START_WINDOW_DEFAULT * labelScrambleScale,
        ),
        scrambleSpan: Math.round(SCRAMBLE_SPAN_DEFAULT * labelScrambleScale),
      })
    : null;

  /** Readable delay after each phrase settles before switching to the next pair. */
  const PAUSE_BETWEEN_MS = 1850;
  const SOFTWARE_ENGINEER_PAUSE_MS = 2000;

  function shuffledCopy(arr) {
    const copy = arr.slice();
    for (let j = copy.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [copy[j], copy[k]] = [copy[k], copy[j]];
    }
    return copy;
  }

  // Shuffle-bag so phrases don't repeat until all have been seen.
  let bag = shuffledCopy(otherPhrasePairs);
  let showSoftwareEngineerFirst = true;
  let scrambleFrameLabelsRevealed = false;

  function nextPair() {
    if (showSoftwareEngineerFirst) {
      showSoftwareEngineerFirst = false;
      return SOFTWARE_ENGINEER;
    }
    if (bag.length === 0) bag = shuffledCopy(otherPhrasePairs);
    return bag.pop();
  }

  const next = () => {
    const [w1, w2] = nextPair();
    const isSoftwareEngineer =
      w1 === SOFTWARE_ENGINEER[0] && w2 === SOFTWARE_ENGINEER[1];
    if (!isSoftwareEngineer && !scrambleFrameLabelsRevealed && labelBottom) {
      scrambleFrameLabelsRevealed = true;
      labelBottom.removeAttribute('hidden');
      heroTitle?.classList.add('hero-title--has-scramble-labels');

      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reduceMotion || !fxLabel) {
        labelBottom.textContent = ENGINEER_LABEL_TEXT;
      } else {
        labelBottom.textContent = '';
        void fxLabel.setText(ENGINEER_LABEL_TEXT);
      }
    }
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
      if (allPhrasePairs.length <= 1) return;

      setTimeout(
        next,
        isSoftwareEngineer ? SOFTWARE_ENGINEER_PAUSE_MS : PAUSE_BETWEEN_MS,
      );
    });
  };

  next();
})();
