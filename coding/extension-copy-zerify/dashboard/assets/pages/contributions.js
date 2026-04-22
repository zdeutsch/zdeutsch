(function initContributionsPage() {
  const { api, setActiveNav, showAlert, escapeHtml, dateTime } = window.ManagerApi;
  setActiveNav("contributions");

  const alertHost = document.getElementById("alert-host");
  const refreshBtn = document.getElementById("refresh-btn");
  const levelSelect = document.getElementById("level-select");
  const statusSelect = document.getElementById("status-select");
  const scopeSelect = document.getElementById("scope-select");
  const searchInput = document.getElementById("search-input");
  const kpiTotal = document.getElementById("kpi-total");
  const kpiTotalLabel = document.getElementById("kpi-total-label");
  const kpiPending = document.getElementById("kpi-pending");
  const kpiAccepted = document.getElementById("kpi-accepted");
  const kpiRejected = document.getElementById("kpi-rejected");
  const contributionsHost = document.getElementById("contributions-host");

  const state = {
    items: [],
    summary: {
      totalAll: 0,
      totalDifferent: 0,
      matchingCurrent: 0,
      pending: 0,
      accepted: 0,
      rejected: 0
    },
    loading: false,
    actingKey: "",
    actingAction: "",
    editingKey: "",
    editValues: {},
    latestRequestId: 0
  };

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatStatusLabel(status) {
    if (status === "accepted") {
      return "Accepted";
    }
    if (status === "rejected") {
      return "Rejected";
    }
    return "Pending";
  }

  function buildPublicThemeUrl(item) {
    if (!item || item.canAccept === false) {
      return "";
    }

    const levelKey = String(item.levelKey || "").trim();
    const themeKey = String(item.themeKey || "").trim();
    const versionKey = String(item.currentVersionKey || "default").trim() || "default";
    if (!levelKey || !themeKey) {
      return "";
    }

    const params = new URLSearchParams();
    params.set("level", levelKey);
    params.set("theme", themeKey);
    params.set("version", versionKey);
    const publicBaseUrl = String(window.ZDEUTSCH_PUBLIC_SITE_URL || "https://example.com/ZDeutsch").replace(/\/+$/, "");
    return `${publicBaseUrl}/lesen.html?${params.toString()}`;
  }

  function getComparisonRows(item) {
    if (Array.isArray(item?.comparisonRows) && item.comparisonRows.length) {
      return item.comparisonRows;
    }
    if (Array.isArray(item?.differences) && item.differences.length) {
      return item.differences;
    }
    return [];
  }

  function getActionLabel(item, action) {
    const isBusy = state.actingKey === item.reviewKey && state.actingAction === action;
    if (action === "accept") {
      return isBusy ? "Saving..." : "Accept";
    }
    if (action === "reject") {
      return isBusy ? "Saving..." : "Refuse";
    }
    if (action === "revert") {
      return isBusy ? "Saving..." : "Revert to previous";
    }
    if (action === "edit") {
      return isBusy ? "Opening..." : "Edit";
    }
    if (action === "save-edit") {
      return isBusy ? "Saving..." : "Save edit";
    }
    if (action === "cancel-edit") {
      return isBusy ? "Saving..." : "Cancel";
    }
    if (action === "reset-edit") {
      return isBusy ? "Saving..." : "Reset edit";
    }
    return isBusy ? "Saving..." : "Save";
  }

  function buildEditSeed(item) {
    const seed = {};
    getComparisonRows(item).forEach((row) => {
      seed[String(row.itemNumber || "").trim()] = String(row.submittedValue || "");
    });
    return seed;
  }

  function getEditingValue(itemNumber, fallbackValue) {
    if (Object.prototype.hasOwnProperty.call(state.editValues, itemNumber)) {
      return String(state.editValues[itemNumber] || "");
    }
    return String(fallbackValue || "");
  }

  function formatAllowedValueLabel(value) {
    const text = String(value || "");
    return text.length === 1 ? text.toUpperCase() : text;
  }

  function renderSubmittedEditor(item, difference) {
    const itemNumber = String(difference.itemNumber || "").trim();
    const currentValue = getEditingValue(itemNumber, difference.submittedValue || "");
    const allowedValues = Array.isArray(difference.allowedValues) ? difference.allowedValues : [];

    if (allowedValues.length) {
      const options = allowedValues.map((value) => {
        const selected = currentValue === value ? "selected" : "";
        return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(formatAllowedValueLabel(value))}</option>`;
      }).join("");

      return `
        <select
          class="form-select form-select-sm contribution-answer-input"
          data-review-key="${escapeHtml(item.reviewKey)}"
          data-edit-item-number="${escapeHtml(itemNumber)}"
        >
          ${options}
        </select>
      `;
    }

    return `
      <input
        type="text"
        class="form-control form-control-sm contribution-answer-input"
        value="${escapeHtml(currentValue)}"
        data-review-key="${escapeHtml(item.reviewKey)}"
        data-edit-item-number="${escapeHtml(itemNumber)}"
      >
    `;
  }

  function updateSummary() {
    const isAllScope = scopeSelect && scopeSelect.value === "all";
    kpiTotal.textContent = String(isAllScope ? (state.summary.totalAll || 0) : (state.summary.totalDifferent || 0));
    if (kpiTotalLabel) {
      kpiTotalLabel.textContent = isAllScope ? "All submissions" : "Different submissions";
    }
    kpiPending.textContent = String(state.summary.pending || 0);
    kpiAccepted.textContent = String(state.summary.accepted || 0);
    kpiRejected.textContent = String(state.summary.rejected || 0);
  }

  function buildSearchIndex(item) {
    const comparisonText = ((item.comparisonRows && item.comparisonRows.length ? item.comparisonRows : item.differences) || [])
      .map((difference) => `${difference.itemNumber} ${difference.currentValue} ${difference.submittedValue}`)
      .join(" ");

    return normalizeText([
      item.levelKey,
      item.themeKey,
      item.themeTitle,
      item.partKey,
      item.partLabel,
      item.email,
      item.reason,
      item.currentVersionLabel,
      item.contextIssue,
      item.matchesCurrent ? "same current matches current identical" : "different changed",
      comparisonText
    ].join(" "));
  }

  function getVisibleItems() {
    const query = normalizeText(searchInput.value);
    if (!query) {
      return state.items;
    }
    return state.items.filter((item) => buildSearchIndex(item).includes(query));
  }

  function renderLoading() {
    contributionsHost.innerHTML = '<div class="manager-card p-4 text-center text-secondary">Loading contributions...</div>';
  }

  function renderEmpty(message) {
    contributionsHost.innerHTML = `<div class="manager-card p-4 text-center text-secondary">${escapeHtml(message)}</div>`;
  }

  function renderList() {
    if (state.loading) {
      renderLoading();
      return;
    }

    const items = getVisibleItems();
    if (!items.length) {
      const emptyMessage = statusSelect.value === "accepted"
        ? "No accepted contributions are saved locally yet."
        : scopeSelect.value === "all"
          ? "No contributions found for the selected filters."
          : "No contribution differences found for the selected filters.";
      renderEmpty(
        searchInput.value
          ? "No contributions match the current search."
          : emptyMessage
      );
      return;
    }

    contributionsHost.innerHTML = items.map((item) => {
      const status = String(item.reviewStatus || "pending").trim().toLowerCase() || "pending";
      const statusLabel = formatStatusLabel(status);
      const isPending = status === "pending";
      const isAccepted = status === "accepted";
      const canAccept = item.canAccept !== false;
      const isBusy = state.actingKey === item.reviewKey;
      const isEditing = state.editingKey === item.reviewKey;
      const comparisonRows = getComparisonRows(item);
      const rowsToDisplay = isEditing
        ? comparisonRows
        : scopeSelect.value === "all" || item.matchesCurrent
        ? comparisonRows
        : (Array.isArray(item.differences) ? item.differences : comparisonRows);
      const submittedLabel = item.submittedAt ? escapeHtml(dateTime(item.submittedAt)) : "-";
      const reviewedLabel = item.reviewedAt ? escapeHtml(dateTime(item.reviewedAt)) : "";
      const levelLabel = String(item.levelKey || "unknown").toUpperCase();
      const publicThemeUrl = buildPublicThemeUrl(item);
      const metaItems = [
        item.email ? `Email: ${escapeHtml(item.email)}` : "Anonymous submission",
        `Submitted: ${submittedLabel}`,
        `Version: ${escapeHtml(item.currentVersionLabel || item.currentVersionKey || "-")}`
      ];
      if (isAccepted && reviewedLabel) {
        metaItems.push(`Accepted: ${reviewedLabel}`);
      }

      const leftColumnLabel = isAccepted ? "Previous correction" : "Current correction";
      const rightColumnLabel = isAccepted ? "Accepted contribution" : "Contribution";

      const diffRows = rowsToDisplay.map((difference) => {
        const submittedCell = isEditing
          ? renderSubmittedEditor(item, difference)
          : `<code class="kbd-inline">${escapeHtml(difference.submittedValue || "-")}</code>`;
        return `
          <tr>
            <td class="text-nowrap">${escapeHtml(difference.itemNumber)}</td>
            <td><code class="kbd-inline">${escapeHtml(difference.currentValue || "-")}</code></td>
            <td>${submittedCell}</td>
          </tr>
        `;
      }).join("");

      return `
        <section class="manager-card contribution-card">
          <div class="contribution-card-header d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span class="badge badge-soft">${escapeHtml(levelLabel)}</span>
                <span class="badge text-bg-light border">${escapeHtml(item.partLabel || item.partKey || "-")}</span>
                <span class="contribution-status contribution-status--${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                ${item.matchesCurrent ? '<span class="badge text-bg-light border">Same as current</span>' : ""}
                ${item.hasLocalEdits ? '<span class="badge text-bg-light border">Edited locally</span>' : ""}
              </div>
              <h2 class="h6 mb-1">${escapeHtml(item.themeTitle || item.themeKey || "Untitled theme")}</h2>
              <div class="small-help d-flex flex-wrap align-items-center gap-2">
                <span>${escapeHtml(item.themeKey || "-")}</span>
                ${publicThemeUrl ? `<a href="${escapeHtml(publicThemeUrl)}" class="link-primary text-decoration-none" target="_blank" rel="noopener noreferrer">Open theme</a>` : ""}
              </div>
            </div>
            <div class="text-start text-lg-end">
              <div class="small-help">Different answers</div>
              <div class="kpi-value">${Number(item.differenceCount || 0)}</div>
            </div>
          </div>
          <div class="contribution-card-body">
            <div class="small-help mb-3">${metaItems.join(" | ")}</div>
            ${item.hasLocalEdits ? '<div class="contribution-reason mb-3"><strong>Admin edit:</strong> This submission was edited locally before review.</div>' : ""}
            ${item.matchesCurrent ? '<div class="contribution-reason mb-3"><strong>Match:</strong> This submission already matches the current correction.</div>' : ""}
            ${item.contextIssue ? `<div class="contribution-reason mb-3"><strong>Context issue:</strong> ${escapeHtml(item.contextIssue)}</div>` : ""}
            ${item.reason ? `<div class="contribution-reason mb-3"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>` : ""}
            ${isEditing ? '<div class="contribution-edit-hint mb-3">Edit the submitted answers, then save the local changes before accepting or refusing the contribution.</div>' : ""}
            <div class="table-responsive">
              <table class="table table-sm align-middle contribution-diff-table mb-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>${escapeHtml(leftColumnLabel)}</th>
                    <th>${escapeHtml(rightColumnLabel)}</th>
                  </tr>
                </thead>
                <tbody>
                  ${diffRows}
                </tbody>
              </table>
            </div>
            <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
              ${isPending ? `
                ${isEditing ? `
                  <button class="btn btn-primary btn-sm" type="button" data-action="save-edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                    ${escapeHtml(getActionLabel(item, "save-edit"))}
                  </button>
                ` : `
                  <button class="btn btn-outline-primary btn-sm" type="button" data-action="edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                    ${escapeHtml(getActionLabel(item, "edit"))}
                  </button>
                `}
                ${isEditing ? `
                  <button class="btn btn-outline-secondary btn-sm" type="button" data-action="cancel-edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                    ${escapeHtml(getActionLabel(item, "cancel-edit"))}
                  </button>
                ` : `
                  ${item.hasLocalEdits ? `
                    <button class="btn btn-outline-secondary btn-sm" type="button" data-action="reset-edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                      ${escapeHtml(getActionLabel(item, "reset-edit"))}
                    </button>
                  ` : ""}
                  ${canAccept ? `
                    <button class="btn btn-success btn-sm" type="button" data-action="accept" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                      ${escapeHtml(getActionLabel(item, "accept"))}
                    </button>
                  ` : `
                    <button class="btn btn-outline-secondary btn-sm" type="button" disabled>Unknown theme</button>
                  `}
                `}
                ${isEditing ? "" : `
                  <button class="btn btn-outline-danger btn-sm" type="button" data-action="reject" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                    ${escapeHtml(getActionLabel(item, "reject"))}
                  </button>
                `}
              ` : isAccepted ? `
                <button class="btn btn-outline-warning btn-sm" type="button" data-action="revert" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
                  ${escapeHtml(getActionLabel(item, "revert"))}
                </button>
              ` : `
                <button class="btn btn-outline-secondary btn-sm" type="button" disabled>${escapeHtml(statusLabel)}</button>
              `}
            </div>
          </div>
        </section>
      `;
    }).join("");
  }

  async function loadContributions() {
    const requestId = state.latestRequestId + 1;
    state.latestRequestId = requestId;
    state.loading = true;
    renderList();

    const params = new URLSearchParams();
    if (levelSelect.value) {
      params.set("level", levelSelect.value);
    }
    if (statusSelect.value) {
      params.set("status", statusSelect.value);
    }
    if (scopeSelect.value) {
      params.set("scope", scopeSelect.value);
    }

    const path = `/contributions/lesen${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      const data = await api(path);
      if (requestId !== state.latestRequestId) {
        return;
      }
      state.items = Array.isArray(data?.items) ? data.items : [];
      state.summary = {
        totalAll: Number(data?.summary?.totalAll || 0),
        totalDifferent: Number(data?.summary?.totalDifferent || 0),
        matchingCurrent: Number(data?.summary?.matchingCurrent || 0),
        pending: Number(data?.summary?.pending || 0),
        accepted: Number(data?.summary?.accepted || 0),
        rejected: Number(data?.summary?.rejected || 0)
      };
    } catch (error) {
      if (requestId !== state.latestRequestId) {
        return;
      }
      state.items = [];
      state.summary = {
        totalAll: 0,
        totalDifferent: 0,
        matchingCurrent: 0,
        pending: 0,
        accepted: 0,
        rejected: 0
      };
      showAlert(alertHost, error.message, "error");
    } finally {
      if (requestId !== state.latestRequestId) {
        return;
      }
      state.loading = false;
      state.actingKey = "";
      state.actingAction = "";
      updateSummary();
      renderList();
    }
  }

  function startEditing(reviewKey) {
    const item = state.items.find((entry) => entry.reviewKey === reviewKey);
    if (!item) {
      return;
    }

    state.editingKey = reviewKey;
    state.editValues = buildEditSeed(item);
    renderList();
  }

  function cancelEditing(reviewKey) {
    if (state.editingKey !== reviewKey) {
      return;
    }

    state.editingKey = "";
    state.editValues = {};
    renderList();
  }

  async function handleEditSave(reviewKey) {
    if (!reviewKey) {
      return;
    }

    const editValues = { ...state.editValues };
    const emptyItemNumbers = Object.entries(editValues)
      .filter(([, value]) => String(value || "").trim() === "")
      .map(([itemNumber]) => itemNumber);

    if (emptyItemNumbers.length) {
      showAlert(alertHost, `Edited answers cannot be empty: ${emptyItemNumbers.join(", ")}`, "error");
      return;
    }

    state.actingKey = reviewKey;
    state.actingAction = "save-edit";
    renderList();

    try {
      const result = await api("/contributions/lesen/edit", {
        method: "POST",
        body: {
          reviewKey,
          answerValues: editValues
        }
      });

      state.editingKey = "";
      state.editValues = {};
      showAlert(alertHost, result?.message || "Local contribution edits were saved.", "success");
      await loadContributions();
    } catch (error) {
      state.actingKey = "";
      state.actingAction = "";
      renderList();
      showAlert(alertHost, error.message, "error");
    }
  }

  async function handleEditReset(reviewKey) {
    if (!reviewKey) {
      return;
    }

    const confirmed = window.confirm("Reset the local admin edits and restore the original submitted answers?");
    if (!confirmed) {
      return;
    }

    state.actingKey = reviewKey;
    state.actingAction = "reset-edit";
    renderList();

    try {
      const result = await api("/contributions/lesen/edit", {
        method: "POST",
        body: {
          reviewKey,
          reset: true
        }
      });

      if (state.editingKey === reviewKey) {
        state.editingKey = "";
        state.editValues = {};
      }

      showAlert(alertHost, result?.message || "Local edits were reset to the original submission.", "success");
      await loadContributions();
    } catch (error) {
      state.actingKey = "";
      state.actingAction = "";
      renderList();
      showAlert(alertHost, error.message, "error");
    }
  }

  async function handleReview(reviewKey, action) {
    if (!reviewKey || !action) {
      return;
    }

    const item = state.items.find((entry) => entry.reviewKey === reviewKey);

    const confirmed = window.confirm(
      action === "accept"
        ? item?.matchesCurrent
          ? "Accept this contribution? The current correction will stay unchanged because it already matches."
          : "Accept this contribution and update the current correction?"
        : action === "revert"
          ? "Revert this accepted contribution and restore the previous correction?"
          : "Refuse this contribution and hide it from pending review?"
    );

    if (!confirmed) {
      return;
    }

    state.actingKey = reviewKey;
    state.actingAction = action;
    renderList();

    try {
      const result = await api("/contributions/lesen/review", {
        method: "POST",
        body: {
          reviewKey,
          action
        }
      });

      let message = action === "accept"
        ? result?.updatedAnswers > 0
          ? "Contribution accepted and current correction updated."
          : "Contribution accepted. The current correction was already up to date."
        : action === "revert"
          ? "Accepted contribution reverted to the previous correction."
          : "Contribution refused.";
      let alertType = "success";

      if ((action === "accept" || action === "reject") && result?.emailStatus === "sent" && result?.emailMessage) {
        message = `${message} ${result.emailMessage}`;
      } else if ((action === "accept" || action === "reject") && result?.emailStatus === "skipped" && result?.emailMessage) {
        message = `${message} ${result.emailMessage}`;
      } else if ((action === "accept" || action === "reject") && result?.emailStatus === "failed" && result?.emailMessage) {
        message = result.emailMessage;
        alertType = "error";
      }

      showAlert(
        alertHost,
        message,
        alertType
      );

      await loadContributions();
    } catch (error) {
      state.actingKey = "";
      state.actingAction = "";
      renderList();
      showAlert(alertHost, error.message, "error");
    }
  }

  refreshBtn.addEventListener("click", loadContributions);
  levelSelect.addEventListener("change", loadContributions);
  statusSelect.addEventListener("change", loadContributions);
  scopeSelect.addEventListener("change", loadContributions);
  searchInput.addEventListener("input", renderList);

  function syncEditInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
      return;
    }

    const reviewKey = String(target.dataset.reviewKey || "").trim();
    const itemNumber = String(target.dataset.editItemNumber || "").trim();
    if (!reviewKey || !itemNumber || state.editingKey !== reviewKey) {
      return;
    }

    state.editValues[itemNumber] = target.value;
  }

  contributionsHost.addEventListener("input", syncEditInput);
  contributionsHost.addEventListener("change", syncEditInput);

  contributionsHost.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button[data-action][data-review-key]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      return;
    }

    const reviewKey = button.dataset.reviewKey || "";
    const action = button.dataset.action || "";

    if (action === "edit") {
      startEditing(reviewKey);
      return;
    }
    if (action === "cancel-edit") {
      cancelEditing(reviewKey);
      return;
    }
    if (action === "save-edit") {
      handleEditSave(reviewKey);
      return;
    }
    if (action === "reset-edit") {
      handleEditReset(reviewKey);
      return;
    }

    handleReview(reviewKey, action);
  });

  updateSummary();
  loadContributions();
})();
