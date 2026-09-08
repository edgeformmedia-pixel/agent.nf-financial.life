const FCR_URL = 'https://www.freecallerregistry.com/fcr/';

async function cfg() { return chrome.storage.sync.get(null); }

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

// Single click on the toolbar icon = the whole flow.
chrome.action.onClicked.addListener(async () => {
  const c = await cfg();
  if (!c.setupDone) { chrome.runtime.openOptionsPage(); return; }

  // Arm the next FCR page load to run automatically.
  await chrome.storage.session.set({ armed: true });

  // Reuse an existing FCR tab if one's open, else make one.
  const [existing] = await chrome.tabs.query({ url: 'https://*.freecallerregistry.com/*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true, url: c.fcrUrl || FCR_URL });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: c.fcrUrl || FCR_URL, active: true });
  }
});

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  (async () => {
    if (msg.type === 'cfg') {
      const c = await cfg();
      const { armed } = await chrome.storage.session.get('armed');
      send({ ...c, armed: !!armed });
    } else if (msg.type === 'disarm') {
      await chrome.storage.session.remove('armed');
      send({ ok: true });
    } else if (msg.type === 'setup') {
      chrome.runtime.openOptionsPage();
      send({ ok: true });
    }
  })();
  return true;
});
