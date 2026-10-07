# Data archive

Rules data ships as one zip, `fieldbook-data-standalone-<version>.zip`, and Fieldbook opens it
itself. This page covers the archive, the registry of packs and their versions, and data-only
releases. It is being written as #83 lands; the spec is
[2026-10-07-data-archive-design](../../specs/2026-10-07-data-archive-design.md).

**Code:** `readDataArchive()`, `zipEntries()`, `zipEntryBytes()`, `inflateRaw()`, `crc32()` in
`89-zip.js` · **Tests:** `data-archive.js` · **See also:** [Rules packs](rules-packs.md)
