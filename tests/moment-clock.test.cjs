const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { join } = require('node:path');
process.env.TZ = 'Asia/Seoul';
const source = readFileSync(join(__dirname, '../clock/clock.js'), 'utf8');
const html = readFileSync(join(__dirname, '../clock/index.html'), 'utf8');

function element() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  const children = new Map();
  return {
    dataset: {}, style: { setProperty(key, value) { this[key] = value; } }, hidden: false, checked: true, textContent: '',
    childNodes: [], parentNode: null,
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    setAttribute: (key, value) => attributes.set(key, String(value)),
    getAttribute: key => attributes.get(key),
    removeAttribute: key => attributes.delete(key),
    toggleAttribute(key, value) { value ? attributes.set(key, '') : attributes.delete(key); },
    hasAttribute: key => attributes.has(key),
    append(child) { child.parentNode = this; this.childNodes.push(child); },
    insertBefore(child, reference) { child.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(reference), 0, child); },
    remove() { if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; },
    cloneNode() { const clone = element(); for (const [key, value] of attributes) clone.setAttribute(key, value); clone.textContent = this.textContent; clone.animate = this.animate; return clone; },
    focus() {}, blur() {}, matches: () => false, closest: () => null,
    querySelector(selector) { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(callback); },
    async emit(name, data = {}) { for (const callback of listeners.get(name) || []) await callback({ target: this, ...data }); },
    click() { return this.emit('click'); },
  };
}

