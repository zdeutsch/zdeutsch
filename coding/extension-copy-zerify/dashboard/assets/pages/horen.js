(function initHorenPage() {
  const { api, uploadBinary, setActiveNav, showAlert, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("horen");

  const alertHost = document.getElementById("alert-host");
  const levelSelect = document.getElementById("level-select");
  const partSelect = document.getElementById("part-select");
  const themeKeyInput = document.getElementById("theme-key-input");
  const refreshBtn = document.getElementById("refresh-btn");
  const topicsSearchInput = document.getElementById("topics-search-input");

  const topicsBody = document.getElementById("topics-body");
  const formTitle = document.getElementById("form-title");

  const topicIdInput = document.getElementById("topic-id");
  const topicTitleInput = document.getElementById("topic-title");
  const topicTagInput = document.getElementById("topic-tag");
  const topicAudioInput = document.getElementById("topic-audio");
  const uploadAudioBtn = document.getElementById("upload-audio-btn");
  const removeAudioBtn = document.getElementById("remove-audio-btn");
  const currentAudioPanel = document.getElementById("current-audio-panel");
  const currentAudioPlayer = document.getElementById("current-audio-player");
  const currentAudioDetails = document.getElementById("current-audio-details");
  const audioStatusBadge = document.getElementById("audio-status-badge");
  const audioUploadProgress = document.getElementById("audio-upload-progress");
  const statementsContainer = document.getElementById("statements-container");

  const addStatementBtn = document.getElementById("add-statement-btn");
  const clearFormBtn = document.getElementById("clear-form-btn");
  const saveTopicBtn = document.getElementById("save-topic-btn");
  const deleteTopicBtn = document.getElementById("delete-topic-btn");
  const applyTableSearch = createTableSearch({
    inputEl: topicsSearchInput,
    tbodyEl: topicsBody,
    emptyColspan: 6,
    emptyMessage: "No matching topics found"
  });

  const state = {
    topics: [],
    selectedTopicId: "",
    themeKey: ""
  };

  function getContext() {
    const rawThemeKey = themeKeyInput.value.trim();
    return {
      level: levelSelect.value,
      part: partSelect.value,
      themeKey: rawThemeKey || undefined
    };
  }

  function makeStatementRow(statement = {}, index = 0) {
    const row = document.createElement("div");
    row.className = "row g-2 align-items-center statement-row";

    row.innerHTML = `
      <div class="col-12 col-md-1">
        <input type="number" class="form-control form-control-sm statement-number" min="1" value="${Number(statement.number || index + 1)}">
      </div>
      <div class="col-12 col-md-8">
        <input type="text" class="form-control form-control-sm statement-text" value="${escapeHtml(statement.text || "")}" placeholder="Statement text">
      </div>
      <div class="col-8 col-md-2">
        <select class="form-select form-select-sm statement-correct">
          <option value="false" ${statement.correct ? "" : "selected"}>False</option>
          <option value="true" ${statement.correct ? "selected" : ""}>True</option>
        </select>
      </div>
      <div class="col-4 col-md-1 text-end">
        <button class="btn btn-sm btn-outline-danger remove-statement-btn" type="button"><i class="bi bi-x"></i></button>
      </div>
    `;

    row.querySelector(".remove-statement-btn").addEventListener("click", () => {
      row.remove();
      syncStatementNumbers();
    });

    return row;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "";
    }
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderAudio(audio) {
    const source = String(audio?.src || "");
    const hasAudio = source.startsWith("assets/audio/horen/");
    currentAudioPanel.classList.toggle("d-none", !hasAudio);
    removeAudioBtn.classList.toggle("d-none", !hasAudio);
    audioStatusBadge.className = `badge ${hasAudio ? "text-bg-success" : "text-bg-secondary"}`;
    audioStatusBadge.textContent = hasAudio ? "Audio ready" : "No audio";

    if (hasAudio) {
      const previewPath = source.slice("assets/".length);
      currentAudioPlayer.src = `/site-assets/${previewPath}?v=${encodeURIComponent(audio.uploadedAt || "1")}`;
      const details = [audio.fileName || "Audio", formatBytes(audio.sizeBytes)].filter(Boolean);
      currentAudioDetails.textContent = details.join(" · ");
    } else {
      currentAudioPlayer.removeAttribute("src");
      currentAudioPlayer.load();
      currentAudioDetails.textContent = "";
    }
  }

  function syncAudioUploadButton() {
    const hasFile = Boolean(topicAudioInput.files?.[0]);
    uploadAudioBtn.disabled = !state.selectedTopicId || !hasFile;
  }

  function syncStatementNumbers() {
    const rows = Array.from(statementsContainer.querySelectorAll(".statement-row"));
    rows.forEach((row, index) => {
      const input = row.querySelector(".statement-number");
      if (input && !input.value) {
        input.value = String(index + 1);
      }
    });
  }

  function resetForm() {
    state.selectedTopicId = "";
    formTitle.textContent = "Add Topic";
    topicIdInput.readOnly = false;
    topicIdInput.value = "";
    topicTitleInput.value = "";
    topicTagInput.value = "";
    topicAudioInput.value = "";
    audioUploadProgress.textContent = "Save the topic before uploading audio.";
    renderAudio(null);
    syncAudioUploadButton();
    statementsContainer.innerHTML = "";

    for (let i = 0; i < 5; i += 1) {
      statementsContainer.append(makeStatementRow({ number: i + 1, text: "", correct: false }, i));
    }
  }

  function fillForm(topic) {
    state.selectedTopicId = topic.id;
    formTitle.textContent = `Edit Topic: ${topic.id}`;
    topicIdInput.readOnly = true;
    topicIdInput.value = topic.id || "";
    topicTitleInput.value = topic.title || "";
    topicTagInput.value = topic.tag || "";
    topicAudioInput.value = "";
    audioUploadProgress.textContent = "";
    renderAudio(topic.audio);
    syncAudioUploadButton();

    statementsContainer.innerHTML = "";
    const statements = Array.isArray(topic.statements) && topic.statements.length
      ? topic.statements
      : [{ number: 1, text: "", correct: false }];

    statements.forEach((statement, index) => {
      statementsContainer.append(makeStatementRow(statement, index));
    });
  }

  function renderTopics() {
    if (!state.topics.length) {
      topicsBody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">No topics in this part</td></tr>';
      return;
    }

    topicsBody.innerHTML = state.topics
      .map((topic) => `
        <tr data-searchable="true" data-search-text="${escapeHtml(`${topic.id || ""} ${topic.title || ""} ${topic.tag || ""}`)}">
          <td><code class="kbd-inline">${escapeHtml(topic.id)}</code></td>
          <td>${escapeHtml(topic.title || "")}</td>
          <td>${escapeHtml(topic.tag || "")}</td>
          <td>${topic.audio?.src ? '<span class="badge text-bg-success">Ready</span>' : '<span class="badge text-bg-light">None</span>'}</td>
          <td>${topic.statementsCount || 0}</td>
          <td class="text-end">
            <button class="btn btn-sm ${state.selectedTopicId === topic.id ? "btn-primary" : "btn-outline-primary"}" type="button" data-topic-id="${escapeHtml(topic.id)}">
              ${state.selectedTopicId === topic.id ? "Selected" : "Edit"}
            </button>
          </td>
        </tr>
      `)
      .join("");

    topicsBody.querySelectorAll("button[data-topic-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const topicId = button.getAttribute("data-topic-id") || "";
        const topic = state.topics.find((entry) => entry.id === topicId);
        if (topic) {
          fillForm(topic);
          renderTopics();
        }
      });
    });

    applyTableSearch();
  }

  function collectStatements() {
    return Array.from(statementsContainer.querySelectorAll(".statement-row")).map((row, index) => {
      const number = Number(row.querySelector(".statement-number")?.value || index + 1);
      const text = row.querySelector(".statement-text")?.value || "";
      const correct = row.querySelector(".statement-correct")?.value === "true";
      return {
        number,
        text: text.trim(),
        correct
      };
    });
  }

  async function loadTopics(preferredTopicId = "") {
    topicsBody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Loading...</td></tr>';

    const context = getContext();
    const query = new URLSearchParams({
      level: context.level,
      part: context.part
    });

    if (context.themeKey) {
      query.set("themeKey", context.themeKey);
    }

    try {
      const data = await api(`/horen/topics?${query.toString()}`);
      state.topics = Array.isArray(data?.topics) ? data.topics : [];
      state.themeKey = data?.themeKey || context.themeKey || "";

      if (!context.themeKey && state.themeKey) {
        themeKeyInput.value = state.themeKey;
      }

      const selectedTopic = state.topics.find((topic) => topic.id === preferredTopicId);
      if (selectedTopic) {
        fillForm(selectedTopic);
      } else {
        resetForm();
      }
      renderTopics();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
      topicsBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Failed to load topics</td></tr>';
    }
  }

  addStatementBtn.addEventListener("click", () => {
    const nextIndex = statementsContainer.querySelectorAll(".statement-row").length;
    statementsContainer.append(makeStatementRow({ number: nextIndex + 1, text: "", correct: false }, nextIndex));
  });

  clearFormBtn.addEventListener("click", resetForm);

  topicAudioInput.addEventListener("change", () => {
    const file = topicAudioInput.files?.[0];
    if (file && file.size > 50 * 1024 * 1024) {
      topicAudioInput.value = "";
      showAlert(alertHost, "Audio file is too large (maximum 50 MB)", "error");
    }
    syncAudioUploadButton();
  });

  uploadAudioBtn.addEventListener("click", async () => {
    const file = topicAudioInput.files?.[0];
    if (!state.selectedTopicId || !file) {
      return;
    }

    const context = getContext();
    const query = new URLSearchParams({ level: context.level, part: context.part });
    if (context.themeKey) {
      query.set("themeKey", context.themeKey);
    }

    uploadAudioBtn.disabled = true;
    topicAudioInput.disabled = true;
    audioUploadProgress.textContent = `Uploading ${file.name}…`;
    try {
      await uploadBinary(
        `/horen/topics/${encodeURIComponent(state.selectedTopicId)}/audio?${query.toString()}`,
        file,
        { "X-Audio-File-Name": encodeURIComponent(file.name) }
      );
      showAlert(alertHost, "Audio uploaded successfully", "success");
      await loadTopics(state.selectedTopicId);
    } catch (error) {
      audioUploadProgress.textContent = "Upload failed.";
      showAlert(alertHost, error.message, "error");
    } finally {
      topicAudioInput.disabled = false;
      syncAudioUploadButton();
    }
  });

  removeAudioBtn.addEventListener("click", async () => {
    if (!state.selectedTopicId || !window.confirm("Remove the audio from this Thema?")) {
      return;
    }
    const context = getContext();
    const query = new URLSearchParams({ level: context.level, part: context.part });
    if (context.themeKey) {
      query.set("themeKey", context.themeKey);
    }
    removeAudioBtn.disabled = true;
    audioUploadProgress.textContent = "Removing audio…";
    try {
      await api(`/horen/topics/${encodeURIComponent(state.selectedTopicId)}/audio?${query.toString()}`, {
        method: "DELETE"
      });
      showAlert(alertHost, "Audio removed", "success");
      await loadTopics(state.selectedTopicId);
    } catch (error) {
      audioUploadProgress.textContent = "Could not remove audio.";
      showAlert(alertHost, error.message, "error");
    } finally {
      removeAudioBtn.disabled = false;
    }
  });

  saveTopicBtn.addEventListener("click", async () => {
    const title = topicTitleInput.value.trim();
    if (!title) {
      showAlert(alertHost, "Topic title is required", "error");
      return;
    }

    const statements = collectStatements();
    if (!statements.length) {
      showAlert(alertHost, "Add at least one statement", "error");
      return;
    }

    const context = getContext();
    const body = {
      level: context.level,
      part: context.part,
      themeKey: context.themeKey,
      title,
      tag: topicTagInput.value.trim(),
      statements
    };

    if (!state.selectedTopicId) {
      const customId = topicIdInput.value.trim();
      if (customId) {
        body.topicId = customId;
      }
    }

    try {
      let saved;
      if (state.selectedTopicId) {
        saved = await api(`/horen/topics/${encodeURIComponent(state.selectedTopicId)}`, {
          method: "PUT",
          body
        });
      } else {
        saved = await api("/horen/topics", {
          method: "POST",
          body
        });
      }

      showAlert(alertHost, "Topic saved successfully", "success");
      await loadTopics(saved?.topic?.id || state.selectedTopicId);
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  deleteTopicBtn.addEventListener("click", async () => {
    const topicId = state.selectedTopicId || topicIdInput.value.trim();
    if (!topicId) {
      showAlert(alertHost, "Select a topic first", "error");
      return;
    }

    if (!window.confirm(`Delete topic "${topicId}"?`)) {
      return;
    }

    const context = getContext();
    const params = new URLSearchParams({
      level: context.level,
      part: context.part
    });
    if (context.themeKey) {
      params.set("themeKey", context.themeKey);
    }

    try {
      await api(`/horen/topics/${encodeURIComponent(topicId)}?${params.toString()}`, {
        method: "DELETE"
      });
      showAlert(alertHost, "Topic deleted", "success");
      await loadTopics();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  levelSelect.addEventListener("change", () => loadTopics());
  partSelect.addEventListener("change", () => loadTopics());
  refreshBtn.addEventListener("click", () => loadTopics());

  resetForm();
  loadTopics();
})();
