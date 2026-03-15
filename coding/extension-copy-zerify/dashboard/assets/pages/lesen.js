(function initLesenPage() {
  const { api, setActiveNav, showAlert, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("lesen");

  const urlParams = new URLSearchParams(window.location.search);
  const alertHost = document.getElementById("alert-host");
  const levelSelect = document.getElementById("level-select");
  const refreshBtn = document.getElementById("refresh-btn");
  const themesSearchInput = document.getElementById("themes-search-input");
  const themesBody = document.getElementById("themes-body");
  const partEditorLinks = Array.from(document.querySelectorAll(".part-editor-link"));

  const newThemeKeyInput = document.getElementById("new-theme-key");
  const newThemeTitleInput = document.getElementById("new-theme-title");
  const createThemeBtn = document.getElementById("create-theme-btn");

  const editThemeKeyInput = document.getElementById("edit-theme-key");
  const editNewKeyInput = document.getElementById("edit-new-key");
  const editThemeTitleInput = document.getElementById("edit-theme-title");
  const saveThemeBtn = document.getElementById("save-theme-btn");
  const deleteThemeBtn = document.getElementById("delete-theme-btn");
  const applyTableSearch = createTableSearch({
    inputEl: themesSearchInput,
    tbodyEl: themesBody,
    emptyColspan: 4,
    emptyMessage: "No matching themes found"
  });

  const state = {
    themes: [],
    selectedThemeKey: ""
  };

  const requestedLevel = String(urlParams.get("level") || "").trim().toLowerCase();
  let pendingThemeFromQuery = String(urlParams.get("themeKey") || "").trim();

  if (requestedLevel && Array.from(levelSelect.options).some((option) => option.value === requestedLevel)) {
    levelSelect.value = requestedLevel;
  }

  function syncUrlState() {
    const params = new URLSearchParams(window.location.search);
    const level = String(levelSelect.value || "").trim();
    const themeKey = String(state.selectedThemeKey || "").trim();

    if (level) {
      params.set("level", level);
    } else {
      params.delete("level");
    }

    if (themeKey) {
      params.set("themeKey", themeKey);
    } else {
      params.delete("themeKey");
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function clearEditForm() {
    state.selectedThemeKey = "";
    editThemeKeyInput.value = "";
    editNewKeyInput.value = "";
    editThemeTitleInput.value = "";
    updatePartEditorLinks();
  }

  function updatePartEditorLinks() {
    if (!partEditorLinks.length) {
      syncUrlState();
      return;
    }
    const level = String(levelSelect.value || "").trim();
    const themeKey = String(state.selectedThemeKey || "").trim();
    const versionKey = "default";

    partEditorLinks.forEach((link) => {
      const baseHref = link.getAttribute("href") || "";
      const path = baseHref.split("?")[0];
      const params = new URLSearchParams();
      if (level) {
        params.set("level", level);
      }
      if (themeKey) {
        params.set("themeKey", themeKey);
      }
      params.set("versionKey", versionKey);
      link.setAttribute("href", `${path}?${params.toString()}`);
    });

    syncUrlState();
  }

  function renderThemes() {
    if (!state.themes.length) {
      themesBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">No themes in this level</td></tr>';
      return;
    }

    themesBody.innerHTML = state.themes
      .map((theme) => {
        const isActive = theme.key === state.selectedThemeKey;
        return `
          <tr data-searchable="true" data-search-text="${escapeHtml(`${theme.key} ${theme.title || ""}`)}">
            <td><code class="kbd-inline">${escapeHtml(theme.key)}</code></td>
            <td>${escapeHtml(theme.title)}</td>
            <td>${theme.versionCount}</td>
            <td class="text-end">
              <button class="btn btn-sm ${isActive ? "btn-primary" : "btn-outline-primary"}" type="button" data-action="select" data-theme-key="${escapeHtml(theme.key)}">
                ${isActive ? "Selected" : "Select"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    themesBody.querySelectorAll("button[data-action='select']").forEach((button) => {
      button.addEventListener("click", () => {
        const themeKey = button.getAttribute("data-theme-key") || "";
        selectTheme(themeKey);
      });
    });

    applyTableSearch();
    updatePartEditorLinks();
  }

  async function selectTheme(themeKey) {
    if (!themeKey) {
      return;
    }
    try {
      const theme = await api(`/lesen/theme?level=${encodeURIComponent(levelSelect.value)}&themeKey=${encodeURIComponent(themeKey)}`);
      state.selectedThemeKey = themeKey;
      editThemeKeyInput.value = themeKey;
      editThemeTitleInput.value = theme.title || "";
      editNewKeyInput.value = "";
      renderThemes();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  }

  async function loadThemes() {
    clearEditForm();
    themesBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Loading...</td></tr>';
    try {
      const data = await api(`/lesen/themes?level=${encodeURIComponent(levelSelect.value)}`);
      state.themes = Array.isArray(data) ? data : [];
      renderThemes();

      let desiredTheme = "";
      if (pendingThemeFromQuery && state.themes.some((theme) => theme.key === pendingThemeFromQuery)) {
        desiredTheme = pendingThemeFromQuery;
      } else if (!state.selectedThemeKey && state.themes.length) {
        desiredTheme = state.themes[0].key;
      }
      pendingThemeFromQuery = "";
      if (desiredTheme) {
        await selectTheme(desiredTheme);
      }
    } catch (error) {
      showAlert(alertHost, error.message, "error");
      themesBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Failed to load themes</td></tr>';
    }
  }

  createThemeBtn.addEventListener("click", async () => {
    const themeKey = newThemeKeyInput.value.trim();
    const title = newThemeTitleInput.value.trim();

    if (!themeKey || !title) {
      showAlert(alertHost, "Please provide both theme key and title", "error");
      return;
    }

    try {
      await api("/lesen/theme", {
        method: "POST",
        body: {
          level: levelSelect.value,
          themeKey,
          title
        }
      });

      showAlert(alertHost, "Theme created successfully", "success");
      newThemeKeyInput.value = "";
      newThemeTitleInput.value = "";
      await loadThemes();
      await selectTheme(themeKey);
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  saveThemeBtn.addEventListener("click", async () => {
    const themeKey = editThemeKeyInput.value.trim();
    if (!themeKey) {
      showAlert(alertHost, "Select a theme first", "error");
      return;
    }

    const title = editThemeTitleInput.value.trim();
    if (!title) {
      showAlert(alertHost, "Title is required", "error");
      return;
    }

    const newThemeKey = editNewKeyInput.value.trim();

    try {
      const response = await api("/lesen/theme", {
        method: "PUT",
        body: {
          level: levelSelect.value,
          themeKey,
          title,
          newThemeKey
        }
      });

      showAlert(alertHost, "Theme updated successfully", "success");
      await loadThemes();
      await selectTheme(response.key || newThemeKey || themeKey);
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  deleteThemeBtn.addEventListener("click", async () => {
    const themeKey = editThemeKeyInput.value.trim();
    if (!themeKey) {
      showAlert(alertHost, "Select a theme first", "error");
      return;
    }

    const confirmed = window.confirm(`Delete theme "${themeKey}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await api("/lesen/theme", {
        method: "DELETE",
        body: {
          level: levelSelect.value,
          themeKey
        }
      });

      showAlert(alertHost, "Theme deleted", "success");
      clearEditForm();
      loadThemes();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  levelSelect.addEventListener("change", loadThemes);
  refreshBtn.addEventListener("click", loadThemes);

  updatePartEditorLinks();
  loadThemes();
})();
