/**
 * Community correction forms generator (Lesen module)
 *
 * HOW TO USE
 * 1) Open script.google.com and create a new Apps Script project.
 * 2) Paste this full file into Code.gs.
 * 3) Run generateCommunityCorrectionForms().
 * 4) Approve permissions.
 * 5) Open the created response spreadsheet -> "FormLinks" and "Integration" sheets.
 *
 * WHAT IT CREATES
 * - 5 Google Forms (one per Lesen part type)
 * - Each form contains ALL item answers for that part (one question per item)
 * - 1 Google Spreadsheet receiving all form responses
 * - 1 Drive folder containing all generated assets
 * - Prefill URL templates using URL params: a1..a40 (+ merged context)
 */

const GENERATOR_CONFIG = {
  projectName: "Community Corrections",
  confirmationMessage: "Danke! Your correction suggestion was submitted.",
  allowMultipleSubmissionsPerUser: true,
  requireGoogleSignIn: true,
  limitOneResponsePerForm: false,
  levels: ["b1", "b2"],
  formSpecs: [
    {
      partKey: "teil-1",
      partLabel: "Lesen Teil 1",
      itemLabelPrefix: "Text",
      itemNumbers: ["1", "2", "3", "4", "5"],
      answerType: "LIST",
      answerHelp: "Choose the headline ID for each text.",
      answerOptions: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    },
    {
      partKey: "teil-2",
      partLabel: "Lesen Teil 2",
      itemLabelPrefix: "Frage",
      itemNumbers: ["6", "7", "8", "9", "10"],
      answerType: "LIST",
      answerHelp: "Choose the correct option ID for each question.",
      answerOptions: ["a", "b", "c"]
    },
    {
      partKey: "teil-3",
      partLabel: "Lesen Teil 3",
      itemLabelPrefix: "Situation",
      itemNumbers: ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      answerType: "LIST",
      answerHelp: "Choose the ad ID for each situation.",
      answerOptions: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "X"]
    },
    {
      partKey: "sprachbausteine-1",
      partLabel: "Sprachbausteine 1",
      itemLabelPrefix: "Luecke",
      itemNumbers: ["21", "22", "23", "24", "25", "26", "27", "28", "29", "30"],
      answerType: "TEXT",
      answerHelp: "Write the exact word or option text for each blank."
    },
    {
      partKey: "sprachbausteine-2",
      partLabel: "Sprachbausteine 2",
      itemLabelPrefix: "Luecke",
      itemNumbers: ["31", "32", "33", "34", "35", "36", "37", "38", "39", "40"],
      answerType: "TEXT",
      answerHelp: "Write the exact word for each blank."
    }
  ]
};

function generateCommunityCorrectionForms() {
  const runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const slugStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");

  const folder = DriveApp.createFolder(`${GENERATOR_CONFIG.projectName} - ${slugStamp}`);
  const spreadsheet = SpreadsheetApp.create(`${GENERATOR_CONFIG.projectName} - Responses - ${slugStamp}`);
  moveFileToFolder_(spreadsheet.getId(), folder);

  const generatedForms = [];
  GENERATOR_CONFIG.formSpecs.forEach((spec) => {
    const generated = createPartForm_(spec, spreadsheet.getId());
    generatedForms.push(generated);
    moveFileToFolder_(generated.formId, folder);
  });

  const ss = SpreadsheetApp.openById(spreadsheet.getId());
  writeFormLinksSheet_(ss, generatedForms);
  writeIntegrationSheet_(ss, generatedForms, {
    generatedAt: runStamp,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    responseSpreadsheetId: spreadsheet.getId(),
    responseSpreadsheetUrl: spreadsheet.getUrl(),
    settings: {
      allowMultipleSubmissionsPerUser: GENERATOR_CONFIG.allowMultipleSubmissionsPerUser,
      requireGoogleSignIn: GENERATOR_CONFIG.requireGoogleSignIn,
      limitOneResponsePerForm: GENERATOR_CONFIG.limitOneResponsePerForm
    }
  });

  Logger.log("Generation complete.");
  Logger.log(`Folder: ${folder.getUrl()}`);
  Logger.log(`Response spreadsheet: ${spreadsheet.getUrl()}`);

  return {
    generatedAt: runStamp,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    responseSpreadsheetId: spreadsheet.getId(),
    responseSpreadsheetUrl: spreadsheet.getUrl(),
    forms: generatedForms
  };
}

