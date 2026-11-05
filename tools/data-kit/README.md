# Fieldbook data kit

Build a rules data zip Fieldbook opens, from your own 5e-tools data or from packs you wrote.
Needs Python 3.8 or later; nothing else to install.

## Three recipes

    python fbdata.py build <5e-tools data folder> -o srd.zip            # the SRD 5.2 pack
    python fbdata.py build <5e-tools data folder> --full -o mine.zip    # the full 2024 pack, for you only
    python fbdata.py build <folder of your packs> -o mine.zip           # your own packs, as they are

Then in Fieldbook: Settings → Rules data → Import files, and choose the zip.

## What you may share

The SRD 5.2 pack is under CC-BY-4.0: share it, keeping its NOTICE.md. Packs built with `--full`
or `--book` hold text from books you bought; keep them to yourself.

## Also here

- `fbdata.py convert …` runs `convert.py` with this kit's helper files (see README-converter.md).
- `fbdata.py validate <zip>` checks an archive.
- `fbdata.py release` cuts a numbered data release (`X.Y.Z-N`) of your own pack repo, so Fieldbook can
  install it. Run it from your repo's root, where `data/packs.json` lives. It bumps the packs that
  changed, bundles them into `releases/data/` and prints the git lines to run yourself (it never runs
  git): `git add data/packs.json releases/data`, `git commit -m "Data release <next>"`,
  `git tag -a data-v<next> -m "Data <next>"`, `git push && git push origin data-v<next>`. With no pack
  changed it stops; `--allow-unchanged` releases anyway, moving only the release number. `--dry-run`
  prints the plan and writes nothing. `fieldbook-version.txt` is the Fieldbook version this kit is for.
- `rules-schema.md` describes the format; `example-pack/` is a small pack showing every category.
