/**
 * CODE RUNNER — 바이러스 러너
 * 바이브코딩 실습용 HTML 게임
 */

// ===== 캐릭터 데이터 =====
const CHARACTERS = [
  {
    id: "bia",
    name: "삐아",
    desc: "AI 밴드를 쓴 노란 병아리. 균형 잡힌 CODE RUNNER!",
    stats: ["속도 ★★★", "이동 ★★★", "체력 ★★★"],
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
    desc: "AI 밴드를 쓴 하얀 곰. 느리지만 단단한 CODE RUNNER!",
    stats: ["속도 ★★", "이동 ★★★★", "체력 ★★★★"],
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
const MAX_LIVES = 5;
const INVINCIBLE_MS = 1500;
const HIT_ANIM_MS = 700;
const RECOVER_ANIM_MS = 900;
const RUN_FRAME_MS = 120;
const PLAYER_HIT_Y = 0.78; // 충돌 판정 Y 비율 (게임 영역 기준)
const COLLISION_THRESHOLD = 48;

// ===== DOM 요소 =====
const screens = {
  start: document.getElementById("screen-start"),
  select: document.getElementById("screen-select"),
  game: document.getElementById("screen-game"),
  over: document.getElementById("screen-over"),
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
  syncBgmForScreen(name);
}

// ===== 캐릭터 선택 UI =====
function renderCharacterSelect() {
  const char = getSelectedCharacter();

  ui.previewSprite.src = char.sprites.front;
  ui.previewSprite.alt = char.name;
  ui.charName.textContent = char.name;
  ui.charDesc.textContent = char.desc;

  const statsEl = document.querySelector(".char-stats");
  statsEl.innerHTML = char.stats.map((s) => `<span>${s}</span>`).join("");

  ui.charDots.innerHTML = CHARACTERS.map((_, i) =>
    `<span class="${i === selectedCharIndex ? "active" : ""}"></span>`
  ).join("");
}

function nextCharacter(dir) {
  selectedCharIndex = (selectedCharIndex + dir + CHARACTERS.length) % CHARACTERS.length;
  renderCharacterSelect();
}

// ===== 목숨 UI =====
function renderLives(count) {
  let html = "";
  for (let i = 0; i < MAX_LIVES; i++) {
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
  ui.player.classList.remove("invincible");

  gameState = {
    running: true,
    lane: 1,
    lives: MAX_LIVES,
    score: 0,
    vaccines: 0,
    distance: 0,
    elapsed: 0,
    combo: 0,
    invincibleUntil: 0,
    playerState: "run",
    playerStateUntil: 0,
    objects: [],
    lastSpawn: 0,
    lastScoreTick: 0,
    lastTime: performance.now(),
  };

  setPlayerImage(char.sprites.run[0]);

  setPlayerLane(1);
  renderLives(MAX_LIVES);
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
  ui.player.classList.remove("invincible");
  gameState = null;

  showScreen("start");
}

// ===== 플레이어 이동 =====
function moveLane(dir) {
  if (!gameState?.running) return;

  const next = gameState.lane + dir;
  if (next < 0 || next > 2) return;

  gameState.lane = next;
  setPlayerLane(next);
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
  gameState.lives = Math.min(gameState.lives + 1, MAX_LIVES);
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
  if (Math.abs(obj.y - playerY) > COLLISION_THRESHOLD) return;
  if (obj.lane !== gameState.lane) return;

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

  animationId = requestAnimationFrame(gameLoop);
}

// ===== 입력 =====
document.addEventListener("keydown", (e) => {
  if (!isGameActive()) return;

  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    e.preventDefault();
    moveLane(-1);
  } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    e.preventDefault();
    moveLane(1);
  }
});

ui.gameArea.addEventListener("click", () => {
  if (isGameActive()) ui.gameArea.focus();
});

// 터치 스와이프 (모바일)
let touchStartX = 0;
ui.gameArea.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

ui.gameArea.addEventListener("touchend", (e) => {
  if (!gameState?.running) return;
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(diff) < 30) return;
  moveLane(diff > 0 ? 1 : -1);
}, { passive: true });

// ===== 버튼 이벤트 =====
document.getElementById("btn-start").addEventListener("click", () => {
  renderCharacterSelect();
  showScreen("select");
});

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

// 초기화
preloadSprites();
renderCharacterSelect();
