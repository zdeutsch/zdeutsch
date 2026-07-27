import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LESEN_PATH = path.join(ROOT, "database", "lesen.json");
const MUNDLICH_PATH = path.join(ROOT, "database", "mundlich.json");
const IMPORTED_AT = "2026-07-27T00:00:00.000Z";
const execFileAsync = promisify(execFile);

const SOURCES = Object.freeze({
  catalog: "https://sites.google.com/view/b1telcprufung/trang-ch%E1%BB%A7/b%E1%BB%99-%C4%91%E1%BB%81-%E1%BA%A3-r%E1%BA%ADp?authuser=0",
  wLesen: "https://forms.gle/WMiS113YjErXaFAa9",
  maraLesen: "https://forms.gle/9wb3dMSKCVMLd1tD9",
  jakobLesen: "https://forms.gle/u2NfZGM4Ro528rDX8",
  jakobSprach: "https://forms.gle/zJ8XX9MXvKhFo3DS7",
  nacoLesen: "https://forms.gle/D8WaftTL1MmXqjFT6",
  nacoSprach: "https://forms.gle/LvzjNvmbH9P6JuAc8",
  sprechenTeil1: "https://sites.google.com/view/b1telcprufung/trang-ch%E1%BB%A7/b%E1%BB%99-%C4%91%E1%BB%81-%E1%BA%A3-r%E1%BA%ADp/teil-1-m%C3%BCndliche-pr%C3%BCfung",
  sprechenTeil2: "https://docs.google.com/document/d/1JzeviUgaGuqIn6dLXIkahTyvvTACisnoiiZv-m5uXWE/edit?usp=sharing",
  sprechenTeil3: "https://docs.google.com/document/d/1IDAIboKyJ5w2M7dEWdl64BrOGOdJLp8m0LZUT4xmzx0/edit?usp=sharing",
  sprechenTeil2Text: "https://docs.google.com/document/d/1JzeviUgaGuqIn6dLXIkahTyvvTACisnoiiZv-m5uXWE/export?format=txt",
  sprechenTeil3Text: "https://docs.google.com/document/d/1IDAIboKyJ5w2M7dEWdl64BrOGOdJLp8m0LZUT4xmzx0/export?format=txt"
});

const W_ADS = [
  ["A", "Sophi's Thai-Gourmet\nThai-Partyservice ab 10 Menüs. Catering, Fingerfood und Kochen bei Ihnen zu Hause."],
  ["B", "Viehmann Floristik\nBlumen, Pflanzen, Sträuße, Rosen, Hochzeitsschmuck und Lieferservice."],
  ["C", "VHS Wuppertal-Süd: Blumenzauber\nSamstagswerkstatt zum Herstellen von persönlichem Blumenschmuck."],
  ["D", "Möbelzentrum Oberweser\nMöbel, Porzellan, Lampen, Geschirr, Keramik, Teppiche und Bettwäsche."],
  ["E", "VHS Wuppertal: Exotische Pfannengerichte\nThailändische Gerichte gemeinsam kochen und anschließend essen."],
  ["F", "Kuno's Mobile Freizeit\nReisemobile und Wohnwagen mit Zubehör und fachmännischer Beratung."],
  ["G", "Nakorn Thai Restaurant\nOriginal thailändische Küche, dienstags bis sonntags geöffnet."],
  ["H", "Plana Badeland\nBäder, Beratung und Badausstellung."],
  ["I", "Lernstudio Barbarossa\nNachhilfe in allen Fächern und Klassen, kostenloser Probeunterricht."],
  ["J", "BUGA Bundesgartenschau\nLandschaftspark, Blumen und Ausstellungshallen, täglich geöffnet."],
  ["K", "Hartmann & Schröder\nTransporter- und Minibus-Verleih für Umzüge, auf Wunsch mit Umzugshelfern."],
  ["L", "Mathematikum Gießen\nMonatlicher Kindervortrag zu mathematischen Themen für 8- bis 12-Jährige."]
];

