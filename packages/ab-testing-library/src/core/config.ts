type HashingConfig = {
  salt: string
  version: number
}

let hashingConfig: HashingConfig = {
  salt: 'ablib-dev',
  version: 1
}

export function setHashingConfig(config: Partial<HashingConfig>) {
  hashingConfig = { ...hashingConfig, ...config }
}

export function getHashingConfig(): HashingConfig {
  return hashingConfig
}
