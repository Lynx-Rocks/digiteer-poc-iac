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
  HostedZone,
} from 'aws-cdk-lib/aws-route53'
import {
  SecureReliableNetwork,
} from './secure-reliable-network'
import {
  WebDomain,
} from './web-domain'
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
  StageConfig,
} from '../config'

export interface BackEndProps extends StackProps, StageConfig {
  readonly vpc?: Vpc
  readonly hostedZone?: HostedZone
}

export class BackEndStack extends Stack {

  public readonly vpc: Vpc
  public readonly hostedZone?: HostedZone

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
    const domain = new WebDomain(this, 'Domain', {
      ...props.domain,
      hostedZone: props.hostedZone,
    })
    this.hostedZone = domain.hostedZone
    const dependencies = [
      ...network.gatewayEndpoints,
      ...network.interfaceEndpoints,
    ]
    const service = new ContainerService(this, 'Service', {
      ...props.service,
      vpc: network.vpc,
      domainName: domain.hostName,
      domainZone: domain.hostedZone,
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
