import { hashToNumber } from '../utils/hash'

export const variantAssigner = {
  getVariant(userId: string, experimentKey: string, splits: Record<string, number>): string {
    const hash = hashToNumber(`${userId}:${experimentKey}`)
    const random = (hash % 10000) / 10000
    let cumulative = 0

    for (const [variant, percent] of Object.entries(splits)) {
      cumulative += percent
      if (random < cumulative) return variant
    }
    return Object.keys(splits)[Object.keys(splits).length - 1]!
  }
}
