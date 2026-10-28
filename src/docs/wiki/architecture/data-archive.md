# Data archive

Rules data ships as one zip, `fieldbook-data-standalone-<version>.zip`, and Fieldbook opens it
itself, offline. Each pack in it has its own version, recorded with a digest of its content in the
registry `data/packs.json`, so data can be released without the app: a data-only release
(`data-v1.8.0-1`) publishes a new archive, and a running copy says quietly that it is out. The
archive's manifest, `fieldbook-data.json`, is also the **extension manifest** (#102): the release
commit carries it and the packs in `releases/data/`, which is where the app's built-in source
installs and updates from. This page covers the archive, the manifest format, the registry and
versions, opening a zip, re-importing, pack credits, the notice, and both release paths. What the app does with a pack once it is loaded is
[Rules packs](rules-packs.md).

**Code:** `crc32()`, `inflateRaw()`, `isZipBytes()`, `zipEntries()`, `zipEntryBytes()`,
`readDataArchive()` in `89-zip.js`; `importRulesPayloads()`, `importPack()`, `dropOwnedPackMeta()`,
`importSummary()`, `importRulesFiles()`, `creditOf()`, `dataUpdateHint()` in `89-rules-merge.js`;
`parseDataVer()`, `cmpDataVer()`, `dataVerOfTag()`, `dataVerBase()`, `pickDataRelease()`,
`dataUpdateFrom()`, `checkForDataUpdate()` in `30-version.js`; `dataStatus()`, `dataUpdateFor()`,
`prunePackMeta()`, `rulesCreditsHTML()`, `rulesBadge()` in `88-settings.js`; `pack_digest()`,
`changed_packs()`, `build_manifest()`, `cmd_pack()`, `cmd_release_files()`, `validate_archive()`, `bundle()`,
`load_registry()` in `tools/data-kit/fbdata.py`; `readManifest()`, `extEntry()` in `89-extensions.js` ·
**Data:** `data/packs.json`, `releases/data/` · **Tests:** `data-archive.js`, `data-kit.py`,
`rules-data.js`, `docs.js` · **See also:** [Rules packs](rules-packs.md),
[Settings & updates](../features/settings-and-updates.md), [Building & CI](../process/building-and-ci.md),
[RELEASING](../../RELEASING.md), [the spec](../../specs/2026-10-07-data-archive-design.md),
[the extensions spec](../../specs/2026-10-26-extensions-manifest-design.md)

## How it works

**The registry.** `data/packs.json` lists every pack: its `system`, the `dir` under `data/` it is
built from, the bundle's `file` and `title`, its `version`, a `digest`, and optionally a `license`
(an SPDX id) and an `attribution`, and since #102 a `summary` (≤140 characters) and a `description`
(≤4,000, paragraphs split by a blank line), both plain text and written by hand like `title`, and
optionally a `category` and `minApp`. The registry's own `name` and `homepage` name the source.
`release` is the version of the last release, app or data, and
names the archive. `fbdata.py bundle` reads it (`load_registry()`), so a bundle's `name`, `dataVersion`,
`license` and `attribution` all come from here. A new pack is registered with `version: null` and no
`digest`; its first release gives it both.

