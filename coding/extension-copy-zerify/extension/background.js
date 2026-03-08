chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "DOWNLOAD_EXAM") {
    return;
  }

  const payload = message.payload || {};
  const data = payload.data;
  const filename = payload.filename || "db/exam.json";

  if (!data) {
    sendResponse({ ok: false, error: "No data to download." });
    return;
  }

  const json = JSON.stringify(data, null, 2);
  let url = "";
  let revokeUrl = null;
  try {
    const blob = new Blob([json], { type: "application/json" });
    url = URL.createObjectURL(blob);
    revokeUrl = () => URL.revokeObjectURL(url);
  } catch (error) {
    url = "data:application/json;charset=utf-8," + encodeURIComponent(json);
  }

  chrome.downloads.download(
    {
      url,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    },
    (downloadId) => {
      if (revokeUrl) {
        revokeUrl();
      }
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, downloadId });
    }
  );

  return true;
});
