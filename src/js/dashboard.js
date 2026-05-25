const table = document.getElementById("table");
const siteInput = document.getElementById("siteInput");
const presets = document.getElementById("presets");
const activityEl = document.getElementById("activity");
const intentionsEl = document.getElementById("intentions");

const controls = {
  globalBlock: document.getElementById("globalBlock"),
  challengeLevel: document.getElementById("challengeLevel"),
  challengeLevelLabel: document.getElementById("challengeLevelLabel"),
  unlockMinutes: document.getElementById("unlockMinutes"),
  cooldownSeconds: document.getElementById("cooldownSeconds"),
  requireIntention: document.getElementById("requireIntention")
};

document.getElementById("addSite").addEventListener("click", () => addSite(siteInput.value));
document.getElementById("saveSettings").addEventListener("click", saveSettingsFromForm);
document.getElementById("resetStats").addEventListener("click", resetStats);
document.getElementById("exportData").addEventListener("click", exportData);
controls.challengeLevel.addEventListener("input", () => {
  controls.challengeLevelLabel.textContent = controls.challengeLevel.value;
});
siteInput.addEventListener("keydown", event => {
  if (event.key === "Enter") addSite(siteInput.value);
});

load();

async function load() {
  const [settings, sites, data] = await Promise.all([
    getSettings(),
    getSites(),
    chrome.storage.sync.get(["stats", "unlocks", "activity", "intentions"])
  ]);

  hydrateSettings(settings);
  renderPresets(sites);
  renderMetrics(sites, data.stats || {}, data.activity || [], settings);
  renderTable(sites, data.stats || {}, data.unlocks || {});
  renderActivity(data.activity || []);
  renderIntentions(data.intentions || []);
}

function hydrateSettings(settings) {
  controls.globalBlock.value = String(Boolean(settings.globalBlock));
  controls.challengeLevel.value = settings.challengeLevel;
  controls.challengeLevelLabel.textContent = settings.challengeLevel;
  controls.unlockMinutes.value = settings.unlockMinutes;
  controls.cooldownSeconds.value = settings.cooldownSeconds;
  controls.requireIntention.checked = Boolean(settings.requireIntention);
}

function renderMetrics(sites, stats, activity, settings) {
  const totalBlocks = Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0);
  document.getElementById("totalBlocks").textContent = totalBlocks;
  document.getElementById("activeSites").textContent = sites.filter(site => site.blocked).length;
  document.getElementById("difficultyMetric").textContent = settings.challengeLevel;
  document.getElementById("unlockMetric").textContent = activity.filter(item => item.type === "unlock_success").length;
}

function renderPresets(sites) {
  presets.innerHTML = "";
  const existing = new Set(sites.map(site => site.url));
  DISTRACTION_PRESETS.filter(domain => !existing.has(domain)).forEach(domain => {
    const button = document.createElement("button");
    button.className = "preset";
    button.textContent = `+ ${domain}`;
    button.addEventListener("click", () => addSite(domain));
    presets.appendChild(button);
  });
}

function renderTable(sites, stats, unlocks) {
  table.innerHTML = "";

  if (!sites.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty";
    cell.textContent = "Todavía no tienes dominios configurados.";
    row.appendChild(cell);
    table.appendChild(row);
    return;
  }

  sites.forEach((site, index) => {
    const tr = document.createElement("tr");
    const unlockRemaining = Number(unlocks[site.url] || 0) - Date.now();

    tr.append(
      cell(site.url),
      statusCell(site.blocked),
      cell(stats[site.url] || 0),
      cell(unlockRemaining > 0 ? formatDuration(unlockRemaining) : "No"),
      actionCell(site, index)
    );

    table.appendChild(tr);
  });
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value;
  return td;
}

function statusCell(isBlocked) {
  const td = document.createElement("td");
  const pill = document.createElement("span");
  pill.className = isBlocked ? "status" : "status paused";
  pill.textContent = isBlocked ? "Bloqueado" : "Pausado";
  td.appendChild(pill);
  return td;
}

