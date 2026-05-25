const params = new URLSearchParams(window.location.search);
const blockedSite = params.get("site") || "este sitio";
const originalUrl = params.get("url") || "about:blank";

const siteTitle = document.getElementById("siteTitle");
const question = document.getElementById("question");
const levelPill = document.getElementById("levelPill");
const options = document.getElementById("options");
const intentionInput = document.getElementById("intentionInput");
const unlockBtn = document.getElementById("unlockBtn");
const stayFocusedBtn = document.getElementById("stayFocusedBtn");
const feedback = document.getElementById("feedback");
const attemptCount = document.getElementById("attemptCount");
const unlockTime = document.getElementById("unlockTime");
const cooldownTime = document.getElementById("cooldownTime");

let settings;
let puzzle;
let selectedAnswer = null;
let failedAttempts = 0;
let cooldownUntil = 0;

init();

async function init() {
  settings = await getSettings();
  const data = await chrome.storage.sync.get(["stats", "challengeState"]);
  const stats = data.stats || {};
  const state = data.challengeState || {};

  failedAttempts = Number(state[blockedSite]?.failedAttempts || 0);
  cooldownUntil = Number(state[blockedSite]?.cooldownUntil || 0);

  siteTitle.textContent = `${blockedSite} está bloqueado`;
  attemptCount.textContent = stats[blockedSite] || 0;
  unlockTime.textContent = `${settings.unlockMinutes}m`;

  buildPuzzle();
  bindEvents();
  updateCooldown();
  window.setInterval(updateCooldown, 1000);
}

function bindEvents() {
  intentionInput.addEventListener("input", updateUnlockState);
  unlockBtn.addEventListener("click", unlockSite);
  stayFocusedBtn.addEventListener("click", () => {
    window.location.href = "about:blank";
  });
}

function buildPuzzle() {
  selectedAnswer = null;
  puzzle = generatePuzzle(settings.challengeLevel, failedAttempts);
  question.textContent = puzzle.question;
  levelPill.textContent = `Nivel ${puzzle.level}`;
  options.innerHTML = "";

  puzzle.options.forEach(answer => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.textContent = answer;
    button.addEventListener("click", () => {
      selectedAnswer = answer;
      [...options.children].forEach(child => child.classList.remove("selected"));
      button.classList.add("selected");
      updateUnlockState();
    });
    options.appendChild(button);
  });

  updateUnlockState();
}

function hasValidIntention() {
  if (!settings.requireIntention) return true;
  return intentionInput.value.trim().length >= 12;
}

function updateUnlockState() {
  unlockBtn.disabled = selectedAnswer === null || !hasValidIntention() || Date.now() < cooldownUntil;
}

function updateCooldown() {
  const remaining = cooldownUntil - Date.now();
  cooldownTime.textContent = formatDuration(remaining);

  if (remaining > 0) {
    feedback.className = "feedback error";
    feedback.textContent = `Demora activa. Espera ${formatDuration(remaining)} antes de intentar otra vez.`;
  } else if (!hasValidIntention()) {
    feedback.className = "feedback";
    feedback.textContent = "Escribe una intención específica para continuar.";
  } else {
    feedback.className = "feedback";
    feedback.textContent = "";
  }

  updateUnlockState();
}

async function unlockSite() {
  if (selectedAnswer !== puzzle.result) {
    failedAttempts += 1;
    cooldownUntil = Date.now() + (settings.cooldownSeconds * 1000 * Math.min(4, failedAttempts));
    await persistChallengeState();
    await addAttemptEvent(blockedSite, false);
    buildPuzzle();
    updateCooldown();
    return;
  }

  const data = await chrome.storage.sync.get(["unlocks", "intentions", "challengeState"]);
  const unlocks = data.unlocks || {};
  const intentions = Array.isArray(data.intentions) ? data.intentions : [];
  const challengeState = data.challengeState || {};

  unlocks[blockedSite] = Date.now() + (settings.unlockMinutes * 60 * 1000);
  if (blockedSite === "bloqueo global") {
    settings.globalBlock = false;
    settings.focusModeUntil = 0;
    await saveSettings(settings);
  }
  intentions.unshift({
    site: blockedSite,
    text: intentionInput.value.trim(),
    at: Date.now(),
    unlockMinutes: settings.unlockMinutes
  });
  challengeState[blockedSite] = { failedAttempts: 0, cooldownUntil: 0 };

  await chrome.storage.sync.set({
    unlocks,
    intentions: intentions.slice(0, 40),
    challengeState
  });
  await addAttemptEvent(blockedSite, true);

  window.location.href = originalUrl;
}

async function persistChallengeState() {
  const data = await chrome.storage.sync.get("challengeState");
  const challengeState = data.challengeState || {};
  challengeState[blockedSite] = { failedAttempts, cooldownUntil };
  await chrome.storage.sync.set({ challengeState });
}