const MARA_ADS = [
  ["A", "ANLO inter@ctiv NETWORK\nWerbeagentur sucht eine Webentwicklerin oder einen Webentwickler mit Berufserfahrung."],
  ["B", "INFURN Designermöbel\nHandgefertigte Einzelstücke zu angemessenen Preisen."],
  ["C", "FIT fürs INTERNET\nInternetschulung für Computer-Neulinge bei der Stadt Cuxhaven."],
  ["D", "Wohnen im friesischen Landhaus\nFamilienurlaub in einer komplett eingerichteten Ferienwohnung in Schleswig-Holstein."],
  ["E", "NOWA Netzwerk für Berufsausbildung entwickeln\nAusbildung in Kooperation mit Betrieben aus Frankfurt und Umgebung."],
  ["F", "Teilzeitjob als Bürokraft\nVormittags zwischen 8 und 14 Uhr in Versand, Buchhaltung oder Verkauf."],
  ["G", "Wohnung auf dem Land\nKleine 2-Zimmer-Wohnung in Uninähe, 490 Euro plus Nebenkosten."],
  ["H", "Walter Berufsmoden\nModische Berufsbekleidung für Gastronomie, Handwerk und Medizin."],
  ["I", "Webdesign für Unternehmen\nInternetwerbung, Webdesign, Suchmaschineneintrag und Online-Shop-Gestaltung."],
  ["J", "ASSO Möbel\nPraktische Kleinmöbel zu günstigen Preisen."],
  ["K", "Kleider machen Leute\nModeboutique mit aktuellen Trends und klassischen Kleidungsstücken."],
  ["L", "HOT@SPOT\nKopier-, Scan-, Internet- und Druckservice mit langen Öffnungszeiten."]
];

const ANSWERS = Object.freeze({
  w: {
    teil1: ["I", "B", "H", "F", "C"],
    teil2: ["b", "c", "c", "c", "a"],
    teil3: ["E", "K", "I", "B", "J", "D", "X", "X", "A", "F"]
  },
  mara: {
    teil1: ["I", "D", "A", "B", "E"],
    teil3: ["X", "E", "C", "I", "H", "F", "D", "B", "J", "G"]
  },
  jakob: {
    teil1: ["J", "B", "C", "F", "I"],
    teil2: ["b", "b", "b", "b", "c"],
    teil3: ["E", "J", "L", "I", "A", "B", "F", "X", "H", "K"],
    sprach1: ["deinen", "weil", "noch", "Für", "neuen", "ja", "Darauf", "wäre", "trotz", "können"],
    sprach2: ["DURCH", "VOR", "WELCHE", "UNTERSCHIEDEN", "LIESSEN", "WIE", "VON", "MIT", "WAS", "DANN"]
  },
  naco: {
    teil1: ["F", "G", "E", "C", "A"],
    teil2: ["b", "b", "b", "a", "a"],
    teil3: ["A", "B", "C", "G", "D", "H", "I", "J", "X", "X"],
    sprach1: ["zu", "kommenden", "nach", "bieten", "so dass", "Gemeinsam mit", "der Besuch", "ist geplant", "besprochen", "haben"],
    sprach2: ["MIT", "BEI", "DAS", "DAFÜR", "DABEI", "OBWOHL", "DENEN", "DASS", "AUF", "VON"]
  }
});

