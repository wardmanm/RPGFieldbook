# Data kit

`tools/data-kit/fbdata.py` is the one tool for rules packs outside the app: it bundles each pack
folder into the file players import, keeps pack versions and digests, writes and validates the
rules-data archive, and, for anyone with a 5e-tools export, converts and builds a whole archive in
one command. It is Python 3.8+ with the standard library only, so the same file runs in this repo
(`build.sh`, `run.sh`, CI, the release scripts), in the private repo, and unzipped from the
**data kit zip** that every app release attaches. The player-facing guide is the kit's own
`tools/data-kit/README.md`; the converter's is [README-converter](../../../../docs/README-converter.md).

**Code:** `main()`, `bundle()`, `bundle_text()`, `cmd_bundle()`, `cmd_digest()`, `cmd_versions()`,
`pack_digest()`, `changed_packs()`, `load_registry()`, `check_registry()`, `cmd_pack()`,
`notice_md()`, `validate_archive()`, `cmd_validate()`, `kit_file()`, `cmd_convert()`, `cmd_build()`,
`app_version()` in `tools/data-kit/fbdata.py`; `build.sh` (`pack_kit`) · **Data:**
`data/packs.json`, `tools/data-kit/README.md`, `tools/data-kit/example-pack/example-pack.json` ·
**Tests:** `data-kit.py` (golden bundle checks, versions, digests, `pack` and `validate`,
`validate --public`, `build` from a folder of packs, a registry and one pack file, `kit_file()`,
the example pack, the kit zip unzipped with no repo around it, the release scripts in a scratch repo),
`converter.py` (`build` on a mini dump) · **See also:** [Data archive](../architecture/data-archive.md),
[Rules packs](../architecture/rules-packs.md), [Converter](converter.md), [Private data](private-data.md),
[Building & CI](../process/building-and-ci.md), [the spec](../../specs/2026-10-09-private-split-design.md)

## How it works

### The commands

Exit status: 0 ok, 1 a check failed, 2 bad input (one line on stderr). `--registry` and
`--data-root` default to this repo's `data/packs.json` and `data/`, so the private repo passes its
own.

| Command | What it does | Example |
|---|---|---|
| `bundle` | Rolls each registered `data/<dir>/` into `dist/<file>`, stamped with the registry's title, version, licence and credit (below) | `python3 tools/data-kit/fbdata.py bundle -o dist` |
| `digest` | Each pack's computed content digest beside the recorded one | `python3 tools/data-kit/fbdata.py digest` |
| `versions` | `--changed` lists packs whose digest moved since their release; `--check` exits 1 if any did; `--bump V` gives those packs version V and sets `release`; `--seed` records every digest as released (never again: see [Data archive](../architecture/data-archive.md)) | `python3 tools/data-kit/fbdata.py versions --changed --registry _private-data/data/packs.json --data-root _private-data/data` |
| `pack` | Writes the archive from the bundles: `fieldbook-data.json`, `NOTICE.md` and each pack, sorted and dated 1980-01-01, so the same input gives the same bytes. `--dev` names its version `<release>+dev`; `--built-for` records the app version | `python3 tools/data-kit/fbdata.py pack dist -o dist/fieldbook-data-standalone-1.8.0.zip` |
| `validate` | Checks an archive: one line per problem, exit 1. `--public` also refuses a pack whose licence is not `CC-BY-4.0`, `CC-BY-SA-3.0` or `MIT` (`PUBLIC_LICENCES`) | `python3 tools/data-kit/fbdata.py validate --public dist/fieldbook-data-standalone-1.8.0.zip` |
| `convert` | Runs `convert.py` with the kit's `overlay.json`, `class-resources.json` and (for `srd`) `srd-corrections.json` filled in, unless the caller names their own | `python3 tools/data-kit/fbdata.py convert srd _conversion-data/5etools-v2.36.1 -o /tmp/srd` |
| `build` | One command from a source to a validated archive (below) | `python fbdata.py build ~/5etools/data -o srd.zip` |

**Bundling.** `bundle()` mirrors `mergeRules()`: entries keyed by name (subclasses by class and
name), last file wins, replaced in place; every duplicate and every nameless entry is reported, and a
folder whose files disagree on `system`, `excludeSystems` or `requires`, or whose `system` is not the
registry's, fails. `bundle_text()` writes exactly what `JSON.stringify` wrote. What a bundle holds
and why: [Rules packs](../architecture/rules-packs.md).

**Finding the converter's inputs.** `kit_file()` looks beside `fbdata.py` first (the kit zip's flat
layout), then in the repo the file sits in (`scripts/convert.py`, `data/overlay.json`,
`data/class-resources.json`, `scripts/srd-corrections.json`). That is why `convert` and `build` work
both from a checkout and from the unzipped kit, where `convert.py` run directly would not find its
helper files.

### `build`'s three inputs

`build <src> -o OUT.zip` reads one of three kinds of source, then bundles, packs and validates in a
temporary folder, and writes only `OUT.zip`. It never publishes.

1. **A 5e-tools data folder** (one with `class/` or `spells/`). It converts first:
   - `--srd`, the default: the SRD 5.2 pack (`convert.py srd`), with its licence and attribution;
     `--corrections PATH` swaps the corrections file, as the mini-dump test does;
   - `--full`: the full 2024 pack (`convert.py all`);
   - `--book XGE` (or `TCE`, or another 5e-tools code): one supplement, after converting the core
     pack into a scratch folder for `--avoid-table-names`, as `dev.sh` does.

   The archive's version is `--version` (default `0.0.0`), and the pack has no version of its own.
