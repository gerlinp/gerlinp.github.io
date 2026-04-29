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

const svgWidth = menuBgSvg.viewBox.baseVal.width;
const svgHeight = menuBgSvg.viewBox.baseVal.height;
const svgCenterX = svgWidth / 2;

const OPEN_HIDDEN = `M${svgWidth},0 Q${svgCenterX},0 0,0 L0,0 L${svgWidth},0 Z`;
const OPEN_FULL = `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,0 L${svgWidth},0 Z`;
const CLOSE_HIDDEN = `M${svgWidth},${svgHeight} Q${svgCenterX},${svgHeight} 0,${svgHeight} L0,${svgHeight} L${svgWidth},${svgHeight} Z`;

gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

const splits = [];
menuLinks.forEach((link) => {
  const split = new SplitText(link, { type: 'chars' });
  splits.push(split);
  gsap.set(split.chars, { opacity: 0, x: '750%' });
});

gsap.set(menuInfoItems, { opacity: 0, y: 100 });

navToggle.addEventListener('click', () => {
  if (isAnimating) return;
  isAnimating = true;
  isOpen = !isOpen;
  isOpen ? openMenu() : closeMenu();
});

const openMenu = () => {
  menu.classList.add('is-open');
  gsap.set(menuLinks, { opacity: 1 });
  gsap.set(menuBg, { attr: { d: OPEN_HIDDEN } });

  gsap.to(navToggleMenu, { duration: 0.18, opacity: 0, ease: 'none' });
  gsap.to(navToggleClose, {
    duration: 0.18,
    opacity: 1,
    ease: 'none',
    delay: 0.15,
  });

  const tl = gsap.timeline({
    onComplete: () => {
      isAnimating = false;
    },
  });

  tl.to(menuBg, { duration: 0.36, attr: { d: OPEN_FULL }, ease: 'power4.out' });

  tl.to(menuLogo, { duration: 0.08, opacity: 1, ease: 'none' }, '-=0.52');

  tl.to(
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

  tl.to(
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

const closeMenu = () => {
  gsap.to(navToggleClose, { duration: 0.22, opacity: 0, ease: 'none' });
  gsap.to(navToggleMenu, {
    duration: 0.22,
    opacity: 1,
    ease: 'none',
    delay: 0.16,
  });

  const tl = gsap.timeline({
    onComplete: () => {
      menu.classList.remove('is-open');
      gsap.set(menuBg, { attr: { d: CLOSE_HIDDEN } });
      splits.forEach((split) => {
        gsap.set(split.chars, { opacity: 0, x: '750%' });
      });
      gsap.set(menuInfoItems, { opacity: 0, y: 100 });
      gsap.set(menuLogo, { opacity: 0 });
      isAnimating = false;
    },
  });

  // Link chars out → single curtain tween to CLOSE_HIDDEN (+ logo/info with that tween)
  tl.to(splits.flatMap((s) => s.chars), {
    duration: 0.18,
    opacity: 0,
    ease: 'power2.in',
    stagger: -0.006,
  });

  tl.to(menuBg, {
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
