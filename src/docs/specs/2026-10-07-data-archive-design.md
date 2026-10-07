# Data archive, per-pack versions and data-only releases — design

**Status:** proposed · 2026-10-07
**Issue:** #83, part 1 of #82 (Separate Data Archive). Parts 2 and 3 are #84 (the SRD 5.2 pack) and
#85 (the private split and the data kit), each with its own spec. All three ship in 1.8.0.
**Branch:** `issue/83-data-archive`

---

## 1. What it is

Rules data stops being five loose files tied to app releases.

- **One archive per release.** `fieldbook-data-standalone-<version>.zip` holds every pack, a
  manifest and a `NOTICE.md`. It is attached to each release and carried inside the app zip in place
  of the five loose packs.
- **Fieldbook opens it.** Any rules picker takes the zip, offline. So does the app zip, whose data
  archive it finds inside.
- **Each pack has its own version**, recorded in a new `data/packs.json`. A pack's version moves
  only when its content changes.
- **Data can be released without the app.** A data-only release (`data-v1.8.0-1`) publishes a new
  archive and never touches `fieldbook.html`. A running copy of Fieldbook notices it and says so
  quietly.
- **Packs carry their licence and credit**, shown in Settings → Credits & licences and in the
  archive's `NOTICE.md`.

Why: #82. The data has to be releasable on its own schedule, and in #85 most of it moves to a
private repo. That needs a container and a version scheme that don't assume the data and the app
ship together.

## 2. Decisions

Mike's, from planning on 2026-10-07:

| # | Question | Decision |
|---|---|---|
| 1 | Loading | **The app opens the zip itself**, offline, from any rules picker |
| 2 | Version granularity | **Per pack** inside the archive. The archive carries the release version |
| 3 | Version format | `X.Y.Z` = the data shipped with app X.Y.Z. `X.Y.Z-N` = the Nth data-only release after it |
| 4 | Finding out about new data | The update check also looks for the newest data release and shows a quiet notice. Data releases are **never "latest"** |
| 5 | What an app release attaches | `fieldbook.html`, the app zip (the archive inside it), the archive. The data kit joins in #85 |
| 6 | Freeze | **No releases** from this branch's merge until 1.8.0 is complete |

**Rulings this spec makes, for review:**

| # | Ruling | Why |
|---|---|---|
| R1 | **Building the zips needs `python3`.** `tools/data-kit/fbdata.py` is the only code that computes digests and writes archives. `./build.sh --no-zip` and the tests need nothing new | One implementation of the digest, not two that must agree. The kit is Python already, and in #85 the bundler becomes Python too |
| R2 | **A digest covers content, not formatting**: canonical JSON of every source file plus the pack's registry fields | Re-indenting a file must not tell every player to re-download |
| R3 | **Homebrew's licence and credit land here**, not in #84 | It is the mechanism's first real user, and the `NOTICE.md` this branch writes should not be empty. Its `_note` has never reached players |
| R4 | **Re-importing a pack replaces what that file loaded before**, for a JSON file as much as a zip. Entries the new copy no longer has are removed | Today a re-import only adds and replaces, so a removed entry lingers forever. A data update that renames something would leave both names |
| R5 | **A zip without a manifest still imports** if it holds `.json` files. Each one is treated as an imported file. One level of nesting is opened | Players zip their own packs. The app zip carries the archive one level down |
| R6 | **The app checks each entry's CRC-32, not the manifest's SHA-256** | CRC-32 catches a damaged download. Browsers have no synchronous SHA-256, and `crypto.subtle` is not reliably there on `file://`. `fbdata.py validate` checks the SHA-256 |
| R7 | **A newer data release is a quiet notice**: muted text on the row, one hint line above the list, "· update" on the Settings count. The amber "update available" chip stays for a pack older than this app's baseline | A data release is optional. A pack behind the app it is loaded in is not |
| R8 | **Data-release notes are generated** from `data/packs.json`: which packs changed, and to what version. There is no notebook for data releases | Data changes need no player note (CLAUDE.md). The list is what players act on |
| R9 | **If a data release ends up marked "latest", the workflow re-marks the newest app release and fails** | A data release marked latest hides app updates from every installed copy, v1.7.2 included. Repair first, then make it loud |
| R10 | **The freeze and the 2.0 purge are written down here**: a freeze banner in `RELEASING.md`, and a placeholder line in `wiki/roadmap/2.0.md` that #85 fills in | Decision 6, and the history decision from planning |

## 3. Versions

### 3.1 Format

A data version is `X.Y.Z` or `X.Y.Z-N`, with N ≥ 1 and no leading zeros. It is **not semver**: in
semver `-N` is a pre-release, which sorts below `X.Y.Z`. Here it sorts above:

```
1.7.2 < 1.8.0 < 1.8.0-1 < 1.8.0-2 < 1.8.0-10 < 1.8.1
```

