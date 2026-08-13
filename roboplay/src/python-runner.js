export class PythonRunner {
  constructor({ onOutput, onStatus }) {
    this.onOutput = onOutput;
    this.onStatus = onStatus;
    this.worker = null;
    this.pending = null;
    this.nextRunId = 1;
  }

  ensureWorker() {
    if (this.worker) return;
    const workerUrl = new URL('./pyodide-worker.mjs', import.meta.url);
    this.worker = new Worker(workerUrl, { type: 'module', name: 'roboplay-python' });
    this.worker.addEventListener('message', (event) => this.handleMessage(event.data));
    this.worker.addEventListener('error', () => {
      this.rejectPending(new Error('Python could not load. Check your internet connection and try again.'));
      this.destroyWorker();
    });
  }

  run(code) {
    if (this.pending) return Promise.reject(new Error('A Python program is already running.'));
    this.ensureWorker();
    const runId = this.nextRunId++;
    return new Promise((resolve, reject) => {
      this.pending = { runId, resolve, reject };
      this.worker.postMessage({ type: 'run', runId, code });
    });
  }

  handleMessage(message) {
    if (!this.pending || message.runId !== this.pending.runId) return;
    if (message.type === 'stdout') this.onOutput(message.text, 'python');
    else if (message.type === 'stderr') this.onOutput(message.text, 'error');
    else if (message.type === 'status') this.onStatus(message.status);
    else if (message.type === 'complete') {
      const { resolve } = this.pending;
      this.pending = null;
      resolve(message.commands);
    } else if (message.type === 'error') {
      this.rejectPending(new Error(message.message));
    }
  }

  rejectPending(error) {
    if (!this.pending) return;
    const { reject } = this.pending;
    this.pending = null;
    reject(error);
  }

  stop() {
    if (!this.worker) return false;
    const error = new Error('Python program stopped.');
    error.name = 'AbortError';
    this.rejectPending(error);
    this.destroyWorker();
    return true;
  }

  destroyWorker() {
    this.worker?.terminate();
    this.worker = null;
  }
}
