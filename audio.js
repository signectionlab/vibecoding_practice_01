/**
 * CODE RUNNER — 오디오 매니저
 * BGM / SFX 각 3종 선택 + 설정 저장
 */

const AUDIO_CATALOG = {
  bgmLobby: [
    { id: 0, label: "햇살 팝" },
    { id: 1, label: "버블티" },
    { id: 2, label: "구름빛" },
  ],
  bgmGame: [
    { id: 0, label: "즐거운 질주" },
    { id: 1, label: "픽셀 스텝" },
    { id: 2, label: "캔디 대시" },
  ],
  sfxHit: [
    { id: 0, label: "Impact", src: "assets/audio/hit.ogg" },
    { id: 1, label: "Zap", src: "assets/audio/hit-2.ogg" },
    { id: 2, label: "Crash", src: "assets/audio/hit-3.ogg" },
  ],
  sfxHeal: [
    { id: 0, label: "Power Up", src: "assets/audio/heal.ogg" },
    { id: 1, label: "Restore", src: "assets/audio/heal-2.ogg" },
    { id: 2, label: "Boost", src: "assets/audio/heal-3.ogg" },
  ],
  sfxData: [
    { id: 0, label: "Data Tick", src: "assets/audio/data.ogg" },
    { id: 1, label: "Coin", src: "assets/audio/data-2.ogg" },
    { id: 2, label: "Blip", src: "assets/audio/data-3.ogg" },
  ],
};

const STORAGE_VOLUME = "codeRunnerVolume";
const STORAGE_MUTED = "codeRunnerMuted";
const STORAGE_BGM_LOBBY = "codeRunnerBgmLobby";
const STORAGE_BGM_GAME = "codeRunnerBgmGame";
const STORAGE_SFX_HIT = "codeRunnerSfxHit";
const STORAGE_SFX_HEAL = "codeRunnerSfxHeal";
const STORAGE_SFX_DATA = "codeRunnerSfxData";

const BGM_BASE = { lobby: 0.34, game: 0.3 };
const SFX_BASE = { hit: 0.65, heal: 0.55, data: 0.35 };

/** 가볍고 캐주얼한 BGM 프리셋 (Web Audio) */
const CASUAL_BGM = {
  lobby: [
    {
      bpm: 92,
      wave: "sine",
      melody: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440],
      bass: [261.63, 329.63, 392, 329.63],
      noteLen: 0.3,
      swing: 0.04,
      melodyGain: 0.22,
      bassGain: 0.12,
    },
    {
      bpm: 98,
      wave: "triangle",
      melody: [440, 554.37, 659.25, 554.37, 493.88, 440, 369.99, 440],
      bass: [220, 277.18, 329.63, 277.18],
      noteLen: 0.24,
      swing: 0.03,
      melodyGain: 0.2,
      bassGain: 0.11,
    },
    {
      bpm: 84,
      wave: "sine",
      melody: [392, 440, 493.88, 523.25, 587.33, 523.25, 493.88, 440],
      bass: [196, 220, 246.94, 261.63],
      noteLen: 0.36,
      swing: 0.05,
      melodyGain: 0.18,
      bassGain: 0.1,
    },
  ],
  game: [
    {
      bpm: 118,
      wave: "triangle",
      melody: [523.25, 659.25, 783.99, 880, 783.99, 659.25, 523.25, 659.25],
      bass: [261.63, 329.63, 392, 440],
      noteLen: 0.18,
      swing: 0.02,
      melodyGain: 0.24,
      bassGain: 0.13,
    },
    {
      bpm: 124,
      wave: "sine",
      melody: [587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25],
      bass: [293.66, 329.63, 392, 329.63],
      noteLen: 0.16,
      swing: 0.025,
      melodyGain: 0.22,
      bassGain: 0.12,
    },
    {
      bpm: 132,
      wave: "triangle",
      melody: [659.25, 783.99, 880, 987.77, 880, 783.99, 659.25, 783.99],
      bass: [329.63, 392, 440, 493.88],
      noteLen: 0.14,
      swing: 0.02,
      melodyGain: 0.23,
      bassGain: 0.13,
    },
  ],
};