function actionCell(site, index) {
  const td = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "actions";

  const toggle = document.createElement("button");
  toggle.textContent = site.blocked ? "Pausar" : "Bloquear";
  toggle.className = site.blocked ? "secondary" : "";
  toggle.addEventListener("click", () => toggleSite(index));

  const edit = document.createElement("button");
  edit.textContent = "Editar";
  edit.className = "secondary";
  edit.addEventListener("click", () => editSite(index));

  const del = document.createElement("button");
  del.textContent = "Eliminar";
  del.className = "danger";
  del.addEventListener("click", () => deleteSite(index));

  actions.append(toggle, edit, del);
  td.appendChild(actions);
  return td;
}

function renderActivity(activity) {
  activityEl.innerHTML = "";
  if (!activity.length) {
    activityEl.append(emptyMessage("Sin actividad todavía."));
    return;
  }

  activity.slice(0, 8).forEach(item => {
    const div = document.createElement("div");
    div.className = "activity-item";
    const title = document.createElement("strong");
    title.textContent = activityLabel(item);
    const time = document.createElement("span");
    time.textContent = `${item.site} - ${new Date(item.at).toLocaleString()}`;
    div.append(title, time);
    activityEl.appendChild(div);
  });
}

function renderIntentions(intentions) {
  intentionsEl.innerHTML = "";
  if (!intentions.length) {
    intentionsEl.append(emptyMessage("Aún no hay intenciones registradas."));
    return;
  }

  intentions.slice(0, 8).forEach(item => {
    const div = document.createElement("div");
    div.className = "activity-item";
    const title = document.createElement("strong");
    title.textContent = item.text;
    const time = document.createElement("span");
    time.textContent = `${item.site} - ${new Date(item.at).toLocaleString()}`;
    div.append(title, time);
    intentionsEl.appendChild(div);
  });
}

function emptyMessage(text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function activityLabel(item) {
  if (item.type === "unlock_success") return "Desbloqueo aprobado";
  if (item.type === "unlock_failed") return "Reto fallido";
  return "Bloqueo aplicado";
}

async function addSite(value) {
  const domain = normalizeDomain(value);
  if (!domain) return;

  const sites = await getSites();
  if (!sites.some(site => site.url === domain)) {
    sites.push({ url: domain, blocked: true, createdAt: Date.now() });
    await saveSites(sites);
  }

  siteInput.value = "";
  load();
}

async function toggleSite(index) {
  const sites = await getSites();
  if (sites[index].blocked) {
    const challengeUrl = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(sites[index].url)}&url=${encodeURIComponent(`https://${sites[index].url}`)}`);
    chrome.tabs.create({ url: challengeUrl });
    return;
  }

  sites[index].blocked = !sites[index].blocked;
  await saveSites(sites);
  load();
}

async function editSite(index) {
  const sites = await getSites();
  const newDomain = prompt("Nuevo dominio", sites[index].url);
  if (!newDomain) return;
  sites[index].url = normalizeDomain(newDomain);
  await saveSites(sites);
  load();
}

async function deleteSite(index) {
  const sites = await getSites();
  sites.splice(index, 1);
  await saveSites(sites);
  load();
}

async function saveSettingsFromForm() {
  const current = await getSettings();
  const next = {
    globalBlock: controls.globalBlock.value === "true",
    challengeLevel: Number(controls.challengeLevel.value),
    unlockMinutes: Number(controls.unlockMinutes.value),
    cooldownSeconds: Number(controls.cooldownSeconds.value),
    requireIntention: controls.requireIntention.checked
  };

  if (current.globalBlock && !next.globalBlock) {
    await saveSettings({ ...next, globalBlock: true });
    const challengeUrl = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent("bloqueo global")}&url=${encodeURIComponent(chrome.runtime.getURL("dashboard.html"))}`);
    chrome.tabs.create({ url: challengeUrl });
    load();
    return;
  }

  await saveSettings(next);
  load();
}

async function resetStats() {
  await chrome.storage.sync.set({
    stats: {},
    activity: [],
    intentions: [],
    unlocks: {},
    challengeState: {}
  });
  load();
}

async function exportData() {
  const data = await chrome.storage.sync.get(null);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `focus-blocker-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