const NACO_SPRACH_1 = `Sehr geehrter Herr Martini,
vielen Dank für Ihre Anfrage vom 16. Juni [[21]] der Studienreise Ihrer Schulklasse nach Frankfurt am Main im [[22]] Oktober.

Die Unterkunft bei deutschen Gastfamilien ist prinzipiell möglich. Die Familien werden von uns sorgfältig [[23]] strengen Kriterien ausgewählt, die Sie in der beiliegenden Informationsbroschüre auf den Seiten 15 bis 17 finden. Pro Gastfamilie können ein oder zwei Schülerinnen bzw. Schüler untergebracht werden. Unsere Gastfamilien [[24]] Halbpension, das heißt in der Regel Frühstück und Abendessen, an. Alle Familien wohnen im näheren Umkreis der Schule, [[25]] der Weg von der Unterkunft zum Unterricht innerhalb von maximal 10 Minuten zu Fuß zurückgelegt werden kann.

Zweimal pro Woche ist die Teilnahme am Schulunterricht Ihrer Partnerschule in Frankfurt, der Heinrich-Böll-Schule, in den Fächern Geografie, Kunst und Deutsch vorgesehen. Die Unterrichtssprache ist Deutsch. [[26]] Schülerinnen und Schülern der Partnerschule wird das Freizeit- und Kulturprogramm durchgeführt.

Dazu gehört zum Beispiel [[27]] der Gemäldegalerie "Städel", des Museums für Kunsthandwerk und des Deutschen Postmuseums. Auch ein Besuch beim Hessischen Rundfunk [[28]]. Jeweils dienstags und freitags werden Kulturabende veranstaltet, an denen die verschiedenen Aspekte und Unterschiede der deutschen und der italienischen Kultur [[29]] werden sollen.

Weitere Informationen finden Sie in der beiliegenden Broschüre. Wir hoffen, dass Sie und Ihre Klasse einen erlebnisreichen und unvergesslichen Aufenthalt in Frankfurt [[30]] werden. Bei weiteren Fragen setzen Sie sich bitte mit uns in Verbindung.

Mit freundlichen Grüßen
Sibylle Lauterbacher
Stiftung Schüleraustausch Frankfurt`;

const NACO_SPRACH_2 = `Deutschland - ein Paradies für Kinder?

17 Millionen Kinder leben in Deutschland. Verglichen [[31]] der Bevölkerungszahl von ungefähr 80 Millionen ist das fast ein Viertel der Einwohner. Doch nur für jedes zehnte Kind unter drei Jahren steht ein Betreuungsplatz in einer Kindertagesstätte zur Verfügung. Die Folge: Nur etwas mehr als die Hälfte der Mütter dieser Kinder ist berufstätig - und nur ein Viertel kann ganztägig zur Arbeit gehen.

Um dem entgegenzuwirken, gibt es in Deutschland die dreijährige Elternzeit, die es einem Elternteil ermöglichen soll, drei Jahre [[32]] dem Kind zu Hause zu bleiben. [[33]] hat den Vorteil, dass der zu Hause bleibende Elternteil seinen Arbeitsplatz nicht verliert. Dennoch wird die Elternzeit für viele Eltern in finanzieller Hinsicht zu einem gravierenden Problem. Außerdem gilt die Elternzeit nur für Angestellte. Mütter zum Beispiel, die vor der Geburt des Kindes selbständig waren und mit dem Baby zu Hause bleiben wollen, stehen weit schlechter da. Kind und Karriere zu vereinbaren ist daher in Deutschland für die meisten Mütter so gut wie unmöglich. Dies scheinen die Hauptgründe [[34]] zu sein, warum in Deutschland zurzeit weltweit die wenigsten Kinder geboren werden.

Doch auch andere Dinge machen Familien mit Kindern in Deutschland das Leben schwer: In Restaurants zum Beispiel sind Kinder selten willkommen. Sie sitzen eben nicht still am Tisch, [[35]] stören mit ihrem Lachen und lauten Sprechen die anderen kinderlosen Gäste. Bei den kinderlosen Erwachsenen werden andere Maßstäbe angelegt. [[36]] diese selbst häufig lautstark telefonieren, stört das niemanden: Telefonate sind eben wichtiger als Kinder.

In zahlreichen deutschen Städten wie Mainz strengen Anwohner Prozesse gegen Kindergärten und Spielplätze an, an [[37]] die Kinder die Ruhe der benachbarten kinderlosen Hausbewohner stören. Die Folge: Spielplätze werden von Gerichten wegen geschlossen. An Wiesen, auf denen früher Kinder tobten und Ball spielten, stehen nun Schilder: Betreten und spielen verboten. Bei Zuwiderhandlung drohen Geldstrafen.

Eltern, die mit der deutschen Bahn mit ihren Kindern verreisen möchten, haben schlechte Karten. In den meisten Zügen sind die Gänge so angeordnet, [[38]] mit einem Kinderwagen kein Durchkommen ist. Und in den Mutter-Kind-Abteilen haben sich schon andere Reisende breitgemacht, die nicht einsehen, warum sie Müttern mit Kind Platz machen sollten. Schließlich hätten sie ja eine Fahrkarte gekauft und damit Anspruch [[39]] einen Platz. In vielen Berichten in Zeitungen oder im Fernsehen, die sich mit Kindern, ihrer Erziehung oder mit dem Schulsystem befassen, spricht man in Deutschland gerne [[40]] "Problemen". Man meint damit die Kinder. Kann eine Gesellschaft, in der ein Kind als ein Problemfall angesehen wird, ein Paradies für Kinder sein?`;

