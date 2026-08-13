# RoboPlay — Architecture, Design, and Project Status

**Status date:** August 13, 2026

**Repository:** `sergiogallegos.github.io`

**Application path:** `/roboplay/`

**Deployment model:** Static, client-side web application

## 1. Product Summary

RoboPlay is an educational browser-based simulator for programming a six-axis industrial robot. It is designed as a playful introduction to robotics and coding for students, children, parents, and teachers while preserving real concepts such as joint motion, Cartesian coordinates, forward kinematics, inverse kinematics, TCP position, grippers, and command sequencing.

Users can control the same robot through either real Python or visual Blockly programs. Both programming modes produce commands for one shared robot engine, so concepts and behavior remain consistent across the two interfaces.

RoboPlay runs entirely in the browser. It does not require a backend, database, account, or server-side storage.

## 2. Website Integration

RoboPlay is integrated into the portfolio as a first-party application rather than an external-looking embed.

- The portfolio homepage includes a featured RoboPlay project card linking to `roboplay/`.
- RoboPlay uses the portfolio's light visual language, typography, navigation, spacing, and restrained color palette.
- Portfolio navigation remains available from inside the simulator.
- The app is a standalone shareable route while remaining part of the same static website.
- Vite builds the app with relative asset paths and publishes the production entry and hashed assets directly under `/roboplay/` for branch-based GitHub Pages hosting.
- A loading screen prevents raw or partially styled HTML from flashing during startup.

The current integration is committed as source in this repository. No backend service or database needs to be deployed.

## 3. Current Application Architecture

```text
Portfolio website
└── /roboplay/
    ├── UI shell and responsive layout
    │   ├── 3D robot viewport
    │   ├── manual robot control dock
    │   ├── challenge selector and contextual controls
    │   ├── Python / Blocks programming panel
    │   └── shared output console
    ├── Robot engine
    │   ├── six-joint state and limits
    │   ├── command validation and queue execution
    │   ├── smooth joint interpolation
    │   ├── forward and inverse kinematics
    │   └── gripper and pen state
    ├── Programming runtimes
    │   ├── CodeMirror Python editor
    │   ├── Pyodide CPython Web Worker
    │   └── Blockly editor and Python generator
    ├── Challenge layer
    │   ├── Wake Up
    │   ├── Touch Target
    │   ├── Pick and Place
    │   └── Draw a Square
    └── Browser persistence
        ├── Python source
        ├── Blockly workspace
        └── challenge progress
```

### Shared command flow

```text
Python source ──> Pyodide worker ──┐
                                  ├──> validated command queue ──> robot engine ──> Three.js scene
Blockly blocks ──> generated Python┘
```

Pyodide executes in a Web Worker so Python does not block the rendering and interaction thread. Blockly is lazy-loaded only when the Blocks tab is opened. Both paths ultimately call the same kid-readable robot API.

## 4. Major Source Modules

| Module | Responsibility |
|---|---|
| `src/main.js` | Application bootstrap, Three.js scene, challenge orchestration, UI events, persistence, and editor coordination |
| `src/kinematics.js` | Six-axis kinematic chain, joint limits, forward kinematics, numerical inverse kinematics, and pose formatting |
| `src/robot-engine.js` | Robot state, smooth command execution, speed, waits, joint/Cartesian moves, gripper, and pen commands |
| `src/robot-model.js` | Primitive-mesh robot, articulated joints, TCP marker, axes, animated gripper fingers, and pen tip |
| `src/robot-command-validator.js` | Trust boundary between Python output and the robot engine |
| `src/pyodide-worker.mjs` | Real CPython runtime and the Python-facing `robot` object |
| `src/python-runner.js` | Web Worker lifecycle, output, completion, error handling, and hard stop behavior |
| `src/code-editor.js` | CodeMirror setup, Python highlighting, autocomplete, and error-line feedback |
| `src/blocks-editor.js` | Blockly toolbox, robot blocks, workspace persistence, starters, and Python generation |
| `src/block-code.js` | Small testable mapping from robot blocks to Python calls |
| `src/challenges.js` | Reachable targets, pickup/drop rules, drawing scoring, and challenge starter generation |
| `src/programs.js` | Default and named Python starter programs |
| `src/styles.css` | Portfolio-aligned light theme and responsive desktop/mobile layout |

## 5. Implemented Features

### Robot simulation

- Primitive-mesh six-axis articulated industrial robot.
- Enforced joint limits with friendly feedback.
- Smooth eased motion rather than instantaneous pose changes.
- Joint-space commands and position-based Cartesian commands.
- Forward kinematics with live TCP X/Y/Z and roll/pitch/yaw display.
- Damped numerical inverse kinematics with reachability feedback.
- Camera orbit, zoom, presets, optional joint axes, and copyable pose output.
- Manual joint jog controls and manual Cartesian target controls.

### Real Python

- Real CPython in the browser through Pyodide.
- Execution isolated in a Web Worker.
- Standard Python output through `print()` in the shared console.
- Python exceptions displayed with editor line highlighting where possible.
- Run, Stop, Reset, local autosave, import, export, and named starters.
- Current robot API:

```python
robot.move_joint(joint, degrees)
robot.move_joint_by(joint, degrees)
robot.move_to(x, y, z)
robot.home()
robot.set_speed(percent)
robot.wait(seconds)
robot.say(text)
robot.gripper(True)   # open
robot.gripper(False)  # close
robot.pen_down()
robot.pen_up()
```

