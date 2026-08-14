import {
  addStroke,
  clearBoard,
  createBoardState,
  deserializeBoard,
  redo,
  serializeBoard,
  strokeWidth,
  undo,
} from "./board-model.js";

const STORAGE_KEY = "sergio-canvas-document-v1";
const GRID_KEY = "sergio-canvas-grid-v1";
const SAVE_DELAY_MS = 180;

const canvas = document.querySelector("#drawing-canvas");
const boardWrap = document.querySelector("#board-wrap");
const context = canvas.getContext("2d", { alpha: true });
const emptyState = document.querySelector("#empty-state");
const boardTip = document.querySelector("#board-tip");
const saveStatus = document.querySelector("#save-status");
const toolButtons = [...document.querySelectorAll("[data-tool]")];
const swatches = [...document.querySelectorAll("[data-color]")];
const customColor = document.querySelector("#custom-color");
const customColorLabel = customColor.closest("label");
const colorControls = document.querySelector("#color-controls");
const sizeInput = document.querySelector("#stroke-size");
const sizeOutput = document.querySelector("#size-output");
const undoButton = document.querySelector("#undo-button");
const redoButton = document.querySelector("#redo-button");
const clearButton = document.querySelector("#clear-button");
const clearDialog = document.querySelector("#clear-dialog");
const confirmClear = document.querySelector("#confirm-clear");
const gridButton = document.querySelector("#grid-button");
const exportButton = document.querySelector("#export-button");

const state = createBoardState(deserializeBoard(localStorage.getItem(STORAGE_KEY)));
let activeTool = "pen";
let activeColor = "#1d1d1f";
let activeStroke = null;
let saveTimer = null;
let logicalWidth = 1;
let logicalHeight = 1;
let gridVisible = localStorage.getItem(GRID_KEY) !== "false";

boardWrap.classList.toggle("show-grid", gridVisible);
gridButton.setAttribute("aria-pressed", String(gridVisible));
canvas.dataset.tool = activeTool;

function resizeCanvas() {
  const rect = boardWrap.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
  logicalWidth = Math.max(1, rect.width);
  logicalHeight = Math.max(1, rect.height);
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  render();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure: event.pointerType === "mouse" ? 0.5 : (event.pressure || 0.5),
  };
}

function startStroke(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);

  activeStroke = {
    tool: activeTool,
    color: activeColor,
    size: activeTool === "eraser" ? Math.max(18, Number(sizeInput.value) * 2.5) : Number(sizeInput.value),
    pressureSensitive: event.pointerType === "pen" && activeTool === "pen",
    points: [pointFromEvent(event)],
  };

  emptyState.classList.add("hidden");
  boardTip.classList.add("hidden");
  render();
}

function continueStroke(event) {
  if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
  event.preventDefault();

  const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  for (const sample of events) {
    const point = pointFromEvent(sample);
    const previous = activeStroke.points[activeStroke.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.4) {
      activeStroke.points.push(point);
    }
  }
  render();
}

function finishStroke(event) {
  if (!activeStroke) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  addStroke(state, activeStroke);
  activeStroke = null;
  persistSoon();
  updateControls();
  render();
}

function cancelStroke(event) {
  if (!activeStroke) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  activeStroke = null;
  render();
  updateControls();
}

function render() {
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  for (const stroke of state.strokes) drawStroke(context, stroke);
  if (activeStroke) drawStroke(context, activeStroke);
}

function drawStroke(targetContext, stroke) {
  if (!stroke.points.length) return;

  targetContext.save();
  targetContext.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  targetContext.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;
  targetContext.lineCap = "round";
  targetContext.lineJoin = "round";

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    targetContext.beginPath();
    targetContext.arc(point.x, point.y, strokeWidth(stroke, point.pressure) / 2, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
    return;
  }

  if (!stroke.pressureSensitive) {
    targetContext.lineWidth = strokeWidth(stroke);
    targetContext.beginPath();
    targetContext.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      targetContext.lineTo(stroke.points[index].x, stroke.points[index].y);
    }
    targetContext.stroke();
    targetContext.restore();
    return;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1];
    const current = stroke.points[index];
    targetContext.lineWidth = strokeWidth(stroke, (previous.pressure + current.pressure) / 2);
    targetContext.beginPath();
    targetContext.moveTo(previous.x, previous.y);
    targetContext.lineTo(current.x, current.y);
    targetContext.stroke();
  }
  targetContext.restore();
}