function normalizeWhitespace(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanPrefix(value) {
  return normalizeWhitespace(value).replace(/^\d+\s*[.)]\s*/, "");
}

function cleanChoice(value) {
  return normalizeWhitespace(value).replace(/^[A-Za-z]\s*[.)]\s*/, "");
}

function formItems(form) {
  return form?.[1]?.[1] || [];
}

function itemChoices(item) {
  return item?.[4]?.[0]?.[1]?.map((choice) => normalizeWhitespace(choice?.[0])) || [];
}

function meta(title, partLabel, section, partNumber, sourceUrl) {
  return {
    title,
    level: "B1",
    partLabel,
    section,
    partNumber,
    sourceUrl,
    extractedAt: IMPORTED_AT
  };
}

function makeSegments(text, answerMap) {
  const segments = [];
  let cursor = 0;
  const matcher = /\[\[(\d+)]]/g;
  let match;
  while ((match = matcher.exec(text))) {
    if (match.index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    const id = Number(match[1]);
    segments.push({ type: "luecke", id, answer: answerMap.get(id) || "" });
    cursor = matcher.lastIndex;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }
  return segments;
}

function withPlaceholders(text) {
  return normalizeWhitespace(text).replace(/\((\d{2})\)\s*_+/g, "[[$1]]");
}

function makeAds(entries) {
  return [
    ...entries.map(([id, text]) => ({ id, text })),
    { id: "X", text: "Keine passende Anzeige" }
  ];
}

function parseLabeledAds(value) {
  const text = normalizeWhitespace(value);
  const markers = Array.from(text.matchAll(/^([A-L])(?:\)|:)\s*/gm));
  return markers.map((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? text.length;
    return {
      id: marker[1],
      text: normalizeWhitespace(text.slice(start, end))
    };
  });
}

function buildTeil1(form, title, sourceUrl, answerIds) {
  const questions = formItems(form).filter((item) => item?.[3] === 2).slice(0, 5);
  const headlines = itemChoices(questions[0]).map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text: cleanChoice(text)
  }));
  return {
    meta: meta(title, "Lesen Teil 1", "lesen", 1, sourceUrl),
    content: {
      instruction: "Lesen Sie die Überschriften und die Texte. Finden Sie für jeden Text die passende Überschrift.",
      texts: questions.map((item, index) => ({ id: index + 1, text: cleanPrefix(item[1]) })),
      headlines,
      answers: answerIds.map((headlineId, index) => ({ textId: index + 1, headlineId }))
    }
  };
}

