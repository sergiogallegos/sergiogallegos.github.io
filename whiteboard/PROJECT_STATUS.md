# Canvas — Architecture, Design, and Project Status

**Status date:** August 13, 2026

**Repository:** `sergiogallegos.github.io`

**Application path:** `/whiteboard/`

**Deployment model:** Static, client-side web application

## 1. Product Summary

Canvas is a lightweight browser whiteboard designed for quick sketches, explanations, and handwritten thinking. It supports mouse, touch, and stylus input without requiring an account, application install, backend, or third-party drawing library.

The product intentionally occupies the space between a basic drawing canvas and a full diagram editor. The current version prioritizes instant access, natural input, a calm interface, and reliable local persistence over complex object manipulation or collaboration.

## 2. Current Product Status

Canvas is implemented as a complete first public version and is integrated into the portfolio homepage.

Current capabilities:

- Freehand drawing with mouse, finger, and Pointer Events-compatible styluses.
- Apple Pencil and active stylus pressure support when exposed by the browser.
- Pen, translucent highlighter, and eraser tools.
- Five curated colors plus a native custom color picker.
- Adjustable stroke size.
- Undo and redo for strokes and clear-board actions.
- Optional dot-grid background.
- Automatic local browser storage after edits.
- PNG export containing the current board and optional grid.
- Responsive desktop, tablet, and phone tool layouts.
- Keyboard shortcuts for tools and editing history.
- Accessible names, visible focus states, live save status, and reduced-motion support.

The application has no external runtime dependencies and no network requirement after the static assets are loaded.

## 3. Design Goals

### Immediate

The board is usable as soon as the page opens. There is no landing screen, onboarding sequence, or document setup flow between the user and the canvas.

### Tactile

The canvas uses browser Pointer Events, pointer capture, coalesced motion samples, rounded line joins, and device-pixel-ratio rendering. Pen pressure changes stroke width when a stylus reports pressure.

### Quiet

The visual system reuses the portfolio and RoboPlay language: white and soft-gray surfaces, Apple-style system typography, dark primary controls, restrained blue selection states, fine borders, and compact tool chrome. Controls stay discoverable without competing with the drawing.

### Private by default

Drawings remain in the browser's local storage. Canvas does not transmit drawings, analytics, or identity data to a server.

### Portable

The board exports a normal PNG file. A user's drawing is not trapped in a proprietary cloud document format.

## 4. Architecture

```text
Portfolio homepage
└── /whiteboard/
    ├── index.html
    │   ├── Semantic application shell
    │   ├── Drawing toolbar
    │   ├── Canvas workspace
    │   └── Clear confirmation dialog
    ├── styles.css
    │   ├── Desktop workspace layout
    │   ├── Tablet/mobile bottom toolbar
    │   └── Accessibility and safe-area behavior
    ├── src/
    │   ├── app.js
    │   │   ├── Pointer input controller
    │   │   ├── Canvas renderer
    │   │   ├── UI state synchronization
    │   │   ├── Persistence adapter
    │   │   └── PNG exporter
    │   └── board-model.js
    │       ├── Drawing document model
    │       ├── Command history
    │       ├── Storage validation
    │       └── Pressure-to-width calculation
    └── test/
        └── board-model.test.js
```

The application is separated into two layers:

1. `board-model.js` contains framework-independent document and history behavior. It does not access the DOM and can be tested directly with Node.
2. `app.js` translates browser input into strokes, renders the model, persists it, and keeps the interface synchronized.

## 5. Data and Rendering Design

### Stroke document

Each stroke records:

- Tool type: pen, highlighter, or eraser.
- Color and base size.
- Whether stylus pressure should affect width.
- An ordered sequence of logical canvas coordinates and pressure values.

Coordinates are stored in CSS pixels rather than physical display pixels. This keeps the document independent from the screen's pixel density while the renderer scales output for Retina and other high-density displays.

### Input pipeline

```text
Pointer down
    ↓
Capture pointer and create active stroke
    ↓
Collect coalesced movement samples
    ↓
Render committed strokes + active stroke
    ↓
Pointer up
    ↓
Commit command → update history → persist locally
```

One input path supports mouse, touch, and pen. The canvas uses `touch-action: none` only inside the drawing surface so touch gestures draw there instead of scrolling the page.

### Rendering

The visible canvas is transparent over a CSS-rendered paper and dot grid. Normal strokes use source-over compositing. Eraser strokes use destination-out compositing, removing prior ink without damaging the background.

