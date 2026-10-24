# hello-freeswitch Documentation Structure Audit (2026-10-19)

> Scope: The first half of this report records the pre-closure structure audit baseline; the trailing "Closure Execution Record" updates the disposition, evidence, and acceptance results for A/B/C. It does not evaluate the technical accuracy of the documentation.

> The line counts, directory mappings, and conclusions in the first half are the pre-execution baseline; the current state of navigation and body text should be taken from the trailing execution record and the current files.

## Quantitative Facts

### Top-Level Topic Directories in `docs/`

Counts the Markdown files directly contained by each top-level topic directory (not counting subdirectories); total line counts are based on the original file lines; excludes `.vitepress/`, `public/` resources, and generated artifacts. Root-level pages are listed separately.

| Top-level directory | `.md` count | Total lines |
|---|---:|---:|
| `advanced/` | 4 | 866 |
| `appendix/` | 3 | 504 |
| `concepts/` | 6 | 721 |
| `configuration/` | 4 | 412 |
| `installation/` | 3 | 242 |
| `introduction/` | 3 | 205 |
| `modules/` | 6 | 1,272 |
| `project/` | 5 | 1,278 |
| **Top-level topic directory subtotal** | **34** | **5,500** |
| Root-level pages (including `SUMMARY.md`) | 4 | 635 |
| **Content Markdown total** | **38** | **6,135** |

The 4 root-level pages are `docs/index.md` (25 lines), `docs/knowledge.md` (214 lines), `docs/glossary.md` (357 lines), and `docs/SUMMARY.md` (39 lines).

### Current Organization Mechanisms (3 sets)

| Organization mechanism | Number of entries | Naming/organization pattern | Has numbering | Numbering continuity |
|---|---:|---|---|---|
| Physical topic directories | 8 top-level topic directories, 34 pages | `introduction`, `installation`, `configuration`, `concepts`, `modules`, `advanced`, `project`, `appendix`, mostly lowercase English directories; pages mostly use lowercase kebab-case | No | N/A; zero numeric prefixes on all Markdown filenames |
| Root-level role pages | 3 reader-facing pages: `index`, `knowledge`, `glossary` (plus 1 migration TOC `SUMMARY`) | Named by purpose rather than topic, carrying the homepage, knowledge overview, and glossary index; sits alongside topic pages at the `docs/` root | No | N/A |
| Navigation/TOC mapping | 2: VitePress `sidebar.json`, mdBook legacy `SUMMARY.md` | Both express the chapter hierarchy; `config.mts` imports the sidebar, and explicitly excludes `SUMMARY.md` from the build | No | N/A |

Configuration evidence: `docs/.vitepress/config.mts:27-28` notes that `SUMMARY.md` is an mdBook legacy mapping draft that does not participate in the build; `docs/.vitepress/config.mts:56-58` notes that the current sidebar is provided by `sidebar.json`. The navigation cross-check shows both navigations cover the main topics, but the root-level "Knowledge Overview" and "Glossary" only appear in the VitePress sidebar (beginning of `docs/.vitepress/sidebar.json`; `docs/SUMMARY.md:3-6` does not list them).

### Sidebar Reconciliation and Link Verification

| Check item | Count | Result |
|---|---:|---|
| Sidebar config links | 36 | `docs/.vitepress/sidebar.json` contains 36 unique links |
| Configured but target file does not exist | 0 | None |
| Page exists but not in sidebar | 1 | `docs/index.md`; served by the sidebar's "Home" `/` route, a normal exception |
| Missing local Markdown link targets | 0 | Scanned local links across 38 Markdown files, no missing targets found |
| Build | Passed | `npm run docs:build` succeeded after `npm ci`, VitePress 1.6.4; no link warnings in build output |

The actual sidebar entries are in `docs/.vitepress/sidebar.json`; the sidebar config entry point is at `docs/.vitepress/config.mts:56-58`. `docs/index.md` not being a separate sidebar item is not an orphan page; the homepage is covered by the navigation `/` entry in `docs/.vitepress/config.mts:49-53`. Both the build and local link scan have been verified; there are no "unverified" dead-link items. External URL availability was not verified online one by one.

## Issue List and Judgment

