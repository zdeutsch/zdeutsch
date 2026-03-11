(function initConfigPage() {
  const { api, setActiveNav, showAlert, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("config");

  const alertHost = document.getElementById("alert-host");
  const reloadBtn = document.getElementById("reload-btn");
  const modulesSearchInput = document.getElementById("modules-search-input");
  const modulesBody = document.getElementById("modules-body");
  const addModuleBtn = document.getElementById("add-module-btn");
  const saveConfigBtn = document.getElementById("save-config-btn");
  const resetFormBtn = document.getElementById("reset-form-btn");

  const fontScaleInput = document.getElementById("font-scale");
  const asideWidthInput = document.getElementById("aside-width");
  const defaultModuleInput = document.getElementById("default-module");
  const showMeinLangAdInput = document.getElementById("show-meinlang-ad");
  const applyTableSearch = createTableSearch({
    inputEl: modulesSearchInput,
    tbodyEl: modulesBody,
    emptyColspan: 6,
    emptyMessage: "No matching modules found"
  });

  let modules = [];

  function moduleRow(module, index) {
    const searchText = [
      module.name || "",
      module.dataFile || "",
      module.timer?.enabled ? "enabled" : "disabled",
      Number(module.timer?.durationMinutes || 0),
      Number(module.scoreConfig?.passPercent || 60)
    ].join(" ");
    return `
      <tr data-index="${index}" data-searchable="true" data-search-text="${escapeHtml(searchText)}">
        <td><input type="text" class="form-control form-control-sm" data-field="name" value="${escapeHtml(module.name || "")}"></td>
        <td><input type="text" class="form-control form-control-sm" data-field="dataFile" value="${escapeHtml(module.dataFile || "")}"></td>
        <td class="text-center"><input type="checkbox" class="form-check-input" data-field="timerEnabled" ${module.timer?.enabled ? "checked" : ""}></td>
        <td><input type="number" class="form-control form-control-sm" data-field="durationMinutes" min="0" value="${Number(module.timer?.durationMinutes || 0)}"></td>
        <td><input type="number" class="form-control form-control-sm" data-field="passPercent" min="0" max="100" value="${Number(module.scoreConfig?.passPercent || 60)}"></td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-action="delete"><i class="bi bi-trash"></i></button></td>
      </tr>
    `;
  }

  function renderModules() {
    if (!modules.length) {
      modulesBody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">No modules yet</td></tr>';
      return;
    }

    modulesBody.innerHTML = modules.map((module, index) => moduleRow(module, index)).join("");

    const updateRowSearchText = (tr) => {
      if (!tr) {
        return;
      }
      const values = Array.from(tr.querySelectorAll("input")).map((field) => {
        if (field.type === "checkbox") {
          return field.checked ? "enabled" : "disabled";
        }
        return field.value || "";
      });
      tr.dataset.searchText = values.join(" ");
    };

    modulesBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (event) => {
        const tr = event.target.closest("tr");
        const index = Number(tr?.dataset.index);
        if (!Number.isFinite(index) || !modules[index]) {
          return;
        }

        const field = event.target.getAttribute("data-field");
        const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

        if (field === "name") {
          modules[index].name = String(value || "").trim();
        } else if (field === "dataFile") {
          modules[index].dataFile = String(value || "").trim();
        } else if (field === "timerEnabled") {
          modules[index].timer = {
            ...modules[index].timer,
            enabled: Boolean(value)
          };
        } else if (field === "durationMinutes") {
          modules[index].timer = {
            ...modules[index].timer,
            durationMinutes: Number(value) || 0
          };
        } else if (field === "passPercent") {
          modules[index].scoreConfig = {
            ...modules[index].scoreConfig,
            passPercent: Number(value) || 0
          };
        }

        updateRowSearchText(tr);
        applyTableSearch();
      });
    });

    modulesBody.querySelectorAll("button[data-action='delete']").forEach((button) => {
      button.addEventListener("click", (event) => {
        const tr = event.target.closest("tr");
        const index = Number(tr?.dataset.index);
        if (!Number.isFinite(index)) {
          return;
        }
        modules.splice(index, 1);
        renderModules();
      });
    });

    applyTableSearch();
  }

  function applyConfig(config) {
    fontScaleInput.value = Number(config.fontScale || 1);
    asideWidthInput.value = config.asideWidth || "40%";
    defaultModuleInput.value = config.defaultModule || "";
    showMeinLangAdInput.checked = config.showMeinLangAd !== false;

    modules = Array.isArray(config.modules)
      ? config.modules.map((module) => ({
          name: module.name || "",
          dataFile: module.dataFile || "",
          timer: {
            enabled: Boolean(module.timer?.enabled),
            durationMinutes: Number(module.timer?.durationMinutes || 0)
          },
          scoreConfig: {
            passPercent: Number(module.scoreConfig?.passPercent || 60),
            parts: module.scoreConfig?.parts || {}
          }
        }))
      : [];

    renderModules();
  }

  function buildPayload() {
    const payload = {
      fontScale: Number(fontScaleInput.value || 1),
      asideWidth: String(asideWidthInput.value || "40%").trim(),
      defaultModule: String(defaultModuleInput.value || "").trim(),
      showMeinLangAd: Boolean(showMeinLangAdInput.checked),
      modules: modules.map((module) => ({
        name: String(module.name || "").trim(),
        dataFile: String(module.dataFile || "").trim(),
        timer: {
          enabled: Boolean(module.timer?.enabled),
          durationMinutes: Number(module.timer?.durationMinutes || 0)
        },
        scoreConfig: {
          passPercent: Number(module.scoreConfig?.passPercent || 0),
          parts: module.scoreConfig?.parts || {}
        }
      }))
    };

    if (!payload.defaultModule && payload.modules.length) {
      payload.defaultModule = payload.modules[0].name;
      defaultModuleInput.value = payload.defaultModule;
    }

    return payload;
  }

  async function loadConfig() {
    try {
      const config = await api("/config");
      applyConfig(config);
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  }

  addModuleBtn.addEventListener("click", () => {
    modules.push({
      name: "new-module",
      dataFile: "new-file.json",
      timer: {
        enabled: false,
        durationMinutes: 45
      },
      scoreConfig: {
        passPercent: 60,
        parts: {}
      }
    });
    renderModules();
  });

  reloadBtn.addEventListener("click", loadConfig);
  resetFormBtn.addEventListener("click", loadConfig);

  saveConfigBtn.addEventListener("click", async () => {
    try {
      const payload = buildPayload();
      await api("/config", {
        method: "PUT",
        body: payload
      });
      showAlert(alertHost, "Configuration saved successfully", "success");
      loadConfig();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  loadConfig();
})();
