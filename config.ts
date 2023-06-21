export interface SecureReliableNetworkConfig {
  readonly useFromStage?: string
  readonly allowExternalAccess?: boolean
}

export interface WebDomainConfig {
  readonly useFromStage?: string
  readonly root?: string
}

export interface UniqueWebDomainConfig extends WebDomainConfig {
  readonly sub?: string
}

export interface ContainerServiceConfig {
  readonly protocol?: string
  readonly port?: number
  readonly maxScale?: number
  readonly targetUtilization?: number
  readonly useSpot?: boolean
}

export interface ServerlessRdbConfig {
  readonly engine?: string
  readonly version?: string
  readonly username?: string
  readonly createReader?: boolean
  readonly scaleWithWriter?: boolean
}

export interface WebFirewallConfig {
  readonly core?: boolean
  readonly knownBadInputs?: boolean
  readonly ipReputationList?: boolean
  readonly sqlInjection?: boolean
  readonly linuxVulnerabilities?: boolean
  readonly posixVulnerabilities?: boolean
}

export interface ContainerDeploymentConfig {
  readonly taskFilename?: string
  readonly alarmOnHttp4xx?: boolean
  readonly http4xxThreshold?: number
}

export interface CommonConfig {
  readonly network?: SecureReliableNetworkConfig
  readonly domain?: WebDomainConfig
  readonly service?: ContainerServiceConfig
  readonly db?: ServerlessRdbConfig
  readonly firewall?: WebFirewallConfig
  readonly deployment?: ContainerDeploymentConfig
}

export interface StageConfig {
  readonly name: string
  readonly network?: SecureReliableNetworkConfig
  readonly domain?: UniqueWebDomainConfig
  readonly service?: ContainerServiceConfig
  readonly db?: ServerlessRdbConfig
  readonly firewall?: WebFirewallConfig
  readonly deployment?: ContainerDeploymentConfig
}

export interface AppConfig {
  readonly name: string
  readonly common?: CommonConfig
  readonly stages: StageConfig[]
}
