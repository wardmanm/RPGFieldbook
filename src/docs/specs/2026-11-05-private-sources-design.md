# Private sources: installing packs from a private GitHub repo: design

**Status:** agreed in conversation with Mike, 2026-11-05, and checked by a builder's read the same
day. Not built.
**Issue:** #182. One branch, `issue/182-private-sources`.
**Builds on:** #102, [the Extensions design](1.9.0/2026-10-26-extensions-manifest-design.md), which
left "private packs through a manifest" out of 1.9.0 (its §"Not in this change").

**Read first:**
- [Settings & updates](../wiki/features/settings-and-updates.md): the Extensions page, Sources, the
  install plan, the update pill.
- [Data archive](../wiki/architecture/data-archive.md): the format-2 manifest, `releases/data/`,
  data releases and their `X.Y.Z-N` versions.
- [Data kit](../wiki/data/data-kit.md): `fbdata.py`, its `versions`, `pack`, `release-files` and
  `validate` commands, and the kit zip each app release attaches.
- [Storage](../wiki/architecture/storage.md): `settings` in localStorage, and failing loudly.
- [Private data](../wiki/data/private-data.md): RPGFieldbookPrivate and `/release private`.

---

## 1. What it is, and why

Someone running a table has homebrew packs they don't want public, but they want everyone at the
table to have them in Fieldbook and to get their updates through the app.

They keep the packs in a **private GitHub repo** laid out the way Fieldbook reads packs, and cut
**numbered releases** with the data kit. For each player they make a **read-only GitHub token**,
limited to that one repo, and send it with the repo's address. The player pastes it into
**Settings → Extensions**. From then on the repo is a source like the built-in one: it is checked at
boot, the update pill announces a new release, and Install, Update and Update all work as they do
now.

Mike's own RPGFieldbookPrivate repo is the first source of this kind. His devices install the 2024,
Xanathar's, Tasha's, Humblewood and Homebrew packs through Extensions instead of Manual install.

A setup guide, which ships with the app, walks an owner through all of it.

**Why now:** Mike considered making RPGFieldbookPrivate public so the app could reach it, and decided
against it (copyrighted text; making a repo private again doesn't recall clones or forks; a takedown
lands on the account that hosts public Fieldbook). A token reaches a private repo without any of
that, and other owners can do the same for their tables.

## 2. Decisions