function setup(options = {}) {
  const nodes = new Map([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) => {
    const node = element();
    for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) node.setAttribute(name, value);
    return [id, node];
  }));
  const fontButtons = ['rounded', 'modern', 'slim', 'mono', 'classic', 'digital'].map(style => {
    const button = nodes.get('font-choice-' + style);
    button.dataset.fontChoice = style;
    return button;
  });
  const themeButtons = ['light', 'dark', 'black', 'auto'].map(theme => {
    const button = nodes.get('theme-choice-' + theme);
    button.dataset.themeChoice = theme;
    return button;
  });
  const document = Object.assign(element(), {
    visibilityState: 'visible', body: element(), documentElement: element(), activeElement: null,
    getElementById: id => nodes.get(id), createDocumentFragment: element, createElementNS: element,
    querySelectorAll: selector => selector === '[data-font-choice]' ? fontButtons : (selector === '[data-theme-choice]' ? themeButtons : []),
  });
  const fontRequests = [];
  if (!options.fontsUnavailable) document.fonts = { load(descriptor, text) {
    if (options.manualFonts) return new Promise((resolve, reject) => { fontRequests.push({ descriptor, text, resolve, reject }); });
    fontRequests.push({ descriptor, text });
    return options.fontError ? Promise.reject(Error('Font unavailable')) : Promise.resolve([{}]);
  } };
  const requests = [];
  const sentinels = [];
  const timers = new Map();
  const animations = [];
  const numerals = nodes.get('vector-numerals');
  const fontNumerals = nodes.get('font-numerals');
  for (const id of ['hour-tens', 'hour-ones', 'time-colon', 'minute-tens', 'minute-ones', 'font-hour-tens', 'font-hour-ones', 'font-colon', 'font-minute-tens', 'font-minute-ones']) {
    const node = nodes.get(id);
    node.setAttribute('id', id);
    (id.startsWith('font-') ? fontNumerals : numerals).append(node);
    if (options.animations) node.animate = function (frames, timing) {
      const animation = { node: this, frames, timing, cancelled: false,
        cancel() { this.cancelled = true; }, finish() { this.onfinish?.(); } };
      animations.push(animation);
      return animation;
    };
  }
  const motionPreference = Object.assign(element(), { matches: Boolean(options.reducedMotion) });
  const systemTheme = Object.assign(element(), { matches: Boolean(options.systemDark) });
  let timerID = 0;
  let now = new Date(options.now || '2026-10-16T23:59:59+09:00').valueOf();
  const request = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ resolve, reject });
    return promise;
  };
  const window = Object.assign(element(), {
    isSecureContext: options.secure !== false,
    matchMedia: query => query.includes('reduced-motion') ? motionPreference : systemTheme,
  });
  const storageWrites = [];
  const storage = {
    getItem() { if (options.storageThrows) throw Error('Storage unavailable'); return options.saved || null; },
    setItem(key, value) { if (options.storageThrows) throw Error('Storage unavailable'); storageWrites.push(value); },
  };
  const context = vm.createContext({
    document, window, navigator: options.unsupported ? {} : { wakeLock: { request } },
    localStorage: storage, Intl,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    setTimeout(callback, delay) { timers.set(++timerID, { callback, delay }); return timerID; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  vm.runInContext(source, context);
  return {
    nodes, document, window, requests, timers, animations, numerals, fontNumerals, motionPreference, systemTheme, fontRequests, storageWrites,
    node: id => nodes.get(id),
    setNow(date) { now = new Date(date).valueOf(); },
    async flush() { for (let i = 0; i < 16; i++) await Promise.resolve(); },
    async grant(index = requests.length - 1, delayedRelease = false) {
      const sentinel = Object.assign(element(), { released: false, releaseCount: 0 });
      let finishRelease;
      sentinel.release = async () => {
        sentinel.releaseCount++;
        if (delayedRelease) await new Promise(resolve => { finishRelease = resolve; });
        sentinel.released = true;
        await sentinel.emit('release');
      };
      sentinel.finishRelease = () => finishRelease?.();
      sentinels.push(sentinel);
      requests[index].resolve(sentinel);
      await this.flush();
      return sentinel;
    },
    async toggle(id, value) { const target = nodes.get(id); target.checked = value; await target.emit('change'); await this.flush(); },
    async visibility(value) { document.visibilityState = value; await document.emit('visibilitychange'); await this.flush(); },
    async tick() {
      const entry = [...timers].find(([, timer]) => timer.delay <= 1008);
      assert.ok(entry, 'A clock tick is scheduled');
      timers.delete(entry[0]); entry[1].callback(); await this.flush();
    },
    async runTimer(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `Timer with delay ${delay} exists`);
      timers.delete(entry[0]); entry[1].callback(); await this.flush();
    },
  };
}

test('acquires on load, releases on hide, reacquires after returning to the tab', async () => {
  const app = setup();
  assert.equal(app.requests.length, 1);
  const first = await app.grant();
  assert.equal(app.node('wake-button').dataset.state, 'active');
  await app.visibility('hidden');
  await first.release();
  assert.equal(app.node('wake-button').dataset.state, 'waiting');
  await app.visibility('visible');
  assert.equal(app.requests.length, 2);
  await app.grant();
  assert.equal(app.node('wake-button').dataset.state, 'active');
});

test('an in-flight acquisition is released when keep-awake was switched off', async () => {
  const app = setup();
  await app.toggle('wake-toggle', false);
  const lock = await app.grant();
  assert.equal(lock.released, true);
  assert.equal(app.node('wake-button').dataset.state, 'disabled');
});

test('quick off/on while an unused lock is releasing reacquires correctly', async () => {
  const app = setup();
  await app.toggle('wake-toggle', false);
  const lock = await app.grant(0, true);
  await app.toggle('wake-toggle', true);
  lock.finishRelease();
  await app.flush();
  assert.equal(app.requests.length, 2);
  await app.grant();
  assert.equal(app.node('wake-button').dataset.state, 'active');
});

test('quick off/on while an active lock is releasing preserves the new lock state', async () => {
  const app = setup();
  const lock = await app.grant(0, true);
  await app.toggle('wake-toggle', false);
  await app.toggle('wake-toggle', true);
  await app.grant();
  lock.finishRelease();
  await app.flush();
  assert.equal(app.requests.length, 2);
  assert.equal(app.node('wake-button').dataset.state, 'active');
});

test('request rejection exposes a retry state and allows explicit retry', async () => {
  const app = setup();
  app.requests[0].reject(Error('Power policy denied'));
  await app.flush();
  assert.equal(app.node('wake-button').dataset.state, 'error');
  await app.node('wake-button').click();
  assert.equal(app.requests.length, 2);
  await app.grant();
  assert.equal(app.node('wake-button').dataset.state, 'active');
});

test('an unexpected release gets only one automatic retry', async () => {
  const app = setup();
  const first = await app.grant();
  await first.release();
  await app.runTimer(1200);
  const second = await app.grant();
  await second.release();
  assert.equal([...app.timers.values()].filter(x => x.delay === 1200).length, 0);
  assert.equal(app.node('wake-button').dataset.state, 'error');
});

test('navigation releases the lock and a restored page starts a new one', async () => {
  const app = setup();
  const lock = await app.grant();
  await app.window.emit('pagehide');
  await app.flush();
  assert.equal(lock.released, true);
  assert.equal(app.node('wake-button').dataset.state, 'waiting');
  await app.window.emit('pageshow');
  assert.equal(app.requests.length, 2);
  await app.grant();
  assert.equal(app.node('wake-button').dataset.state, 'active');
});

test('insecure and unsupported environments report the reason without a request', () => {
  for (const [options, expected] of [[{ secure: false }, 'insecure'], [{ unsupported: true }, 'unsupported']]) {
    const app = setup(options);
    assert.equal(app.requests.length, 0);
    assert.equal(app.node('wake-button').dataset.state, expected);
  }
});

test('midnight refreshes SVG digits, date and 12-hour AM/PM after suspension', async () => {
  const app = setup({ saved: JSON.stringify({ hour24: false, keepAwake: false }) });
  assert.equal(app.node('period').textContent, '오후');
  await app.visibility('hidden');
  app.setNow('2026-10-17T00:00:00+09:00');
  await app.visibility('visible');
  assert.equal(app.node('period').textContent, '오전');
  assert.equal(app.node('hour-tens').getAttribute('href'), '#digit-1');
  assert.equal(app.node('hour-ones').getAttribute('href'), '#digit-2');
  assert.equal(app.node('minute-tens').getAttribute('href'), '#digit-0');
  assert.match(app.node('date-label').textContent, /17/);
});

test('seconds toggle removes the SVG second hand and saved settings survive invalid storage', async () => {
  const app = setup({ storageThrows: true });
  await app.toggle('seconds-toggle', false);
  assert.equal(app.node('second-hand').hasAttribute('hidden'), true);
  assert.equal(app.node('seconds').hidden, true);
  const invalid = setup({ saved: '{broken' });
  assert.equal(invalid.document.body.dataset.view, 'digital');
  const wrongTypes = setup({ saved: JSON.stringify({ view: '<script>', hour24: 'no' }) });
  assert.equal(wrongTypes.document.body.dataset.view, 'digital');
  assert.equal(wrongTypes.node('format-toggle').checked, true);
});

test('real black can be selected, saved and restored with the correct browser color and controls', async () => {
  const app = setup();
  assert.equal(app.document.documentElement.dataset.theme, 'dark');
  assert.equal(app.document.querySelector('meta[name="theme-color"]').content, '#0e1017');
  await app.node('theme-choice-black').click();
  assert.equal(app.document.documentElement.dataset.theme, 'black');
  assert.equal(app.document.querySelector('meta[name="theme-color"]').content, '#000000');
  assert.equal(app.node('theme-button').getAttribute('aria-label'), '밝은 테마로 전환');
  assert.equal(app.node('theme-button').querySelector('use').getAttribute('href'), '#i-sun');
  for (const theme of ['light', 'dark', 'black', 'auto']) {
    assert.equal(app.node('theme-choice-' + theme).getAttribute('aria-pressed'), String(theme === 'black'));
  }
  const saved = app.storageWrites.at(-1);
  assert.equal(JSON.parse(saved).theme, 'black');
  const restored = setup({ saved });
  assert.equal(restored.document.documentElement.dataset.theme, 'black');
  await restored.node('theme-button').click();
  assert.equal(restored.document.documentElement.dataset.theme, 'light');
  assert.equal(restored.node('theme-choice-light').getAttribute('aria-pressed'), 'true');
  assert.equal(restored.node('theme-button').getAttribute('aria-label'), '어두운 테마로 전환');
});

test('automatic themes follow the system while an explicit real-black choice stays black', async () => {
  const app = setup({ systemDark: true });
  await app.node('theme-choice-auto').click();
  assert.equal(app.document.documentElement.dataset.theme, 'dark');
  app.systemTheme.matches = false;
  await app.systemTheme.emit('change');
  assert.equal(app.document.documentElement.dataset.theme, 'light');
  await app.node('theme-choice-black').click();
  app.systemTheme.matches = true;
  await app.systemTheme.emit('change');
  assert.equal(app.document.documentElement.dataset.theme, 'black');
  assert.equal(app.node('theme-choice-black').getAttribute('aria-pressed'), 'true');
});

test('fullscreen enters and exits through the standard API and updates the control', async () => {
  const app = setup();
  let entered = 0;
  app.document.documentElement.requestFullscreen = async () => {
    entered++;
    app.document.fullscreenElement = app.document.documentElement;
    await app.document.emit('fullscreenchange');
  };
  app.document.exitFullscreen = async () => {
    app.document.fullscreenElement = null;
    await app.document.emit('fullscreenchange');
  };
  await app.node('fullscreen-button').click();
  assert.equal(entered, 1);
  assert.equal(app.node('fullscreen-button').getAttribute('aria-pressed'), 'true');
  await app.node('fullscreen-button').click();
  assert.equal(app.node('fullscreen-button').getAttribute('aria-pressed'), 'false');
});

test('fullscreen denial and a nonresponding embed display an actionable message', async () => {
  const denied = setup();
  denied.document.documentElement.requestFullscreen = async () => { throw Error('Not allowed'); };
  await denied.node('fullscreen-button').click();
  assert.match(denied.node('toast').textContent, /브라우저/);
  const pending = setup();
  pending.document.documentElement.requestFullscreen = () => new Promise(() => {});
  pending.node('fullscreen-button').click();
  await pending.runTimer(2200);
  assert.match(pending.node('toast').textContent, /Safari/);
});

test('a minute rollover crossfades only changed digits and cleans up outgoing outlines', async () => {
  const app = setup({ animations: true, now: '2026-10-17T10:24:59+09:00' });
  const stationary = ['hour-tens', 'hour-ones', 'time-colon', 'minute-tens'];
  const positions = stationary.map(id => app.node(id).getAttribute('x'));
  assert.equal(app.animations.length, 0, 'Initial time appears immediately');
  app.setNow('2026-10-17T10:25:00+09:00');
  await app.tick();
  const outgoing = app.numerals.childNodes.filter(node => node.hasAttribute('aria-hidden'));
  assert.equal(outgoing.length, 1);
  assert.equal(outgoing[0].getAttribute('href'), '#digit-4');
  assert.equal(outgoing[0].hasAttribute('id'), false);
  assert.equal(app.node('minute-ones').getAttribute('href'), '#digit-5');
  const entry = app.animations.find(animation => animation.node === app.node('minute-ones'));
  const exit = app.animations.find(animation => animation.node === outgoing[0]);
  assert.equal(entry.frames[0].opacity, 0);
  assert.equal(entry.frames[1].opacity, 1);
  assert.equal(exit.frames[0].opacity, 1);
  assert.equal(exit.frames[1].opacity, 0);
  assert.equal(entry.timing.duration, exit.timing.duration);
  assert.equal(app.animations.length, 2, 'Only the changing digit crossfades');
  assert.deepEqual(stationary.map(id => app.node(id).getAttribute('x')), positions);
  assert.ok(app.animations.every(animation => animation.frames.every(frame => !('transform' in frame))),
    'Crossfades never move the digits horizontally');
  app.animations.forEach(animation => animation.finish());
  assert.equal(app.numerals.childNodes.length, 5);
});

test('midnight can transition every digit without leaving duplicate IDs or old digits behind', async () => {
  const app = setup({ animations: true });
  app.setNow('2026-10-17T00:00:00+09:00');
  await app.tick();
  assert.equal(app.numerals.childNodes.filter(node => node.hasAttribute('aria-hidden')).length, 4);
  app.animations.forEach(animation => animation.finish());
  assert.equal(app.numerals.childNodes.length, 5);
  for (const id of ['hour-tens', 'hour-ones', 'minute-tens', 'minute-ones']) {
    assert.equal(app.node(id).getAttribute('href'), '#digit-0');
  }
});

test('hiding the page cancels a running fade; returning shows current time immediately', async () => {
  const app = setup({ animations: true });
  app.setNow('2026-10-17T00:00:00+09:00');
  await app.tick();
  const count = app.animations.length;
  await app.visibility('hidden');
  assert.ok(app.animations.every(animation => animation.cancelled));
  assert.equal(app.numerals.childNodes.length, 5);
  app.setNow('2026-10-17T00:02:00+09:00');
  await app.visibility('visible');
  assert.equal(app.animations.length, count);
  assert.equal(app.node('minute-ones').getAttribute('href'), '#digit-2');
});

test('reduced motion skips fades and cancels existing animations when enabled', async () => {
  const reduced = setup({ animations: true, reducedMotion: true });
  reduced.setNow('2026-10-17T00:00:00+09:00');
  await reduced.tick();
  assert.equal(reduced.animations.length, 0);
  const app = setup({ animations: true });
  app.setNow('2026-10-17T00:00:00+09:00');
  await app.tick();
  app.motionPreference.matches = true;
  await app.motionPreference.emit('change');
  assert.ok(app.animations.every(animation => animation.cancelled));
  assert.equal(app.numerals.childNodes.length, 5);
});

test('a selected webfont is loaded before display, saved and restored on a new visit', async () => {
  const app = setup();
  await app.node('font-choice-modern').click();
  assert.equal(app.document.body.dataset.font, 'modern');
  assert.equal(app.numerals.hasAttribute('hidden'), true);
  assert.equal(app.fontNumerals.hasAttribute('hidden'), false);
  assert.equal(app.node('font-hour-tens').textContent, '2');
  assert.equal(app.node('font-choice-modern').getAttribute('aria-pressed'), 'true');
  assert.match(app.fontRequests[0].descriptor, /500.*Moment Inter/);
  const saved = app.storageWrites.at(-1);
  assert.equal(JSON.parse(saved).font, 'modern');
  const restored = setup({ saved });
  await restored.flush();
  assert.equal(restored.document.body.dataset.font, 'modern');
});

test('webfont text crossfades preserve the outgoing text and clean it up', async () => {
  const app = setup({ animations: true, now: '2026-10-17T10:24:59+09:00' });
  await app.node('font-choice-mono').click();
  app.setNow('2026-10-17T10:25:00+09:00');
  await app.tick();
  const outgoing = app.fontNumerals.childNodes.filter(node => node.hasAttribute('aria-hidden'));
  assert.equal(outgoing.length, 1);
  assert.equal(outgoing[0].textContent, '4');
  assert.equal(app.node('font-minute-ones').textContent, '5');
  assert.equal(app.animations.find(animation => animation.node === outgoing[0]).frames[1].opacity, 0);
  assert.equal(app.animations.length, 2);
  assert.ok(app.animations.every(animation => animation.frames.every(frame => !('transform' in frame))));
  app.animations.forEach(animation => animation.finish());
  assert.equal(app.fontNumerals.childNodes.length, 5);
});

test('styles have individual spacing that stays fixed throughout a full day in both time formats', async () => {
  const start = new Date('2026-10-17T00:00:00+09:00').valueOf();
  const digitSpacings = new Set();
  for (const style of ['rounded', 'modern', 'slim', 'mono', 'classic', 'digital']) {
    const app = setup({ now: start });
    await app.node('font-choice-' + style).click();
    const webfont = style !== 'rounded';
    const ids = webfont
      ? ['font-hour-tens', 'font-hour-ones', 'font-colon', 'font-minute-tens', 'font-minute-ones']
      : ['hour-tens', 'hour-ones', 'time-colon', 'minute-tens', 'minute-ones'];
    // At 00:00 both hour glyphs are identical, so their offset gives the pitch
    // for either SVG outlines or text without depending on glyph bearings.
    digitSpacings.add((Number(app.node(ids[1]).getAttribute('x')) - Number(app.node(ids[0]).getAttribute('x'))).toFixed(3));
    const positions = ids.map(() => new Map());
    for (const hour24 of [true, false]) {
      await app.toggle('format-toggle', hour24);
      for (let minute = 0; minute < 24 * 60; minute++) {
        app.setNow(start + minute * 60000);
        await app.tick();
        ids.forEach((id, index) => {
          const node = app.node(id);
          // Outline glyphs use individual offsets to center their different ink widths.
          // Each outline must retain that offset regardless of the neighboring digits.
          const key = webfont ? 'center' : node.getAttribute('href');
          const position = node.getAttribute('x');
          assert.ok(Number.isFinite(Number(position)));
          if (positions[index].has(key)) {
            assert.equal(position, positions[index].get(key), `${style}: ${id} moved at minute ${minute}`);
          } else positions[index].set(key, position);
        });
      }
    }
  }
  assert.ok(digitSpacings.size > 1, 'Faces use individual spacing instead of a shared widest-font grid');
});

test('seconds keep two permanent positions when crossing single and double digit boundaries', async () => {
  for (const style of ['rounded', 'modern', 'slim', 'mono', 'classic', 'digital']) {
    const app = setup({ now: '2026-10-17T10:24:00+09:00' });
    await app.node('font-choice-' + style).click();
    const tens = app.node('seconds-tens');
    const ones = app.node('seconds-ones');
    const positions = [tens, ones].map(node => node.getAttribute('x'));
    assert.ok(Number(positions[1]) > Number(positions[0]));
    for (const second of [9, 10, 11, 19, 20, 58, 59, 60]) {
      app.setNow(new Date('2026-10-17T10:24:00+09:00').valueOf() + second * 1000);
      await app.tick();
      assert.equal(tens.textContent + ones.textContent, String(second % 60).padStart(2, '0'));
      assert.deepEqual([tens, ones].map(node => node.getAttribute('x')), positions);
    }
  }
});

test('the latest font selection wins when font requests finish in reverse order', async () => {
  const app = setup({ manualFonts: true });
  const first = app.node('font-choice-modern').click();
  const second = app.node('font-choice-classic').click();
  assert.equal(app.fontRequests.length, 2);
  assert.equal(app.document.body.dataset.font, 'rounded', 'The current clock stays visible during loading');
  app.fontRequests[1].resolve([{}]);
  await second;
  assert.equal(app.document.body.dataset.font, 'classic');
  app.fontRequests[0].resolve([{}]);
  await first;
  assert.equal(app.document.body.dataset.font, 'classic');
  assert.equal(JSON.parse(app.storageWrites.at(-1)).font, 'classic');
});

test('failed or unsupported font loads keep the working style and leave controls usable', async () => {
  for (const options of [{ fontError: true }, { fontsUnavailable: true }]) {
    const app = setup(options);
    await app.node('font-choice-digital').click();
    assert.equal(app.document.body.dataset.font, 'rounded');
    assert.equal(app.numerals.hasAttribute('hidden'), false);
    assert.equal(app.node('font-choice-rounded').getAttribute('aria-pressed'), 'true');
    assert.equal(app.node('font-picker').getAttribute('aria-busy'), 'false');
    assert.match(app.node('font-status').textContent, /못했습니다/);
    assert.equal(app.storageWrites.length, 0);
  }
});

test('a timed-out font can be retried without a late response replacing the active style', async () => {
  const app = setup({ manualFonts: true });
  const first = app.node('font-choice-slim').click();
  await app.runTimer(8000);
  await first;
  assert.equal(app.document.body.dataset.font, 'rounded');
  app.fontRequests[0].resolve([{}]);
  await app.flush();
  assert.equal(app.document.body.dataset.font, 'rounded');
  const retry = app.node('font-choice-slim').click();
  assert.equal(app.fontRequests.length, 2);
  app.fontRequests[1].resolve([{}]);
  await retry;
  assert.equal(app.document.body.dataset.font, 'slim');
});

test('unrecognized saved font values never become CSS font families', async () => {
  for (const font of ['__proto__', 'toString', 'unknown', ['modern'], {}]) {
    const app = setup({ saved: JSON.stringify({ font }) });
    await app.flush();
    assert.equal(app.document.body.dataset.font, 'rounded');
    assert.equal(app.fontRequests.length, 0);
  }
});