### Visual Blocks

- Lazy-loaded Blockly workspace.
- Custom blocks matching the shared Python robot API.
- Loops, variables, numbers, text, and console printing.
- Live generated-Python preview.
- Workspace autosave, JSON import/export, and starter programs.
- Block picker closes after a block is selected, preserving program visibility.
- Loading placeholder and correctly sized responsive workspace.

### Challenges

1. **Wake Up** — move all six joints.
2. **Touch Target** — reach a generated, IK-validated target.
3. **Pick and Place** — pick up a blue cube and release it in a green destination zone.
4. **Draw a Square** — trace a forgiving square guide using pen commands.

The always-visible challenge selector allows users to switch freely. Selecting a challenge updates the complete room setup and active tooling:

- Wake Up shows a clean robot cell.
- Touch Target shows the Cartesian target and distance controls.
- Pick and Place shows the cube, platforms, drop zone, and gripper workflow.
- Draw a Square shows a realistic table in front of the robot, a dashed guide, pen tool, and trail.

Each challenge has a Python and Blocks starter available from the challenge control and from the regular starter-program lists.

### Responsive and mobile UX

- Desktop uses a roughly equal robot/programming split.
- Phones use a single-column layout.
- Manual controls are located over the robot viewport instead of consuming editor space.
- Buttons and tabs use touch-friendly heights on small screens.
- Tool controls wrap to avoid horizontal overflow.
- Blockly, console, editor, challenge selector, and room overlays adapt to narrow viewports.
- Interactions do not depend on hover.

### Persistence and privacy

- Programs, block workspaces, and challenge progress use browser `localStorage`.
- Python and block projects can be exported/imported as files.
- Nothing is uploaded to a server.
- No accounts, analytics dependency, backend API, or database are required for core operation.

## 6. Verification Status

At this status point:

- 28 automated tests pass.
- The Vite production build completes successfully.
- The local integrated site responds at `/roboplay/`.
- Tests cover kinematics, reachability, command validation, program helpers, Blockly-to-Python mappings, pickup/drop behavior, drawing scoring, and the robot's actual joint-interpolated square trajectory.

The build currently reports a non-failing large-chunk warning. Three.js/Pyodide-related application code and Blockly are substantial browser dependencies; Blockly is already split into a lazy-loaded chunk. Bundle and runtime performance should be measured on real lower-end phones before public launch.

## 7. Planned Next Work

### Priority 1 — Learn section

Add a dedicated, mobile-friendly Learn view containing:

- A short orientation to RoboPlay.
- Interactive explanation of joints 1–6.
- Blocks quick start.
- Python quick start.
- Blocks-to-Python comparisons.
- TCP and Cartesian-coordinate explanation.
- Full synchronized `robot.*` command reference.
- Challenge walkthroughs and troubleshooting.
- Parent/teacher learning outcomes and browser-only privacy note.

Where practical, the command reference should be generated from structured API metadata to prevent documentation drift.

### Priority 2 — Device and browser QA

- Test on real iOS Safari and Android Chrome devices.
- Test slower phones and constrained networks.
- Verify touch jogging, OrbitControls gestures, Blockly dragging, keyboard behavior, file import/export, and viewport resizing.
- Measure first paint, Three.js startup, Blockly lazy loading, and first Pyodide execution.
- Add browser smoke coverage for switching every challenge and running each starter.

### Priority 3 — Accessibility and UX hardening

- Full keyboard navigation audit.
- Screen-reader labels and live-status audit.
- Color contrast verification.
- Reduced-motion behavior for robot animations.
- Clear progress reset/replay controls.
- Better small-screen handling when the software keyboard is open.

### Priority 4 — Performance and offline resilience

- Review Vite chunking and dependency loading.
- Consider caching Pyodide assets through a service worker after deployment constraints are understood.
- Add an optional installable PWA experience.
- Profile trail rendering and long Blockly programs on mobile GPUs.

### Later feature candidates

- More challenge definitions and lesson progression.
- Gripper object varieties and stack-the-blocks challenge.
- Loops/conditionals challenge using sensors or predicates.
- Multiple drawing shapes.
- Optional English/Spanish interface.
- Improved geometric IK and orientation targets.
- Simplified collision detection and workspace warnings.
- Higher-fidelity glTF robot model after performance validation.
- Teacher lesson packs and downloadable activities.

## 8. Explicit Non-Goals for the Current Version

- Production-grade industrial robot programming.
- Physics-accurate dynamics, torque, or payload simulation.
- Multi-robot cells.
- PLC, fieldbus, or physical robot connectivity.
- Full mesh collision detection.
- Cloud accounts, shared databases, or server-side program storage.

## 9. Local Development

From `roboplay/`:

```powershell
npm install
npm run dev:site
```

The integrated portfolio is served by Vite. The editable RoboPlay source entry is:

```text
http://127.0.0.1:5173/roboplay/index.source.html
```

Verification commands:

```powershell
npm test
npm run build
```

`npm run build` performs the Vite production build and publishes the generated `index.html` and `assets/` into `roboplay/`. Those generated production files are intentionally committed because this repository's GitHub Pages site deploys directly from the `main` branch.

## 10. Deployment Notes

The application is ready to be deployed as static website source. Before describing it as fully production-tested, complete the real-device QA work above. Deployment does not require provisioning a backend or database. The primary external runtime consideration is the first-use Pyodide download when a user runs Python.
