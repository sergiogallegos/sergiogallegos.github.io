import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './styles.css';
import { RobotModel } from './robot-model.js';
import { HOME_ANGLES, JOINT_LIMITS, RobotEngine } from './robot-engine.js';
import { formatJointProgram, forwardKinematics, MODEL_UNIT_MM } from './kinematics.js';
import {
  DRAW_SQUARE_POINTS, DROP_POSITION, evaluateGripperAction, PICK_POSITION, distanceToTarget, generateReachableTarget,
  squareDrawingScore, starterCodeForPickAndPlace, starterCodeForSquare, starterCodeForTarget, TARGET_TOLERANCE_MM,
} from './challenges.js';
import { createCodeEditor } from './code-editor.js';
import { DEFAULT_PROGRAM, errorLineFromMessage, PROGRAM_STORAGE_KEY, safeProgramFilename, STARTER_PROGRAMS } from './programs.js';
import { PythonRunner } from './python-runner.js';
import { validateRobotCommands } from './robot-command-validator.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf5f5f7, 0.045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(6.2, 4.1, 6.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewport.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.85, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c5bd, 2.7));
const keyLight = new THREE.DirectionalLight(0xffdfbd, 5.3);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -5;
keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -2;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xaebfe0, 2.5);
rimLight.position.set(-5, 4, -4);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(7, 64),
  new THREE.MeshStandardMaterial({ color: 0xe8e8ed, roughness: 0.92, metalness: 0.03 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(12, 24, 0x86868b, 0xd2d2d7);
grid.position.y = 0.006;
grid.material.transparent = true;
grid.material.opacity = 0.48;
scene.add(grid);

const targetRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.05, 0.018, 8, 64),
  new THREE.MeshBasicMaterial({ color: 0x8f9dab, transparent: true, opacity: 0.5 }),
);
targetRing.rotation.x = Math.PI / 2;
targetRing.position.y = 0.012;
scene.add(targetRing);

const cartesianTarget = new THREE.Group();
const targetSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.055, 18, 18),
  new THREE.MeshBasicMaterial({ color: 0xe84e4e, depthTest: false }),
);
const targetHalo = new THREE.Mesh(
  new THREE.TorusGeometry(0.14, 0.012, 8, 36),
  new THREE.MeshBasicMaterial({ color: 0xe84e4e, transparent: true, opacity: 0.72, depthTest: false }),
);
targetHalo.rotation.x = Math.PI / 2;
cartesianTarget.add(targetSphere, targetHalo);
cartesianTarget.traverse((object) => { object.renderOrder = 5; });
scene.add(cartesianTarget);

const pickScene = new THREE.Group();
pickScene.visible = false;
scene.add(pickScene);
const cubeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.36, 0.36, 0.36),
  new THREE.MeshStandardMaterial({ color: 0x1687d9, roughness: 0.34, metalness: 0.08 }),
);
cubeMesh.castShadow = true;
cubeMesh.receiveShadow = true;
pickScene.add(cubeMesh);

const pedestalMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d9de, roughness: 0.82, metalness: 0.04 });
const pedestalHeight = PICK_POSITION.y / MODEL_UNIT_MM - 0.2;
for (const position of [PICK_POSITION, DROP_POSITION]) {
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, pedestalHeight, 32), pedestalMaterial);
  pedestal.position.set(position.x / MODEL_UNIT_MM, pedestalHeight / 2, position.z / MODEL_UNIT_MM);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  pickScene.add(pedestal);
}
const dropZone = new THREE.Mesh(
  new THREE.TorusGeometry(0.43, 0.035, 10, 48),
  new THREE.MeshBasicMaterial({ color: 0x248a3d, transparent: true, opacity: 0.82 }),
);
dropZone.rotation.x = Math.PI / 2;
dropZone.position.set(DROP_POSITION.x / MODEL_UNIT_MM, pedestalHeight + 0.015, DROP_POSITION.z / MODEL_UNIT_MM);
pickScene.add(dropZone);

