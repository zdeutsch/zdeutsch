(function initOverviewPage() {
  const { api, setActiveNav, showAlert, dateTime, escapeHtml, createTableSearch } = window.ManagerApi;
  setActiveNav("overview");

  const alertHost = document.getElementById("alert-host");
  const healthIndicator = document.getElementById("health-indicator");
  const refreshBtn = document.getElementById("refresh-btn");
  const filesSearchInput = document.getElementById("files-search-input");
  const filesBody = document.getElementById("files-table-body");

  const kpiModules = document.getElementById("kpi-modules");
  const kpiLesen = document.getElementById("kpi-lesen");
  const kpiHoren = document.getElementById("kpi-horen");
  const kpiShreiben = document.getElementById("kpi-shreiben");
  const applyTableSearch = createTableSearch({
    inputEl: filesSearchInput,
    tbodyEl: filesBody,
    emptyColspan: 4,
    emptyMessage: "No matching files found"
  });

  function formatBytes(size) {
    if (!Number.isFinite(size)) {
      return "-";
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function renderFiles(files) {
    if (!Array.isArray(files) || !files.length) {
      filesBody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">No files found</td></tr>';
      return;
    }

    filesBody.innerHTML = files
      .map(
        (file) => `
          <tr data-searchable="true" data-search-text="${escapeHtml(`${file.fileKey} ${file.fileName}`)}">
            <td><span class="badge badge-soft">${escapeHtml(file.fileKey)}</span></td>
            <td>${escapeHtml(file.fileName)}</td>
            <td>${formatBytes(file.sizeBytes)}</td>
            <td>${escapeHtml(dateTime(file.updatedAt))}</td>
          </tr>
        `
      )
      .join("");
    applyTableSearch();
  }

  async function loadHealth() {
    try {
      await api("/health");
      healthIndicator.className = "badge rounded-pill text-bg-success";
      healthIndicator.textContent = "API Healthy";
    } catch (error) {
      healthIndicator.className = "badge rounded-pill text-bg-danger";
      healthIndicator.textContent = "API Unavailable";
      showAlert(alertHost, error.message, "error");
    }
  }

  async function loadOverview() {
    try {
      const data = await api("/overview");
      kpiModules.textContent = String(data?.counts?.modules ?? 0);
      kpiLesen.textContent = String(data?.counts?.lesenThemes?.total ?? 0);
      kpiHoren.textContent = String(data?.counts?.horenTopics?.total ?? 0);
      kpiShreiben.textContent = String(data?.counts?.shreibenTasks?.total ?? 0);
      renderFiles(data?.files || []);
    } catch (error) {
      showAlert(alertHost, error.message, "error");
      filesBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Failed to load overview</td></tr>';
    }
  }

  refreshBtn.addEventListener("click", () => {
    loadOverview();
    loadHealth();
  });

  loadHealth();
  loadOverview();
})();