`X.Y.Z` is the data shipped with app X.Y.Z. `X.Y.Z-N` is the Nth data-only release made while
X.Y.Z is the current app. The base, `X.Y.Z`, is the oldest app the data is built for.

A **local build with unreleased data** names its archive `<release>+dev` (§6.4). That suffix is
never a data version. It appears only in the file name and the manifest's `version` field.

### 3.2 Functions (`src/js/30-version.js`)

| Function | Returns |
|---|---|
| `parseDataVer(s)` | `[x,y,z,n]` (n = 0 without a suffix), or `null` for anything else, including a leading `v` |
| `cmpDataVer(a,b)` | −1 / 0 / 1. **0 if either is invalid**: unknown is never "stale" or "newer" |
| `dataVerOfTag(tag)` | `"v1.8.0"` → `"1.8.0"`; `"data-v1.8.0-2"` → `"1.8.0-2"`; anything else, `"data-v1.8.0"` included, → `""` |
| `dataVerBase(v)` | `"1.8.0-2"` → `"1.8.0"`; `"1.8.0"` → `"1.8.0"`; invalid → `""` |

`cmpVer()` is unchanged and still compares app versions. Its callers that compare **data**
versions switch to `cmpDataVer`:
- `dataStatus()`;
- the older-copy check in Import settings (`88-settings.js`, the `older` filter).

Today `cmpVer('1.8.0-1','1.8.0-2') === 0`, which is why this is needed.

### 3.3 Where versions live

- **`data/packs.json`** (§4) is the source of truth for each pack's version. Only
  `scripts/release.js` and `scripts/data-release.js` write it, both through `fbdata.py`. A build
  never writes it.
- **`DATA_VERSIONS`** in `30-version.js` stays as it is, a flat JSON object keyed by system. It
  becomes a **snapshot** that `release.js` takes from `packs.json` at each app release: the app's
  offline baseline, "what this build shipped with". A data release does not change it.
- **Each bundle's `dataVersion`** is its pack's `packs.json` version, stamped by the bundler.

The invariant, checked by the `docs` suite: every system in `DATA_VERSIONS` has a pack in
`packs.json`, and `cmpDataVer(pack.version, DATA_VERSIONS[system]) >= 0`.

## 4. The registry: `data/packs.json`

```json
{
  "_comment": "Written by scripts/release.js and scripts/data-release.js through tools/data-kit/fbdata.py. Never hand-edit version, digest or release.",
  "release": "1.7.2",
  "packs": [
    {"system": "XPHB", "dir": "5e2024", "file": "5e2024_full.json",
     "title": "D&D 2024 — Complete Rulebook", "version": "1.7.2", "digest": "sha256:…"},
    {"system": "Humblewood", "dir": "humblewood", "file": "humblewood_full.json",
     "title": "Humblewood — Complete Rulebook", "version": "1.7.1", "digest": "sha256:…"},
    {"system": "XGE", "dir": "xanathars", "file": "xanathars_full.json",
     "title": "Xanathar's Guide to Everything", "version": "1.7.2", "digest": "sha256:…"},
    {"system": "TCE", "dir": "tashas", "file": "tashas_full.json",
     "title": "Tasha's Cauldron of Everything", "version": "1.7.2", "digest": "sha256:…"},
    {"system": "Homebrew", "dir": "homebrew", "file": "homebrew_full.json",
     "title": "Homebrew", "version": "1.5.0", "digest": "sha256:…",
     "license": "CC-BY-SA-3.0",
     "attribution": "The Predator, a Warlock subclass by D&D Wiki contributors (https://www.dandwiki.com/wiki/The_Predator_(5e_Subclass)), used under CC BY-SA 3.0. Changed: converted to Fieldbook's rules format."}
  ]
}
```

- **`release`**: the version of the last release, app or data. It is the archive's version.
- **`title`** replaces the `name` column of `SYSTEMS` in `bundle-rules.js`. **`file`** replaces `out`.
- **`license`** (optional) is an SPDX id. **`attribution`** (optional) is plain text, with no
  markup and at most 2,000 characters. Both are documented in `docs/rules-schema.md` §1.
- **`version`** may be `null`: the pack is bundled without a `dataVersion` until its first release.
  #84 adds SRD 5.2 this way. Every pack in this spec has a version.

### 4.1 The digest (R2)

`sha256:` followed by the hex SHA-256 of one UTF-8 string:

```
canon({"meta": {system, title, license, attribution},     // absent keys omitted
       "files": {"<name>.json": <parsed JSON>, …}})       // every *.json directly in dir/
```

