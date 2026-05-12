const GOAL = 36; // 3 points per level × 12 levels
const MAX_LEVEL = 12;
const BUTTON_W = 130;
const BUTTON_H = 40;
const SAFE_GAP = 10;
const livesIcons = ['', '❤️', '❤️❤️', '❤️❤️❤️'];

const taunts = [
  "lmao no.", "skill issue", "that was embarrassing", "oh honey...",
  "not even close 💀", "are you even trying?", "the label was RIGHT THERE",
  "incredible. wrong again.", "my grandma clicks faster", "bro what",
  "you had one job", "classic.", "use your eyes???",
  "it literally told you which one", "maybe try glasses",
  "how 💀", "touch grass and try again", "LMAOOO",
  "that hurt to watch", "respectfully, you're cooked",
  "the audacity", "delete your account", "truly shocking",
];

const deathTaunts = [
  "Uninstall your hands.",
  "We're genuinely concerned for you.",
  "This was painful to watch.",
  "Maybe try a different hobby.",
  "Error 404: Skill not found.",
  "Even the buttons feel bad for you.",
  "You died at level " + "?. Incredible.",
  "Your mouse called. It quit.",
];

const labels = [
  "Click me", "Yes this one", "HERE", "Not that one", "Obviously me",
  "This button", "Correct", "Me!!!", "Pick me", "Right here",
  "This one", "Choose me", "Press here", "→ ME ←", "YES",
  "Over here", "No wait, me", "CLICK!", "Try me", "I'm the one",
];

// Level definitions — each level has a name + description shown briefly
const LEVEL_DEFS = [
  { name: "TUTORIAL",    desc: "Just click the right one. Easy.",              color: "var(--green)"  },
  { name: "MOVING",      desc: "Buttons move now. Keep up.",                   color: "var(--green)"  },
  { name: "FASTER",      desc: "Speed increased. You got this... maybe.",      color: "var(--green)"  },
  { name: "THE TARGET RUNS", desc: "The correct button moves too now. Fun.",  color: "var(--yellow)" },
  { name: "CHAOS",       desc: "Everything moves. Reshuffles on wrong click.", color: "var(--yellow)" },
  { name: "BLINK",       desc: "Buttons randomly go invisible. Stay focused.", color: "var(--yellow)" },
  { name: "SWAP",        desc: "Labels swap randomly. Read fast.",             color: "var(--accent2)"},
  { name: "FAKE NEWS",   desc: "Instruction flickers to wrong labels. Trust nothing.", color: "var(--accent2)"},
  { name: "SHRINK",      desc: "Buttons shrink as time passes. Click fast.",   color: "var(--accent)" },
  { name: "SPEED DEMON", desc: "Everything is faster. Much faster.",           color: "var(--accent)" },
  { name: "NIGHTMARE",   desc: "All mechanics active. We're sorry.",           color: "var(--accent)" },
  { name: "FINAL BOSS",  desc: "One chance. One life. One click. Good luck.", color: "#ff00ff"       },
];

let score = 0, lives = 3, level = 1, combo = 0, attempts = 0, bestScore = 0;
let timer = 0; let timerInterval = null;
let targetIdx = 0, buttons = [], moveTimer = null, switchTimer = null;
let blinkTimer = null, shrinkTimer = null, fakeTimer = null, chaosTimer = null;
let finalBossJitterTimer = null, finalBossFlickerTimer = null;
let gameActive = false;
let shrinkAmount = 1.0;
let slowMotionUntil = 0;
let buttonsFrozenUntil = 0;
let comboSlowAwarded = false;
let comboFreezeAwarded = false;
let bestCelebratedThisRun = false;
let runawayBtn = null;
let musicRampTimer = null;

const sounds = {
  correct: new Audio('sound/correct.mp3'),
  combo: new Audio('sound/combo.mp3'),
  levelup: new Audio('sound/levelup.mp3'),
  gameover: new Audio('sound/gameover.mp3'),
  wrong: new Audio('sound/wrong.mp3'),
  music: new Audio('sound/music.mp3'),
};

