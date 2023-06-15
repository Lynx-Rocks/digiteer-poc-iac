import {
  Construct,
} from 'constructs'
import {
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import {
  SecureReliableNetwork,
} from './secure-reliable-network'
import {
  ContainerService,
} from './container-service'
import {
  ServerlessRdb,
} from './serverless-rdb'
import {
  ContainerDeployment,
} from './container-deployment'
import {
  AppConfig
} from './config'

export interface BackEndProps extends StackProps, AppConfig {}

export class BackEndStack extends Stack {
  constructor(scope: Construct, id: string, props: BackEndProps) {
    super(scope, id, props)
    const network = new SecureReliableNetwork(this, 'Network', {
      ...props.network,
    })
    const service = new ContainerService(this, 'Service', {
      ...props.service,
      vpc: network.vpc,
    })
    const db = new ServerlessRdb(this, 'Db', {
      ...props.db,
      vpc: network.vpc,
      peerSecurityGroup: service.albService.service.connections.securityGroups[0],
    })
    const deployment = new ContainerDeployment(this, 'Deployment', {
      ...props.deployment,
      service: service.albService.service,
      loadBalancer: service.albService.loadBalancer,
      targetGroup: service.albService.targetGroup,
      containerDefinition: service.containerDefinition,
      protocol: service.protocol,
      vpc: network.vpc,
    })
  }
}
