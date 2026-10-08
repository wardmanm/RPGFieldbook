# Data archive

Rules data ships as one zip, `fieldbook-data-standalone-<version>.zip`, and Fieldbook opens it
itself, offline. Each pack in it has its own version, recorded with a digest of its content in the
registry `data/packs.json`, so data can be released without the app: a data-only release
(`data-v1.8.0-1`) publishes a new archive, and a running copy says quietly that it is out. This page
covers the archive, the registry and versions, opening a zip, re-importing, pack credits, the
notice, and both release paths. What the app does with a pack once it is loaded is
[Rules packs](rules-packs.md).

**Code:** `crc32()`, `inflateRaw()`, `isZipBytes()`, `zipEntries()`, `zipEntryBytes()`,
`readDataArchive()` in `89-zip.js`; `importRulesPayloads()`, `importPack()`, `dropOwnedPackMeta()`,
`importSummary()`, `importRulesFiles()`, `creditOf()`, `dataUpdateHint()` in `89-rules-merge.js`;
`parseDataVer()`, `cmpDataVer()`, `dataVerOfTag()`, `dataVerBase()`, `pickDataRelease()`,
`dataUpdateFrom()`, `checkForDataUpdate()` in `30-version.js`; `dataStatus()`, `dataUpdateFor()`,
`prunePackMeta()`, `rulesCreditsHTML()`, `rulesBadge()` in `88-settings.js`; `pack_digest()`,
`changed_packs()`, `cmd_pack()`, `validate_archive()` in `tools/data-kit/fbdata.py`; `registry()` in
`scripts/bundle-rules.js` · **Data:** `data/packs.json` · **Tests:** `data-archive.js`, `data-kit.py`,
`rules-data.js`, `docs.js` · **See also:** [Rules packs](rules-packs.md),
[Settings & updates](../features/settings-and-updates.md), [Building & CI](../process/building-and-ci.md),
[RELEASING](../../RELEASING.md), [the spec](../../specs/2026-10-07-data-archive-design.md)

## How it works

**The registry.** `data/packs.json` lists every pack: its `system`, the `dir` under `data/` it is
built from, the bundle's `file` and `title`, its `version`, a `digest`, and optionally a `license`
(an SPDX id) and an `attribution`. `release` is the version of the last release, app or data, and
names the archive. `bundle-rules.js` reads it (`registry()`), so a bundle's `name`, `dataVersion`,
`license` and `attribution` all come from here.

**Versions.** A data version is `X.Y.Z` — the data shipped with app X.Y.Z — or `X.Y.Z-N`, the Nth
data-only release after it. It is not semver: `1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1`.
`cmpDataVer()` compares them and returns 0 for anything unreadable; `cmpVer()` still compares app
versions, and would read `1.8.0-1` and `1.8.0-2` as equal. A pack's version moves only when its
content does: the digest is the SHA-256 of the canonical JSON of its registry fields and every file
in its folder (`pack_digest()`), so re-indenting a file changes nothing.

**App releases** (`./build.sh --release`): `release.js` runs `fbdata.py versions --bump <next>`,
which gives every changed pack the new app version and sets `release`, then snapshots
`DATA_VERSIONS` from the registry. `DATA_VERSIONS` is the app's offline baseline: a loaded pack
older than it is **stale**.

**Data releases** (`node scripts/data-release.js`, dev.sh `d`): bump only the changed packs to
`<APP_VERSION>-N`; refuse when nothing changed, when `data/` is dirty, or when the tag exists; print
the commit, tag and push commands. Pushing `data-vX.Y.Z-N` runs `data-release.yml`, which publishes
the archive alone with `--latest=false`.

**The archive.** `fbdata.py pack` writes `fieldbook-data.json` (the manifest), `NOTICE.md` and the
bundles — sorted, dated 1980-01-01, deflated at level 9 — and `fbdata.py validate`
(`validate_archive()`) checks it. A build names it `+dev` when a digest is unreleased. The app zip
carries it in `data/`.

**Opening a zip.** `89-zip.js` is pure. `readDataArchive()` reads, in order: an archive (its manifest
at the root or one folder down); the data kit, refused; an archive one level inside (the app zip); a
zip of loose `.json`. An inner zip is read as an archive or skipped, never as loose JSON. It refuses
encrypted, ZIP64, unknown-method, damaged, oversized and 1,000-plus-entry zips by `zipError` code,
and every entry is CRC-checked before anything merges. One read budget covers the whole import:
every entry it reads, nested archives included, counts against the 128 MiB cap, and is reserved
before anything inflates.

**Importing.** `importRulesPayloads()` takes bytes; a zip's packs are imported under their own file
names, so rows and chips stay per pack. `importPack()` replaces what that file name and system
loaded before, dropping entries the new copy no longer has. In a loose zip, JSON with no rules
category — the converter's inputs in an old app zip — is skipped. `importRulesFiles()` shows
"Reading N files…" at once, then one line on both status lines naming each zip, each failure and
its reason, and a cache save that failed. The four rules pickers accept `.zip`, `application/zip`
and `application/x-zip-compressed`.

**Credits.** A pack's `license` and `attribution` become `rules.credits[label]` (`creditOf()`), kept
and pruned like `requires`, carried by settings files, and listed in Settings → Credits & licences
(`rulesCreditsHTML()`), escaped.

**The notice.** `checkForDataUpdate()` runs after `checkForUpdate()`. It lists the releases,
`pickDataRelease()` takes the newest with an archive built for this app or an older one, and it
reads that tag's `data/packs.json` from `raw.githubusercontent.com`, which answers a `file://` page
with `access-control-allow-origin: *`. A loaded pack with the same system and file name and an older
version shows a muted `vA · vB out`, a hint line links the release, and the Settings count adds
`· update`. Any failure is silent.

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
- **Credits are text,** shown through `esc()`. A licence longer than 64 characters is dropped, and an
  attribution is cut to 2,000.

## Traps

- **`cmpVer()` ignores `-N`.** Every comparison of data versions goes through `cmpDataVer()`.
- **The zips need Python.** `./build.sh --no-zip` and the Node suites don't; the zips, a release
  and the `data-kit` suite do.
- **Seeding was the one hand-run step.** The first digests came from the v1.7.2 tree, so data
  changed after v1.7.2 still moves to 1.8.0.
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

## Open

- The SRD 5.2 pack (#84), and the private split with the data kit (#85).

## History

- 2026-10-07 — The data archive, the pack registry and per-pack versions, opening zips, pack
  credits, the newer-data notice and data-only releases. → ledger L5082