sounds.music.loop = true;
sounds.music.volume = 0.8;

const soundPools = {};
const soundPoolIndex = {};

Object.keys(sounds).forEach(name => {
  sounds[name].preload = 'auto';
  sounds[name].load();

  if (name === 'music') return;

  soundPools[name] = Array.from({ length: name === 'correct' ? 6 : 3 }, () => {
    const audio = new Audio(sounds[name].src);
    audio.preload = 'auto';
    audio.load();
    return audio;
  });
  soundPoolIndex[name] = 0;
});

function playSound(name, volume = 1) {
  if (!sounds[name]) return;

  if (name !== 'music' && soundPools[name]) {
    const pool = soundPools[name];
    const audio = pool[soundPoolIndex[name] % pool.length];
    soundPoolIndex[name]++;
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
    return;
  }

  sounds[name].pause();
  sounds[name].currentTime = 0;
  sounds[name].volume = volume;

  sounds[name].play().catch(() => {});
}

function $(id) { return document.getElementById(id); }

// --- GAME JUICE HELPERS ---
function getClickPoint(event, fallbackEl) {
  if (event && typeof event.clientX === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  const rect = fallbackEl.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function pointInArena(point) {
  const rect = $('arena').getBoundingClientRect();
  return { x: point.x - rect.left, y: point.y - rect.top };
}

function shakeArena(type = 'small') {
  const arena = $('arena');
  arena.classList.remove('shake-small', 'shake-level', 'shake-big');
  void arena.offsetWidth;
  arena.classList.add(`shake-${type}`);
}

function burstParticles(point, color = 'var(--green)', count = 12, power = 44) {
  const arena = $('arena');
  const origin = pointInArena(point);
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
    const distance = power * (0.45 + Math.random() * 0.75);
    particle.className = 'particle';
    particle.style.left = origin.x + 'px';
    particle.style.top = origin.y + 'px';
    particle.style.background = color;
    particle.style.color = color;
    particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
    particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
    particle.style.setProperty('--size', 3 + Math.random() * 4 + 'px');
    fragment.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }

  arena.appendChild(fragment);
}

function popButton(btn, className = 'btn-pop') {
  btn.classList.remove(className);
  void btn.offsetWidth;
  btn.classList.add(className);
  setTimeout(() => btn.classList.remove(className), 260);
}

function showRewardText(text, color = 'var(--yellow)') {
  const arena = $('arena');
  const reward = document.createElement('div');
  reward.className = 'reward-pop';
  reward.textContent = text;
  reward.style.color = color;
  arena.appendChild(reward);
  reward.addEventListener('animationend', () => reward.remove(), { once: true });
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function updateMusicTension() {
  const rate = Math.min(1.26, 1 + (level - 1) * 0.022);
  sounds.music.volume = level >= 10 ? 0.95 : level >= 7 ? 0.88 : 0.8;
  clearInterval(musicRampTimer);
  musicRampTimer = setInterval(() => {
    const diff = rate - sounds.music.playbackRate;
    if (Math.abs(diff) < 0.005) {
      sounds.music.playbackRate = rate;
      clearInterval(musicRampTimer);
      musicRampTimer = null;
      return;
    }
    sounds.music.playbackRate += diff * 0.25;
  }, 60);
}

function celebrateNewBest() {
  if (bestCelebratedThisRun) return;
  bestCelebratedThisRun = true;
  toast('NEW BEST. THE GAME IS FURIOUS.', 'var(--yellow)');
  document.body.classList.add('best-score-glow');
  showRewardText('NEW BEST', 'var(--yellow)');
  burstParticles({ x: window.innerWidth / 2, y: 120 }, 'var(--yellow)', 26, 80);
  setTimeout(() => document.body.classList.remove('best-score-glow'), 900);
}

function clearJuiceEffects() {
  document.body.classList.remove('final-boss-mode', 'best-score-glow');
  $('arena').classList.remove('shake-small', 'shake-level', 'shake-big', 'freeze-buttons');
  $('instruction').classList.remove('panic-flicker', 'fake-gameover-flash');
  buttons.forEach(btn => {
    btn.classList.remove('btn-pop', 'correct-bounce', 'wrong-flash', 'chaos-rotate', 'runaway');
    btn.style.removeProperty('--btn-rotate');
    btn.style.removeProperty('--jitter-x');
    btn.style.removeProperty('--jitter-y');
  });
  runawayBtn = null;
}

function getMoveSpeed() {
  const base = Math.max(180, 1600 - level * 120);
  return Date.now() < slowMotionUntil ? Math.round(base * 1.85) : base;
}

function buttonsAreFrozen() {
  return Date.now() < buttonsFrozenUntil;
}

function triggerComboRewards(point) {
  if (combo === 5) {
    showRewardText('COMBO x5', 'var(--green)');
    burstParticles(point, 'var(--yellow)', 24, 74);
    toast('combo x5. okay, main character.', 'var(--green)');
  }

  if (combo === 8 && !comboSlowAwarded) {
    comboSlowAwarded = true;
    slowMotionUntil = Date.now() + 1400;
    showRewardText('SLOW-MO', 'var(--accent2)');
    toast('SLOW MOTION: the buttons are scared.', 'var(--accent2)');
    startMoving();
  }

  if (combo === 10 && !comboFreezeAwarded) {
    comboFreezeAwarded = true;
    buttonsFrozenUntil = Date.now() + 900;
    $('arena').classList.add('freeze-buttons');
    showRewardText('FREEZE', 'var(--yellow)');
    toast('FREEZE FRAME. CLICK WITH PURPOSE.', 'var(--yellow)');
    setTimeout(() => $('arena').classList.remove('freeze-buttons'), 900);
  }
}

function applyFinalBossMode() {
  const active = gameActive && level === MAX_LEVEL;
  document.body.classList.toggle('final-boss-mode', active);
  $('instruction').classList.toggle('panic-flicker', active);
  if (!active) $('target-label').style.opacity = '1';
}

function runChaosEvent() {
  if (!gameActive || buttons.length === 0 || Math.random() > 0.02) return;

  const eventType = Math.floor(Math.random() * 4);

  if (eventType === 0) {
    const affected = [...buttons];
    const originals = affected.map(btn => btn.textContent);
    const fake = buttons[targetIdx] ? buttons[targetIdx].textContent : 'NOPE';
    affected.forEach(btn => { btn.textContent = fake; });
    toast('EVERY BUTTON IS DEFINITELY THE SAME. TRUST.', 'var(--accent2)');
    setTimeout(() => {
      affected.forEach((btn, idx) => {
        if (btn.isConnected && originals[idx]) btn.textContent = originals[idx];
      });
      if (buttons[targetIdx]) $('target-label').textContent = '"' + buttons[targetIdx].textContent + '"';
    }, 650);
  } else if (eventType === 1) {
    const affected = [...buttons];
    affected.forEach(btn => {
      btn.style.setProperty('--btn-rotate', (Math.random() * 18 - 9).toFixed(1) + 'deg');
      btn.classList.add('chaos-rotate');
    });
    toast('BUTTONS GOT DIZZY.', 'var(--yellow)');
    setTimeout(() => {
      affected.forEach(btn => {
        if (!btn.isConnected) return;
        btn.classList.remove('chaos-rotate');
        btn.style.removeProperty('--btn-rotate');
      });
    }, 700);
  } else if (eventType === 2) {
    $('instruction').classList.add('fake-gameover-flash');
    toast('GAME OVER. kidding. maybe.', 'var(--accent)');
    setTimeout(() => $('instruction').classList.remove('fake-gameover-flash'), 500);
  } else {
    runawayBtn = buttons[Math.floor(Math.random() * buttons.length)];
    runawayBtn.classList.add('runaway');
    toast('ONE BUTTON HAS CHOSEN COWARDICE.', 'var(--green)');
    setTimeout(() => {
      if (runawayBtn) runawayBtn.classList.remove('runaway');
      runawayBtn = null;
    }, 1600);
  }
}

function loadBestScore() {
  try {
    bestScore = Number(localStorage.getItem('ragebait-best-score')) || 0;
  } catch (e) {
    bestScore = 0;
  }
}

function saveBestScore() {
  if (score <= bestScore) return false;
  bestScore = score;
  try {
    localStorage.setItem('ragebait-best-score', String(bestScore));
  } catch (e) {}
  celebrateNewBest();
  return true;
}

function accuracyText() {
  if (!attempts) return '100%';
  return Math.round((score / attempts) * 100) + '%';
}

function startTimer() {
  clearInterval(timerInterval);

  timer = 0;
  $('timer').textContent = '0s';

  timerInterval = setInterval(() => {
    timer++;
    $('timer').textContent = timer + 's';
  }, 1000);
}

function toast(msg, color) {
  const t = $('toast');
  t.textContent = msg;
  t.style.borderLeftColor = color || 'var(--accent)';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2000);
}

function showLevelBanner(lvl) {
  const def = LEVEL_DEFS[lvl - 1] || LEVEL_DEFS[LEVEL_DEFS.length - 1];
  const banner = $('level-banner');
  $('banner-name').textContent = `LEVEL ${lvl}: ${def.name}`;
  $('banner-desc').textContent = def.desc;
  $('banner-name').style.color = def.color;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2200);
}

