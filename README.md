# PantherUI — 3D Carousel

![PantherUI Screenshot](screenshot.png)

A GPU-accelerated, CSS `preserve-3d` carousel component. Panels are arranged as faces of a geometric prism and rotate smoothly in 3D space. Supports drag, flick, touch, keyboard, and programmatic control.

Originally created by Jim Ing for BlackBerry Limited (2013–2014). Improved and refactored to modern ES6+ (2026).

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

## Files

| File | Description |
|---|---|
| `PantherUI.js` | Library — include this on every page |
| `PantherUI.css` | Library styles — include this on every page |
| `demo.html` | Full demo with sidebar controls, event log, and easing selector |
| `demo.css` | Styles for the full demo page |
| `demo.js` | JavaScript for the full demo page |
| `demo-basic.html` | Minimal demo — static HTML panels, stage only |
| `demo-basic.css` | Styles for the basic demo page |
| `demo-basic.js` | JavaScript for the basic demo page |

---

## Quick Start

### Option A — Static HTML panels

Define your panels as `<figure>` elements directly in the markup. No JavaScript panel injection required. Suitable for slideshows and static content.

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="PantherUI.css" />
  <link rel="stylesheet" href="your-styles.css" />
</head>
<body>

  <div class="panther-Carousel-container" id="my-container"
       style="position:absolute; top:5%; left:5%; width:90%; height:90%;">
    <div class="panther-Carousel-carousel" id="my-carousel">

      <figure style="background-color:#1c1c1c;">
        <div class="panther-Carousel-panelTitleBar">
          <span class="panther-Carousel-panelTitle">Slide One</span>
        </div>
        <div class="panther-Carousel-panelContent">
          <p>Your content here.</p>
        </div>
      </figure>

      <figure style="background-color:#1a2626;">
        <div class="panther-Carousel-panelTitleBar">
          <span class="panther-Carousel-panelTitle">Slide Two</span>
        </div>
        <div class="panther-Carousel-panelContent">
          <p>More content.</p>
        </div>
      </figure>

      <figure style="background-color:#1a1c26;">
        <div class="panther-Carousel-panelTitleBar">
          <span class="panther-Carousel-panelTitle">Slide Three</span>
        </div>
        <div class="panther-Carousel-panelContent">
          <p>And more.</p>
        </div>
      </figure>

    </div>
  </div>

  <script src="PantherUI.js"></script>
  <script>
    Panther.Carousel.init({ id: 'my-carousel' });
  </script>
</body>
</html>
```

> **Minimum 3 panels required.** The geometry is undefined for fewer than 3 faces.

### Option B — Dynamic JS injection

Inject panels programmatically using `addPanel()` before or after init.

```js
Panther.Carousel.init({ id: 'my-carousel' });

const c = Panther.Carousel.all['my-carousel'];
c.addPanel('New Slide', '<p>Dynamically added content.</p>');
```

---

## HTML Structure

The library expects this two-level container structure:

```html
<!-- Outer container: sets position, size, and perspective -->
<div class="panther-Carousel-container" id="my-container"
     style="position:absolute; top:…; left:…; width:…; height:…;">

  <!-- Inner carousel: the rotating 3D element (use as the init id) -->
  <div class="panther-Carousel-carousel" id="my-carousel">

    <!-- Each panel is a <figure> -->
    <figure>
      <div class="panther-Carousel-panelTitleBar">
        <span class="panther-Carousel-panelTitle">Title</span>
      </div>
      <div class="panther-Carousel-panelContent">
        <!-- your content -->
      </div>
    </figure>

  </div>
</div>
```

The container's parent element should have `overflow: hidden` to clip panels that extend outside the viewport during rotation. Putting `overflow: hidden` on the container itself will clip the hit areas of side-facing panels and break interaction.

---

## API Reference

### `Panther.Carousel.init(opts)` → `Carousel3D`

Initializes a carousel. Returns the `Carousel3D` instance.

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | *(required)* | ID of the `.panther-Carousel-carousel` element |
| `backgroundColor` | `string` | `'rgb(209,209,209)'` | Fallback panel background. Only applied to panels that don't already have an inline `background-color`. |
| `easing` | `string` | `'ease'` | Snap transition easing. Accepts a named key (see [Easings](#easings)) or any raw CSS `<time> <easing-function>` string such as `'500ms ease-in-out'`. |
| `callback` | `function` | `null` | Called after every rotation with the `Carousel3D` instance as the argument. |
| `callbackBreak` | `boolean` | `false` | Set to `true` to temporarily suppress the callback. |

```js
Panther.Carousel.init({
  id: 'my-carousel',
  backgroundColor: '#1c1c1c',
  easing: 'easeOutBack',
  callback(c) {
    console.log('Now on panel', Math.round(c.sideIndex % c.panelCount) + 1);
  },
});
```

---

### Navigation

```js
Panther.Carousel.turnNext('my-carousel');        // rotate forward one panel
Panther.Carousel.turnPrev('my-carousel');        // rotate back one panel
Panther.Carousel.turnTo('my-carousel', 3);       // jump to panel 3 (1-based)