const drawScene = new THREE.Group();
drawScene.visible = false;
scene.add(drawScene);
const drawingBoard = new THREE.Mesh(
  new THREE.BoxGeometry(1.7, 0.08, 1.7),
  new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.84, metalness: 0.02 }),
);
const drawingCenterZ = (DRAW_SQUARE_POINTS[0].z + DRAW_SQUARE_POINTS[2].z) / (2 * MODEL_UNIT_MM);
const drawingTableTop = DRAW_SQUARE_POINTS[0].y / MODEL_UNIT_MM;
drawingBoard.position.set(0, drawingTableTop - 0.06, drawingCenterZ);
drawingBoard.receiveShadow = true;
drawScene.add(drawingBoard);
const tableLegMaterial = new THREE.MeshStandardMaterial({ color: 0xb7b7bd, roughness: 0.7, metalness: 0.18 });
const tableLegHeight = drawingTableTop - 0.1;
for (const x of [-0.68, 0.68]) {
  for (const z of [drawingCenterZ - 0.68, drawingCenterZ + 0.68]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, tableLegHeight, 0.1), tableLegMaterial);
    leg.position.set(x, tableLegHeight / 2, z);
    leg.castShadow = true;
    drawScene.add(leg);
  }
}
const squareGuideGeometry = new THREE.BufferGeometry().setFromPoints(DRAW_SQUARE_POINTS.map((point) => new THREE.Vector3(
  point.x / MODEL_UNIT_MM, point.y / MODEL_UNIT_MM + 0.012, point.z / MODEL_UNIT_MM,
)));
const squareGuide = new THREE.Line(squareGuideGeometry, new THREE.LineDashedMaterial({ color: 0x8b6ce0, dashSize: 0.09, gapSize: 0.055 }));
squareGuide.computeLineDistances();
drawScene.add(squareGuide);
const trailGeometry = new THREE.BufferGeometry();
const trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0x6548ae, linewidth: 2 }));
trailLine.renderOrder = 6;
drawScene.add(trailLine);

function setTargetMarker(target, reachable = null) {
  cartesianTarget.position.set(
    target.x / MODEL_UNIT_MM,
    target.y / MODEL_UNIT_MM,
    target.z / MODEL_UNIT_MM,
  );
  const color = reachable === false ? 0xd49a25 : 0xe84e4e;
  targetSphere.material.color.setHex(color);
  targetHalo.material.color.setHex(color);
}

const robot = new RobotModel(scene);
robot.setGripperOpenAmount(1);
const movedJoints = new Set();
const sliders = [];
const values = [];
let currentAngles = [...HOME_ANGLES];
const activeJogSliders = new Set();
const pendingJogValues = new Map();
let jogFrame = null;
const STORAGE_KEY = 'roboplay.progress.v1';
let progress = loadProgress();
let activeChallenge = !progress.wakeComplete ? 'wake' : progress.touchCompleted === 0 ? 'touch' : !progress.pickComplete ? 'pick' : 'draw';
let challengeTarget = null;
let touchSuccessLocked = false;
let gripperOpen = true;
let holdingCube = false;
let cubePosition = { ...PICK_POSITION };
let pickSuccessLocked = false;
let penDown = false;
let trailPoints = [];
let drawSuccessLocked = false;
const challengeSelect = document.querySelector('#challenge-select');
const poseReadouts = {
  x: document.querySelector('#tcp-x'),
  y: document.querySelector('#tcp-y'),
  z: document.querySelector('#tcp-z'),
  roll: document.querySelector('#tcp-roll'),
  pitch: document.querySelector('#tcp-pitch'),
  yaw: document.querySelector('#tcp-yaw'),
};
const targetInputs = {
  x: document.querySelector('#target-x'),
  y: document.querySelector('#target-y'),
  z: document.querySelector('#target-z'),
};

function displayCartesianTarget(target, reachable) {
  if (activeChallenge === 'touch' && challengeTarget) {
    setTargetMarker(challengeTarget, reachable === false ? false : true);
  } else {
    setTargetMarker(target, reachable);
  }
}

const consoleElement = document.querySelector('#console');
function loadProgress() {
  try {
    return { wakeComplete: false, touchCompleted: 0, pickComplete: false, drawComplete: false, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { wakeComplete: false, touchCompleted: 0, pickComplete: false, drawComplete: false };
  }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Private browsing may block storage. */ }
}

function setCubePosition(position) {
  cubePosition = { x: position.x, y: position.y, z: position.z };
  cubeMesh.position.set(position.x / MODEL_UNIT_MM, position.y / MODEL_UNIT_MM, position.z / MODEL_UNIT_MM);
}

function setCubeStatus(text, state = '') {
  const badge = document.querySelector('#cube-status');
  badge.textContent = text;
  badge.className = `cube-status ${state}`.trim();
}

function resetPickObjects({ announce = false } = {}) {
  holdingCube = false;
  pickSuccessLocked = false;
  setCubePosition(PICK_POSITION);
  setCubeStatus('Cube ready');
  dropZone.material.color.setHex(0x248a3d);
  if (announce) log('Cube returned to its starting platform.');
}

function resetGripper() {
  gripperOpen = true;
  robot.setGripperOpenAmount(1);
  const button = document.querySelector('#gripper-button');
  button.textContent = 'Close gripper';
  button.setAttribute('aria-pressed', 'false');
}

function updateTrailGeometry() {
  trailGeometry.setFromPoints(trailPoints.map((point) => new THREE.Vector3(
    point.x / MODEL_UNIT_MM, point.y / MODEL_UNIT_MM + 0.018, point.z / MODEL_UNIT_MM,
  )));
  trailGeometry.computeBoundingSphere();
}

function updateDrawingStatus() {
  const score = squareDrawingScore(trailPoints);
  const badge = document.querySelector('#drawing-status');
  badge.textContent = `${Math.round(score.coverage * 100)}% covered`;
  badge.className = `cube-status ${score.complete ? 'placed' : penDown ? 'holding' : ''}`.trim();
  return score;
}