function showScreen(id) {
  ['start-screen', 'gameover-screen', 'win-screen'].forEach(s => {
    $(s).classList.remove('active');
  });
  if (id) $(id).classList.add('active');
}

function updateUI() {
  saveBestScore();
  $('score').textContent = score;
  $('lives').textContent = livesIcons[Math.max(0, Math.min(lives, 3))] || '';
  $('level').textContent = level;
  $('lvl-inner').textContent = level;
  const pct = (score / GOAL) * 100;
  $('progress-bar').style.width = pct + '%';
  $('progress-bar').style.background =
    pct > 80 ? '#ff00ff' :
    pct > 66 ? 'var(--yellow)' :
    pct > 33 ? 'var(--accent2)' : 'var(--green)';
  $('footer-hint').textContent =
    `LEVEL ${level}/12 — ${GOAL - score} points to win — BEST ${bestScore}`;
}

function getArena() {
  const a = $('arena');
  return { w: a.clientWidth, h: a.clientHeight };
}

function randPos(bw, bh) {
  const { w, h } = getArena();
  return {
    x: 12 + Math.random() * Math.max(0, w - bw - 24),
    y: 38 + Math.random() * Math.max(0, h - bh - 64),
  };
}

function overlaps(a, b) {
  return !(
    a.x + a.w + SAFE_GAP < b.x ||
    b.x + b.w + SAFE_GAP < a.x ||
    a.y + a.h + SAFE_GAP < b.y ||
    b.y + b.h + SAFE_GAP < a.y
  );
}

