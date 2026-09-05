(function managerBootstrap(window) {
  const API_BASE = "/api";
  let repositorySyncPromise = null;
  let repositoryStatusTimer = null;
  let repositoryButton = null;
  let repositoryCancelButton = null;
  let repositoryDetail = null;

  async function request(path, options = {}) {
    const method = options.method || "GET";
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      const message = payload?.message || `Request failed with status ${response.status}`;
      const details = payload?.details ? `\n${JSON.stringify(payload.details)}` : "";
      throw new Error(`${message}${details}`);
    }

    return payload.data;
  }

  async function uploadBinary(path, file, headers = {}) {
    const syncState = await ensureRepositorySynced();
    if (!syncState.ready) {
      throw new Error(`Repository sync must succeed before uploading audio. ${syncState.error?.message || ""}`.trim());
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": file?.type || "application/octet-stream",
        ...headers
      },
      body: file
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `Upload failed with status ${response.status}`);
    }
    window.setTimeout(refreshRepositoryStatus, 150);
    return payload.data;
  }

  function setRepositoryButtonState(state, data = {}) {
    if (!repositoryButton || !repositoryDetail) {
      return;
    }

    repositoryButton.className = "btn repository-sidebar-button w-100";
    repositoryButton.disabled = false;
    if (repositoryCancelButton) {
      repositoryCancelButton.classList.toggle("d-none", state !== "pending");
      repositoryCancelButton.disabled = state !== "pending";
    }

    if (state === "loading") {
      repositoryButton.classList.add("btn-outline-secondary");
      repositoryButton.disabled = true;
      repositoryButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Fetching changes...';
      repositoryDetail.textContent = "Checking GitHub before edits are enabled.";
      return;
    }

    if (state === "pending") {
      const changeCount = Number(data.changeCount || 0);
      const ahead = Number(data.ahead || 0);
      repositoryButton.classList.add("is-pending");
      repositoryButton.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Push changes';
      repositoryDetail.textContent = changeCount
        ? `${changeCount} data or audio file${changeCount === 1 ? "" : "s"} waiting to upload.`
        : `${ahead} local commit${ahead === 1 ? "" : "s"} waiting to upload.`;
      return;
    }

    if (state === "error") {
      repositoryButton.classList.add("is-error");
      repositoryButton.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Retry sync';
      repositoryDetail.textContent = data.message || "Could not check the repository.";
      return;
    }

    repositoryButton.classList.add("is-current");
    repositoryButton.disabled = true;
    repositoryButton.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Everything uploaded';
    repositoryDetail.textContent = "Repository data is up to date.";
  }

  function renderRepositoryStatus(status) {
    const pending = Number(status?.changeCount || 0) > 0 || Number(status?.ahead || 0) > 0;
    setRepositoryButtonState(pending ? "pending" : "current", status || {});
  }

  async function refreshRepositoryStatus() {
    try {
      const status = await request("/repository/status");
      renderRepositoryStatus(status);
      return status;
    } catch (error) {
      setRepositoryButtonState("error", { message: error.message });
      return null;
    }
  }

  async function syncRepository() {
    setRepositoryButtonState("loading");
    try {
      const result = await request("/repository/sync", { method: "POST", body: {} });
      renderRepositoryStatus(result?.status || {});
      return { ready: true, result };
    } catch (error) {
      setRepositoryButtonState("error", { message: error.message });
      return { ready: false, error };
    }
  }

  function ensureRepositorySynced() {
    if (!repositorySyncPromise) {
      repositorySyncPromise = syncRepository();
    }
    return repositorySyncPromise;
  }

  async function publishRepositoryChanges() {
    const confirmed = window.confirm("Commit and push all saved exam data and Hören audio changes to GitHub?");
    if (!confirmed) {
      return;
    }

    setRepositoryButtonState("loading");
    if (repositoryButton) {
      repositoryButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Uploading changes...';
    }

    try {
      const result = await request("/repository/publish", {
        method: "POST",
        body: { message: "Update exam data from dashboard" }
      });
      renderRepositoryStatus(result?.status || {});
    } catch (error) {
      setRepositoryButtonState("error", { message: error.message });
      window.alert(`The changes could not be uploaded.\n\n${error.message}`);
      await refreshRepositoryStatus();
    }
  }

  async function discardRepositoryChanges() {
    const confirmed = window.confirm(
      "Permanently discard all unpushed exam data and Hören audio changes and restore the latest GitHub version?\n\nThis cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setRepositoryButtonState("loading");
    if (repositoryButton) {
      repositoryButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Canceling changes...';
    }

    try {
      const result = await request("/repository/discard", { method: "POST", body: {} });
      renderRepositoryStatus(result?.status || {});
      repositorySyncPromise = Promise.resolve({ ready: true, result });
      window.location.reload();
    } catch (error) {
      window.alert(`The changes could not be canceled.\n\n${error.message}`);
      await refreshRepositoryStatus();
    }
  }

  function installRepositoryControl() {
    const sidebar = document.querySelector(".manager-sidebar");
    if (!sidebar) {
      return;
    }

    const control = document.createElement("div");
    control.className = "repository-sidebar-control";
    control.innerHTML = `
      <button class="btn btn-outline-secondary repository-sidebar-button w-100" type="button" disabled>
        <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Fetching changes...
      </button>
      <button class="btn btn-outline-danger repository-cancel-button w-100 mt-2 d-none" type="button" disabled>
        <i class="bi bi-arrow-counterclockwise me-1"></i> Cancel changes
      </button>
      <small class="repository-sidebar-detail">Checking GitHub before edits are enabled.</small>
    `;
    sidebar.append(control);
    repositoryButton = control.querySelector("button");
    repositoryCancelButton = control.querySelector(".repository-cancel-button");
    repositoryDetail = control.querySelector("small");

    repositoryButton.addEventListener("click", async () => {
      if (repositoryButton.classList.contains("is-pending")) {
        await publishRepositoryChanges();
        return;
      }
      repositorySyncPromise = null;
      await ensureRepositorySynced();
    });

    repositoryCancelButton.addEventListener("click", discardRepositoryChanges);

    ensureRepositorySynced();
    repositoryStatusTimer = window.setInterval(refreshRepositoryStatus, 15000);
    window.addEventListener("focus", refreshRepositoryStatus);
    window.addEventListener("beforeunload", () => window.clearInterval(repositoryStatusTimer), { once: true });
  }

  async function api(path, options = {}) {
    const method = options.method || "GET";
    const isRepositoryRequest = path.startsWith("/repository/");
    if (!isRepositoryRequest) {
      const syncState = await ensureRepositorySynced();
      const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
      if (!syncState.ready && isMutation) {
        throw new Error(`Repository sync must succeed before saving changes. ${syncState.error?.message || ""}`.trim());
      }
    }

    const data = await request(path, options);
    if (!isRepositoryRequest && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
      window.setTimeout(refreshRepositoryStatus, 150);
    }
    return data;
  }

  function showAlert(host, message, type = "success") {
    if (!host) {
      return;
    }
    host.innerHTML = "";

    const alert = document.createElement("div");
    alert.className = `manager-alert ${type}`;
    alert.textContent = message;
    alert.classList.add("p-3", "mb-3");
    host.append(alert);

    window.setTimeout(() => {
      if (host.contains(alert)) {
        alert.remove();
      }
    }, 4200);
  }

  function setActiveNav(pageId) {
    document.querySelectorAll("[data-manager-nav]").forEach((link) => {
      const active = link.getAttribute("data-manager-nav") === pageId;
      link.classList.toggle("active", active);
    });
  }

  function toLines(value) {
    if (Array.isArray(value)) {
      return value.join("\n");
    }
    return "";
  }

  function linesToArray(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function dateTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createTableSearch({ inputEl, tbodyEl, emptyColspan = 1, emptyMessage = "No matching rows found" }) {
    if (!inputEl || !tbodyEl) {
      return () => {};
    }

    const ensureNoResultRow = () => {
      let row = tbodyEl.querySelector("tr[data-no-results='true']");
      if (!row) {
        row = document.createElement("tr");
        row.setAttribute("data-no-results", "true");
        row.classList.add("d-none");
        row.innerHTML = `<td colspan="${Number(emptyColspan) || 1}" class="text-center text-secondary py-4">${escapeHtml(emptyMessage)}</td>`;
        tbodyEl.append(row);
      }
      return row;
    };

    const apply = () => {
      const query = String(inputEl.value || "").trim().toLowerCase();
      const rows = Array.from(tbodyEl.querySelectorAll("tr[data-searchable='true']"));

      if (!rows.length) {
        const noResultRow = tbodyEl.querySelector("tr[data-no-results='true']");
        if (noResultRow) {
          noResultRow.classList.add("d-none");
        }
        return;
      }

      let visibleCount = 0;
      rows.forEach((row) => {
        const searchableText = String(row.dataset.searchText || row.textContent || "").toLowerCase();
        const visible = !query || searchableText.includes(query);
        row.classList.toggle("d-none", !visible);
        if (visible) {
          visibleCount += 1;
        }
      });

      const noResultRow = ensureNoResultRow();
      noResultRow.classList.toggle("d-none", visibleCount > 0);
    };

    inputEl.addEventListener("input", apply);
    return apply;
  }

  window.ManagerApi = {
    api,
    showAlert,
    setActiveNav,
    toLines,
    linesToArray,
    dateTime,
    escapeHtml,
    createTableSearch,
    uploadBinary,
    refreshRepositoryStatus
  };

  installRepositoryControl();
})(window);
