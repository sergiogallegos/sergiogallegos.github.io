export const STORAGE_VERSION = 1;

const TOOLS = new Set(["pen", "highlighter", "eraser"]);
const MAX_STROKES = 2000;
const MAX_POINTS_PER_STROKE = 20000;

export function createBoardState(strokes = []) {
  return {
    strokes,
    undoStack: [],
    redoStack: [],
  };
}

export function addStroke(state, stroke) {
  if (!isValidStroke(stroke) || stroke.points.length === 0) return false;

  state.strokes.push(stroke);
  state.undoStack.push({ type: "add", stroke });
  state.redoStack.length = 0;
  return true;
}

export function clearBoard(state) {
  if (state.strokes.length === 0) return false;

  const strokes = state.strokes.slice();
  state.strokes.length = 0;
  state.undoStack.push({ type: "clear", strokes });
  state.redoStack.length = 0;
  return true;
}

export function undo(state) {
  const command = state.undoStack.pop();
  if (!command) return false;

  if (command.type === "add") {
    state.strokes.pop();
  } else {
    state.strokes.push(...command.strokes);
  }

  state.redoStack.push(command);
  return true;
}

export function redo(state) {
  const command = state.redoStack.pop();
  if (!command) return false;

  if (command.type === "add") {
    state.strokes.push(command.stroke);
  } else {
    state.strokes.length = 0;
  }

  state.undoStack.push(command);
  return true;
}

export function serializeBoard(strokes) {
  return JSON.stringify({ version: STORAGE_VERSION, strokes });
}

export function deserializeBoard(value) {
  if (!value) return [];

  try {
    const document = JSON.parse(value);
    if (document?.version !== STORAGE_VERSION || !Array.isArray(document.strokes)) return [];
    return document.strokes.slice(0, MAX_STROKES).filter(isValidStroke);
  } catch {
    return [];
  }
}

export function strokeWidth(stroke, pressure = 0.5) {
  if (stroke.tool === "eraser") return stroke.size;
  if (!stroke.pressureSensitive) return stroke.size;
  const normalizedPressure = Number.isFinite(pressure) && pressure > 0 ? pressure : 0.5;
  return stroke.size * (0.45 + Math.min(normalizedPressure, 1) * 0.9);
}

function isValidStroke(stroke) {
  if (!stroke || !TOOLS.has(stroke.tool)) return false;
  if (typeof stroke.color !== "string" || !Number.isFinite(stroke.size)) return false;
  if (stroke.size < 1 || stroke.size > 100 || !Array.isArray(stroke.points)) return false;
  if (stroke.points.length > MAX_POINTS_PER_STROKE) return false;

  return stroke.points.every((point) =>
    Number.isFinite(point?.x)
    && Number.isFinite(point?.y)
    && Number.isFinite(point?.pressure)
  );
}
