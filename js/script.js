/* gsap & SplitText: loaded via CDN in index.html */

(() => {
  try {
    if (!/[\?&]inspectBubbles=1(?:&|$)/.test(window.location.search)) return;
    document.documentElement.classList.add('inspect-bubbles-active');
  } catch {
    /* ignore */
  }
})();

(() => {
  try {
    if (!/[\?&]bubbleNums=1(?:&|$)/.test(window.location.search)) return;
    document.documentElement.classList.add('bubble-nums-debug-active');
    let n = 1;
    document.querySelectorAll('.bg-bubbles > li').forEach((li) => {
      if (!(li instanceof HTMLLIElement)) return;
      li.setAttribute('data-bubble-debug-num', `${n}`);
      const lab = document.createElement('span');
      lab.className = 'bubble-debug-num';
      lab.setAttribute('aria-hidden', 'true');
      lab.textContent = `${n}`;
      n += 1;
      li.appendChild(lab);
    });
  } catch {
    /* ignore */
  }
})();

gsap.registerPlugin(SplitText);

const navToggle = document.querySelector('.nav-toggle');
const navToggleMenu = document.querySelector('.nav-toggle-menu');
const navToggleClose = document.querySelector('.nav-toggle-close');
const menu = document.querySelector('.menu');
const menuBg = document.querySelector('#menu-path');
const menuBgSvg = document.querySelector('.menu-bg-svg');
const menuLogo = document.querySelector('.menu-logo');
const menuLinks = document.querySelectorAll('.menu-col-links a');
const menuInfoItems = document.querySelectorAll(
  '.menu-col-info p, .menu-col-info h3, .menu-col-info h6'
);

let isOpen = false;
let isAnimating = false;
let openTimeline = null;
let closeTimeline = null;

/** Some engines report viewBox.baseVal as 0 before layout — fall back to the attribute string. */
function intrinsicMenuSvgSize(svgEl) {
  const b = svgEl?.viewBox?.baseVal;
  let w = b?.width ?? 0;
  let h = b?.height ?? 0;
  const raw = svgEl?.getAttribute?.('viewBox');
  if ((!w || !h) && raw) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 4) {
      w = Number.parseFloat(parts[2]) || w;
      h = Number.parseFloat(parts[3]) || h;
    }
  }
  return { w, h };
}

const { w: svgWidth, h: svgHeight } = intrinsicMenuSvgSize(menuBgSvg);
const svgCenterX = svgWidth ? svgWidth / 2 : 0;
const menuBackdropReady = Boolean(
  navToggle &&
    menu &&
    menuBg &&
    menuBgSvg &&
    svgWidth > 0 &&
    svgHeight > 0,
);

const OPEN_HIDDEN = menuBackdropReady
  ? `M${svgWidth},0 Q${svgCenterX},0 0,0 L0,0 L${svgWidth},0 Z`
  : '';
const OPEN_FULL = menuBackdropReady
  ? `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,0 L${svgWidth},0 Z`
  : '';
const CLOSE_HIDDEN = menuBackdropReady
  ? `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,${svgHeight} L${svgWidth},${svgHeight} Z`
  : '';

if (menuBackdropReady) gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

/** Laptop+ hides `.menu-bg-svg` (off-canvas rail + dimmed backdrop) — curtain path tweens skipped. */
function matchesOffcanvasDrawerLayout() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function menuMotionReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Same pathname (handles / vs /index.html on static hosts). */
function pathsMatchForSpaJump(a, b) {
  const norm = (p) =>
    `${p}`
      .replace(/\/index\.html$/i, '')
      .replace(/\/$/, '') || '/';
  return norm(`${a}`) === norm(`${b}`);
}

/**
 * In-page `#id` or full URL whose path matches this document and carries a hash.
 * mailto:, tel:, and external origins return null — those must use default navigation.
 */
function fragmentIdFromHref(href) {
  if (!href || href === '#') return null;
  if (
    /^[a-z][a-z\d+.-]*:/i.test(href) &&
    !href.startsWith('http:') &&
    !href.startsWith('https:') &&
    !href.startsWith('file:')
  ) {
    return null;
  }
  if (href.startsWith('#')) {
    const id = href.slice(1);
    return id ? id : null;
  }
  try {
    const u = new URL(href, window.location.href);
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return null;
    if (u.origin !== window.location.origin) return null;
    if (!pathsMatchForSpaJump(u.pathname, window.location.pathname)) return null;
    if (!u.hash || u.hash === '#') return null;
    return u.hash.slice(1);
  } catch {
    return null;
  }
}

function resolveFragmentTarget(href) {
  const id = fragmentIdFromHref(href);
  if (!id) return null;
  try {
    return document.getElementById(decodeURIComponent(id));
  } catch {
    return document.getElementById(id);
  }
}

function fragmentHashForHistory(href) {
  const id = fragmentIdFromHref(href);
  return id ? `#${id}` : null;
}

/** Smooth scroll respects reduced-motion; keeps URL hash in sync for in-page anchors */
function scrollToAnchorElement(el, hrefForHistory) {
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    if (
      hrefForHistory &&
      hrefForHistory.startsWith('#') &&
      hrefForHistory !== '#'
    ) {
      try {
        history.replaceState(null, '', hrefForHistory);
      } catch {
        /* file:// etc. */
      }
    }
  });
}

