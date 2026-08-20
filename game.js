/**
 * CODE RUNNER — 바이러스 러너
 * 바이브코딩 실습용 HTML 게임
 */

// ===== 캐릭터 데이터 =====
const CHARACTERS = [
  {
    id: "bia",
    name: "삐아",
    desc: "AI 밴드를 쓴 노란 병아리. 민첩하게 바이러스를 피하는 타입!",
    maxLives: 3,
    verticalHitRange: 30,
    spriteSize: 80,
    previewSize: 112,
    traits: {
      hitboxLabel: "좁음",
      hitboxSize: 32,
      hitboxDesc: "세로 피격 판정이 좁아 회피에 유리",
      hpDesc: "최대 체력 3 — 짧고 빠른 플레이",
    },
    sprites: {
      front: "assets/sprites/bia/front.png",
      run: [
        "assets/sprites/bia/run/01.png",
        "assets/sprites/bia/run/02.png",
        "assets/sprites/bia/run/03.png",
        "assets/sprites/bia/run/04.png",
        "assets/sprites/bia/run/05.png",
      ],
      recover: "assets/sprites/bia/recover.png",
      hit: "assets/sprites/bia/hit.png",
    },
  },
  {
    id: "or",
    name: "오르",
    desc: "AI 밴드를 쓴 하얀 곰. 단단한 체력으로 오래 버티는 타입!",
    maxLives: 5,
    verticalHitRange: 78,
    spriteSize: 104,
    previewSize: 142,
    traits: {
      hitboxLabel: "넓음",
      hitboxSize: 88,
      hitboxDesc: "세로 피격 판정이 넓어 맞기 쉬움",
      hpDesc: "최대 체력 5 — 안정적인 생존 플레이",
    },
    sprites: {
      front: "assets/sprites/or/front.png",
      run: [
        "assets/sprites/or/run/01.png",
        "assets/sprites/or/run/02.png",
        "assets/sprites/or/run/03.png",
        "assets/sprites/or/run/04.png",
        "assets/sprites/or/run/05.png",
      ],
      recover: "assets/sprites/or/recover.png",
      hit: "assets/sprites/or/hit.png",
    },
  },
];

// ===== 게임 설정 =====
const MAX_LIVES_CAP = 5;
const INVINCIBLE_MS = 1500;
const HIT_ANIM_MS = 700;
const RECOVER_ANIM_MS = 900;
const RUN_FRAME_MS = 120;
const PLAYER_HIT_Y = 0.78; // 충돌 판정 Y 비율 (게임 영역 기준)
const JUMP_MS = 650;
const SLIDE_MS = 650;
const ACTION_COOLDOWN_MS = 200;
const DEFAULT_VERTICAL_HIT_RANGE = 48;

// ===== DOM 요소 =====
const screens = {
  start: document.getElementById("screen-start"),
  select: document.getElementById("screen-select"),
  game: document.getElementById("screen-game"),
  over: document.getElementById("screen-over"),
  settings: document.getElementById("screen-settings"),
};

const ui = {
  score: document.getElementById("score"),
  highScore: document.getElementById("high-score"),
  lives: document.getElementById("lives"),
  time: document.getElementById("time"),
  vaccines: document.getElementById("vaccines"),
  speedLabel: document.getElementById("speed-label"),
  objectsLayer: document.getElementById("objects-layer"),
  player: document.getElementById("player"),
  playerSprite: document.getElementById("player-sprite"),
  gameArea: document.getElementById("game-area"),
  comboPopup: document.getElementById("combo-popup"),
  damageFlash: document.getElementById("damage-flash"),
  previewSprite: document.getElementById("preview-sprite"),
  charName: document.getElementById("char-name"),
  charDesc: document.getElementById("char-desc"),
  charDots: document.getElementById("char-dots"),
  finalScore: document.getElementById("final-score"),
  finalDistance: document.getElementById("final-distance"),
  finalTime: document.getElementById("final-time"),
  finalVaccines: document.getElementById("final-vaccines"),
};

// ===== 게임 상태 =====
let selectedCharIndex = 0;
let highScore = Number(localStorage.getItem("codeRunnerHighScore") || 0);
let gameState = null;
let animationId = null;

ui.highScore.textContent = highScore;

// ===== 스프라이트 =====
function preloadSprites() {
  CHARACTERS.forEach((char) => {
    [char.sprites.front, char.sprites.recover, char.sprites.hit, ...char.sprites.run].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  });
}