| # | Issue/evidence | Severity | Judgment |
|---|---|---|---|
| 1 | Configuration files are scattered across topics: `docs/configuration/config-files.md:1-5` is the configuration structure overview, `docs/configuration/core-files.md` continues with core files, and `docs/appendix/configuration-files.md:1-5` again walks through files one by one against the vanilla template; `docs/concepts/static-dialplan.md:117-120` also backlinks to these places. | Medium | This is a multi-layer "overview—configuration details—reference manual" expansion of the same configuration topic, partially overlapping and cross-directory; readers may be unclear about the lookup entry point. But the three pages' responsibilities are not entirely identical, so the same topic alone does not justify declaring them duplicates; boundaries should be drawn during a deep refactor. |
| 2 | Navigation is maintained in duplicate: `docs/.vitepress/sidebar.json` and `docs/SUMMARY.md:1-39` both store the chapter tree; `docs/.vitepress/config.mts:27-28` excludes SUMMARY, and `config.mts:56-58` loads the sidebar from JSON. The former also includes the knowledge overview and glossary; the latter's appendix entry text/target page is also not entirely the same (SUMMARY line 37 points to `appendix/configuration-files.md`). | Medium | Current mappings have no missing files and the build is normal, but future changes must sync both TOCs, creating a gradual drift risk. SUMMARY is explicitly marked as a migration draft, so it is not an online navigation fault; we should confirm whether it still needs to be retained as source data. |
| 3 | Naming conventions have a few exceptions: directories/regular pages are usually lowercase kebab-case (e.g. `docs/project/asr-tts.md`), each topic's homepage uses uppercase `README.md` (e.g. `docs/modules/README.md`), and at root there are also `README.md` and `README.zh.md`; plus the underscore-uppercase `docs/SUMMARY.md`. Evidence: the 38-file listing from `find docs -name '*.md'`. | Low | `README.md` is the VitePress default directory page convention, reasonable to keep; the bilingual repo README also has a clear purpose. The current inconsistency is mainly that formatting rules were never written down, and it does not constitute a user-visible fault. |
| 4 | Numbered chapter check: extracting numeric filename prefixes from all content Markdown under `docs/` (digits followed by `-`, `_`, space, or dot) yielded 0; therefore there are no numbering gaps, skips, or duplicates. | No issue (no remediation needed) | The repo has no numbered chapter system; numbering continuity should not be treated as a current mess, and adding numbers for "cosmetic tidiness" is not recommended. |
| 5 | Organization-axis category check: no independent parallel directories named `api/`, `history/`, or `guides/`; history content is only `docs/introduction/history.md`, and programming interfaces live at `docs/advanced/scripting.md`. | No issue (no remediation needed) | These are section topics/page names, not additional directory axes; topic attribution is reasonable. |
| 6 | Root directory and temp files: Markdown at the repo root is `README.md`, `README.zh.md`; the four pages at the `docs/` root are already listed in the stats table above; no `.tmp`, `*~`, or `.bak` temp files found. The two root READMEs are the default/Chinese entry points respectively, not duplicate copies. | No issue (no remediation needed) | No root-directory stray Markdown or temp docs needing cleanup. |

### Topic Aggregation Observations

- The configuration topic spans a reference chain across `configuration/`, `appendix/`, and `concepts/`: see Issue 1, with evidence at `docs/configuration/config-files.md:1-5`, `docs/appendix/configuration-files.md:1-5`, `docs/concepts/static-dialplan.md:117-120`.
- The dialplan itself aggregates well: the overview, static, and dynamic pages are all in `docs/concepts/`, cross-linking each other (`docs/concepts/dialplan.md:80-88`, `docs/concepts/static-dialplan.md:107-120`, `docs/concepts/dynamic-dialplan.md:180-182`). SIP as a module topic is concentrated in `docs/modules/sip.md`, with the concept page mentioning it only from a protocol/concept angle. Do not misjudge normal cross-topic references as directory chaos.

## Judgment and Recommendations

Currently there are **3 organization mechanisms**: physical topic directories, root-level role pages, and parallel navigation mappings. The content classification readers actually rely on is only one set (8 topic directories); the root-level homepage/glossary/overview are useful horizontal entry points, and the navigation mapping is a maintenance-layer duplicate expression.

