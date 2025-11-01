// Stable non-crypto 32-bit FNV-1a hash mapped to [0,1)
export function hashToBucket(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 0x100000000
}

export function hashToBucketWithSalt(
  user: { email: string; id: string },
  experimentKey: string,
  opts?: { salt?: string; version?: number }
): number {
  const salt = opts?.salt ?? 'ablib'
  const version = opts?.version ?? 1
  return hashToBucket(`${salt}:${version}:${user.id}${user.email}:${experimentKey}`)
}

// Backwards-compatible helper returning a positive integer (deprecated)
export function hashToNumber(str: string) {
  return Math.floor(hashToBucket(str) * Number.MAX_SAFE_INTEGER)
}
