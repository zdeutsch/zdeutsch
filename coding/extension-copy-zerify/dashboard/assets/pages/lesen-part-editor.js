(function initLesenPartEditor() {
  const { api, setActiveNav, showAlert, escapeHtml } = window.ManagerApi;
  setActiveNav("lesen");

  const body = document.body;
  const partKey = String(body.dataset.partKey || "").trim();
  const partLabel = String(body.dataset.partLabel || partKey).trim();
  const urlParams = new URLSearchParams(window.location.search);
  let pendingThemeFromQuery = String(urlParams.get("themeKey") || "").trim();
  let pendingVersionFromQuery = String(urlParams.get("versionKey") || "").trim();

  const alertHost = document.getElementById("alert-host");
  const levelSelect = document.getElementById("level-select");
  const themeSelect = document.getElementById("theme-select");
  const versionSelect = document.getElementById("version-select");
  const reloadBtn = document.getElementById("reload-btn");
  const saveBtn = document.getElementById("save-btn");

  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");

  const metaTitleInput = document.getElementById("meta-title");
  const metaLevelInput = document.getElementById("meta-level");
  const metaPartLabelInput = document.getElementById("meta-part-label");
  const metaSectionInput = document.getElementById("meta-section");
  const metaPartNumberInput = document.getElementById("meta-part-number");
  const metaSourceUrlInput = document.getElementById("meta-source-url");
  const metaExtractedAtInput = document.getElementById("meta-extracted-at");

  const analysisHost = document.getElementById("analysis-host");
  const contentHost = document.getElementById("part-content-host");

  const state = {
    themes: [],
    versions: [],
    currentPart: null,
    collectContent: () => ({})
  };

  const validParts = [
    "teil-1",
    "teil-2",
    "teil-3",
    "sprachbausteine-1",
    "sprachbausteine-2"
  ];

  if (!validParts.includes(partKey)) {
    showAlert(alertHost, `Unsupported part key: ${partKey}`, "error");
    return;
  }

  if (pageTitle) {
    pageTitle.textContent = `${partLabel} Editor`;
  }
  if (pageSubtitle) {
    pageSubtitle.textContent = `Manage ${partLabel} with manager-friendly forms.`;
  }

  document.querySelectorAll("[data-part-link]").forEach((link) => {
    const isActive = link.getAttribute("data-part-link") === partKey;
    link.classList.toggle("active", isActive);
  });

  const levelFromQuery = String(urlParams.get("level") || "").trim().toLowerCase();
  if (levelFromQuery && Array.from(levelSelect.options).some((opt) => opt.value === levelFromQuery)) {
    levelSelect.value = levelFromQuery;
  }

  function toId(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }
    if (/^-?\d+$/.test(raw)) {
      return Number(raw);
    }
    return raw;
  }

  function toLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function toCommaList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function setSelectOptions(selectEl, options, valueKey = "key", labelKey = "label") {
    if (!selectEl) {
      return;
    }

    selectEl.innerHTML = options
      .map((entry) => {
        const value = entry?.[valueKey] ?? "";
        const label = entry?.[labelKey] ?? value;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function createTextField({ label, placeholder = "", value = "", type = "text" }) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-3";

    const labelEl = document.createElement("label");
    labelEl.className = "form-label";
    labelEl.textContent = label;

    const input = document.createElement("input");
    input.type = type;
    input.className = "form-control";
    input.placeholder = placeholder;
    input.value = value;

    wrapper.append(labelEl, input);
    return { wrapper, input };
  }

  function createTextAreaField({ label, placeholder = "", value = "", rows = 4, help = "" }) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-3";

    const labelEl = document.createElement("label");
    labelEl.className = "form-label";
    labelEl.textContent = label;

    const textarea = document.createElement("textarea");
    textarea.className = "form-control";
    textarea.rows = rows;
    textarea.placeholder = placeholder;
    textarea.value = value;

    wrapper.append(labelEl, textarea);

    if (help) {
      const helpEl = document.createElement("div");
      helpEl.className = "small-help mt-1";
      helpEl.textContent = help;
      wrapper.append(helpEl);
    }

    return { wrapper, textarea };
  }

  function createRowEditor({ title, description = "", columns, addLabel = "Add row" }) {
    const section = document.createElement("section");
    section.className = "manager-card card mb-4";

    const header = document.createElement("div");
    header.className = "card-header d-flex flex-wrap align-items-center justify-content-between gap-2";

    const titleWrap = document.createElement("div");
    const titleEl = document.createElement("div");
    titleEl.className = "fw-semibold";
    titleEl.textContent = title;
    titleWrap.append(titleEl);

    if (description) {
      const descEl = document.createElement("div");
      descEl.className = "small-help";
      descEl.textContent = description;
      titleWrap.append(descEl);
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline-primary";
    addBtn.textContent = addLabel;

    header.append(titleWrap, addBtn);

    const bodyEl = document.createElement("div");
    bodyEl.className = "card-body p-0";

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-responsive";

    const table = document.createElement("table");
    table.className = "table table-sm align-middle mb-0";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column.label;
      headRow.append(th);
    });
    const actionTh = document.createElement("th");
    actionTh.className = "text-end";
    actionTh.textContent = "Action";
    headRow.append(actionTh);
    thead.append(headRow);

    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.append(table);
    bodyEl.append(tableWrap);
    section.append(header, bodyEl);

    function createInput(column, rowData = {}) {
      if (column.type === "select") {
        const select = document.createElement("select");
        select.className = "form-select form-select-sm";
        (column.options || []).forEach((option) => {
          const opt = document.createElement("option");
          if (typeof option === "object") {
            opt.value = String(option.value);
            opt.textContent = String(option.label);
          } else {
            opt.value = String(option);
            opt.textContent = String(option);
          }
          select.append(opt);
        });
        const value = rowData[column.key] ?? column.defaultValue ?? "";
        select.value = String(value);
        return select;
      }

      if (column.type === "textarea") {
        const textarea = document.createElement("textarea");
        textarea.className = "form-control form-control-sm";
        textarea.rows = Number(column.rows || 3);
        textarea.placeholder = column.placeholder || "";
        textarea.value = rowData[column.key] ?? "";
        return textarea;
      }

      const input = document.createElement("input");
      input.type = column.type || "text";
      input.className = "form-control form-control-sm";
      input.placeholder = column.placeholder || "";
      input.value = rowData[column.key] ?? "";
      return input;
    }

    function appendRow(rowData = {}) {
      const tr = document.createElement("tr");

      columns.forEach((column) => {
        const td = document.createElement("td");
        const input = createInput(column, rowData);
        input.setAttribute("data-col-key", column.key);
        td.append(input);
        tr.append(td);
      });

      const actionTd = document.createElement("td");
      actionTd.className = "text-end";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-sm btn-outline-danger";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => tr.remove());
      actionTd.append(removeBtn);
      tr.append(actionTd);

      tbody.append(tr);
    }

    addBtn.addEventListener("click", () => appendRow({}));

    function setRows(rows) {
      tbody.innerHTML = "";
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) {
        appendRow({});
        return;
      }
      items.forEach((row) => appendRow(row));
    }

    function getRows() {
      return Array.from(tbody.querySelectorAll("tr")).map((tr) => {
        const row = {};
        columns.forEach((column) => {
          const field = tr.querySelector(`[data-col-key="${column.key}"]`);
          row[column.key] = field ? String(field.value || "").trim() : "";
        });
        return row;
      });
    }

    return {
      section,
      setRows,
      getRows
    };
  }

  function renderAnalysis(content) {
    if (!analysisHost) {
      return;
    }

    const counters = [];
    if (Array.isArray(content.texts)) counters.push(`Texts: ${content.texts.length}`);
    if (Array.isArray(content.headlines)) counters.push(`Headlines: ${content.headlines.length}`);
    if (Array.isArray(content.questions)) counters.push(`Questions: ${content.questions.length}`);
    if (Array.isArray(content.situations)) counters.push(`Situations: ${content.situations.length}`);
    if (Array.isArray(content.ads)) counters.push(`Ads: ${content.ads.length}`);
    if (Array.isArray(content.segments)) counters.push(`Segments: ${content.segments.length}`);
    if (Array.isArray(content.blanks)) counters.push(`Blanks: ${content.blanks.length}`);
    if (Array.isArray(content.answers)) counters.push(`Answers: ${content.answers.length}`);
    if (Array.isArray(content.options)) counters.push(`Options: ${content.options.length}`);
    if (Array.isArray(content.wordBank)) counters.push(`Word Bank: ${content.wordBank.length}`);

    analysisHost.innerHTML = `
      <div class="manager-card card mb-4">
        <div class="card-header">Part Analysis</div>
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2">
            ${counters.map((item) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(item)}</span>`).join("") || "<span class='text-secondary'>No counters available.</span>"}
          </div>
        </div>
      </div>
    `;
  }

  function renderPartForm(part) {
    state.currentPart = part;
    const meta = part?.meta || {};
    const content = part?.content || {};

    metaTitleInput.value = meta.title || "";
    metaLevelInput.value = meta.level || "";
    metaPartLabelInput.value = meta.partLabel || "";
    metaSectionInput.value = meta.section || "";
    metaPartNumberInput.value = Number(meta.partNumber || 0);
    metaSourceUrlInput.value = meta.sourceUrl || "";
    metaExtractedAtInput.value = meta.extractedAt || "";

    contentHost.innerHTML = "";

    if (partKey === "teil-1") {
      const instructionField = createTextAreaField({
        label: "Instruction",
        value: content.instruction || "",
        rows: 3
      });
      contentHost.append(instructionField.wrapper);

      const textsEditor = createRowEditor({
        title: "Texts",
        description: "Each row is one reading text.",
        columns: [
          { key: "id", label: "ID", type: "text" },
          { key: "text", label: "Text", type: "textarea", rows: 4 },
          { key: "translated", label: "Arabic Translation", type: "textarea", rows: 4 }
        ],
        addLabel: "Add text"
      });
      textsEditor.setRows(content.texts || []);
      contentHost.append(textsEditor.section);

      const headlinesEditor = createRowEditor({
        title: "Headlines",
        description: "Each row is one headline option.",
        columns: [
          { key: "id", label: "ID", type: "text" },
          { key: "text", label: "Headline", type: "text" },
          { key: "translated", label: "Arabic Translation", type: "text" }
        ],
        addLabel: "Add headline"
      });
      headlinesEditor.setRows(content.headlines || []);
      contentHost.append(headlinesEditor.section);

      const answersEditor = createRowEditor({
        title: "Answers",
        description: "Map each text ID to the correct headline ID.",
        columns: [
          { key: "textId", label: "Text ID", type: "text" },
          { key: "headlineId", label: "Headline ID", type: "text" }
        ],
        addLabel: "Add answer"
      });
      answersEditor.setRows(content.answers || []);
      contentHost.append(answersEditor.section);

      state.collectContent = () => ({
        instruction: String(instructionField.textarea.value || "").trim(),
        texts: textsEditor
          .getRows()
          .filter((row) => row.id && row.text)
          .map((row) => ({ id: toId(row.id), text: row.text, translated: row.translated || "" })),
        headlines: headlinesEditor
          .getRows()
          .filter((row) => row.id && row.text)
          .map((row) => ({ id: toId(row.id), text: row.text, translated: row.translated || "" })),
        answers: answersEditor
          .getRows()
          .filter((row) => row.textId && row.headlineId)
          .map((row) => ({ textId: toId(row.textId), headlineId: toId(row.headlineId) }))
      });
    } else if (partKey === "teil-2") {
      const instructionField = createTextAreaField({
        label: "Instruction",
        value: content.instruction || "",
        rows: 3
      });
      contentHost.append(instructionField.wrapper);

      const passageTitleField = createTextField({
        label: "Passage Title",
        value: content.passage?.title || ""
      });
      contentHost.append(passageTitleField.wrapper);

      const passageParagraphsField = createTextAreaField({
        label: "Passage Paragraphs",
        value: Array.isArray(content.passage?.paragraphs) ? content.passage.paragraphs.join("\n") : "",
        rows: 8,
        help: "One paragraph per line."
      });
      contentHost.append(passageParagraphsField.wrapper);

      const passageTranslatedField = createTextAreaField({
        label: "Passage Arabic Translation Paragraphs",
        value: Array.isArray(content.passage?.translated) ? content.passage.translated.join("\n") : "",
        rows: 8,
        help: "One translation paragraph per line, same order as passage paragraphs."
      });
      contentHost.append(passageTranslatedField.wrapper);

      const questionsEditor = createRowEditor({
        title: "Questions",
        description: "Use answer ID as a, b, or c.",
        columns: [
          { key: "id", label: "Question ID", type: "text" },
          { key: "prompt", label: "Prompt", type: "text" },
          { key: "optionA", label: "Option A", type: "text" },
          { key: "optionB", label: "Option B", type: "text" },
          { key: "optionC", label: "Option C", type: "text" },
          { key: "answerId", label: "Answer ID", type: "select", options: ["a", "b", "c"] }
        ],
        addLabel: "Add question"
      });

      const questionRows = (content.questions || []).map((question) => {
        const optionsById = {};
        (question.options || []).forEach((option) => {
          optionsById[String(option.id || "").toLowerCase()] = option.text || "";
        });
        return {
          id: question.id,
          prompt: question.prompt || "",
          optionA: optionsById.a || "",
          optionB: optionsById.b || "",
          optionC: optionsById.c || "",
          answerId: String(question.answerId || "a").toLowerCase()
        };
      });

      questionsEditor.setRows(questionRows);
      contentHost.append(questionsEditor.section);

      state.collectContent = () => {
        const questions = questionsEditor
          .getRows()
          .filter((row) => row.id && row.prompt)
          .map((row) => {
            const options = [
              { id: "a", text: row.optionA },
              { id: "b", text: row.optionB },
              { id: "c", text: row.optionC }
            ].filter((option) => String(option.text || "").trim());

            const normalizedAnswerId = ["a", "b", "c"].includes(String(row.answerId || "").toLowerCase())
              ? String(row.answerId).toLowerCase()
              : (options[0]?.id || "a");

            const answerText = options.find((option) => option.id === normalizedAnswerId)?.text || "";

            return {
              id: toId(row.id),
              prompt: row.prompt,
              options,
              answerId: normalizedAnswerId,
              answerText
            };
          });

        return {
          instruction: String(instructionField.textarea.value || "").trim(),
          passage: {
            title: String(passageTitleField.input.value || "").trim(),
            paragraphs: toLines(passageParagraphsField.textarea.value),
            translated: toLines(passageTranslatedField.textarea.value)
          },
          questions
        };
      };
    } else if (partKey === "teil-3") {
      const situationsEditor = createRowEditor({
        title: "Situations",
        columns: [
          { key: "id", label: "Situation ID", type: "text" },
          { key: "text", label: "Situation Text", type: "textarea", rows: 3 },
          { key: "translated", label: "Arabic Translation", type: "textarea", rows: 3 }
        ],
        addLabel: "Add situation"
      });
      situationsEditor.setRows(content.situations || []);
      contentHost.append(situationsEditor.section);

      const adsEditor = createRowEditor({
        title: "Ads",
        columns: [
          { key: "id", label: "Ad ID", type: "text" },
          { key: "text", label: "Ad Text", type: "textarea", rows: 6 },
          { key: "translated", label: "Arabic Translation", type: "textarea", rows: 6 }
        ],
        addLabel: "Add ad"
      });
      adsEditor.setRows(content.ads || []);
      contentHost.append(adsEditor.section);

      const answersEditor = createRowEditor({
        title: "Answers",
        description: "Map each situation to the correct ad.",
        columns: [
          { key: "situationId", label: "Situation ID", type: "text" },
          { key: "adId", label: "Ad ID", type: "text" }
        ],
        addLabel: "Add answer"
      });
      answersEditor.setRows(content.answers || []);
      contentHost.append(answersEditor.section);

      state.collectContent = () => ({
        situations: situationsEditor
          .getRows()
          .filter((row) => row.id && row.text)
          .map((row) => ({ id: toId(row.id), text: row.text, translated: row.translated || "" })),
        ads: adsEditor
          .getRows()
          .filter((row) => row.id && row.text)
          .map((row) => ({ id: toId(row.id), text: row.text, translated: row.translated || "" })),
        answers: answersEditor
          .getRows()
          .filter((row) => row.situationId && row.adId)
          .map((row) => ({ situationId: toId(row.situationId), adId: toId(row.adId) }))
      });
    } else if (partKey === "sprachbausteine-1") {
      const titleField = createTextField({
        label: "Content Title",
        value: content.title || ""
      });
      const instructionField = createTextAreaField({
        label: "Instruction",
        value: content.instruction || "",
        rows: 3
      });
      const textField = createTextAreaField({
        label: "Text",
        value: content.text || "",
        rows: 8,
        help: "Use placeholders like [[21]], [[22]] inside the text."
      });
      const translatedField = createTextAreaField({
        label: "Text Arabic Translation",
        value: content.translated || "",
        rows: 8
      });
      contentHost.append(titleField.wrapper, instructionField.wrapper, textField.wrapper, translatedField.wrapper);

      const blanksEditor = createRowEditor({
        title: "Blanks",
        description: "Options are comma separated.",
        columns: [
          { key: "id", label: "Blank ID", type: "text" },
          { key: "options", label: "Options (comma separated)", type: "text" }
        ],
        addLabel: "Add blank"
      });
      blanksEditor.setRows((content.blanks || []).map((blank) => ({
        id: blank.id,
        options: Array.isArray(blank.options) ? blank.options.join(", ") : ""
      })));
      contentHost.append(blanksEditor.section);

      const answersEditor = createRowEditor({
        title: "Answers",
        columns: [
          { key: "id", label: "Blank ID", type: "text" },
          { key: "answer", label: "Correct Answer", type: "text" }
        ],
        addLabel: "Add answer"
      });
      answersEditor.setRows(content.answers || []);
      contentHost.append(answersEditor.section);

      state.collectContent = () => ({
        title: String(titleField.input.value || "").trim(),
        instruction: String(instructionField.textarea.value || "").trim(),
        text: String(textField.textarea.value || "").trim(),
        translated: String(translatedField.textarea.value || "").trim(),
        blanks: blanksEditor
          .getRows()
          .filter((row) => row.id)
          .map((row) => ({ id: toId(row.id), options: toCommaList(row.options) })),
        answers: answersEditor
          .getRows()
          .filter((row) => row.id && row.answer)
          .map((row) => ({ id: toId(row.id), answer: row.answer }))
      });
    } else if (partKey === "sprachbausteine-2") {
      const titleField = createTextField({
        label: "Content Title",
        value: content.title || ""
      });
      const instructionField = createTextAreaField({
        label: "Instruction",
        value: content.instruction || "",
        rows: 3
      });
      const textField = createTextAreaField({
        label: "Text",
        value: content.text || "",
        rows: 8,
        help: "Use placeholders like [[31]], [[32]] inside the text."
      });
      const translatedField = createTextAreaField({
        label: "Text Arabic Translation",
        value: content.translated || "",
        rows: 8
      });
      contentHost.append(titleField.wrapper, instructionField.wrapper, textField.wrapper, translatedField.wrapper);

      const optionsField = createTextAreaField({
        label: "Options",
        value: Array.isArray(content.options) ? content.options.join("\n") : "",
        rows: 4,
        help: "One option per line."
      });
      contentHost.append(optionsField.wrapper);

      const answersEditor = createRowEditor({
        title: "Answers",
        columns: [
          { key: "id", label: "Blank ID", type: "text" },
          { key: "answer", label: "Correct Answer", type: "text" }
        ],
        addLabel: "Add answer"
      });
      answersEditor.setRows(content.answers || []);
      contentHost.append(answersEditor.section);

      state.collectContent = () => ({
        title: String(titleField.input.value || "").trim(),
        instruction: String(instructionField.textarea.value || "").trim(),
        text: String(textField.textarea.value || "").trim(),
        translated: String(translatedField.textarea.value || "").trim(),
        options: toLines(optionsField.textarea.value),
        answers: answersEditor
          .getRows()
          .filter((row) => row.id && row.answer)
          .map((row) => ({ id: toId(row.id), answer: row.answer }))
      });
    }

    renderAnalysis(content);
  }

  function buildMetaPayload() {
    const base = state.currentPart?.meta && typeof state.currentPart.meta === "object"
      ? state.currentPart.meta
      : {};

    return {
      ...base,
      title: String(metaTitleInput.value || "").trim(),
      level: String(metaLevelInput.value || "").trim(),
      partLabel: String(metaPartLabelInput.value || "").trim(),
      section: String(metaSectionInput.value || "").trim(),
      partNumber: Number(metaPartNumberInput.value || 0),
      sourceUrl: String(metaSourceUrlInput.value || "").trim(),
      extractedAt: String(metaExtractedAtInput.value || "").trim() || base.extractedAt || new Date().toISOString()
    };
  }

  function getContext() {
    return {
      level: String(levelSelect.value || "").trim(),
      themeKey: String(themeSelect.value || "").trim(),
      versionKey: String(versionSelect.value || "").trim() || "default"
    };
  }

  async function loadThemes() {
    const level = String(levelSelect.value || "").trim();
    const previousTheme = String(themeSelect.value || "").trim();
    state.themes = await api(`/lesen/themes?level=${encodeURIComponent(level)}`);

    setSelectOptions(
      themeSelect,
      state.themes.map((theme) => ({ key: theme.key, label: `${theme.title} (${theme.key})` }))
    );

    if (!state.themes.length) {
      themeSelect.innerHTML = "";
      versionSelect.innerHTML = "";
      contentHost.innerHTML = "<div class='manager-alert error p-3'>No themes available in this level.</div>";
      saveBtn.disabled = true;
      return false;
    }

    saveBtn.disabled = false;
    const preferredTheme = pendingThemeFromQuery || previousTheme;
    if (preferredTheme && state.themes.some((theme) => theme.key === preferredTheme)) {
      themeSelect.value = preferredTheme;
    }
    pendingThemeFromQuery = "";
    return true;
  }

  async function loadVersions() {
    const { level, themeKey } = getContext();
    const previousVersion = String(versionSelect.value || "").trim();
    state.versions = await api(`/lesen/versions?level=${encodeURIComponent(level)}&themeKey=${encodeURIComponent(themeKey)}`);

    setSelectOptions(
      versionSelect,
      state.versions.map((version) => ({ key: version.key, label: `${version.label} (${version.key})` }))
    );

    if (!state.versions.length) {
      versionSelect.innerHTML = "";
      throw new Error("No versions found for this theme");
    }

    const preferredVersion = pendingVersionFromQuery || previousVersion;
    if (preferredVersion && state.versions.some((version) => version.key === preferredVersion)) {
      versionSelect.value = preferredVersion;
    }
    pendingVersionFromQuery = "";
  }

  async function loadPart() {
    const { level, themeKey, versionKey } = getContext();
    const query = new URLSearchParams({
      level,
      themeKey,
      versionKey,
      partKey
    });

    const response = await api(`/lesen/part?${query.toString()}`);
    renderPartForm(response.part);
  }

  async function refreshAll() {
    try {
      const hasThemes = await loadThemes();
      if (!hasThemes) {
        return;
      }
      await loadVersions();
      await loadPart();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  }

  levelSelect.addEventListener("change", refreshAll);

  themeSelect.addEventListener("change", async () => {
    try {
      await loadVersions();
      await loadPart();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  versionSelect.addEventListener("change", async () => {
    try {
      await loadPart();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  reloadBtn.addEventListener("click", async () => {
    try {
      await loadPart();
      showAlert(alertHost, "Part data reloaded", "success");
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      const context = getContext();
      const payload = {
        ...context,
        partKey,
        meta: buildMetaPayload(),
        content: state.collectContent()
      };

      await api("/lesen/part", {
        method: "PUT",
        body: payload
      });

      showAlert(alertHost, `${partLabel} updated successfully`, "success");
      await loadPart();
    } catch (error) {
      showAlert(alertHost, error.message, "error");
    }
  });

  refreshAll();
})();