`canon` is `json.dumps(x, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. So:
- key order, whitespace and a final newline don't count;
- any change to a value does, and so does a change to the pack's title, licence or credit, since
  those reach the bundle.

**Seeding.** The initial digests are computed from the **v1.7.2** tree (`git archive v1.7.2 data`
into a scratch folder, then `fbdata.py versions --seed --data-root <it>`), not from today's. Data
that changed since v1.7.2 therefore still gets 1.8.0 when 1.8.0 is cut. Seeding runs **before**
Homebrew's `license` and `attribution` are added to the registry, so its seed matches v1.7.2. The
credit (R3) then changes its digest and it also moves to 1.8.0, which is right: its bundle now
carries the credit.

## 5. Scripts

### 5.1 `tools/data-kit/fbdata.py` (new; Python 3.8+, standard library only)

This branch builds the subcommands below. #85 adds `build`, `convert` and `bundle`.

| Command | Does |
|---|---|
| `digest [--registry F] [--data-root D]` | Prints each pack's computed digest beside its recorded one |
| `versions --changed` | Prints the systems whose computed digest differs from the recorded one. Exit 0 |
| `versions --check` | The same, but exits 1 if any differ. This is the "digests current" gate |
| `versions --bump V` | For each changed pack: `version = V`, `digest =` computed. Always sets `release = V`. Rewrites the file in the shape above (2-space indent, keys in the order shown, final newline). Prints the changed systems as JSON |
| `versions --seed --data-root D` | Sets every recorded digest from D's content. Versions are untouched. Used once, by hand |
| `pack <bundles-dir> -o OUT.zip [--registry F] [--dev]` | Writes the archive (§6) from the bundles the registry lists that exist in `bundles-dir` |
| `validate OUT.zip` | Checks an archive (§6.3). Exit 1 with one line per problem |

`--registry` defaults to `data/packs.json` and `--data-root` to `data/`, both relative to the repo
root.

Before any of these act on a bad registry, they refuse it with a message naming the field:
duplicate `system` or `file`, a `dir` that escapes `data-root`, a `file` that isn't
`[A-Za-z0-9._-]+\.json`, a `version` that `parseDataVer` would reject.

### 5.2 `scripts/bundle-rules.js` (changed)

- **Reads `data/packs.json`.** `SYSTEMS` and `dataVersions()` go.
- **For each pack:**
  - its folder's `system` must equal the registry's `system` (an error otherwise);
  - `name` = `title`;
  - `dataVersion` = `version`, omitted when `null`;
  - `license` and `attribution` are copied when present.
- **Unchanged:** a missing folder is skipped with a line saying so, and the merge, dedupe,
  `excludeSystems` and `requires` rules stay as they are.
- **Does not need Python.** It reads versions; it never computes digests.

### 5.3 `scripts/release.js` (changed)

After it works out `next` and **before it writes anything**, `release.js` runs
`fbdata.py versions --bump <next>`, which writes `data/packs.json`. If that fails, the release
stops with nothing written.

It then sets `DATA_VERSIONS` to `{system: version}` for every pack with a version, writes the
CHANGELOG entry and `APP_VERSION`, and empties the notebook.

What goes:
- the git-diff-since-last-tag logic;
- `SYSTEM_DIRS`;
- the "no previous tag" fallback.

Python is found the way `run.sh` finds it (`python3`, then `python`). Without it, the release
refuses: "cutting a release needs python3 (tools/data-kit/fbdata.py)".

### 5.4 `scripts/data-release.js` (new)

`node scripts/data-release.js [--dry-run]`. It is dev.sh menu `d`.

1. **Refuses if `data/` has uncommitted changes** (`git status --porcelain -- data`). Otherwise the
   digests it records would not match what gets committed.
2. **Works out the next version.** Let A = `APP_VERSION`.
   - If `release` is A, next is `A-1`.
   - If `release` is `A-k`, next is `A-(k+1)`.
   - Anything else refuses, naming both.
3. **Refuses if the tag `data-v<next>` already exists.**
4. **Refuses if no pack changed** (`versions --changed` is empty): "nothing to release — no pack's
   content differs from its last release."
5. **Runs `versions --bump <next>`.** With `--dry-run` it prints what it would do and stops before
   this step.
6. **Prints the commands, and never runs them:**
   ```
   git add data/packs.json
   git commit -m "Data release 1.8.0-1"
   git tag -a data-v1.8.0-1 -m "Fieldbook data 1.8.0-1"
   git push && git push origin data-v1.8.0-1
   ```

It never touches `30-version.js`, `fieldbook.html`, the notebook or the CHANGELOG.

### 5.5 `scripts/data-release-notes.js` (new)

`node scripts/data-release-notes.js <version> --app|--data` prints the markdown for a release body.
Both workflows use it, and it replaces the bash block in `release.yml` that diffed `data/` folders
between tags.

- **`--app`:** the "what to download" footer. Get `fieldbook.html`, and
  `fieldbook-data-standalone-<v>.zip` for the rules. Then which packs changed in this release (those
  whose `version` is `<v>`) and which didn't.
- **`--data`:** "Rules data `<v>`, for Fieldbook `<base>` and later." Then the changed packs and
  their new versions, how to import the zip, and that Fieldbook older than 1.8.0 can't open a zip,
  so unzip it and import the `.json` files.

## 6. The archive

### 6.1 Layout

```
fieldbook-data-standalone-1.8.0.zip
  fieldbook-data.json       the manifest
  NOTICE.md                 what's in it, and every licence and credit
  5e2024_full.json          the bundles, under the file names players already know
  humblewood_full.json
  …
