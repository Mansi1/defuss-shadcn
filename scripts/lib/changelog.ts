/**
 * Why: the changelog (`src/documentation/changelog.html`) is the human-facing
 * release history, but package.json alone proves a version was cut. These pure
 * helpers let both `verify.ts` (hard gate) and unit tests evaluate "does the
 * committed version have a changelog entry, and does that entry carry the git
 * hash of the changelog commit (or a release date for legacy entries)?"
 * without touching the filesystem or git — callers inject those side effects.
 */

/** Class of the `<code>` element embedding the changelog commit's short hash. */
export const CHANGELOG_HASH_CLASS = 'changelog-hash';

/** The marker deploy.sh injects new entries after; entries live below it. */
export const CHANGELOG_MARKER = '<!-- CHANGELOG_ENTRIES -->';

/** The repair instruction embedded in every failure: two commits, entry first. */
export const FIX_TWO_COMMITS =
  'add the v<version> entry to src/documentation/changelog.html in its own commit (all commit messages since the last release), then a second commit that embeds the first commit\'s short hash as <code class="changelog-hash">abc1234</code> in that entry — `bun run docs` after each (deploy.sh automates both)';

export type ChangelogEntry = {
  version: string;
  /** Release-date badge text; '' when absent. */
  date: string;
  /** Short git hash of the changelog commit; null when absent. */
  hash: string | null;
  /** `<li>` texts (commit messages) in document order. */
  messages: string[];
};

/** Result of resolving a hash against the repository (injected by the caller). */
export type CommitInfo = { exists: true; touchesChangelog: boolean } | null;

// '&' built via char code so no source tool/entity normalizer can mangle the
// entity keys below (the search-index.ts header documents this exact trap).
const AMP = String.fromCharCode(38);
const HTML_ENTITIES: Record<string, string> = {
  [AMP + 'lt;']: '<',
  [AMP + 'gt;']: '>',
  [AMP + 'quot;']: '"',
  [AMP + '#39;']: "'",
  [AMP + 'amp;']: AMP,
};
const ENTITY_RE = new RegExp(AMP + '(?:lt|gt|quot|#39|amp);', 'g');

/**
 * Why: single-pass entity decoding. Sequential replaces would double-decode
 * (an escaped "&" followed by "lt;" resolving twice), corrupting commit
 * messages — the v0.7.14 entry documents a rename written with an escaped ">".
 */
function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/**
 * Why: parse the changelog page into structured entries so the gate can ask
 * structural questions (which versions exist? which carry a hash?) without
 * brittle one-off regexes at every call site. Entries are the blocks deploy.sh
 * generates below the CHANGELOG_MARKER; anything above it is page chrome.
 */
export function parseChangelogEntries(html: string): ChangelogEntry[] {
  const afterMarker = html.split(CHANGELOG_MARKER)[1] ?? '';
  // Each entry div starts with the inline style deploy.sh emits; splitting on
  // it yields one fragment per entry (fragment 0 is the page preamble).
  const fragments = afterMarker.split('margin-bottom:2.5rem').slice(1);
  const entries: ChangelogEntry[] = [];
  for (const f of fragments) {
    const version = f.match(/<h2[^>]*>\s*v([0-9][^<\s]*)\s*<\/h2>/)?.[1];
    if (!version) continue; // fragment past the last entry (page footer)
    const date = f.match(/<span class="badge"[^>]*>([^<]*)<\/span>/)?.[1]?.trim() ?? '';
    const hash =
      f.match(new RegExp(`<code class="${CHANGELOG_HASH_CLASS}"[^>]*>([0-9a-f]{7,40})</code>`))?.[1] ??
      null;
    // strip REAL tags first, then decode entities once — reversed, escaped
    // angle brackets would become tags and be destroyed by the strip
    const messages = [...f.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim(),
    );
    entries.push({ version, date, hash, messages });
  }
  return entries;
}

