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

const svgWidth = menuBgSvg.viewBox.baseVal.width;
const svgHeight = menuBgSvg.viewBox.baseVal.height;
const svgCenterX = svgWidth / 2;

const OPEN_HIDDEN = `M${svgWidth},0 Q${svgCenterX},0 0,0 L0,0 L${svgWidth},0 Z`;
const OPEN_FULL = `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,0 L${svgWidth},0 Z`;
const CLOSE_HIDDEN = `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,${svgHeight} L${svgWidth},${svgHeight} Z`;

gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

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
  if (!menu.classList.contains('is-open')) {
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
  const menuOpen = menu.classList.contains('is-open');
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

navToggle.addEventListener('click', () => {
  if (isAnimating) return;
  isAnimating = true;
  isOpen = !isOpen;
  isOpen ? openMenu() : closeMenu();
});

const openMenu = () => {
  openTimeline?.kill();

  setNavToggleOpenState(true);

  menu.classList.add('is-open');
  document.body.classList.add('menu-open');
  navLogoWrap?.setAttribute('aria-hidden', 'true');
  gsap.set(menuLinks, { opacity: 1 });
  gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

  killNavToggleTweens();
  gsap.to(navToggleMenu, { duration: 0.18, opacity: 0, ease: 'none' });
  gsap.to(navToggleClose, {
    duration: 0.18,
    opacity: 1,
    ease: 'none',
    delay: 0.15,
  });

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
    splits.flatMap((s) => s.chars),
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
  closeTimeline.to(splits.flatMap((s) => s.chars), {
    duration: 0.18,
    opacity: 0,
    ease: 'power2.in',
    stagger: -0.006,
  });

  closeTimeline.to(menuBg, {
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
  const navTitleEl = document.querySelector('.nav-logo-title');
  const navEl = document.querySelector('.nav');
  if (!navLogoLink || !navTitleEl || !navEl) return;

  const SECTION_LABELS = {
    hero: 'Gerlin',
    about: 'About',
    work: 'Work',
    services: 'Services',
    fun: 'Fun',
    projects: 'Projects',
    contact: 'Contact',
  };

  const sections = [
    ...document.querySelectorAll('section[id]'),
  ].filter((s) => Object.prototype.hasOwnProperty.call(SECTION_LABELS, s.id));

  if (sections.length === 0) return;

  /**
   * Element whose top crossing the reading line drives the nav label —
   * each section’s main title (not the section wrapper).
   */
  const SECTION_SENTINEL_SELECTOR = {
    hero: '#hero .hero-headline',
    about: '#about-heading',
    work: '#work-heading',
    services: '#services-heading',
    fun: '#fun-heading',
    projects: '#projects-heading',
    contact: '#contact-heading',
  };

  function sentinelFor(sectionEl) {
    const sel = SECTION_SENTINEL_SELECTOR[sectionEl.id];
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

  function applySectionId(id) {
    const label = SECTION_LABELS[id] ?? SECTION_LABELS.hero;
    const href = `#${id}`;

    if (navTitleEl.textContent === label && navLogoLink.getAttribute('href') === href) {
      return;
    }

    navLogoLink.setAttribute('href', href);

    if (reduceMotion()) {
      navTitleEl.textContent = label;
      return;
    }

    clearTimeout(swapTimer);
    navTitleEl.classList.remove('nav-logo-title--enter');
    navTitleEl.classList.add('nav-logo-title--exit');

    swapTimer = setTimeout(() => {
      navTitleEl.textContent = label;
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