The canvas backing buffer scales with `devicePixelRatio`, capped to avoid excessive memory use on very high-density devices. A `ResizeObserver` recreates the backing surface and replays the stroke document whenever the workspace changes size.

### History model

History uses reversible commands:

- An `add` command adds or removes one stroke.
- A `clear` command stores the previous stroke collection so clearing can be undone.

Creating a new edit after undo discards the redo branch, matching conventional editor behavior.

### Persistence

The current stroke document is serialized to versioned JSON in `localStorage`. Stored data is validated before use, including supported tool types, numeric bounds, and collection limits. Invalid or incompatible data is ignored safely.

## 6. Responsive and Input Design

### Desktop

- Shared Sergio Gallegos header, centered Canvas product identity, and portfolio section navigation.
- Persistent vertical toolbar on the left.
- Full export label in the top bar and a local-save status pill over the workspace.
- Large board fills the remaining viewport.

### Tablet and phone

- The shared header retains the portfolio name and Canvas product mark while collapsing secondary navigation.
- Toolbar moves below the canvas for thumb and Pencil access.
- Tool controls remain at least approximately 40 CSS pixels.
- Secondary color choices collapse on narrow screens while the custom picker remains available.
- Header and workspace respect iOS safe-area insets.
- The app locks document scrolling because the workspace itself fills the viewport.

### Keyboard controls

| Action | Shortcut |
| --- | --- |
| Pen | `P` |
| Highlighter | `H` |
| Eraser | `E` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` or `Ctrl + Y` |

## 7. Privacy and Security Boundaries

- No user account or authentication.
- No backend or database.
- No drawing uploads or network synchronization.
- No third-party JavaScript dependencies.
- No HTML is constructed from stored drawing data.
- Stored documents are versioned and structurally validated before rendering.
- PNG export is generated locally in the browser.

Local storage is device- and browser-specific. Clearing browser site data also clears the saved whiteboard document.

## 8. Verification Status

Automated model tests cover:

- Stroke addition, undo, and redo.
- Reversible clear operations.
- Redo-branch invalidation after a new edit.
- Storage serialization, validation, and invalid-data recovery.
- Stylus pressure width behavior.

The implementation has been checked for valid module syntax, resolvable local assets, a successful local HTTP response at `/whiteboard/`, and a clean Git whitespace diff. The following interactive browser checklist is defined for release QA:

- Application loading without console errors.
- Canvas drawing and control-state changes.
- Undo and redo interaction.
- Tool and color selection.
- Clear confirmation behavior.
- Desktop and narrow responsive layouts.
- Portfolio project-card navigation.

Automated in-app browser execution was unavailable in the current development session, so the interactive checklist above is pending rather than recorded as passed.

Real-device follow-up remains valuable for the exact feel of Apple Pencil pressure and long drawing sessions on iPadOS because desktop pointer emulation cannot reproduce hardware latency and pressure curves perfectly.

## 9. Explicit Non-Goals for the Current Version

- Real-time multiplayer collaboration.
- Cloud accounts or cross-device synchronization.
- Infinite-canvas pan and zoom.
- Selectable or movable vector objects.
- Text boxes, connectors, sticky notes, and shape libraries.
- Image or PDF import.
- Server-side document history.
- Compatibility with Excalidraw's proprietary document format.

## 10. Later Feature Candidates

- Line, arrow, rectangle, ellipse, and text tools.
- Lasso selection and object movement.
- Pinch-to-zoom and an infinite coordinate space.
- Multiple locally saved boards with titles.
- SVG export.
- Optional installable PWA support for offline launch.
- User-selectable paper styles such as ruled, graph, and blank.
- Optional palm-rejection mode that accepts pen input while ignoring touch.
- Shareable encrypted document links if a backend is introduced later.

## 11. Local Development

From the repository root, serve the static site with any local HTTP server. For example:

```powershell
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/whiteboard/
```

Run model tests from `whiteboard/`:

```powershell
npm test
```

No build step is required. The checked-in HTML, CSS, and JavaScript files are the production assets served by GitHub Pages.

## 12. Deployment Notes

Canvas is ready for static deployment at `/whiteboard/`. It relies only on browser-standard APIs: ES modules, Canvas 2D, Pointer Events, ResizeObserver, localStorage, native dialog, and PNG data URLs.

The architecture deliberately avoids a framework and package bundle for this feature size. If object selection, rich shapes, or collaborative editing become product requirements, reevaluate whether to adopt a specialized scene graph or whiteboard library rather than continuing to expand the raster stroke model.