function recordTrailPoint(position) {
  const previous = trailPoints.at(-1);
  if (previous && distanceToTarget(previous, position) < 8) return;
  trailPoints.push({ x: position.x, y: position.y, z: position.z });
  updateTrailGeometry();
  updateDrawingStatus();
}

function resetPen() {
  penDown = false;
  robot.setPenDown(false);
  const button = document.querySelector('#pen-button');
  button.textContent = 'Pen down';
  button.setAttribute('aria-pressed', 'false');
}

function clearDrawing({ announce = false } = {}) {
  trailPoints = [];
  drawSuccessLocked = false;
  trailGeometry.setFromPoints([]);
  updateDrawingStatus();
  if (announce) log('Drawing cleared.');
}

function setPenState(down) {
  if (down === penDown) return;
  penDown = down;
  robot.setPenDown(down);
  const button = document.querySelector('#pen-button');
  button.textContent = down ? 'Pen up' : 'Pen down';
  button.setAttribute('aria-pressed', String(down));
  if (down) {
    recordTrailPoint(forwardKinematics(currentAngles).positionMm);
    if (activeChallenge === 'draw') log('Pen down — drawing started.');
    return;
  }

  if (activeChallenge !== 'draw') return;
  const score = updateDrawingStatus();
  log('Pen up — drawing stopped.');
  if (score.complete && !drawSuccessLocked) {
    drawSuccessLocked = true;
    progress.drawComplete = true;
    saveProgress();
    showSuccess('Square complete!', `You covered ${Math.round(score.coverage * 100)}% of the guide and closed the shape.`);
    log('Draw a Square complete!', 'success');
  } else if (!score.complete) {
    log(`Square is ${Math.round(score.coverage * 100)}% covered${score.closed ? '' : ' and the loop is still open'}. Keep trying!`, 'warning');
  }
}

function animateGripper(open) {
  if (open === gripperOpen) return Promise.resolve();
  const start = gripperOpen ? 1 : 0;
  const end = open ? 1 : 0;
  gripperOpen = open;
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const frame = (now) => {
      const progressAmount = Math.min(1, (now - startedAt) / 260);
      robot.setGripperOpenAmount(start + (end - start) * progressAmount);
      if (progressAmount < 1) return requestAnimationFrame(frame);

      const tcpPosition = forwardKinematics(currentAngles).positionMm;
      const outcome = evaluateGripperAction({ opening: open, holding: holdingCube, tcpPosition, cubePosition });
      holdingCube = outcome.holding;
      setCubePosition(outcome.cubePosition);
      const button = document.querySelector('#gripper-button');
      button.textContent = open ? 'Close gripper' : 'Open gripper';
      button.setAttribute('aria-pressed', String(!open));

      if (activeChallenge === 'pick') {
        if (outcome.event === 'picked') {
          setCubeStatus('Holding cube', 'holding');
          log('Cube picked up!', 'success');
        } else if (outcome.event === 'missed') {
          setCubeStatus('Move closer');
          log(`The gripper is ${Math.round(outcome.distanceMm)} mm from the cube. Move closer and try again.`, 'warning');
        } else if (outcome.event === 'released') {
          setCubeStatus('Cube released');
          log(`Cube released ${Math.round(outcome.distanceMm)} mm from the target.`, 'warning');
        } else if (outcome.event === 'placed' && !pickSuccessLocked) {
          pickSuccessLocked = true;
          progress.pickComplete = true;
          saveProgress();
          setCubeStatus('Placed!', 'placed');
          dropZone.material.color.setHex(0x16a05d);
          showSuccess('Perfect placement!', 'You picked up the cube and delivered it to the green target.');
          log('Pick and Place complete!', 'success');
          setTimeout(() => { if (activeChallenge === 'pick') activateDrawChallenge(); }, 1600);
        }
      }
      resolve();
    };
    requestAnimationFrame(frame);
  });
}

setCubePosition(PICK_POSITION);

function log(message, kind = '') {
  const line = document.createElement('div');
  line.className = `console-line ${kind}`;
  line.textContent = message;
  consoleElement.append(line);
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

function readSavedProgram() {
  try { return localStorage.getItem(PROGRAM_STORAGE_KEY) || DEFAULT_PROGRAM; } catch { return DEFAULT_PROGRAM; }
}

const saveStatus = document.querySelector('#save-status');
let autosaveTimer = null;
function persistProgram(code) {
  try {
    localStorage.setItem(PROGRAM_STORAGE_KEY, code);
    saveStatus.textContent = 'Saved locally';
    saveStatus.classList.remove('saving');
  } catch {
    saveStatus.textContent = 'Local save unavailable';
    saveStatus.classList.remove('saving');
  }
}

const editor = createCodeEditor({
  parent: document.querySelector('#code-editor'),
  initialValue: readSavedProgram(),
  onChange: (code) => {
    saveStatus.textContent = 'Saving…';
    saveStatus.classList.add('saving');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => persistProgram(code), 500);
  },
});