function getSelectedCharacter() {
  return CHARACTERS[selectedCharIndex];
}

function setPlayerImage(src) {
  if (ui.playerSprite.getAttribute("src") === src) return;
  ui.playerSprite.src = src;
}

function setPlayerState(state, until = 0) {
  if (!gameState) return;
  gameState.playerState = state;
  gameState.playerStateUntil = until;
}

function updatePlayerAnimation(timestamp) {
  if (!gameState?.running) return;

  const { sprites } = getSelectedCharacter();

  if (gameState.playerStateUntil && timestamp >= gameState.playerStateUntil) {
    setPlayerState("run", 0);
  }

  if (gameState.playerState === "hit") {
    setPlayerImage(sprites.hit);
    return;
  }

  if (gameState.playerState === "recover") {
    setPlayerImage(sprites.recover);
    return;
  }

  const frameIndex = Math.floor(timestamp / RUN_FRAME_MS) % sprites.run.length;
  setPlayerImage(sprites.run[frameIndex]);

  const isInvincible = timestamp < gameState.invincibleUntil;
  ui.player.classList.toggle("invincible", isInvincible);
}

// ===== 화면 전환 =====
function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");

  const tabPlay = document.getElementById("tab-play");
  const tabSettings = document.getElementById("tab-settings");
  if (tabPlay && tabSettings) {
    tabPlay.classList.toggle("active", name === "start");
    tabSettings.classList.toggle("active", name === "settings");
  }

  if (name !== "settings") {
    syncBgmForScreen(name);
  }
}

function getCharacterMaxLives(char = getSelectedCharacter()) {
  return char.maxLives;
}

function getCharacterVerticalHitRange(char = getSelectedCharacter()) {
  return char.verticalHitRange ?? DEFAULT_VERTICAL_HIT_RANGE;
}

function applyCharacterVisuals(char) {
  const isCompact = window.matchMedia("(max-width: 380px)").matches;
  const scale = isCompact ? 0.85 : 1;
  const spriteSize = Math.round(char.spriteSize * scale);
  const previewSize = Math.round(char.previewSize * scale);

  ui.player.dataset.charId = char.id;
  ui.player.style.setProperty("--sprite-size", `${spriteSize}px`);
  ui.previewSprite.style.width = `${previewSize}px`;
  ui.previewSprite.style.height = `${previewSize}px`;
}

function renderCharacterTraits(char) {
  const traitsEl = document.getElementById("char-traits");
  if (!traitsEl) return;

  const hearts = "❤️".repeat(char.maxLives);
  const emptyHearts = "🤍".repeat(MAX_LIVES_CAP - char.maxLives);
  const hitboxClass = char.verticalHitRange <= DEFAULT_VERTICAL_HIT_RANGE ? "small" : "large";

  traitsEl.innerHTML = `
    <div class="trait-card">
      <span class="trait-icon">❤️</span>
      <div class="trait-body">
        <span class="trait-title">최대 체력</span>
        <span class="trait-hearts" aria-label="최대 체력 ${char.maxLives}">${hearts}${emptyHearts}</span>
        <span class="trait-desc">${char.traits.hpDesc}</span>
      </div>
      <span class="trait-badge">${char.maxLives} HP</span>
    </div>
    <div class="trait-card trait-card-hitbox">
      <span class="trait-icon">↕️</span>
      <div class="trait-body">
        <span class="trait-title">세로 피격 범위</span>
        <span class="trait-desc">${char.traits.hitboxDesc}</span>
      </div>
      <div class="trait-meter-vertical" aria-hidden="true">
        <span class="trait-meter-fill ${hitboxClass}" style="height: ${char.traits.hitboxSize}%"></span>
      </div>
      <span class="trait-badge ${hitboxClass}">${char.traits.hitboxLabel}</span>
    </div>
  `;
}

// ===== 캐릭터 선택 UI =====
function renderCharacterSelect() {
  const char = getSelectedCharacter();

  ui.previewSprite.src = char.sprites.front;
  ui.previewSprite.alt = char.name;
  ui.charName.textContent = char.name;
  ui.charDesc.textContent = char.desc;
  applyCharacterVisuals(char);
  renderCharacterTraits(char);

  ui.charDots.innerHTML = CHARACTERS.map((_, i) =>
    `<span class="${i === selectedCharIndex ? "active" : ""}"></span>`
  ).join("");
}

