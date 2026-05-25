const DEFAULT_SETTINGS = {
  globalBlock: true,
  challengeLevel: 3,
  unlockMinutes: 10,
  cooldownSeconds: 20,
  requireIntention: true,
  focusModeUntil: 0
};

const DISTRACTION_PRESETS = [
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "tiktok.com",
  "reddit.com",
  "netflix.com",
  "twitch.tv"
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generatePuzzle(level = 1, streak = 0) {
  const effectiveLevel = Math.min(6, Math.max(1, Number(level) + Math.floor(Number(streak) / 2)));
  const templates = [
    () => {
      const a = randomInt(12, 49);
      const b = randomInt(11, 38);
      return { question: `${a} + ${b}`, result: a + b };
    },
    () => {
      const a = randomInt(45, 99);
      const b = randomInt(12, 44);
      return { question: `${a} - ${b}`, result: a - b };
    },
    () => {
      const a = randomInt(6, 14);
      const b = randomInt(7, 16);
      return { question: `${a} x ${b}`, result: a * b };
    },
    () => {
      const b = randomInt(4, 12);
      const result = randomInt(6, 18);
      return { question: `${b * result} / ${b}`, result };
    },
    () => {
      const a = randomInt(12, 32);
      const b = randomInt(3, 9);
      const c = randomInt(10, 35);
      return { question: `(${a} x ${b}) - ${c}`, result: (a * b) - c };
    },
    () => {
      const a = randomInt(8, 18);
      const b = randomInt(12, 28);
      const c = randomInt(3, 9);
      return { question: `${a} + (${b} x ${c})`, result: a + (b * c) };
    }
  ];

  const available = templates.slice(0, effectiveLevel);
  const puzzle = available[randomInt(0, available.length - 1)]();
  const wrongAnswers = new Set();
  while (wrongAnswers.size < 3) {
    const delta = randomInt(2, 13) * (Math.random() > 0.5 ? 1 : -1);
    if (puzzle.result + delta !== puzzle.result) wrongAnswers.add(puzzle.result + delta);
  }

  return {
    ...puzzle,
    level: effectiveLevel,
    options: shuffle([puzzle.result, ...wrongAnswers])
  };
}

function normalizeDomain(url) {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw) return "";

  try {
    const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").split("/")[0];
  }
}

function matchDomain(current, blocked) {
  const normalizedCurrent = normalizeDomain(current);
  const normalizedBlocked = normalizeDomain(blocked);
  return normalizedCurrent === normalizedBlocked ||
    normalizedCurrent.endsWith(`.${normalizedBlocked}`);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

async function getSettings() {
  const data = await chrome.storage.sync.get(["settings", "globalBlock", "level"]);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

  if (typeof data.globalBlock === "boolean") {
    settings.globalBlock = data.globalBlock;
  }

  if (Number.isFinite(data.level)) {
    settings.challengeLevel = Math.max(settings.challengeLevel, data.level);
  }

  return settings;
}

async function saveSettings(settings) {
  const nextSettings = { ...DEFAULT_SETTINGS, ...settings };
  await chrome.storage.sync.set({
    settings: nextSettings,
    globalBlock: nextSettings.globalBlock,
    level: nextSettings.challengeLevel
  });
  return nextSettings;
}

async function getSites() {
  const data = await chrome.storage.sync.get("sites");
  return Array.isArray(data.sites) ? data.sites : [];
}

async function saveSites(sites) {
  await chrome.storage.sync.set({ sites });
}

async function addBlockEvent(site, originalUrl) {
  const data = await chrome.storage.sync.get(["stats", "activity"]);
  const stats = data.stats || {};
  const activity = Array.isArray(data.activity) ? data.activity : [];
  stats[site] = (stats[site] || 0) + 1;

  activity.unshift({
    type: "blocked",
    site,
    originalUrl,
    at: Date.now()
  });

  await chrome.storage.sync.set({
    stats,
    activity: activity.slice(0, 80)
  });
}

async function addAttemptEvent(site, success) {
  const data = await chrome.storage.sync.get("activity");
  const activity = Array.isArray(data.activity) ? data.activity : [];
  activity.unshift({
    type: success ? "unlock_success" : "unlock_failed",
    site,
    at: Date.now()
  });
  await chrome.storage.sync.set({ activity: activity.slice(0, 80) });
}
