# Sharing private packs with your table

You run a table. You have homebrew rules you don't want public, and you want everyone at the table
to have them in Fieldbook and get your updates through the app. This guide sets that up.

You keep the packs in a **private GitHub repo** and cut numbered releases with the **data kit**. For
each player you make a **read-only token** that reaches that one repo, and send it with the repo's
address. The player pastes it into Settings → Extensions. Fieldbook then checks the repo like any
other source, and shows an update when you cut a new release.

You need to be comfortable with a command line and GitHub. Players need neither: no GitHub account,
and you never add them to the repo.

## 1. Make the private repo

Create a private repo on your own GitHub account. Lay it out like this:

```
data/
  packs.json              the pack registry: one entry per pack
  my-homebrew/            one folder per pack
    items.json
    spells.json           any of the files in rules-schema.md; use the ones you need
```

Each file in a pack folder is a rules-data file in the format `rules-schema.md` describes (it is in
the same download as this guide). Every file in one folder carries the same `"system"` name:

```json
{
  "system": "Our Table Homebrew",
  "items": [
    { "name": "Cinder Lantern", "category": "Gear", "type": "Wondrous Item",
      "rarity": "Uncommon", "cost": "50 gp", "weight": 1,
      "description": "Sheds dim light out to 30 feet." }
  ]
}
```

`data/packs.json` lists the packs. A minimal one, for a single pack:

```json
{
  "packs": [
    {
      "system": "Our Table Homebrew",
      "dir": "my-homebrew",
      "file": "my-homebrew_full.json",
      "title": "Our Table Homebrew",
      "license": "Private"
    }
  ]
}
```

- `system` is the pack's name, and matches the `"system"` in its files.
- `dir` is its folder under `data/`.
- `file` is the name of the bundle the kit writes. Letters, digits, `.`, `_` and `-`, ending `.json`.
- Leave `version`, `digest` and `release` out. The kit writes them.

Add a second pack with another entry and another folder.

## 2. Get the data kit and cut a release

The data kit is `fieldbook-data-kit-<version>.zip` attached on its own to each Fieldbook
release, on the release page. It is not inside the app download. It needs Python 3.8 or later and
nothing else. Unzip it anywhere. Use the kit from the same Fieldbook version your players run.

From the **root of your repo**, run:

```bash
python3 /path/to/the-kit/fbdata.py release
```

Add `--dry-run` first if you want to see the plan and write nothing.

The kit finds the packs whose content changed, gives them the next release number, bundles every
pack, and writes `releases/data/`. It prints the git lines to run. It never runs git. They look like
this, for release `1.9.0-1`:

```bash
git add data/packs.json releases/data
git commit -m "Data release 1.9.0-1"
git tag -a data-v1.9.0-1 -m "Data 1.9.0-1"
git push && git push origin data-v1.9.0-1
```

Release numbers follow the Fieldbook version your kit came from. A kit from Fieldbook 1.9.0 makes
`1.9.0-1`, then `1.9.0-2`. A kit from 1.9.1 makes `1.9.1-1`. A player gets the newest release made
for their Fieldbook version or an older one, so nobody is offered a release that needs a newer app.

The tag is what publishes. Pushing to `main` alone publishes nothing, so players only see a release
once you push its `data-v…` tag.

If nothing changed since the last release, the kit stops. `--allow-unchanged` releases anyway and
moves only the release number.

## 3. Make a token for each player

Make one token per player, on your own GitHub account, so you can cut one player off without
touching the rest.

1. On GitHub, open Settings → Developer settings → Personal access tokens → Fine-grained tokens.
2. Choose Generate new token.
3. Name it for the player (for example, "Fieldbook - Sam").
4. Resource owner: yourself.
5. Expiration: pick a date. Shorter is safer. When it passes, the token stops working (part 8).
6. Repository access: **Only select repositories**, then choose this repo.
7. Permissions → Repository permissions → **Contents: Read-only**. GitHub adds Metadata
   (read-only) by itself. Leave every other permission at "No access".
8. Generate the token and copy it now. GitHub shows it once.

**Do not use a classic token.** A classic token reaches every repo its owner can reach, and it can
write to them. A fine-grained token with the settings above can only read this one repo.

## 4. Build the source link

The source link is the repo's address with the token after `#token=`:

```
https://github.com/<owner>/<repo>#token=<token>
```

For example, `https://github.com/you/our-table-packs#token=github_pat_…`. Make one per player, each
with that player's token.

Send it to the player privately: a direct message, not a group chat, and not anywhere others can
read it. Anyone who has the link can read the repo until the token is deleted or expires.

## 5. What the player does

Tell the player:

1. Open Fieldbook and go to Settings → Extensions.
2. Under Sources, paste the link into the box and press **+ Add a source URL**.

Fieldbook checks the repo once before it adds it. If that works, the source appears as a row named
`owner/repo`, showing "private · token ending …abcd" (the last four characters of the token) and
when it was last checked. The link's token is taken out of the box as soon as it is read, and is
never shown again. The packs appear in the Extensions list, and the player installs them from there.

If it doesn't work, Fieldbook says why and adds nothing. "This token can't see the repo" means the
address or the token is wrong. "The repo refused this token" means it expired or was deleted.

The token stays on that device. It is not saved in character files or in the Settings file export.

## 6. Cut a new release

Change the pack files, then run the same command from your repo's root:

```bash
python3 /path/to/the-kit/fbdata.py release
```

Run the git lines it prints. Once the tag is pushed, each player's Fieldbook sees the new release
when it next checks (at boot, or when they press Check now) and shows its update notice. They press
Update. You send nothing new to the players.

## 7. Cut a player off

Delete that player's token on GitHub (Settings → Developer settings → Personal access tokens →
Fine-grained tokens). Their Fieldbook can no longer check the repo or fetch updates, and its source
row says the repo refused the token.

**Deleting a token stops updates. It does not take back what the player already has.** A player who
installed a pack holds a full copy of it in their app. It is also in their Settings file export,
because every installed pack is. Share only what you are happy for every player to keep.

## 8. A token that has expired

An expired token acts like a deleted one. The player's source row shows "The repo refused this token.
It may have expired or been deleted: ask the repo's owner for a new one." Their installed packs keep
working.

To fix it, make a new token the same way as in part 3 and build a new source link (part 4). The player
opens the source's row in Settings → Extensions → Sources, chooses **Change token**, and pastes the
new token or the new link. They don't need to remove the source or reinstall anything.
