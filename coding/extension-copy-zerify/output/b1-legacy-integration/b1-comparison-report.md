# B1 old-to-current comparison and merge — 2026-10-11

Compared the 88 entries in the public telc.site B1 catalogue, representing 85 reading/grammar exercises and 39 listening groups: **124 groups in total**.

- **121** groups are already represented in B1. Existing corrections, text and options were retained, including differences from the old source.
- **1** is already in B2: old **JAKOB2 / Liebe Lara**, source `284`, resolves to **Keine Zeit → default → Sprachbausteine 1**. Its current level was preserved; it was not duplicated in B1.
- **2** were not found in the current B1 content and have now been added as partial versions.
- **167** existing B1 locations received scoped alternative names through **171** source-to-target mappings. Several current locations can legitimately share the same old name.

| Added exercise | Destination | Available parts |
|---|---|---|
| WIR SIND FÜR SIE DA! | Vera → `telc-b1-265` | Sprachbausteine 2 only |
| DIE PERFEKTE BEWERBUNG | Thomas / Anna → `telc-b1-267` | Sprachbausteine 2 only |

The original 26 B1 Themen, their 35 versions, default choices, original content, answers and corrections are unchanged. There are now 37 B1 versions and 152 parts. All B2 data and every other existing database file were preserved. No listening content was duplicated. The fetched old B1 catalogue contains no writing or speaking category, so no writing/speaking import was inferred.

The two added texts retain their original word banks and keys. **WIR SIND FÜR SIE DA!** reuses DREI and AUCH for different gaps. **DIE PERFEKTE BEWERBUNG** reuses WENN and BEI, and its answer GERNE is absent from its word bank. These keys cannot be used by the standard one-word-once format. Practice is available; grading stays disabled until actual corrections make the native keys usable. No answer or option was invented. The separate review status remains unverified.

`Found; current content preserved` includes wording, advertisement, option and source-key differences. A related source is not used to overwrite a corrected current exercise. For example, old source 202 has Iris's situations with a different advertisement set; the existing Iris exercise was retained.

Exact backups are in `output/b1-legacy-integration/merge-backup/` and `before/`. Raw old quiz snapshots are in `source/`. The reviewed plan is `scripts/data/b1-legacy-plan.json`. Running the merger again adds nothing and writes nothing.

## Every old group and its current location