function buildTeil2(form, title, sourceUrl, answerIds) {
  const items = formItems(form);
  const sectionIndex = items.findIndex((item) => item?.[3] === 8 && /teil\s*2/i.test(item?.[1] || ""));
  const section = items[sectionIndex];
  const nextSectionIndex = items.findIndex((item, index) => index > sectionIndex && item?.[3] === 8);
  const questions = items
    .slice(sectionIndex + 1, nextSectionIndex === -1 ? items.length : nextSectionIndex)
    .filter((item) => item?.[3] === 2)
    .slice(0, 5);
  const passageLines = normalizeWhitespace(section?.[2]).split("\n");
  const passageTitle = passageLines.shift() || title;
  const passageText = normalizeWhitespace(passageLines.join("\n"));
  return {
    meta: meta(title, "Lesen Teil 2", "lesen", 2, sourceUrl),
    content: {
      instruction: "Lesen Sie den Text und wählen Sie für jede Aufgabe die richtige Lösung.",
      passage: {
        title: passageTitle,
        text: passageText,
        paragraphs: passageText.split(/\n{2,}/).map(normalizeWhitespace).filter(Boolean)
      },
      questions: questions.map((item, index) => {
        const options = itemChoices(item).map((option, optionIndex) => ({
          id: String.fromCharCode(97 + optionIndex),
          text: cleanChoice(option)
        }));
        const answerId = answerIds[index];
        return {
          id: index + 6,
          prompt: cleanPrefix(item[1]),
          options,
          answerId,
          answerText: options.find((option) => option.id === answerId)?.text || ""
        };
      })
    }
  };
}

function buildTeil3(form, title, sourceUrl, answerIds, adsOverride = null) {
  const items = formItems(form);
  const sectionIndex = items.findIndex((item) => item?.[3] === 8 && /teil\s*3/i.test(item?.[1] || ""));
  const section = items[sectionIndex];
  const situations = items.slice(sectionIndex + 1).filter((item) => item?.[3] === 3).slice(0, 10);
  const ads = adsOverride ? makeAds(adsOverride) : [
    ...parseLabeledAds(section?.[2]),
    { id: "X", text: "Keine passende Anzeige" }
  ];
  return {
    meta: meta(title, "Lesen Teil 3", "lesen", 3, sourceUrl),
    content: {
      situations: situations.map((item, index) => ({ id: index + 11, text: cleanPrefix(item[1]) })),
      ads,
      answers: answerIds.map((adId, index) => ({ situationId: index + 11, adId }))
    }
  };
}

function buildSprach1(form, title, sourceUrl, answers, passageOverride = "") {
  const questions = formItems(form).filter((item) => item?.[3] === 2).slice(0, 10);
  const text = withPlaceholders(passageOverride || form?.[1]?.[0]);
  const answerMap = new Map(answers.map((answer, index) => [index + 21, answer]));
  return {
    meta: meta(title, "Sprachbausteine 1", "sprachbausteine", 1, sourceUrl),
    content: {
      title: text.split("\n")[0] || title,
      instruction: "Ergänzen Sie die fehlenden Wörter.",
      text,
      segments: makeSegments(text, answerMap),
      blanks: questions.map((item, index) => ({ id: index + 21, options: itemChoices(item) })),
      answers: answers.map((answer, index) => ({ id: index + 21, answer }))
    }
  };
}

function buildSprach2(form, title, sourceUrl, answers, passageOverride = "") {
  const items = formItems(form);
  const section = items.find((item) => item?.[3] === 8 && /teil\s*2/i.test(item?.[1] || ""));
  const questions = items.filter((item) => item?.[3] === 3 && Number(item?.[1]) >= 31).slice(0, 10);
  const text = withPlaceholders(passageOverride || section?.[2]);
  let options = itemChoices(questions[0]);
  if (answers.includes("DENEN") && !options.includes("DENEN")) {
    options = options.map((option) => option === "DENNOCH" ? "DENEN" : option);
  }
  const answerMap = new Map(answers.map((answer, index) => [index + 31, answer]));
  return {
    meta: meta(title, "Sprachbausteine 2", "sprachbausteine", 2, sourceUrl),
    content: {
      title: text.split("\n")[0] || title,
      instruction: "Wählen Sie für jede Lücke das passende Wort aus dem Kasten.",
      text,
      segments: makeSegments(text, answerMap),
      wordBank: [],
      options,
      blanks: answers.map((answer, index) => ({ id: index + 31, answer })),
      answers: answers.map((answer, index) => ({ id: index + 31, answer }))
    }
  };
}

