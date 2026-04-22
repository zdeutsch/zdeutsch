#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "site", "database", "lesen.json");
const OUTPUT_DIR = path.join(ROOT, "site", "exports");
const SITE_NAME = "ZDeutsch";
const CREATED_BY = "ZDeutsch community";
const PART_ORDER = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"];

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node site/export_lesen_pdf.js --level b1 --theme viktor --version default",
      "  node site/export_lesen_pdf.js --all",
      "",
      "Options:",
      "  --level <b1|b2>       Level key",
      "  --theme <theme-key>   Theme key (e.g. viktor)",
      "  --version <key>       Version key (default, 1, 2, ...)",
      "  --output <path>       Output PDF path (optional)",
      "  --all                 Export all themes + versions",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = { all: false, level: null, theme: null, version: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--all") {
      args.all = true;
    } else if (item === "--level") {
      args.level = argv[i + 1];
      i += 1;
    } else if (item === "--theme") {
      args.theme = argv[i + 1];
      i += 1;
    } else if (item === "--version") {
      args.version = argv[i + 1];
      i += 1;
    } else if (item === "--output") {
      args.output = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function loadDatabase() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Missing database at ${DATA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getVersionKeys(themeEntry) {
  if (!themeEntry) {
    return [];
  }
  if (Array.isArray(themeEntry.versionOrder) && themeEntry.versionOrder.length) {
    return themeEntry.versionOrder;
  }
  return Object.keys(themeEntry.versions || {});
}

function renderHeaderBlock(title, subtitle) {
  return `
    <div class="meta">
      <div class="meta-title">${escapeHtml(title)}</div>
      <div class="meta-subtitle">${escapeHtml(subtitle || "")}</div>
    </div>
  `;
}

function renderTextList(items) {
  return items
    .map(
      (item) => `
        <div class="item">
          <div class="item-id">${escapeHtml(item.id)}</div>
          <div class="item-text">${escapeHtml(item.text)}</div>
        </div>
      `
    )
    .join("");
}

function renderHeadlines(items) {
  return `
    <ul class="list">
      ${items
        .map(
          (item) => `
            <li><strong>${escapeHtml(item.id)}.</strong> ${escapeHtml(item.text)}</li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderQuestion(question) {
  const options = (question.options || [])
    .map(
      (option) => `
        <li><strong>${escapeHtml(option.id.toUpperCase())})</strong> ${escapeHtml(option.text)}</li>
      `
    )
    .join("");
  return `
    <div class="question">
      <div class="question-title">${escapeHtml(question.id)}. ${escapeHtml(question.prompt)}</div>
      <ul class="list">${options}</ul>
    </div>
  `;
}

function renderSegments(segments) {
  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtml(segment.value);
      }
      return `<span class="blank">(${escapeHtml(segment.id)})</span>`;
    })
    .join("");
}

