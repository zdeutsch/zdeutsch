(function initShreibenPage() {
  const { api, setActiveNav, showAlert, linesToArray, toLines, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("shreiben");

  const alertHost = document.getElementById("alert-host");
  const levelSelect = document.getElementById("level-select");
  const partSelect = document.getElementById("part-select");
  const refreshBtn = document.getElementById("refresh-btn");
  const tasksSearchInput = document.getElementById("tasks-search-input");

  const tasksBody = document.getElementById("tasks-body");
  const clearFormBtn = document.getElementById("clear-form-btn");
  const saveTaskBtn = document.getElementById("save-task-btn");
  const deleteTaskBtn = document.getElementById("delete-task-btn");

  const taskIdInput = document.getElementById("task-id");
  const taskTitleInput = document.getElementById("task-title");
  const taskPromptInput = document.getElementById("task-prompt");

  const adHeaderInput = document.getElementById("ad-header");
  const adTaglineInput = document.getElementById("ad-tagline");
  const adPriceInput = document.getElementById("ad-price");
  const adParagraphsInput = document.getElementById("ad-paragraphs");
  const adOfferInput = document.getElementById("ad-offer");
  const adAddressInput = document.getElementById("ad-address");

  const reqModeInput = document.getElementById("req-mode");
  const reqPointsInput = document.getElementById("req-points");
  const applyTableSearch = createTableSearch({
    inputEl: tasksSearchInput,
    tbodyEl: tasksBody,
    emptyColspan: 4,
    emptyMessage: "No matching tasks found"
  });

  const state = {
    tasks: [],
    selectedTaskId: ""
  };

  function getContext() {
    return {
      level: levelSelect.value,
      part: partSelect.value.trim() || "teil-1"
    };
  }

  function resetForm() {
    state.selectedTaskId = "";
    taskIdInput.value = "";
    taskIdInput.readOnly = false;
    taskTitleInput.value = "";
    taskPromptInput.value = "";

    adHeaderInput.value = "";
    adTaglineInput.value = "";
    adPriceInput.value = "";
    adParagraphsInput.value = "";
    adOfferInput.value = "";
    adAddressInput.value = "";

    reqModeInput.value = "";
    reqPointsInput.value = "";
  }

  function fillForm(task) {
    state.selectedTaskId = task.id || "";
    taskIdInput.value = task.id || "";
    taskIdInput.readOnly = true;
    taskTitleInput.value = task.title || "";
    taskPromptInput.value = task.prompt || "";

    adHeaderInput.value = task.ad?.header || "";
    adTaglineInput.value = task.ad?.tagline || "";
    adPriceInput.value = task.ad?.price || "";
    adParagraphsInput.value = toLines(task.ad?.paragraphs || []);
    adOfferInput.value = toLines(task.ad?.offer || []);
    adAddressInput.value = toLines(task.ad?.address || []);

    reqModeInput.value = toLines(task.requirements?.mode || []);
    reqPointsInput.value = toLines(task.requirements?.points || []);
  }

  function renderTasks() {
    if (!state.tasks.length) {
      tasksBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">No tasks in this part</td></tr>';
      return;
    }

    tasksBody.innerHTML = state.tasks
      .map((task) => {
        const active = state.selectedTaskId === task.id;
        return `
          <tr data-searchable="true" data-search-text="${escapeHtml(`${task.id || ""} ${task.title || ""} ${task.prompt || ""}`)}">
            <td><code class="kbd-inline">${escapeHtml(task.id || "")}</code></td>
            <td>${escapeHtml(task.title || "")}</td>
            <td class="text-truncate" style="max-width: 420px;">${escapeHtml(task.prompt || "")}</td>
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
    tasksBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Loading...</td></tr>';

    const context = getContext();
    const query = new URLSearchParams({
      level: context.level,
      part: context.part
    });

    try {
      const tasks = await api(`/shreiben/tasks?${query.toString()}`);
      state.tasks = Array.isArray(tasks) ? tasks : [];
      renderTasks();
      resetForm();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
      tasksBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Failed to load tasks</td></tr>';
    }
  }

  function collectPayload() {
    const context = getContext();
    return {
      level: context.level,
      part: context.part,
      taskId: taskIdInput.value.trim() || undefined,
      title: taskTitleInput.value.trim(),
      prompt: taskPromptInput.value.trim(),
      adHeader: adHeaderInput.value.trim(),
      adTagline: adTaglineInput.value.trim(),
      adPrice: adPriceInput.value.trim(),
      adParagraphs: linesToArray(adParagraphsInput.value),
      adOffer: linesToArray(adOfferInput.value),
      adAddress: linesToArray(adAddressInput.value),
      requirementMode: linesToArray(reqModeInput.value),
      requirementPoints: linesToArray(reqPointsInput.value)
    };
  }

  saveTaskBtn.addEventListener("click", async () => {
    const payload = collectPayload();

    if (!payload.title || !payload.prompt) {
      showAlert(alertHost, "Title and prompt are required", "error");
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
    const query = new URLSearchParams({
      level: context.level,
      part: context.part
    });

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

  clearFormBtn.addEventListener("click", resetForm);
  levelSelect.addEventListener("change", loadTasks);
  partSelect.addEventListener("change", loadTasks);
  refreshBtn.addEventListener("click", loadTasks);

  resetForm();
  loadTasks();
})();