function buttonRect(btn) {
  return {
    x: parseFloat(btn.style.left) || 0,
    y: parseFloat(btn.style.top) || 0,
    w: btn.offsetWidth || BUTTON_W,
    h: btn.offsetHeight || BUTTON_H,
  };
}

function findFreePos(bw, bh, occupied) {
  let fallback = randPos(bw, bh);
  for (let tries = 0; tries < 40; tries++) {
    const pos = randPos(bw, bh);
    const rect = { x: pos.x, y: pos.y, w: bw, h: bh };
    if (!occupied.some(other => overlaps(rect, other))) return pos;
    fallback = pos;
  }
  return fallback;
}

function moveButtonTo(btn, excludedIndex) {
  const occupied = buttons
    .filter((_, i) => i !== excludedIndex)
    .map(buttonRect);
  const pos = findFreePos(BUTTON_W, BUTTON_H, occupied);
  btn.style.left = pos.x + 'px';
  btn.style.top = pos.y + 'px';
}

function keepButtonsInBounds() {
  const { w, h } = getArena();
  buttons.forEach(btn => {
    const maxX = Math.max(12, w - (btn.offsetWidth || BUTTON_W) - 12);
    const maxY = Math.max(38, h - (btn.offsetHeight || BUTTON_H) - 26);
    const x = Math.min(Math.max(12, parseFloat(btn.style.left) || 12), maxX);
    const y = Math.min(Math.max(38, parseFloat(btn.style.top) || 38), maxY);
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
  });
}

