export interface SecureReliableNetworkConfig {
  readonly useFromStage?: string
  readonly allowExternalAccess?: boolean
}

export interface ContainerServiceConfig {
  readonly rootDomain?: string
  readonly subdomain?: string
  readonly dnsZoneExists?: boolean
  readonly protocol?: string
  readonly port?: number
  readonly maxScale?: number
  readonly targetUtilization?: number
}

export interface ServerlessRdbConfig {
  readonly engine: string
  readonly version: string
  readonly username: string
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

export interface AppConfig {
  stage?: string
  readonly name: string
  readonly network?: SecureReliableNetworkConfig
  readonly service?: ContainerServiceConfig
  readonly db: ServerlessRdbConfig
  readonly firewall?: WebFirewallConfig
  readonly deployment?: ContainerDeploymentConfig
}
