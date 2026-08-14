# Unreleased

Running notebook of changes made since the last release. `APP_VERSION` stays at the last **released**
version while you work — nothing here is versioned yet.

**Add a `- ` bullet for every player-visible change as you make it.** One bullet per change, written
the way it should read in the changelog (players see these). Text can wrap onto continuation lines.

Bullets are copied VERBATIM into three places that render differently, so:
- **No angle brackets.** `<name>` is an HTML tag on GitHub and disappears from the release notes.
- **No literal version numbers** — they go stale the moment the version is bumped.
- `**bold**` renders on GitHub and in `docs/CHANGELOG.md`, but shows as literal asterisks in the
  app's own What's New list, which escapes its text. Use it sparingly.

When you are ready to cut a release, run one of:

```
./build.sh --release patch     1.2.1 -> 1.2.2   bug fixes
./build.sh --release minor     1.2.1 -> 1.3.0   new features
./build.sh --release major     1.2.1 -> 2.0.0   breaking rework
./build.sh --release 2.0.0     an explicit version
```

That bumps `APP_VERSION`, moves every bullet below into a new `CHANGELOG` entry in
`src/js/30-version.js`, empties this list, and then builds. A release fails if this list is empty.

Bullets below this line — leave the heading in place.

## Pending

- **Two new rules packs: Xanathar's Guide to Everything and Tasha's Cauldron of Everything.**
  Xanathar's adds 95 spells, 31 subclasses, 15 feats, 43 magic items, the Eldritch Invocations and
  Arcane Shot options, and the downtime and tool-proficiency rules with all their tables. Tasha's
  adds 26 subclasses, 21 spells, 15 feats, 84 magic items, Custom Lineage, and the Artificer
  infusions, metamagic, fighting styles, Battle Master maneuvers, runes and optional class features.
  Both are add-ons to the D&D 2024 pack — load that one too. Download them from the release, or take
  the zip for everything at once.
- Both books are 2014-era content, converted exactly as published: subclass features are listed at
  their 2014 levels and the text refers to 2014 class features. Where the 2024 Player's Handbook
  reprinted a subclass, you now get both — the 2024 one under its plain name and the older one
  tagged with its book, such as Gloom Stalker (XGE). Nothing you have already chosen changes.
- Optional features — invocations, metamagic, infusions, fighting styles, maneuvers, runes and
  Tasha's optional class features — arrive as Traits, so you can add the ones your table uses from
  the rules-pack picker.
- Tasha's Custom Lineage is offered to D&D characters only; a Humblewood character will not see it,
  while the spells, feats, subclasses and items from both books stay available to everyone.
- **Fieldbook now tells you when a rules pack needs another pack you haven't loaded.** A pack that
  refers to content it doesn't include gets a red badge under Loaded data, and hovering it lists
  exactly what's missing and which file to import. Nothing is blocked — the pack still loads and
  everything it does contain still works. This also fixes a long-standing puzzle: loading Humblewood,
  Xanathar's or Tasha's without the D&D 2024 pack used to leave their subclasses invisible, and the
  subclass picker would claim the class had none at all.
- **Fixed: with several rulebooks loaded, they weren't there after a reload.** The rules data had
  outgrown the small storage area browsers give a page — five books is more than it will hold — and
  the app had no way to notice, so it kept showing the packs all session and quietly came back with
  an older set next time you opened it. Rules data now lives somewhere with far more room, and
  moves itself there the first time you load the app. If a save ever is refused, Fieldbook now says
  so in red instead of losing your import without a word. On devices that don't offer the roomier
  storage — some phones and tablets — the rules are packed down to about a fifth of their size
  instead, so every book still fits.
- **New rules pack: homebrew.** The first entry is The Predator, a Warlock patron from D&D Wiki, with
  its Pact of Tooth and Claw boon and six Tooth and Fang invocations. It needs the D&D 2024 pack and,
  for two of its expanded spells, Xanathar's Guide — and it will tell you if either is missing.
