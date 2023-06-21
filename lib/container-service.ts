import {
  join,
} from 'path'
import {
  Construct,
  IDependable,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  IVpc,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2'
import {
  IHostedZone,
} from 'aws-cdk-lib/aws-route53'
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
  ContainerServiceConfig,
} from '../config'

export interface ContainerServiceProps extends ContainerServiceConfig {
  readonly vpc: IVpc
  readonly domainName?: string
  readonly domainZone?: IHostedZone
  readonly dependencies?: IDependable[]
}

export class ContainerService extends Resource {

  public readonly albService: ApplicationLoadBalancedFargateService
  public readonly containerDefinition: ContainerDefinition
  public readonly protocol: ApplicationProtocol

  constructor(scope: Construct, id: string, props: ContainerServiceProps) {
    super(scope, id)
    const protocol = props.protocol == 'http' ? ApplicationProtocol.HTTP : ApplicationProtocol.HTTPS
    this.protocol = protocol
    const deploymentController = {
      type: DeploymentControllerType.CODE_DEPLOY,
    }
    const vpc = props.vpc
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
    const domainName = props.domainName
    const domainZone = props.domainZone
    if (protocol == ApplicationProtocol.HTTPS && !(domainName && domainZone)) {
      throw new Error('HTTPS protocol requires a domain.')
    }
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
    const dependencies = props.dependencies || []
    for (const dependency of dependencies) {
      albService.node.addDependency(dependency)
    }
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
