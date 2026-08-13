const PYODIDE_MODULE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs';

let runtimePromise = null;
let currentRunId = null;
let commandQueue = [];

function send(type, payload = {}) {
  self.postMessage({ type, runId: currentRunId, ...payload });
}

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ PYODIDE_MODULE_URL)
      .then(({ loadPyodide }) => loadPyodide({
        stdout: (text) => send('stdout', { text }),
        stderr: (text) => send('stderr', { text }),
      }))
      .then((pyodide) => {
        pyodide.registerJsModule('roboplay_bridge', {
          enqueue: (type, payload) => commandQueue.push({
            type: String(type),
            ...payload.toJs({ dict_converter: Object.fromEntries }),
          }),
        });
        pyodide.runPython(`
from roboplay_bridge import enqueue as _enqueue
import math

class _RoboPlayRobot:
    def _joint(self, joint):
        if isinstance(joint, bool) or not isinstance(joint, (int, float)) or int(joint) != joint:
            raise ValueError("Joint must be a whole number from 1 to 6.")
        joint = int(joint)
        if not 1 <= joint <= 6:
            raise ValueError("Joint must be from 1 to 6.")
        return joint - 1

    def _number(self, value, name):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{name} must be a number.")
        value = float(value)
        if not math.isfinite(value):
            raise ValueError(f"{name} must be a finite number.")
        return value

    def move_joint(self, joint, degrees):
        _enqueue("MOVE_JOINT", {"joint": self._joint(joint), "degrees": self._number(degrees, "Angle"), "relative": False})

    def move_joint_by(self, joint, degrees):
        _enqueue("MOVE_JOINT", {"joint": self._joint(joint), "degrees": self._number(degrees, "Angle"), "relative": True})

    def move_to(self, x, y, z):
        _enqueue("MOVE_TO", {"x": self._number(x, "X"), "y": self._number(y, "Y"), "z": self._number(z, "Z")})

    def set_speed(self, percent):
        _enqueue("SET_SPEED", {"percent": self._number(percent, "Speed")})

    def wait(self, seconds):
        seconds = self._number(seconds, "Wait time")
        if not 0 <= seconds <= 30:
            raise ValueError("Wait time must be between 0 and 30 seconds.")
        _enqueue("WAIT", {"seconds": seconds})

    def say(self, text):
        _enqueue("SAY", {"text": str(text)})

    def gripper(self, open):
        if not isinstance(open, bool):
            raise TypeError("Gripper state must be True (open) or False (closed).")
        _enqueue("GRIPPER", {"open": open})

    def pen_down(self):
        _enqueue("PEN", {"down": True})

    def pen_up(self):
        _enqueue("PEN", {"down": False})

    def home(self):
        _enqueue("HOME", {})

robot = _RoboPlayRobot()
`);
        return pyodide;
      });
  }
  return runtimePromise;
}

self.onmessage = async (event) => {
  if (event.data?.type !== 'run') return;
  currentRunId = event.data.runId;
  commandQueue = [];
  try {
    send('status', { status: 'Loading Python' });
    const pyodide = await getRuntime();
    send('status', { status: 'Preparing packages' });
    await pyodide.loadPackagesFromImports(event.data.code);
    pyodide.runPython('robot = _RoboPlayRobot()');
    send('status', { status: 'Running Python' });
    await pyodide.runPythonAsync(event.data.code);
    send('complete', { commands: commandQueue });
  } catch (error) {
    send('error', { message: error?.message || String(error) });
  }
};
