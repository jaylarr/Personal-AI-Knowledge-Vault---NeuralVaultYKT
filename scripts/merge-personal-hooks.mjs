// Insert only new JSON members/items; preserve every existing byte and reject ambiguous keys.
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 1048576) throw Error("Hook configuration too large");
}
JSON.parse(raw);
let cursor = 0;
function whitespace() {
  while (/\s/.test(raw[cursor] ?? "") && cursor < raw.length) cursor++;
}
function string() {
  const start = cursor++;
  while (cursor < raw.length) {
    if (raw[cursor++] === "\\") cursor++;
    else if (raw[cursor - 1] === '"') return JSON.parse(raw.slice(start, cursor));
  }
  throw Error("Invalid JSON string");
}
function value() {
  whitespace();
  const start = cursor,
    properties = new Map();
  if (raw[cursor] === '"') {
    string();
    return { start, end: cursor, type: "value", properties };
  }
  const opening = raw[cursor];
  if (opening === "{" || opening === "[") {
    cursor++;
    whitespace();
    const close = opening === "{" ? "}" : "]";
    if (raw[cursor] !== close)
      do {
        whitespace();
        let key;
        if (opening === "{") {
          key = string();
          whitespace();
          if (raw[cursor++] !== ":") throw Error("Invalid JSON object");
        }
        const child = value();
        if (key !== undefined) {
          if (properties.has(key)) throw Error("Duplicate JSON key");
          properties.set(key, child);
        }
        whitespace();
        if (raw[cursor] !== ",") break;
        cursor++;
      } while (cursor < raw.length);
    if (raw[cursor++] !== close) throw Error("Invalid JSON collection");
    return { start, end: cursor, type: opening === "{" ? "object" : "array", properties };
  }
  while (cursor < raw.length && !/[\s,\]}]/.test(raw[cursor])) cursor++;
  return { start, end: cursor, type: "value", properties };
}
const root = value(),
  parsed = JSON.parse(raw),
  command = process.argv[2];
if (root.type !== "object" || typeof command !== "string")
  throw Error("Hook object/command required");
const group = {
  description: "atlas-personal-v1",
  hooks: [{ type: "command", command, timeout: 3 }],
};
const events = ["SessionStart", "PreCompact", "Stop", "Interrupt", "SessionEnd"];
const edits = [];
function member(node, key, content) {
  edits.push({
    at: node.end - 1,
    text: `${node.properties.size ? "," : ""}${JSON.stringify(key)}:${content}`,
  });
}
const hooks = root.properties.get("hooks");
if (!hooks)
  member(root, "hooks", JSON.stringify(Object.fromEntries(events.map((name) => [name, [group]]))));
else {
  if (hooks.type !== "object") throw Error("hooks must be an object");
  const missing = [];
  for (const event of events) {
    const node = hooks.properties.get(event),
      items = parsed.hooks[event];
    if (!node) {
      missing.push(`${JSON.stringify(event)}:${JSON.stringify([group])}`);
      continue;
    }
    if (node.type !== "array" || !Array.isArray(items)) throw Error("Hook event must be an array");
    const own = items.filter((item) => item.description === group.description);
    if (own.length > 1 || (own.length === 1 && JSON.stringify(own[0]) !== JSON.stringify(group)))
      throw Error("Existing personal hook differs; preserve and inspect");
    if (!own.length)
      edits.push({ at: node.end - 1, text: `${items.length ? "," : ""}${JSON.stringify(group)}` });
  }
  if (missing.length)
    edits.push({
      at: hooks.end - 1,
      text: `${hooks.properties.size ? "," : ""}${missing.join(",")}`,
    });
}
for (const edit of edits.sort((a, b) => b.at - a.at))
  raw = raw.slice(0, edit.at) + edit.text + raw.slice(edit.at);
JSON.parse(raw);
process.stdout.write(raw);
