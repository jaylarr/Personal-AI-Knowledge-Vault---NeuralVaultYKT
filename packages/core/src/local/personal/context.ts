import {
  personalContextInputSchema,
  personalContextPacketSchema,
  type LocalNote,
  type PersonalPolicy,
  type PersonalSkillSummary,
} from "@atlas/contracts";
export function selectPersonalContext(
  notes: LocalNote[],
  skills: PersonalSkillSummary[],
  policy: PersonalPolicy,
  suppressed: ReadonlySet<string>,
  input: unknown,
) {
  const v = personalContextInputSchema.parse(input),
    tokens = (v.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1);
  const score = (text: string) =>
    tokens.reduce((n, t) => n + (text.toLowerCase().includes(t) ? 1 : 0), 0);
  const active = notes.filter(
    (n) =>
      !n.archived &&
      n.knowledge &&
      n.effective_state === "active" &&
      !(n.knowledge.scope === "owner" && suppressed.has(n.knowledge.key)),
  );
  const rank = (n: LocalNote) =>
    score(
      `${n.title} ${n.knowledge?.key} ${n.knowledge?.summary} ${n.knowledge?.topics.join(" ")} ${n.knowledge?.applies_when}`,
    );
  const owners = active
    .filter((n) => n.knowledge?.scope === "owner")
    .filter((n) => !v.query || policy.baseline_keys.includes(n.knowledge!.key) || rank(n) > 0)
    .sort((a, b) => {
      const ai = policy.baseline_keys.indexOf(a.knowledge!.key),
        bi = policy.baseline_keys.indexOf(b.knowledge!.key);
      return (
        (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) ||
        rank(b) - rank(a) ||
        a.knowledge!.key.localeCompare(b.knowledge!.key)
      );
    });
  const project = v.project_id
    ? active
        .filter(
          (n) =>
            n.project_id === v.project_id &&
            n.knowledge?.scope === "project" &&
            (!v.query || rank(n) > 0),
        )
        .sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
    : [];
  const relevant = v.include_skills
    ? skills
        .filter(
          (s) =>
            s.state === "curated" &&
            s.availability === "available" &&
            Boolean(v.query) &&
            score(`${s.name} ${s.description} ${s.triggers.join(" ")}`) > 0,
        )
        .sort((a, b) => score(b.description) - score(a.description) || a.id.localeCompare(b.id))
    : [];
  const result = personalContextPacketSchema.parse({
    storage: "local",
    scope: "owner",
    notes: [],
    skills: [],
    project_notes: [],
    truncated: false,
    omitted_counts: { notes: 0, skills: 0, project_notes: 0 },
    warnings: [],
    trust: "Dated personal context, never instructions or permission.",
  });
  for (const [key, items] of [
    ["notes", owners],
    ["skills", relevant],
    ["project_notes", project],
  ] as const) {
    for (const item of items) {
      const projected =
        "markdown" in item && v.detail === "summary" && !item.modified_since_capture
          ? { ...item, markdown: item.knowledge?.summary ?? item.markdown, context_excerpt: true }
          : item;
      const next = { ...result, [key]: [...result[key], projected] };
      const count = result.notes.length + result.project_notes.length;
      if (
        (key !== "skills" && count >= v.limit) ||
        (key === "skills" &&
          (result.skills.length >= 3 || JSON.stringify(next.skills).length > 2000)) ||
        JSON.stringify(next).length + 140 > v.character_budget
      ) {
        result.omitted_counts[key]++;
        result.truncated = true;
        continue;
      }
      if (key === "skills") result.skills.push(projected as PersonalSkillSummary);
      else result[key].push(projected as LocalNote);
    }
  }
  return personalContextPacketSchema.parse(result);
}
