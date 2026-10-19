export type RenderQuality = "high" | "medium" | "low";
export const QUALITY_PROFILES = {
  high: { dprCap: 2, samples: 4, edgeSegments: 24, bloom: true },
  medium: { dprCap: 1.5, samples: 2, edgeSegments: 16, bloom: true },
  low: { dprCap: 1, samples: 0, edgeSegments: 10, bloom: false },
} as const;
export function resolveDpr(quality: RenderQuality, dpr: number) {
  return Math.min(QUALITY_PROFILES[quality].dprCap, Math.max(1, Number.isFinite(dpr) ? dpr : 1));
}
