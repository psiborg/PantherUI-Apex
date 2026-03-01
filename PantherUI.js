/**
 * PantherUI.js
 * A 3D carousel UI component library
 *
 * Original by Jim Ing (@jim_ing) for BlackBerry Limited (2013–2014)
 * Refactored to modern ES6+ (2026)
 *
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// --- Core Namespace ----------------------------------------------------------

const Panther = (() => {
  const core = {
    version: '2.0.0',
    init(elem) {
      console.info('[Panther] Initialized 🐆');
    },
  };
  return core;
})();


// --- Carousel3D Class --------------------------------------------------------

class Carousel3D {
  /**
   * @param {HTMLElement} el - The carousel DOM element
   */
  constructor(el) {
    if (!(el instanceof HTMLElement)) {
      throw new TypeError('[Carousel3D] el must be a valid HTMLElement');
    }

    this.element      = el;
    this.rotation     = 0;
    this.panelCount   = el.children.length;
    this.theta        = 0;
    this.radius       = 0;
    this.panelSize    = 0;

    // Configurable options
    this.backgroundColor = 'rgb(209, 209, 209)';
    this.id              = '';
    this.prevSideIndex   = null;
    this.sideIndex       = 0;
    this.maximized       = false;
    this.prevStyle       = {};
    this.callback        = null;
    this.callbackBreak   = false;
    // Drag sensitivity multiplier: 1.0 = one full panel-width to rotate one face.
    // Values > 1 mean less distance required (more sensitive).
    this.sensitivity     = 1.0;
  }

  /**
   * Recalculate geometry and re-position all panels.
   */
  modify() {
    this.panelCount = this.element.children.length;

    if (this.panelCount < 3) {
      console.error('[Carousel3D] A 3D carousel requires at least 3 panels.');
      return;
    }

    this.panelSize = this.element.offsetWidth;
    this.theta     = 360 / this.panelCount;

    // Trigonometry: inscribed polygon radius
    this.radius = Math.round((this.panelSize / 2) / Math.tan(Math.PI / this.panelCount));

    for (let i = 0; i < this.panelCount; i++) {
      const panel     = this.element.children[i];
      const transform = `rotateY(${this.theta * i}deg) translateZ(${this.radius}px)`;

      panel.style.opacity   = '1';
      panel.style.transform = transform;

      // Only apply the library default backgroundColor if the panel does not
      // already have an inline background-color (i.e. static HTML with its own styling).
      if (!panel.style.backgroundColor) {
        panel.style.backgroundColor = this.backgroundColor;
      }
    }

    // Snap rotation to nearest flat face
    this.rotation = Math.round(this.rotation / this.theta) * this.theta;
    this.transform();
  }

  /**
   * Apply the current rotation to the carousel element.
   */
  transform() {
    this.element.style.transform = `translateZ(-${this.radius}px) rotateY(${this.rotation}deg)`;

    this.prevSideIndex = this.sideIndex;

    // Determine which face is currently facing forward
    const n = Math.abs(Math.ceil(this.rotation / 360)) + 1;
    if (this.rotation <= 0) {
      this.sideIndex = Math.abs(this.panelCount - (n * this.panelCount) - (this.rotation / this.theta));
    } else {
      this.sideIndex = Math.abs((n * this.panelCount) - (this.rotation / this.theta));
    }

    if (this.callback && !this.callbackBreak) {
      this.callback(this);
    }
  }

  /**
   * Rotate to a specific panel by 1-based index.
   * @param {number} side - 1-based panel index
   */
  turn(side) {
    if (side < 1 || side > this.panelCount) {
      console.warn(`[Carousel3D] "${this.id}" does not have a side ${side}.`);
      return;
    }
    const angle    = 360 / this.panelCount;
    this.rotation  = -(angle * side - angle);
    this.transform();
  }

  /**
   * Dynamically add a new panel.
   * @param {string} title   - Panel title text
   * @param {string} content - Panel inner HTML
   */
  addPanel(title, content) {
    const figure = document.createElement('figure');
    figure.innerHTML = `
      <div class="panther-Carousel-panelTitleBar">
        <span class="panther-Carousel-panelTitle">${title}</span>
      </div>
      <div class="panther-Carousel-panelContent">${content}</div>
    `;
    this.element.appendChild(figure);
    Panther.Carousel.refresh();
  }

  /**
   * Remove the last panel. Enforces a minimum of 3 panels.
   * @returns {boolean} true if removed, false if at minimum
   */
  removePanel() {
    if (this.element.children.length <= 3) {
      console.warn('[Carousel3D] Cannot remove: minimum of 3 panels required.');
      return false;
    }
    this.element.removeChild(this.element.lastElementChild);
    // If rotation now points beyond the last panel, snap back to panel 1
    this.rotation = Math.round(this.rotation / this.theta) * this.theta;
    Panther.Carousel.refresh();
    return true;
  }
}


