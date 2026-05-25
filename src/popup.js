const list = document.getElementById("sitesList");
const input = document.getElementById("siteInput");
const siteCount = document.getElementById("siteCount");
const toggleGlobalBtn = document.getElementById("toggleGlobal");
const globalState = document.getElementById("globalState");
const focusMinutes = document.getElementById("focusMinutes");
const focusStatus = document.getElementById("focusStatus");

document.getElementById("addSite").addEventListener("click", () => addSite(input.value));
document.getElementById("addCurrent").addEventListener("click", addCurrentTab);
document.getElementById("startFocus").addEventListener("click", startFocusSession);
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});
toggleGlobalBtn.addEventListener("click", toggleGlobal);
input.addEventListener("keydown", event => {
  if (event.key === "Enter") addSite(input.value);
});

load();
setInterval(renderGlobalState, 1000);

async function renderGlobalState() {
  const settings = await getSettings();
  const focusRemaining = Number(settings.focusModeUntil || 0) - Date.now();
  const active = settings.globalBlock || focusRemaining > 0;

  globalState.textContent = active ? "Activo" : "Pausado";
  toggleGlobalBtn.classList.toggle("active", active);
  focusStatus.textContent = focusRemaining > 0
    ? `Sesión estricta: ${formatDuration(focusRemaining)} restantes`
    : "";
}

async function load() {
  const [sites, data] = await Promise.all([
    getSites(),
    chrome.storage.sync.get(["stats", "unlocks"])
  ]);
  const stats = data.stats || {};
  const unlocks = data.unlocks || {};

  list.innerHTML = "";
  siteCount.textContent = sites.length;

  if (!sites.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Agrega tus primeras distracciones para empezar.";
    list.appendChild(empty);
  }

  sites.forEach((site, index) => {
    const card = document.createElement("article");
    card.className = "site";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = site.url;
    const meta = document.createElement("small");
    const unlockRemaining = Number(unlocks[site.url] || 0) - Date.now();
    meta.textContent = unlockRemaining > 0
      ? `Desbloqueado ${formatDuration(unlockRemaining)}`
      : `${stats[site.url] || 0} bloqueos registrados`;
    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "site-actions";

    const toggle = document.createElement("button");
    toggle.textContent = site.blocked ? "Abrir" : "Cerrar";
    toggle.title = site.blocked ? "Desbloquear con reto" : "Bloquear";
    toggle.addEventListener("click", () => toggleSite(index));

    const edit = document.createElement("button");
    edit.textContent = "Editar";
    edit.title = "Editar dominio";
    edit.addEventListener("click", () => editSite(index));

    const del = document.createElement("button");
    del.textContent = "X";
    del.className = "danger";
    del.title = "Eliminar";
    del.addEventListener("click", () => deleteSite(index));

    actions.append(toggle, edit, del);
    card.append(info, actions);
    list.appendChild(card);
  });

  await renderGlobalState();
}

async function addSite(value) {
  const domain = normalizeDomain(value);
  if (!domain) return;

  const sites = await getSites();
  if (sites.some(site => site.url === domain)) {
    input.value = "";
    return;
  }

  sites.push({ url: domain, blocked: true, createdAt: Date.now() });
  await saveSites(sites);
  input.value = "";
  load();
}

async function addCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || tab.url.startsWith(chrome.runtime.getURL(""))) return;
  addSite(tab.url);
}

async function deleteSite(index) {
  const sites = await getSites();
  sites.splice(index, 1);
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

async function toggleSite(index) {
  const sites = await getSites();
  const site = sites[index];

  if (site.blocked) {
    const challengeUrl = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site.url)}&url=${encodeURIComponent(`https://${site.url}`)}`);
    chrome.tabs.create({ url: challengeUrl });
    return;
  }

  site.blocked = true;
  await saveSites(sites);
  load();
}

async function toggleGlobal() {
  const settings = await getSettings();

  if (settings.globalBlock) {
    const challengeUrl = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent("bloqueo global")}&url=${encodeURIComponent(chrome.runtime.getURL("dashboard.html"))}`);
    chrome.tabs.create({ url: challengeUrl });
    return;
  }

  settings.globalBlock = true;
  await saveSettings(settings);
  renderGlobalState();
}

async function startFocusSession() {
  const minutes = Math.min(180, Math.max(5, Number(focusMinutes.value || 25)));
  const settings = await getSettings();
  settings.globalBlock = true;
  settings.focusModeUntil = Date.now() + (minutes * 60 * 1000);
  await saveSettings(settings);
  renderGlobalState();
}
