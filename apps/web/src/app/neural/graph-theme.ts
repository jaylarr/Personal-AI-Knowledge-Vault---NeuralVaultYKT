import { hash } from "./model.js";
export const GRAPH_THEME = {
  background: "#111315",
  fog: "#111315",
  particle: "#65706a",
  selection: "#c5d8aa",
  palette: ["#c5d8aa", "#afbfc9", "#b4c3b2", "#c3c7b5", "#a7b9b7", "#b9b4aa"],
} as const;
export const categoryColor = (id: string) =>
  GRAPH_THEME.palette[hash(id) % GRAPH_THEME.palette.length] ?? GRAPH_THEME.selection;