function createPartForm_(spec, destinationSpreadsheetId) {
  const title = `${GENERATOR_CONFIG.projectName} | ${spec.partLabel}`;
  const form = FormApp.create(title);

  form.setDescription([
    `Community correction form for ${spec.partLabel}.`,
    "Fill all available answers for this part.",
    "Email is collected automatically.",
    "Context metadata is auto-filled at the bottom."
  ].join("\n"));

  form.setCollectEmail(true);
  form.setConfirmationMessage(GENERATOR_CONFIG.confirmationMessage);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);
  form.setAcceptingResponses(true);

  const limitOneResponse = !GENERATOR_CONFIG.allowMultipleSubmissionsPerUser
    || Boolean(GENERATOR_CONFIG.limitOneResponsePerForm);
  form.setLimitOneResponsePerUser(limitOneResponse);

  if (GENERATOR_CONFIG.requireGoogleSignIn) {
    try {
      form.setRequireLogin(true);
    } catch (error) {
      Logger.log(
        `Warning: setRequireLogin(true) not available for ${spec.partKey}. ` +
        `Continuing without strict sign-in enforcement. Details: ${error}`
      );
    }
  }

  const entryIds = {
    answers: {}
  };

  spec.itemNumbers.forEach((itemNumber) => {
    const titleForItem = `${spec.itemLabelPrefix} ${itemNumber}`;
    if (spec.answerType === "LIST") {
      const item = form
        .addListItem()
        .setTitle(titleForItem)
        .setHelpText(spec.answerHelp || "")
        .setChoiceValues(spec.answerOptions || [])
        .setRequired(true);
      entryIds.answers[itemNumber] = item.getId();
      return;
    }

    const item = form
      .addTextItem()
      .setTitle(titleForItem)
      .setHelpText(spec.answerHelp || "")
      .setRequired(true);
    entryIds.answers[itemNumber] = item.getId();
  });

  const reasonItem = form
    .addParagraphTextItem()
    .setTitle("Reason/Comment (optional)")
    .setRequired(false);
  entryIds.reason = reasonItem.getId();

  const contextItem = form
    .addParagraphTextItem()
    .setTitle("Context (auto-filled)")
    .setHelpText("Auto metadata. You can ignore this field.")
    .setRequired(false);
  entryIds.context = contextItem.getId();

  form.setDestination(FormApp.DestinationType.SPREADSHEET, destinationSpreadsheetId);

  const publicUrl = form.getPublishedUrl();
  const prefillTemplate = buildPrefillTemplate_(publicUrl, entryIds, spec);

  return {
    partKey: spec.partKey,
    partLabel: spec.partLabel,
    formId: form.getId(),
    editUrl: form.getEditUrl(),
    publicUrl,
    prefillTemplate,
    itemNumbers: spec.itemNumbers,
    answerType: spec.answerType,
    entryIds,
    answerParamKeys: spec.itemNumbers.map((itemNumber) => `a${itemNumber}`)
  };
}

function buildPrefillTemplate_(publicUrl, entryIds, spec) {
  const params = [];

  spec.itemNumbers.forEach((itemNumber) => {
    const entryId = entryIds.answers[itemNumber];
    params.push(`entry.${entryId}={{a${itemNumber}}}`);
  });

  params.push(`entry.${entryIds.reason}={{reason}}`);
  params.push(`entry.${entryIds.context}={{context}}`);

  return `${publicUrl}?usp=pp_url&${params.join("&")}`;
}

