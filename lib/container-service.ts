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
  Vpc,
  SecurityGroup,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2'
import {
  Cluster,
  ContainerImage,
  FargateTaskDefinition,
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
} from './config'

export interface ContainerServiceProps extends ContainerServiceConfig {
  readonly vpc: Vpc
}

export class ContainerService extends Resource {

  public securityGroup: SecurityGroup

  constructor(scope: Construct, id: string, props: ContainerServiceProps) {
    super(scope, id)
    let domainName
    let domainZone
    const rootDomain = props.rootDomain
    if (rootDomain) {
      domainName = (props.subdomain ? props.subdomain + '.' : '') + rootDomain
      domainZone = props.dnsZoneExists ?
        HostedZone.fromLookup(this, 'ServiceHostedZone', {
          domainName: rootDomain,
        }) :
        new HostedZone(this, 'ServiceHostedZone', {
          zoneName: rootDomain,
        })
    }
    const protocol = props.protocol == 'http' ? ApplicationProtocol.HTTP : ApplicationProtocol.HTTPS
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
    this.securityGroup = securityGroup
    const securityGroups = [
      securityGroup,
    ]
    const cluster = new Cluster(this, 'ServiceCluster', {
      containerInsights: true,
      vpc,
    })
    const taskDefinition = new FargateTaskDefinition(this, 'ServiceTask', {
      family: props.taskFamily,
    })
    const directory = join(__dirname, 'demo')
    const image = ContainerImage.fromAsset(directory)
    const portMappings = [{
      containerPort: 8080,
    }]
    taskDefinition.addContainer('TaskContainer', {
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
