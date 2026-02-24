/**
 * demo.js
 * JavaScript for PantherUI full demo page
 */

// --- Panel Data -----------------------------------------------------

const panelData = [
  {
    title: 'OVERVIEW',
    accent: 'p-accent-orange',
    bg: '#1c1c1c',
    content: `
      <div class="panel-accent p-accent-orange"></div>
      <div style="padding:16px 14px;line-height:1.8;color:#aaa;font-size:0.8rem;">
        <p style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;color:#eee;margin-bottom:10px;">
          PantherUI 3D Carousel
        </p>
        <p>A GPU-accelerated, CSS <em>preserve-3d</em> carousel component. Panels are arranged as faces of a geometric prism and rotate smoothly in 3D space. Supports drag, flick, touch, keyboard, and programmatic control.</p>
        <p style="margin-top:10px;color:#666;">Originally created by Jim Ing for BlackBerry Limited (2013–2014). Improved and refactored to modern ES6+ (2026).</p>
      </div>
      <ul>
        <li>ES6 class-based architecture</li>
        <li>Support for touch, mouse and keyboard</li>
        <li>Maximize / restore panels</li>
        <li>Dynamic panel injection</li>
      </ul>
    `
  },
  {
    title: 'GEOMETRY',
    accent: 'p-accent-teal',
    bg: '#1a2626',
    content: `
      <div class="panel-accent p-accent-teal"></div>
      <div style="padding:14px;color:#8dd;font-size:0.78rem;line-height:2;">
        <p style="font-family:'Syne',sans-serif;font-size:0.9rem;color:#aee;margin-bottom:8px;font-weight:700;">Trigonometric Placement</p>
        <p style="color:#7aa;margin-bottom:12px;">Each panel is rotated at equal angular intervals and translated outward using the inscribed polygon radius.</p>
      </div>
      <ul>
        <li>θ = 360° / panelCount</li>
        <li>r = (w/2) / tan(π / n)</li>
        <li>transform: rotateY(θ·i) translateZ(r)</li>
        <li>Min. 3 panels required</li>
        <li>Recalculates on resize</li>
      </ul>
    `
  },
  {
    title: 'INTERACTION',
    accent: 'p-accent-blue',
    bg: '#1a1c26',
    content: `
      <div class="panel-accent p-accent-blue"></div>
      <div style="padding:14px;color:#aac;font-size:0.78rem;line-height:2;">
        <p style="font-family:'Syne',sans-serif;font-size:0.9rem;color:#aaf;margin-bottom:8px;font-weight:700;">Input System</p>
        <p style="color:#889;margin-bottom:12px;">Unified pointer model handles both mouse and touch with automatic detection. Min drag threshold prevents accidental rotations.</p>
      </div>
      <ul>
        <li>Keyboard navigation</li>
        <li>touchstart / touchmove / touchend</li>
        <li>mousedown / mousemove / mouseup</li>
        <li>Minimum drag threshold</li>
        <li>Orientation change handling</li>
        <li>Debounced resize listener (250ms)</li>
      </ul>
    `
  },
  {
    title: 'CONTROLS',
    accent: 'p-accent-green',
    bg: '#1a2218',
    content: `
      <div class="panel-accent p-accent-green"></div>
      <div style="padding:14px;color:#aca;font-size:0.78rem;line-height:2;">
        <p style="font-family:'Syne',sans-serif;font-size:0.9rem;color:#8da;margin-bottom:8px;font-weight:700;">Public API</p>
        <p style="color:#779;margin-bottom:12px;">All navigation is exposed as clean methods on the <code style="color:#4d8;">Panther.Carousel</code> namespace.</p>
      </div>
      <ul>
        <li>Carousel.init(opts)</li>
        <li>Carousel.turnNext(id)</li>
        <li>Carousel.turnPrev(id)</li>
        <li>Carousel.turnTo(id, side)</li>
        <li>Carousel.refresh()</li>
      </ul>
    `
  },
  {
    title: 'API',
    accent: 'p-accent-purple',
    bg: '#1e1a26',
    content: `
      <div class="panel-accent p-accent-purple"></div>
      <div style="padding:14px;color:#c8b;font-size:0.78rem;line-height:2;">
        <p style="font-family:'Syne',sans-serif;font-size:0.9rem;color:#d4a;margin-bottom:8px;font-weight:700;">Options</p>
        <p style="color:#887;margin-bottom:12px;">Carousels are fully configurable at initialization and support runtime callbacks.</p>
      </div>
      <ul>
        <li>id: string (required)</li>
        <li>backgroundColor: css color</li>
        <li>easing: named key or css function</li>
        <li>callback: fn(carousel)</li>
        <li>callbackBreak: boolean</li>
      </ul>
    `
  }
];

// --- Bootstrap ------------------------------------------------------

let addCount = 0;
const CAROUSEL_ID = 'main-carousel';

// Inject panels into DOM
panelData.forEach((p) => {
  const figure = document.createElement('figure');
  figure.style.backgroundColor = p.bg;
  figure.innerHTML = `
    <div class="panther-Carousel-panelTitleBar">
      <span class="panther-Carousel-panelTitle">${p.title}</span>
    </div>
    <div class="panther-Carousel-panelContent">${p.content}</div>
  `;
  document.getElementById(CAROUSEL_ID).appendChild(figure);
});