function writeFormLinksSheet_(spreadsheet, generatedForms) {
  const sheet = getOrCreateSheet_(spreadsheet, "FormLinks");
  sheet.clearContents();

  const header = [
    "partKey",
    "partLabel",
    "itemNumbers",
    "answerParamKeys",
    "formPublicUrl",
    "prefillTemplate",
    "formEditUrl",
    "formId",
    "entry.reason",
    "entry.context",
    "entry.answers.json"
  ];

  const rows = generatedForms.map((formInfo) => [
    formInfo.partKey,
    formInfo.partLabel,
    formInfo.itemNumbers.join(","),
    formInfo.answerParamKeys.join(","),
    formInfo.publicUrl,
    formInfo.prefillTemplate,
    formInfo.editUrl,
    formInfo.formId,
    formInfo.entryIds.reason,
    formInfo.entryIds.context,
    JSON.stringify(formInfo.entryIds.answers)
  ]);

  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
}

function writeIntegrationSheet_(spreadsheet, generatedForms, summary) {
  const sheet = getOrCreateSheet_(spreadsheet, "Integration");
  sheet.clearContents();

  const formsMap = {};
  generatedForms.forEach((formInfo) => {
    formsMap[formInfo.partKey] = {
      partKey: formInfo.partKey,
      partLabel: formInfo.partLabel,
      formId: formInfo.formId,
      formPublicUrl: formInfo.publicUrl,
      formEditUrl: formInfo.editUrl,
      prefillTemplate: formInfo.prefillTemplate,
      itemNumbers: formInfo.itemNumbers,
      answerParamKeys: formInfo.answerParamKeys,
      entryIds: formInfo.entryIds
    };
  });

  const integrationPayload = {
    generatedAt: summary.generatedAt,
    folderId: summary.folderId,
    folderUrl: summary.folderUrl,
    responseSpreadsheetId: summary.responseSpreadsheetId,
    responseSpreadsheetUrl: summary.responseSpreadsheetUrl,
    settings: summary.settings,
    forms: formsMap
  };

  sheet.getRange("A1").setValue("Integration JSON:");
  sheet.getRange("A2").setValue(JSON.stringify(integrationPayload, null, 2));
  sheet.getRange("A2").setWrap(true);

  sheet.getRange("A4").setValue("JS helper (auto-prefill from current URL query params):");
  sheet.getRange("A5").setValue([
    "function buildPrefilledFormUrl(formConfig, currentUrl) {",
    "  const page = new URL(currentUrl || window.location.href);",
    "  const q = page.searchParams;",
    "  const enc = encodeURIComponent;",
    "  let url = formConfig.formPublicUrl + '?usp=pp_url';",
    "  Object.keys(formConfig.entryIds.answers).forEach((itemNumber) => {",
    "    const entryId = formConfig.entryIds.answers[itemNumber];",
    "    const paramName = 'a' + itemNumber;",
    "    url += '&entry.' + entryId + '=' + enc(q.get(paramName) || '');",
    "  });",
    "",
    "  url += '&entry.' + formConfig.entryIds.reason + '=' + enc(q.get('reason') || '');",
    "  const contextValue = q.get('context') || [",
    "    'level=' + (q.get('level') || ''),",
    "    'theme=' + (q.get('theme') || ''),",
    "    'version=' + (q.get('version') || 'default'),",
    "    'part=' + (formConfig.partKey || ''),",
    "    'page=' + page.href",
    "  ].join('; ');",
    "  url += '&entry.' + formConfig.entryIds.context + '=' + enc(contextValue);",
    "  return url;",
    "}"
  ].join("\n"));

  sheet.setColumnWidth(1, 1500);
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  const existing = spreadsheet.getSheetByName(sheetName);
  if (existing) {
    return existing;
  }
  return spreadsheet.insertSheet(sheetName);
}

function moveFileToFolder_(fileId, targetFolder) {
  const file = DriveApp.getFileById(fileId);
  targetFolder.addFile(file);

  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getId() !== targetFolder.getId()) {
      try {
        parent.removeFile(file);
      } catch (error) {
        Logger.log(`Note: Could not remove file ${fileId} from parent ${parent.getId()}: ${error}`);
      }
    }
  }
}