const audioState = {
  unlocked: false,
  muted: localStorage.getItem(STORAGE_MUTED) === "true",
  masterVolume: Number(localStorage.getItem(STORAGE_VOLUME) ?? 0.7),
  bgmLobby: clampIndex(localStorage.getItem(STORAGE_BGM_LOBBY), AUDIO_CATALOG.bgmLobby.length),
  bgmGame: clampIndex(localStorage.getItem(STORAGE_BGM_GAME), AUDIO_CATALOG.bgmGame.length),
  sfxHit: clampIndex(localStorage.getItem(STORAGE_SFX_HIT), AUDIO_CATALOG.sfxHit.length),
  sfxHeal: clampIndex(localStorage.getItem(STORAGE_SFX_HEAL), AUDIO_CATALOG.sfxHeal.length),
  sfxData: clampIndex(localStorage.getItem(STORAGE_SFX_DATA), AUDIO_CATALOG.sfxData.length),
  currentBgm: null,
  previewing: false,
  previewCategory: null,
};

const draftSettings = {
  muted: false,
  masterVolume: 0.7,
  bgmLobby: 0,
  bgmGame: 0,
  sfxHit: 0,
  sfxHeal: 0,
  sfxData: 0,
};

const sfxPools = { hit: null, heal: null, data: null };

const audioUi = {
  muteBtn: null,
  volumeSlider: null,
  optionGroups: {},
};

let audioCtx = null;
let proceduralNodes = { lobby: null, game: null };

function clampIndex(value, length) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n >= length) return 0;
  return n;
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function createSfxPool(src) {
  const pool = Array.from({ length: 3 }, () => {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  });
  let index = 0;
  return {
    pool,
    play() {
      if (!audioState.unlocked || audioState.muted || audioState.masterVolume <= 0) return;
      const audio = pool[index];
      index = (index + 1) % pool.length;
      audio.currentTime = 0;
      audio.play().catch(() => playProceduralSfx(this._type, this._preset));
    },
    _type: null,
    _preset: 0,
  };
}

function getEffectiveVolume(base) {
  if (audioState.muted || audioState.masterVolume <= 0) return 0;
  return base * audioState.masterVolume;
}

function getDraftEffectiveVolume(base) {
  if (draftSettings.muted || draftSettings.masterVolume <= 0) return 0;
  return base * draftSettings.masterVolume;
}

function stopProceduralBgm(name) {
  const node = proceduralNodes[name];
  if (!node) return;

  node.running = false;
  if (node.intervalId) clearInterval(node.intervalId);
  try {
    node.masterGain?.disconnect();
  } catch (_) {}
  proceduralNodes[name] = null;
}

function stopAllProceduralBgm() {
  stopProceduralBgm("lobby");
  stopProceduralBgm("game");
}

function playCasualNote(ctx, masterGain, freq, startTime, duration, gainVal, wave) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.06);
}

function startCasualBgm(name, presetIndex, options = {}) {
  stopProceduralBgm(name);

  const useDraft = options.useDraft === true;
  const volumeBase = BGM_BASE[name];
  const volume = useDraft
    ? getDraftEffectiveVolume(volumeBase)
    : getEffectiveVolume(volumeBase);

  if (volume <= 0) return;

  if (!audioState.unlocked && !options.forceUnlock) return;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();

  const preset = CASUAL_BGM[name][presetIndex] || CASUAL_BGM[name][0];
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  const beatSec = 60 / preset.bpm;
  const stepMs = beatSec * 500;
  let step = 0;
  let bassStep = 0;

  const node = {
    masterGain,
    intervalId: null,
    running: true,
    setVolume(v) {
      masterGain.gain.value = v;
    },
  };

  const tick = () => {
    if (!node.running) return;

    const swing = (step % 2) * preset.swing;
    const now = ctx.currentTime + 0.04 + swing;
    const melodyFreq = preset.melody[step % preset.melody.length];

    playCasualNote(
      ctx,
      masterGain,
      melodyFreq,
      now,
      preset.noteLen,
      preset.melodyGain,
      preset.wave
    );

    if (step % 2 === 0) {
      playCasualNote(
        ctx,
        masterGain,
        preset.bass[bassStep % preset.bass.length],
        now,
        preset.noteLen * 1.35,
        preset.bassGain,
        "sine"
      );
      bassStep += 1;
    }

    step += 1;
  };

  tick();
  node.intervalId = setInterval(tick, stepMs);
  proceduralNodes[name] = node;
}

function updatePreviewVolume() {
  if (!audioState.previewing || !audioState.previewCategory) return;
  const name = audioState.previewCategory;
  const vol = getDraftEffectiveVolume(BGM_BASE[name]);
  proceduralNodes[name]?.setVolume?.(vol);
}