/** Close overlay first; optionally run after close completes (smooth scroll targets) */
function beginMenuCloseForNav(afterClose) {
  if (!menu?.classList?.contains('is-open')) {
    afterClose?.();
    return;
  }

  /* Already closing — avoid stacking timelines */
  if (closeTimeline?.isActive()) return;

  isOpen = false;

  openTimeline?.kill();
  openTimeline = null;

  killNavToggleTweens();

  closeTimeline?.kill();
  closeTimeline = null;

  isAnimating = true;

  closeMenu(afterClose);
}

/**
 * Attached only to fullscreen menu anchors + logo links (#hero, etc.).
 * Body copy (mailto, outbound https, prose #links) keeps native behavior — not wired here.
 */
function handleNavLinkClick(e) {
  const href = e.currentTarget.getAttribute('href') || '';
  const menuOpen = Boolean(menu?.classList?.contains('is-open'));
  const fragmentTarget = resolveFragmentTarget(href);
  const hashOnly = fragmentHashForHistory(href);

  if (menuOpen && fragmentTarget && hashOnly) {
    e.preventDefault();
    beginMenuCloseForNav(() =>
      scrollToAnchorElement(fragmentTarget, hashOnly),
    );
    return;
  }

  if (menuOpen) {
    /* mailto:, external URLs, bare #, unknown hash — close overlay, don’t swallow navigation */
    beginMenuCloseForNav();
  }
}

const splits = [];
menuLinks.forEach((link) => {
  const split = new SplitText(link, { type: 'chars' });
  splits.push(split);
  gsap.set(split.chars, { opacity: 0, x: '750%' });

  link.addEventListener('click', handleNavLinkClick);
});

const navLogoWrap = document.querySelector('.nav-logo');
const navLogoLink = document.querySelector('.nav-logo a');
const menuLogoLink = document.querySelector('.menu-logo a');
const menuCloseBtn = document.querySelector('.menu-close');
[navLogoLink, menuLogoLink].forEach((el) => {
  if (el) el.addEventListener('click', handleNavLinkClick);
});

function killNavToggleTweens() {
  gsap.killTweensOf([navToggleMenu, navToggleClose]);
}

function setNavToggleOpenState(open) {
  if (!navToggle) return;
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

gsap.set(menuInfoItems, { opacity: 0, y: 100 });

if (menuBackdropReady) {
  navToggle.addEventListener('click', () => {
    if (isAnimating) return;
    isAnimating = true;
    isOpen = !isOpen;
    isOpen ? openMenu() : closeMenu();
  });

  menuCloseBtn?.addEventListener('click', () => {
    beginMenuCloseForNav();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !menu?.classList?.contains('is-open')) return;
    if (closeTimeline?.isActive()) return;
    ev.preventDefault();
    beginMenuCloseForNav();
  });
}

const openMenu = () => {
  openTimeline?.kill();

  setNavToggleOpenState(true);

  menu.classList.add('is-open');
  document.body.classList.add('menu-open');
  navLogoWrap?.setAttribute('aria-hidden', 'true');
  gsap.set(menuLinks, { opacity: 1 });

  killNavToggleTweens();
  gsap.to(navToggleMenu, { duration: 0.18, opacity: 0, ease: 'none' });
  gsap.to(navToggleClose, {
    duration: 0.18,
    opacity: 1,
    ease: 'none',
    delay: 0.15,
  });

  const splitChars = splits.flatMap((s) => s.chars);
  const revealTargets = [
    menuBg,
    menuLogo,
    ...menuInfoItems,
    ...splitChars,
  ].filter(Boolean);

  /*
   * Drawer layout: `#menu-path` SVG is hidden — skip curtain tween, but reuse the same logo /
   * contact strip / link SplitText choreography as fullscreen.
   */
  if (matchesOffcanvasDrawerLayout()) {
    gsap.killTweensOf(revealTargets);
    gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });

    if (menuMotionReduced()) {
      openTimeline = null;
      gsap.set(menuLogo, { opacity: 1 });
      gsap.set(menuInfoItems, { opacity: 1, y: 0 });
      gsap.set(splitChars, { opacity: 1, x: '0%' });
      isAnimating = false;
      return;
    }

    gsap.set(menuLogo, { opacity: 0 });
    gsap.set(menuInfoItems, { opacity: 0, y: 100 });
    gsap.set(splitChars, { opacity: 0, x: '750%' });

    openTimeline = gsap.timeline({
      onComplete: () => {
        openTimeline = null;
        isAnimating = false;
      },
    });

    openTimeline.to(menuLogo, { duration: 0.08, opacity: 1, ease: 'none' }, 0);
    openTimeline.to(
      menuInfoItems,
      {
        duration: 0.55,
        opacity: 1,
        y: 0,
        ease: 'power3.out',
        stagger: 0.05,
      },
      '-=0.2',
    );
    openTimeline.to(
      splitChars,
      {
        opacity: 1,
        x: '0%',
        duration: 0.55,
        stagger: 0.014,
        ease: 'power3.out',
      },
      '-=0.35',
    );
    return;
  }

  gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

  openTimeline = gsap.timeline({
    onComplete: () => {
      openTimeline = null;
      isAnimating = false;
    },
  });

  openTimeline.to(menuBg, { duration: 0.36, attr: { d: OPEN_FULL }, ease: 'power4.out' });

  openTimeline.to(menuLogo, { duration: 0.08, opacity: 1, ease: 'none' }, '-=0.52');

  openTimeline.to(
    menuInfoItems,
    {
      duration: 0.55,
      opacity: 1,
      y: 0,
      ease: 'power3.out',
      stagger: 0.05,
    },
    '-=0.28',
  );

  openTimeline.to(
    splitChars,
    {
      opacity: 1,
      x: '0%',
      duration: 0.55,
      stagger: 0.014,
      ease: 'power3.out',
    },
    '-=0.38',
  );
};

