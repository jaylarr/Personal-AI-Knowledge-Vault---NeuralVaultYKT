import { createHash } from "node:crypto";
import type { KnowledgeFields, LocalNote, LocalContextInput } from "@atlas/contracts";

export function knowledgeDigest(k: KnowledgeFields, markdown: string) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type: k.type,
        scope: k.scope,
        key: k.key,
        summary: k.summary,
        rationale: k.rationale ?? null,
        applies_when: k.applies_when,
        exceptions: [...k.exceptions].sort(),
        topics: [...k.topics].sort(),
        basis: k.basis,
        markdown: markdown.trim(),
      }),
    )
    .digest("hex");
}
export const conceptKey = (n: LocalNote) =>
  n.knowledge
    ? `${n.knowledge.scope}:${n.knowledge.scope === "owner" ? "owner" : n.project_id}:${n.knowledge.key}`
    : null;

export function resolveKnowledgeHeads(input: LocalNote[]) {
  const notes = input.map(
    (n) => ({ ...n, effective_state: n.knowledge?.state ?? "legacy" }) as LocalNote,
  );
  const warnings: string[] = [],
    groups = new Map<string, LocalNote[]>();
  for (const n of notes) {
    const key = conceptKey(n);
    if (key) groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const byId = new Map(notes.map((n) => [n.id, n]));
  for (const [key, group] of groups) {
    let conflict = false;
    const superseded = new Set<string>();
    for (const n of group) {
      for (const id of n.knowledge?.supersedes ?? []) {
        const prior = byId.get(id);
        if (
          !prior ||
          conceptKey(prior) !== key ||
          (n.knowledge?.state === "candidate" && prior.knowledge?.state === "active")
        ) {
          conflict = true;
          continue;
        }
        superseded.add(id);
      }
      const visiting = new Set<string>();
      let current: LocalNote | undefined = n;
      while (current) {
        if (visiting.has(current.id)) {
          conflict = true;
          break;
        }
        visiting.add(current.id);
        const priorId: string | undefined = current.knowledge?.supersedes[0];
        current = priorId ? byId.get(priorId) : undefined;
      }
    }
    if (group.filter((n) => n.knowledge?.state === "active" && !superseded.has(n.id)).length > 1)
      conflict = true;
    for (const n of group)
      n.effective_state = conflict
        ? "conflict"
        : superseded.has(n.id)
          ? "superseded"
          : (n.knowledge?.state ?? "legacy");
    if (conflict)
      warnings.push(`Conflicting knowledge ${key}: inspect linked versions; no automatic winner`);
  }
  return { notes, warnings };
}

export function selectKnowledgeContext(
  notes: LocalNote[],
  projectId: string,
  input: LocalContextInput,
) {
  const priority = { constraint: 0, preference: 1, decision: 2, lesson: 3, project_fact: 4 };
  const stable = (a: LocalNote, b: LocalNote) =>
    priority[a.knowledge?.type ?? "project_fact"] - priority[b.knowledge?.type ?? "project_fact"] ||
    (a.knowledge?.key ?? "").localeCompare(b.knowledge?.key ?? "") ||
    a.id.localeCompare(b.id);
  let eligible = notes.filter(
    (n) =>
      !n.archived &&
      n.knowledge &&
      n.effective_state === "active" &&
      (n.knowledge.scope === "owner" || n.project_id === projectId),
  );
  if (input.query.trim()) {
    const tokens = [
      ...new Set(
        (input.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length >= 2),
      ),
    ];
    const score = (n: LocalNote) => {
      const strong =
        `${n.title} ${n.knowledge?.key} ${n.knowledge?.summary} ${n.knowledge?.topics.join(" ")}`.toLowerCase();
      const weak = `${n.markdown} ${n.knowledge?.applies_when}`.toLowerCase();
      return tokens.reduce((s, t) => s + (strong.includes(t) ? 10 : weak.includes(t) ? 1 : 0), 0);
    };
    eligible = eligible
      .filter((n) => score(n) > 0)
      .sort((a, b) => score(b) - score(a) || stable(a, b));
  } else {
    const owner = eligible.filter((n) => n.knowledge?.scope === "owner").sort(stable);
    const project = eligible.filter((n) => n.knowledge?.scope === "project").sort(stable);
    eligible = [];
    for (let i = 0; i < Math.max(owner.length, project.length); i++) {
      const a = owner[i],
        b = project[i];
      if (a) eligible.push(a);
      if (b) eligible.push(b);
    }
  }
  const selected: LocalNote[] = [];
  let truncated = false;
  for (const n of eligible) {
    const summary = input.detail === "summary" && !n.modified_since_capture;
    const item = summary
      ? { ...n, markdown: n.knowledge?.summary ?? n.markdown, context_excerpt: true }
      : n;
    if (
      selected.length >= input.limit ||
      JSON.stringify([...selected, item]).length > input.character_budget
    ) {
      truncated = true;
      continue;
    }
    selected.push(item);
  }
  return { notes: selected, truncated };
}