function clearTimers() {
  clearInterval(moveTimer);
  clearInterval(switchTimer);
  clearInterval(blinkTimer);
  clearInterval(shrinkTimer);
  clearInterval(fakeTimer);
  clearInterval(chaosTimer);
  clearInterval(finalBossJitterTimer);
  clearInterval(finalBossFlickerTimer);
  moveTimer = switchTimer = blinkTimer = shrinkTimer = fakeTimer = chaosTimer = null;
  finalBossJitterTimer = finalBossFlickerTimer = null;
}

function clearButtons() {
  const arena = $('arena');
  buttons.forEach(b => { try { arena.removeChild(b); } catch(e){} });
  buttons = [];
}

function createButtons() {
  clearButtons();
  shrinkAmount = 1.0;
  const arena = $('arena');

  // Level 12: only 2 buttons, 1 life
  const count = level === MAX_LEVEL
    ? 2
    : Math.min(2 + Math.floor(level * 0.75), 9);

  const pool = [...labels].sort(() => Math.random() - 0.5).slice(0, count);
  const occupied = [];
  targetIdx = Math.floor(Math.random() * count);
  $('target-label').textContent = '"' + pool[targetIdx] + '"';
  $('target-label').style.opacity = '1';

  pool.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-target';
    btn.textContent = label;
    btn.style.width = BUTTON_W + 'px';
    const pos = findFreePos(BUTTON_W, BUTTON_H, occupied);
    btn.style.left = pos.x + 'px';
    btn.style.top = pos.y + 'px';
    btn.dataset.index = i;
    btn.addEventListener('click', event => handleClick(i, btn, event));
    arena.appendChild(btn);
    buttons.push(btn);
    occupied.push({ x: pos.x, y: pos.y, w: BUTTON_W, h: BUTTON_H });
  });
}