```

The manifest:

```json
{"_type": "fieldbook-data", "format": 1, "version": "1.8.0", "builtFor": "1.8.0",
 "packs": [{"file": "5e2024_full.json", "system": "XPHB", "version": "1.8.0", "sha256": "…"},
           {"file": "homebrew_full.json", "system": "Homebrew", "version": "1.8.0",
            "license": "CC-BY-SA-3.0", "sha256": "…"}]}
```

- `version` is the registry's `release`, plus `+dev` for a dev build.
- `builtFor` is the `APP_VERSION` at build time.
- `sha256` is the hash of the bundle's bytes.
- **There are deliberately no top-level `name`, `system` or category keys.** Fieldbook 1.7.2, given
  the manifest as a loose JSON file, merges nothing rather than inventing a pack.

### 6.2 `NOTICE.md`

- a title with the version;
- one line on importing the zip;
- a list of the packs (title, file, system, version);
- a "Licences and credits" section, one paragraph per pack that has either field. A pack with
  neither is listed as "No licence statement."

It is generated by `fbdata.py pack` and never committed.

### 6.3 What `validate` checks

- The manifest exists at the root, has `_type: "fieldbook-data"` and `format: 1`, and its `version`
  parses (with `+dev` allowed).
- Every listed file exists, its SHA-256 matches, it parses as a JSON object, and its `system` and
  `dataVersion` match the manifest's.
- Nothing else is in the zip except `NOTICE.md`.
- There are no duplicate names, no directories, and no `..` or absolute paths.

### 6.4 Building it

- **Reproducible for a given zlib:** entries sorted by name, timestamp 1980-01-01 00:00, mode 0644,
  deflate level 9, no extra fields, no comment. Two `pack` runs on one machine produce the same
  bytes; the `data-kit` suite checks this.
- **Name:** `fieldbook-data-standalone-<release>.zip`. If `versions --check` fails (data changed
  since `release`), `build.sh` passes `--dev` and the name gets `+dev`, the same convention as the
  app zip.

## 7. `build.sh`

- **Plain build:** the existing steps through `--no-zip`'s early exit are unchanged, and **still need
  no Python**. Then:
  1. find Python. Without it, stop: "the zips need python3 (tools/data-kit/fbdata.py); use --no-zip
     for just the app";
  2. `fbdata.py pack dist -o dist/fieldbook-data-standalone-<rel>[+dev].zip`, then
     `fbdata.py validate` on it;
  3. the app zip as before, except `data/` holds **only that archive** instead of the five packs.
- **The app zip's allowlist guard** changes its `data/` rule to "exactly one entry, matching
  `data/fieldbook-data-standalone-[^/]+\.zip`".
- **The archive gets its own guard** from `validate`: anything not in the manifest fails the build
  and deletes the zip.
- **`./build.sh --data`** (new) validates `data/**/*.json`, bundles, then packs and validates the
  archive. It does not build or check `fieldbook.html`, regenerate `docs/CHANGELOG.md`, or build the
  app zip. The data-release workflow uses it.
- **`--release`** behaves as before, and gets the archive in the release version with no `+dev`,
  because `release.js` has just recorded the digests.
- `rm -f dist/*.zip` already clears old archives.

## 8. Workflows

### 8.1 `release.yml` (changed)

- **New guard after the `APP_VERSION` one:** `packs.json`'s `release` equals the tag version. A tag
  cut without `--release` fails here.
- **Notes:** `data-release-notes.js <v> --app`, replacing the bash block.
- **Assets:** `fieldbook.html`, `fieldbook-v<v>.zip`, `fieldbook-data-standalone-<v>.zip`. The
  "Check the assets exist" step lists these three.
- **Python:** the runner's own `python3`, with no setup action. The build step prints
  `python3 --version` first, so a runner change shows up in the log.

### 8.2 `data-release.yml` (new)

- **Triggers:** `push: tags: ["data-v[0-9]+.[0-9]+.[0-9]+-[0-9]+"]`, plus `workflow_dispatch` with a
  `tag` input, as in `release.yml`.
- **Steps, in order, each failing with an `::error::` that says what to do:**
  1. Resolve the tag. It must match `data-vX.Y.Z-N`.
  2. Check out the tag.
  3. Check `packs.json`'s `release` equals the tag version.
  4. Check the tag's base equals `APP_VERSION` at that commit. A data release is for the current
     app.
  5. Run `fbdata.py versions --check`, the "digests current" gate.
  6. Run `./src/tests/run.sh`.
  7. Run `./build.sh --data`.
  8. Run `fbdata.py validate` on the archive.
  9. Write the notes with `data-release-notes.js <v> --data`.
  10. Publish: `gh release create <tag> <archive> --title "Fieldbook data <v>" --notes-file …
      --latest=false`. If the release already exists, it is edited and re-uploaded with
      `--clobber`.
- **The latest check (R9):** after publishing, it reads `gh api repos/<repo>/releases/latest --jq
  .tag_name`. If that doesn't start with `v`, it:
  - runs `gh release edit <newest vX.Y.Z tag> --latest`;
  - prints an `::error::` naming what happened;
  - exits 1.

Data tags never match an app glob. GitHub's tag filters and `git tag -l 'v…'` are both anchored at
the start. Data tags are sorted only in code, with `cmpDataVer`, never with git's `v:refname`.

## 9. The app: opening a zip

### 9.1 `src/js/89-zip.js` (new pure fragment, before `89-rules-merge.js` in the manifest)

| Function | |
|---|---|
| `crc32(bytes)` | Uint32 CRC of a `Uint8Array` |
| `inflateRaw(bytes, size)` | RFC 1951 raw inflate: stored, fixed and dynamic blocks. Returns a `Uint8Array` of exactly `size` bytes, or throws `zipError("damaged")`. Never allocates past `size` |
| `isZipBytes(bytes)` | The first four bytes are `PK\3\4`, or `PK\5\6` for an empty zip |
| `zipEntries(bytes)` | Reads the central directory: `[{name, method, flags, crc, csize, usize, offset}]`. Names are decoded as UTF-8 |
| `zipEntryBytes(bytes, entry)` | Method 0 or 8 → bytes, checked against `usize` and `crc` |
| `readDataArchive(bytes, zipName)` | → `{kind, version, packs:[{name, bytes}]}` or throws a `zipError` |

`zipError(code, detail)` makes an `Error` with `.code`. Every refusal is one of these, and §9.3 maps
each to its message.

**Refused:**

| Code | When |
|---|---|
| `notzip` | No end-of-central-directory record in the last 64 KiB plus 22 bytes |
| `zip64` | A size, offset or count field is `0xFFFF`/`0xFFFFFFFF`, or a ZIP64 locator is present |
| `encrypted` | Flag bit 0 set, or method 99 |
| `method` | A method other than 0 or 8 |
| `damaged` | Out-of-range offsets, a bad local header, a size or CRC mismatch, or a bad deflate stream |
| `toolarge` | The zip is over 64 MiB, an entry read is over 32 MiB uncompressed, or the entries read total over 128 MiB |
| `toomany` | More than 1,000 entries |
| `kit` | It is the data kit (§9.2) |
| `empty` | No rules data in it |

**Ignored:** directories, anything under `__MACOSX/`, and names whose last part starts with `._`
or is `.DS_Store`.

### 9.2 What `readDataArchive` accepts, in order

1. **An archive** (`kind: "data"`): `fieldbook-data.json` at the root or inside one top-level
   folder (someone unzipped and re-zipped the folder).
   - The manifest must have `_type: "fieldbook-data"`.
   - Its `packs[].file` entries are read from the manifest's folder, in manifest order. A listed
     file that is missing is `damaged`.
   - Unlisted `.json` files are ignored.
   - `version` is the manifest's.
2. **The data kit** (`kind: "kit"`): an entry named `fbdata.py` at any depth, and no manifest.
   Refused with `kit`.
3. **Nested** (only at the top level): every inner `*.zip` entry is read as rule 1. All the archives
   found are imported, in name order. The app zip is this case, with
   `data/fieldbook-data-standalone-<v>.zip` inside. An inner zip that is not an archive is skipped.
4. **Loose** (`kind: "loose"`, R5): every `*.json` entry, in name order, by its base name.
5. Otherwise `empty`.

A leading UTF-8 BOM on a JSON entry is stripped, as it is for a JSON file.

### 9.3 Import (`src/js/89-rules-merge.js`)

**`importRulesPayloads(payloads)`** (new, pure: no DOM, no storage). `payloads` is
`[{name, bytes}]`, in the order the player picked them.

- **A payload starting with zip bytes** goes through `readDataArchive`, and each inner pack is
  imported under **its own file name**. The loaded-data list then shows `5e2024_full.json`, not the
  zip, so per-pack rows and version chips keep working. Importing the zip after importing the same
  packs loose replaces them.
- **Anything else** is decoded as UTF-8 (BOM stripped), parsed, and must be a JSON object.
- **Returns** `{packs, archives:[{name, version, count}], failed:[{name, why}], skipped}`.
  - `why` is the player-facing reason. The `zipError` messages:
    - `encrypted`: "it's password-protected".
    - `zip64`: "it's a ZIP64 archive".
    - `method`: "it uses a compression Fieldbook can't read; re-zip it normally or import the .json
      files".
    - `damaged`: "it's damaged — download it again".
    - `toolarge`: "it's too large to be rules data".
    - `toomany`: "it has too many files to be rules data".
    - `kit`: "that's the Fieldbook data kit, a tool for building rules data — import a
      fieldbook-data-standalone zip instead".
    - `empty`: "there's no rules data in it".
  - A bad JSON file: "not valid JSON" or "not a rules file".

**`importPack(obj, file)`** (new, R4). Every pack an import loads goes through it.

1. Note every pool entry with `_file === file` and `_source === srcLabel(obj)`.
2. `mergeRules(obj, file)`.
3. Drop the noted entries the merge did not replace.
4. Drop `rules.requires[label]` and `rules.credits[label]` if no other entry still carries that
   label, the same rule `applyFetchedSource()` uses.

Packs with the same file name but a different system are untouched: `spells.json` from Tasha's does
not unload `spells.json` from Xanathar's.

**`importRulesFiles(files)`** becomes a thin wrapper.

1. Read every file as an `ArrayBuffer`. A read error goes into `failed` as "couldn't be read".
2. Call `importRulesPayloads`.
3. `saveRulesCache()`, then refresh the UI.
4. Write one status line, to `#rulesStatus` **and** `#homeRulesStatus`, whichever exist. It names
   each archive and its version ("Imported fieldbook-data-standalone-1.8.0.zip: 5 packs, data
   1.8.0."), names each failure with its reason, and then gives the existing counts, missing and
   skipped summaries.
5. Wait for the cache save's promise, and **report a failed save on the same line**, as
   `fetchAllRules()` does. Today the error only reaches the red line above the list.

The home screen's 400 ms `setTimeout` that overwrites `#homeRulesStatus` with the bare count is
removed. It hid import failures on the home screen.

**The four rules pickers** take
`accept="application/json,.json,application/zip,.zip"`, and their help text mentions the zip:
- `#fileRules` (Settings);
- `#homeRulesFiles` (home);
- `#glossRulesFiles` and `#tablesRulesFiles` (Rules tab).

The character and settings pickers are unchanged.

## 10. The app: data versions and the notice

### 10.1 `dataStatus(g)`

`have` is `g.dataVersion`. `want` is `DATA_VERSIONS[g.source]`. `upd` is the entry of `dataUpdate`
(§10.2) with the same system and with `file === g.label`, for a group loaded from a file.

| State | When | Shown |
|---|---|---|
| `unknown` | No `have`, or no `want` and no `upd` | nothing (as today) |
| `stale` | `cmpDataVer(have, want) < 0` | the existing amber `update available · v<have>` chip |
| `update` | not stale, and `cmpDataVer(have, upd.version) < 0` | muted `v<have> · v<upd.version> out`, with a title naming the data release |
| `current` | otherwise | the existing muted `v<have>` |

### 10.2 `checkForDataUpdate()` (`30-version.js`, called after `checkForUpdate()` in `90-boot.js`)

1. **Skips** if `UPDATE_REPO` is empty or `navigator.onLine === false`.
2. **Fetches** `api.github.com/repos/<repo>/releases?per_page=100`.
3. **`pickDataRelease(list, APP_VERSION)`** (pure) chooses one. It skips:
   - drafts and pre-releases;
   - tags `dataVerOfTag` rejects;
   - releases whose base is newer than `APP_VERSION` (`cmpDataVer(base, APP_VERSION) > 0`). Data
     built for a newer app is announced by the app update instead;
   - releases without an asset named `fieldbook-data-standalone-<ver>.zip`.

   Of the rest, it takes the newest by `cmpDataVer` and returns `{tag, version, url}`. `url` is the
   release's `html_url` if that is on `https://github.com/`, otherwise the releases page.
4. **Fetches** `raw.githubusercontent.com/<repo>/<tag>/data/packs.json`.
5. **`dataUpdateFrom(registry, pick)`** (pure) keeps only well-formed packs: a string system, a
   `file` matching the registry rule, and a version `parseDataVer` accepts. It returns
   `{release, url, packs:[{system, file, version}]}`, or `null`.
6. **Sets `dataUpdate`** (a new top-level `let`, null by default) and calls `renderRulesData()`.
7. **Any failure is silent**, like `checkForUpdate()`.

`checkForUpdate()`, the update pill and `updateAvailable` are unchanged.

**Checked 2026-10-07:**
- `raw.githubusercontent.com` answers `Origin: null` (a `file://` page) with
  `access-control-allow-origin: *`.
- The releases API is what `checkForUpdate()` already calls from `file://`.

### 10.3 What the player sees

- **On each row:** the `update` state (§10.1).
- **A hint line above the loaded-data list**, only when at least one row is `update`: "Newer rules
  data is out: XPHB v1.8.0-1, Homebrew v1.8.0-1. Download it from the release page." The release
  page is a link (§10.2's `url`). The line shows in Settings and on the home screen, since both draw
  `rulesDataHTML()`.
- **On the count in the Settings section header:** `rulesBadge()` appends ` · update` when any row
  is `update`.

Packs the player hasn't loaded are never mentioned.

## 11. The app: credits

- **Merging:** if a pack has a `license` (a string of 64 characters or fewer) or an `attribution` (a
  string, cut to 2,000 characters), `mergeRules` sets `rules.credits[srcLabel(obj)] = {title,
  license, attribution}`.
- **Storing:** `resetRules()` gains `credits: {}`. A cache saved before this has no `credits` and is
  read as `{}`.
- **Lifecycle:** `credits` follows `requires` everywhere it goes:
  - `pruneRequires()` becomes `prunePackMeta()` and prunes both;
  - `applyFetchedSource()` and `importPack()` drop a label they alone owned;
  - `poolFromExport()` carries `saved.credits` the way it carries `saved.requires`;
  - removing a group or clearing everything prunes it.
- **Shown:** Settings → Credits & licences gets a "Rules data you have loaded" list after the
  game-icons paragraph. Each item reads: title, the attribution as plain escaped text, and the
  licence.
  - `CC-BY-4.0`, `CC-BY-SA-3.0` and `MIT` link to their licence pages.
  - Any other id is plain text.
  - If no loaded pack has a credit, the list is omitted.

## 12. Compatibility

- **Characters:** untouched. No character field changes.
- **The rules cache and settings files:** read as before. `credits` is optional everywhere.
- **Pack versions:** a pack loaded before this keeps its `dataVersion`. `cmpDataVer` reads every
  version shipped so far.
- **Fieldbook 1.7.2 and older:**
  - still see app updates, because data releases are never "latest";
  - cannot open the zip. The release notes and README §3a say to unzip it and import the `.json`
    files, which works.
  - `cmpVer` there reads `1.8.0-1` as `1.8.0`, so a data-release pack shows "v1.8.0-1" with no
    false alarm.
- **Re-importing** now removes entries the new copy dropped (R4). This is the one behaviour change
  for an existing flow. It gets an UNRELEASED bullet.

## 13. Testing

- **New `src/tests/data-archive.js`** (Node, through the harness):
  - **Versions:** `parseDataVer`, `cmpDataVer` (the ordering in §3.1, invalid gives 0),
    `dataVerOfTag` and `dataVerBase`, as tables of cases.
  - **The update check:** `pickDataRelease` with drafts, pre-releases, a base newer than the app, a
    missing asset, an app tag with the asset, `-10` against `-9`, and an empty or non-array list.
    `dataUpdateFrom` with malformed registries.
  - **CRC and inflate:**
    - `crc32` against known vectors;
    - `inflateRaw` against `zlib.deflateRawSync` at levels 0–9, on empty, tiny, incompressible and
      2 MB inputs;
    - truncated and corrupted streams throw `damaged`.
  - **Zips from several producers:**
    - a zip writer in the test (stored and deflated);
    - Python's `zipfile`, and `zip -9` when the tool exists. Skipped with a note otherwise, never
      failed;
    - every refusal code in §9.1, the ignored entries, a BOM'd JSON entry, a data-descriptor
      (flag bit 3) entry, and a non-ASCII name.
  - **`readDataArchive`:** an archive, a manifest one folder down, an app zip with the archive
    nested, a kit zip, a loose zip, and an empty one.
  - **Round trip:**
    - `fbdata.py pack` the real `dist/` bundles, then `importRulesPayloads` the zip;
    - the pool must equal the one from importing the bundles directly, compared as JSON with `_id`
      removed;
    - skipped with a note if Python is missing.
  - **`importPack`:**
    - dropped entries go;
    - another file or system is untouched;
    - `requires` and `credits` are pruned only when unowned.
  - **The rest:** the `dataStatus` states, the hint line, `rulesBadge`'s suffix, credits through
    merge, export, remove and clear, and the Credits HTML escaping hostile text.
  - **Status reporting:** a failed import is named in the status, and a cache save that fails
    (`state.quotaFull`) is reported.
- **New `src/tests/data-kit.py`** (Python):
  - **Digests:** the same for reordered keys and changed whitespace; different for a changed value,
    title, licence or credit.
  - **`versions`:** `--changed`, `--check` and `--bump` on a scratch copy, and every bad registry
    the guards refuse.
  - **`pack`:** produces identical bytes twice; its manifest and `NOTICE.md` are correct.
  - **`validate`:** catches a missing file, a SHA mismatch, an extra file, a system mismatch and a
    path escape.
  - **`data-release.js`** in a scratch git repo:
    - `--dry-run` writes nothing;
    - it refuses dirty `data/`, no changes, an existing tag, and a mismatched `release`;
    - the next N is right after `A` and after `A-3`.
  - **`release.js`** in a scratch repo: it bumps only the changed packs, and snapshots
    `DATA_VERSIONS`.
- **Changed:**
  - **The harness:** `TextDecoder` joins the context, and `dataUpdate` joins `MUTABLE`.
  - **`docs.js`:**
    - `SYSTEM_DIRS` and the `DATA_VERSIONS`-shape checks go;
    - new checks: `packs.json` parses, the §3.3 invariant, every pack `dir` exists, README §9 names
      the archive, and the `build.sh` allowlist matches it;
    - the two `README names *_full.json` checks move to the archive.
  - **`rules-data.js`:** "every shipped pack agrees with DATA_VERSIONS" becomes "with `packs.json`":
    `dataVersion === version`, and `system`, `name`, `license` and `attribution` match.
  - **`run.sh`:** `SUITES` gains `data-archive` and `data-kit`, making nine. CLAUDE.md and the
    testing page say nine.
- **By hand, before the merge:**
  - `./build.sh` (the zips), `unzip -l` on both;
  - import the archive, the app zip and a loose zip in the browser;
  - `data-release.js --dry-run` on main's state.
- **Screenshots, both skins:**
  - Settings → Rules data with the archive just imported, showing its status line;
  - the same with `dataUpdate` set by hand, showing the hint, the `update` row and the badge;
  - an encrypted zip's error;
  - Settings → Credits & licences with Homebrew loaded;
  - the home screen after importing the app zip.
- **Left for Mike:**
  - picking a `.zip` on iOS and Android;
  - the notice against real GitHub after the first data release;
  - his own characters;
  - a scratch-repo rehearsal of both workflows, run before any real tag.

## 14. Milestones (one or more commits each, in order)

1. **Registry.** `data/packs.json` (seeded), `fbdata.py` `digest`/`versions`, `bundle-rules.js` and
   `release.js` rewired, Homebrew's credit. The `docs` and `rules-data` changes.
2. **Versions in the app.** `parseDataVer` and its siblings. `cmpDataVer` replaces `cmpVer` in
   `dataStatus()` and the settings import.
3. **The zip reader.** `89-zip.js`, the manifest entry, and the zip half of `data-archive.js`.
4. **Import.** `importRulesPayloads`, `importPack`, the status line, and the four pickers.
5. **Credits.** `rules.credits`, its lifecycle and Settings → Credits.
6. **The archive.** `fbdata.py pack`/`validate`, `build.sh` (zips and `--data`), the app-zip guard,
   and `data-kit.py`.
7. **Releases.** `data-release.js`, `data-release-notes.js`, `release.yml`, `data-release.yml`, and
   dev.sh (menu `d`, plus a status-line field: "data: <release>, N changed").
8. **The notice.** `pickDataRelease`, `dataUpdateFrom`, `checkForDataUpdate`, the `update` state,
   the hint and the badge.
9. **Docs.**
   - Wiki: rules-packs, settings-and-updates, building-and-ci, testing, overview (code map and
     glossary), a new `architecture/data-archive.md` (which covers `89-zip.js`), the index, and the
     2.0 placeholder (R10).
   - Release and player docs: `RELEASING.md` (the data-release path, the freeze banner); README
     §3a, §9 and §10 (§10 wrongly says rules content isn't distributed); `rules-schema.md` §1
     (`license`, `attribution`) and a new §6.10a (the archive and its manifest).
   - Process: CLAUDE.md (nine suites, Python for zips, `packs.json` alongside "never hand-edit",
     data releases), the ledger, and `UNRELEASED.md` (§15).

## 15. Player-facing notes (`UNRELEASED.md`)

- Rules data now comes as one download, `fieldbook-data-standalone-….zip`, and Fieldbook opens it
  directly: Import files, then choose the zip. The app's own download zip works too.
- Fieldbook tells you, quietly, when newer rules data is out for a pack you have loaded. Rules data
  can now be updated between app releases.
- Re-importing a rules pack now replaces it completely: anything the new copy no longer has is
  removed, instead of lingering.
- Settings → Credits & licences lists the licence and credit of each rules pack you have loaded.
- If an import fails, Fieldbook now says which file failed and why, on the home screen as well as
  in Settings.

## 16. Out of scope

- **#84:** the SRD 5.2 pack and the converter's SRD mode.
- **#85:**
  - moving data to `RPGFieldbookPrivate`;
  - the kit's `build`, `convert` and `bundle` commands and its zip;
  - removing `scripts/` from the app zip;
  - the licence allowlist on publish;
  - deleting old release assets;
  - the history purge (logged for 2.0).
- **Not planned:** a data update installing itself. The notice links to the release; the player
  downloads and imports.