const closeMenu = (afterClose) => {
  openTimeline?.kill();
  openTimeline = null;
  closeTimeline?.kill();

  killNavToggleTweens();
  gsap.to(navToggleClose, { duration: 0.22, opacity: 0, ease: 'none' });
  gsap.to(navToggleMenu, {
    duration: 0.22,
    opacity: 1,
    ease: 'none',
    delay: 0.16,
  });

  const splitChars = splits.flatMap((s) => s.chars);
  const revealTargets = [menuBg, menuLogo, ...menuInfoItems, ...splitChars].filter(
    Boolean,
  );

  if (matchesOffcanvasDrawerLayout()) {
    gsap.killTweensOf(revealTargets);

    const finishDrawerClose = () => {
      closeTimeline = null;
      menu.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      navLogoWrap?.removeAttribute('aria-hidden');
      gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });
      splits.forEach((split) => {
        gsap.set(split.chars, { opacity: 0, x: '750%' });
      });
      gsap.set(menuInfoItems, { opacity: 0, y: 100 });
      gsap.set(menuLogo, { opacity: 0 });
      setNavToggleOpenState(false);
      isAnimating = false;
      afterClose?.();
    };

    if (menuMotionReduced()) {
      closeTimeline = null;
      gsap.set(menuLogo, { opacity: 0 });
      gsap.set(menuInfoItems, { opacity: 0, y: 100 });
      splits.forEach((split) => {
        gsap.set(split.chars, { opacity: 0, x: '750%' });
      });
      gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });
      menu.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      navLogoWrap?.removeAttribute('aria-hidden');
      setNavToggleOpenState(false);
      isAnimating = false;
      afterClose?.();
      return;
    }

    closeTimeline = gsap.timeline({ onComplete: finishDrawerClose });

    closeTimeline.to(splitChars, {
      duration: 0.18,
      opacity: 0,
      ease: 'power2.in',
      stagger: -0.006,
    });

    closeTimeline.to(menuLogo, { duration: 0.2, opacity: 0, ease: 'power2.in' }, '>');
    closeTimeline.to(
      menuInfoItems,
      { duration: 0.2, opacity: 0, y: 100, ease: 'power2.in' },
      '<',
    );

    return;
  }

  closeTimeline = gsap.timeline({
    onComplete: () => {
      closeTimeline = null;
      menu.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      navLogoWrap?.removeAttribute('aria-hidden');
      gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });
      splits.forEach((split) => {
        gsap.set(split.chars, { opacity: 0, x: '750%' });
      });
      gsap.set(menuInfoItems, { opacity: 0, y: 100 });
      gsap.set(menuLogo, { opacity: 0 });
      setNavToggleOpenState(false);
      isAnimating = false;
      afterClose?.();
    },
  });

  // Link chars out → single curtain tween to CLOSE_HIDDEN (+ logo/info with that tween)
  closeTimeline.to(splitChars, {
    duration: 0.18,
    opacity: 0,
    ease: 'power2.in',
    stagger: -0.006,
  });

  closeTimeline
    .to(menuBg, {
      duration: 0.52,
      attr: { d: CLOSE_HIDDEN },
      ease: 'power3.inOut',
    })
    .to(menuLogo, { duration: 0.2, opacity: 0, ease: 'power2.in' }, '<')
    .to(
      menuInfoItems,
      { duration: 0.2, opacity: 0, y: 100, ease: 'power2.in' },
      '<',
    );
};

/**
 * Nav title reflects the section at the scroll “reading line” (below fixed nav).
 */
