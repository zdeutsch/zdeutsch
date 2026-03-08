const extractButton = document.getElementById("extract");
const extractAllButton = document.getElementById("extract-all");
const extractThemesButton = document.getElementById("extract-themes");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const previewEl = document.getElementById("preview");
const previewLabelEl = document.getElementById("preview-label");
const rawJsonEl = document.getElementById("raw-json");

function setStatus(text) {
  statusEl.textContent = text;
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["contentScript.js"] },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function requestExtraction(tabId, request) {
  const message = typeof request === "string" ? { type: request } : request;
  try {
    return await sendMessageToTab(tabId, message);
  } catch (error) {
    if (!error.message.includes("Receiving end does not exist")) {
      throw error;
    }
    await injectContentScript(tabId);
    return sendMessageToTab(tabId, message);
  }
}

function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function truncateText(text, maxLength = 140) {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function buildMetaItem(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "meta-item";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "N/A";
  wrapper.append(labelEl, valueEl);
  return wrapper;
}

function addPreviewLine(label, value) {
  const row = document.createElement("div");
  row.className = "line";
  const labelEl = document.createElement("div");
  labelEl.className = "label";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.textContent = value || "N/A";
  row.append(labelEl, valueEl);
  previewEl.append(row);
}

function clearPreview() {
  metaEl.innerHTML = "";
  previewEl.innerHTML = "";
}

function countBlanks(segments = []) {
  return segments.filter((segment) => segment.type !== "text").length;
}

function renderPreview(data) {
  clearPreview();
  rawJsonEl.textContent = JSON.stringify(data, null, 2);

  if (!data?.meta) {
    previewLabelEl.textContent = "No data";
    previewEl.innerHTML = "<div class=\"empty\">Run extraction to preview the current page.</div>";
    return;
  }

  previewLabelEl.textContent = data.meta.partLabel || "Preview";

  metaEl.append(
    buildMetaItem("Title", data.meta.title),
    buildMetaItem("Level", data.meta.level || "N/A"),
    buildMetaItem("Section", data.meta.section || "N/A"),
    buildMetaItem("Part", data.meta.partNumber ? `Teil ${data.meta.partNumber}` : "N/A")
  );

  const content = data.content || {};
  if (data.meta.section === "lesen" && data.meta.partNumber === 1) {
    addPreviewLine("Texts", `${content.texts?.length || 0} items`);
    addPreviewLine("Headlines", `${content.headlines?.length || 0} items`);
    addPreviewLine("Snippet", truncateText(content.texts?.[0]?.text || ""));
  } else if (data.meta.section === "lesen" && data.meta.partNumber === 2) {
    addPreviewLine("Questions", `${content.questions?.length || 0} items`);
    addPreviewLine("Passage", truncateText(content.passage?.title || ""));
    addPreviewLine("Snippet", truncateText(content.passage?.text || ""));
  } else if (data.meta.section === "lesen" && data.meta.partNumber === 3) {
    addPreviewLine("Situations", `${content.situations?.length || 0} items`);
    addPreviewLine("Ads", `${content.ads?.length || 0} items`);
    addPreviewLine("Snippet", truncateText(content.situations?.[0]?.text || ""));
  } else if (data.meta.section === "sprachbausteine" && data.meta.partNumber === 1) {
    addPreviewLine("Blanks", `${content.blanks?.length || 0} items`);
    addPreviewLine("Instruction", truncateText(content.instruction || ""));
    addPreviewLine("Snippet", truncateText(content.text || ""));
  } else if (data.meta.section === "sprachbausteine" && data.meta.partNumber === 2) {
    addPreviewLine("Blanks", `${countBlanks(content.segments)} items`);
    addPreviewLine("Word bank", `${content.wordBank?.length || 0} items`);
    addPreviewLine("Snippet", truncateText(content.text || ""));
  } else {
    addPreviewLine("Status", "Preview available.");
  }
}

function renderBatchPreview(results) {
  clearPreview();
  const payload = results.map((item) => item.data);
  rawJsonEl.textContent = JSON.stringify(payload, null, 2);

  if (!results.length) {
    previewLabelEl.textContent = "No data";
    previewEl.innerHTML = "<div class=\"empty\">No parts extracted yet.</div>";
    return;
  }

  previewLabelEl.textContent = `Batch ${results.length}`;
  const labels = results
    .map((item) => item.data?.meta?.partLabel)
    .filter(Boolean);
  const firstMeta = results[0]?.data?.meta || {};
  const lastLabel = labels[labels.length - 1] || "N/A";

  metaEl.append(
    buildMetaItem("Parts", String(results.length)),
    buildMetaItem("From", labels[0] || "N/A"),
    buildMetaItem("To", lastLabel),
    buildMetaItem("Level", firstMeta.level || "N/A")
  );

  addPreviewLine("Labels", labels.join(" | "));
  addPreviewLine("Last file", results[results.length - 1]?.filename || "N/A");
}

async function downloadBatch(results) {
  for (const item of results) {
    const response = await sendMessageToBackground({
      type: "DOWNLOAD_EXAM",
      payload: item
    });
    if (!response || !response.ok) {
      return { ok: false, error: response?.error || `Download failed: ${item.filename}` };
    }
  }
  return { ok: true };
}

function setButtonsDisabled(disabled) {
  extractButton.disabled = disabled;
  extractAllButton.disabled = disabled;
  extractThemesButton.disabled = disabled;
}

async function runExtraction(type) {
  setButtonsDisabled(true);
  setStatus(
    type === "EXTRACT_ALL"
      ? "Extracting all parts..."
      : type === "EXTRACT_THEMES"
        ? "Extracting all themes..."
        : "Extracting..."
  );

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus("No active tab found.");
      return;
    }

    const request =
      type === "EXTRACT_THEMES"
        ? { type, downloadEach: true, collectResults: false }
        : { type };

    const result = await requestExtraction(tab.id, request);
    if (!result) {
      setStatus("No response from the extractor.");
      return;
    }

    if (result.error) {
      setStatus(result.error);
      return;
    }

    if (type === "EXTRACT_ALL" || type === "EXTRACT_THEMES") {
      const results = result.results || [];
      if (results.length) {
        renderBatchPreview(results);
      } else {
        clearPreview();
        rawJsonEl.textContent = JSON.stringify(result, null, 2);
        previewLabelEl.textContent = "Batch";
        previewEl.innerHTML = "<div class=\"empty\">Batch extraction completed.</div>";
      }

      if (result.downloadedInContent) {
        const savedCount = Number(result.savedCount) || 0;
        const failed = Array.isArray(result.downloadErrors) ? result.downloadErrors : [];
        if (!savedCount && !failed.length) {
          setStatus("No files extracted. Open a themes page and try again.");
          return;
        }
        if (failed.length) {
          setStatus(`Saved ${savedCount} files, ${failed.length} failed.`);
          return;
        }
        setStatus(`Saved ${savedCount} files.`);
        return;
      }

      if (!results.length) {
        setStatus("No files extracted. Open a themes page and try again.");
        return;
      }
      const downloadResponse = await downloadBatch(results);
      if (!downloadResponse.ok) {
        setStatus(downloadResponse.error || "Download failed.");
        return;
      }
      setStatus(`Saved ${results.length} files.`);
      return;
    }

    renderPreview(result.data);
    const downloadResponse = await sendMessageToBackground({
      type: "DOWNLOAD_EXAM",
      payload: result
    });

    if (!downloadResponse || !downloadResponse.ok) {
      setStatus(downloadResponse?.error || "Download failed.");
      return;
    }

    setStatus(`Saved to ${result.filename}`);
  } catch (error) {
    setStatus(error.message || "Unexpected error.");
  } finally {
    setButtonsDisabled(false);
  }
}

extractButton.addEventListener("click", () => runExtraction("EXTRACT_EXAM"));
extractAllButton.addEventListener("click", () => runExtraction("EXTRACT_ALL"));
extractThemesButton.addEventListener("click", () => runExtraction("EXTRACT_THEMES"));

renderPreview(null);
