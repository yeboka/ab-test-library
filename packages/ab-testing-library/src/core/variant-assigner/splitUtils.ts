export type NormalizedSplit = { key: string; weight: number; cumulative: number }

export function normalizeSplits(splits: Record<string, number>): NormalizedSplit[] {
  const entries = Object.entries(splits)
    .map(([key, raw]) => ({ key, weight: Number(raw) }))
    .filter(e => Number.isFinite(e.weight) && e.weight >= 0)

  if (entries.length === 0) return [{ key: 'control', weight: 1, cumulative: 1 }]

  const sum = entries.reduce((s, e) => s + e.weight, 0)
  if (sum <= 0) return [{ key: entries[0].key, weight: 1, cumulative: 1 }]

  entries.sort((a, b) => a.key.localeCompare(b.key))

  const normalized: NormalizedSplit[] = []
  let cumulative = 0
  const epsilon = 1e-10
  for (let i = 0; i < entries.length; i++) {
    const w = entries[i].weight / sum
    cumulative = i === entries.length - 1 ? 1 : Math.min(1, cumulative + w + epsilon)
    normalized.push({ key: entries[i].key, weight: w, cumulative })
  }
  return normalized
}

// Cache normalized splits per experiment key signature to avoid recomputation in hot paths
const cache = new Map<string, NormalizedSplit[]>()

export function getNormalizedSplitsCached(experimentKey: string, splits: Record<string, number>): NormalizedSplit[] {
  const signature = experimentKey + '|' + JSON.stringify(splits)
  const hit = cache.get(signature)
  if (hit) return hit
  const normalized = normalizeSplits(splits)
  cache.set(signature, normalized)
  return normalized
}

export function clearNormalizedSplitsCache() {
  cache.clear()
}
