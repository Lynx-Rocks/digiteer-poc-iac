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
      peerSecurityGroup: service.securityGroup,
    })
  }
}