(function initNavSectionTitle() {
  const navLogoLink = document.querySelector('.nav-logo-link');
  const navTitleEl = document.querySelector('.nav-shell .nav-logo-title');
  const navEl = document.querySelector('.nav');
  if (!navLogoLink || !navTitleEl || !navEl) return;

  /** Scroll targets + nav label (+ optional subtitle selector) keyed by section id. */
  const SECTION_META = {
    hero: {
      label: 'Gerlin',
      sentinel: '#hero .hero-headline',
    },
    'about-me': {
      label: 'About',
      noteSelector: '#about-heading .about-title-note',
      sentinel: '#about-heading',
    },
    experience: {
      label: 'Work',
      noteSelector: '#work-heading .work-title-note',
      sentinel: '#work-heading',
    },
    services: {
      label: 'Services',
      noteSelector: '#services-heading .section-shell__title-note',
      sentinel: '#services-heading',
    },
    fun: {
      label: 'Fun!',
      noteSelector: '#fun-heading .section-shell__title-note',
      sentinel: '#fun-heading',
    },
    projects: {
      label: 'Projects',
      sentinel: '#projects-heading',
    },
    'contact-me': {
      label: 'Contact',
      sentinel: '#contact-heading',
    },
  };

  function navSubtitleFor(sectionId) {
    const sel = SECTION_META[sectionId]?.noteSelector;
    const el = sel ? document.querySelector(sel) : null;
    return el?.textContent?.trim() ?? '';
  }

  function navLabelSpan() {
    let span = navTitleEl.querySelector(':scope > .nav-logo-title__label');
    if (!(span instanceof HTMLSpanElement)) {
      const t = `${navTitleEl.textContent ?? ''}`.trim() || SECTION_META.hero.label;
      navTitleEl.textContent = '';
      span = document.createElement('span');
      span.className = 'nav-logo-title__label';
      span.textContent = t;
      navTitleEl.appendChild(span);
    }
    return span;
  }

  function syncNavSubtitle(notePlain) {
    const existing = navTitleEl.querySelector(':scope > .nav-logo-title__note');
    if (!notePlain) {
      existing?.remove();
      navTitleEl.classList.remove('nav-logo-title--with-note');
      return;
    }
    navTitleEl.classList.add('nav-logo-title--with-note');
    let el = existing instanceof HTMLSpanElement ? existing : null;
    if (!el) {
      el = document.createElement('span');
      el.className = 'nav-logo-title__note';
      navTitleEl.appendChild(el);
    }
    el.textContent = notePlain;
  }

  function applyNavTitleAndNote(label, notePlain) {
    navLabelSpan().textContent = label;
    syncNavSubtitle(notePlain);
    navLogoLink.setAttribute(
      'aria-label',
      notePlain ? `${label} \u2014 ${notePlain}` : label,
    );
  }

  const sections = [...document.querySelectorAll('section[id]')].filter((s) =>
    Object.prototype.hasOwnProperty.call(SECTION_META, s.id),
  );

  if (sections.length === 0) return;

  function sentinelFor(sectionEl) {
    const sel = SECTION_META[sectionEl.id]?.sentinel;
    const el = sel ? document.querySelector(sel) : null;
    return el ?? sectionEl;
  }

  /** Offset from viewport top — below fixed nav chrome */
  function readingLineY() {
    const h = navEl.getBoundingClientRect().height;
    return Math.max(Math.round(h), 72) + 10;
  }

  function computeActiveId() {
    const y = readingLineY();

    let id = sections[0].id;
    for (const sec of sections) {
      const sent = sentinelFor(sec);
      const r = sent.getBoundingClientRect();
      if (r.top <= y) id = sec.id;
    }
    return id;
  }

  let rafId = 0;
  let swapTimer = null;

  const reduceMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function navTitleEchoesState(label, notePlain, href) {
    return (
      navLogoLink.getAttribute('href') === href &&
      navLabelSpan().textContent === label &&
      (navTitleEl.querySelector(':scope > .nav-logo-title__note')?.textContent?.trim() ??
        '') === notePlain
    );
  }

  function applySectionId(id) {
    const label = SECTION_META[id]?.label ?? SECTION_META.hero.label;
    const href = `#${id}`;
    const notePlain = navSubtitleFor(id);

    if (navTitleEchoesState(label, notePlain, href)) {
      return;
    }

    navLogoLink.setAttribute('href', href);

    if (reduceMotion()) {
      applyNavTitleAndNote(label, notePlain);
      return;
    }

    clearTimeout(swapTimer);
    navTitleEl.classList.remove('nav-logo-title--enter');
    navTitleEl.classList.add('nav-logo-title--exit');

    swapTimer = setTimeout(() => {
      applyNavTitleAndNote(label, notePlain);
      navTitleEl.classList.remove('nav-logo-title--exit');
      navTitleEl.classList.add('nav-logo-title--enter');
      swapTimer = setTimeout(() => {
        navTitleEl.classList.remove('nav-logo-title--enter');
      }, 200);
    }, 95);
  }

  function tick() {
    rafId = 0;
    applySectionId(computeActiveId());
  }

  function requestTick() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  window.addEventListener('hashchange', requestTick);

  tick();
})();