| Old source | Old name | Part | Result | Current location(s) |
|---|---|---|---|---|
| [204](https://telc.site/quiz/204) | PETRA/JENNIFER | teil-1 | Found | `lesen.json#/levels/b1/themes/petra/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/jennifer/versions/default/lesen/parts/teil-1` |
| [206](https://telc.site/quiz/206) | EVA/IRIS | teil-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/eva/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/iris/versions/default/lesen/parts/teil-1` |
| [215](https://telc.site/quiz/215) | SOPHIE/ANDREAS2 | teil-1 | Found | `lesen.json#/levels/b1/themes/sophie/versions/default/lesen/parts/teil-1` |
| [219](https://telc.site/quiz/219) | NADJA/CLAUDIA | teil-1 | Found | `lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/andreas/versions/version-2/lesen/parts/teil-1` |
| [221](https://telc.site/quiz/221) | NICOLE | teil-1 | Found | `lesen.json#/levels/b1/themes/nicole/versions/default/lesen/parts/teil-1` |
| [223](https://telc.site/quiz/223) | ANDREAS | teil-1 | Found | `lesen.json#/levels/b1/themes/andreas/versions/version-1/lesen/parts/teil-1` |
| [226](https://telc.site/quiz/226) | ANNIKA1 | teil-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/annika/versions/version-1/lesen/parts/teil-1` |
| [227](https://telc.site/quiz/227) | ANNIKA2/SONJA CORINA | teil-1 | Found | `lesen.json#/levels/b1/themes/sonja/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/corina/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/annika/versions/version-2/lesen/parts/teil-1` |
| [228](https://telc.site/quiz/228) | CAROLINA/ALICIA | teil-1 | Found | `lesen.json#/levels/b1/themes/caroline/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/caroline/versions/version-1/lesen/parts/teil-1` |
| [230](https://telc.site/quiz/230) | VERA | teil-1 | Found | `lesen.json#/levels/b1/themes/vera/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/teil-1` |
| [232](https://telc.site/quiz/232) | THOMAS | teil-1 | Found | `lesen.json#/levels/b1/themes/thomas-anna/versions/default/lesen/parts/teil-1` |
| [234](https://telc.site/quiz/234) | TAMARA/JAKOB PAUL | teil-1 | Found | `lesen.json#/levels/b1/themes/paul/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/tamara-jakob/versions/default/lesen/parts/teil-1` |
| [235](https://telc.site/quiz/235) | JAN | teil-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/vera/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/teil-1` |
| [237](https://telc.site/quiz/237) | VIKTOR | teil-1 | Found | `lesen.json#/levels/b1/themes/viktor/versions/default/lesen/parts/teil-1` |
| [240](https://telc.site/quiz/240) | ALEX & CORA | teil-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/alex-und-cora/versions/default/lesen/parts/teil-1` |
| [242](https://telc.site/quiz/242) | RITA | teil-1 | Found | `lesen.json#/levels/b1/themes/rita/versions/default/lesen/parts/teil-1` |
| [244](https://telc.site/quiz/244) | MIROSLAV | teil-1 | Found | `lesen.json#/levels/b1/themes/miroslav/versions/default/lesen/parts/teil-1`<br>`lesen.json#/levels/b1/themes/mara-alt/versions/default/lesen/parts/teil-1` |
| [246](https://telc.site/quiz/246) | KARLA | teil-1 | Found | `lesen.json#/levels/b1/themes/karla/versions/default/lesen/parts/teil-1` |
| [247](https://telc.site/quiz/247) | MORITZ | teil-1 | Found | `lesen.json#/levels/b1/themes/moritz/versions/default/lesen/parts/teil-1` |
| [205](https://telc.site/quiz/205) | Petra & ALICIA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/petra/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/alicia/versions/default/lesen/parts/teil-2` |
| [207](https://telc.site/quiz/207) | EVA1 | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/eva/versions/default/lesen/parts/teil-2` |
| [208](https://telc.site/quiz/208) | IRIS | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/iris/versions/default/lesen/parts/teil-2` |
| [216](https://telc.site/quiz/216) | SOPHIE | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/sophie/versions/default/lesen/parts/teil-2` |
| [220](https://telc.site/quiz/220) | NADJA & CLAUDIA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/teil-2` |
| [222](https://telc.site/quiz/222) | NICOLE | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/nicole/versions/default/lesen/parts/teil-2` |
| [224](https://telc.site/quiz/224) | ANDREAS | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/andreas/versions/version-1/lesen/parts/teil-2` |
| [225](https://telc.site/quiz/225) | ANDREAS2 & CORINA ANNIKA(1&2) | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/corina/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/andreas/versions/version-2/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/annika/versions/version-1/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/annika/versions/version-2/lesen/parts/teil-2` |
| [229](https://telc.site/quiz/229) | CAROLINA/VERA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/caroline/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/vera/versions/default/lesen/parts/teil-2` |
| [231](https://telc.site/quiz/231) | JENNIFER & TAMARA JAKOB/PAUL | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/paul/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/tamara-jakob/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/jennifer/versions/default/lesen/parts/teil-2` |
| [233](https://telc.site/quiz/233) | THOMAS | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/thomas-anna/versions/default/lesen/parts/teil-2` |
| [236](https://telc.site/quiz/236) | JAN | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/teil-2` |
| [238](https://telc.site/quiz/238) | VIKTOR | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/viktor/versions/default/lesen/parts/teil-2` |
| [239](https://telc.site/quiz/239) | SONJA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/sonja/versions/default/lesen/parts/teil-2` |
| [241](https://telc.site/quiz/241) | ALEX & CORA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/alex-und-cora/versions/default/lesen/parts/teil-2` |
| [243](https://telc.site/quiz/243) | RITA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/rita/versions/default/lesen/parts/teil-2` |
| [245](https://telc.site/quiz/245) | MIROSLAV & KARLA | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/miroslav/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/miroslav/versions/version-2/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/karla/versions/default/lesen/parts/teil-2` |
| [248](https://telc.site/quiz/248) | MORITZ | teil-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/moritz/versions/default/lesen/parts/teil-2` |
| [249](https://telc.site/quiz/249) | MARA | teil-2 | Found | `lesen.json#/levels/b1/themes/karla/versions/version-1/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/mara-alt/versions/default/lesen/parts/teil-2`<br>`lesen.json#/levels/b1/themes/mara-alt/versions/version-1/lesen/parts/teil-2` |
| [201](https://telc.site/quiz/201) | Petra | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/petra/versions/default/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/alicia/versions/default/lesen/parts/teil-3` |
| [203](https://telc.site/quiz/203) | EVA1 | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/eva/versions/default/lesen/parts/teil-3` |
| [202](https://telc.site/quiz/202) | IRIS | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/iris/versions/default/lesen/parts/teil-3` |
| [217](https://telc.site/quiz/217) | SOPHIE | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/sophie/versions/default/lesen/parts/teil-3` |
| [218](https://telc.site/quiz/218) | NADJA & CLAUDIA | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/moritz/versions/default/lesen/parts/teil-3` |
| [286](https://telc.site/quiz/286) | ANDREAS1 | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/andreas/versions/version-1/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/annika/versions/version-1/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/annika/versions/version-2/lesen/parts/teil-3` |
| [287](https://telc.site/quiz/287) | ANDREAS2 | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/andreas/versions/version-2/lesen/parts/teil-3` |
| [288](https://telc.site/quiz/288) | CAROLINA | teil-3 | Found; current content preserved | `lesen.json#/levels/b1/themes/caroline/versions/default/lesen/parts/teil-3`<br>`lesen.json#/levels/b1/themes/caroline/versions/version-2/lesen/parts/teil-3` |
| [209](https://telc.site/quiz/209) | PETRA/NADJA2 CLAUDIA | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/petra/versions/default/lesen/parts/sprachbausteine-1` |
| [211](https://telc.site/quiz/211) | EVA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/eva/versions/default/lesen/parts/sprachbausteine-1` |
| [213](https://telc.site/quiz/213) | IRIS | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/iris/versions/default/lesen/parts/sprachbausteine-1` |
| [250](https://telc.site/quiz/250) | SOPHIE | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/sophie/versions/default/lesen/parts/sprachbausteine-1` |
| [251](https://telc.site/quiz/251) | NICOLE | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/nicole/versions/default/lesen/parts/sprachbausteine-1` |
| [254](https://telc.site/quiz/254) | ANDREAS | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/andreas/versions/version-1/lesen/parts/sprachbausteine-1` |
| [257](https://telc.site/quiz/257) | ANDREAS2/VIKTOR SONJA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/sonja/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/viktor/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/andreas/versions/version-2/lesen/parts/sprachbausteine-1` |
| [259](https://telc.site/quiz/259) | ANNIKA1 | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/annika/versions/version-1/lesen/parts/sprachbausteine-1` |
| [261](https://telc.site/quiz/261) | ANNIKA2/JAN CORINA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/corina/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/annika/versions/version-2/lesen/parts/sprachbausteine-1` |
| [262](https://telc.site/quiz/262) | CAROLINA/RITA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/caroline/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/alicia/versions/default/lesen/parts/sprachbausteine-1` |
| [264](https://telc.site/quiz/264) | VERA/PAUL | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/vera/versions/default/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/paul/versions/default/lesen/parts/sprachbausteine-1` |
| [266](https://telc.site/quiz/266) | THOMAS/ANNA | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/thomas-anna/versions/default/lesen/parts/sprachbausteine-1` |
| [268](https://telc.site/quiz/268) | JENNIFER | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/jennifer/versions/default/lesen/parts/sprachbausteine-1` |
| [269](https://telc.site/quiz/269) | TAMARA/JAKOB | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/tamara-jakob/versions/default/lesen/parts/sprachbausteine-1` |
| [273](https://telc.site/quiz/273) | ALEX & CORA | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/alex-und-cora/versions/default/lesen/parts/sprachbausteine-1` |
| [278](https://telc.site/quiz/278) | MIROSLAV | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/miroslav/versions/default/lesen/parts/sprachbausteine-1` |
| [280](https://telc.site/quiz/280) | KARLA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/karla/versions/default/lesen/parts/sprachbausteine-1` |
| [282](https://telc.site/quiz/282) | MORITZ | sprachbausteine-1 | Found | `lesen.json#/levels/b1/themes/moritz/versions/default/lesen/parts/sprachbausteine-1` |
| [283](https://telc.site/quiz/283) | ALICIA | sprachbausteine-1 | Found; current content preserved | `lesen.json#/levels/b1/themes/caroline/versions/version-3/lesen/parts/sprachbausteine-1`<br>`lesen.json#/levels/b1/themes/alicia/versions/version-1/lesen/parts/sprachbausteine-1` |
| [284](https://telc.site/quiz/284) | JAKOB2 | sprachbausteine-1 | Found outside B1 | `lesen.json#/levels/b2/themes/keine-zeit/versions/default/lesen/parts/sprachbausteine-1` |
| [210](https://telc.site/quiz/210) | PETRA/ALICIA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/petra/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/alicia/versions/default/lesen/parts/sprachbausteine-2` |
| [212](https://telc.site/quiz/212) | EVA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/eva/versions/default/lesen/parts/sprachbausteine-2` |
| [214](https://telc.site/quiz/214) | IRIS | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/iris/versions/default/lesen/parts/sprachbausteine-2` |
| [253](https://telc.site/quiz/253) | SOPHIE | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/sophie/versions/default/lesen/parts/sprachbausteine-2` |
| [252](https://telc.site/quiz/252) | NICOLE | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/nicole/versions/default/lesen/parts/sprachbausteine-2` |
| [255](https://telc.site/quiz/255) | NADJA/CLAUDIA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/paul/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/sprachbausteine-2` |
| [256](https://telc.site/quiz/256) | ANDREAS | sprachbausteine-2 | Found | `lesen.json#/levels/b1/themes/andreas/versions/version-1/lesen/parts/sprachbausteine-2` |
| [258](https://telc.site/quiz/258) | ANDREAS2/JAN | sprachbausteine-2 | Found | `lesen.json#/levels/b1/themes/jan/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/andreas/versions/version-2/lesen/parts/sprachbausteine-2` |
| [260](https://telc.site/quiz/260) | ANNIKA1&2 | sprachbausteine-2 | Found | `lesen.json#/levels/b1/themes/annika/versions/version-1/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/annika/versions/version-2/lesen/parts/sprachbausteine-2` |
| [263](https://telc.site/quiz/263) | CAROLINA/CORINA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/caroline/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/corina/versions/default/lesen/parts/sprachbausteine-2` |
| [265](https://telc.site/quiz/265) | VERA | sprachbausteine-2 | Added partial version | `lesen.json#/levels/b1/themes/vera/versions/telc-b1-265/lesen/parts/sprachbausteine-2` |
| [267](https://telc.site/quiz/267) | THOMAS/ANNA JENNIFER | sprachbausteine-2 | Added partial version | `lesen.json#/levels/b1/themes/thomas-anna/versions/telc-b1-267/lesen/parts/sprachbausteine-2` |
| [270](https://telc.site/quiz/270) | TAMARA/JAKOB SONJA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/sonja/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/tamara-jakob/versions/default/lesen/parts/sprachbausteine-2` |
| [272](https://telc.site/quiz/272) | VIKTOR | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/viktor/versions/default/lesen/parts/sprachbausteine-2` |
| [274](https://telc.site/quiz/274) | ALEX & CORA | sprachbausteine-2 | Found | `lesen.json#/levels/b1/themes/alex-und-cora/versions/default/lesen/parts/sprachbausteine-2` |
| [276](https://telc.site/quiz/276) | PAUL | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/paul/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/nadja-claudia/versions/default/lesen/parts/sprachbausteine-2` |
| [277](https://telc.site/quiz/277) | RITA | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/rita/versions/default/lesen/parts/sprachbausteine-2` |
| [279](https://telc.site/quiz/279) | MIROSLAV | sprachbausteine-2 | Found; current content preserved | `lesen.json#/levels/b1/themes/miroslav/versions/default/lesen/parts/sprachbausteine-2` |
| [281](https://telc.site/quiz/281) | KARLA/MORITZ | sprachbausteine-2 | Found | `lesen.json#/levels/b1/themes/karla/versions/default/lesen/parts/sprachbausteine-2`<br>`lesen.json#/levels/b1/themes/moritz/versions/default/lesen/parts/sprachbausteine-2` |
| [271#q1-5](https://telc.site/quiz/271) | Arbeitsplatz für ihren Vater | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-1]` |
| [271#q6-10](https://telc.site/quiz/271) | Einkaufe im Internet | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-2]` |
| [271#q11-15](https://telc.site/quiz/271) | Computer | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-3]` |
| [271#q16-20](https://telc.site/quiz/271) | Einzelkind | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-4]`<br>`horen-audio.json#/levels/b1/themes/caroline-und-nora/hören/parts/teil-1/content/topics[id=b1-audio-caroline-und-nora-teil-1]`<br>`horen-audio.json#/levels/b1/themes/nadia/hören/parts/teil-1/content/topics[id=b1-audio-nadia-teil-1]` |
| [271#q21-25](https://telc.site/quiz/271) | Sport als für Kultur | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-5]` |
| [271#q26-30](https://telc.site/quiz/271) | Bus zur Arbeit | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-6]` |
| [271#q31-35](https://telc.site/quiz/271) | Arbeit zu fahren | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-7]` |
| [271#q36-40](https://telc.site/quiz/271) | In der Schule | teil-1 | Found; current content preserved | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-8]` |
| [271#q41-45](https://telc.site/quiz/271) | Bus zur Arbeit 2 | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-9]` |
| [271#q46-50](https://telc.site/quiz/271) | Urlaub | teil-1 | Found; current content preserved | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-10]` |
| [271#q51-55](https://telc.site/quiz/271) | Fremdsprache | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-11]`<br>`horen-audio.json#/levels/b1/themes/jan/hören/parts/teil-1/content/topics[id=b1-audio-jan-teil-1]`<br>`horen-audio.json#/levels/b1/themes/moritz/hören/parts/teil-1/content/topics[id=b1-audio-moritz-teil-1]` |
| [271#q56-60](https://telc.site/quiz/271) | Handys | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-12]` |
| [271#q61-65](https://telc.site/quiz/271) | Radfahrad | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-13]` |
| [271#q66-70](https://telc.site/quiz/271) | Miroslav | teil-1 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=b1-teil-1-quiz-14]`<br>`horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-1/content/topics[id=topic-1788979138170-21j8]` |
| [285#q1-10](https://telc.site/quiz/285) | VEREIN | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-1]` |
| [285#q11-20](https://telc.site/quiz/285) | Reisebüro | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-2]` |
| [285#q21-30](https://telc.site/quiz/285) | Buch schreiben | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-3]` |
| [285#q31-40](https://telc.site/quiz/285) | Klassenfahrt | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-4]` |
| [285#q41-50](https://telc.site/quiz/285) | Frau Reiter - Lokführerin | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-5]` |
| [285#q51-60](https://telc.site/quiz/285) | Deutschkurs | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-6]` |
| [285#q61-70](https://telc.site/quiz/285) | Spielpark | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-7]` |
| [285#q71-80](https://telc.site/quiz/285) | TAXIFAHRER | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-8]` |
| [285#q81-90](https://telc.site/quiz/285) | Praktikanten | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-9]` |
| [285#q91-100](https://telc.site/quiz/285) | Die Spitex | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-10]` |
| [285#q101-110](https://telc.site/quiz/285) | Filmbühne | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-11]` |
| [285#q111-120](https://telc.site/quiz/285) | Frau Wenger | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=b1-teil-2-quiz-12]` |
| [285#q121-130](https://telc.site/quiz/285) | Frau Wallner | teil-2 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-2/content/topics[id=topic-1788983294781-1y4w]`<br>`horen-audio.json#/levels/b1/themes/caroline-und-nora/hören/parts/teil-2/content/topics[id=b1-audio-caroline-und-nora-teil-2]` |
| [275#q1-5](https://telc.site/quiz/275) | Georg und Claudia | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-1]`<br>`horen-audio.json#/levels/b1/themes/alicia-und-petra/hören/parts/teil-3/content/topics[id=b1-audio-alicia-und-petra-teil-3]` |
| [275#q6-10](https://telc.site/quiz/275) | Ingolstadt | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-2]` |
| [275#q11-15](https://telc.site/quiz/275) | Der Fahrer | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-3]` |
| [275#q16-20](https://telc.site/quiz/275) | Innenstadt | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-4]` |
| [275#q21-25](https://telc.site/quiz/275) | Prag | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-5]` |
| [275#q26-30](https://telc.site/quiz/275) | Hauptbahnhof | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-6]` |
| [275#q31-35](https://telc.site/quiz/275) | Griechenland | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-7]` |
| [275#q36-40](https://telc.site/quiz/275) | Norddeutschland | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-8]` |
| [275#q41-45](https://telc.site/quiz/275) | Füssen | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-9]` |
| [275#q46-50](https://telc.site/quiz/275) | Mannheim | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-10]` |
| [275#q51-55](https://telc.site/quiz/275) | Buchabteilung | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-11]` |
| [275#q56-60](https://telc.site/quiz/275) | Meissner | teil-3 | Found | `horen-codes.json#/levels/b1/themes/horen-b1/hören/parts/teil-3/content/topics[id=b1-teil-3-quiz-12]` |
