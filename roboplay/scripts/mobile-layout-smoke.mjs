const endpoint = process.argv[2] || 'http://127.0.0.1:9222';
const appUrl = process.argv[3] || 'http://127.0.0.1:5173/roboplay/';

const pages = await fetch(`${endpoint}/json`).then((response) => response.json());
const browserPage = pages.find((page) => page.type === 'page' && page.webSocketDebuggerUrl);
if (!browserPage) throw new Error('Chrome did not expose a browser page for the mobile smoke test.');
const socket = new WebSocket(browserPage.webSocketDebuggerUrl);
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

async function waitFor(expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Mobile layout condition timed out: ${expression}`);
}

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
});
await command('Page.navigate', { url: appUrl });
await waitFor("document.body.classList.contains('app-ready')");

const initial = await evaluate(`(() => ({
  position: getComputedStyle(document.querySelector('.tcp-card')).display,
  challenge: getComputedStyle(document.querySelector('#challenge-summary')).display,
  toggles: getComputedStyle(document.querySelector('.mobile-hud-controls')).display,
}))()`);
if (initial.position !== 'none' || initial.challenge !== 'none' || initial.toggles === 'none') {
  throw new Error(`Portrait overlays are not initially collapsed: ${JSON.stringify(initial)}`);
}

await evaluate("document.querySelector('#mobile-position-toggle').click()");
const positionOpen = await evaluate("getComputedStyle(document.querySelector('.tcp-card')).display !== 'none' && getComputedStyle(document.querySelector('#challenge-summary')).display === 'none'");
if (!positionOpen) throw new Error('Position toggle did not open only the TCP panel.');

await evaluate("document.querySelector('#mobile-challenge-toggle').click()");
const challengeOpen = await evaluate("getComputedStyle(document.querySelector('.tcp-card')).display === 'none' && getComputedStyle(document.querySelector('#challenge-summary')).display !== 'none'");
if (!challengeOpen) throw new Error('Challenge toggle did not open only the challenge panel.');

await evaluate(`(() => {
  const select = document.querySelector('#challenge-select');
  select.value = 'pick';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const resetAfterSwitch = await evaluate("!document.querySelector('.viewport-panel').classList.contains('mobile-position-open') && !document.querySelector('.viewport-panel').classList.contains('mobile-challenge-open') && !document.querySelector('#pick-challenge-tools').hidden");
if (!resetAfterSwitch) throw new Error('Changing challenges did not reset the phone overlay state and tooling.');

console.log(JSON.stringify({ width: 390, overlaysCollapsed: true, exclusiveToggles: true, challengeSwitchReset: true }));
socket.close();
