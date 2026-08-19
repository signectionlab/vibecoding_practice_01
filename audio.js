/**
 * CODE RUNNER — 오디오 매니저
 * CC0 / 무료 라이선스 음원 사용
 */

const AUDIO = {
  lobbyBgm: "assets/audio/lobby-bgm.mp3",
  gameBgm: "assets/audio/game-bgm.mp3",
  heal: "assets/audio/heal.ogg",
  hit: "assets/audio/hit.ogg",
  data: "assets/audio/data.ogg",
};

const STORAGE_VOLUME = "codeRunnerVolume";
const STORAGE_MUTED = "codeRunnerMuted";

const BGM_BASE = { lobby: 0.32, game: 0.28 };
const SFX_BASE = { heal: 0.55, hit: 0.65, data: 0.35 };

const audioState = {
  unlocked: false,
  muted: localStorage.getItem(STORAGE_MUTED) === "true",
  masterVolume: Number(localStorage.getItem(STORAGE_VOLUME) ?? 0.7),
  currentBgm: null,
};

const tracks = {
  lobby: createBgm(AUDIO.lobbyBgm),
  game: createBgm(AUDIO.gameBgm),
};

const sfx = {
  heal: createSfx(AUDIO.heal),
  hit: createSfx(AUDIO.hit),
  data: createSfx(AUDIO.data),
};

const audioUi = {
  muteBtn: null,
  volumeSlider: null,
};

function createBgm(src) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  return audio;
}

function createSfx(src) {
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
      audio.play().catch(() => {});
    },
  };
}

function getEffectiveVolume(base) {
  if (audioState.muted || audioState.masterVolume <= 0) return 0;
  return base * audioState.masterVolume;
}

function applyVolumes() {
  tracks.lobby.volume = getEffectiveVolume(BGM_BASE.lobby);
  tracks.game.volume = getEffectiveVolume(BGM_BASE.game);

  sfx.heal.pool.forEach((a) => { a.volume = getEffectiveVolume(SFX_BASE.heal); });
  sfx.hit.pool.forEach((a) => { a.volume = getEffectiveVolume(SFX_BASE.hit); });
  sfx.data.pool.forEach((a) => { a.volume = getEffectiveVolume(SFX_BASE.data); });
}

function updateAudioUI() {
  if (!audioUi.muteBtn || !audioUi.volumeSlider) return;

  const isSilent = audioState.muted || audioState.masterVolume <= 0;
  audioUi.muteBtn.textContent = isSilent ? "🔇" : "🔊";
  audioUi.muteBtn.setAttribute("aria-label", isSilent ? "음소거 해제" : "음소거");
  audioUi.muteBtn.classList.toggle("is-muted", isSilent);
  audioUi.volumeSlider.value = Math.round(audioState.masterVolume * 100);
}

function setMasterVolume(value) {
  audioState.masterVolume = Math.max(0, Math.min(1, value));
  localStorage.setItem(STORAGE_VOLUME, audioState.masterVolume);

  if (audioState.masterVolume > 0 && audioState.muted) {
    audioState.muted = false;
    localStorage.setItem(STORAGE_MUTED, "false");
  }

  applyVolumes();
  updateAudioUI();

  if (audioState.unlocked && !audioState.muted && audioState.currentBgm) {
    tracks[audioState.currentBgm].play().catch(() => {});
  }
}

function toggleMute() {
  audioState.muted = !audioState.muted;
  localStorage.setItem(STORAGE_MUTED, audioState.muted);

  if (audioState.muted) {
    Object.values(tracks).forEach((track) => track.pause());
  } else {
    applyVolumes();
    if (audioState.unlocked && audioState.currentBgm) {
      tracks[audioState.currentBgm].play().catch(() => {});
    }
  }

  updateAudioUI();
}

function unlockAudio() {
  if (audioState.unlocked) return;
  audioState.unlocked = true;

  Object.values(tracks).forEach((track) => {
    track.play().then(() => track.pause()).catch(() => {});
    track.currentTime = 0;
  });
}

function stopAllBgm() {
  Object.values(tracks).forEach((track) => {
    track.pause();
    track.currentTime = 0;
  });
  audioState.currentBgm = null;
}

function playBgm(name) {
  if (
    audioState.currentBgm === name &&
    !audioState.muted &&
    audioState.masterVolume > 0 &&
    tracks[name] &&
    !tracks[name].paused
  ) {
    return;
  }

  audioState.currentBgm = name;
  if (!audioState.unlocked || audioState.muted || audioState.masterVolume <= 0) return;

  applyVolumes();

  Object.entries(tracks).forEach(([key, track]) => {
    if (key === name) {
      track.play().catch(() => {});
    } else {
      track.pause();
      track.currentTime = 0;
    }
  });
}

function playHeal() { sfx.heal.play(); }
function playHit() { sfx.hit.play(); }
function playData() { sfx.data.play(); }

function syncBgmForScreen(screenName) {
  playBgm(screenName === "game" ? "game" : "lobby");
}

function bindAudioUnlock() {
  const unlock = () => {
    unlockAudio();
    syncBgmForScreen(document.querySelector(".screen.active")?.id?.replace("screen-", "") || "start");
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function initAudioControls() {
  audioUi.muteBtn = document.getElementById("btn-mute");
  audioUi.volumeSlider = document.getElementById("volume-slider");

  if (!audioUi.muteBtn || !audioUi.volumeSlider) return;

  applyVolumes();
  updateAudioUI();

  audioUi.muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMute();
  });

  audioUi.volumeSlider.addEventListener("input", (e) => {
    setMasterVolume(Number(e.target.value) / 100);
  });
}

bindAudioUnlock();
initAudioControls();