Recommend finally converging to **1 primary classification + 1 authoritative navigation data source**: use the existing topic directories/chapters as the only content classification, with the VitePress sidebar as the only published navigation; the homepage, overview, and glossary can continue serving as cross-topic entry points, with no need to force-move things to chase directory purity. `SUMMARY.md` can be archived/deleted if there is no mdBook export or migration reuse need; whether to keep it needs a user decision. For the configuration topic, first clarify the "configuration overview/core files/per-file reference" division of labor to avoid losing details in a mechanical merge.

### Actually Not Messy, No Need to Change

- The 8 topic directories are overall divided by reader task/knowledge domain, with easily understood boundaries; the aggregation of the three dialplan pages in `concepts/` is especially clear.
- `README.md` as each topic directory's index fits VitePress default routing conventions; should not be renamed arbitrarily for the sake of lowercase uniformity.
- `docs/index.md` is served via the `/` homepage route; even though it is not a separate sidebar item, it is not a missing page.
- The root `README.md` and `README.zh.md` are intentional bilingual docs, not duplicate READMEs.
- No numbered chapters, so no broken/duplicate numbering; no independent API/history parallel directories; the current sidebar targets are complete, local links resolve, and the build succeeds.

## Three-Phase Closure Plan

| Phase | Action list | Impact scope | Risk (links/search/external links) | User decision |
|---|---|---|---|---|
| Phase 1: Mechanical cleanup (target within 1 hour) | Document directory/file naming rules in the documentation contribution conventions (topic directories in lowercase English, regular pages in kebab-case, keep directory homepages as `README.md`); preserve the README Chinese/English correspondence; line-by-line calibrate the sidebar-to-SUMMARY title/entry mapping and mark SUMMARY as a migration draft. If no new convention file is added, it can be recorded only in the maintenance notes. | File naming conventions, two TOC metadata sets; no body text moved. | Low; not changing routes or file paths does not affect in-site links, search, or external links. | Naming conventions can be executed without a decision; if SUMMARY is to be modified or deleted, defer to Phase 2 and decide. |
| Phase 2: Navigation and redirects | Decide and implement a single navigation source; if SUMMARY is kept, generate the sidebar from it; if mdBook is no longer supported, stop maintaining/archive SUMMARY; add VitePress redirects/compat pages as needed for renames or page moves, and rerun the build and link check. | `docs/.vitepress/sidebar.json`, `config.mts`, `docs/SUMMARY.md`, possibly new redirect rules. | Medium; navigation text changes affect discovery paths, path changes may affect historical search results and external links; must preserve old-URL redirects. | **User decision required**: whether SUMMARY still serves mdBook/migration, which file is the authoritative navigation, and whether navigation label adjustments are acceptable. |
| Phase 3: Deep chapter refactor | Deduplicate the three configuration topic pages section by section and define the overview/configuration details/lookup-table responsibilities; if content is genuinely duplicated, then merge paragraphs or sections; sync all backlinks, glossary-related pages, and navigation. | `configuration/`, `appendix/`, possibly `concepts/` references and URLs. | Medium to high; page merges/renames affect in-site links, search index, bookmarks, and external references; redirects must be preserved and re-verified. | **User decision required**: boundaries for technical content deletion/merging, which URLs to keep, and whether to change the current chapter positioning. |

## Three Things to Do First

1. First select the authoritative navigation source, and clarify whether `SUMMARY.md` continues serving mdBook or is only kept as a migration archive; eliminate the uncertainty of dual maintenance.
2. Clarify the division of labor among the three configuration file pages (`configuration/config-files`, `configuration/core-files`, `appendix/configuration-files`); set boundaries before considering merging.
3. Lock in light naming rules and keep the existing stable routes; no renaming or numbering in the first round, since there are currently no dead links or numbering issues.

## Verification Record

- `npm ci`: succeeded, installed dependencies from the lock file; `package.json` and the lock file were not modified.
- `npm run docs:build`: succeeded, VitePress 1.6.4 completed client/server builds, page rendering, and sitemap generation.
- Local Markdown link check: 0 broken targets; sidebar: 36 links, 0 missing targets; pages not in sidebar: only the homepage `docs/index.md`.
- `git status` was clean before this audit report was created; build artifacts live in the ignored directory `docs/.vitepress/dist/` and are not committed.