(function initAmbientBubbleClickFlash() {
  const FLASH_CLASS = 'bg-bubble--click-flash';
  const FLASH_NAMES = new Set(['bubble-click-flash', 'bubble-click-flash-reduce']);

  /** Each pop appends here with `{ indexWithinList, t, points }` — HUD shows summed `points`; pace uses `.length`. */
  const ambientBubblePopLog = [];
  window.ambientBubblePopLog = ambientBubblePopLog;
  /** When the Fun countdown hits 0, pops are ignored until `resetAmbientBubbleFun()`. */
  let ambientBubbleFunPopsFrozen = false;
  Object.defineProperty(window, 'ambientBubblePopCount', {
    enumerable: false,
    get: () => ambientBubblePopLog.length,
  });
  Object.defineProperty(window, 'ambientBubbleFunScore', {
    enumerable: false,
    get: () =>
      ambientBubblePopLog.reduce(
        (acc, entry) =>
          acc + (typeof entry?.points === 'number' && entry.points > 0 ? entry.points : 1),
        0,
      ),
  });

  /** Nominal CSS side length per `li:nth-child(1)…(10)` (.bg-bubbles in style.css). */
  const AMBIENT_SLOT_SIDE_PX = [28, 56, 28, 44, 28, 72, 88, 20, 10, 84];
  /** Distinct sizes only: smallest ⇒ K pts, …, largest ⇒ 1 pt (K = number of distinct sizes). */
  const AMBIENT_SIDE_TO_POINTS = (() => {
    const uniques = [...new Set(AMBIENT_SLOT_SIDE_PX)].sort((a, b) => a - b);
    const k = uniques.length;
    const map = new Map();
    uniques.forEach((side, idx) => map.set(side, k - idx));
    return map;
  })();
  /** Expand pointer slop so tiny tiles match ~44px comfort (esp. mouse / fine pointer). */
  const AMBIENT_MIN_COMFORT_HIT_PX = 44;

  const AMBIENT_PACE_MAX_POPS = 99;
  const AMBIENT_PACE_MIN_MULT = 0.14;
  /** Each respawn (~one pop logged): duration × this factor (~12% faster vs previous spawn each click). */
  const AMBIENT_PACE_FACTOR_PER_POP = 0.88;
  /** Matches `.bg-bubbles li:nth-child(1)…(10)` base float seconds (bubble-float + bubble-fade). */
  const AMBIENT_FLOAT_BASE_SEC = [25, 17, 25, 22, 25, 25, 25, 40, 40, 25];

  function ambientBubblePaceRespectsReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Duration multiplier for the next spawned ambient `<li>` only (inline `animation-duration`).
   * Uses pop count **after** the current pop; factor 0.88^n — steeper accel per tap toward the floor at 99 pops.
   * floored — so repeated clicks escalate pace in clear steps toward the cap at 99 pops.
   */
  function ambientPointsForSlotIndex(indexWithinList) {
    const nSlots = AMBIENT_SLOT_SIDE_PX.length;
    if (
      !(typeof indexWithinList === 'number' && indexWithinList >= 0 && indexWithinList < nSlots)
    )
      return 1;
    const side = AMBIENT_SLOT_SIDE_PX[indexWithinList];
    const pts = AMBIENT_SIDE_TO_POINTS.get(side);
    return typeof pts === 'number' && pts > 0 ? pts : 1;
  }

  function ambientPaceMultForCurrentLog() {
    if (ambientBubblePaceRespectsReducedMotion()) return 1;
    const n = Math.min(Math.max(ambientBubblePopLog.length, 0), AMBIENT_PACE_MAX_POPS);
    return Math.max(
      AMBIENT_PACE_MIN_MULT,
      Math.pow(AMBIENT_PACE_FACTOR_PER_POP, n),
    );
  }

  function cancelAmbientLiAnimations(li) {
    try {
      if (typeof li.getAnimations !== 'function') return;
      const merged = [];
      const collect = () => {
        merged.push(...li.getAnimations());
        try {
          merged.push(...li.getAnimations({ subtree: true }));
        } catch {
          /* older engines */
        }
      };
      collect();
      const seen = new Set();
      for (const anim of merged) {
        if (!anim || seen.has(anim)) continue;
        seen.add(anim);
        anim.cancel();
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Kill compositor-heavy state before the node disappears. Chrome/Blink keeps promoted float layers
   * unless transform/animation/filter are stripped; stale tiles can linger one frame past `replaceWith`.
   */
  function teardownAmbientBubbleForRemoval(li) {
    cancelAmbientLiAnimations(li);
    try {
      /* Safe here: node is swapped out immediately afterward. */
      li.classList.remove(FLASH_CLASS);
      li.style.setProperty('animation', 'none', 'important');
      li.style.setProperty('transition', 'none', 'important');
      li.style.setProperty('transform', 'none', 'important');
      li.style.setProperty('filter', 'none', 'important');
      li.style.setProperty('opacity', '0', 'important');
      li.style.setProperty('visibility', 'hidden', 'important');
      /* Stronger than visibility alone — helps Blink drop textures before detach */
      li.style.setProperty('display', 'none', 'important');
      li.style.setProperty('pointer-events', 'none', 'important');
      try {
        li.style.setProperty('will-change', 'auto', 'important');
      } catch {
        /* older engines — ignore */
      }
    } catch {
      /* ignore */
    }
  }

  function ambientGhostAfterPopRespectsReduce() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Red “ghost” silhouette where the tile was — embraces leftover mobile layers as a deliberate bleed */
  function spawnAmbientBubblePopGhost(rect) {
    if (!(rect && rect.width >= 3 && rect.height >= 3)) return;
    const el = document.createElement('div');
    el.className = 'ambient-bubble-pop-ghost';
    el.setAttribute('aria-hidden', 'true');
    if (ambientGhostAfterPopRespectsReduce()) el.classList.add('ambient-bubble-pop-ghost--reduce');
    el.style.left = `${Math.round(rect.left)}px`;
    el.style.top = `${Math.round(rect.top)}px`;
    el.style.width = `${Math.round(rect.width)}px`;
    el.style.height = `${Math.round(rect.height)}px`;
    document.body.appendChild(el);

    const dismiss = () => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    };
    el.addEventListener('animationend', dismiss, { once: true });
    window.setTimeout(dismiss, ambientGhostAfterPopRespectsReduce() ? 260 : 1100);
  }

  /** Insert a fresh `<li>` (never clone tapped nodes — avoids inheriting brittle animation state). */
  function replacePoppedAmbientLi(li, indexWithinList) {
    let ghostRect = null;
    try {
      if (li instanceof HTMLElement) ghostRect = li.getBoundingClientRect();
    } catch {
      ghostRect = null;
    }

    teardownAmbientBubbleForRemoval(li);
    const parent = li.parentElement;
    if (!(parent instanceof HTMLUListElement)) return;

    const fresh = document.createElement('li');
    const amb = li.getAttribute('data-ambient-float');
    if (amb !== null && amb !== '') fresh.setAttribute('data-ambient-float', amb);

    if (
      typeof indexWithinList === 'number' &&
      indexWithinList >= 0 &&
      indexWithinList < AMBIENT_FLOAT_BASE_SEC.length &&
      parent.classList.contains('bg-bubbles') &&
      !parent.classList.contains('bg-bubbles--menu') &&
      !parent.classList.contains('bg-bubbles--drawer')
    ) {
      const baseSec = AMBIENT_FLOAT_BASE_SEC[indexWithinList];
      const mult = ambientPaceMultForCurrentLog();
      const dur = `${(baseSec * mult).toFixed(2)}s`;
      fresh.style.setProperty('animation-duration', `${dur}, ${dur}`);
    }

    const swap = () => {
      li.replaceWith(fresh);
      spawnAmbientBubblePopGhost(ghostRect);
    };
    /* One frame defer: lets Chrome recycle the old layer before the new <li> is composited */
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(swap);
    } else {
      swap();
    }
  }

  /** Animations canceled + node replaced immediately so no lingering “vanished but visible” tile. */
  function vanishBubbleAfterFlash(li) {
    const parent = li.parentElement;
    const indexWithinList =
      parent instanceof HTMLUListElement
        ? [...parent.children].indexOf(li)
        : -1;

    ambientBubblePopLog.push({
      indexWithinList,
      t: typeof performance?.now === 'function' ? performance.now() : Date.now(),
      points: ambientPointsForSlotIndex(indexWithinList),
    });

    window.dispatchEvent(new CustomEvent('ambient-bubble-pop'));
    replacePoppedAmbientLi(li, indexWithinList);
  }

  function ambientFlashFallbackMs() {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return 220;
    /* Match `.bg-bubbles … bubble-click-flash` (0.48s) + buffer; avoids relying on pseudo `::after` animationend bugs */
    return 560;
  }

  function tryPopAmbientBubble(li) {
    if (!(li instanceof HTMLLIElement) || li.classList.contains(FLASH_CLASS)) return false;
    if (ambientBubbleFunPopsFrozen) return false;

    let failSafeId = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(failSafeId);
      li.removeEventListener('animationend', onAnimationEnd);
      vanishBubbleAfterFlash(li);
    };

    function onAnimationEnd(e) {
      if (!FLASH_NAMES.has(e.animationName)) return;
      finish();
    }

    li.classList.add(FLASH_CLASS);
    li.addEventListener('animationend', onAnimationEnd);
    failSafeId = window.setTimeout(finish, ambientFlashFallbackMs());
    return true;
  }

  function ambientLiRectHit(rect, clientX, clientY, fudgePx) {
    const f = fudgePx;
    return (
      clientX >= rect.left - f &&
      clientX <= rect.right + f &&
      clientY >= rect.top - f &&
      clientY <= rect.bottom + f
    );
  }

  /**
   * The `<ul>` has `pointer-events: none`; stacked `<li>` hits are unioned vs `clientX/Y`.
   * `directTarget` recovers edge taps when rect slop disagrees. Prefer `pointerup` on touch (see init).
   */
  function ambientHitFudgeForLi(li, baseFudge) {
    if (!(li instanceof HTMLElement)) return baseFudge;
    let r;
    try {
      r = li.getBoundingClientRect();
    } catch {
      return baseFudge;
    }
    const side = Math.min(r.width, r.height);
    const inflate = Math.max(0, (AMBIENT_MIN_COMFORT_HIT_PX - side) / 2);
    return baseFudge + inflate;
  }

  /** Matches CSS touch/coarse breakpoints; `(pointer: coarse)` alone misses many phones + DevTools. */
  function ambientBubbleSlopPx() {
    if (typeof window.matchMedia !== 'function') return 16;
    if (window.matchMedia('(any-pointer: coarse)').matches) return 30;
    if (window.matchMedia('(pointer: coarse)').matches) return 30;
    /* Touch-first handset / tablet stacks that still report primary `fine` — widen slop anyway */
    if (window.matchMedia('(hover: none)').matches) return 24;
    return 14;
  }

  function ambientHitLisForClient(ul, clientX, clientY, fudgePx, directTarget) {
    const sx = typeof clientX === 'number' ? clientX : 0;
    const sy = typeof clientY === 'number' ? clientY : 0;

    const hits = [...ul.children].filter(
      (el) =>
        el instanceof HTMLLIElement &&
        !el.classList.contains(FLASH_CLASS) &&
        ambientLiRectHit(
          el.getBoundingClientRect(),
          sx,
          sy,
          ambientHitFudgeForLi(el, fudgePx),
        ),
    );

    const t = directTarget;
    if (
      t instanceof HTMLLIElement &&
      t.parentElement === ul &&
      !t.classList.contains(FLASH_CLASS) &&
      !hits.includes(t)
    ) {
      hits.push(t);
    }

    return hits;
  }

  function ambientPeekHits(ul, clientX, clientY, directTarget) {
    if (!(ul instanceof HTMLUListElement)) return [];
    const fudge = ambientBubbleSlopPx();
    return [...new Set(ambientHitLisForClient(ul, clientX, clientY, fudge, directTarget))];
  }

  /** @returns {boolean} true if this gesture should consume the follow-up synthetic `click` */
  function ambientActivateHits(ul, lis, ev) {
    if (!(ul instanceof HTMLUListElement) || lis.length === 0) return false;
    if (ambientBubbleFunPopsFrozen) {
      ev.preventDefault();
      ev.stopPropagation();
      return true;
    }
    ev.preventDefault();
    ev.stopPropagation();
    for (const li of lis) tryPopAmbientBubble(li);
    return true;
  }

  document
    .querySelectorAll('.bg-bubbles:not(.bg-bubbles--menu):not(.bg-bubbles--drawer)')
    .forEach((ul) => {
      if (!(ul instanceof HTMLUListElement)) return;

      const pointerPath = typeof window.PointerEvent !== 'undefined';

      if (pointerPath) {
        /*
         * Primary path: `pointerup` has reliable coords for touch. Browsers still emit a follow-up
         * `click` — suppress duplicates when we already popped (`ambientActivateHits`).
         */
        let suppressClickAfterAmbientPointer = 0;
        ul.addEventListener('pointerup', (ev) => {
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          const lis = ambientPeekHits(ul, ev.clientX, ev.clientY, ev.target);
          if (ambientActivateHits(ul, lis, ev)) {
            suppressClickAfterAmbientPointer =
              (typeof performance?.now === 'function' ? performance.now() : Date.now()) + 480;
          }
        });
        ul.addEventListener('click', (ev) => {
          const now =
            typeof performance?.now === 'function' ? performance.now() : Date.now();
          if (now < suppressClickAfterAmbientPointer) return;
          const lis = ambientPeekHits(ul, ev.clientX, ev.clientY, ev.target);
          ambientActivateHits(ul, lis, ev);
        });
        return;
      }

      /*
       * Legacy: synthetic `click` often carries bad `clientX/Y` vs rect hit-test;
       * `touchend.changedTouches` does not. Suppress the follow-up click only when we popped.
       */
      let suppressAmbientClickUntil = 0;
      ul.addEventListener(
        'touchend',
        (ev) => {
          const t = ev.changedTouches?.[0];
          if (!t) return;
          const lis = ambientPeekHits(ul, t.clientX, t.clientY, ev.target);
          if (ambientActivateHits(ul, lis, ev)) {
            suppressAmbientClickUntil =
              (typeof performance?.now === 'function' ? performance.now() : Date.now()) + 450;
          }
        },
        { passive: true },
      );
      ul.addEventListener('click', (ev) => {
        const now = typeof performance?.now === 'function' ? performance.now() : Date.now();
        if (now < suppressAmbientClickUntil) return;
        const lis = ambientPeekHits(ul, ev.clientX, ev.clientY, ev.target);
        ambientActivateHits(ul, lis, ev);
      });
    });

  /** Called when the Fun-section minute timer reaches 0 (no pops scored until reset). */
  window.reportAmbientBubbleFunTimeUp = function reportAmbientBubbleFunTimeUp() {
    ambientBubbleFunPopsFrozen = true;
  };

  /** Clears Fun counter pace state; removes inline durations so hero floats return to CSS timings. */
  window.resetAmbientBubbleFun = function resetAmbientBubbleFun() {
    ambientBubbleFunPopsFrozen = false;
    ambientBubblePopLog.length = 0;
    document
      .querySelectorAll('.bg-bubbles:not(.bg-bubbles--menu):not(.bg-bubbles--drawer) > li')
      .forEach((node) => {
        if (node instanceof HTMLElement) node.style.removeProperty('animation-duration');
      });
    window.dispatchEvent(new CustomEvent('ambient-bubble-pop', { detail: { fromReset: true } }));
  };
})();

