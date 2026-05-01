/* gsap & SplitText: loaded via CDN in index.html */

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

/** Tablet+ hides `.menu-bg-svg` (side drawer + dimmed backdrop) — curtain path tweens must be skipped there. */
function matchesOffcanvasDrawerLayout() {
  return window.matchMedia('(min-width: 768px)').matches;
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

  /* Drawer layout: SVG curtain is display:none — tweening `#menu-path` can stall the timeline */
  /* so logo / SplitText chars never reveal and close may never run onComplete → blank stuck panel */
  if (matchesOffcanvasDrawerLayout()) {
    openTimeline = null;
    gsap.killTweensOf(revealTargets);
    gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });
    gsap.set(menuLogo, { opacity: 1 });
    gsap.set(menuInfoItems, { opacity: 1, y: 0 });
    gsap.set(splitChars, { opacity: 1, x: '0%' });
    isAnimating = false;
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
    closeTimeline = null;
    gsap.killTweensOf(revealTargets);
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
  const VANISHED_CLASS = 'bg-bubble--vanished';
  const FLASH_NAMES = new Set(['bubble-click-flash', 'bubble-click-flash-reduce']);
  const FLOAT_ANIM = 'bubble-float';

  /** Each pop appends here — `.length` is the Fun-section counter (`#fun-bubble-counter-digits`). */
  const ambientBubblePopLog = [];
  window.ambientBubblePopLog = ambientBubblePopLog;
  Object.defineProperty(window, 'ambientBubblePopCount', {
    enumerable: false,
    get: () => ambientBubblePopLog.length,
  });

  function cancelBubbleFade(li) {
    try {
      if (typeof li.getAnimations !== 'function') return false;
      for (const anim of li.getAnimations()) {
        const n = `${anim.animationName ?? ''}`;
        if (n === 'bubble-fade') {
          anim.cancel();
          return true;
        }
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /** Without this, bubble-fade keeps forcing li opacity ≥ 0.45 mid-cycle so it never disappears. */
  function vanishBubbleAfterFlash(li) {
    cancelBubbleFade(li);
    li.style.opacity = '0';
    li.style.visibility = 'hidden';
    li.classList.add(VANISHED_CLASS);

    const parent = li.parentElement;
    const indexWithinList =
      parent instanceof HTMLUListElement
        ? [...parent.children].indexOf(li)
        : -1;
    ambientBubblePopLog.push({
      indexWithinList,
      t: typeof performance?.now === 'function' ? performance.now() : Date.now(),
    });

    window.dispatchEvent(new CustomEvent('ambient-bubble-pop'));
  }

  function bindBubbleClick(li) {
    function onBubbleClick(ev) {
      const target = ev.currentTarget;
      if (
        !(target instanceof HTMLLIElement) ||
        target.classList.contains(FLASH_CLASS) ||
        target.classList.contains(VANISHED_CLASS)
      )
        return;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(failSafe);
        target.removeEventListener('animationend', onAnimationEnd);
        target.classList.remove(FLASH_CLASS);
        vanishBubbleAfterFlash(target);
      };

      function onAnimationEnd(e) {
        if (!FLASH_NAMES.has(e.animationName)) return;
        finish();
      }

      target.classList.add(FLASH_CLASS);
      target.addEventListener('animationend', onAnimationEnd);
      const failSafe = window.setTimeout(finish, 700);
    }

    li.addEventListener('click', onBubbleClick);
  }

  /** Bubble-float repeats from the bottom — replace the popped li so faded animation restarts cleanly. */
  function respawnVanishedAmbientBubble(li) {
    if (!li.classList.contains(VANISHED_CLASS)) return;

    const parent = li.parentElement;
    if (!(parent instanceof HTMLUListElement)) return;

    const fresh = li.cloneNode(false);
    fresh.removeAttribute('style');
    fresh.classList.remove(VANISHED_CLASS, FLASH_CLASS);
    li.replaceWith(fresh);
    bindBubbleClick(fresh);
    fresh.addEventListener('animationiteration', onBubbleFloatIteration);
  }

  function onBubbleFloatIteration(ev) {
    if (ev.animationName !== FLOAT_ANIM || !(ev.target instanceof HTMLLIElement))
      return;
    respawnVanishedAmbientBubble(ev.target);
  }

  document
    .querySelectorAll('.bg-bubbles:not(.bg-bubbles--menu)')
    .forEach((ul) => {
      ul.querySelectorAll(':scope > li').forEach((li) => {
        bindBubbleClick(li);
        li.addEventListener('animationiteration', onBubbleFloatIteration);
      });
    });
})();

(function initFunBubbleCounterUI() {
  const el = document.getElementById('fun-bubble-counter-digits');
  const gagsWrap = document.getElementById('fun-bubble-counter-gags');
  const gagLines = gagsWrap
    ? gagsWrap.querySelectorAll('.fun-bubble-counter__gag-line')
    : [];

  if (!el) return;

  const funPopLog = () =>
    Array.isArray(window.ambientBubblePopLog) ? window.ambientBubblePopLog : [];

  function gagLineMatchesPop(line, popCount) {
    const mn = Number.parseInt(`${line.dataset.popMin ?? ''}`, 10);
    const mx = Number.parseInt(`${line.dataset.popMax ?? ''}`, 10);
    if (
      !Number.isFinite(mn) ||
      !Number.isFinite(mx)
    )
      return false;
    return popCount >= mn && popCount <= mx;
  }

  function syncGagPhases(popCount) {
    for (const node of gagLines) {
      if (!(node instanceof HTMLElement)) continue;
      node.classList.toggle(
        'fun-bubble-counter__gag-line--visible',
        gagLineMatchesPop(node, popCount),
      );
    }
  }

  const syncDigitsFromFunPopLog = () => {
    const n = Math.min(Math.max(funPopLog().length, 0), 99);
    /* One “0” at start; grows 1 … 9, 10, … without leading zeros */
    const s = n === 0 ? '0' : String(n);

    el.replaceChildren();
    for (let i = 0; i < s.length; i++) {
      const span = document.createElement('span');
      span.className = `fun-bubble-counter__digit ${
        n === 0
          ? 'fun-bubble-counter__digit--inactive'
          : 'fun-bubble-counter__digit--active'
      }`;
      span.textContent = s.charAt(i);
      el.appendChild(span);
    }
    el.setAttribute('aria-label', `${n}`);

    syncGagPhases(n);
  };

  syncDigitsFromFunPopLog();
  window.addEventListener('ambient-bubble-pop', syncDigitsFromFunPopLog);
})();