function makeTheme(id, title, parts, partOrder) {
  return {
    id,
    title,
    defaultVersion: "default",
    versions: {
      default: {
        key: "default",
        label: "Standard",
        title,
        lesen: {
          parts,
          partOrder,
          counts: { parts: partOrder.length }
        }
      }
    },
    versionOrder: ["default"],
    counts: { parts: partOrder.length, versions: 1 }
  };
}

async function loadForm(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);<\/script>/s);
  if (!match) {
    throw new Error(`Google Forms data was not found at ${url}`);
  }
  return JSON.parse(match[1]);
}

async function loadText(url) {
  const { stdout } = await execFileAsync("curl", [
    "--location",
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "5",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    url
  ], { maxBuffer: 4 * 1024 * 1024 });
  return stdout.replace(/^\uFEFF/, "").replace(/\r/g, "");
}

function parseDiscussionTopics(text) {
  const headingPattern = /^\s*(\d+(?:\.\d+)?)\.?\s*Thema\s+[„"]([^”"“\n]+)[”"“]\s*$/gm;
  const matches = Array.from(text.matchAll(headingPattern));
  let series = 1;
  let previousNumber = 0;
  return matches.flatMap((match, index) => {
    const numeric = Number.parseFloat(match[1]);
    if (numeric < previousNumber) {
      series += 1;
    }
    previousNumber = numeric;
    const chunkStart = match.index + match[0].length;
    const chunkEnd = matches[index + 1]?.index ?? text.length;
    const chunk = text.slice(chunkStart, chunkEnd).trim();
    const positions = chunk.match(/Person A\s*:?\s*([\s\S]*?)\n\s*Person B\s*:?\s*([\s\S]*)/i);
    if (!positions) {
      return [];
    }
    const splitSpeaker = (block, fallbackSpeaker) => {
      const lines = normalizeWhitespace(block).split("\n").filter(Boolean);
      const firstLine = normalizeWhitespace(lines[0]);
      const firstLineIsOpinion = lines.length === 1
        || /^(Ich|Wir|Mein|Meine|Unser|Unsere|Das|Die|Der|In|Am|Man|Haustiere)\b/.test(firstLine);
      const speaker = firstLineIsOpinion
        ? fallbackSpeaker
        : firstLine.replace(/^\((.+)\)$/, "$1");
      const opinion = firstLineIsOpinion ? lines : lines.slice(1);
      return {
        speaker,
        opinion: normalizeWhitespace(opinion.join("\n"))
      };
    };
    const personA = splitSpeaker(positions[1], "Position A");
    const personB = splitSpeaker(positions[2], "Position B");
    if (!personA.opinion || !personB.opinion) {
      return [];
    }
    return [{
      id: `diskussion-${series}-${String(match[1]).replace(".", "-")}`,
      title: normalizeWhitespace(match[2]),
      personA,
      personB
    }];
  });
}

