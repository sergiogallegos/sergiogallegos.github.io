const endpoint = process.argv[2] || 'http://127.0.0.1:9222';
const appUrl = process.argv[3] || 'http://127.0.0.1:5173/roboplay/';
const mode = process.argv[4] || 'python';

const pages = await fetch(`${endpoint}/json`).then((response) => response.json());
const socket = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(predicate, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Browser smoke test timed out.');
}

await command('Page.enable');
await command('Runtime.enable');
await command('Page.navigate', { url: appUrl });
await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#run-button'))"), 20000);
if (mode === 'blocks') {
  await evaluate(`(() => {
    window.confirm = () => true;
    document.querySelector('#blocks-tab').click();
    return true;
  })()`);
  try {
    await waitFor(() => evaluate("!document.querySelector('#blockly-workspace').hidden && Boolean(document.querySelector('#blockly-workspace svg'))"), 30000);
  } catch (error) {
    console.error(JSON.stringify({
      loading: await evaluate("document.querySelector('#blockly-loading')?.textContent"),
      panelHidden: await evaluate("document.querySelector('#blocks-editor-panel')?.hidden"),
      console: await evaluate("document.querySelector('#console')?.textContent"),
    }));
    throw error;
  }
  await evaluate(`(() => {
    const starter = document.querySelector('#starter-blocks-select');
    starter.value = 'loop';
    starter.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await waitFor(() => evaluate("document.querySelector('#generated-python').textContent.includes('range(3)')"), 10000);
  await evaluate("document.querySelector('#run-button').click()");
} else {
  await evaluate(`(() => {
    window.confirm = () => true;
    const starter = document.querySelector('#starter-program-select');
    starter.value = 'hello';
    starter.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#run-button').click();
    return true;
  })()`);
}

let consoleText;
try {
  consoleText = await waitFor(async () => {
    const text = await evaluate("document.querySelector('#console').textContent");
    const completed = mode === 'blocks'
      ? text.includes('Queued 8 robot commands')
      : text.includes('Hello from RoboPlay!') && text.includes('Queued 4 robot commands');
    return completed ? text : null;
  });
} catch (error) {
  const diagnostic = {
    status: await evaluate("document.querySelector('#robot-status')?.textContent"),
    console: await evaluate("document.querySelector('#console')?.textContent"),
  };
  console.error(JSON.stringify(diagnostic));
  throw error;
}

const status = await waitFor(async () => {
  const value = await evaluate("document.querySelector('#robot-status').textContent");
  return value === 'Ready' ? value : null;
});

console.log(JSON.stringify({
  mode,
  pythonOutput: mode === 'python' ? consoleText.includes('Hello from RoboPlay!') : true,
  robotCommands: mode === 'blocks' ? 8 : 4,
  status,
}));
socket.close();
