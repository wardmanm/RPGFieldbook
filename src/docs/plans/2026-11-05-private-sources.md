# Private Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player installs and updates packs from a private GitHub repo with a read-only token, an
owner cuts numbered releases with the data kit, and RPGFieldbookPrivate becomes the first such
source.

**Architecture:** A new source kind, `github`, beside `official` and `manifest` in
`src/js/89-extensions.js`. It reads everything through `api.github.com` (tags, then the
`releases/data/` manifest and pack files at the picked tag, through the contents API), with the token
in an `Authorization` header that is only ever sent to that host. Everything after the manifest is
#102's pipeline, unchanged. On the owner's side, `fbdata.py` gains a `release` command and a kit
version stamp; `data-release.js` writes `releases/data/` for a private registry too.

**Tech Stack:** plain browser JS (concatenated fragments, no modules), Python 3.8+ stdlib
(`tools/data-kit/fbdata.py`), Node (`scripts/data-release.js`), the Node test harness
(`src/tests/harness.js`).

**Spec:** [src/docs/specs/2026-11-05-private-sources-design.md](../specs/2026-11-05-private-sources-design.md)
(#182). Read §5 and §8 before any task.

**Branch:** `issue/182-private-sources` in `.claude/worktrees/182`. Commit `src/`, `scripts/`,
`tools/`, `docs/`, `build.sh`, `README.md`, `CLAUDE.md` and `.claude/skills/` only, never
`dist/fieldbook.html`. Tests: `./build.sh --no-zip && PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`
from the worktree (`data-kit` shows fewer checks in a worktree; that is expected).

## Global Constraints

- The token is sent only as `Authorization: Bearer <token>`, only to URLs starting
  `https://api.github.com/`. It never appears in a URL, an error string, a toast, the console, the
  Settings file export, or the DOM after entry, except its last four characters on the source row.
- API requests carry `Accept: application/vnd.github.raw+json` for file reads and
  `X-GitHub-Api-Version: 2022-11-28` on every call.
- The source link format is exactly `https://github.com/<owner>/<repo>#token=<token>` (spec §5.1).
- Release tags are `data-vX.Y.Z-N`; a player gets the newest whose `X.Y.Z` ≤ `APP_VERSION`
  (`cmpDataVer`), never one built for a newer app.
- #102's caps and timeouts hold: `EXT_MAN_MAX` (64 KiB), `EXT_FILE_MAX` (32 MiB), `EXT_CHECK_MS`,
  `EXT_FILE_MS`; every pack is sha256-checked by the existing pipeline.
- Old saves load: a `github` source entry's fields are optional and defaulted; a Settings file from
  before this change imports unchanged.
- Storage failures say so: every `saveSettings()` result is shown, as `addSource()` does now.
- Row and error wording is spec §5.6's, word for word.
- No private pack text in any public file; the guide names no real private content.

## Review Focus

1. **A token copied with spaces or a trailing newline** (pasted from a chat app) works: the link and
   the token are trimmed. → test in Task 2.
2. **Pasting the source link again for a repo already in the list** replaces that source's token
   ("Token updated.") instead of refusing it or adding a duplicate; this is how an imported source
   gets its token back (spec §5.6). → test in Task 4.
3. **The same repo in different letter case** (`Owner/Repo` and `owner/repo`) is one source: GitHub
   names are case-insensitive. → test in Task 4.
4. **A repo with more than 100 tags**: the newest usable `data-v` tag is found across pages, not just
   the first page. → test in Task 3.
5. **Offline at boot with a private source**: nothing is fetched and the row shows no error, as for
   manifest sources. → test in Task 3.

---

### Task 1: Prove a real token reads a private repo from `file://` (needs Mike)

The one step the spike couldn't prove (spec §7, §8). It needs a fine-grained token, which only the
GitHub website makes, so Mike makes one. It blocks nothing below; run it alongside Task 2 and finish
it before the branch merges.

**Files:** none committed. A scratch probe page in the session scratchpad.

- [ ] **Step 1:** With Mike's yes, create a throwaway private repo, `gh repo create
  wardmanm/fieldbook-token-probe --private`, holding one file `releases/data/fieldbook-data.json`
  (a valid format-2 manifest with no packs), committed and tagged `data-v1.9.0-1`, pushed.
- [ ] **Step 2:** Mike makes a fine-grained token on github.com: resource owner wardmanm, only
  `fieldbook-token-probe`, Contents read-only, expiry 1 day. He pastes it into the session.
- [ ] **Step 3:** In the project Playwright MCP, on any `file://` page, `fetch` with the token:
  `GET https://api.github.com/repos/wardmanm/fieldbook-token-probe/tags?per_page=100` and
  `GET …/contents/releases/data/fieldbook-data.json?ref=data-v1.9.0-1` (raw Accept).
  Expected: both 200; the second's body is the manifest's text. Then the same with the token's last
  character changed. Expected: 401, readable.
- [ ] **Step 4:** Record the result as a line in spec §8's table. Mike deletes the token; with his
  yes, `gh repo delete wardmanm/fieldbook-token-probe --yes`.
- [ ] **Step 5:** Commit the spec line: `docs(#182): the real-token probe`.

If Step 3 fails, stop the plan and tell Mike: the read route in spec decision 6 is wrong.

### Task 2: The `github` source's building blocks

**Files:**
- Modify: `src/js/89-extensions.js` (beside `extUrl()`/`extRelPath()`; `extFetchBytes()`;
  `convertSources()`)
- Test: `src/tests/data-archive.js` (new section `#182 building blocks`, above the
  `add new sections above this line` marker; add each new name to the `loadApp([...])` list)

**Interfaces:**
- Produces:
  - `extGithubLink(text) -> {repo:"owner/name", token:string} | null`: accepts a source link, a bare
    `https://github.com/<o>/<r>` (optional trailing `/` or `.git`) and a bare `<o>/<r>`; trims;
    owner `[A-Za-z0-9-]{1,39}`, repo `[A-Za-z0-9._-]{1,100}`, token `[A-Za-z0-9_]{20,255}` or
    absent; anything else → `null`. `repo` keeps the case it was given.
  - `extGhApi(repo, path, query) -> string`: `https://api.github.com/repos/<repo>/<path>` plus
    `?query` when given; `path` segments pass `extRelPath()` or the call returns `""`.
  - `extGhHeaders(src, raw) -> object`: `X-GitHub-Api-Version`, `Accept` (raw or
    `application/vnd.github+json`), and `Authorization: Bearer <token>` only when `src.token`.
  - `extGhPickTag(names, appVer) -> string`: the newest `data-vX.Y.Z-N` name (by `cmpDataVer` on
    `X.Y.Z-N`) whose base is ≤ `appVer`; `""` when none. Plain `vX.Y.Z` tags are ignored.
  - `extFetchBytes(url, ms, cap, headers)`: the new optional 4th argument is passed to `fetch` as
    `headers`. If `headers` has an `Authorization` key and `url` doesn't start with
    `https://api.github.com/`, it rejects with `Error("refused to send a token to another host")`
    before any fetch.
  - `convertSources(s)` keeps `kind:"github"` entries whose `repo` passes `extGithubLink`, filling
    `token:""`, `tag:""`, `checked:0`, `error:""`, `manifest:null`, `base:""`, `on:true` when absent.

- [ ] **Step 1: Write the failing tests**
  - `extGithubLink("https://github.com/Ann/homebrew#token=github_pat_ABCDEFGHIJKLMNOPQRST1234")`
    → `{repo:"Ann/homebrew", token:"github_pat_ABCDEFGHIJKLMNOPQRST1234"}`.
  - The same string with leading spaces and a trailing `"\n"` → the same result (Review Focus 1).
  - `"https://github.com/ann/homebrew.git/"`, `"ann/homebrew"` → `token:""`.
  - `null` for `"https://gitlab.com/ann/homebrew"`, `"https://github.com/ann"`, `"ann/home brew"`,
    `"https://github.com/ann/homebrew#token=short"`, `"https://example.com/m.json"`.
  - `extGhPickTag(["v1.9.0","data-v1.8.1-1","data-v1.9.0-2","data-v1.9.0-10","data-v1.9.1-1","junk"],"1.9.0")`
    → `"data-v1.9.0-10"`; with `"1.8.5"` → `"data-v1.8.1-1"`; `[]` → `""`.
  - `extGhHeaders({token:"t".repeat(30)},true).Authorization === "Bearer "+"t".repeat(30)`;
    `extGhHeaders({token:""},true)` has no `Authorization`.
  - `extFetchBytes("https://raw.githubusercontent.com/x/y/z", 1000, 10, {Authorization:"Bearer x"})`
    rejects with `/refused to send a token/`, and the stubbed `fetch` was never called.
  - `convertSources({sources:[{kind:"github",repo:"ann/homebrew"},{kind:"github",repo:"bad repo"}]})`
    keeps one github entry with `token:""` and drops the bad one.
- [ ] **Step 2:** `node src/tests/data-archive.js` → the new checks FAIL (names undefined).
- [ ] **Step 3:** Implement the five functions and the two changes above in `89-extensions.js`.
- [ ] **Step 4:** `node src/tests/data-archive.js` → ALL PASSED.
- [ ] **Step 5:** Commit `feat(#182): the github source's link, headers, tag picking and host guard`.

### Task 3: Checking a `github` source, and installing from it

**Files:**
- Modify: `src/js/89-extensions.js` (`checkSource()`, `checkSources()`, `offerCandidate()`)
- Test: `src/tests/data-archive.js` (section `#182 checking and installing`). Extend the stub: a
  route value may be `{status, body, headers}` and the stub records each call's `url` and `headers`
  in an array the tests read.

**Interfaces:**
- Consumes: Task 2's `extGhApi`, `extGhHeaders`, `extGhPickTag`, `extFetchBytes(…, headers)`.
- Produces:
  - `checkSource(src)` handles `kind:"github"`: tags (pages of 100, at most 10 pages, stopping at a
    short page), `extGhPickTag`, then the manifest at that tag through
    `extGhApi(repo,"contents/releases/data/fieldbook-data.json","ref="+encodeURIComponent(tag))`.
    Sets `src.tag`, `src.manifest`, `src.base=""`, `src.checked`, and `src.note`/`src.error` per the
    table below. A failed check keeps the last good manifest (#102).
  - `checkSources()` includes enabled `github` sources; offline it still fetches nothing.
  - `offerCandidate(o)` for a `github` source: `get()` reads
    `extGhApi(repo,"contents/releases/data/"+entry.path,"ref="+tag)` with `extGhHeaders(src,true)`.
  - New field `src.note` (string, default `""`): a non-error line for the row.

  | Case | Result |
  |---|---|
  | tags 401 | `error`: "The repo refused this token. It may have expired or been deleted: ask the repo's owner for a new one." |
  | tags 404, token set | `error`: "This token can't see the repo. Check the address, or ask the owner for a new token." |
  | tags 404, no token | `error`: "No public repo at this address. If it's private, add its token." |
  | 403 with response header `x-ratelimit-remaining: 0` | `error`: "GitHub's limit for this hour is used up. It will check again later." |
  | no usable tag | `manifest:null`, `error:""`, `note`: "no release for this Fieldbook yet" |
  | manifest 404 after tags answered | `manifest:null`, `error:""`, `note`: "The newest release here (`<tag>`) has no pack list for Fieldbook. The owner needs to cut a release with the data kit." |
  | source with `token:""` that was imported as private (`src.needsToken`) | no fetch; `error`: "Needs its token: paste the source link again." |

  `extFetchBytes` must expose the response's status (it does, `e.status`) and, for the 403 case, the
  rate-limit header: add `e.rateLimited=true` when `r.headers.get("x-ratelimit-remaining")==="0"`.

- [ ] **Step 1: Write the failing tests**
  - A private source `{kind:"github",repo:"ann/hb",token:T}` with tags
    `[{name:"data-v1.9.0-1"},{name:"data-v1.9.0-2"}]` and a manifest at `data-v1.9.0-2`:
    after `checkSource`, `src.tag==="data-v1.9.0-2"`, one pack, `error===""`; every recorded call's
    URL starts `https://api.github.com/` and carries `Authorization: "Bearer "+T`; no recorded URL
    contains `T`.
  - Each table row above: its exact string, and the last good manifest kept where one existed.
  - 150 tags over two pages, the newest usable on page 2 → picked (Review Focus 4).
  - `navigator.onLine=false`, `checkSources({boot:true})` with a github source → zero fetches and
    `src.error===""` (Review Focus 5).
  - `offerCandidate` for the private source: `get()` fetches
    `…/contents/releases/data/hb_full.json?ref=data-v1.9.0-2` with the token header; a full
    `runInstall` of that candidate installs the pack and sets `packOrigin` to the source's id.
  - No check's `error` or `note` contains the token (loop over every case).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → ALL PASSED, and the `#102` sections still pass.
- [ ] **Step 5:** Commit `feat(#182): check and install from a github source`.

### Task 4: Adding a `github` source, its row, and Change token

**Files:**
- Modify: `src/js/89-extensions.js` (`addSource()`, `extSourceName()`, `extSourcesHTML()`,
  `wireExtPage()`; new `openChangeToken()`), the Extensions CSS fragment if the row needs it
- Test: `src/tests/data-archive.js` (section `#182 adding and the row`)

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces:
  - `addSource(text)`: when `extGithubLink(text)` matches, a temp `github` source is checked
    (`checkSource`). It is added when the tag list answered (any 200), refused otherwise with the
    check's `error` as `why`. When a source for the same repo (case-insensitive) exists: a token in
    `text` replaces its token, re-checks, and answers `{ok:true, why:"Token updated."}`; no token
    answers `{ok:false, why:"That source is already in the list."}`. Anything else goes to the
    existing URL path unchanged.
  - The URL box (`#extAddUrl`): after any attempt with a link that carried a token, its value
    becomes `https://github.com/<repo>`, so the token never stays on screen.
  - `extSourceName(s)` for github → `s.repo`.
  - The row: name `owner/repo`; sub-line `private · token ending …<last 4> · <checked or error>`
    (or `public repo · …` with no token); `note` shown in the sub-line when set; buttons
    **Change token** (`data-ext-src-token="<id>"`) and **Remove**.
  - `openChangeToken(id)`: a dialog in `openExtDetails()`'s pattern (closes back to Settings →
    Extensions) with one `type="password"` input taking a token or a source link for the same repo;
    Save stores it, saves settings (showing a save failure), re-checks, re-renders. A link for a
    different repo is refused: "That link is for another repo."
- Placeholder of `#extAddUrl` becomes `https://…/fieldbook-data.json, or a GitHub source link`.

- [ ] **Step 1: Write the failing tests**
  - `addSource(link)` against a stub answering tags → one github source with that token; the
    saved `settings.sources` has it.
  - Again with a second token for `ANN/HB` → still one source, its token the second, why
    `"Token updated."` (Review Focus 2 and 3).
  - `addSource("ann/hb")` when present, no token → `"That source is already in the list."`.
  - Tags 401 → not added, `why` is Task 3's 401 string.
  - `extSourcesHTML()` for a source with token `T` contains `ann/hb` and `…`+`T.slice(-4)`, and
    does not contain `T`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → ALL PASSED.
- [ ] **Step 5: Drive it.** `./build.sh --no-zip`; in the project Playwright MCP, open
  `dist/fieldbook.html`, stub `window.fetch` for `api.github.com` with a tags list and a manifest,
  then: paste a source link, see the row; Change token; paste a bad link. Screenshots of the
  Extensions page with the row, and the Change token dialog, in both skins, light and dark, at 1280
  and 390 wide, into `.claude/qa/in-progress/182-private-sources/`.
- [ ] **Step 6:** Commit `feat(#182): add a github source, its row, and Change token`.

### Task 5: The token stays on the device through export and import

**Files:**
- Modify: `src/js/88-settings.js` (the `btnExportSettings` handler; `finishSettingsImport()`),
  `src/js/89-extensions.js` (two helpers)
- Test: `src/tests/data-archive.js` (section `#182 export and import`)

**Interfaces:**
- Produces:
  - `extSettingsForExport(s) -> object`: a deep copy of `s` whose `github` sources have
    `token:""` and `needsToken:true` when they had a token. The export writes
    `{_type:"fieldbook-settings", settings:extSettingsForExport(settings), rules}`.
  - `extKeepTokens(incoming, current)`: before `finishSettingsImport()` assigns, each incoming
    `github` source with no token takes the token of a current source for the same repo
    (case-insensitive) and loses `needsToken`.
- Installed packs stay in the export (spec decision 13): `rules` is unchanged.

- [ ] **Step 1: Write the failing tests**
  - Export with a private source: the JSON contains no token, has `needsToken:true`, and `rules`
    is present.
  - Import that file on a device that has the same repo with a token → the token is kept.
  - Import it on a device without it → the source arrives with `needsToken:true`; `checkSource`
    makes no fetch and sets Task 3's "Needs its token" error.
  - A Settings file from before this change (no `github` entries) imports exactly as before.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → ALL PASSED.
- [ ] **Step 5:** Commit `feat(#182): a source's token never leaves the device in a settings file`.

### Task 6: The data kit's version stamp and `release` command

**Files:**
- Modify: `tools/data-kit/fbdata.py`, `build.sh` (`pack_kit()`), `tools/data-kit/README.md`
- Test: `src/tests/data-kit.py`

**Interfaces:**
- Produces:
  - `kit_version() -> str`: `app_version()` when it answers, else the first line of
    `fieldbook-version.txt` beside `fbdata.py`, else `""`. `pack_kit()` writes that file into the
    kit zip (`$VER`, without any `+dev`/tag suffix) and adds it to the `want` list.
  - `release-files` gains `--any-licence`: skips the `--public` validation, still runs plain
    `validate` on the folder.
  - `fbdata.py release [--registry R --data-root D] [-o releases/data] [--allow-unchanged]
    [--dry-run]`: version `V = kit_version()` (exit 2, "this kit doesn't know its Fieldbook
    version" when `""`); next = `V-1` when the registry's `release` is empty, older than `V`, or
    equals `V`; `V-(N+1)` when it is `V-N`; refuses a `release` newer than `V`. Changed packs
    (`changed_packs`) are bumped as `versions --bump` does; with none, it exits 1 "nothing to
    release" unless `--allow-unchanged`, which moves only `release`. Then bundles into a temp folder
    and runs `release-files --any-licence` into `-o`. Prints, and never runs:
    `git add data/packs.json releases/data`, `git commit -m "Data release <next>"`,
    `git tag -a data-v<next> -m "Data <next>"`, `git push && git push origin data-v<next>`.
    `--dry-run` prints the plan and writes nothing.

- [ ] **Step 1: Write the failing tests** (in a temp folder with no `.git`, a registry with one
  pack, `fieldbook-version.txt` = `1.9.0`, the kit copied in):
  first run → `release` `1.9.0-1`, pack version `1.9.0-1`, `releases/data/fieldbook-data.json`
  lists it, and the printed lines include `data-v1.9.0-1`; second run with no change → exit 1
  "nothing to release"; with `--allow-unchanged` → `1.9.0-2`, pack still `1.9.0-1`; a pack edit
  then the stamp at `1.9.1` → `1.9.1-1`; a registry `release` of `1.9.2-1` → refused; no `.git`
  appears; a pack licensed `All rights reserved` releases without a licence error; the kit zip from
  `./build.sh` contains `fieldbook-version.txt` holding `APP_VERSION`.
- [ ] **Step 2:** `python3 src/tests/data-kit.py` → FAIL. **Step 3:** Implement.
  **Step 4:** → ALL PASSED, and `./build.sh` (with zips) still passes its kit allowlist.
- [ ] **Step 5:** Commit `feat(#182): fbdata.py release and the kit's version stamp`.

### Task 7: `/release private` writes `releases/data/`, and can release nothing changed

**Files:**
- Modify: `scripts/data-release.js`, `.claude/skills/release/SKILL.md`, `src/docs/RELEASING.md`
- Test: `src/tests/data-kit.py` (the existing scratch-repo release script checks)

**Interfaces:**
- Produces:
  - For a private registry, `data-release.js` bundles into a temp folder and runs
    `release-files --any-licence` into `<private repo>/releases/data`, and its printed `git add`
    line names `releases/data` too.
  - `--allow-unchanged`: with no changed pack, releases anyway, moving only the registry's
    `release`; without it, "nothing to release" as now. `--dry-run` says which.
  - The release skill: §1's private row also applies when the newest private tag has no
    `releases/data/` (`git -C _private-data ls-tree <tag> releases/data` is empty); §4 then runs
    with `--allow-unchanged`. Gates 1 and 2 unchanged.

- [ ] **Step 1: Write the failing tests:** a scratch private registry with no change and
  `--allow-unchanged` → its `release` moves, `releases/data/` exists in the scratch repo with the
  manifest, and the printed lines include `releases/data`; without the flag → exit 1 "nothing to
  release".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → ALL PASSED.
- [ ] **Step 5:** Commit `feat(#182): private data releases write releases/data`.

### Task 8: The owner's guide

**Files:**
- Create: `docs/private-sources.md`
- Modify: `build.sh` (the app zip's `docStrays` regex; `pack_kit()` copy list and `want` list),
  `README.md` (section 9, what the zip holds), `CLAUDE.md` ("exactly three files" → four, in "Where
  to edit what"), `src/tests/docs.js` (the shipped-docs list at line ~117)

- [ ] **Step 1: Write the failing test** in `docs.js`: `docs/private-sources.md` exists, is in the
  shipped list, names `#token=`, "Contents", "Read-only", "Only select repositories", `release`,
  `data-v`, and names no real private pack (none of `XPHB`, `Xanathar`, `Tasha`, `Humblewood`).
- [ ] **Step 2:** `node src/tests/docs.js` → FAIL.
- [ ] **Step 3:** Write the guide, spec §5.9's eight parts in order, for an owner who knows GitHub.
  Its minimal repo: `data/packs.json` with one pack entry, `data/my-homebrew/…`. Step 7 says plainly
  that deleting a token stops updates, not the copy a player already has (decision 13).
- [ ] **Step 4:** `./build.sh && node src/tests/docs.js` → ALL PASSED; the zip allowlist passes.
- [ ] **Step 5:** Commit `docs(#182): the private sources guide ships with the app`.

### Task 9: Docs, ledger and the player note

**Files:** `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/wiki/features/settings-and-updates.md`,
`src/docs/wiki/architecture/storage.md`, `src/docs/wiki/data/data-kit.md`,
`src/docs/wiki/architecture/data-archive.md`, `src/docs/wiki/data/private-data.md`,
`src/docs/wiki/process/building-and-ci.md`, `src/docs/wiki/decisions.md`, `src/docs/UNRELEASED.md`,
the spec's "As built" section.

- [ ] **Step 1:** Append the ledger entry (what, why, the rulings made while building), then each
  page rewritten to the new truth with a History line citing it (the `wiki` skill's procedure).
- [ ] **Step 2:** One `UNRELEASED.md` bullet, plain text: Extensions can install from a private
  GitHub repo with a token the repo's owner sends; the guide in the app's docs shows owners how.
- [ ] **Step 3:** `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh` → all 11 suites pass.
- [ ] **Step 4:** Commit `docs(#182): the wiki, ledger and release note`.

## After the plan

The first private release with `releases/data/` (`/release private`, `--allow-unchanged`,
`1.9.0-2`) is Mike's to cut after merge, and then the real install on his devices, each with its own
token, is his QA pass.
