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
    latestRequestId: 0,
    renderedGroups: []
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
    const publicBaseUrl = String(window.ZDEUTSCH_PUBLIC_SITE_URL || "https://zdeutsch.github.io/zdeutsch").replace(/\/+$/, "");
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

  function getThemeGroupKey(item) {
    return [
      String(item?.levelKey || "").trim().toLowerCase(),
      String(item?.themeKey || "").trim().toLowerCase(),
      String(item?.themeTitle || "").trim().toLowerCase()
    ].join("::");
  }

  function getSuggestionGroupKey(item) {
    const rows = getComparisonRows(item)
      .map((difference) => [
        normalizeText(difference.itemNumber),
        normalizeText(difference.currentValue),
        normalizeText(difference.submittedValue)
      ].join("::"))
      .sort()
      .join("||");

    return [
      getThemeGroupKey(item),
      normalizeText(item?.partKey),
      normalizeText(item?.partLabel),
      normalizeText(item?.currentVersionKey),
      normalizeText(item?.contextIssue),
      item?.matchesCurrent ? "same" : "different",
      rows
    ].join("##");
  }

  function buildVisibleGroups(items) {
    const themeGroups = [];
    const themeGroupMap = new Map();

    items.forEach((item) => {
      const themeKey = getThemeGroupKey(item);
      let themeGroup = themeGroupMap.get(themeKey);

      if (!themeGroup) {
        themeGroup = {
          key: themeKey,
          levelKey: item.levelKey,
          themeKey: item.themeKey,
          themeTitle: item.themeTitle || item.themeKey || "Untitled theme",
          sampleItem: item,
          items: [],
          suggestionGroups: [],
          suggestionGroupMap: new Map()
        };
        themeGroupMap.set(themeKey, themeGroup);
        themeGroups.push(themeGroup);
      }

      themeGroup.items.push(item);

      const suggestionKey = getSuggestionGroupKey(item);
      let suggestionGroup = themeGroup.suggestionGroupMap.get(suggestionKey);

      if (!suggestionGroup) {
        suggestionGroup = {
          key: suggestionKey,
          sampleItem: item,
          items: []
        };
        themeGroup.suggestionGroupMap.set(suggestionKey, suggestionGroup);
        themeGroup.suggestionGroups.push(suggestionGroup);
      }

      suggestionGroup.items.push(item);
    });

    themeGroups.forEach((themeGroup) => {
      themeGroup.suggestionGroups.forEach((suggestionGroup) => {
        suggestionGroup.items.sort((left, right) => {
          const leftTime = Date.parse(left?.submittedAt || "") || 0;
          const rightTime = Date.parse(right?.submittedAt || "") || 0;
          return rightTime - leftTime;
        });
      });

      themeGroup.suggestionGroups.sort((left, right) => {
        const countDelta = right.items.length - left.items.length;
        if (countDelta !== 0) {
          return countDelta;
        }
        return String(left.sampleItem?.partLabel || left.sampleItem?.partKey || "")
          .localeCompare(String(right.sampleItem?.partLabel || right.sampleItem?.partKey || ""));
      });
    });

    themeGroups.sort((left, right) => {
      const suggestionDelta = right.suggestionGroups.length - left.suggestionGroups.length;
      if (suggestionDelta !== 0) {
        return suggestionDelta;
      }

      const itemDelta = right.items.length - left.items.length;
      if (itemDelta !== 0) {
        return itemDelta;
      }

      return String(left.themeTitle || "").localeCompare(String(right.themeTitle || ""));
    });

    return themeGroups;
  }

  function formatCountLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function getContributorSummary(items) {
    const contributorLabels = [];
    const seen = new Set();

    items.forEach((item) => {
      const label = String(item?.email || "").trim() || "Anonymous";
      const normalized = label.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        contributorLabels.push(label);
      }
    });

    if (!contributorLabels.length) {
      return "";
    }

    if (contributorLabels.length <= 3) {
      return contributorLabels.join(", ");
    }

    return `${contributorLabels.slice(0, 3).join(", ")} +${contributorLabels.length - 3} more`;
  }

  function getContributorLabels(items) {
    const contributorLabels = [];
    const seen = new Set();

    items.forEach((item) => {
      const label = String(item?.email || "").trim() || "مستخدم مجهول";
      const normalized = label.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        contributorLabels.push(label);
      }
    });

    return contributorLabels;
  }

  function buildMetaItems(item, status, reviewedLabel, submittedLabel) {
    const metaItems = [
      item.email ? `Email: ${escapeHtml(item.email)}` : "Anonymous submission",
      `Submitted: ${submittedLabel}`,
      `Version: ${escapeHtml(item.currentVersionLabel || item.currentVersionKey || "-")}`
    ];

    if ((status === "accepted" || status === "rejected") && reviewedLabel) {
      metaItems.push(`Reviewed: ${reviewedLabel}`);
    }

    return metaItems;
  }

  function getChangedRowsForShare(item) {
    if (Array.isArray(item?.differences) && item.differences.length) {
      return item.differences;
    }
    return getComparisonRows(item);
  }

  function getUniqueReasons(items) {
    const seen = new Set();
    return items
      .map((item) => {
        const reason = String(item?.reason || "").trim();
        if (!reason) {
          return null;
        }
        const email = String(item?.email || "").trim() || "مستخدم مجهول";
        const key = `${email.toLowerCase()}::${reason.toLowerCase()}`;
        if (seen.has(key)) {
          return null;
        }
        seen.add(key);
        return { email, reason };
      })
      .filter(Boolean);
  }

  function buildArabicThankYouLine(items) {
    const labels = getContributorLabels(items);
    if (!labels.length) {
      return "شكراً لكل من اقترح هذا التصحيح.";
    }
    if (labels.length === 1) {
      return `شكراً لـ ${labels[0]} على اقتراح هذا التصحيح.`;
    }
    if (labels.length === 2) {
      return `شكراً لـ ${labels[0]} و ${labels[1]} على اقتراح هذا التصحيح.`;
    }
    return `شكراً لـ ${labels.slice(0, 2).join(" و ")} و ${labels.length - 2} مساهمين آخرين على اقتراح هذا التصحيح.`;
  }

  function buildVoteDraft(group) {
    const sampleItem = group?.sampleItem;
    if (!sampleItem) {
      return null;
    }

    const changedRows = getChangedRowsForShare(sampleItem);
    const reasons = getUniqueReasons(group.items);
    const publicThemeUrl = buildPublicThemeUrl(sampleItem);

    return {
      thankYouLine: buildArabicThankYouLine(group.items),
      title: "تصويت على اقتراح تصحيح",
      question: "هل نعتمد هذا التصحيح الجديد بدل التصحيح الحالي؟",
      acceptLabel: "✅ نعم، نعتمد التصحيح",
      rejectLabel: "❌ لا، نبقي التصحيح الحالي",
      metaLines: [
        `المستوى: ${String(sampleItem.levelKey || "").toUpperCase() || "-"}`,
        `الثيمة: ${sampleItem.themeTitle || sampleItem.themeKey || "-"}`,
        `القسم: ${sampleItem.partLabel || sampleItem.partKey || "-"}`,
        `عدد المساهمات المتطابقة: ${group.items.length}`
      ],
      currentLines: changedRows.map((row) => `السؤال ${row.itemNumber}: ${String(row.currentValue || "-").toUpperCase()}`),
      suggestedLines: changedRows.map((row) => `السؤال ${row.itemNumber}: ${String(row.submittedValue || "-").toUpperCase()}`),
      reasons,
      linkLine: publicThemeUrl ? `رابط الثيمة: ${publicThemeUrl}` : "",
      contextLine: sampleItem.contextIssue ? `ملاحظة: ${sampleItem.contextIssue}` : ""
    };
  }

  function buildTelegramVoteMessage(group) {
    const voteDraft = buildVoteDraft(group);
    if (!voteDraft) {
      return "";
    }

    const lines = [
      voteDraft.title,
      "",
      voteDraft.thankYouLine,
      "",
      ...voteDraft.metaLines,
      ""
    ];

    lines.push("التصحيح الحالي:");
    voteDraft.currentLines.forEach((line) => lines.push(`- ${line}`));

    lines.push("", "التصحيح المقترح:");
    voteDraft.suggestedLines.forEach((line) => lines.push(`- ${line}`));

    if (voteDraft.reasons.length) {
      lines.push("", "سبب أو ملاحظات الاقتراح:");
      voteDraft.reasons.slice(0, 3).forEach((entry) => {
        lines.push(`- ${entry.email}: ${entry.reason}`);
      });
      if (voteDraft.reasons.length > 3) {
        lines.push(`- وهناك ${voteDraft.reasons.length - 3} ملاحظات إضافية`);
      }
    }

    if (voteDraft.contextLine) {
      lines.push("", voteDraft.contextLine);
    }

    lines.push(
      "",
      voteDraft.question,
      voteDraft.acceptLabel,
      voteDraft.rejectLabel
    );

    if (voteDraft.linkLine) {
      lines.push("", voteDraft.linkLine);
    }

    return lines.join("\n");
  }

  function renderVotePanel(group) {
    const voteDraft = buildVoteDraft(group);
    if (!voteDraft) {
      return "";
    }

    const reasonsMarkup = voteDraft.reasons.length
      ? `
        <div class="contribution-vote-section">
          <div class="contribution-vote-label">Reason</div>
          <div class="contribution-vote-list">
            ${voteDraft.reasons.slice(0, 3).map((entry) => `
              <div class="contribution-vote-item">
                <strong>${escapeHtml(entry.email)}:</strong> ${escapeHtml(entry.reason)}
              </div>
            `).join("")}
            ${voteDraft.reasons.length > 3 ? `<div class="small-help">+${voteDraft.reasons.length - 3} more notes</div>` : ""}
          </div>
        </div>
      `
      : "";

    return `
      <section class="contribution-vote-panel">
        <div class="contribution-vote-panel-header d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div class="contribution-vote-title">Telegram Vote Draft</div>
            <div class="small-help">${escapeHtml(voteDraft.thankYouLine)}</div>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-primary btn-sm" type="button" data-action="share-telegram" data-group-key="${escapeHtml(group.key)}">
              <i class="bi bi-telegram"></i> Open Telegram vote
            </button>
          </div>
        </div>
        <div class="contribution-vote-question">${escapeHtml(voteDraft.question)}</div>
        <div class="contribution-vote-meta">
          ${voteDraft.metaLines.map((line) => `<span class="contribution-vote-chip">${escapeHtml(line)}</span>`).join("")}
        </div>
        <div class="contribution-vote-grid">
          <div class="contribution-vote-section">
            <div class="contribution-vote-label">Current</div>
            <div class="contribution-vote-list">
              ${voteDraft.currentLines.map((line) => `<div class="contribution-vote-item">${escapeHtml(line)}</div>`).join("")}
            </div>
          </div>
          <div class="contribution-vote-section contribution-vote-section--suggested">
            <div class="contribution-vote-label">Suggested</div>
            <div class="contribution-vote-list">
              ${voteDraft.suggestedLines.map((line) => `<div class="contribution-vote-item">${escapeHtml(line)}</div>`).join("")}
            </div>
          </div>
        </div>
        ${reasonsMarkup}
        ${voteDraft.contextLine ? `<div class="contribution-vote-context">${escapeHtml(voteDraft.contextLine)}</div>` : ""}
        ${voteDraft.linkLine ? `<div class="small-help">${escapeHtml(voteDraft.linkLine)}</div>` : ""}
        <div class="contribution-vote-options">
          <span class="contribution-vote-option contribution-vote-option--yes">${escapeHtml(voteDraft.acceptLabel)}</span>
          <span class="contribution-vote-option contribution-vote-option--no">${escapeHtml(voteDraft.rejectLabel)}</span>
        </div>
      </section>
    `;
  }

  function getRenderedSuggestionGroup(groupKey) {
    for (const themeGroup of state.renderedGroups) {
      const found = themeGroup.suggestionGroups.find((group) => group.key === groupKey);
      if (found) {
        return found;
      }
    }
    return null;
  }

  async function shareSuggestionToTelegram(groupKey) {
    const group = getRenderedSuggestionGroup(groupKey);
    if (!group) {
      showAlert(alertHost, "The suggestion group could not be found.", "error");
      return;
    }

    const message = buildTelegramVoteMessage(group);
    if (!message) {
      showAlert(alertHost, "Could not generate the Telegram message.", "error");
      return;
    }

    const publicThemeUrl = buildPublicThemeUrl(group.sampleItem);
    const shareUrl = publicThemeUrl
      ? `https://t.me/share/url?url=${encodeURIComponent(publicThemeUrl)}&text=${encodeURIComponent(message)}`
      : `https://t.me/share/url?text=${encodeURIComponent(message)}`;

    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(message);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer");
    showAlert(
      alertHost,
      copied
        ? "Telegram vote created and copied to the clipboard."
        : "Telegram vote created. If the clipboard was blocked, use the Telegram draft that opened.",
      "success"
    );
  }

  function getRowsToDisplay(item) {
    const comparisonRows = getComparisonRows(item);
    if (state.editingKey === item.reviewKey) {
      return comparisonRows;
    }
    if (scopeSelect.value === "all" || item.matchesCurrent) {
      return comparisonRows;
    }
    return Array.isArray(item.differences) ? item.differences : comparisonRows;
  }

  function renderComparisonTable(item, options = {}) {
    const { editable = false, tableClassName = "" } = options;
    const status = String(item.reviewStatus || "pending").trim().toLowerCase() || "pending";
    const leftColumnLabel = status === "accepted" ? "Previous correction" : "Current correction";
    const rightColumnLabel = status === "accepted" ? "Accepted contribution" : "Suggested answer";
    const rowsToDisplay = getRowsToDisplay(item);

    const diffRows = rowsToDisplay.map((difference) => {
      const submittedCell = editable
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
      <div class="table-responsive">
        <table class="table table-sm align-middle contribution-diff-table mb-0 ${tableClassName}">
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
    `;
  }

  function renderActionButtons(item) {
    const status = String(item.reviewStatus || "pending").trim().toLowerCase() || "pending";
    const isPending = status === "pending";
    const isAccepted = status === "accepted";
    const canAccept = item.canAccept !== false;
    const isBusy = state.actingKey === item.reviewKey;
    const isEditing = state.editingKey === item.reviewKey;

    if (isPending) {
      return `
        ${isEditing ? `
          <button class="btn btn-primary btn-sm" type="button" data-action="save-edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
            ${escapeHtml(getActionLabel(item, "save-edit"))}
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-action="cancel-edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
            ${escapeHtml(getActionLabel(item, "cancel-edit"))}
          </button>
        ` : `
          <button class="btn btn-outline-primary btn-sm" type="button" data-action="edit" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
            ${escapeHtml(getActionLabel(item, "edit"))}
          </button>
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
          <button class="btn btn-outline-danger btn-sm" type="button" data-action="reject" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
            ${escapeHtml(getActionLabel(item, "reject"))}
          </button>
        `}
      `;
    }

    if (isAccepted) {
      return `
        <button class="btn btn-outline-warning btn-sm" type="button" data-action="revert" data-review-key="${escapeHtml(item.reviewKey)}" ${isBusy ? "disabled" : ""}>
          ${escapeHtml(getActionLabel(item, "revert"))}
        </button>
      `;
    }

    return `<button class="btn btn-outline-secondary btn-sm" type="button" disabled>${escapeHtml(formatStatusLabel(status))}</button>`;
  }

  function renderSubmissionFlags(item) {
    const flags = [];

    flags.push(`
      <span class="contribution-status contribution-status--${escapeHtml(String(item.reviewStatus || "pending").trim().toLowerCase() || "pending")}">
        ${escapeHtml(formatStatusLabel(item.reviewStatus))}
      </span>
    `);

    if (item.matchesCurrent) {
      flags.push('<span class="badge text-bg-light border">Already matches current</span>');
    }
    if (item.hasLocalEdits) {
      flags.push('<span class="badge text-bg-light border">Edited locally</span>');
    }
    if (item.contextIssue) {
      flags.push('<span class="badge text-bg-light border">Context issue</span>');
    }

    return flags.join("");
  }

  function renderSubmissionDetails(item) {
    const status = String(item.reviewStatus || "pending").trim().toLowerCase() || "pending";
    const submittedLabel = item.submittedAt ? escapeHtml(dateTime(item.submittedAt)) : "-";
    const reviewedLabel = item.reviewedAt ? escapeHtml(dateTime(item.reviewedAt)) : "";
    const metaItems = buildMetaItems(item, status, reviewedLabel, submittedLabel)
      .filter((entry) => entry !== "Anonymous submission" && !entry.startsWith("Email: "));
    const isEditing = state.editingKey === item.reviewKey;

    return `
      <article class="contribution-submission-row">
        <div class="contribution-submission-head d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div class="contribution-submission-main">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              ${renderSubmissionFlags(item)}
            </div>
            <div class="contribution-submission-author">${escapeHtml(item.email || "Anonymous submission")}</div>
            <div class="small-help">${metaItems.join(" | ")}</div>
          </div>
          <div class="d-flex flex-wrap justify-content-end gap-2">
            ${renderActionButtons(item)}
          </div>
        </div>
        ${item.reason ? `<div class="contribution-note mt-3"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>` : ""}
        ${item.contextIssue ? `<div class="contribution-note mt-3"><strong>Context:</strong> ${escapeHtml(item.contextIssue)}</div>` : ""}
        ${isEditing ? `
          <div class="contribution-edit-panel mt-3">
            <div class="contribution-edit-hint mb-3">Edit this submission before you accept or refuse it.</div>
            ${renderComparisonTable(item, { editable: true })}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderContributionCard(item, options = {}) {
    const { showThemeTitle = true } = options;
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
    const metaItems = buildMetaItems(item, status, reviewedLabel, submittedLabel);
    const leftColumnLabel = isAccepted ? "Previous correction" : "Current correction";
    const rightColumnLabel = isAccepted ? "Accepted contribution" : "Contribution";
    const cardTitle = showThemeTitle
      ? (item.themeTitle || item.themeKey || "Untitled theme")
      : (item.partLabel || item.partKey || "Contribution");
    const headerSubtitleParts = [];

    if (!showThemeTitle && item.partKey && item.partKey !== item.partLabel) {
      headerSubtitleParts.push(`<span>${escapeHtml(item.partKey)}</span>`);
    }
    if (showThemeTitle && item.partLabel) {
      headerSubtitleParts.push(`<span>${escapeHtml(item.partLabel)}</span>`);
    }
    if (publicThemeUrl) {
      headerSubtitleParts.push(`<a href="${escapeHtml(publicThemeUrl)}" class="link-primary text-decoration-none" target="_blank" rel="noopener noreferrer">Open theme</a>`);
    }

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
      <section class="manager-card contribution-card${showThemeTitle ? "" : " contribution-card--nested"}">
        <div class="contribution-card-header d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span class="badge badge-soft">${escapeHtml(levelLabel)}</span>
              <span class="badge text-bg-light border">${escapeHtml(item.partLabel || item.partKey || "-")}</span>
              <span class="contribution-status contribution-status--${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
              ${item.matchesCurrent ? '<span class="badge text-bg-light border">Same as current</span>' : ""}
              ${item.hasLocalEdits ? '<span class="badge text-bg-light border">Edited locally</span>' : ""}
            </div>
            <h2 class="h6 mb-1">${escapeHtml(cardTitle)}</h2>
            <div class="small-help d-flex flex-wrap align-items-center gap-2">
              ${showThemeTitle ? `<span>${escapeHtml(item.themeKey || "-")}</span>` : ""}
              ${headerSubtitleParts.join("")}
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
  }

  function renderSuggestionGroup(group) {
    const sampleItem = group.sampleItem;
    const matchingCount = group.items.length;
    const contributorSummary = getContributorSummary(group.items);
    const groupStatus = matchingCount > 1
      ? `${matchingCount} users suggested the same answers`
      : "1 user suggested this";
    const differenceCount = Number(sampleItem.differenceCount || getComparisonRows(sampleItem).length || 0);

    return `
      <section class="contribution-cluster">
        <div class="contribution-cluster-header d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span class="badge text-bg-light border">${escapeHtml(sampleItem.partLabel || sampleItem.partKey || "-")}</span>
              <span class="badge badge-soft">${escapeHtml(groupStatus)}</span>
              ${sampleItem.matchesCurrent ? '<span class="badge text-bg-light border">Same as current</span>' : ""}
            </div>
            <div class="fw-semibold">Suggested answers for ${escapeHtml(sampleItem.partLabel || sampleItem.partKey || "this part")}</div>
            <div class="small-help">${contributorSummary ? `Sent by ${escapeHtml(contributorSummary)}` : "Contributors unavailable"}</div>
          </div>
          <div class="text-start text-lg-end">
            <div class="small-help">Changed items</div>
            <div class="fw-semibold">${escapeHtml(String(differenceCount))}</div>
          </div>
        </div>
        <div class="contribution-cluster-body">
          ${renderVotePanel(group)}
          <div class="contribution-shared-box">
            <div class="contribution-shared-box-title">Compare once, then review the submitters below</div>
            ${renderComparisonTable(sampleItem)}
          </div>
          <div class="contribution-submission-list">
            ${group.items.map((item) => renderSubmissionDetails(item)).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderThemeGroup(group) {
    const sampleItem = group.sampleItem;
    const publicThemeUrl = buildPublicThemeUrl(sampleItem);

    return `
      <section class="manager-card contribution-theme-group">
        <div class="contribution-theme-header d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span class="badge badge-soft">${escapeHtml(String(group.levelKey || "unknown").toUpperCase())}</span>
              <span class="badge text-bg-light border">${escapeHtml(formatCountLabel(group.items.length, "submission", "submissions"))}</span>
              <span class="badge text-bg-light border">${escapeHtml(formatCountLabel(group.suggestionGroups.length, "unique suggestion", "unique suggestions"))}</span>
            </div>
            <h2 class="h5 mb-1">Theme: ${escapeHtml(group.themeTitle)}</h2>
            <div class="small-help d-flex flex-wrap align-items-center gap-2">
              <span>${escapeHtml(group.themeKey || "-")}</span>
              ${publicThemeUrl ? `<a href="${escapeHtml(publicThemeUrl)}" class="link-primary text-decoration-none" target="_blank" rel="noopener noreferrer">Open theme</a>` : ""}
            </div>
          </div>
          <div class="text-start text-lg-end">
            <div class="small-help">Review order</div>
            <div class="fw-semibold">Repeated suggestions first</div>
          </div>
        </div>
        <div class="contribution-theme-body d-grid gap-3">
          ${group.suggestionGroups.map((suggestionGroup) => renderSuggestionGroup(suggestionGroup)).join("")}
        </div>
      </section>
    `;
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
      state.renderedGroups = [];
      renderLoading();
      return;
    }

    const items = getVisibleItems();
    if (!items.length) {
      state.renderedGroups = [];
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

    state.renderedGroups = buildVisibleGroups(items);
    contributionsHost.innerHTML = state.renderedGroups
      .map((group) => renderThemeGroup(group))
      .join("");
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

    const shareButton = target.closest("button[data-action='share-telegram'][data-group-key]");
    if (shareButton instanceof HTMLButtonElement && !shareButton.disabled) {
      shareSuggestionToTelegram(shareButton.dataset.groupKey || "");
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
