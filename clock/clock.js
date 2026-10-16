(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "moment.clock.v1";
  // Natural Open Runde advances keep pairs such as 11 and 08 optically spaced.
  const digitWidths = [146.719, 105.781, 136.719, 143.359, 146.484, 139.141, 142.578, 129.141, 142.109, 142.578];
  const defaults = {
    view: "digital", theme: "dark", seconds: true,
    date: true, hour24: true, keepAwake: true,
  };
  const preferences = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      for (const key of ["seconds", "date", "hour24", "keepAwake"]) {
        if (typeof saved[key] === "boolean") preferences[key] = saved[key];
      }
      if (["digital", "analog"].includes(saved.view)) preferences.view = saved.view;
      if (["light", "dark", "auto"].includes(saved.theme)) preferences.theme = saved.theme;
    }
  } catch { /* The clock also works with unavailable or invalid local storage. */ }

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  let zoneName = new Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  let clockTimer;
  let animationFrame;
  let lastMinute = "";
  let lastDate = "";
  let lastSecond = -1;
  let idleTimer;
  let toastTimer;
  let settingsOpen = false;
  let wakeLock = null;
  let wakeRequest = null;
  let wakeRetryTimer;
  let wakeRetryCount = 0;
  let fullscreenWatchdog;
  let fullscreenRequestPending = false;
  let leaving = false;

  function savePreferences() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); }
    catch { /* Storage is optional. */ }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4400);
    showControls();
  }

  function applyTheme() {
    const theme = preferences.theme === "auto" ? (systemTheme.matches ? "dark" : "light") : preferences.theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0e1017" : "#f5f3f8";
    $("theme-button").querySelector("use").setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
    $("theme-button").setAttribute("aria-label", `${theme === "dark" ? "밝은" : "어두운"} 테마로 전환`);
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === preferences.theme));
    });
  }

  function applyPreferences() {
    document.body.dataset.view = preferences.view;
    $("digital-clock").hidden = preferences.view !== "digital";
    $("analog-clock").hidden = preferences.view !== "analog";
    $("digital-button").setAttribute("aria-pressed", String(preferences.view === "digital"));
    $("analog-button").setAttribute("aria-pressed", String(preferences.view === "analog"));
    $("seconds").hidden = !preferences.seconds;
    $("second-hand").toggleAttribute("hidden", !preferences.seconds);
    $("date-block").hidden = !preferences.date;
    $("period").hidden = preferences.hour24;
    for (const [id, key] of [["seconds", "seconds"], ["date", "date"], ["format", "hour24"], ["wake", "keepAwake"]]) {
      $(`${id}-toggle`).checked = preferences[key];
    }
    applyTheme();
    lastMinute = "";
    lastDate = "";
    lastSecond = -1;
    restartClock();
  }

  function updatePreference(key, value) {
    preferences[key] = value;
    savePreferences();
    applyPreferences();
    if (key === "keepAwake") reconcileWakeLock();
    showControls();
  }

  function buildDial() {
    const ns = "http://www.w3.org/2000/svg";
    const ticks = document.createDocumentFragment();
    for (let index = 0; index < 60; index++) {
      const tick = document.createElementNS(ns, "line");
      const major = index % 5 === 0;
      tick.setAttribute("x1", "200");
      tick.setAttribute("x2", "200");
      tick.setAttribute("y1", "18");
      tick.setAttribute("y2", major ? "31" : "24");
      tick.setAttribute("transform", `rotate(${index * 6} 200 200)`);
      tick.setAttribute("class", `tick${major ? " major" : ""}`);
      ticks.append(tick);
    }
    $("dial-ticks").append(ticks);
  }

  function renderHands(now) {
    const seconds = now.getSeconds() + (reducedMotion.matches ? 0 : now.getMilliseconds() / 1000);
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    $("hour-hand").setAttribute("transform", `rotate(${hours * 30} 200 200)`);
    $("minute-hand").setAttribute("transform", `rotate(${minutes * 6} 200 200)`);
    if (preferences.seconds) $("second-hand").setAttribute("transform", `rotate(${seconds * 6} 200 200)`);
  }

  function renderClock() {
    const now = new Date();
    const hours = preferences.hour24 ? now.getHours() : (now.getHours() % 12 || 12);
    const time = `${String(hours).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const minuteKey = `${now.toDateString()}-${now.getHours()}-${now.getMinutes()}`;
    if (minuteKey !== lastMinute) {
      const characters = [time[0], time[1], ":", time[2], time[3]];
      const ids = ["hour-tens", "hour-ones", "time-colon", "minute-tens", "minute-ones"];
      const tracking = -6;
      const widths = characters.map((digit) => digit === ":" ? 63.906 : digitWidths[Number(digit)]);
      let x = (640 - widths.reduce((sum, width) => sum + width, 0) - tracking * 4) / 2;
      ids.forEach((id, index) => {
        $(id).setAttribute("href", characters[index] === ":" ? "#digit-colon" : `#digit-${characters[index]}`);
        $(id).setAttribute("x", x.toFixed(3));
        x += widths[index] + tracking;
      });
      const label = `${preferences.hour24 ? "" : (now.getHours() < 12 ? "오전 " : "오후 ")}${hours}시 ${now.getMinutes()}분`;
      $("digital-face").setAttribute("aria-label", label);
      $("analog-face").setAttribute("aria-label", label);
      $("period").textContent = now.getHours() < 12 ? "오전" : "오후";
      document.title = `${time.slice(0, 2)}:${time.slice(2)} — Moment`;
      lastMinute = minuteKey;
    }
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getTimezoneOffset()}`;
    if (dateKey !== lastDate) {
      // Resolve the zone again so the label follows an OS time-zone change.
      const currentZone = new Intl.DateTimeFormat().resolvedOptions().timeZone || zoneName;
      zoneName = currentZone;
      dateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" });
      $("date-label").textContent = dateFormatter.format(now);
      const offset = new Intl.DateTimeFormat("en", { timeZoneName: "shortOffset" }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value || "";
      $("timezone-label").textContent = `${currentZone.replaceAll("_", " ")}  ·  ${offset}`;
      lastDate = dateKey;
    }
    if (lastSecond !== now.getSeconds()) {
      $("seconds-label").textContent = String(now.getSeconds()).padStart(2, "0");
      $("seconds-progress").style.strokeDashoffset = String(60 - now.getSeconds());
      $("accessible-time").dateTime = now.toISOString();
      $("accessible-time").textContent = `${dateFormatter.format(now)} ${preferences.hour24 ? "" : (now.getHours() < 12 ? "오전 " : "오후 ")}${hours}시 ${now.getMinutes()}분 ${now.getSeconds()}초`;
      lastSecond = now.getSeconds();
    }
    if (preferences.view === "analog") renderHands(now);
    // Re-read wall time every tick; interval counting would drift after sleep.
    clockTimer = setTimeout(renderClock, 1000 - (Date.now() % 1000) + 8);
  }

  let lastAnimationTime = 0;
  function animateHands(timestamp) {
    if (timestamp - lastAnimationTime >= 1000 / 30) {
      renderHands(new Date());
      lastAnimationTime = timestamp;
    }
    animationFrame = requestAnimationFrame(animateHands);
  }

  function restartClock() {
    clearTimeout(clockTimer);
    cancelAnimationFrame(animationFrame);
    if (document.visibilityState !== "visible" || leaving) return;
    renderClock();
    if (preferences.view === "analog" && preferences.seconds && !reducedMotion.matches) {
      animationFrame = requestAnimationFrame(animateHands);
    }
  }

  const wakeMessages = {
    active: ["화면 유지 중", "이 탭을 보고 있는 동안 화면을 유지합니다."],
    pending: ["화면 유지 연결 중", "화면 꺼짐 방지를 요청하고 있습니다."],
    disabled: ["화면 유지 꺼짐", "화면 꺼짐 방지가 꺼져 있습니다."],
    waiting: ["화면 유지 대기", "이 탭으로 돌아오면 자동으로 다시 연결합니다."],
    error: ["화면 유지 재시도", "화면 유지가 해제됐습니다. 이 버튼을 눌러 다시 요청하세요. 절전 설정에 따라 거절될 수 있습니다."],
    insecure: ["HTTPS 연결 필요", "화면 꺼짐 방지는 HTTPS 또는 localhost에서 사용할 수 있습니다."],
    unsupported: ["화면 유지 지원 안 됨", "이 브라우저는 화면 꺼짐 방지를 지원하지 않습니다. 최신 Safari, Chrome, Edge 또는 Firefox를 사용하세요."],
  };

  function setWakeStatus(state) {
    const [label, detail] = wakeMessages[state];
    $("wake-button").dataset.state = state;
    $("wake-button").setAttribute("aria-pressed", String(state === "active"));
    $("wake-button").setAttribute("aria-label", `${label}. ${detail}`);
    $("wake-button").title = detail;
    $("wake-label").textContent = label;
    $("wake-detail").textContent = detail;
  }

  async function requestWakeLock() {
    if (!preferences.keepAwake) return setWakeStatus("disabled");
    if (!window.isSecureContext) return setWakeStatus("insecure");
    if (!("wakeLock" in navigator)) return setWakeStatus("unsupported");
    if (document.visibilityState !== "visible" || leaving) return setWakeStatus("waiting");
    if (wakeLock && !wakeLock.released) return setWakeStatus("active");
    if (wakeRequest) return wakeRequest;
    setWakeStatus("pending");
    wakeRequest = (async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (!preferences.keepAwake || document.visibilityState !== "visible" || leaving) {
          await sentinel.release();
          setWakeStatus(preferences.keepAwake ? "waiting" : "disabled");
          return;
        }
        wakeLock = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeLock !== sentinel) return;
          wakeLock = null;
          if (!preferences.keepAwake) return setWakeStatus("disabled");
          if (document.visibilityState !== "visible" || leaving) return setWakeStatus("waiting");
          setWakeStatus("error");
          // One delayed retry handles a system release without a busy retry loop.
          clearTimeout(wakeRetryTimer);
          if (wakeRetryCount < 1) {
            wakeRetryCount++;
            wakeRetryTimer = setTimeout(requestWakeLock, 1200);
          }
        }, { once: true });
        setWakeStatus("active");
      } catch {
        setWakeStatus(!preferences.keepAwake ? "disabled" : (document.visibilityState === "visible" && !leaving ? "error" : "waiting"));
      }
    })();
    try { await wakeRequest; }
    finally {
      wakeRequest = null;
      // A quick off/on or hide/show can happen while a sentinel is releasing.
      if (preferences.keepAwake && !leaving && document.visibilityState === "visible" && $("wake-button").dataset.state === "waiting") requestWakeLock();
    }
  }

  async function reconcileWakeLock() {
    clearTimeout(wakeRetryTimer);
    wakeRetryCount = 0;
    if (!preferences.keepAwake || leaving) {
      const current = wakeLock;
      wakeLock = null;
      if (current && !current.released) {
        try { await current.release(); } catch { /* The OS may have already released it. */ }
      }
      if (preferences.keepAwake && !leaving) await requestWakeLock();
      else setWakeStatus(preferences.keepAwake ? "waiting" : "disabled");
    } else {
      await requestWakeLock();
    }
  }

  function showControls() {
    document.body.classList.remove("is-idle");
    clearTimeout(idleTimer);
    if (settingsOpen || document.visibilityState !== "visible") return;
    idleTimer = setTimeout(() => {
      const focused = document.activeElement;
      if (focused && focused !== document.body && focused.matches(":focus-visible")) return;
      if (focused?.closest(".chrome")) focused.blur();
      document.body.classList.add("is-idle");
    }, 4500);
  }

  function setSettings(open, returnFocus = true) {
    settingsOpen = open;
    $("settings-panel").hidden = !open;
    $("settings-button").setAttribute("aria-expanded", String(open));
    if (open) $("close-settings").focus({ preventScroll: true });
    else if (returnFocus) $("settings-button").focus({ preventScroll: true });
    showControls();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function updateFullscreenButton() {
    const active = Boolean(fullscreenElement());
    if (active) {
      clearTimeout(fullscreenWatchdog);
      fullscreenRequestPending = false;
    }
    $("fullscreen-button").setAttribute("aria-label", active ? "전체화면 종료" : "전체화면 시작");
    $("fullscreen-button").setAttribute("aria-pressed", String(active));
    $("fullscreen-button").querySelector("span").textContent = active ? "전체화면 종료" : "전체화면";
    $("fullscreen-button").querySelector("use").setAttribute("href", active ? "#i-contract" : "#i-expand");
    showControls();
  }

  async function toggleFullscreen() {
    if (fullscreenRequestPending) return;
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const request = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (!request) {
          showToast("이 브라우저에서는 전체화면을 지원하지 않습니다. 홈 화면에 추가하면 더 넓게 볼 수 있어요.");
          return;
        }
        fullscreenRequestPending = true;
        // Some embedded browsers expose the API but never settle its promise.
        fullscreenWatchdog = setTimeout(() => {
          fullscreenRequestPending = false;
          if (!fullscreenElement()) showToast("전체화면을 시작할 수 없습니다. Safari나 Chrome에서 직접 열어주세요.");
        }, 2200);
        await request.call(document.documentElement);
      }
      requestWakeLock();
    } catch {
      clearTimeout(fullscreenWatchdog);
      showToast("전체화면을 시작할 수 없습니다. 브라우저에서 직접 열고 다시 눌러주세요.");
    } finally {
      fullscreenRequestPending = false;
    }
    updateFullscreenButton();
  }

  $("digital-button").addEventListener("click", () => updatePreference("view", "digital"));
  $("analog-button").addEventListener("click", () => updatePreference("view", "analog"));
  $("theme-button").addEventListener("click", () => {
    updatePreference("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  $("settings-button").addEventListener("click", () => setSettings(!settingsOpen));
  $("close-settings").addEventListener("click", () => setSettings(false));
  $("fullscreen-button").addEventListener("click", toggleFullscreen);
  $("wake-button").addEventListener("click", () => {
    if (!preferences.keepAwake) updatePreference("keepAwake", true);
    else if (["unsupported", "insecure"].includes($("wake-button").dataset.state)) showToast(wakeMessages[$("wake-button").dataset.state][1]);
    else if (wakeLock && !wakeLock.released) showToast("화면 꺼짐 방지가 켜져 있습니다. 이 탭을 보고 있는 동안 유지됩니다.");
    else requestWakeLock();
  });
  for (const [id, key] of [["seconds", "seconds"], ["date", "date"], ["format", "hour24"], ["wake", "keepAwake"]]) {
    $(`${id}-toggle`).addEventListener("change", (event) => updatePreference(key, event.target.checked));
  }
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => updatePreference("theme", button.dataset.themeChoice));
  });
  document.addEventListener("pointerdown", (event) => {
    showControls();
    if (settingsOpen && !event.target.closest("#settings-panel, #settings-button")) setSettings(false, false);
  });
  document.addEventListener("pointermove", showControls, { passive: true });
  document.addEventListener("focusin", showControls);
  document.addEventListener("keydown", (event) => {
    showControls();
    if (event.key === "Escape" && settingsOpen) { setSettings(false); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches("input, select, textarea, [contenteditable]")) return;
    switch (event.key.toLowerCase()) {
      case "f": event.preventDefault(); toggleFullscreen(); break;
      case "t": $("theme-button").click(); break;
      case "a": updatePreference("view", preferences.view === "digital" ? "analog" : "digital"); break;
      case "s": updatePreference("seconds", !preferences.seconds); break;
    }
  });
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  document.addEventListener("visibilitychange", () => {
    restartClock();
    if (document.visibilityState === "visible") { reconcileWakeLock(); showControls(); }
    else {
      clearTimeout(idleTimer);
      clearTimeout(wakeRetryTimer);
      // The browser releases the sentinel when this document becomes hidden.
    }
  });
  window.addEventListener("pageshow", () => {
    leaving = false;
    restartClock();
    reconcileWakeLock();
    showControls();
  });
  window.addEventListener("pagehide", () => {
    leaving = true;
    clearTimeout(clockTimer);
    clearTimeout(idleTimer);
    cancelAnimationFrame(animationFrame);
    reconcileWakeLock();
  });
  const onSystemThemeChange = () => { if (preferences.theme === "auto") applyTheme(); };
  if (systemTheme.addEventListener) systemTheme.addEventListener("change", onSystemThemeChange);
  else systemTheme.addListener(onSystemThemeChange);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", restartClock);

  buildDial();
  applyPreferences();
  updateFullscreenButton();
  requestWakeLock();
  showControls();
})();