function replaceProgram(code, message) {
  const current = editor.getValue();
  if (current.trim() && current !== code && !window.confirm('Replace the current program? It is saved locally, but this will become the new active program.')) return false;
  editor.setValue(code);
  editor.focus();
  if (message) log(message);
  return true;
}

const starterSelect = document.querySelector('#starter-program-select');
Object.entries(STARTER_PROGRAMS).forEach(([id, program]) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = program.name;
  starterSelect.append(option);
});

starterSelect.addEventListener('change', () => {
  const id = starterSelect.value;
  const program = STARTER_PROGRAMS[id];
  const code = id === 'cartesian' && activeChallenge === 'touch' && challengeTarget
    ? starterCodeForTarget(challengeTarget)
    : program?.code;
  if (program && code) replaceProgram(code, `Loaded starter program: ${program.name}.`);
  starterSelect.value = '';
});

document.querySelector('#new-program-button').addEventListener('click', () => {
  replaceProgram('# New RoboPlay program\n', 'Started a new program.');
});
document.querySelector('#open-program-button').addEventListener('click', () => document.querySelector('#program-file-input').click());
document.querySelector('#program-file-input').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  if (file.size > 256 * 1024) return log('That program is larger than the 256 KB import limit.', 'warning');
  try {
    const code = await file.text();
    replaceProgram(code, `Opened ${file.name}.`);
  } catch {
    log('The selected program could not be read.', 'warning');
  }
});
document.querySelector('#save-program-button').addEventListener('click', () => {
  const blob = new Blob([editor.getValue()], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeProgramFilename('roboplay-program');
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  log('Program exported as a .py file.', 'success');
});
window.addEventListener('pagehide', () => persistProgram(editor.getValue()));

let editorMode = 'python';
let blocksEditor = null;
let blocksModule = null;
const pythonPanel = document.querySelector('#python-editor-panel');
const blocksPanel = document.querySelector('#blocks-editor-panel');
const pythonTab = document.querySelector('#python-tab');
const blocksTab = document.querySelector('#blocks-tab');

function readSavedBlocks() {
  try {
    const value = localStorage.getItem('roboplay.blocks.v1');
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function persistBlocks(state) {
  try {
    localStorage.setItem('roboplay.blocks.v1', JSON.stringify(state));
    saveStatus.textContent = 'Blocks saved locally';
    saveStatus.classList.remove('saving');
  } catch {
    saveStatus.textContent = 'Local save unavailable';
    saveStatus.classList.remove('saving');
  }
}

async function ensureBlocksEditor() {
  if (blocksEditor) return blocksEditor;
  saveStatus.textContent = 'Loading blocks…';
  const loading = document.querySelector('#blockly-loading');
  const workspaceElement = document.querySelector('#blockly-workspace');
  loading.hidden = false;
  blocksModule = await import('./blocks-editor.js');
  const starterSelect = document.querySelector('#starter-blocks-select');
  Object.entries(blocksModule.BLOCK_STARTERS).forEach(([id, program]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = program.name;
    starterSelect.append(option);
  });
  blocksEditor = blocksModule.createBlocksEditor({
    parent: workspaceElement,
    preview: document.querySelector('#generated-python'),
    initialState: readSavedBlocks(),
    onChange: (state) => {
      saveStatus.textContent = 'Saving blocks…';
      saveStatus.classList.add('saving');
      persistBlocks(state);
    },
  });
  loading.hidden = true;
  blocksEditor.resize();
  saveStatus.textContent = 'Blocks saved locally';
  return blocksEditor;
}

async function switchEditorMode(mode) {
  if (mode === 'blocks') {
    editorMode = 'blocks';
    pythonPanel.hidden = true;
    blocksPanel.hidden = false;
    pythonTab.classList.remove('active');
    pythonTab.setAttribute('aria-selected', 'false');
    blocksTab.classList.add('active');
    blocksTab.setAttribute('aria-selected', 'true');
    try {
      const instance = await ensureBlocksEditor();
      requestAnimationFrame(() => instance.resize());
    } catch (error) {
      log(`Visual blocks could not load: ${error.message}`, 'warning');
      document.querySelector('#blockly-loading').textContent = 'Visual blocks could not load. Refresh and try again.';
    }
  } else {
    editorMode = 'python';
    blocksPanel.hidden = true;
    pythonPanel.hidden = false;
    blocksTab.classList.remove('active');
    blocksTab.setAttribute('aria-selected', 'false');
    pythonTab.classList.add('active');
    pythonTab.setAttribute('aria-selected', 'true');
    saveStatus.textContent = 'Saved locally';
    requestAnimationFrame(() => editor.focus());
  }
}

pythonTab.addEventListener('click', () => switchEditorMode('python'));
blocksTab.addEventListener('click', () => switchEditorMode('blocks'));

function confirmBlocksReplacement() {
  return window.confirm('Replace the current block program? Its last version is saved locally.');
}

document.querySelector('#new-blocks-button').addEventListener('click', async () => {
  const instance = await ensureBlocksEditor();
  if (confirmBlocksReplacement()) {
    instance.clear();
    log('Started a new block program.');
  }
});
document.querySelector('#open-blocks-button').addEventListener('click', () => document.querySelector('#blocks-file-input').click());
document.querySelector('#blocks-file-input').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  if (file.size > 512 * 1024) return log('That block project is larger than the 512 KB import limit.', 'warning');
  try {
    const instance = await ensureBlocksEditor();
    const state = blocksModule.parseBlocksFile(await file.text());
    if (confirmBlocksReplacement()) {
      instance.setState(state);
      log(`Opened ${file.name}.`);
    }
  } catch (error) {
    log(`The block project could not be opened: ${error.message}`, 'warning');
  }
});
document.querySelector('#save-blocks-button').addEventListener('click', async () => {
  const instance = await ensureBlocksEditor();
  const blob = new Blob([JSON.stringify(instance.getState(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'roboplay-blocks.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  log('Block program exported.', 'success');
});
document.querySelector('#starter-blocks-select').addEventListener('change', async (event) => {
  const id = event.target.value;
  const program = blocksModule?.BLOCK_STARTERS[id];
  event.target.value = '';
  if (!program) return;
  const instance = await ensureBlocksEditor();
  if (confirmBlocksReplacement()) {
    const state = structuredClone(program.state);
    if (id === 'target' && activeChallenge === 'touch' && challengeTarget) {
      state.blocks.blocks[0].next.block.fields = { X: challengeTarget.x, Y: challengeTarget.y, Z: challengeTarget.z };
    }
    instance.setState(state);
    log(`Loaded starter blocks: ${program.name}.`);
  }
});

function setStatus(status) {
  const busy = status !== 'Ready';
  document.querySelector('#robot-status').textContent = status;
  document.querySelector('#status-light').classList.toggle('running', busy);
  document.querySelector('#run-button').disabled = busy;
  document.querySelector('#stop-button').disabled = !busy;
  document.querySelector('#move-target-button').disabled = busy;
  document.querySelector('#dock-home-button').disabled = busy;
  document.querySelector('#gripper-button').disabled = busy;
  document.querySelector('#pen-button').disabled = busy;
  document.querySelector('#reset-objects-button').disabled = busy;
  document.querySelector('#clear-drawing-button').disabled = busy;
  challengeSelect.disabled = busy;
  document.querySelector('#load-challenge-starter').disabled = busy;
  sliders.forEach((slider) => { slider.disabled = busy; });
}

function updateChallenge(index) {
  if (activeChallenge !== 'wake') return;
  const previousSize = movedJoints.size;
  movedJoints.add(index);
  if (movedJoints.size === previousSize) return;
  const count = movedJoints.size;
  document.querySelector('#challenge-count').textContent = `${count} / 6`;
  document.querySelector('#challenge-progress').style.width = `${(count / 6) * 100}%`;
  if (count === 6) {
    progress.wakeComplete = true;
    saveProgress();
    showSuccess('Robot awake!', 'Challenge 02 unlocked: Touch the Target.');
    log('Challenge complete — all six joints are awake!', 'success');
    setTimeout(() => { if (activeChallenge === 'wake') activateTouchChallenge(); }, 1300);
  }
}

function showSuccess(title, message) {
  document.querySelector('#success-title').textContent = title;
  document.querySelector('#success-message').textContent = message;
  document.querySelector('#success-card').hidden = false;
}

function setChallengeTarget(target) {
  challengeTarget = target;
  touchSuccessLocked = false;
  Object.entries(targetInputs).forEach(([axis, input]) => { input.value = target[axis]; });
  setTargetMarker(target, true);
  document.querySelector('#challenge-hint').hidden = true;
  document.querySelector('#success-card').hidden = true;
  const pose = forwardKinematics(currentAngles).positionMm;
  updateTouchDistance(pose);
}

function prepareChallenge(challenge) {
  activeChallenge = challenge;
  challengeSelect.value = challenge;
  cartesianTarget.visible = false;
  pickScene.visible = false;
  drawScene.visible = false;
  document.querySelector('#challenge-summary').hidden = true;
  document.querySelector('#touch-challenge-tools').hidden = true;
  document.querySelector('#pick-challenge-tools').hidden = true;
  document.querySelector('#draw-challenge-tools').hidden = true;
  document.querySelector('#success-card').hidden = true;
  resetPen();
  resetGripper();
  resetPickObjects();
}

function activateWakeChallenge() {
  prepareChallenge('wake');
  movedJoints.clear();
  const summary = document.querySelector('#challenge-summary');
  summary.hidden = false;
  document.querySelector('#challenge-label').textContent = 'CHALLENGE 01';
  document.querySelector('#challenge-title').textContent = 'Wake up the robot';
  document.querySelector('#challenge-description').textContent = 'Move every joint at least once. Use the controls or run the starter program.';
  document.querySelector('#challenge-count').textContent = '0 / 6';
  document.querySelector('#challenge-progress').style.width = '0%';
  log('Challenge 01 ready — move all six joints.', 'success');
}

function activateTouchChallenge() {
  prepareChallenge('touch');
  cartesianTarget.visible = true;
  document.querySelector('#challenge-label').textContent = 'CHALLENGE 02';
  document.querySelector('#challenge-title').textContent = 'Touch the target';
  document.querySelector('#challenge-description').textContent = 'Program the tool tip to enter the red target. Get within 25 mm to succeed.';
  document.querySelector('#touch-challenge-tools').hidden = false;
  document.querySelector('#challenge-progress').style.width = '0%';
  document.querySelector('#challenge-count').textContent = `${progress.touchCompleted} hit${progress.touchCompleted === 1 ? '' : 's'}`;
  setChallengeTarget(generateReachableTarget());
  log('Challenge 02 ready — touch the red target.', 'success');
}

function activatePickChallenge() {
  prepareChallenge('pick');
  document.querySelector('#pick-challenge-tools').hidden = false;
  pickScene.visible = true;
  log('Challenge 03 ready — pick up the blue cube and place it in the green ring.', 'success');
}

function activateDrawChallenge() {
  prepareChallenge('draw');
  document.querySelector('#draw-challenge-tools').hidden = false;
  drawScene.visible = true;
  clearDrawing();
  log('Challenge 04 ready — trace the purple square with the pen down.', 'success');
}

function updateTouchDistance(position) {
  if (activeChallenge !== 'touch' || !challengeTarget) return;
  const distance = distanceToTarget(position, challengeTarget);
  document.querySelector('#target-distance').textContent = `${Math.round(distance)} mm`;
  document.querySelector('#challenge-progress').style.width = `${Math.max(0, 100 - Math.min(100, distance / 8))}%`;
  if (distance <= TARGET_TOLERANCE_MM && !touchSuccessLocked) {
    touchSuccessLocked = true;
    progress.touchCompleted += 1;
    saveProgress();
    document.querySelector('#challenge-count').textContent = `${progress.touchCompleted} hit${progress.touchCompleted === 1 ? '' : 's'}`;
    document.querySelector('#challenge-progress').style.width = '100%';
    showSuccess('Target touched!', `You reached it with ${distance.toFixed(1)} mm error.`);
    log(`Touch the Target complete — ${distance.toFixed(1)} mm from center.`, 'success');
    targetSphere.material.color.setHex(0x20a877);
    targetHalo.material.color.setHex(0x20a877);
    setTimeout(() => { if (activeChallenge === 'touch') activatePickChallenge(); }, 1600);
  }
}

const engine = new RobotEngine({
  onUpdate: (angles, pose) => {
    currentAngles = angles;
    robot.setAngles(angles);
    if (holdingCube) setCubePosition(pose.positionMm);
    if (penDown) recordTrailPoint(pose.positionMm);
    const clean = (value) => Math.abs(value) < 0.05 ? 0 : value;
    poseReadouts.x.textContent = clean(pose.positionMm.x).toFixed(1);
    poseReadouts.y.textContent = clean(pose.positionMm.y).toFixed(1);
    poseReadouts.z.textContent = clean(pose.positionMm.z).toFixed(1);
    poseReadouts.roll.textContent = `${clean(pose.orientation.roll).toFixed(1)}°`;
    poseReadouts.pitch.textContent = `${clean(pose.orientation.pitch).toFixed(1)}°`;
    poseReadouts.yaw.textContent = `${clean(pose.orientation.yaw).toFixed(1)}°`;
    updateTouchDistance(pose.positionMm);
    angles.forEach((angle, index) => {
      if (!sliders[index]) return;
      if (!activeJogSliders.has(index)) sliders[index].value = angle;
      values[index].textContent = `${Number(angle.toFixed(1))}°`;
    });
  },
  onStatus: setStatus,
  onLog: log,
  onJointMoved: updateChallenge,
  onCartesianTarget: displayCartesianTarget,
  onGripper: animateGripper,
  onPen: setPenState,
});

const controlsContainer = document.querySelector('#joint-controls');
JOINT_LIMITS.forEach(([min, max], index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'joint-control';
  const label = document.createElement('label');
  label.htmlFor = `joint-${index + 1}`;
  label.innerHTML = `<span>Joint ${index + 1}</span><span class="joint-value">${HOME_ANGLES[index]}°</span>`;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = `joint-${index + 1}`;
  slider.min = min;
  slider.max = max;
  slider.step = '0.1';
  slider.value = HOME_ANGLES[index];
  slider.setAttribute('aria-label', `Joint ${index + 1} angle`);
  slider.addEventListener('pointerdown', () => activeJogSliders.add(index));
  const finishJog = () => activeJogSliders.delete(index);
  slider.addEventListener('pointerup', finishJog);
  slider.addEventListener('pointercancel', finishJog);
  slider.addEventListener('blur', finishJog);
  slider.addEventListener('input', () => {
    const nextValue = Number(slider.value);
    values[index].textContent = `${Number(nextValue.toFixed(1))}°`;
    pendingJogValues.set(index, nextValue);
    if (jogFrame !== null) return;
    jogFrame = requestAnimationFrame(() => {
      pendingJogValues.forEach((degrees, jointIndex) => engine.setJointImmediate(jointIndex, degrees));
      pendingJogValues.clear();
      jogFrame = null;
    });
  });
  wrapper.append(label, slider);
  controlsContainer.append(wrapper);
  sliders.push(slider);
  values.push(label.querySelector('.joint-value'));
});

const pythonRunner = new PythonRunner({ onOutput: log, onStatus: setStatus });

document.querySelector('#run-button').addEventListener('click', async () => {
  try {
    editor.clearError();
    const code = editorMode === 'blocks'
      ? (await ensureBlocksEditor()).getCode()
      : editor.getValue();
    if (!code.trim()) throw new Error('Add some Python or blocks before running.');
    setStatus('Loading Python');
    log('Starting Python. The first run may take a moment…');
    const commands = validateRobotCommands(await pythonRunner.run(code));
    log(`Python complete. Queued ${commands.length} robot command${commands.length === 1 ? '' : 's'}.`);
    if (commands.length) await engine.run(commands);
    else {
      setStatus('Ready');
      log('Program complete.', 'success');
    }
  } catch (error) {
    setStatus('Ready');
    if (error.name === 'AbortError') return;
    if (editorMode === 'python') editor.highlightErrorLine(errorLineFromMessage(error.message));
    log(error.message, 'warning');
  }
});
document.querySelector('#stop-button').addEventListener('click', () => {
  const stoppedPython = pythonRunner.stop();
  engine.stop();
  setStatus('Ready');
  if (stoppedPython) log('Python program stopped. The interpreter will restart on the next run.', 'warning');
});
document.querySelector('#dock-home-button').addEventListener('click', () => engine.run([{ type: 'HOME' }]));
document.querySelector('#gripper-button').addEventListener('click', () => {
  engine.run([{ type: 'GRIPPER', open: !gripperOpen }]);
});
document.querySelector('#pen-button').addEventListener('click', () => {
  engine.run([{ type: 'PEN', down: !penDown }]);
});
document.querySelector('#reset-button').addEventListener('click', () => {
  engine.reset();
  resetGripper();
  resetPen();
  movedJoints.clear();
  if (activeChallenge === 'wake') {
    document.querySelector('#challenge-count').textContent = '0 / 6';
    document.querySelector('#challenge-progress').style.width = '0%';
  } else if (activeChallenge === 'touch' && challengeTarget) updateTouchDistance(forwardKinematics(HOME_ANGLES).positionMm);
  else if (activeChallenge === 'pick') resetPickObjects();
  else if (activeChallenge === 'draw') clearDrawing();
  document.querySelector('#success-card').hidden = true;
  log('Robot and challenge reset.');
});
document.querySelector('#clear-console').addEventListener('click', () => { consoleElement.textContent = ''; });
function readTargetInputs() {
  const target = Object.fromEntries(Object.entries(targetInputs).map(([axis, input]) => [axis, Number(input.value)]));
  if (Object.values(target).some((value) => !Number.isFinite(value))) {
    log('Enter a valid number for X, Y, and Z.', 'warning');
    return null;
  }
  return target;
}
Object.values(targetInputs).forEach((input) => input.addEventListener('input', () => {
  const target = readTargetInputs();
  if (target && activeChallenge !== 'touch') setTargetMarker(target);
}));
document.querySelector('#move-target-button').addEventListener('click', () => {
  const target = readTargetInputs();
  if (target) engine.run([{ type: 'MOVE_TO', ...target }]);
});
document.querySelector('#use-tcp-button').addEventListener('click', () => {
  const pose = forwardKinematics(currentAngles).positionMm;
  Object.entries(targetInputs).forEach(([axis, input]) => { input.value = Math.round(pose[axis]); });
  setTargetMarker(pose, true);
  log('Cartesian target set to the current TCP position.');
});
const jogDockTab = document.querySelector('#jog-dock-tab');
const cartesianDockTab = document.querySelector('#cartesian-dock-tab');
const jogDockPanel = document.querySelector('#jog-dock-panel');
const cartesianDockPanel = document.querySelector('#cartesian-dock-panel');
function switchDock(mode) {
  const cartesian = mode === 'cartesian';
  jogDockPanel.hidden = cartesian;
  cartesianDockPanel.hidden = !cartesian;
  jogDockTab.classList.toggle('active', !cartesian);
  cartesianDockTab.classList.toggle('active', cartesian);
  jogDockTab.setAttribute('aria-selected', String(!cartesian));
  cartesianDockTab.setAttribute('aria-selected', String(cartesian));
}
jogDockTab.addEventListener('click', () => switchDock('jog'));
cartesianDockTab.addEventListener('click', () => switchDock('cartesian'));
document.querySelector('#new-target-button').addEventListener('click', () => {
  setChallengeTarget(generateReachableTarget());
  log('A new reachable target is ready.');
});
document.querySelector('#reset-objects-button').addEventListener('click', () => resetPickObjects({ announce: true }));
document.querySelector('#clear-drawing-button').addEventListener('click', () => {
  resetPen();
  clearDrawing({ announce: true });
});

async function loadChallengeStarter(challenge = activeChallenge) {
  if (editorMode === 'blocks') {
    const instance = await ensureBlocksEditor();
    const blockStarter = challenge === 'wake' ? 'wake' : challenge === 'touch' ? 'target' : challenge === 'pick' ? 'pick' : 'square';
    const state = structuredClone(blocksModule.BLOCK_STARTERS[blockStarter].state);
    if (challenge === 'touch') {
      const moveBlock = state.blocks.blocks[0].next.block;
      moveBlock.fields = { X: challengeTarget.x, Y: challengeTarget.y, Z: challengeTarget.z };
    }
    if (confirmBlocksReplacement()) {
      instance.setState(state);
      log('Challenge starter blocks added. Press Run program when you are ready.');
    }
    return;
  }
  const code = challenge === 'wake'
    ? STARTER_PROGRAMS.wake.code
    : challenge === 'touch'
      ? starterCodeForTarget(challengeTarget)
      : challenge === 'pick'
        ? starterCodeForPickAndPlace()
        : starterCodeForSquare();
  replaceProgram(code, 'Challenge starter added. Press Run program when you are ready.');
}

document.querySelector('#pick-starter-button').addEventListener('click', () => loadChallengeStarter('pick'));
document.querySelector('#draw-starter-button').addEventListener('click', () => loadChallengeStarter('draw'));
document.querySelector('#hint-button').addEventListener('click', () => {
  const hint = document.querySelector('#challenge-hint');
  hint.textContent = editorMode === 'blocks'
    ? `Use the “move tool to” block with X ${challengeTarget.x}, Y ${challengeTarget.y}, Z ${challengeTarget.z}.`
    : `Try robot.move_to(${challengeTarget.x}, ${challengeTarget.y}, ${challengeTarget.z})`;
  hint.hidden = false;
});
document.querySelector('#starter-code-button').addEventListener('click', async () => {
  await loadChallengeStarter('touch');
});

const challengeActivators = {
  wake: activateWakeChallenge,
  touch: activateTouchChallenge,
  pick: activatePickChallenge,
  draw: activateDrawChallenge,
};
challengeSelect.addEventListener('change', () => {
  engine.stop();
  setStatus('Ready');
  challengeActivators[challengeSelect.value]?.();
});
document.querySelector('#load-challenge-starter').addEventListener('click', () => loadChallengeStarter(challengeSelect.value));
document.querySelector('#axes-toggle').addEventListener('click', (event) => {
  const visible = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  event.currentTarget.classList.toggle('active', visible);
  robot.setAxesVisible(visible);
  log(`Joint axes ${visible ? 'shown' : 'hidden'}.`);
});
document.querySelector('#copy-pose').addEventListener('click', async () => {
  const program = formatJointProgram(currentAngles);
  try {
    await navigator.clipboard.writeText(program);
    log('Current joint pose copied as six commands.', 'success');
  } catch {
    log('Clipboard access was unavailable. Run the site on localhost and try again.', 'warning');
  }
});

const cameraViews = {
  front: new THREE.Vector3(0, 3.3, 8.2),
  iso: new THREE.Vector3(6.2, 4.1, 6.6),
  top: new THREE.Vector3(0.01, 9.5, 0.01),
};
document.querySelectorAll('[data-camera]').forEach((button) => {
  button.addEventListener('click', () => {
    camera.position.copy(cameraViews[button.dataset.camera]);
    controls.target.set(0, 1.85, 0);
    controls.update();
    document.querySelectorAll('[data-camera]').forEach((item) => item.classList.toggle('active', item === button));
  });
});

const helpDialog = document.querySelector('#help-dialog');
document.querySelector('#help-button').addEventListener('click', () => helpDialog.showModal());
document.querySelector('#close-help').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

function resize() {
  const { clientWidth, clientHeight } = viewport;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
resize();
animate();
setTargetMarker({ x: -300, y: 1870, z: 280 });
if (activeChallenge === 'wake') activateWakeChallenge();
else if (activeChallenge === 'touch') activateTouchChallenge();
else if (activeChallenge === 'pick') activatePickChallenge();
else if (activeChallenge === 'draw') activateDrawChallenge();
log('Robot ready. Move a joint or run the starter program.', 'success');

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.add('app-ready');
    window.setTimeout(() => document.querySelector('#app-loader')?.remove(), 260);
  });
});