function renderOptionsPerBlank(blanks) {
  return `
    <ul class="list">
      ${blanks
        .map(
          (blank) => `
            <li><strong>Lücke ${escapeHtml(blank.id)}:</strong> ${escapeHtml(
              (blank.options || []).join(" / ")
            )}</li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderWordBank(options) {
  return `
    <div class="word-bank">
      ${(options || []).map((option) => `<span>${escapeHtml(option)}</span>`).join("")}
    </div>
  `;
}

function renderTeil1(content) {
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 1", content.instruction || "")}
      <div class="columns">
        <div class="col">
          <h3>Texte</h3>
          ${renderTextList(content.texts || [])}
        </div>
        <div class="col">
          <h3>Überschriften</h3>
          ${renderHeadlines(content.headlines || [])}
        </div>
      </div>
    </section>
  `;
}

function renderTeil2(content) {
  const paragraphs = (content.passage?.paragraphs || [])
    .map((para) => `<p>${escapeHtml(para)}</p>`)
    .join("");
  const questions = (content.questions || []).map(renderQuestion).join("");
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 2", content.instruction || "")}
      <h3>${escapeHtml(content.passage?.title || "")}</h3>
      <div class="text-block">${paragraphs || ""}</div>
      <h3>Aufgaben</h3>
      ${questions}
    </section>
  `;
}

function renderTeil3(content) {
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 3", "Ordnen Sie die Situationen den Anzeigen zu.")}
      <div class="columns">
        <div class="col">
          <h3>Situationen</h3>
          ${renderTextList(content.situations || [])}
        </div>
        <div class="col">
          <h3>Anzeigen</h3>
          ${renderTextList(content.ads || [])}
        </div>
      </div>
    </section>
  `;
}

function renderSprach1(content) {
  const blanks = content.blanks || [];
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 1", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      <h3>Optionen</h3>
      ${renderOptionsPerBlank(blanks)}
    </section>
  `;
}

function renderSprach2(content) {
  const wordBank = (content.wordBank && content.wordBank.length)
    ? content.wordBank.map((item) => item.text || item.answer || item)
    : (content.options || []).length
      ? content.options
      : (content.blanks || []).map((item) => item.answer).filter(Boolean);
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 2", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      <h3>Wortliste</h3>
      ${renderWordBank(wordBank)}
    </section>
  `;
}

function renderCorrections(lesenEntry) {
  const parts = lesenEntry.parts || {};
  const blocks = PART_ORDER.filter((key) => parts[key]).map((partKey) => {
    const content = parts[partKey].content || {};
    if (partKey === "teil-1") {
      const answers = (content.answers || [])
        .map((answer) => `<li>Text ${escapeHtml(answer.textId)} → ${escapeHtml(answer.headlineId)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>Lesen Teil 1</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "teil-2") {
      const answers = (content.questions || [])
        .map(
          (question) =>
            `<li>Frage ${escapeHtml(question.id)} → ${escapeHtml(
              question.answerId?.toUpperCase() || ""
            )} ${escapeHtml(question.answerText || "")}</li>`
        )
        .join("");
      return `
        <div class="correction-block">
          <h3>Lesen Teil 2</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "teil-3") {
      const answers = (content.answers || [])
        .map(
          (answer) =>
            `<li>Situation ${escapeHtml(answer.situationId)} → ${escapeHtml(answer.adId)}</li>`
        )
        .join("");
      return `
        <div class="correction-block">
          <h3>Lesen Teil 3</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "sprachbausteine-1") {
      const answers = (content.answers || [])
        .map((answer) => `<li>Lücke ${escapeHtml(answer.id)} → ${escapeHtml(answer.answer)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>Sprachbausteine 1</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "sprachbausteine-2") {
      const answers = (content.answers || [])
        .map((answer) => `<li>Lücke ${escapeHtml(answer.id)} → ${escapeHtml(answer.answer)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>Sprachbausteine 2</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    return "";
  });

  return `
    <section class="page corrections">
      <h2>Korrekturen</h2>
      ${blocks.join("")}
    </section>
  `;
}

function buildHtml({ examTitle, levelLabel, versionLabel, lesenEntry }) {
  const parts = lesenEntry.parts || {};
  const orderedParts = PART_ORDER.filter((key) => parts[key]).map((partKey) => {
    const content = parts[partKey].content || {};
    if (partKey === "teil-1") {
      return renderTeil1(content);
    }
    if (partKey === "teil-2") {
      return renderTeil2(content);
    }
    if (partKey === "teil-3") {
      return renderTeil3(content);
    }
    if (partKey === "sprachbausteine-1") {
      return renderSprach1(content);
    }
    if (partKey === "sprachbausteine-2") {
      return renderSprach2(content);
    }
    return "";
  });

  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(examTitle)}</title>
        <style>
          body {
            font-family: "Helvetica Neue", Arial, sans-serif;
            font-size: 12px;
            color: #1f2933;
            margin: 0;
          }
          h2 {
            font-size: 18px;
            margin: 0 0 12px;
          }
          h3 {
            font-size: 14px;
            margin: 12px 0 8px;
          }
          p {
            margin: 0 0 8px;
            line-height: 1.5;
          }
          .page {
            padding: 12px 0;
            page-break-after: always;
          }
          .page:last-of-type {
            page-break-after: auto;
          }
          .meta {
            border: 1px solid #e7d9c6;
            background: #fbf7f0;
            padding: 10px 12px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .meta-title {
            font-size: 16px;
            font-weight: 700;
          }
          .meta-subtitle {
            margin-top: 4px;
            color: #5c6672;
          }
          .columns {
            display: flex;
            gap: 16px;
          }
          .col {
            flex: 1;
          }
          .item {
            border: 1px solid #e7d9c6;
            border-radius: 12px;
            padding: 10px 12px;
            margin-bottom: 10px;
            background: #fff;
          }
          .item-id {
            font-weight: 700;
            margin-bottom: 6px;
            color: #0f766e;
          }
          .item-text {
            line-height: 1.45;
          }
          .list {
            padding-left: 16px;
            margin: 0;
          }
          .question {
            border: 1px solid #e7d9c6;
            border-radius: 12px;
            padding: 10px 12px;
            margin-bottom: 10px;
          }
          .question-title {
            font-weight: 600;
            margin-bottom: 6px;
          }
          .text-block {
            border: 1px solid #e7d9c6;
            border-radius: 12px;
            padding: 12px;
            background: #fff;
            margin-bottom: 12px;
          }
          .blank {
            display: inline-block;
            padding: 2px 6px;
            border: 1px dashed #d9a441;
            border-radius: 6px;
            margin: 0 4px;
            font-weight: 600;
          }
          .word-bank {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .word-bank span {
            border: 1px solid #e7d9c6;
            border-radius: 999px;
            padding: 4px 8px;
            background: #fbf7f0;
            font-size: 11px;
          }
          .corrections {
            page-break-before: always;
          }
          .correction-block {
            border: 1px solid #e7d9c6;
            border-radius: 12px;
            padding: 10px 12px;
            margin-bottom: 10px;
            background: #fff;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .doc-subtitle {
            font-size: 12px;
            color: #5c6672;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <div class="doc-title">${escapeHtml(examTitle)}</div>
        <div class="doc-subtitle">${escapeHtml(levelLabel)} · ${escapeHtml(versionLabel)}</div>
        ${orderedParts.join("")}
        ${renderCorrections(lesenEntry)}
      </body>
    </html>
  `;
}

async function renderPdf(htmlPath, outputPath) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (error) {
    console.error("Playwright not installed. Run: npm install --save-dev playwright");
    throw error;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  const headerTemplate = `
    <div style="font-size:10px; width:100%; padding:0 24px; color:#6e6e6e;">
      <div style="font-weight:600;">${SITE_NAME}</div>
    </div>
  `;
  const footerTemplate = `
    <div style="font-size:10px; width:100%; padding:0 24px; color:#6e6e6e; display:flex; justify-content:space-between;">
      <span>${CREATED_BY}</span>
      <span>Page <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>
  `;
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: "70px", bottom: "70px", left: "36px", right: "36px" },
  });
  await browser.close();
}

async function exportExam(db, levelKey, themeKey, versionKey, outputPath) {
  const levelEntry = db.levels[levelKey];
  if (!levelEntry) {
    throw new Error(`Unknown level: ${levelKey}`);
  }
  const themeEntry = levelEntry.themes?.[themeKey];
  if (!themeEntry) {
    throw new Error(`Unknown theme: ${themeKey}`);
  }
  const versionKeys = getVersionKeys(themeEntry);
  const chosenVersion = versionKey || themeEntry.defaultVersion || versionKeys[0] || "default";
  const versionEntry = themeEntry.versions?.[chosenVersion] || themeEntry.versions?.default;
  const lesenEntry = versionEntry?.lesen || themeEntry.lesen;
  if (!lesenEntry) {
    throw new Error("Missing Lesen content.");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fileName = outputPath
    ? path.basename(outputPath)
    : `${levelKey}-${themeKey}-${chosenVersion}.pdf`;
  const pdfPath = outputPath || path.join(OUTPUT_DIR, fileName);
  const htmlPath = path.join(OUTPUT_DIR, `${levelKey}-${themeKey}-${chosenVersion}.html`);

  const examTitle = versionEntry?.title || themeEntry.title || themeKey;
  const html = buildHtml({
    examTitle,
    levelLabel: levelKey.toUpperCase(),
    versionLabel: versionEntry?.label || chosenVersion,
    lesenEntry
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  await renderPdf(htmlPath, pdfPath);
  console.log(`PDF exported: ${pdfPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && (!args.level || !args.theme)) {
    printUsage();
    process.exit(1);
  }

  const db = loadDatabase();

  if (args.all) {
    for (const levelKey of Object.keys(db.levels || {})) {
      const levelEntry = db.levels[levelKey];
      const themes = Object.keys(levelEntry.themes || {});
      for (const themeKey of themes) {
        const themeEntry = levelEntry.themes[themeKey];
        const versionKeys = getVersionKeys(themeEntry);
        for (const versionKey of versionKeys) {
          await exportExam(db, levelKey, themeKey, versionKey, null);
        }
      }
    }
    return;
  }

  await exportExam(db, args.level, args.theme, args.version, args.output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