function startMoving() {
  clearTimers();
  applyFinalBossMode();

  // --- MOVE TIMER (level 2+) ---
  if (level >= 2) {
    moveTimer = setInterval(() => {
      if (!gameActive || buttonsAreFrozen()) return;
      const wrongIdxs = buttons.map((_, i) => i).filter(i => i !== targetIdx);
      if (wrongIdxs.length > 0) {
        const pick = wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)];
        moveButtonTo(buttons[pick], pick);
      }
      // Level 4+: correct button also moves
      if (level >= 4 && Math.random() < 0.55) {
        moveButtonTo(buttons[targetIdx], targetIdx);
      }
    }, getMoveSpeed());
  }

  // --- BLINK (level 6+) ---
  if (level >= 6) {
    blinkTimer = setInterval(() => {
      if (!gameActive || buttonsAreFrozen()) return;
      const wrongIdxs = buttons.map((_, i) => i).filter(i => i !== targetIdx);
      if (wrongIdxs.length === 0) return;
      const pick = wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)];
      const btn = buttons[pick];
      btn.style.opacity = '0';
      setTimeout(() => { if (btn) btn.style.opacity = '1'; }, 350 + Math.random() * 300);
      // Level 10+: correct button blinks too
      if (level >= 10 && Math.random() < 0.4) {
        const tb = buttons[targetIdx];
        tb.style.opacity = '0';
        setTimeout(() => { if (tb) tb.style.opacity = '1'; }, 300);
      }
    }, Math.max(500, 1400 - level * 80));
  }

  // --- LABEL SWAP (level 7+) ---
  if (level >= 7) {
    switchTimer = setInterval(() => {
      if (!gameActive || buttonsAreFrozen() || buttons.length < 2) return;
      const i = Math.floor(Math.random() * buttons.length);
      const j = (i + 1 + Math.floor(Math.random() * (buttons.length - 1))) % buttons.length;
      const tmp = buttons[i].textContent;
      buttons[i].textContent = buttons[j].textContent;
      buttons[j].textContent = tmp;
      $('target-label').textContent = '"' + buttons[targetIdx].textContent + '"';
    }, Math.max(600, 1200 - level * 60));
  }

  // --- FAKE INSTRUCTION FLICKER (level 8+) ---
  if (level >= 8) {
    fakeTimer = setInterval(() => {
      if (!gameActive || buttonsAreFrozen()) return;
      const realLabel = buttons[targetIdx] ? buttons[targetIdx].textContent : '';
      // flash a random wrong label for 400ms
      const wrongBtns = buttons.filter((_, i) => i !== targetIdx);
      if (wrongBtns.length === 0) return;
      const fakeLabel = wrongBtns[Math.floor(Math.random() * wrongBtns.length)].textContent;
      $('target-label').textContent = '"' + fakeLabel + '"';
      $('target-label').style.color = 'var(--accent)';
      setTimeout(() => {
        if (!gameActive) return;
        const current = buttons[targetIdx] ? buttons[targetIdx].textContent : realLabel;
        $('target-label').textContent = '"' + current + '"';
        $('target-label').style.color = '';
      }, 400);
    }, Math.max(1200, 2800 - level * 150));
  }

  // --- SHRINK (level 9+) ---
  if (level >= 9) {
    shrinkAmount = 1.0;
    shrinkTimer = setInterval(() => {
      if (!gameActive) return;
      shrinkAmount = Math.max(0.55, shrinkAmount - 0.04);
      buttons.forEach(btn => {
        btn.style.setProperty('--btn-scale', shrinkAmount);
        btn.style.fontSize = Math.max(9, 13 * shrinkAmount) + 'px';
      });
      if (shrinkAmount <= 0.56) {
        // reset sizes
        shrinkAmount = 1.0;
        buttons.forEach(btn => {
          btn.style.setProperty('--btn-scale', '1');
          btn.style.fontSize = '13px';
        });
      }
    }, 600);
  }

  chaosTimer = setInterval(runChaosEvent, 950);

  if (level === MAX_LEVEL) {
    finalBossJitterTimer = setInterval(() => {
      if (!gameActive) return;
      buttons.forEach(btn => {
        btn.style.setProperty('--jitter-x', (Math.random() * 4 - 2).toFixed(1) + 'px');
        btn.style.setProperty('--jitter-y', (Math.random() * 4 - 2).toFixed(1) + 'px');
      });
    }, 130);

    finalBossFlickerTimer = setInterval(() => {
      if (!gameActive || !buttons[targetIdx]) return;
      $('target-label').style.opacity = Math.random() < 0.45 ? '0.35' : '1';
    }, 110);
  }
}

