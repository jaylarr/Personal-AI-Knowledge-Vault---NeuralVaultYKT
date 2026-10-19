import { type Layout, type LayoutInput, layoutGraph } from "./layout.js";

self.onmessage = (event: MessageEvent<{ graph: LayoutInput; prior: Layout }>) => {
  self.postMessage(layoutGraph(event.data.graph, event.data.prior));
};