// --- Hash / Deep-link Support ----------------------------------------
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

// --- Initialize carousel ---------------------------------------------

const carousel = Panther.Carousel.init({
  id: CAROUSEL_ID,
  backgroundColor: '#1c1c1c',
  callback: onCarouselChange,
});

buildIndicator();
buildJumpButtons();
updateInfoBar();

requestAnimationFrame(panelFromHash);
window.addEventListener('hashchange', panelFromHash);

// --- Callback --------------------------------------------------------

function onCarouselChange(c) {
  const panel = Math.round(c.sideIndex % c.panelCount) + 1;
  updateInfoBar();
  updateIndicator(c.sideIndex % c.panelCount);
  updateHash(panel);
  logEvent(`Rotated to panel ${panel} of ${c.panelCount}`);
}

// --- Controls --------------------------------------------------------

function nextPanel() {
  Panther.Carousel.turnNext(CAROUSEL_ID);
}

function prevPanel() {
  Panther.Carousel.turnPrev(CAROUSEL_ID);
}

function gotoPanel(n) {
  Panther.Carousel.turnTo(CAROUSEL_ID, n);
  logEvent(`Jumped to panel ${n}`);
}

function addNewPanel() {
  addCount++;
  const labels  = ['EXTRA', 'BONUS', 'PLUS', 'MORE', 'NEW'];
  const accents = ['p-accent-orange', 'p-accent-teal', 'p-accent-blue', 'p-accent-green', 'p-accent-purple'];
  const accent  = accents[addCount % accents.length];
  const lbl     = labels[addCount % labels.length] + ' ' + addCount;
  const c       = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;

  c.addPanel(lbl, `
    <div class="panel-accent ${accent}"></div>
    <div style="padding:14px;color:#999;font-size:0.8rem;line-height:1.8;">
      <p style="color:#ccc;font-family:'Syne',sans-serif;font-size:0.9rem;margin-bottom:8px;font-weight:700;">${lbl}</p>
      <p>Dynamically injected panel #${addCount}. New panels are automatically positioned in 3D space by recalculating the polygon geometry.</p>
    </div>
    <ul>
      <li>Panel index: ${panelData.length + addCount}</li>
      <li>Added at: ${new Date().toLocaleTimeString()}</li>
      <li>Geometry auto-recalculated</li>
    </ul>
  `);

  buildJumpButtons();
  buildIndicator();
  updateInfoBar();
  logEvent(`Panel "${lbl}" added (total: ${c.panelCount})`, true);
}

function removeLastPanel() {
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;
  if (c.panelCount <= 3) {
    logEvent('Cannot remove — minimum of 3 panels required.');
    return;
  }
  const removed = Panther.Carousel.removeLastPanel(CAROUSEL_ID);
  if (removed) {
    buildJumpButtons();
    buildIndicator();
    updateInfoBar();
    logEvent(`Last panel removed (total: ${c.panelCount})`);
  }
}

function setEasing(value) {
  Panther.Carousel.setEasing(CAROUSEL_ID, value);
  const sel = document.getElementById('easing-select');
  logEvent(`Easing: ${sel.options[sel.selectedIndex].text}`);
}

// --- UI Helpers ------------------------------------------------------

function buildJumpButtons() {
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;
  const row = document.getElementById('jump-btn-row');
  row.innerHTML = '';
  for (let i = 1; i <= c.panelCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'side-btn';
    btn.textContent = i;
    btn.onclick = () => gotoPanel(i);
    row.appendChild(btn);
  }
}

function buildIndicator() {
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;
  const box = document.getElementById('indicator');
  box.innerHTML = '';
  for (let i = 0; i < c.panelCount; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.style.cursor = 'pointer';
    d.onclick = () => gotoPanel(i + 1);
    box.appendChild(d);
  }
}

function updateIndicator(index) {
  const dots = document.querySelectorAll('#indicator .dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === index % dots.length));
}

function updateInfoBar() {
  const c = Panther.Carousel.all[CAROUSEL_ID];
  if (!c) return;
  document.getElementById('info-side').textContent     = Math.round(c.sideIndex % c.panelCount) + 1;
  document.getElementById('info-count').textContent    = c.panelCount;
  document.getElementById('info-rotation').textContent = Math.round(c.rotation) + '°';
}

function logEvent(msg, highlight = false) {
  const box   = document.getElementById('log-box');
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (highlight ? ' highlight' : '');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 30) box.removeChild(box.firstChild);
}

// --- Keyboard Shortcuts -----------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') nextPanel();
  if (e.key === 'ArrowLeft')  prevPanel();
  if (e.key === 'ArrowUp')    { Panther.Carousel.maximize(CAROUSEL_ID); logEvent('Maximized'); }
  if (e.key === 'ArrowDown')  { Panther.Carousel.restore(CAROUSEL_ID);  logEvent('Restored');  }
  if (e.key >= '1' && e.key <= '9') gotoPanel(parseInt(e.key));
});

logEvent('Carousel initialized with 5 panels', true);