function handleClick(i, btn, event) {
  if (!gameActive) return;
  attempts++;
  const point = getClickPoint(event, btn);
  popButton(btn);

  if (i === targetIdx) {
    combo++;
    score++;
    playSound('correct');
    btn.classList.add('correct-flash');
    btn.classList.add('correct-bounce');
    burstParticles(point, 'var(--green)', 13, 46);
    setTimeout(() => btn.classList.remove('correct-flash', 'correct-bounce'), 260);

    if (combo >= 3) {
      playSound('combo');
      $('combo').textContent = `🔥 COMBO x${combo}`;
      $('combo').classList.add('hot');
    }

    triggerComboRewards(point);

    // level up every 3 points
    const newLevel = Math.min(Math.floor(score / 3) + 1, MAX_LEVEL);
    if (newLevel > level) {
      level = newLevel;
      playSound('levelup');
      updateMusicTension();
      shakeArena('level');
      burstParticles(point, 'var(--yellow)', 22, 70);
      showRewardText(`LEVEL ${level}`, 'var(--yellow)');
      showLevelBanner(level);
      // Level 12: steal a life
      if (level === MAX_LEVEL) {
        lives = 1;
        toast("FINAL BOSS — ONE LIFE REMAINING", "#ff00ff");
      }
    }

    updateUI();

    if (score >= GOAL) {
      sounds.music.pause();
      clearInterval(musicRampTimer);
      musicRampTimer = null;
      gameActive = false;
      applyFinalBossMode();
      clearTimers();
      clearInterval(timerInterval);
      saveBestScore();
      $('win-score').textContent =
        `SCORE: ${score} | BEST: ${bestScore} | ACCURACY: ${accuracyText()}`;
      showScreen('win-screen');
      return;
    }

    createButtons();
    startMoving();

  } else {
    combo = 0;
    lives--;
    playSound('wrong');
    vibrate(65);
    shakeArena('small');
    burstParticles(point, 'var(--accent)', 16, 52);
    $('combo').textContent = '';
    $('combo').classList.remove('hot');
    btn.classList.add('wrong-flash');
    document.body.classList.add('miss-flash');
    setTimeout(() => btn.classList.remove('wrong-flash'), 400);
    setTimeout(() => document.body.classList.remove('miss-flash'), 180);
    toast(taunts[Math.floor(Math.random() * taunts.length)]);
    updateUI();

    if (lives <= 0) {
      playSound('gameover');
      sounds.music.pause();
      clearInterval(musicRampTimer);
      musicRampTimer = null;
      vibrate([120, 50, 160]);
      shakeArena('big');
      burstParticles(point, 'var(--accent)', 28, 95);
      gameActive = false;
      applyFinalBossMode();
      clearTimers();
      clearInterval(timerInterval);
      saveBestScore();
      $('go-score').textContent =
        `SCORE: ${score} | LEVEL: ${level} | ACCURACY: ${accuracyText()}`;
      const dt = deathTaunts[Math.floor(Math.random() * deathTaunts.length)];
      $('go-taunt').textContent = dt.replace('?', level);
      showScreen('gameover-screen');
      return;
    }

    // level 5+: reshuffle on wrong click
    if (level >= 5) {
      createButtons();
      startMoving();
    }
  }
}

function startGame() {
  score = 0; lives = 3; level = 1; combo = 0; attempts = 0;
  slowMotionUntil = 0;
  buttonsFrozenUntil = 0;
  comboSlowAwarded = false;
  comboFreezeAwarded = false;
  bestCelebratedThisRun = false;
  clearJuiceEffects();
  gameActive = true;
  clearInterval(musicRampTimer);
  musicRampTimer = null;
  sounds.music.playbackRate = 0.96;
  sounds.music.currentTime = 0;
  playSound('music', 0.8);
  updateMusicTension();
  startTimer();
  clearTimers();
  updateUI();
  $('combo').textContent = '';
  $('combo').classList.remove('hot');
  $('target-label').style.color = '';
  $('target-label').style.opacity = '1';
  showScreen(null);
  showLevelBanner(1);
  createButtons();
  startMoving();  
}

loadBestScore();
updateUI();

window.addEventListener('resize', keepButtonsInBounds);

$('arena').addEventListener('pointermove', event => {
  if (!gameActive || !runawayBtn || !runawayBtn.isConnected) return;

  const btnRect = runawayBtn.getBoundingClientRect();
  const dx = btnRect.left + btnRect.width / 2 - event.clientX;
  const dy = btnRect.top + btnRect.height / 2 - event.clientY;
  const distance = Math.hypot(dx, dy);
  if (distance > 105) return;

  const arenaRect = $('arena').getBoundingClientRect();
  const push = 38;
  const nextX = Math.min(
    Math.max(12, parseFloat(runawayBtn.style.left) + (dx / Math.max(distance, 1)) * push),
    arenaRect.width - (runawayBtn.offsetWidth || BUTTON_W) - 12
  );
  const nextY = Math.min(
    Math.max(38, parseFloat(runawayBtn.style.top) + (dy / Math.max(distance, 1)) * push),
    arenaRect.height - (runawayBtn.offsetHeight || BUTTON_H) - 26
  );

  runawayBtn.style.left = nextX + 'px';
  runawayBtn.style.top = nextY + 'px';
});

document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && !gameActive) {
    event.preventDefault();
    startGame();
  }
});