2. **A data folder with its `packs.json`**, such as this repo's `data/` or the private repo's: every
   registered pack, stamped with the registry's versions. Mike's own archive is
   `python3 tools/data-kit/fbdata.py build _private-data/data -o mine.zip`.
3. **Loose packs**: one pack file, or a folder of them, taken as they are, with each pack's own
   `license` and `attribution`. A pack that already carries a `dataVersion` is refused: build it from
   its registry instead.

A pack with no version shows no version chip in the app; one stamped from a registry this build has
no baseline for shows its version quietly (the `known` state of `dataStatus()`; see
[Settings & updates](../features/settings-and-updates.md)).

### The kit zip

`build.sh`'s `pack_kit` writes `dist/fieldbook-data-kit-<APP_VERSION>[+dev].zip`, and `release.yml`
attaches it to every app release. It is a flat allowlist of exactly ten files:

```
fbdata.py                the kit
README.md                the kit's own guide (tools/data-kit/README.md): the three recipes, what you may share
convert.py               the converter
overlay.json             hand-authored effects       (data/overlay.json)
class-resources.json     hand-authored trackers      (data/class-resources.json)
srd-corrections.json     the SRD pack's corrections  (scripts/srd-corrections.json)
README-converter.md      how the converter works     (docs/)
rules-schema.md          the pack format             (docs/)
LICENSE
example-pack/example-pack.json   one invented pack with every category, MIT
```

The guard lists the zip with `unzip -Z1`, sorts in byte order (`LC_ALL=C`, so a runner's locale
cannot reorder it) and compares with that list; any difference deletes the zip and fails the build.
The app zip carries no `scripts/` since the kit exists. The app refuses the kit zip if a player
imports it by mistake (`readDataArchive()` sees `fbdata.py` and names the kit).

### What a kit user may share

What a build holds decides it, and the kit's README says so:

- **The SRD 5.2 pack** (`--srd`) is CC-BY-4.0: share it, keeping its `NOTICE.md`, which carries the
  attribution the licence asks for.
- **Packs built with `--full` or `--book`** hold text from books the user bought: for their own use
  only. The help text says so beside each flag.
- **Their own packs** are theirs to license, through each pack's `license` and `attribution`.

### Where it came from

`fbdata.py` arrived with #83 for versions, digests and the archive. In #85 it took over bundling from
the Node `scripts/bundle-rules.js` (spec R11), because kit users have Python and not Node: a parity
test bundled all six real packs and 13 synthetic cases (duplicates, nameless entries,
`excludeSystems` and `requires` disagreements, an empty folder) with both and compared bytes; only
when it passed did `build.sh` switch, and then `bundle-rules.js` and the parity test were removed,
the test replaced by golden checks. `convert`, `build`, `validate --public` and the kit zip followed
(R12, R13).

## Rules that must hold

- **Standard library only, Python 3.8+.** A kit user installs nothing.
- **The bundle equals its files.** `bundle()` keys and dedupes as `mergeRules()` does, and
  `CATS` stays in step with `RULE_CATS` in `88-settings.js`.
- **Only `release.js` and `data-release.js` write versions, digests and `release`**, through
  `versions --bump`. A build or `build` never does.
- **The kit never publishes.** `build` writes a local zip; publishing is the release workflows'.
- **The kit zip is an allowlist**, flat, guarded after zipping; a new file means editing `pack_kit`'s
  copy and its list together, and `docs.js` checks the kit still carries `srd-corrections.json`.
- **A public archive passes `validate --public`**, in both public release workflows.

## Traps

- **`convert.py` run directly from the kit misses its helper files**: it looks in the dump and in a
  repo's `data/`, never beside itself, except for `srd-corrections.json`. `fbdata.py convert` and
  `build` pass all three; README-converter says to name them when running `convert.py` alone.
- **A newer 5e-tools dump can fail `--srd`**: a correction that no longer matches is an error, and
  the run writes nothing. `--corrections` names another file.
- **The kit guard once compared a locale-sorted list with a byte-ordered one**, which a runner with
  a case-insensitive locale would have failed, blocking a release. It sorts with `LC_ALL=C` now.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| The kit's language (#82) | Python, standard library, in `tools/data-kit/fbdata.py` | Node: kit users have Python, not Node |
| The bundler (R11) | `fbdata.py bundle`, switched only after a byte-for-byte parity test over every pack; `bundle-rules.js` removed | Keeping both: two bundlers that must agree byte for byte |
| How the kit ships (R12) | One flat zip per app release, `fieldbook-data-kit-<ver>.zip`, with its own allowlist; the app zip drops `scripts/` | Inside the app zip's `scripts/`: every player downloaded it, and `convert.py` missed its helper files in that layout |
| How `convert.py` finds its inputs from the kit (R12) | `fbdata.py` passes `--overlay`, `--resources` and `--corrections` explicitly | Teaching `convert.py` to look beside itself: changes the converter the byte gates guard |
| What app releases attach (#82) | `fieldbook.html`, the app zip (with the archive inside), the archive and the kit | — |

## Open

- `convert.py`'s own lookup still never checks beside itself for `overlay.json` and
  `class-resources.json`; the kit works around it. See [Converter](converter.md).

## History

- 2026-10-09 — `fbdata.py bundle` replaces the Node bundler after a byte-for-byte parity test. → ledger L5342, #85
- 2026-10-09 — The kit zip, `kit_file()`, `convert`, `build`, `validate --public` and the example pack; the app zip drops `scripts/`. → ledger L5352, L5426, #85
