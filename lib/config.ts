export interface SecureReliableNetworkConfig {
  readonly externalAccess?: boolean
}

export interface ContainerServiceConfig {
  readonly taskFamily?: string
  readonly rootDomain?: string
  readonly subdomain?: string
  readonly dnsZoneExists?: boolean
  readonly protocol?: string
  readonly maxScale?: number
  readonly targetUtilization?: number
}

export interface ServerlessRdbConfig {
  readonly engine: string
  readonly version: string
  readonly name: string
  readonly username: string
  readonly createReader?: boolean
  readonly scaleWithWriter?: boolean
}

export interface AppConfig {
  readonly name: string
  readonly network: SecureReliableNetworkConfig
  readonly service: ContainerServiceConfig
  readonly db: ServerlessRdbConfig
}
