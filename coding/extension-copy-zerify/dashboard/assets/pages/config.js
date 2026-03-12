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
  const homepagePromoEnabledInput = document.getElementById("homepage-promo-enabled");
  const DEFAULT_BOTTOM_INTERVAL_HOURS = 3;

  const bannerControls = {
    top: {
      enabledInput: document.getElementById("ads-top-enabled"),
      clickUrlInput: document.getElementById("ads-top-click-url"),
      desktop: {
        fileInput: document.getElementById("ads-top-desktop-file"),
        uploadBtn: document.getElementById("ads-top-desktop-upload"),
        clearBtn: document.getElementById("ads-top-desktop-clear"),
        pathInput: document.getElementById("ads-top-desktop-path"),
        previewImg: document.getElementById("ads-top-desktop-preview")
      },
      mobile: {
        fileInput: document.getElementById("ads-top-mobile-file"),
        uploadBtn: document.getElementById("ads-top-mobile-upload"),
        clearBtn: document.getElementById("ads-top-mobile-clear"),
        pathInput: document.getElementById("ads-top-mobile-path"),
        previewImg: document.getElementById("ads-top-mobile-preview")
      }
    },
    bottom: {
      enabledInput: document.getElementById("ads-bottom-enabled"),
      clickUrlInput: document.getElementById("ads-bottom-click-url"),
      intervalHoursInput: document.getElementById("ads-bottom-interval-hours"),
      desktop: {
        fileInput: document.getElementById("ads-bottom-desktop-file"),
        uploadBtn: document.getElementById("ads-bottom-desktop-upload"),
        clearBtn: document.getElementById("ads-bottom-desktop-clear"),
        pathInput: document.getElementById("ads-bottom-desktop-path"),
        previewImg: document.getElementById("ads-bottom-desktop-preview")
      },
      mobile: {
        fileInput: document.getElementById("ads-bottom-mobile-file"),
        uploadBtn: document.getElementById("ads-bottom-mobile-upload"),
        clearBtn: document.getElementById("ads-bottom-mobile-clear"),
        pathInput: document.getElementById("ads-bottom-mobile-path"),
        previewImg: document.getElementById("ads-bottom-mobile-preview")
      }
    }
  };

  const BANNER_IMAGE_SPECS = {
    top: {
      desktop: { width: 970, height: 90 },
      mobile: { width: 320, height: 50 }
    },
    bottom: {
      desktop: { width: 970, height: 90 },
      mobile: { width: 320, height: 50 }
    }
  };

  const applyTableSearch = createTableSearch({
    inputEl: modulesSearchInput,
    tbodyEl: modulesBody,
    emptyColspan: 6,
    emptyMessage: "No matching modules found"
  });

  let modules = [];
  let adsState = createEmptyAds();

  function normalizeIntervalHours(value, fallback = DEFAULT_BOTTOM_INTERVAL_HOURS) {
    const raw = String(value ?? "").trim();
    const candidate = raw === "" ? Number.NaN : Number(raw);
    if (Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }
    const base = Number(fallback);
    if (Number.isFinite(base) && base >= 0) {
      return base;
    }
    return DEFAULT_BOTTOM_INTERVAL_HOURS;
  }

  function createEmptyAds() {
    return {
      top: {
        enabled: false,
        desktopImage: "",
        mobileImage: "",
        clickUrl: ""
      },
      bottom: {
        enabled: false,
        desktopImage: "",
        mobileImage: "",
        clickUrl: "",
        displayIntervalHours: DEFAULT_BOTTOM_INTERVAL_HOURS
      }
    };
  }

  function normalizeHomepagePromo(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      enabled: typeof source.enabled === "boolean" ? source.enabled : true
    };
  }

  function normalizeBannerSlot(slot, value, fallback = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const base = fallback && typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {};
    const normalized = {
      enabled: typeof source.enabled === "boolean" ? source.enabled : Boolean(base.enabled),
      desktopImage: typeof source.desktopImage === "string" ? source.desktopImage.trim() : String(base.desktopImage || "").trim(),
      mobileImage: typeof source.mobileImage === "string" ? source.mobileImage.trim() : String(base.mobileImage || "").trim(),
      clickUrl: typeof source.clickUrl === "string" ? source.clickUrl.trim() : String(base.clickUrl || "").trim()
    };
    if (slot === "bottom") {
      normalized.displayIntervalHours = normalizeIntervalHours(source.displayIntervalHours, base.displayIntervalHours);
    }
    return normalized;
  }

  function normalizeAds(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const defaults = createEmptyAds();
    return {
      top: normalizeBannerSlot("top", source.top, defaults.top),
      bottom: normalizeBannerSlot("bottom", source.bottom, defaults.bottom)
    };
  }

  function resolveAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) {
      return raw;
    }
    if (raw.startsWith("/")) {
      return raw;
    }
    return `/${raw}`;
  }

  function setPreviewImage(img, pathValue) {
    if (!img) {
      return;
    }
    const src = resolveAssetPath(pathValue);
    if (!src) {
      img.removeAttribute("src");
      img.classList.remove("is-visible");
      return;
    }
    img.src = src;
    img.classList.add("is-visible");
  }

  function renderAds() {
    Object.entries(bannerControls).forEach(([slot, controls]) => {
      const slotState = adsState[slot] || {};
      if (controls.enabledInput) {
        controls.enabledInput.checked = Boolean(slotState.enabled);
      }
      if (controls.clickUrlInput) {
        controls.clickUrlInput.value = String(slotState.clickUrl || "");
      }
      if (controls.intervalHoursInput) {
        controls.intervalHoursInput.value = String(normalizeIntervalHours(slotState.displayIntervalHours));
      }
      ["desktop", "mobile"].forEach((device) => {
        const refs = controls[device];
        const field = device === "desktop" ? "desktopImage" : "mobileImage";
        const value = String(slotState[field] || "");
        if (refs.pathInput) {
          refs.pathInput.value = value;
        }
        setPreviewImage(refs.previewImg, value);
      });
    });
  }

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
    if (homepagePromoEnabledInput) {
      homepagePromoEnabledInput.checked = normalizeHomepagePromo(config.homepagePromo).enabled;
    }
    adsState = normalizeAds(config.ads);

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

    renderAds();
    renderModules();
  }

  function buildPayload() {
    const payload = {
      fontScale: Number(fontScaleInput.value || 1),
      asideWidth: String(asideWidthInput.value || "40%").trim(),
      defaultModule: String(defaultModuleInput.value || "").trim(),
      homepagePromo: {
        enabled: homepagePromoEnabledInput ? Boolean(homepagePromoEnabledInput.checked) : true
      },
      ads: normalizeAds(adsState),
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

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  function readImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const blobUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const result = {
          width: image.naturalWidth,
          height: image.naturalHeight
        };
        URL.revokeObjectURL(blobUrl);
        resolve(result);
      };
      image.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Invalid image file."));
      };
      image.src = blobUrl;
    });
  }

  async function uploadBanner(slot, device) {
    const slotControls = bannerControls[slot];
    const refs = slotControls?.[device];
    const inputFile = refs?.fileInput?.files?.[0];
    if (!inputFile) {
      showAlert(alertHost, "Choose an image first.", "error");
      return;
    }

    const expected = BANNER_IMAGE_SPECS[slot]?.[device];
    if (!expected) {
      showAlert(alertHost, "Invalid banner slot/device.", "error");
      return;
    }

    const uploadBtn = refs.uploadBtn;
    const originalText = uploadBtn ? uploadBtn.textContent : "Upload";

    try {
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";
      }

      const dimensions = await readImageDimensions(inputFile);
      if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
        throw new Error(`Image must be exactly ${expected.width}x${expected.height}px. Uploaded: ${dimensions.width}x${dimensions.height}px.`);
      }

      const dataUrl = await readFileAsDataUrl(inputFile);
      const uploaded = await api("/config/banner-upload", {
        method: "POST",
        body: {
          slot,
          device,
          fileName: inputFile.name,
          dataUrl
        }
      });

      const field = device === "desktop" ? "desktopImage" : "mobileImage";
      adsState[slot][field] = String(uploaded.relativePath || "");
      if (refs.fileInput) {
        refs.fileInput.value = "";
      }
      renderAds();
      showAlert(alertHost, `${slot} ${device} banner uploaded successfully.`, "success");
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalText;
      }
    }
  }

  function clearBanner(slot, device) {
    const field = device === "desktop" ? "desktopImage" : "mobileImage";
    adsState[slot][field] = "";
    const refs = bannerControls[slot]?.[device];
    if (refs?.fileInput) {
      refs.fileInput.value = "";
    }
    renderAds();
  }

  function setupBannerControls() {
    Object.entries(bannerControls).forEach(([slot, controls]) => {
      if (controls.enabledInput) {
        controls.enabledInput.addEventListener("change", () => {
          adsState[slot].enabled = Boolean(controls.enabledInput.checked);
        });
      }
      if (controls.clickUrlInput) {
        controls.clickUrlInput.addEventListener("input", () => {
          adsState[slot].clickUrl = String(controls.clickUrlInput.value || "").trim();
        });
      }
      if (controls.intervalHoursInput) {
        controls.intervalHoursInput.addEventListener("input", () => {
          adsState[slot].displayIntervalHours = normalizeIntervalHours(controls.intervalHoursInput.value);
        });
      }

      ["desktop", "mobile"].forEach((device) => {
        const refs = controls[device];
        if (!refs) {
          return;
        }
        if (refs.uploadBtn) {
          refs.uploadBtn.addEventListener("click", () => {
            void uploadBanner(slot, device);
          });
        }
        if (refs.clearBtn) {
          refs.clearBtn.addEventListener("click", () => {
            clearBanner(slot, device);
          });
        }
      });
    });
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

  setupBannerControls();
  loadConfig();
})();
