# Zertify Exam Extractor

Extracts Zertify exam content into JSON and downloads it to a `db/` folder in your default downloads directory.

## Setup

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the `extension/` folder.
4. (Optional) If you want to extract from local `file://` HTML, enable "Allow access to file URLs" for this extension.

## Usage

1. Open a Zertify exam page (e.g. Lesen Teil 1, Lesen Teil 2, Lesen Teil 3, Sprachbausteine 1, Sprachbausteine 2).
2. Click the extension icon.
3. Click "Extract current exam".

The file downloads to a structured path like:

`db/b2/lesen/sport-ist-gesund-version-1/teil-1.json`

## JSON shape

Each JSON file contains:

- `meta`: title, level, part label, section, part number, source URL, extracted timestamp.
- `content`: structured data for the current part.

## Supported parts

- Lesen Teil 1: texts + headlines
- Lesen Teil 2: passage + multiple-choice questions
- Lesen Teil 3: situations + ads
- Sprachbausteine 1: blanks with per-blank options
- Sprachbausteine 2: blanks + word bank