// turnTo also accepts an array of carousel IDs to move in sync:
Panther.Carousel.turnTo(['carousel-a', 'carousel-b'], 2);
```

---

### Panel Management

```js
const c = Panther.Carousel.all['my-carousel'];

c.addPanel('Title', '<p>HTML content</p>');  // append a new panel
Panther.Carousel.removeLastPanel('my-carousel'); // remove last panel (min 3)
```

---

### Maximize / Restore

Expands the carousel container to fill its positioned ancestor. Useful for focusing on a single panel.

```js
Panther.Carousel.maximize('my-carousel');
Panther.Carousel.restore('my-carousel');
```

---

### Easing

```js
// Set easing at init time:
Panther.Carousel.init({ id: 'my-carousel', easing: 'easeInOutCubic' });

// Change easing at runtime:
Panther.Carousel.setEasing('my-carousel', 'easeOutBack');

// Use a raw CSS string instead of a named key:
Panther.Carousel.setEasing('my-carousel', '400ms cubic-bezier(0.16, 1, 0.3, 1)');

// Inspect all named presets:
console.log(Panther.Carousel.EASINGS);
```

#### Easings

| Key | Duration | Character |
|---|---|---|
| `ease` | 750ms | Default browser ease (default) |
| `linear` | 750ms | Constant speed |
| `easeIn` | 750ms | Slow start |
| `easeOut` | 750ms | Slow end |
| `easeInOut` | 750ms | Slow start and end |
| `easeInOutSine` | 750ms | Gentle S-curve |
| `easeInOutCubic` | 750ms | Moderate S-curve |
| `easeInOutQuart` | 750ms | Strong S-curve |
| `easeInOutQuint` | 750ms | Very strong S-curve |
| `easeOutBack` | 750ms | Slight spring overshoot |
| `easeOutExpo` | 400ms | Fast and snappy |
| `easeInOutBack` | 1100ms | Bouncy overshoot both ends |

---

### Refresh

Call after externally resizing the container or changing panel count outside the API:

```js
Panther.Carousel.refresh();
```

---

### Instance Properties

After init, the `Carousel3D` instance is accessible via `Panther.Carousel.all`:

```js
const c = Panther.Carousel.all['my-carousel'];

c.panelCount   // number of panels
c.sideIndex    // current front-facing panel index (0-based, wraps)
c.rotation     // current rotation in degrees
c.theta        // angle between panels (360 / panelCount)
c.radius       // calculated polygon radius in px
c.maximized    // boolean — whether the carousel is currently maximized
```

---

## Interaction

### Drag / Flick

Drag anywhere on the carousel to rotate. The panel tracks the pointer 1:1. On release, a flick (fast swipe) carries rotation one extra panel in the drag direction. Momentum threshold: 0.3 deg/ms.

Powered by the [Pointer Events API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — works with mouse, touch, and stylus with a single code path.

### Keyboard (demo pages)

| Key | Action |
|---|---|
| `←` / `→` | Rotate to previous / next panel |
| `↑` | Maximize |
| `↓` | Restore |
| `1`–`9` | Jump to panel by number |

---

## CSS Custom Properties

Override these on `:root` or on a specific container to theme the carousel:

| Property | Default | Description |
|---|---|---|
| `--panther-bg` | `#4a4a4a` | Container background color |
| `--panther-panel-bg` | `#d1d1d1` | Default panel background |
| `--panther-titlebar-bg` | `#1a1a1a` | Title bar background |
| `--panther-titlebar-color` | `#ffffff` | Title bar text color |
| `--panther-titlebar-height` | `14mm` | Height of the title bar |
| `--panther-accent` | `#cc3f10` | Accent color |
| `--panther-perspective` | `1050px` | CSS perspective depth |
| `--panther-transition` | `750ms ease` | Snap animation (overridden by `easing` option) |
| `--panther-radius` | `10px` | Panel border radius |

---

## Geometry

Each panel is placed using inscribed polygon trigonometry:

```
θ  = 360° / panelCount          (angle between panels)
r  = (panelWidth / 2) / tan(π / panelCount)   (polygon radius)

panel[i].transform = rotateY(θ × i) translateZ(r)
carousel.transform = translateZ(-r) rotateY(currentRotation)
```

Geometry recalculates automatically on `resize` (debounced 250ms) and `orientationchange`.