function nextCharacter(dir) {
  selectedCharIndex = (selectedCharIndex + dir + CHARACTERS.length) % CHARACTERS.length;
  renderCharacterSelect();
}

// ===== 목숨 UI =====
function renderLives(count, maxLives = gameState?.maxLives ?? getCharacterMaxLives()) {
  let html = "";
  for (let i = 0; i < maxLives; i++) {
    html += i < count ? "❤️" : "🤍";
  }
  ui.lives.innerHTML = html;
}

// ===== 난이도 =====
function getDifficulty(elapsedSec) {
  if (elapsedSec < 30) return { label: "EASY", speed: 180, spawn: 1400 };
  if (elapsedSec < 60) return { label: "NORMAL", speed: 240, spawn: 1100 };
  if (elapsedSec < 120) return { label: "HARD", speed: 310, spawn: 850 };
  return { label: "INSANE", speed: 400, spawn: 650 };
}

// ===== 게임 오브젝트 =====
function createObject(type, lane) {
  const el = document.createElement("div");
  el.className = `game-object ${type}`;
  el.textContent = type === "virus" ? "🦠" : "💉";
  el.dataset.lane = lane;
  el.dataset.type = type;
  el.dataset.passed = "false";
  el.dataset.hit = "false";
  el.style.left = `${lane * 33.333}%`;
  el.style.top = "-60px";
  ui.objectsLayer.appendChild(el);

  return {
    el,
    lane,
    type,
    y: -60,
    passed: false,
    hit: false,
  };
}

function setPlayerLane(lane) {
  ui.player.style.left = `${lane * 33.333}%`;
}

function isGameActive() {
  return gameState?.running && screens.game.classList.contains("active");
}

// ===== 게임 시작 / 종료 =====
function startGame() {
  const char = getSelectedCharacter();

  ui.playerSprite.alt = char.name;
  ui.objectsLayer.innerHTML = "";
  ui.comboPopup.classList.add("hidden");
  ui.player.classList.remove("invincible", "jumping", "sliding");

  gameState = {
    running: true,
    lane: 1,
    lives: char.maxLives,
    maxLives: char.maxLives,
    verticalHitRange: char.verticalHitRange,
    score: 0,
    vaccines: 0,
    distance: 0,
    elapsed: 0,
    combo: 0,
    invincibleUntil: 0,
    playerState: "run",
    playerStateUntil: 0,
    playerAction: "ground",
    actionUntil: 0,
    actionCooldownUntil: 0,
    objects: [],
    lastSpawn: 0,
    lastScoreTick: 0,
    lastTime: performance.now(),
  };

  setPlayerImage(char.sprites.run[0]);
  applyCharacterVisuals(char);

  setPlayerLane(1);
  renderLives(char.maxLives, char.maxLives);
  ui.score.textContent = "0";
  ui.vaccines.textContent = "0";
  ui.time.textContent = "0s";
  ui.speedLabel.textContent = "EASY";

  showScreen("game");
  ui.gameArea.focus();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameState.running = false;
  cancelAnimationFrame(animationId);

  if (gameState.score > highScore) {
    highScore = gameState.score;
    localStorage.setItem("codeRunnerHighScore", highScore);
    ui.highScore.textContent = highScore;
  }

  ui.finalScore.textContent = gameState.score.toLocaleString();
  ui.finalDistance.textContent = `${Math.floor(gameState.distance)}m`;
  ui.finalTime.textContent = `${Math.floor(gameState.elapsed)}s`;
  ui.finalVaccines.textContent = gameState.vaccines;

  showScreen("over");
}

function stopGame() {
  if (!gameState?.running) return;

  gameState.running = false;
  cancelAnimationFrame(animationId);
  ui.objectsLayer.innerHTML = "";
  ui.comboPopup.classList.add("hidden");
  ui.damageFlash.classList.add("hidden");
  ui.player.classList.remove("invincible", "jumping", "sliding");
  gameState = null;

  showScreen("start");
}

// ===== 플레이어 이동 / 액션 =====
function moveLane(dir) {
  if (!gameState?.running) return;

  const next = gameState.lane + dir;
  if (next < 0 || next > 2) return;

  gameState.lane = next;
  setPlayerLane(next);
}

function resetPlayerAction() {
  if (!gameState) return;
  gameState.playerAction = "ground";
  gameState.actionUntil = 0;
  ui.player.classList.remove("jumping", "sliding");
}