(function initFunBubbleCounterUI() {
  /** First-pop countdown: exactly 1 minute wall time (M:SS display). */
  const FUN_POP_COUNTDOWN_SEC = 1 * 60;
  const FUN_SCORE_DISPLAY_MAX = 999;

  const el = document.getElementById('fun-bubble-counter-digits');
  const gagsWrap = document.getElementById('fun-bubble-counter-gags');
  const gagTimerLines = gagsWrap
    ? gagsWrap.querySelectorAll('[data-gag-running-only], [data-gag-done-only]')
    : [];
  const gagResetFlash = document.getElementById('fun-bubble-counter-gag-reset-flash');

  /** @type {ReturnType<typeof window.setTimeout> | null} */
  let gagResetFlashId = null;

  const countdownRow = document.getElementById('fun-bubble-countdown-row');
  const countdownEl = document.getElementById('fun-bubble-countdown');

  if (!el) return;

  /** @type {'idle' | 'running' | 'done'} */
  let countdownPhase = 'idle';
  /** @type {ReturnType<typeof window.setInterval> | null} */
  let countdownIntervalId = null;
  let countdownRemainSec = FUN_POP_COUNTDOWN_SEC;

  const funPopLog = () =>
    Array.isArray(window.ambientBubblePopLog) ? window.ambientBubblePopLog : [];

  function formatCountdownRemain(sec) {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function stopCountdownInterval() {
    if (countdownIntervalId !== null) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  function hideAllTimerGagLines() {
    for (const node of gagTimerLines) {
      if (node instanceof HTMLElement)
        node.classList.remove('fun-bubble-counter__gag-line--visible');
    }
  }

  /** Time-based copy: only while countdown is running or after buzzer (`done`). */
  function syncTimerGags() {
    if (
      gagResetFlash instanceof HTMLElement &&
      gagResetFlash.classList.contains('fun-bubble-counter__gag-line--visible')
    )
      return;

    const r = countdownRemainSec;

    for (const node of gagTimerLines) {
      if (!(node instanceof HTMLElement)) continue;
      const doneOnly = node.hasAttribute('data-gag-done-only');
      const runOnly = node.hasAttribute('data-gag-running-only');

      let hit = false;
      if (doneOnly) {
        hit = countdownPhase === 'done';
      } else if (runOnly) {
        const mn = Number.parseInt(`${node.dataset.gagRemainMin ?? ''}`, 10);
        const mx = Number.parseInt(`${node.dataset.gagRemainMax ?? ''}`, 10);
        if (!Number.isFinite(mn) || !Number.isFinite(mx)) continue;
        hit =
          countdownPhase === 'running' &&
          r >= mn &&
          r <= mx;
      }

      node.classList.toggle('fun-bubble-counter__gag-line--visible', hit);
    }
  }

  /** Countdown chrome + gag lines keyed to seconds remaining */
  function paintCountdownUI() {
    if (!(countdownEl instanceof HTMLElement)) return;
    countdownEl.textContent = formatCountdownRemain(countdownRemainSec);
    const done = countdownRemainSec <= 0;
    countdownEl.classList.toggle('fun-bubble-counter__timer-digits--done', done);
    countdownEl.setAttribute(
      'aria-valuetext',
      done ? 'Time up' : `${countdownRemainSec} seconds remaining`,
    );
    syncTimerGags();
  }

  const RESET_GAG_VISIBLE_MS = 3200;

  function clearResetGagFlash() {
    if (gagResetFlashId !== null) {
      window.clearTimeout(gagResetFlashId);
      gagResetFlashId = null;
    }
  }

  function triggerResetGagFlash() {
    if (!(gagResetFlash instanceof HTMLElement)) return;
    clearResetGagFlash();
    hideAllTimerGagLines();
    gagResetFlash.classList.add('fun-bubble-counter__gag-line--visible');
    gagResetFlashId = window.setTimeout(() => {
      gagResetFlashId = null;
      gagResetFlash.classList.remove('fun-bubble-counter__gag-line--visible');
      syncTimerGags();
    }, RESET_GAG_VISIBLE_MS);
  }

  function hideCountdownRow() {
    if (countdownRow instanceof HTMLElement) countdownRow.hidden = true;
  }

  function showCountdownRow() {
    if (countdownRow instanceof HTMLElement) countdownRow.hidden = false;
  }

  function syncPopCountdownFromLog(popCount, fromResetButton) {
    if (popCount <= 0) {
      countdownPhase = 'idle';
      stopCountdownInterval();
      countdownRemainSec = FUN_POP_COUNTDOWN_SEC;
      if (countdownEl instanceof HTMLElement) {
        countdownEl.textContent = formatCountdownRemain(countdownRemainSec);
        countdownEl.classList.remove('fun-bubble-counter__timer-digits--done');
        countdownEl.removeAttribute('aria-valuetext');
      }
      syncTimerGags();
      /* After Reset: show full minute primed; first load stays hidden until first pop */
      if (fromResetButton) {
        showCountdownRow();
      } else {
        hideCountdownRow();
      }
      return;
    }

    if (countdownPhase === 'idle') {
      countdownPhase = 'running';
      countdownRemainSec = FUN_POP_COUNTDOWN_SEC;
      stopCountdownInterval();
      showCountdownRow();
      paintCountdownUI();
      countdownIntervalId = window.setInterval(() => {
        countdownRemainSec -= 1;
        paintCountdownUI();
        if (countdownRemainSec <= 0) {
          stopCountdownInterval();
          countdownPhase = 'done';
          syncTimerGags();
          if (typeof window.reportAmbientBubbleFunTimeUp === 'function') {
            window.reportAmbientBubbleFunTimeUp();
          }
        }
      }, 1000);
    }
  }

  const syncDigitsFromFunPopLog = (ev) => {
    const fromResetButton = ev?.detail?.fromReset === true;
    const log = funPopLog();
    const physicalPops = log.length;
    const totalScore = log.reduce(
      (sum, e) =>
        sum + (typeof e.points === 'number' && e.points > 0 ? e.points : 1),
      0,
    );
    const displayScore = Math.min(Math.max(totalScore, 0), FUN_SCORE_DISPLAY_MAX);
    /* One “0” at start; then total points (clamped) without leading zeros */
    const s = displayScore === 0 ? '0' : String(displayScore);

    el.replaceChildren();
    for (let i = 0; i < s.length; i++) {
      const span = document.createElement('span');
      span.className = `fun-bubble-counter__digit ${
        displayScore === 0
          ? 'fun-bubble-counter__digit--inactive'
          : 'fun-bubble-counter__digit--active'
      }`;
      span.textContent = s.charAt(i);
      el.appendChild(span);
    }
    el.setAttribute('aria-label', `${displayScore} points`);

    syncPopCountdownFromLog(physicalPops, fromResetButton);
    if (fromResetButton) triggerResetGagFlash();
  };

  syncDigitsFromFunPopLog();
  window.addEventListener('ambient-bubble-pop', syncDigitsFromFunPopLog);

  const resetBtn = document.getElementById('fun-bubble-counter-reset');
  if (resetBtn instanceof HTMLButtonElement && typeof window.resetAmbientBubbleFun === 'function') {
    resetBtn.addEventListener('click', () => {
      window.resetAmbientBubbleFun();
    });
  }
})();
