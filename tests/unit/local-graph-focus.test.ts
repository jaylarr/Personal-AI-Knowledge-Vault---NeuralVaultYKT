import { it, expect } from "vitest";
import { graphFocusDistances } from "@atlas/core/local-domain";
it("expands real edges by bounded hop distance through cycles and retains focus priority", () => {
  const edges: [string, string][] = [
    ["chosen", "first"],
    ["first", "second"],
    ["second", "third"],
    ["first", "chosen"],
    ["unrelated", "isolated"],
  ];
  expect([...graphFocusDistances("chosen", edges, 1)]).toEqual([
    ["chosen", 0],
    ["first", 1],
  ]);
  const expanded = graphFocusDistances("chosen", edges, 2);
  expect([...expanded]).toEqual([
    ["chosen", 0],
    ["first", 1],
    ["second", 2],
  ]);
  const order = ["second", "unrelated", "first", "chosen"].sort(
    (a, b) => (expanded.get(a) ?? Infinity) - (expanded.get(b) ?? Infinity) || a.localeCompare(b),
  );
  expect(order.slice(0, 1)).toEqual(["chosen"]);
  expect(graphFocusDistances(undefined, edges, 2).size).toBe(0);
});