function previewDraftBgm(bgmKey) {
  unlockAudio();

  const name = bgmKey === "bgmLobby" ? "lobby" : "game";
  const other = name === "lobby" ? "game" : "lobby";
  const presetIndex = draftSettings[bgmKey];

  audioState.previewing = true;
  audioState.previewCategory = name;

  stopProceduralBgm(other);
  stopProceduralBgm(name);

  if (draftSettings.muted || draftSettings.masterVolume <= 0) return;

  startCasualBgm(name, presetIndex, { useDraft: true, forceUnlock: true });
}

function stopBgmPreview() {
  if (!audioState.previewing) return;

  audioState.previewing = false;
  audioState.previewCategory = null;
  stopAllProceduralBgm();

  if (audioState.unlocked && !audioState.muted && audioState.masterVolume > 0) {
    syncBgmForScreen(getCurrentScreenName());
  }
}

function playProceduralSfx(type, preset) {
  if (!audioState.unlocked || audioState.muted || audioState.masterVolume <= 0) return;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  const profiles = {
    hit: [
      { type: "sawtooth", start: 180, end: 60, dur: 0.18, vol: SFX_BASE.hit },
      { type: "square", start: 240, end: 80, dur: 0.12, vol: SFX_BASE.hit * 0.9 },
      { type: "triangle", start: 120, end: 40, dur: 0.22, vol: SFX_BASE.hit * 1.1 },
    ],
    heal: [
      { type: "sine", start: 440, end: 880, dur: 0.25, vol: SFX_BASE.heal },
      { type: "triangle", start: 523, end: 784, dur: 0.3, vol: SFX_BASE.heal * 0.85 },
      { type: "sine", start: 660, end: 990, dur: 0.2, vol: SFX_BASE.heal * 1.05 },
    ],
    data: [
      { type: "square", start: 880, end: 880, dur: 0.06, vol: SFX_BASE.data },
      { type: "sine", start: 1200, end: 960, dur: 0.08, vol: SFX_BASE.data * 0.9 },
      { type: "triangle", start: 740, end: 980, dur: 0.05, vol: SFX_BASE.data * 1.1 },
    ],
  };

  const p = profiles[type][preset] || profiles[type][0];
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.start, now);
  if (p.start !== p.end) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(p.end, 1), now + p.dur);
  }
  gain.gain.setValueAtTime(getEffectiveVolume(p.vol), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + p.dur + 0.02);
}

function loadBgmTrack(name) {
  stopProceduralBgm(name);
}

function loadSfxPool(type, presetIndex) {
  const catalogKey = type === "hit" ? "sfxHit" : type === "heal" ? "sfxHeal" : "sfxData";
  const item = AUDIO_CATALOG[catalogKey][presetIndex];
  const pool = createSfxPool(item.src);
  pool._type = type;
  pool._preset = presetIndex;
  pool.pool.forEach((a) => {
    a.addEventListener("error", () => {}, { once: true });
  });
  sfxPools[type] = pool;
}

function rebuildAudioAssets() {
  loadBgmTrack("lobby");
  loadBgmTrack("game");
  loadSfxPool("hit", audioState.sfxHit);
  loadSfxPool("heal", audioState.sfxHeal);
  loadSfxPool("data", audioState.sfxData);
  applyVolumes();
}

function applyVolumes() {
  if (proceduralNodes.lobby) {
    proceduralNodes.lobby.setVolume(getEffectiveVolume(BGM_BASE.lobby));
  }
  if (proceduralNodes.game) {
    proceduralNodes.game.setVolume(getEffectiveVolume(BGM_BASE.game));
  }

  if (audioState.previewing) {
    updatePreviewVolume();
  }

  ["hit", "heal", "data"].forEach((type) => {
    const base = SFX_BASE[type];
    sfxPools[type]?.pool.forEach((a) => {
      a.volume = getEffectiveVolume(base);
    });
  });
}

function syncDraftFromSaved() {
  draftSettings.muted = audioState.muted;
  draftSettings.masterVolume = audioState.masterVolume;
  draftSettings.bgmLobby = audioState.bgmLobby;
  draftSettings.bgmGame = audioState.bgmGame;
  draftSettings.sfxHit = audioState.sfxHit;
  draftSettings.sfxHeal = audioState.sfxHeal;
  draftSettings.sfxData = audioState.sfxData;
}

