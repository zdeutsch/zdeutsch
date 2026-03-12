(function initShreibenPage() {
  const { api, setActiveNav, showAlert, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("shreiben");

  const alertHost = document.getElementById("alert-host");
  const levelSelect = document.getElementById("level-select");
  const refreshBtn = document.getElementById("refresh-btn");
  const tasksSearchInput = document.getElementById("tasks-search-input");

  const tasksBody = document.getElementById("tasks-body");
  const clearFormBtn = document.getElementById("clear-form-btn");
  const saveTaskBtn = document.getElementById("save-task-btn");
  const deleteTaskBtn = document.getElementById("delete-task-btn");

  const taskIdInput = document.getElementById("task-id");
  const taskTitleInput = document.getElementById("task-title");
  const taskIstructionsInput = document.getElementById("task-istructions");
  const taskContentInput = document.getElementById("task-content");
  const taskTasksInput = document.getElementById("task-tasks");

  const taskImageInput = document.getElementById("task-image-input");
  const pickImageBtn = document.getElementById("pick-image-btn");
  const clearImageBtn = document.getElementById("clear-image-btn");
  const extractImageBtn = document.getElementById("extract-image-btn");
  const imageDropzone = document.getElementById("image-dropzone");
  const imageDropzoneEmpty = document.getElementById("image-dropzone-empty");
  const imagePreview = document.getElementById("image-preview");
  const extractStatus = document.getElementById("extract-status");

  const applyTableSearch = createTableSearch({
    inputEl: tasksSearchInput,
    tbodyEl: tasksBody,
    emptyColspan: 5,
    emptyMessage: "No matching tasks found"
  });

  const state = {
    tasks: [],
    selectedTaskId: "",
    imageDataUrl: "",
    isExtracting: false
  };

  function getContext() {
    return {
      level: levelSelect.value
    };
  }

  function setExtractStatus(message, type = "secondary") {
    if (!extractStatus) {
      return;
    }
    extractStatus.textContent = String(message || "");
    extractStatus.className = `small mt-2 mb-0 text-${type}`;
  }

  function updateImageActions() {
    const hasImage = Boolean(state.imageDataUrl);
    if (extractImageBtn) {
      extractImageBtn.disabled = !hasImage || state.isExtracting;
    }
    if (clearImageBtn) {
      clearImageBtn.disabled = !hasImage || state.isExtracting;
    }
    if (pickImageBtn) {
      pickImageBtn.disabled = state.isExtracting;
    }
  }

  function setImageData(dataUrl) {
    state.imageDataUrl = String(dataUrl || "");
    const hasImage = Boolean(state.imageDataUrl);

    if (imagePreview) {
      if (hasImage) {
        imagePreview.src = state.imageDataUrl;
        imagePreview.classList.remove("d-none");
      } else {
        imagePreview.removeAttribute("src");
        imagePreview.classList.add("d-none");
      }
    }

    if (imageDropzone) {
      imageDropzone.classList.toggle("has-image", hasImage);
    }

    if (imageDropzoneEmpty) {
      imageDropzoneEmpty.classList.toggle("d-none", hasImage);
    }

    updateImageActions();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageFile(file) {
    if (!file) {
      return;
    }

    const type = String(file.type || "").toLowerCase();
    if (!type.startsWith("image/")) {
      showAlert(alertHost, "Please choose an image file", "error");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showAlert(alertHost, "Image is too large. Max size is 8 MB.", "error");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageData(dataUrl);
      setExtractStatus("Image ready. Click \"Extract & Fill\".", "success");
    } catch (error) {
      showAlert(alertHost, error.message || "Failed to read image", "error");
    }
  }

  function getClipboardImageFile(event) {
    const items = Array.from(event?.clipboardData?.items || []);
    const imageItem = items.find((item) => String(item.type || "").startsWith("image/"));
    return imageItem ? imageItem.getAsFile() : null;
  }

  function stripMarkdown(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^[\s>*#\-\d.]+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function previewText(value, fallback = "") {
    const clean = stripMarkdown(value);
    if (!clean) {
      return fallback;
    }
    return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
  }

  function extractTitleFromIstructions(value) {
    const lines = String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
    if (heading) {
      const cleanHeading = stripMarkdown(heading.replace(/^#{1,6}\s+/, ""));
      if (cleanHeading) {
        return cleanHeading;
      }
    }
    if (lines.length) {
      const cleanFirst = stripMarkdown(lines[0].replace(/^[\s>*#\-\d.]+/, ""));
      if (cleanFirst) {
        return cleanFirst;
      }
    }
    return "";
  }

  function resetForm() {
    state.selectedTaskId = "";
    taskIdInput.value = "";
    taskIdInput.readOnly = false;
    taskTitleInput.value = "";
    taskIstructionsInput.value = "";
    taskContentInput.value = "";
    taskTasksInput.value = "";
  }

  function fillForm(task) {
    state.selectedTaskId = task.id || "";
    taskIdInput.value = task.id || "";
    taskIdInput.readOnly = true;
    taskTitleInput.value = task.title || "";
    taskIstructionsInput.value = task.istructions || "";
    taskContentInput.value = task.content || "";
    taskTasksInput.value = task.tasks || "";
  }

  function applyExtractedTask(extracted) {
    const data = extracted && typeof extracted === "object" ? extracted : {};
    resetForm();
    taskIdInput.value = String(data.taskId || "").trim();
    const istructions = String(data.istructions || data.instructions || "").trim();
    taskTitleInput.value = String(data.title || "").trim() || extractTitleFromIstructions(istructions);
    taskIstructionsInput.value = istructions;
    taskContentInput.value = String(data.content || "").trim();
    taskTasksInput.value = String(data.tasks || "").trim();
  }

  function renderTasks() {
    if (!state.tasks.length) {
      tasksBody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">No tasks in this level</td></tr>';
      return;
    }

    tasksBody.innerHTML = state.tasks
      .map((task) => {
        const active = state.selectedTaskId === task.id;
        const titlePreview = previewText(task.title, "-");
        const istructionsPreview = previewText(task.istructions, "-");
        const contentPreview = previewText(task.content, "-");
        return `
          <tr data-searchable="true" data-search-text="${escapeHtml(`${task.id || ""} ${task.title || ""} ${task.istructions || ""} ${task.content || ""} ${task.tasks || ""}`)}">
            <td><code class="kbd-inline">${escapeHtml(task.id || "")}</code></td>
            <td class="text-truncate" style="max-width: 220px;">${escapeHtml(titlePreview)}</td>
            <td class="text-truncate" style="max-width: 320px;">${escapeHtml(istructionsPreview)}</td>
            <td class="text-truncate" style="max-width: 320px;">${escapeHtml(contentPreview)}</td>
            <td class="text-end">
              <button class="btn btn-sm ${active ? "btn-primary" : "btn-outline-primary"}" type="button" data-task-id="${escapeHtml(task.id || "")}">
                ${active ? "Selected" : "Edit"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    tasksBody.querySelectorAll("button[data-task-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const taskId = button.getAttribute("data-task-id") || "";
        const task = state.tasks.find((entry) => entry.id === taskId);
        if (!task) {
          return;
        }
        fillForm(task);
        renderTasks();
      });
    });

    applyTableSearch();
  }

  async function loadTasks() {
    tasksBody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">Loading...</td></tr>';

    const context = getContext();
    const query = new URLSearchParams({ level: context.level });

    try {
      const tasks = await api(`/shreiben/tasks?${query.toString()}`);
      state.tasks = Array.isArray(tasks) ? tasks : [];
      renderTasks();
      resetForm();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
      tasksBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Failed to load tasks</td></tr>';
    }
  }

  function collectPayload() {
    const context = getContext();
    return {
      level: context.level,
      taskId: taskIdInput.value.trim() || undefined,
      title: taskTitleInput.value.trim(),
      istructions: taskIstructionsInput.value.trim(),
      content: taskContentInput.value.trim(),
      tasks: taskTasksInput.value.trim()
    };
  }

  saveTaskBtn.addEventListener("click", async () => {
    const payload = collectPayload();

    if (!payload.title || !payload.istructions || !payload.content || !payload.tasks) {
      showAlert(alertHost, "All fields are required: title, istructions, content, tasks", "error");
      return;
    }

    try {
      if (state.selectedTaskId) {
        await api(`/shreiben/tasks/${encodeURIComponent(state.selectedTaskId)}`, {
          method: "PUT",
          body: payload
        });
      } else {
        await api("/shreiben/tasks", {
          method: "POST",
          body: payload
        });
      }
      showAlert(alertHost, "Task saved successfully", "success");
      loadTasks();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  deleteTaskBtn.addEventListener("click", async () => {
    const taskId = state.selectedTaskId || taskIdInput.value.trim();
    if (!taskId) {
      showAlert(alertHost, "Select a task first", "error");
      return;
    }

    if (!window.confirm(`Delete task "${taskId}"?`)) {
      return;
    }

    const context = getContext();
    const query = new URLSearchParams({ level: context.level });

    try {
      await api(`/shreiben/tasks/${encodeURIComponent(taskId)}?${query.toString()}`, {
        method: "DELETE"
      });
      showAlert(alertHost, "Task deleted", "success");
      loadTasks();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  if (pickImageBtn && taskImageInput) {
    pickImageBtn.addEventListener("click", () => {
      taskImageInput.click();
    });
  }

  if (taskImageInput) {
    taskImageInput.addEventListener("change", async () => {
      const file = taskImageInput.files?.[0] || null;
      await handleImageFile(file);
      taskImageInput.value = "";
    });
  }

  if (imageDropzone && taskImageInput) {
    imageDropzone.addEventListener("click", () => {
      if (!state.isExtracting) {
        taskImageInput.click();
      }
    });

    imageDropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    imageDropzone.addEventListener("drop", async (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0] || null;
      await handleImageFile(file);
    });

    imageDropzone.addEventListener("paste", async (event) => {
      const file = getClipboardImageFile(event);
      if (!file) {
        return;
      }
      event.preventDefault();
      await handleImageFile(file);
    });
  }

  if (clearImageBtn) {
    clearImageBtn.addEventListener("click", () => {
      setImageData("");
      setExtractStatus("No image selected.", "secondary");
    });
  }

  if (extractImageBtn) {
    extractImageBtn.addEventListener("click", async () => {
      if (!state.imageDataUrl) {
        showAlert(alertHost, "Choose or paste an image first", "error");
        return;
      }

      state.isExtracting = true;
      updateImageActions();
      setExtractStatus("Extracting markdown fields with OpenAI...", "secondary");

      try {
        const data = await api("/shreiben/extract-task", {
          method: "POST",
          body: {
            imageDataUrl: state.imageDataUrl
          }
        });
        applyExtractedTask(data || {});
        setExtractStatus("Extraction complete. Review and save the form.", "success");
        showAlert(alertHost, "Image extracted and form filled", "success");
      } catch (error) {
        setExtractStatus("Extraction failed.", "danger");
        showAlert(alertHost, error.message, "error");
      } finally {
        state.isExtracting = false;
        updateImageActions();
      }
    });
  }

  document.addEventListener("paste", async (event) => {
    const file = getClipboardImageFile(event);
    if (!file) {
      return;
    }
    event.preventDefault();
    await handleImageFile(file);
  });

  clearFormBtn.addEventListener("click", resetForm);
  levelSelect.addEventListener("change", loadTasks);
  refreshBtn.addEventListener("click", loadTasks);

  setImageData("");
  setExtractStatus("No image selected.", "secondary");
  resetForm();
  loadTasks();
})();