function parsePlanningTopics(text) {
  const headingPattern = /^\s*(\d+)\.\s*(\S.+?)\s*$/gm;
  const matches = Array.from(text.matchAll(headingPattern));
  const seen = new Set();
  const topics = [];
  matches.forEach((match, index) => {
    const title = normalizeWhitespace(match[2])
      .replace(/\s*\((?:đề|đang)[^)]+\)\s*/gi, "")
      .replace(/\s*-\s*Auto tour$/i, "");
    const normalizedTitle = title.toLowerCase().replace(/[^a-zäöüß0-9]+/gi, " ").trim();
    const chunkStart = match.index + match[0].length;
    const chunkEnd = matches[index + 1]?.index ?? text.length;
    const chunk = normalizeWhitespace(text.slice(chunkStart, chunkEnd));
    if (
      seen.has(normalizedTitle)
      || /chưa rõ|cập nhật/i.test(title)
      || chunk.length < 70
      || !/(Sie|Ihre|Ihr|gemeinsam|Überlegen|Planen)/.test(chunk)
    ) {
      return;
    }
    const notes = chunk
      .split("\n")
      .filter((line) => /^\s*[*-]\s*/.test(line))
      .map((line) => normalizeWhitespace(line.replace(/^\s*[*-]\s*/, "")))
      .filter(Boolean);
    const prompt = normalizeWhitespace(
      chunk
        .split("\n")
        .filter((line) => !/^\s*[*-]\s*/.test(line))
        .join("\n")
    );
    seen.add(normalizedTitle);
    topics.push({
      id: `planung-${topics.length + 1}`,
      title,
      prompt,
      notes
    });
  });
  return topics;
}

