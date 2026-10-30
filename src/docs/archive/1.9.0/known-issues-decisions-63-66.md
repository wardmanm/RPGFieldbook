From `src/docs/wiki/roadmap/known-issues.md`, section "Decisions made while fixing #63–#66 — for Mike to confirm"; archived at the 1.9.0 pre-release; Mike confirmed these decisions on 2026-10-30.

# Decisions made while fixing #63–#66

Each is recorded, with its reason, in the page's Decisions table; each is easy to reverse.

- **Dismissing a choice window still opens the windows queued behind it** — including the starting
  equipment after dismissing the first Add-class window, which used to open nothing. Chosen because
  the alternative loses things silently. → ledger L3847, [Character building](../../wiki/features/character-building.md)
- **Removing the first class while another remains hands saving throws to the new first class**
  (tagged to it, with a toast); its starting skills and equipment are not re-offered. → ledger L3886,
  [Grants & provenance](../../wiki/architecture/grants-and-provenance.md)
- **A plain source's Fetch adds no confirmation dialog**, since nothing is lost unless a fresh copy replaces it; a
  fetched pack with the same system and entry names as a file import replaces those entries, as
  re-importing the file would. → ledger L3797, [Rules packs](../../wiki/architecture/rules-packs.md)

"Multiclass characters saved before #66 are not changed" moved to the Limitations in [Known issues](../../wiki/roadmap/known-issues.md) before this was archived.