function jump() {
  if (!gameState?.running) return;
  const now = performance.now();
  if (gameState.playerAction !== "ground") return;
  if (now < gameState.actionCooldownUntil) return;

  gameState.playerAction = "jump";
  gameState.actionUntil = now + JUMP_MS;
  gameState.actionCooldownUntil = now + ACTION_COOLDOWN_MS;
  ui.player.classList.remove("sliding");
  ui.player.classList.add("jumping");
}

function slide() {
  if (!gameState?.running) return;
  const now = performance.now();
  if (gameState.playerAction !== "ground") return;
  if (now < gameState.actionCooldownUntil) return;

  gameState.playerAction = "slide";
  gameState.actionUntil = now + SLIDE_MS;
  gameState.actionCooldownUntil = now + ACTION_COOLDOWN_MS;
  ui.player.classList.remove("jumping");
  ui.player.classList.add("sliding");
}

function updatePlayerAction(timestamp) {
  if (!gameState?.running) return;
  if (gameState.actionUntil && timestamp >= gameState.actionUntil) {
    resetPlayerAction();
  }
}

function handleGameInput(action) {
  if (!isGameActive()) return;

  if (action === "left") moveLane(-1);
  else if (action === "right") moveLane(1);
  else if (action === "up") jump();
  else if (action === "down") slide();
}

// ===== 충돌 / 아이템 처리 =====
function showCombo(text) {
  ui.comboPopup.textContent = text;
  ui.comboPopup.classList.remove("hidden");
  clearTimeout(showCombo._timer);
  showCombo._timer = setTimeout(() => ui.comboPopup.classList.add("hidden"), 800);
}

function takeDamage() {
  const now = performance.now();
  if (now < gameState.invincibleUntil) return false;

  gameState.lives -= 1;
  gameState.combo = 0;
  gameState.invincibleUntil = now + INVINCIBLE_MS;
  setPlayerState("hit", now + HIT_ANIM_MS);

  renderLives(gameState.lives);
  playHit();
  ui.damageFlash.classList.remove("hidden");
  setTimeout(() => ui.damageFlash.classList.add("hidden"), 300);

  if (gameState.lives <= 0) {
    endGame();
  }
  return true;
}

function collectVaccine() {
  const now = performance.now();
  gameState.vaccines += 1;
  gameState.lives = Math.min(gameState.lives + 1, gameState.maxLives);
  gameState.score += 50;
  setPlayerState("recover", now + RECOVER_ANIM_MS);
  playHeal();
  renderLives(gameState.lives);
  ui.vaccines.textContent = gameState.vaccines;
  ui.score.textContent = gameState.score;
  showCombo("💉 VACCINE +1");
}

function checkCollisions(obj, playerY) {
  if (obj.hit) return;
  if (Math.abs(obj.y - playerY) > gameState.verticalHitRange) return;
  if (obj.lane !== gameState.lane) return;

  if (obj.type === "virus" && (gameState.playerAction === "jump" || gameState.playerAction === "slide")) {
    obj.passed = true;
    obj.el.classList.add("passed");
    gameState.combo += 1;
    gameState.score += 15 + gameState.combo * 3;
    ui.score.textContent = gameState.score;
    if (gameState.combo >= 2) {
      showCombo(`DODGE! COMBO x${gameState.combo}`);
    }
    return;
  }

  obj.hit = true;
  obj.el.style.opacity = "0.4";

  if (obj.type === "virus") {
    takeDamage();
  } else if (obj.type === "vaccine") {
    collectVaccine();
    obj.el.remove();
  }
}

function markPassed(obj) {
  if (obj.passed || obj.type !== "virus") return;
  obj.passed = true;
  obj.el.classList.add("passed");

  if (!obj.hit) {
    gameState.combo += 1;
    gameState.score += 20 + gameState.combo * 5;
    ui.score.textContent = gameState.score;

    if (gameState.combo >= 2) {
      showCombo(`DODGE! COMBO x${gameState.combo}`);
    }
  }
}