function renderSettingsUI() {
  if (!audioUi.muteBtn || !audioUi.volumeSlider) return;

  const isSilent = draftSettings.muted || draftSettings.masterVolume <= 0;
  audioUi.muteBtn.textContent = isSilent ? "🔇" : "🔊";
  audioUi.muteBtn.setAttribute("aria-label", isSilent ? "음소거 해제" : "음소거");
  audioUi.muteBtn.classList.toggle("is-muted", isSilent);
  audioUi.volumeSlider.value = Math.round(draftSettings.masterVolume * 100);

  renderOptionGroup("bgm-lobby-options", "bgmLobby", draftSettings.bgmLobby);
  renderOptionGroup("bgm-game-options", "bgmGame", draftSettings.bgmGame);
  renderSfxCheckboxGroup("sfx-hit-options", "sfxHit", draftSettings.sfxHit);
  renderSfxCheckboxGroup("sfx-heal-options", "sfxHeal", draftSettings.sfxHeal);
  renderSfxCheckboxGroup("sfx-data-options", "sfxData", draftSettings.sfxData);
}

function updateAudioUI() {
  renderSettingsUI();
}

function renderOptionGroup(containerId, stateKey, selectedIndex) {
  const container = audioUi.optionGroups[containerId];
  if (!container) return;

  const catalogKey = stateKey;
  const items = AUDIO_CATALOG[catalogKey];
  container.innerHTML = items.map((item) => `
    <button
      type="button"
      class="option-btn ${item.id === selectedIndex ? "active" : ""}"
      data-setting="${stateKey}"
      data-value="${item.id}"
      aria-pressed="${item.id === selectedIndex}"
    >
      <span class="option-btn-label">${item.label}</span>
      ${item.id === selectedIndex ? '<span class="option-preview-tag">미리듣기</span>' : ""}
    </button>
  `).join("");
}

function renderSfxCheckboxGroup(containerId, stateKey, selectedIndex) {
  const container = audioUi.optionGroups[containerId];
  if (!container) return;

  const items = AUDIO_CATALOG[stateKey];
  container.innerHTML = items.map((item) => `
    <label class="sfx-check-label">
      <input
        type="checkbox"
        class="sfx-check"
        name="${stateKey}"
        data-setting="${stateKey}"
        data-value="${item.id}"
        ${item.id === selectedIndex ? "checked" : ""}
      >
      <span class="sfx-check-box" aria-hidden="true"></span>
      <span class="sfx-check-text">${item.label}</span>
    </label>
  `).join("");
}

function setDraftPreference(key, value) {
  if (key === "bgmLobby" || key === "bgmGame") {
    draftSettings[key] = clampIndex(value, AUDIO_CATALOG[key].length);
    renderSettingsUI();
    previewDraftBgm(key);
    return;
  }

  if (key.startsWith("sfx")) {
    draftSettings[key] = clampIndex(value, AUDIO_CATALOG[key].length);
  }
  renderSettingsUI();
}

function setDraftVolume(value) {
  draftSettings.masterVolume = Math.max(0, Math.min(1, value));
  if (draftSettings.masterVolume > 0) {
    draftSettings.muted = false;
  }
  renderSettingsUI();
  if (audioState.previewing) {
    updatePreviewVolume();
    if (draftSettings.masterVolume <= 0 || draftSettings.muted) {
      stopAllProceduralBgm();
    } else if (audioState.previewCategory) {
      const bgmKey = audioState.previewCategory === "lobby" ? "bgmLobby" : "bgmGame";
      previewDraftBgm(bgmKey);
    }
  }
}

function toggleDraftMute() {
  draftSettings.muted = !draftSettings.muted;
  renderSettingsUI();
  if (audioState.previewing) {
    if (draftSettings.muted) {
      stopAllProceduralBgm();
    } else if (audioState.previewCategory) {
      const bgmKey = audioState.previewCategory === "lobby" ? "bgmLobby" : "bgmGame";
      previewDraftBgm(bgmKey);
    }
  }
}

function handleSfxCheckboxChange(input) {
  const stateKey = input.dataset.setting;
  const value = Number(input.dataset.value);

  document.querySelectorAll(`.sfx-check[data-setting="${stateKey}"]`).forEach((cb) => {
    cb.checked = cb === input;
  });

  draftSettings[stateKey] = value;
}

