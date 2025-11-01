import { hashToBucketWithSalt } from './hash'
import { getNormalizedSplitsCached } from '../experiments/splitUtils'
import { getHashingConfig } from './config'

export const variantAssigner = {
  getVariant(userId: string, experimentKey: string, splits: Record<string, number>): string {
    const buckets = getNormalizedSplitsCached(experimentKey, splits)
    const cfg = getHashingConfig()
    const r = hashToBucketWithSalt(userId, experimentKey, { salt: cfg.salt, version: cfg.version })
    for (const b of buckets) {
      if (r < b.cumulative) return b.key
    }
    return buckets[buckets.length - 1]!.key
  }
}