// ===== 메인 게임 루프 =====
function gameLoop(timestamp) {
  if (!gameState?.running) return;

  const dt = (timestamp - gameState.lastTime) / 1000;
  gameState.lastTime = timestamp;
  gameState.elapsed += dt;
  gameState.distance += dt * 12;

  const diff = getDifficulty(gameState.elapsed);
  ui.speedLabel.textContent = diff.label;
  ui.time.textContent = `${Math.floor(gameState.elapsed)}s`;

  // 1초마다 +10점
  if (timestamp - gameState.lastScoreTick >= 1000) {
    gameState.score += 10;
    ui.score.textContent = gameState.score;
    gameState.lastScoreTick = timestamp;
    playData();
  }

  // 오브젝트 생성
  if (timestamp - gameState.lastSpawn >= diff.spawn) {
    const lane = Math.floor(Math.random() * 3);
    const isVaccine = Math.random() < 0.22;
    gameState.objects.push(createObject(isVaccine ? "vaccine" : "virus", lane));
    gameState.lastSpawn = timestamp;
  }

  const areaHeight = ui.gameArea.clientHeight;
  const playerY = areaHeight * PLAYER_HIT_Y;

  // 오브젝트 이동 & 충돌
  gameState.objects = gameState.objects.filter((obj) => {
    obj.y += diff.speed * dt;
    obj.el.style.top = `${obj.y}px`;

    checkCollisions(obj, playerY);

    if (obj.y > playerY + 20 && !obj.passed) {
      markPassed(obj);
    }

    if (obj.y > areaHeight + 60) {
      obj.el.remove();
      return false;
    }
    return true;
  });

  updatePlayerAnimation(timestamp);
  updatePlayerAction(timestamp);

  animationId = requestAnimationFrame(gameLoop);
}

// ===== 입력 =====
document.addEventListener("keydown", (e) => {
  if (!isGameActive()) return;

  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    e.preventDefault();
    handleGameInput("left");
  } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    e.preventDefault();
    handleGameInput("right");
  } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    e.preventDefault();
    handleGameInput("up");
  } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    e.preventDefault();
    handleGameInput("down");
  }
});

document.querySelectorAll(".touch-btn").forEach((btn) => {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleGameInput(btn.dataset.action);
  });
});

ui.gameArea.addEventListener("click", () => {
  if (isGameActive()) ui.gameArea.focus();
});

// 터치 스와이프 (모바일)
let touchStartX = 0;
let touchStartY = 0;
ui.gameArea.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

ui.gameArea.addEventListener("touchend", (e) => {
  if (!gameState?.running) return;
  const diffX = e.changedTouches[0].clientX - touchStartX;
  const diffY = e.changedTouches[0].clientY - touchStartY;

  if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

  if (Math.abs(diffX) > Math.abs(diffY)) {
    handleGameInput(diffX > 0 ? "right" : "left");
  } else {
    handleGameInput(diffY > 0 ? "down" : "up");
  }
}, { passive: true });

// ===== 버튼 이벤트 =====
document.getElementById("btn-start").addEventListener("click", () => {
  renderCharacterSelect();
  showScreen("select");
});

document.getElementById("tab-play")?.addEventListener("click", () => showScreen("start"));

document.getElementById("char-prev").addEventListener("click", () => nextCharacter(-1));
document.getElementById("char-next").addEventListener("click", () => nextCharacter(1));
document.getElementById("btn-select").addEventListener("click", startGame);
document.getElementById("btn-back-start").addEventListener("click", () => showScreen("start"));
document.getElementById("btn-restart").addEventListener("click", startGame);
document.getElementById("btn-quit").addEventListener("click", stopGame);
document.getElementById("btn-char-select").addEventListener("click", () => {
  renderCharacterSelect();
  showScreen("select");
});

function openSettingsScreen() {
  openSettingsPanel();
  showScreen("settings");
}

function closeSettingsScreen() {
  stopBgmPreview();
  syncDraftFromSaved();
  showScreen("start");
}

function saveSettingsScreen() {
  commitAudioSettings();
  const msg = document.getElementById("settings-save-msg");
  if (msg) {
    msg.classList.remove("hidden");
    clearTimeout(saveSettingsScreen._timer);
    saveSettingsScreen._timer = setTimeout(() => msg.classList.add("hidden"), 1800);
  }
}

document.getElementById("btn-settings-gear")?.addEventListener("click", openSettingsScreen);
document.getElementById("tab-settings")?.addEventListener("click", openSettingsScreen);
document.getElementById("btn-settings-back")?.addEventListener("click", closeSettingsScreen);
document.getElementById("btn-settings-save")?.addEventListener("click", saveSettingsScreen);

// 초기화
preloadSprites();
renderCharacterSelect();