/**
 * Inline tags a changelog `<li>` may contain. Changelog entries are commit
 * messages — prose with code spans and links, never rendered UI. Anything
 * outside this list is raw markup leaking through (an entry once embedded a
 * live `<video>` and a raw `<hr>` that rendered INTO the changelog), so the
 * gate rejects it: escape it as `<video>` instead.
 */
export const CHANGELOG_ALLOWED_TAGS = ['li', 'code', 'strong', 'a', 'span', 'em', 'b', 'i', 'kbd'];

/**
 * Why: enforce "changelog entries stay text" — scan each entry's `<li>` bodies
 * for real (non-entity) tags outside the text allowlist. `<video>` is
 * fine (it's text); `<video>` is a live element and fails.
 */
export function changelogMarkupProblems(html: string): string[] {
  const problems: string[] = [];
  const afterMarker = html.split(CHANGELOG_MARKER)[1] ?? '';
  const fragments = afterMarker.split('margin-bottom:2.5rem').slice(1);
  for (const f of fragments) {
    const version = f.match(/<h2[^>]*>\s*v([0-9][^<\s]*)\s*<\/h2>/)?.[1];
    if (!version) continue;
    for (const m of f.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      for (const t of m[1].matchAll(/<(\/?[a-zA-Z][a-zA-Z0-9]*)(?![a-zA-Z0-9])/g)) {
        const name = t[1].replace(/^\//, '').toLowerCase();
        if (!CHANGELOG_ALLOWED_TAGS.includes(name))
          problems.push(`changelog v${version}: <li> contains raw <${t[1]}> — escape as <${name}> (entries are text, not UI)`);
      }
    }
  }
  return [...new Set(problems)];
}

/**
 * Why: the whole "is the changelog honest about the current version?" decision
 * as one pure function — verify.ts feeds it parsed entries plus the two
 * package.json versions (HEAD vs worktree) and a commit resolver; tests feed
 * it fixtures. Problems fail the build; warnings only inform.
 */
export function changelogProblems(args: {
  entries: ChangelogEntry[];
  /** package.json version as committed at HEAD; null when git is unavailable. */
  committedVersion: string | null;
  /** package.json version in the working tree. */
  worktreeVersion: string;
  resolveCommit: (hash: string) => CommitInfo;
}): { problems: string[]; warnings: string[] } {
  const { entries, committedVersion, worktreeVersion, resolveCommit } = args;
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!committedVersion) {
    warnings.push('cannot read the committed package.json version (no git?) — changelog gate skipped');
    return { problems, warnings };
  }

  const current = entries.find((e) => e.version === committedVersion);
  if (!current) {
    problems.push(
      `v${committedVersion} is committed in package.json but changelog.html has no v${committedVersion} entry`,
    );
  } else {
    if (current.messages.length === 0) {
      problems.push(`changelog v${committedVersion} entry lists no commit messages`);
    }
    if (!current.hash) {
      // Once the version is committed the changelog commit hash IS available,
      // so the date-only escape hatch is legacy-only — new entries need it too.
      // (no date at all → the "neither date nor hash" rule below covers it)
      if (current.date) problems.push(`changelog v${committedVersion} entry has a date but no commit hash`);
    } else {
      const info = resolveCommit(current.hash);
      if (!info)
        problems.push(
          `changelog v${committedVersion} hash ${current.hash} does not resolve to a commit in this repository`,
        );
      else if (!info.touchesChangelog)
        problems.push(
          `changelog v${committedVersion} hash ${current.hash} points to a commit that does not touch changelog.html — it must be the commit that added the entry`,
        );
    }
  }

  for (const e of entries) {
    if (!e.date && !e.hash) problems.push(`changelog v${e.version} entry has neither a release date nor a commit hash`);
  }

  if (worktreeVersion !== committedVersion && !entries.some((e) => e.version === worktreeVersion)) {
    warnings.push(
      `package.json was bumped to v${worktreeVersion} (not yet committed) — its changelog entry must exist before that version gets committed`,
    );
  }

  return { problems, warnings };
}
