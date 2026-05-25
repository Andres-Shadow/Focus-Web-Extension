importScripts("./utils.js");

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  const sites = await getSites();

  if (!sites.length) {
    await saveSites(DISTRACTION_PRESETS.slice(0, 4).map(url => ({
      url,
      blocked: true,
      createdAt: Date.now()
    })));
  }

  await saveSettings(settings);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith(chrome.runtime.getURL(""))) return;

  const settings = await getSettings();
  const sites = await getSites();
  const globalBlock = settings.globalBlock || Date.now() < Number(settings.focusModeUntil || 0);

  if (!globalBlock) return;

  let hostname;
  try {
    hostname = normalizeDomain(new URL(tab.url).hostname);
  } catch {
    return;
  }

  const data = await chrome.storage.sync.get("unlocks");
  const unlocks = data.unlocks || {};
  const blockedSite = sites.find(site => site.blocked && matchDomain(hostname, site.url));

  if (!blockedSite) return;

  const unlockUntil = Number(unlocks[blockedSite.url] || 0);
  if (unlockUntil > Date.now()) return;

  await addBlockEvent(blockedSite.url, tab.url);

  const blockedUrl = chrome.runtime.getURL(
    `blocked.html?site=${encodeURIComponent(blockedSite.url)}&url=${encodeURIComponent(tab.url)}`
  );

  chrome.tabs.update(tabId, { url: blockedUrl });
});
