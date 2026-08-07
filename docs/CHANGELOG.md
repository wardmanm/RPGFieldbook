# Fieldbook — Changelog

Version shown in the app's top bar (tap it to view this in-app). Bump `APP_VERSION` and add an
entry here whenever `fieldbook.html` changes.

## v1.2.1 — 2026-08-07

- Top-bar layout fixes: the version badge now sits next to the Humblewood title, the table-of-contents (☰) button is pinned to the far right of the tab bar, and the ToC flyout opens below the top bars instead of overlapping them.

## v1.2.0 — 2026-08-07

- Update badge: when a newer GitHub Release exists, an '↑ Update' pill appears in the top bar linking to the release's download page. Set UPDATE_REPO to your 'owner/repo' to enable it (blank = off); publish updates as a GitHub Release tagged with the version, e.g. v1.2.0.

## v1.1.0 — 2026-08-07

- Importing a character file that matches one you already have now asks before overwriting, and offers 'Import as copy' to keep both (the copy gets a fresh identity and a '(copy)' name).
- Importing a brand-new or different character still adds it directly.

## v1.0.0 — 2026-08-06

- Equipment grants: backgrounds, classes, and races add their starting gear — linked to the loaded item list, with 'this OR that' pickers and clean revert when you swap.
- All 16 D&D 2024 (XPHB) backgrounds included.
- Origin designators on items and spells (tap the badge for source + date); origin picker and optional cost on the add screens, with a running inventory Total value.
- Spellcasting: a Cast button that spends the right slot (and offers an upcast); attack and save spells appear in Attacks & Weapons; new Active Spells card with per-spell elapsed time and a global round counter; concentration handling.
- Attack cantrips (Ray of Frost, Chill Touch, …) are auto-detected into Attacks; a toast confirms each cast.
- Armor is equippable and drives AC (base + Dex capped by armor type, plus shields).
- Inventory grouped into collapsible sections with a Favorites section, equipped-first sorting, and a Category option for custom items.
- Sticky section tabs with a collapsing header, and a per-tab table-of-contents flyout (☰).
- More reliable character export/import — nothing is dropped on load.
- Added this version number and changelog.
