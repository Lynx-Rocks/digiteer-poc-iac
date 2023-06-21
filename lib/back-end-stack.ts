import {
  Construct,
} from 'constructs'
import {
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import {
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
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
  WebFirewall,
} from './web-firewall'
import {
  ContainerDeployment,
} from './container-deployment'
import {
  AppConfig
} from '../config'

export interface BackEndProps extends StackProps, AppConfig {
  readonly vpc?: Vpc
}

export class BackEndStack extends Stack {

  public readonly vpc: Vpc

  constructor(scope: Construct, id: string, props: BackEndProps) {
    super(scope, id, props)
    const gatewayEndpointServices = [
      // Pulling a CDK image asset requires ECS task to access S3.
      GatewayVpcEndpointAwsService.S3,
    ]
    const interfaceEndpointServices = [
      // Pulling a CDK image asset requires ECS task to access ECR.
      InterfaceVpcEndpointAwsService.ECR,
      InterfaceVpcEndpointAwsService.ECR_DOCKER,
      // The service may need to send logs to CloudWatch.
      InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    ]
    const network = new SecureReliableNetwork(this, 'Network', {
      ...props.network,
      vpc: props.vpc,
      gatewayEndpointServices,
      interfaceEndpointServices,
    })
    this.vpc = network.vpc
    const dependencies = [
      ...network.gatewayEndpoints,
      ...network.interfaceEndpoints,
    ]
    const service = new ContainerService(this, 'Service', {
      ...props.service,
      vpc: network.vpc,
      dependencies,
    })
    const db = new ServerlessRdb(this, 'Db', {
      ...props.db,
      vpc: network.vpc,
      peerSecurityGroup: service.albService.service.connections.securityGroups[0],
    })
    const firewall = new WebFirewall(this, 'Firewall', {
      ...props.firewall,
      loadBalancer: service.albService.loadBalancer,
    })
    const appId = `${props.name}At${props.stage}`
    const deployment = new ContainerDeployment(this, 'Deployment', {
      ...props.deployment,
      appId,
      service: service.albService.service,
      loadBalancer: service.albService.loadBalancer,
      targetGroup: service.albService.targetGroup,
      containerDefinition: service.containerDefinition,
      protocol: service.protocol,
      vpc: network.vpc,
    })
  }

}