function selectTool(tool) {
  activeTool = tool;
  canvas.dataset.tool = tool;
  for (const button of toolButtons) {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  colorControls.toggleAttribute("inert", tool === "eraser");
  colorControls.style.opacity = tool === "eraser" ? "0.42" : "1";
}

function selectColor(color, source = null) {
  activeColor = color;
  for (const swatch of swatches) {
    const selected = source === swatch;
    swatch.classList.toggle("selected", selected);
    swatch.setAttribute("aria-checked", String(selected));
  }
  customColorLabel.classList.toggle("selected", source === customColorLabel);
  if (activeTool === "eraser") selectTool("pen");
}

function performUndo() {
  if (!undo(state)) return;
  persistSoon();
  updateControls();
  render();
}

function performRedo() {
  if (!redo(state)) return;
  persistSoon();
  updateControls();
  render();
}

function updateControls() {
  undoButton.disabled = state.undoStack.length === 0;
  redoButton.disabled = state.redoStack.length === 0;
  clearButton.disabled = state.strokes.length === 0;
  emptyState.classList.toggle("hidden", state.strokes.length > 0 || Boolean(activeStroke));
}

function persistSoon() {
  saveStatus.textContent = "Saving…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeBoard(state.strokes));
      saveStatus.textContent = "Saved locally";
    } catch {
      saveStatus.textContent = "Storage is full";
    }
  }, SAVE_DELAY_MS);
}

function exportPng() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const exportCanvas = document.createElement("canvas");
  const inkCanvas = document.createElement("canvas");
  exportCanvas.width = Math.round(logicalWidth * ratio);
  exportCanvas.height = Math.round(logicalHeight * ratio);
  inkCanvas.width = exportCanvas.width;
  inkCanvas.height = exportCanvas.height;
  const exportContext = exportCanvas.getContext("2d");
  const inkContext = inkCanvas.getContext("2d");
  exportContext.scale(ratio, ratio);
  inkContext.scale(ratio, ratio);
  exportContext.fillStyle = "#ffffff";
  exportContext.fillRect(0, 0, logicalWidth, logicalHeight);

  if (gridVisible) {
    exportContext.fillStyle = "rgba(110, 110, 115, 0.22)";
    for (let x = 0; x < logicalWidth; x += 24) {
      for (let y = 0; y < logicalHeight; y += 24) {
        exportContext.beginPath();
        exportContext.arc(x, y, 1, 0, Math.PI * 2);
        exportContext.fill();
      }
    }
  }

  for (const stroke of state.strokes) drawStroke(inkContext, stroke);
  exportContext.drawImage(inkCanvas, 0, 0, logicalWidth, logicalHeight);

  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.download = `canvas-${date}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

canvas.addEventListener("pointerdown", startStroke);
canvas.addEventListener("pointermove", continueStroke);
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", cancelStroke);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

for (const button of toolButtons) {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
}

for (const swatch of swatches) {
  swatch.addEventListener("click", () => selectColor(swatch.dataset.color, swatch));
}

customColor.addEventListener("input", () => selectColor(customColor.value, customColorLabel));
sizeInput.addEventListener("input", () => {
  sizeOutput.value = sizeInput.value;
});

undoButton.addEventListener("click", performUndo);
redoButton.addEventListener("click", performRedo);
clearButton.addEventListener("click", () => clearDialog.showModal());
confirmClear.addEventListener("click", () => {
  if (!clearBoard(state)) return;
  persistSoon();
  updateControls();
  render();
});

gridButton.addEventListener("click", () => {
  gridVisible = !gridVisible;
  boardWrap.classList.toggle("show-grid", gridVisible);
  gridButton.setAttribute("aria-pressed", String(gridVisible));
  localStorage.setItem(GRID_KEY, String(gridVisible));
});

exportButton.addEventListener("click", exportPng);

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type !== "range") return;

  const commandKey = event.metaKey || event.ctrlKey;
  if (commandKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) performRedo();
    else performUndo();
    return;
  }

  if (commandKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    performRedo();
    return;
  }

  if (!commandKey && !event.altKey) {
    const toolShortcuts = { p: "pen", h: "highlighter", e: "eraser" };
    const tool = toolShortcuts[event.key.toLowerCase()];
    if (tool) selectTool(tool);
  }
});

new ResizeObserver(resizeCanvas).observe(boardWrap);
updateControls();
resizeCanvas();
