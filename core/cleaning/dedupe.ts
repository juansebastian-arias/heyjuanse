/**
 * Duplicate detection. A false merge (two people treated as one) is worse than a missed
 * duplicate, because it hides a person from sales and mixes two people's data. So only two
 * rules merge automatically, and the near matches are flagged for a person to check.
 *
 *   M1  Same email, ignoring case and "+tags".                         -> merge
 *   M2  Same company domain, same first name (nicknames resolved)
 *       and same last name.                                            -> merge,
 *       unless both records have job titles and they differ           -> flag
 *   M3  Same company domain, same last name, first names that look
 *       alike (Jaro-Winkler >= 0.9) but are not the same name.         -> flag, never merge
 */
import { jaroWinkler } from "../text";
import { type CleanRecord, canonicalFirstName, lastNameKey, titleKey } from "./normalize";

export type MergeRule = "M1" | "M2";
export type FlagRule = "M2_TITLE_CONFLICT" | "M3_SIMILAR_NAME";

export interface MergeLink {
  a: string;
  b: string;
  rule: MergeRule;
  reason: string;
}

export interface DuplicateFlag {
  a: string;
  b: string;
  rule: FlagRule;
  reason: string;
}

export interface DedupeResult {
  /** Raw ids per lead, each group in arrival order, groups ordered by first arrival. */
  groups: string[][];
  links: MergeLink[];
  /** Possible duplicates that were deliberately left separate. */
  flags: DuplicateFlag[];
}

export const SIMILAR_NAME_THRESHOLD = 0.9;

/** The duplicate rules in plain language, for the site. The code below implements them. */
export const DUPLICATE_RULES = [
  {
    code: "M1",
    when: "Same email address, ignoring capital letters and “+tags”.",
    action: "Merge.",
  },
  {
    code: "M2",
    when: "Same company domain, same first name (nicknames resolved, so Bill matches William) and same last name.",
    action:
      "Merge, unless both records have job titles and the titles differ. Then flag for a person.",
  },
  {
    code: "M3",
    when: `Same company domain and last name, with first names that look alike (Jaro-Winkler similarity of ${SIMILAR_NAME_THRESHOLD} or more) but are not the same name.`,
    action: "Flag for a person. Never merge.",
  },
] as const;

/** The company domain a record can be matched on: a corporate email domain, else the website. */
export function matchDomain(record: CleanRecord): string | null {
  if (record.emailStatus === "valid" && !record.isFreemail && record.emailDomain) {
    return record.emailDomain;
  }
  return record.websiteDomain;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    let root = id;
    while (this.parent.get(root) !== undefined && this.parent.get(root) !== root) {
      root = this.parent.get(root) ?? root;
    }
    // Path compression.
    let node = id;
    while (node !== root) {
      const next = this.parent.get(node) ?? root;
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    // Keep the earlier id as the root, so lead ids follow first arrival.
    if (rootA < rootB) this.parent.set(rootB, rootA);
    else this.parent.set(rootA, rootB);
    return true;
  }
}

function describe(record: CleanRecord): string {
  return [record.firstName, record.lastName].filter(Boolean).join(" ") || record.rawId;
}

export function dedupe(records: CleanRecord[]): DedupeResult {
  const ordered = [...records].sort(
    (a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.rawId.localeCompare(b.rawId),
  );
  const uf = new UnionFind();
  for (const record of ordered) uf.find(record.rawId);
  const links: MergeLink[] = [];
  const candidateFlags: DuplicateFlag[] = [];

  // M1: same email key.
  const byEmail = new Map<string, CleanRecord>();
  for (const record of ordered) {
    if (!record.emailKey) continue;
    const first = byEmail.get(record.emailKey);
    if (!first) {
      byEmail.set(record.emailKey, record);
      continue;
    }
    if (uf.union(first.rawId, record.rawId)) {
      const sameText = first.email === record.email;
      links.push({
        a: first.rawId,
        b: record.rawId,
        rule: "M1",
        reason: sameText
          ? `Same email address (${record.emailKey})`
          : `Same email address once case and "+tags" are ignored (${record.emailKey})`,
      });
    }
  }

  // Job titles known for each merged group, keyed by the group's root id.
  const titlesByRoot = new Map<string, Set<string>>();
  for (const record of ordered) {
    const root = uf.find(record.rawId);
    const set = titlesByRoot.get(root) ?? new Set<string>();
    const key = titleKey(record.jobTitle);
    if (key) set.add(key);
    titlesByRoot.set(root, set);
  }
  const titlesOf = (rawId: string): Set<string> => titlesByRoot.get(uf.find(rawId)) ?? new Set();

  // M2 and M3: same company domain.
  const byDomain = new Map<string, CleanRecord[]>();
  for (const record of ordered) {
    const domain = matchDomain(record);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(record);
    byDomain.set(domain, list);
  }

  for (const [domain, group] of byDomain) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!a || !b) continue;
        const lastA = lastNameKey(a.lastName);
        const lastB = lastNameKey(b.lastName);
        const firstA = canonicalFirstName(a.firstName);
        const firstB = canonicalFirstName(b.firstName);
        if (!lastA || !lastB || !firstA || !firstB || lastA !== lastB) continue;
        if (firstA === firstB) {
          if (uf.find(a.rawId) === uf.find(b.rawId)) continue;
          // Compare every title already known for either side, so a chain of merges can't
          // join two people whose titles conflict.
          const titles = new Set([...titlesOf(a.rawId), ...titlesOf(b.rawId)]);
          if (titles.size > 1) {
            candidateFlags.push({
              a: a.rawId,
              b: b.rawId,
              rule: "M2_TITLE_CONFLICT",
              reason: `Same name at ${domain}, but different job titles ("${a.jobTitle}" and "${b.jobTitle}")`,
            });
            continue;
          }
          const merged = [...titlesOf(a.rawId), ...titlesOf(b.rawId)];
          if (uf.union(a.rawId, b.rawId)) {
            titlesByRoot.set(uf.find(a.rawId), new Set(merged));
            const nickname =
              a.firstName && b.firstName && a.firstName.toLowerCase() !== b.firstName.toLowerCase();
            links.push({
              a: a.rawId,
              b: b.rawId,
              rule: "M2",
              reason: nickname
                ? `Same person at ${domain}: "${a.firstName}" and "${b.firstName}" are the same first name`
                : `Same name (${describe(b)}) at ${domain}`,
            });
          }
        } else if (jaroWinkler(firstA, firstB) >= SIMILAR_NAME_THRESHOLD) {
          candidateFlags.push({
            a: a.rawId,
            b: b.rawId,
            rule: "M3_SIMILAR_NAME",
            reason: `Similar names at ${domain} ("${describe(a)}" and "${describe(b)}"), kept separate`,
          });
        }
      }
    }
  }

  const groupsByRoot = new Map<string, string[]>();
  for (const record of ordered) {
    const root = uf.find(record.rawId);
    const list = groupsByRoot.get(root) ?? [];
    list.push(record.rawId);
    groupsByRoot.set(root, list);
  }
  const groups = [...groupsByRoot.values()];
  // A flag between records that ended up merged anyway is no longer useful.
  const flags = candidateFlags.filter((flag) => uf.find(flag.a) !== uf.find(flag.b));
  return { groups, links, flags };
}
