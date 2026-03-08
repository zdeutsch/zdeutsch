(function managerBootstrap(window) {
  const API_BASE = "/api";

  async function api(path, options = {}) {
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
    createTableSearch
  };
})(window);