**Versions.** A data version is `X.Y.Z` — the data shipped with app X.Y.Z — or `X.Y.Z-N`, the Nth
data-only release after it. It is not semver: `1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1`.
`cmpDataVer()` compares them and returns 0 for anything unreadable; `cmpVer()` still compares app
versions, and would read `1.8.0-1` and `1.8.0-2` as equal. A pack's version moves only when its
content does: the digest is the SHA-256 of the canonical JSON of its registry fields, the bundle
format (`BUNDLE_FORMAT`) and every file in its folder (`pack_digest()`), so re-indenting a file changes
nothing, and a bundler change that alters a bundle's bytes, once `BUNDLE_FORMAT` is bumped, moves every
pack (#86).

**App releases** (`./build.sh --release`): `release.js` runs `fbdata.py versions --bump <next>`,
which gives every changed pack the new app version and sets `release`, then snapshots
`DATA_VERSIONS` from the registry. `DATA_VERSIONS` is the app's offline baseline: a loaded pack
older than it is **stale**.

**Data releases** (`node scripts/data-release.js`, dev.sh `d`): bump only the changed packs to
`<APP_VERSION>-N`; refuse when nothing changed, when `data/` is dirty, or when the tag exists; print
the commit, tag and push commands. Pushing `data-vX.Y.Z-N` runs `data-release.yml`, which publishes
the archive alone with `--latest=false`. With `--registry` and `--data-root` it bumps another
registry in its own checkout instead: that is how the private repo's packs are released, as
`fieldbook-data-private-<ver>.zip` on the private repo only (see
[Private data](../data/private-data.md)).

**The manifest (format 2, #102).** `build_manifest()` writes it for both `pack` and
`release-files`:

```json
{"_type": "fieldbook-data", "format": 2, "name": "Fieldbook public data",
 "homepage": "https://github.com/wardmanm/RPGFieldbook", "version": "1.9.0", "builtFor": "1.9.0",
 "packs": [{"file": "srd52_full.json", "category": "rules", "system": "SRD 5.2", "title": "SRD 5.2",
            "summary": "…", "description": "…", "version": "1.9.0", "minApp": "…", "size": 973157,
            "sha256": "…", "license": "CC-BY-4.0", "attribution": "…",
            "requires": [{"pack": "…", "file": "…", "url": "https://…"}]}]}
```

`category` defaults to `rules`; `minApp` is written only when the registry gives one, and the app
reads a missing one as the manifest's `builtFor`; `size` is the file's bytes; `requires` is copied
from the bundle's own declaration (`pack`, `file`, and an http(s) `url`), so authors write it once.
The app reads it with `readManifest()`: `_type` must be `fieldbook-data` with a `packs` list, at most
64 KB and 1,000 packs (refused whole), and `extEntry()` drops any pack whose `file` is not a path of
`[A-Za-z0-9._-]` segments ending in a `.json` name, or which has no `system` or no readable
`version`. Text is cut to its limit (title 200, summary 140, description 4,000, attribution 2,000),
a `url` that isn't http(s) becomes "", a `sha256` that isn't 64 hex characters becomes "", and two
entries for one `system|file` keep the newer. A format-1 manifest reads the same way with the
defaults; older apps ignore the new fields, and a manifest given to one as a loose file still merges
nothing. The player-facing description, for anyone hosting their own packs, is
[rules-schema](../../../../docs/rules-schema.md) "Publishing extensions".

**`releases/data/`** is the official source (#102): `fieldbook-data.json` and every bundle, flat,
committed with each public release so `raw.githubusercontent.com/<repo>/<tag>/releases/data/`
serves them. `fbdata.py release-files` writes it (deleting the stale `.json` first) and validates it
`--public`; `./build.sh --release` runs it, never a `+dev` build, and so does `data-release.js` for
the public registry (never `--registry`, which has no public raw URL). `release.yml` and
`data-release.yml` validate the folder `--public`, `cmp` each pack with the build's, and check its
`version` is the registry's `release`.

**The archive.** `fbdata.py pack` writes `fieldbook-data.json` (the manifest), `NOTICE.md` and the
bundles — sorted, dated 1980-01-01, deflated at level 9 — and `fbdata.py validate`
(`validate_archive()`) checks it. A build names it `+dev` when a digest is unreleased. The app zip
carries it in `data/`. It holds every registered pack, one since #125: `srd52_full.json`, the
[SRD 5.2](../data/srd.md) pack. The 2024, Xanathar's, Tasha's and Humblewood packs left the
registry and the archive for the private repo in #85, and Homebrew followed in #125
([Private data](../data/private-data.md), [Homebrew](../data/homebrew.md)); a player who loaded
them keeps them, shown with the quiet `known` chip once `DATA_VERSIONS` no longer names them.
`NOTICE.md` carries the SRD's CC-BY-4.0 attribution in full; the private archive's `NOTICE.md`
carries Homebrew's CC BY-SA credit, from the private registry.

**Opening a zip.** `89-zip.js` is pure. `readDataArchive()` reads, in order: an archive (its manifest
at the root or one folder down); the data kit, refused; an archive one level inside (the app zip); a
zip of loose `.json`. An inner zip is read as an archive or skipped, never as loose JSON. It refuses
encrypted, ZIP64, unknown-method, damaged, oversized and 1,000-plus-entry zips by `zipError` code,
and every entry is CRC-checked before anything merges. One read budget covers the whole import:
every entry it reads, nested archives included, counts against the 128 MiB cap, and is reserved
before anything inflates.

**Importing.** Since #102 a zip chosen or dropped goes through Manual install's plan: each pack in
it is a candidate carrying its manifest entry, so a zip's packs are checked against their sha256
like a source's (see [Rules packs](rules-packs.md)). `importRulesPayloads()`, the older direct
path the suites still drive, takes bytes; a zip's packs are imported under their own file
names, so rows and chips stay per pack. `importPack()` replaces what that file name and system
loaded before, dropping entries the new copy no longer has. In a loose zip, JSON with no rules
category — the converter's inputs in an old app zip — is skipped. A pack whose `importPack()` call
throws is caught per file (or per packed entry, labelled `"<pack> in <zip>"`) and named `"not a rules
file"` in `failed`, rather than taking the rest of the import down with it. `importRulesFiles()`
shows "Reading N files…" at once, then one line on both status lines naming each zip, each failure
and its reason, and a cache save that failed. When neither status element is on screen to read it —
the Rules tab's own "Import rules files" links, with Settings closed and the home screen hidden behind
the sheet — `rulesImportStatus()` also raises a `toast()`, with its own shorter text: what happened and
what went wrong, never the counts (#87). A failed file, a save that did not land or an exception is an
error toast that stays until tapped; missing content and skipped entries are notices, shown 6 s.
The four rules pickers accept `.zip`, `application/zip` and `application/x-zip-compressed`.

**Credits.** A pack's `license` and `attribution` become `rules.credits[label]` (`creditOf()`), kept
and pruned like `requires`, carried by settings files, and listed in Settings → Credits
(`rulesCreditsHTML()`), escaped.

**The notice.** `checkForDataUpdate()` runs after `checkForUpdate()`. It lists the releases,
`pickDataRelease()` takes the newest with an archive built for this app or an older one, and it
reads that tag's `data/packs.json` from `raw.githubusercontent.com`, which answers a `file://` page
with `access-control-allow-origin: *`. A loaded pack with the same system and file name and an older
version shows a muted `vA · vB out` (on the Extensions page only when no source offers that pack,
since an offer says the same with an Update button), the home screen's hint line links the release,
and the Settings sidebar's Extensions tab shows a dot. Any failure is silent. The official extension
source picks its release the same way (`pickDataRelease()`) but makes its own call to the releases
list.

## Rules that must hold

- **Only `release.js` and `data-release.js` write versions, digests and `release`,** through
  `fbdata.py` — never by hand, never in a build.
- **A data release is never "latest".** Every installed copy finds app updates through
  `/releases/latest`. `data-release.yml` publishes with `--latest=false`, then checks; if a data
  release is latest, it re-marks the newest app release and fails.
- **Data tags sort in code** (`cmpDataVer()`), never with git's `v:refname`; every app glob is
  anchored at `v`, so `data-v…` never matches one.
- **A zip is read whole before any of it merges.** A damaged archive imports nothing.
- **The 128 MiB read cap covers the whole import,** nested archives included. A zip inside a zip
  shares its parent's budget, so an archive of archives cannot multiply it.
- **An inner zip is an archive or nothing.** One that isn't a Fieldbook archive is skipped, never
  read as loose JSON.
- **Re-importing replaces by file name and system,** never by file name alone.
- **`releases/data/` is the build's, byte for byte, and public only.** Only a real release writes
  it; CI refuses a tag whose folder differs from the build or names another release.
- **A manifest path is relative and allow-listed.** Never absolute, never `..`, only
  `[A-Za-z0-9._-]` per segment, on both sides: `fbdata.py validate` refuses unsafe paths and the app
  drops them.
- **Credits are text,** shown through `esc()`. A licence longer than 64 characters is dropped, and an
  attribution is cut to 2,000.
- **A public release may only carry an allowlisted licence** (`CC-BY-4.0`, `CC-BY-SA-3.0`, `MIT` —
  `PUBLIC_LICENCES`, #85 R13). `fbdata.py validate --public` enforces it on the rules-data archive;
  `release.yml` and `data-release.yml` both run it, after the build, alongside a check that no asset
  is named `*private*` — see [Building & CI](../process/building-and-ci.md).

## Traps

- **A bundler change is invisible to the digest unless `BUNDLE_FORMAT` moves.** Change what
  `bundle()` or `bundle_text()` writes and bump `BUNDLE_FORMAT` in `fbdata.py`; `data-kit.py` pins each
  format's output fingerprint and fails until you do, then asks for the new fingerprint (#86).

- **`cmpVer()` ignores `-N`.** Every comparison of data versions goes through `cmpDataVer()`.
- **Every build needs Python now.** `fbdata.py bundle` runs even under `--no-zip` (#85); only
  running a single Node suite directly, skipping `run.sh`'s rebundle, needs none.
- **Seeding was the one hand-run step.** The first digests came from the v1.7.2 tree, so data
  changed after v1.7.2 still moves to 1.8.0. Never seed again: `fbdata.py versions --seed` records
  every pack's current digest, so it would mark every unreleased change as released. A new pack
  (SRD 5.2) waits with no digest, which already reads as "changed", and `data-kit.py` requires a
  digest only of a pack that has a version.
- **A per-zip read cap was not a cap.** The first reader gave each nested zip a fresh count, so a
  zip holding many archives could read far past 128 MiB in total, and an inner zip with no manifest
  fell through to being read as loose JSON. The budget is now one per import, reserved before
  inflating, and an inner zip is an archive or skipped (5f570b1). Once an inner zip has a manifest
  it is an archive, so a damaged or locked pack inside it refuses the whole import.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How players load the data | The app opens the zip itself | Unzip first: one more step, and an awkward one on a phone |
| Version granularity | Per pack; the archive carries the release | One version for everything: re-downloading every pack because one changed |
| Version format | `X.Y.Z` / `X.Y.Z-N` | Semver: `-N` would be a pre-release, sorting below the release it follows |
| What says a pack changed | A digest of its content (canonical JSON) | `git diff` since the last tag: formatting-only changes bumped packs |
| How a running copy learns of new data | The releases list plus the tag's registry; a quiet notice | Baked into the app: only a new app could announce new data |
| Where digests are computed | Only `fbdata.py` | In Node and Python both: two implementations that must agree |
| How the official files are served (#102) | `releases/data/` in the release commit, read from raw.githubusercontent.com at the tag | A `data-release` branch CI overwrites: not per tag. Building packs in the app from the fragments: a second bundler and digest in JavaScript would drift (L7428) |
| A pack built for a newer app (#102) | Every pack has a `minApp`, defaulting to `builtFor`; one newer than the app is listed, never installed | Installing anyway: a data change can need app code that isn't there (L7428) |
| Kinds of extension (#102) | Every pack has a `category`; only `rules` installs today | No category: 2.0 would need a second format (L7428) |
| Descriptions (#102) | A `summary` of 140 characters for the row, a `description` of 4,000 for the details | One description: too long for a row or too short for a dialog (L7428) |
| How a bundler change reaches the versions | `BUNDLE_FORMAT` in the digest, pinned by a fingerprint test (#86) | An escape hatch (`--force SYSTEM`): a manual step to remember on every bundler change |

## Open

- **Private packs get no newer-data notice.** `checkForDataUpdate()` reads the public registry, which
  lists only the public packs.
- **Old releases still hand out the packs.** Deleting the assets of v1.3.0–v1.7.2 is deferred
  (Mike, 2026-10-12); GitHub's Source code archives of each tag stay until the 2.0 history purge
  ([2.0](../roadmap/2.0.md)).

## History

- 2026-10-07 — The data archive, the pack registry and per-pack versions, opening zips, pack
  credits, the newer-data notice and data-only releases. → ledger L5082
- 2026-10-07 — The final review's fixes: a toast when no status line is on screen, a pack that
  throws named and skipped, the release-path guards, the "those versions" note wording. → ledger L5124
- 2026-10-08 — The archive carries `srd52_full.json`, registered with no version or digest until
  1.8.0. → ledger L5148, #84
- 2026-10-09 — The registry read and bundling move into `fbdata.py` (`load_registry()`, `bundle()`), replacing the Node bundler. → ledger L5342, #85
- 2026-10-09 — Public releases (app and data) are gated on `validate --public` and a `*private*` name check, run by the release workflows after the build. → ledger L5352, #85
- 2026-10-09 — The archive holds SRD 5.2 and homebrew only; `data-release.js --registry` cuts the private repo's releases. → ledger L5426, #85
- 2026-10-12 — The digest covers `BUNDLE_FORMAT`, pinned by a fingerprint of the bundler's output; the old releases' asset deletion is deferred. → ledger L5627, #86
- 2026-10-12 — The import toast drops the counts; a failure is an error toast that stays until tapped. → ledger L5648, #87
- 2026-10-26 — The manifest is format 2 and doubles as the extension manifest; `release-files` writes `releases/data/` for each public release, and CI checks it. → ledger L7428, #102
- 2026-10-28 — The archive holds SRD 5.2 alone; Homebrew and its credit move to the private archive. → ledger L7858, #125