Mike's, in conversation on 2026-11-05, unless marked **(Claude's call)**.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Who makes the tokens | **The owner makes one read-only token per player** on their own GitHub account: a fine-grained token, resource owner the owner, only that repo, Contents read-only, with an expiry. Players need no GitHub account and are never added to the repo. Deleting one token cuts off one player | Players as collaborators making their own tokens: GitHub ties a fine-grained token to one resource owner and lists collaborator repos as unsupported; the only way round is a classic token, which reads and writes every repo the player can reach |
| 2 | Who the owner is | **Comfortable with a command line and GitHub.** The data kit does the building and releasing | Building and releasing inside the app: that is 2.0's extension builder, to revisit then |
| 3 | How the owner publishes | **Numbered releases, tagged in the repo.** Pushing to `main` publishes nothing | "Push and the table sees it": no versions to match against the app |
| 4 | Release numbers | **They follow the Fieldbook release they are made for:** the first release made with Fieldbook 1.9.0's kit is `1.9.0-1`, then `1.9.0-2`; the first after Fieldbook 1.9.1 is `1.9.1-1`. This is the scheme Fieldbook's own data releases use. Tags are `data-vX.Y.Z-N` **(the tag name: Claude's call, matching Fieldbook's)** | Free version numbers: nothing to tell an app which releases it can run |
| 5 | Which release a player gets | **The newest release made for their Fieldbook or an older one.** A player on 1.9.0 is never offered `1.9.1-1` (decision 3 of #102: `minApp`) | The newest release regardless: it may need app code the player doesn't have |
| 6 | How the app reads a private repo | **Only through GitHub's REST API (`api.github.com`), with the token in an `Authorization` header.** The pack list and files are committed in the repo at the release's tag, in `releases/data/`, as v1.9.0 carries them publicly | `raw.githubusercontent.com`: the browser refuses any request to it that carries a token (spike, §8). Release attachments: their download redirects, and the browser refuses the redirect (spike, §8; #102 found the same) |
| 7 | What the owner sends a player | **One thing to paste**, holding the repo's address and the token together (§5.1) | Two fields to fill in: twice the chances to get one wrong |
| 8 | Where the token is kept | **On the device only**, in `settings`. Never in a character file, never in the Settings file export, never on screen after it is entered | In the settings export: that file gets passed around |
| 9 | When a token stops working | **The source's row says so and what to do** (ask the owner for a new one), and offers to replace the token. Installed packs keep working | Removing the source or its packs: deletion behind the player's back (#102 decision 13) |
| 10 | The guide | **A new player-facing page that ships in the app's zip.** `docs/` goes from three files to four | Only in the kit's README: an owner sets up the repo and the tokens before they ever open the kit |
| 11 | Hosts | **GitHub only** | GitLab and others: no one has asked; each has its own token and CORS rules |
| 12 | A public repo | **The token is optional (Claude's call).** A public repo laid out the same way works with its address alone | Refusing it: extra code to forbid something that works by itself |
| 13 | Installed private packs in the Settings export | **They stay in it**, as every installed pack does: the export is the player's own backup, and the owner chose to trust them with the packs. The guide tells owners plainly that a player who installs a pack holds a full copy of it | Leaving them out: the export filtered by where each pack came from, and an import that has to explain the gaps, to guard text the player already has |

## 3. Goals, non-goals and anti-goals

**Goals**
- An owner who follows the guide ends with a private repo their players can install from and
  update from, without help.
- A player pastes one thing and sees the owner's packs on the Extensions page.
- Mike's devices install and update the private packs through Extensions.
- Every behaviour of a manifest source carries over: the boot check, the pill and its ×, Install,
  Update, Update all, the all-or-nothing plan, the sha256 check, `requires` chips, Unsupported.

**Non-goals**
- Building or releasing packs from inside the app (2.0's extension builder).
- Hosts other than GitHub.
- Write access, uploading, or anything the app does to the owner's repo.
- Automating token creation: the owner makes tokens on GitHub's site, following the guide.
- Changing how the built-in official source works.

**Anti-goals** (failures even if it otherwise works)
- A token leaving the device: in an export, a backup, a URL, an error message, a toast, the console,
  or a request to any host other than `api.github.com`.
- A token with more reach than one repo, read-only, being what the guide tells owners to make.
- Private pack text reaching a public file or a public release.
- An expired or deleted token breaking the packs already installed, or the boot.
- A player being offered a pack built for a newer Fieldbook.

## 4. Constraints

- CLAUDE.md's three: one offline file; storage failures say so; old saves load. A new field on a
  source entry is optional and defaulted, and a Settings file from before this change still imports.
- **Network calls (constraint 2):** checking a private source is one of "the extension sources'
  manifest checks (at boot and on Check now)"; installing is a download the player starts. Both are
  optional and fail quietly offline. No new kind of call. Reword the constraint only if the docs
  suite needs the host named.
- Every fetch keeps #102's timeouts, caps (64 KiB manifest, 32 MiB pack) and sha256 check.
- GitHub's rate limit with a token is 5,000 requests an hour per token. Without one it is 60 an hour
  per address, shared with the official source's checks (#149 already counts those).

## 5. How it works

### 5.1 What the owner sends

One line, the **source link**:

```
https://github.com/<owner>/<repo>#token=<token>
```

**(Claude's call.)** It reads as a GitHub address, so it is recognisable. The token sits in the part
after `#`, which a browser never sends to a server if the link is clicked. The guide shows how to
build it.

### 5.2 Adding the source (the player)

Sources' URL box (Settings → Extensions → Sources, "+ Add a source URL") also takes:
- a source link (§5.1);
- a bare repo address, `https://github.com/<owner>/<repo>` or `<owner>/<repo>`, with no token, for
  a public repo (decision 12).

The app checks the repo once before adding it (§5.4) and adds it only if a release it can use, or
at least a readable repo, answers. Otherwise it says why, in words, and adds nothing. The token is
taken out of the URL box as soon as it is read, and is never shown again.

A new source kind, **`github`**: `{id, kind:"github", repo:"<owner>/<repo>", token, on, checked,
error, manifest, tag}`. `token` is `""` for a public repo. `tag` is the release last read. The
entry's other fields mean what they mean for a manifest source.

The row shows the repo's name (`owner/repo`) as its address, "private · token ending …abcd" when it
has a token, and the usual "checked *time*" or "couldn't check: *reason*". It offers **Change
token**, which takes a new token or a new source link for the same repo.

### 5.3 Where the token lives

- In `settings.sources` in localStorage (`hw-fb-settings`), on this device only. A save that fails
  says so, as every settings save does.
- **The Settings file export leaves it out.** A `github` source is exported with `token:""`. On
  import, a private source arrives without its token, and its row says it needs one (§5.6).
- It is sent only as `Authorization: Bearer <token>` to `https://api.github.com`, and to no other
  host, whatever a manifest says.
- It never appears in a URL, an error message, a toast, the console, or the DOM after entry, except
  as its last four characters on the row.

### 5.4 Checking a source

`checkSources()` takes `github` sources alongside manifest sources, at boot and on Check now:

1. List the repo's tags: `GET /repos/<owner>/<repo>/tags?per_page=100`, following pages as needed
   (the builder's call how far).
2. Pick the newest `data-vX.Y.Z-N` whose `X.Y.Z` is this app's version or older, by the comparison
   `pickDataRelease()` uses (`dataVerOfTag()`, `dataVerBase()`, `cmpDataVer()`). With none, the
   source has nothing to offer, and the row says "no release for this Fieldbook yet".
3. Read `releases/data/fieldbook-data.json` at that tag:
   `GET /repos/<owner>/<repo>/contents/releases/data/fieldbook-data.json?ref=<tag>` with
   `Accept: application/vnd.github.raw+json`. A 404 here, after the tag list answered, means the
   release has no pack list (a release cut before this change, as RPGFieldbookPrivate's
   `data-v1.8.1-1` and `data-v1.9.0-1` are). The source then has nothing to offer, as the official
   source does with a release from before #102, and the row says so (§5.6). It does not fall back to
   an older tag **(Claude's call: an older release would offer older packs as if current)**.
4. Validate it as any manifest (#102 §3) and store it as the source's `manifest`, with `tag`.

### 5.5 Installing

A `github` source's candidates read each pack file through the same contents call at the source's
`tag`: `contents/releases/data/<file>?ref=<tag>`. The file path is the manifest's relative `file`,
which `validate` already holds to no absolute paths and no `..`. Everything after that is #102's
pipeline: the plan, the sha256 check, all or nothing, `packOrigin`.

### 5.6 When it goes wrong

The row says, in words, and the source keeps its last good manifest:

| GitHub answers | The row says |
|---|---|
| 401 | "The repo refused this token. It may have expired or been deleted: ask the repo's owner for a new one." with Change token |
| 404 with a token, on the tag list | "This token can't see the repo. Check the address, or ask the owner for a new token." (GitHub answers 404, not 403, when a token has no access) |
| 404 on the pack list, after the tag list answered | "The newest release here (data-vX.Y.Z-N) has no pack list for Fieldbook. The owner needs to cut a release with the data kit." Not an error: the row is quiet otherwise |
| 404 without a token | "No public repo at this address. If it's private, add its token." |
| 403 with a rate-limit header | "GitHub's limit for this hour is used up. It will check again later." |
| an imported source with no token | "Needs its token: paste the source link again." with Change token |

None of these is shown at boot except on the row. An install that fails installs nothing (#102).

### 5.7 The owner's side: the data kit

The kit gains a **`release`** command for an owner's repo **(the command's name and flags are the
builder's call)**. From the repo's root, it:
1. finds the packs whose content changed since their last release (`versions --changed`);
2. gives them the next version, `X.Y.Z-N`, where `X.Y.Z` is the Fieldbook version this kit was
   released with and `N` follows the repo's last release for that version (1 if none). The last
   release is the registry's `release` field, which `versions --bump` already writes, so the command
   never needs git to number a release;
3. bundles every pack and writes `releases/data/` (`release-files`, **without** `--public`: an
   owner's licence is their business);
4. validates the folder;
5. prints the git commands to commit it, tag `data-vX.Y.Z-N` and push, and runs none of them.

A kit unzipped outside the Fieldbook repo has no `src/js/30-version.js`, so `app_version()` answers
`""` there today. The kit zip must carry the version it was released with (the builder's call how,
for example a stamp `build.sh`'s `pack_kit` writes).

The repo's layout is the kit's registry layout: `data/packs.json` and a folder per pack under
`data/`, as RPGFieldbookPrivate has. **`release` requires the registry (Claude's call):** it is where
each pack's version and digest and the last release number live, and loose pack files have nowhere
to keep them. The guide shows a minimal repo with one pack, and how to write its `packs.json` entry.

A release that changes no pack is refused, as `data-release.js` refuses one now, except with an
explicit flag (§5.8).

### 5.8 Fieldbook's own private repo

`/release private` (`data-release.js` with `--registry _private-data/data/packs.json`) also writes
`_private-data/releases/data/` without `--public` and adds it to the "Data release" commit before
the tag, so the next private release is installable through Extensions. Mike makes a token for each
of his devices.

**The first one (Claude's call).** No private pack has changed since `data-v1.9.0-1`, and
`data-release.js` refuses a release with nothing changed, so there would be no installable release
until some pack's text changes. `data-release.js` (and the kit's `release`, for an owner moving an
older repo over) gains an explicit flag that cuts a release with no pack changed: only the registry's
`release` moves (to `1.9.0-2`), the pack versions stay, and `releases/data/` is written. `/release
private` offers it, with Mike's Gate 1 and Gate 2 as always, when the newest private tag has no
`releases/data/`. Without the flag, nothing-changed is still refused.

### 5.9 The guide

A new `docs/` page (name: the builder's call), added to the zip allowlist in `build.sh` and to
whatever the `docs` suite counts. Written for an owner who knows GitHub, it covers:
1. making the private repo and laying out the packs;
2. getting the data kit and running `release`, then committing, tagging and pushing;
3. making a token per player: the exact GitHub settings (fine-grained; resource owner yourself; only
   this repository; Contents read-only; an expiry), and why not a classic token;
4. building each player's source link (§5.1) and sending it privately;
5. what a player does with it, and what they see;
6. a new release: run `release` again, push, and players see the update;
7. cutting a player off: delete their token. It stops updates, not the copy they have: a player who
   installed a pack holds a full copy of it, in their app and in their Settings file export
   (decision 13);
8. a token that has expired: make a new one and send a new link.

It names no real private content.

## 6. What carries over unchanged

`readManifest()`, `planInstall()`, `runInstall()`, the sha256 check, `packOrigin`,
`dismissedUpdates`, the pill and its ×, Update all, the details dialog, `requires` chips,
Unsupported, Manual install, and the official source.

## 7. Left to the builder

- The kit command's name and flags, and how the kit carries its Fieldbook version.
- How far to page through tags.
- The guide's file name and exact wording, within §5.9.
- The Change token dialog's layout, in the Extensions page's existing style (screenshots in both
  skins, per [screenshot QA](../wiki/process/screenshot-qa.md)).
- Whether `checkSource()` grows a branch or the `github` kind gets its own function.
- Tests, at least: parsing a source link and a bare address; the token never in the settings export,
  never in an error string, never sent to a host other than `api.github.com`; tag picking (newest
  usable, none usable, a newer app's release skipped); each §5.6 answer's wording; an imported
  source without its token; the kit's `release` numbering (first release, a second for the same
  version, a new version) and that it never runs git; nothing-changed refused without the flag and
  cut with it (§5.8); `/release private` writing `releases/data/`; a source whose newest usable tag
  has no pack list (§5.6).
- The one unproven step: a real fine-grained token reading a real private repo from a `file://`
  page. Check it early, with a throwaway token on a scratch repo, not one of Mike's real tokens.

## 8. The spike (2026-11-05)

From the released v1.9.0 `fieldbook.html`, opened as `file://` in Playwright's Chrome, with a fake
token (`github_pat_FAKE…`):

| Request | Result |
|---|---|
| `api.github.com/…/RPGFieldbookPrivate/contents/data/packs.json?ref=main`, `Authorization: Bearer <fake>`, raw Accept | 401 "Bad credentials", readable: the browser allows the call |
| `api.github.com/…/RPGFieldbookPrivate/releases`, same header | 401, readable |
| `api.github.com/…/RPGFieldbook/contents/releases/data/fieldbook-data.json?ref=v1.9.0`, raw Accept, no token | 200, the manifest's text |
| `raw.githubusercontent.com/…/RPGFieldbookPrivate/main/data/packs.json`, `Authorization: token <fake>` | blocked by the browser (`Failed to fetch`) |
| `raw.githubusercontent.com/…/RPGFieldbook/v1.9.0/releases/data/fieldbook-data.json`, same header | blocked |
| a public release asset through the API, `Accept: application/octet-stream` | blocked (the redirect) |

Sources on tokens: GitHub's "Managing your personal access tokens": "Each token is limited to access
resources owned by a single user or organization", and among fine-grained tokens' gaps, "Using
fine-grained personal access token to contribute to repositories where the user is an outside or
repository collaborator."

## 9. Docs to update when built

The ledger; [Settings & updates](../wiki/features/settings-and-updates.md),
[Storage](../wiki/architecture/storage.md), [Data kit](../wiki/data/data-kit.md),
[Data archive](../wiki/architecture/data-archive.md), [Private data](../wiki/data/private-data.md),
[Building & CI](../wiki/process/building-and-ci.md) (the zip allowlist), and
[Decisions](../wiki/decisions.md); CLAUDE.md's "an allowlist of exactly three files" becomes four;
the kit's README; `RELEASING.md` for `/release private`; an `UNRELEASED.md` bullet for players.

## 10. As built (2026-11-05)

Built as designed, in nine tasks (plan `plans/2026-11-05-private-sources.md`). Where it differs or
adds:

- **`--allow-unchanged` works for the public registry too** (§5.8 named private and the kit): one
  flag path, the same rule, in `data-release.js`.
- **`release` defaults are cwd-relative** (R6): `--registry data/packs.json`, `--data-root data`,
  `-o releases/data` from the current directory, since an unzipped kit has no repo around it.
- **The kit's version stamp** is `fieldbook-version.txt`, written by `pack_kit` and read by
  `kit_version()`.
- **The guide, `docs/private-sources.md`,** ships in the app zip and the kit zip. The kit zip is a
  separate release attachment, not inside the app zip.
- **Tag pages have a 1 MiB cap of their own** (`EXT_GH_TAGS_MAX`, up to ten pages of 100): a repo
  with many tags exceeded the 64 KB manifest cap.
- **A source's entry carries `note` and `needsToken`** as well as §5.2's fields; `convertSources()`
  keeps them (R1). Re-pasting a link and Change token clear `needsToken` and the error and re-check
  (R2). A 403 that is not a rate limit uses the "can't see the repo" wording (R3). The API-version
  header is sent on the github source's calls only (R4).

**Verified:** the check outcomes and wordings, the host guard, link parsing, tag picking, add and
replace token, export without the token and import keeping it (`data-archive.js`); `release`, the
stamp, `--any-licence`, restoring the registry (`data-kit.py`); the release scripts in a scratch
repo; the row and Change token driven in the browser (screenshots in the main checkout's
`.claude/qa/in-progress/182-private-sources/`).

**Not verified:** the real-token probe (plan Task 1) against GitHub's live API, and the install on
Mike's devices, each with its own token, after he cuts the first private release with
`releases/data/` (`1.9.0-2`, `--allow-unchanged`). Both are his pass.