function commitAudioSettings() {
  audioState.muted = draftSettings.muted;
  audioState.masterVolume = draftSettings.masterVolume;
  audioState.bgmLobby = draftSettings.bgmLobby;
  audioState.bgmGame = draftSettings.bgmGame;
  audioState.sfxHit = draftSettings.sfxHit;
  audioState.sfxHeal = draftSettings.sfxHeal;
  audioState.sfxData = draftSettings.sfxData;

  localStorage.setItem(STORAGE_VOLUME, audioState.masterVolume);
  localStorage.setItem(STORAGE_MUTED, audioState.muted);
  localStorage.setItem(STORAGE_BGM_LOBBY, audioState.bgmLobby);
  localStorage.setItem(STORAGE_BGM_GAME, audioState.bgmGame);
  localStorage.setItem(STORAGE_SFX_HIT, audioState.sfxHit);
  localStorage.setItem(STORAGE_SFX_HEAL, audioState.sfxHeal);
  localStorage.setItem(STORAGE_SFX_DATA, audioState.sfxData);

  rebuildAudioAssets();
  stopBgmPreview();

  if (audioState.unlocked && !audioState.muted && audioState.masterVolume > 0) {
    syncBgmForScreen(getCurrentScreenName());
  } else if (audioState.muted || audioState.masterVolume <= 0) {
    stopAllProceduralBgm();
  }

  renderSettingsUI();
  return true;
}

function setAudioPreference(key, value) {
  setDraftPreference(key, value);
}

function unlockAudio() {
  if (audioState.unlocked) return;
  audioState.unlocked = true;
}

function stopAllBgm() {
  stopAllProceduralBgm();
  audioState.currentBgm = null;
  audioState.previewing = false;
  audioState.previewCategory = null;
}

function playBgm(name) {
  if (audioState.previewing) return;

  const presetIndex = name === "lobby" ? audioState.bgmLobby : audioState.bgmGame;
  const other = name === "lobby" ? "game" : "lobby";

  if (
    audioState.currentBgm === name &&
    !audioState.muted &&
    audioState.masterVolume > 0 &&
    proceduralNodes[name]
  ) {
    return;
  }

  audioState.currentBgm = name;
  stopProceduralBgm(other);

  if (!audioState.unlocked || audioState.muted || audioState.masterVolume <= 0) return;

  startCasualBgm(name, presetIndex);
}

function playSfx(type) {
  const pool = sfxPools[type];
  if (!pool) return;

  if (!audioState.unlocked || audioState.muted || audioState.masterVolume <= 0) return;

  const audio = pool.pool[0];
  if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    playProceduralSfx(type, pool._preset);
    return;
  }

  pool.play();
}

function playHeal() { playSfx("heal"); }
function playHit() { playSfx("hit"); }
function playData() { playSfx("data"); }

function getCurrentScreenName() {
  return document.querySelector(".screen.active")?.id?.replace("screen-", "") || "start";
}

function syncBgmForScreen(screenName) {
  playBgm(screenName === "game" ? "game" : "lobby");
}

function openSettingsPanel() {
  syncDraftFromSaved();
  renderSettingsUI();
}

function bindAudioUnlock() {
  const unlock = () => {
    unlockAudio();
    syncBgmForScreen(getCurrentScreenName());
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function initAudioControls() {
  audioUi.muteBtn = document.getElementById("btn-mute");
  audioUi.volumeSlider = document.getElementById("volume-slider");
  audioUi.optionGroups = {
    "bgm-lobby-options": document.getElementById("bgm-lobby-options"),
    "bgm-game-options": document.getElementById("bgm-game-options"),
    "sfx-hit-options": document.getElementById("sfx-hit-options"),
    "sfx-heal-options": document.getElementById("sfx-heal-options"),
    "sfx-data-options": document.getElementById("sfx-data-options"),
  };

  rebuildAudioAssets();
  updateAudioUI();

  audioUi.muteBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDraftMute();
  });

  audioUi.volumeSlider?.addEventListener("input", (e) => {
    setDraftVolume(Number(e.target.value) / 100);
  });

  Object.entries(audioUi.optionGroups).forEach(([containerId, group]) => {
    if (!group || containerId.startsWith("sfx-")) return;

    group.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-setting]");
      if (!btn || btn.classList.contains("sfx-check")) return;
      setDraftPreference(btn.dataset.setting, Number(btn.dataset.value));
    });
  });

  ["sfx-hit-options", "sfx-heal-options", "sfx-data-options"].forEach((containerId) => {
    audioUi.optionGroups[containerId]?.addEventListener("change", (e) => {
      if (!e.target.classList.contains("sfx-check")) return;
      handleSfxCheckboxChange(e.target);
    });
  });
}

bindAudioUnlock();
initAudioControls();
syncDraftFromSaved();