## Closure Execution Record (2026-10-19)

### A: Single Source of Truth for Navigation

- The authoritative source is set to VitePress's `docs/.vitepress/sidebar.json`; the maintenance rule is written into `docs/SUMMARY.md:1-5`, keeping the file but changing the hand-written TOC into an explanation page pointing to the source of truth. VitePress exclusion rules and the single-source-of-truth comment are at `docs/.vitepress/config.mts:27-28,56-57`.
- Duplicate routes within the same sidebar number **0** (36 links, 36 unique links); no entries need removal. Cross-sidebar reuse is not counted as duplication.

### B: Cross-Axis Content Per-Group Determination

| Group | Classification | Two-place text comparison evidence | Disposition |
|---|---|---|---|
| Configuration directory overview in `configuration/config-files.md` and `appendix/configuration-files.md` | **True duplicate, 1 group**: both places list the same set of directories—`freeswitch.xml`, `vars.xml`, `autoload_configs/`, `sip_profiles/`, `dialplan/`, `directory/`, etc.; the old appendix also duplicated the vanilla template file and TLS certificate directory descriptions. The pre-execution original text can be compared at `docs/appendix/configuration-files.md:7-24` in the parent commit; the authoritative page corresponds to `docs/configuration/config-files.md:7-49`. | The configuration structure page is the authoritative page for the full directory tree and load instructions; the appendix was changed to a "for directory tree, load relationships, and vanilla template descriptions, see [Configuration File Structure] uniformly" summary link, see `docs/appendix/configuration-files.md:7-9`. Both file and URL are preserved. |
| Configuration structure, core configuration files, and appendix per-file reference | **Different angles, keep 1 group**. Text evidence: structure page "understand configuration from the directory structure and load relationships" (`docs/configuration/config-files.md:5`); core page "dig into the three files you deal with most often" focusing on fields (`docs/configuration/core-files.md:3-5`); appendix "walk through files one by one against the vanilla config template" (`docs/appendix/configuration-files.md:3-5`). | Keep all three pages' original content and cross-link them, clarifying the three angles of structure/loading, key file operations, and per-file template lookup; do not force a merge. |

### C: Positioning and Actual State

- The English and Chinese READMEs now describe this as personal study notes, insights, and development experience sharing (`README.md:22`, `README.zh.md:16,22`); the homepage and site description are synchronized in positioning (`docs/index.md:6-7,17-23`, `docs/.vitepress/config.mts:8`).
- Removed the overview's inaccurate "35 pages" statistic, changed to "each note and appendix," see `docs/knowledge.md:3`. The pre-execution counts in the structure audit are kept only as a baseline.
- Removed the "Chapter N" numbering skeleton from body text, changed to page-name cross-references; examples at `docs/modules/README.md:3,118`, `docs/advanced/README.md:5,9,13`, `docs/project/README.md:1,3,104-107`, `docs/project/asr-tts.md:1,75,187`, `docs/project/nlp.md:1,26,161,219-220`, `docs/project/implementation.md:1,208,260,264,391`, `docs/project/deployment.md:1`, `docs/advanced/events.md:115,180,243`, `docs/advanced/scripting.md:20,138`, `docs/advanced/recording.md:73`, `docs/modules/sip.md:58,73,124`, `docs/glossary.md:233,241,315`, `docs/appendix/resources.md:25,30,33,77`.
- Sidebar config comments no longer claim mapping from the old SUMMARY, and no longer keep group numbers; see `docs/.vitepress/config.mts:56-57`. Cross-check found no dead sidebar items; the knowledge overview and glossary are listed in the sidebar, see `docs/.vitepress/sidebar.json:7-12`. The README does not list nonexistent directories.

### Acceptance

- `pnpm docs:build`: passed, VitePress 1.6.4 build completed.
- Local Markdown link scan: **521 links, 0 missing**; sidebar scan: **36 targets, 0 missing**; sidebar duplicate links: **0**.
- `git diff --diff-filter=D --name-only | wc -l`: **0** (Markdown deletion count is also 0).
- External URL availability for this check was not verified online one by one.