async function importLesen() {
  const [databaseText, wForm, maraForm, jakobForm, jakobSprachForm, nacoForm, nacoSprachForm] = await Promise.all([
    fs.readFile(LESEN_PATH, "utf8"),
    loadForm(SOURCES.wLesen),
    loadForm(SOURCES.maraLesen),
    loadForm(SOURCES.jakobLesen),
    loadForm(SOURCES.jakobSprach),
    loadForm(SOURCES.nacoLesen),
    loadForm(SOURCES.nacoSprach)
  ]);
  const database = JSON.parse(databaseText);
  const b1 = database.levels.b1;
  const maraTeil2 = b1.themes["mara-alt"].versions.default.lesen.parts["teil-2"];

  b1.themes["w-unbekannt"] = makeTheme("w-unbekannt", "W unbekannt · Neues Examen 1", {
    "teil-1": buildTeil1(wForm, "W unbekannt", SOURCES.wLesen, ANSWERS.w.teil1),
    "teil-2": buildTeil2(wForm, "W unbekannt", SOURCES.wLesen, ANSWERS.w.teil2),
    "teil-3": buildTeil3(wForm, "W unbekannt", SOURCES.wLesen, ANSWERS.w.teil3, W_ADS)
  }, ["teil-1", "teil-2", "teil-3"]);

  b1.themes["mara-alt"] = makeTheme("mara-alt", "Mara", {
    "teil-1": buildTeil1(maraForm, "Mara", SOURCES.maraLesen, ANSWERS.mara.teil1),
    "teil-2": maraTeil2,
    "teil-3": buildTeil3(maraForm, "Mara", SOURCES.maraLesen, ANSWERS.mara.teil3, MARA_ADS)
  }, ["teil-1", "teil-2", "teil-3"]);

  b1.themes["jakob-2-alt"] = makeTheme("jakob-2-alt", "Jakob 2", {
    "teil-1": buildTeil1(jakobForm, "Jakob 2", SOURCES.jakobLesen, ANSWERS.jakob.teil1),
    "teil-2": buildTeil2(jakobForm, "Jakob 2", SOURCES.jakobLesen, ANSWERS.jakob.teil2),
    "teil-3": buildTeil3(jakobForm, "Jakob 2", SOURCES.jakobLesen, ANSWERS.jakob.teil3),
    "sprachbausteine-1": buildSprach1(jakobSprachForm, "Jakob 2", SOURCES.jakobSprach, ANSWERS.jakob.sprach1),
    "sprachbausteine-2": buildSprach2(jakobSprachForm, "Jakob 2", SOURCES.jakobSprach, ANSWERS.jakob.sprach2)
  }, ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"]);

  b1.themes.naco = makeTheme("naco", "NACO", {
    "teil-1": buildTeil1(nacoForm, "NACO", SOURCES.nacoLesen, ANSWERS.naco.teil1),
    "teil-2": buildTeil2(nacoForm, "NACO", SOURCES.nacoLesen, ANSWERS.naco.teil2),
    "teil-3": buildTeil3(nacoForm, "NACO", SOURCES.nacoLesen, ANSWERS.naco.teil3),
    "sprachbausteine-1": buildSprach1(nacoSprachForm, "NACO", SOURCES.nacoSprach, ANSWERS.naco.sprach1, NACO_SPRACH_1),
    "sprachbausteine-2": buildSprach2(nacoSprachForm, "NACO", SOURCES.nacoSprach, ANSWERS.naco.sprach2, NACO_SPRACH_2)
  }, ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"]);

  b1.themeOrder = [
    ...b1.themeOrder.filter((key) => !["w-unbekannt", "mara-alt", "jakob-2-alt", "naco"].includes(key)),
    "w-unbekannt",
    "mara-alt",
    "jakob-2-alt",
    "naco"
  ];
  await fs.writeFile(LESEN_PATH, `${JSON.stringify(database, null, 2)}\n`);
}

async function importMundlich() {
  const [discussionText, planningText] = await Promise.all([
    loadText(SOURCES.sprechenTeil2Text),
    loadText(SOURCES.sprechenTeil3Text)
  ]);
  const database = {
    generatedAt: IMPORTED_AT,
    levels: {
      b1: {
        title: "TELC B1 Mündliche Prüfung",
        sourceUrl: SOURCES.catalog,
        partOrder: ["teil-1", "teil-2", "teil-3"],
        parts: {
          "teil-1": {
            title: "Einander kennenlernen",
            shortTitle: "Vorstellen",
            durationMinutes: 3,
            sourceUrl: SOURCES.sprechenTeil1,
            instruction: "Stellen Sie sich vor und stellen Sie Ihrer Gesprächspartnerin oder Ihrem Gesprächspartner passende Rückfragen.",
            prompts: [
              "Name und Alter",
              "Herkunft",
              "Wohnsituation: Wohnung, Haus oder Garten",
              "Familie und persönliche Situation",
              "Schule, Ausbildung und Lernweg",
              "Beruf oder aktuelle Tätigkeit",
              "Sprachen: welche, wie lange und warum",
              "Hobbys und Freizeit",
              "Erfahrungen im Ausland"
            ],
            followUps: [
              "Warum lernen Sie Deutsch?",
              "Wie sieht ein typischer Tag bei Ihnen aus?",
              "Was machen Sie am Wochenende?",
              "Welche Sprache möchten Sie noch lernen?",
              "Wo möchten Sie in fünf Jahren leben?",
              "Was gefällt Ihnen an Ihrem Wohnort?",
              "Welche Reise ist Ihnen besonders in Erinnerung geblieben?",
              "Was ist Ihnen bei der Arbeit wichtig?"
            ]
          },
          "teil-2": {
            title: "Über ein Thema sprechen",
            shortTitle: "Diskutieren",
            durationMinutes: 6,
            sourceUrl: SOURCES.sprechenTeil2,
            instruction: "Lesen Sie beide Positionen. Geben Sie die Aussagen mit eigenen Worten wieder, äußern Sie Ihre Meinung und reagieren Sie auf Ihr Gegenüber.",
            topics: parseDiscussionTopics(discussionText)
          },
          "teil-3": {
            title: "Gemeinsam etwas planen",
            shortTitle: "Planen",
            durationMinutes: 6,
            sourceUrl: SOURCES.sprechenTeil3,
            instruction: "Machen Sie Vorschläge, reagieren Sie auf Ideen und einigen Sie sich am Ende auf einen konkreten Plan.",
            topics: parsePlanningTopics(planningText)
          }
        }
      }
    }
  };
  await fs.writeFile(MUNDLICH_PATH, `${JSON.stringify(database, null, 2)}\n`);
}

await Promise.all([importLesen(), importMundlich()]);
console.log("Imported the missing B1 reading sets and speaking catalog.");
