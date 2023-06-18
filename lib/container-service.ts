import {
  join,
} from 'path'
import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  IVpc,
  SecurityGroup,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2'
import {
  Cluster,
  AssetImage,
  FargateTaskDefinition,
  ContainerDefinition,
  DeploymentControllerType,
} from 'aws-cdk-lib/aws-ecs'
import {
  ApplicationLoadBalancedFargateService,
} from 'aws-cdk-lib/aws-ecs-patterns'
import {
  ApplicationProtocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {
  HostedZone,
} from 'aws-cdk-lib/aws-route53'
import {
  ContainerServiceConfig,
} from '../config'

export interface ContainerServiceProps extends ContainerServiceConfig {
  readonly vpc: IVpc
}

export class ContainerService extends Resource {

  public readonly albService: ApplicationLoadBalancedFargateService
  public readonly containerDefinition: ContainerDefinition
  public readonly protocol: ApplicationProtocol

  constructor(scope: Construct, id: string, props: ContainerServiceProps) {
    super(scope, id)
    let domainName
    let domainZone
    const rootDomain = props.rootDomain
    if (rootDomain) {
      domainName = (props.subdomain ? `${props.subdomain}.` : '') + rootDomain
      domainZone = props.dnsZoneExists ?
        HostedZone.fromLookup(this, 'ServiceHostedZone', {
          domainName: rootDomain,
        }) :
        new HostedZone(this, 'ServiceHostedZone', {
          zoneName: rootDomain,
        })
    }
    const protocol = props.protocol == 'http' ? ApplicationProtocol.HTTP : ApplicationProtocol.HTTPS
    this.protocol = protocol
    if (protocol == ApplicationProtocol.HTTPS && !domainName) {
      throw new Error('HTTPS protocol requires a domain.')
    }
    const deploymentController = {
      type: DeploymentControllerType.CODE_DEPLOY,
    }
    const vpc = props.vpc
    // Pulling a CDK image asset requires ECS task to access S3 and ECR. 
    const s3VpcEndpoint = vpc.addGatewayEndpoint('S3VpcEndpoint', {
      service: GatewayVpcEndpointAwsService.S3,
    })
    const ecrVpcEndpoint = vpc.addInterfaceEndpoint('EcrVpcEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR,
    })
    const dockerVpcEndpoint = vpc.addInterfaceEndpoint('DockerVpcEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
    })
    // The service may need to send logs to CloudWatch.
    vpc.addInterfaceEndpoint('CloudWatchLogsVpcEndpoint', {
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    })
    const securityGroup = new SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
    })
    const securityGroups = [
      securityGroup,
    ]
    const cluster = new Cluster(this, 'ServiceCluster', {
      containerInsights: true,
      vpc,
    })
    const taskDefinition = new FargateTaskDefinition(this, 'ServiceTask')
    const directory = join(__dirname, 'demo')
    const containerPort = props.port || 8080
    const buildArgs = {
      PORT: containerPort.toString(),
    }
    const image = new AssetImage(directory, {
      buildArgs,
    })
    const portMappings = [{
      containerPort,
    }]
    this.containerDefinition = taskDefinition.addContainer('TaskContainer', {
      image,
      portMappings,
    })
    const albService = new ApplicationLoadBalancedFargateService(this, 'Service', {
      taskDefinition,
      domainName,
      domainZone,
      protocol,
      deploymentController,
      securityGroups,
      cluster,
    })
    this.albService = albService
    albService.node.addDependency(s3VpcEndpoint)
    albService.node.addDependency(ecrVpcEndpoint)
    albService.node.addDependency(dockerVpcEndpoint)
    const maxCapacity = props.maxScale || 10
    const scalableTarget = albService.service.autoScaleTaskCount({
      maxCapacity,
    })
    const targetUtilizationPercent = props.targetUtilization || 70
    scalableTarget.scaleOnCpuUtilization('ServiceScale', {
      targetUtilizationPercent,
    })
  }

}