// --- Panther.Carousel Module -------------------------------------------------

Panther.Carousel = (() => {
  /** Registry of all active Carousel3D instances, keyed by element ID */
  const all = {};

  // -- Drag / Swipe Input System -------------------------------------------
  //
  // Uses the Pointer Events API (unified mouse + touch + stylus).
  // setPointerCapture keeps the drag live even if the pointer leaves the element.
  //
  // Behaviour:
  //   pointerdown  → record start state, disable CSS transition for live tracking
  //   pointermove  → convert pixel delta → rotation degrees, apply immediately
  //   pointerup    → measure flick velocity, pick snap direction, re-enable transition
  //
  // Pixel-to-degrees mapping:
  //   dragging the full panel width (panelSize px) rotates exactly one face (theta°)

  /** Per-carousel drag state */
  function makeDragState() {
    return {
      active:        false,  // pointer is currently down
      didDrag:       false,  // moved more than the deadzone
      startX:        0,
      startRotation: 0,
      lastX:         0,
      lastT:         0,      // timestamp of last pointermove (ms)
      velocity:      0,      // deg/ms at release
    };
  }

  /**
   * Apply a raw (non-snapped) rotation without firing the callback or
   * updating sideIndex — used during live drag.
   */
  function applyRawRotation(c, deg) {
    c.element.style.transform = `translateZ(-${c.radius}px) rotateY(${deg}deg)`;
  }

  /**
   * Snap c.rotation to the nearest face, re-enable transition, fire callback.
   */
  function snapToFace(c) {
    c.element.classList.remove('is-dragging');
    c.rotation = Math.round(c.rotation / c.theta) * c.theta;
    c.transform(); // updates sideIndex, fires callback, applies transition
  }

  /**
   * Attach Pointer Event listeners to a carousel element.
   * Drag is intentionally allowed anywhere on the carousel (not just the title bar)
   * but the maximize button is excluded via a small click-vs-drag heuristic.
   */
  /**
   * Attach a direct click listener to every maximize button inside a carousel.
   * Called once at init (for pre-existing panels) and after every addPanel().
   * Direct listeners bypass the 3D hit-testing ambiguity that prevents click
   * events from bubbling reliably through preserve-3d subtrees to the container.
   */
  function addPointerListeners(elem, c) {
    const drag = makeDragState();

    // -- Pointer Down ------------------------------------------------------
    elem.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;

      drag.active        = true;
      drag.didDrag       = false;
      drag.startX        = ev.clientX;
      drag.lastX         = ev.clientX;
      drag.lastT         = ev.timeStamp;
      drag.startRotation = c.rotation;
      drag.velocity      = 0;

      elem.setPointerCapture(ev.pointerId);
    });

    // -- Pointer Move ------------------------------------------------------
    elem.addEventListener('pointermove', (ev) => {
      if (!drag.active) return;

      const dx = ev.clientX - drag.startX;

      // Deadzone: ignore tiny movements so clicks still work
      if (!drag.didDrag && Math.abs(dx) < 6) return;
      drag.didDrag = true;

      // Disable CSS transition so the carousel tracks the pointer in real-time
      if (!c.element.classList.contains('is-dragging')) {
        c.element.classList.add('is-dragging');
      }

      // Convert pixel delta → degrees, scaled by sensitivity.
      // Positive dx (drag right) → positive rotateY → face follows finger.
      const rawRotation = drag.startRotation + dx * (c.theta / c.panelSize) * c.sensitivity;
      applyRawRotation(c, rawRotation);
      c.rotation = rawRotation;

      // Track instantaneous velocity (deg/ms) using last two frames
      const dt = ev.timeStamp - drag.lastT;
      if (dt > 0) {
        drag.velocity = (ev.clientX - drag.lastX) * (c.theta / c.panelSize) * c.sensitivity / dt;
      }
      drag.lastX = ev.clientX;
      drag.lastT = ev.timeStamp;
    });

    // -- Pointer Up / Cancel -----------------------------------------------
    const onRelease = (ev) => {
      if (!drag.active) return;
      drag.active = false;

      if (!drag.didDrag) {
        c.element.classList.remove('is-dragging');
        return;
      }

      // Flick / momentum: if the pointer was moving fast at release,
      // carry it one extra panel in the same direction.
      const FLICK_THRESHOLD = 0.3; // deg/ms
      if (Math.abs(drag.velocity) > FLICK_THRESHOLD) {
        c.rotation += drag.velocity > 0 ? c.theta : -c.theta;
      }

      snapToFace(c);
    };

    elem.addEventListener('pointerup',     onRelease);
    elem.addEventListener('pointercancel', onRelease);
  }

  // -- Debounce Utility ----------------------------------------------------

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // -- Easings --------------------------------------------------------------

  /**
   * Named easing presets for snap transitions.
   * Values are valid CSS <time> + <easing-function> strings used as
   * the --panther-transition custom property.
   */
  const EASINGS = {
    'ease':              '750ms ease',
    'linear':            '750ms linear',
    'easeIn':            '750ms ease-in',
    'easeOut':           '750ms ease-out',
    'easeInOut':         '750ms ease-in-out',
    'easeInOutSine':     '750ms cubic-bezier(0.45, 0, 0.55, 1)',
    'easeInOutCubic':    '750ms cubic-bezier(0.65, 0, 0.35, 1)',
    'easeInOutQuart':    '750ms cubic-bezier(0.76, 0, 0.24, 1)',
    'easeInOutQuint':    '750ms cubic-bezier(0.87, 0, 0.13, 1)',
    'easeOutBack':       '750ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    'easeOutExpo':       '400ms cubic-bezier(0.16, 1, 0.3, 1)',
    'easeInOutBack':     '1100ms cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  };

  /**
   * Resolve an easing value: accepts a named key from EASINGS or a raw
   * CSS transition string (e.g. "500ms ease-in-out").
   * @param {string} easing
   * @returns {string} CSS transition value
   */
  function resolveEasing(easing) {
    return EASINGS[easing] ?? easing;
  }

  /**
   * Apply an easing to a carousel's container element as a scoped
   * CSS custom property, overriding the stylesheet default.
   * @param {string} carouselId
   * @param {string} easing - named key or raw CSS transition string
   */
  function setEasing(carouselId, easing) {
    const c = all[carouselId];
    if (!c) return;
    const container = c.element.parentElement;
    container.style.setProperty('--panther-transition', resolveEasing(easing));
  }

  // -- Public API -----------------------------------------------------------

  /**
   * Initialize a carousel.
   * @param {Object} opts
   * @param {string}   opts.id               - ID of the carousel element
   * @param {string}   [opts.backgroundColor]
   * @param {string}   [opts.easing]         - Named easing key or raw CSS transition string
   * @param {Function} [opts.callback]
   * @returns {Carousel3D|null}
   */
  function init(opts = {}) {
    if (!opts.id) {
      console.error('[Panther.Carousel] init() requires opts.id');
      return null;
    }

    const el = document.getElementById(opts.id);
    if (!el) {
      console.error(`[Panther.Carousel] Element "#${opts.id}" not found.`);
      return null;
    }

    const c = new Carousel3D(el);

    // Apply options (excluding easing which is handled separately)
    const { easing, ...carouselOpts } = opts;
    Object.assign(c, carouselOpts);

    c.modify();

    all[opts.id] = c;

    // Apply easing to container as a scoped CSS custom property
    if (easing) setEasing(opts.id, easing);

    const container = el.parentElement;
    addPointerListeners(container, c);

    // Refresh on orientation change or window resize
    window.addEventListener('orientationchange', refresh);
    window.addEventListener('resize', debounce(refresh, 250));

    return c;
  }

  /** Recalculate geometry for all carousels (e.g. after resize). */
  function refresh() {
    Object.values(all).forEach(c => c.modify());
  }

  /**
   * Rotate a carousel to the next panel.
   * @param {string} carouselId
   */
  function turnNext(carouselId) {
    const c = all[carouselId];
    if (!c) return;
    c.rotation -= c.theta;
    c.transform();
  }

  /**
   * Rotate a carousel to the previous panel.
   * @param {string} carouselId
   */
  function turnPrev(carouselId) {
    const c = all[carouselId];
    if (!c) return;
    c.rotation += c.theta;
    c.transform();
  }

  /**
   * Rotate one or more carousels to a specific panel.
   * @param {string|string[]} carouselId - ID or array of IDs
   * @param {number}          side       - 1-based panel index
   * @param {Function}        [callback]
   */
  function turnTo(carouselId, side, callback) {
    const ids = Array.isArray(carouselId) ? carouselId : [carouselId];

    ids.forEach(cid => {
      const c = all[cid];
      if (!c) {
        console.warn(`[Panther.Carousel] "${cid}" does not exist.`);
        return;
      }
      c.turn(side);
      callback?.(cid, side);
    });
  }

  /**
   * Remove the last panel from a carousel.
   * @param {string} carouselId
   * @returns {boolean}
   */
  function removeLastPanel(carouselId) {
    const c = all[carouselId];
    if (!c) return false;
    return c.removePanel();
  }

  /**
   * Maximize a carousel's container to fill the viewport.
   * @param {string} carouselId
   */
  function maximize(carouselId) {
    const c = all[carouselId];
    if (!c || c.maximized) return;
    const container = c.element.parentElement;

    c.prevStyle = {
      top:    container.style.top,
      left:   container.style.left,
      width:  container.style.width,
      height: container.style.height,
      zIndex: container.style.zIndex,
    };

    // Hide sibling carousels
    Object.keys(all).forEach(id => {
      if (id !== carouselId) document.getElementById(id).style.display = 'none';
    });

    Object.assign(container.style, { top: '0', left: '0', width: '100%', height: '100%', zIndex: '200' });
    c.maximized = true;
    refresh();
  }

  /**
   * Restore a maximized carousel to its original size.
   * @param {string} carouselId
   */
  function restore(carouselId) {
    const c = all[carouselId];
    if (!c || !c.maximized) return;
    const container = c.element.parentElement;

    Object.assign(container.style, c.prevStyle);

    Object.keys(all).forEach(id => {
      document.getElementById(id).style.display = '';
    });

    c.maximized = false;
    refresh();
  }

  /**
   * Set drag sensitivity for all carousels.
   * @param {number} value - Multiplier: 1.0 = default, 2.0 = twice as sensitive
   */
  function setSensitivity(value) {
    const s = Math.max(0.5, Math.min(5.0, value));
    Object.values(all).forEach(c => { c.sensitivity = s; });
  }

  /**
   * Set the snap-transition easing for all carousels at once.
   * @param {string} easing - Named key from EASINGS or raw CSS transition string
   */
  function setAllEasings(easing) {
    Object.keys(all).forEach(cid => setEasing(cid, easing));
  }

  return { init, refresh, turnNext, turnPrev, turnTo, maximize, restore, setEasing, setAllEasings, setSensitivity, EASINGS, removeLastPanel, all };
})();
