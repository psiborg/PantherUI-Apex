/**
 * demo-basic.js
 * JavaScript for PantherUI basic demo page
 *
 * Panel content is defined as static <figure> elements in demo-basic.html —
 * no JS injection needed. This script handles carousel init, dot indicators,
 * hash-based deep linking, and keyboard shortcuts only.
 */

const CAROUSEL_ID = 'main-carousel';

// --- Hash / Deep-link Support -----------------------------------------
// URL format: #3  →  jump to panel 3 (1-based)

let _suppressHashChange = false;

function panelFromHash() {
  const n = parseInt(window.location.hash.slice(1), 10);
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c || isNaN(n) || n < 1 || n > c.panelCount) return;
  _suppressHashChange = true;
  Panther.Carousel.turnTo(CAROUSEL_ID, n);
  _suppressHashChange = false;
}

function updateHash(panelNumber) {
  if (_suppressHashChange) return;
  history.replaceState(null, '', '#' + panelNumber);
}

// --- Initialize -------------------------------------------------------

Panther.Carousel.init({
  id: CAROUSEL_ID,
  easing: 'easeInOutBack',
  callback(c) {
    const panel = Math.round(c.sideIndex % c.panelCount) + 1;
    updateIndicator(c.sideIndex % c.panelCount);
    updateHash(panel);
  },
});

buildIndicator();
requestAnimationFrame(panelFromHash);
window.addEventListener('hashchange', panelFromHash);

// --- Dot Indicators ---------------------------------------------------

function buildIndicator() {
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;
  const box = document.getElementById('indicator');
  box.innerHTML = '';
  for (let i = 0; i < c.panelCount; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.title = `Panel ${i + 1}`;
    d.addEventListener('click', () => Panther.Carousel.turnTo(CAROUSEL_ID, i + 1));
    box.appendChild(d);
  }
}

function updateIndicator(index) {
  const dots = document.querySelectorAll('#indicator .dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === Math.round(index) % dots.length));
}

// --- Keyboard Shortcuts -----------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft')  Panther.Carousel.turnPrev(CAROUSEL_ID);
  if (e.key === 'ArrowRight') Panther.Carousel.turnNext(CAROUSEL_ID);
  if (e.key === 'ArrowUp')    Panther.Carousel.maximize(CAROUSEL_ID);
  if (e.key === 'ArrowDown')  Panther.Carousel.restore(CAROUSEL_ID);
  if (e.key >= '1' && e.key <= '9') Panther.Carousel.turnTo(CAROUSEL_ID, parseInt(e.key));
});
