import {
  join,
} from 'path'
import {
  Construct,
} from 'constructs'
import {
  Resource,
  Duration,
  CfnOutput,
} from 'aws-cdk-lib'
import {
  IVpc,
} from 'aws-cdk-lib/aws-ec2'
import {
  IBaseService,
  ContainerDefinition,
} from 'aws-cdk-lib/aws-ecs'
import {
  Pipeline,
  Artifact,
} from 'aws-cdk-lib/aws-codepipeline'
import {
  S3SourceAction,
  S3Trigger,
  LambdaInvokeAction,
  CodeDeployEcsDeployAction,
} from 'aws-cdk-lib/aws-codepipeline-actions'
import {
  AssetCode,
  Runtime,
  Function,
} from 'aws-cdk-lib/aws-lambda'
import {
  RetentionDays,
} from 'aws-cdk-lib/aws-logs'
import {
  Repository,
} from 'aws-cdk-lib/aws-ecr'
import {
  Bucket,
} from 'aws-cdk-lib/aws-s3'
import {
  EcsDeploymentGroup,
  EcsDeploymentConfig,
} from 'aws-cdk-lib/aws-codedeploy'
import {
  Alarm,
  ComparisonOperator,
} from 'aws-cdk-lib/aws-cloudwatch'
import {
  Trail,
  ReadWriteType,
} from 'aws-cdk-lib/aws-cloudtrail'
import {
  IApplicationLoadBalancer,
  ITargetGroup,
  HttpCodeTarget,
  TargetType,
  ApplicationProtocol,
  ApplicationTargetGroup,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {
  ContainerDeploymentConfig,
} from './config'

export interface ContainerDeploymentProps extends ContainerDeploymentConfig {
  readonly stage: string
  readonly service: IBaseService
  readonly loadBalancer: IApplicationLoadBalancer
  readonly targetGroup: ITargetGroup
  readonly containerDefinition: ContainerDefinition
  readonly protocol: ApplicationProtocol
  readonly vpc: IVpc
}

export class ContainerDeployment extends Resource {

  constructor(scope: Construct, id: string, props: ContainerDeploymentProps) {
    super(scope, id)
    const stages = []
    const containerDefinition = props.containerDefinition
    const taskDefinition = containerDefinition.taskDefinition
    const executionRole = taskDefinition.executionRole!
    const repository = new Repository(this, 'ImageRepository', {
      repositoryName: props.repositoryName,
    })
    repository.grantPull(executionRole)
    const repositoryOutputName = `ImageRepositoryIn${props.stage}`
    const repositoryOutput = new CfnOutput(this, repositoryOutputName, {
      value: repository.repositoryName,
      exportName: repositoryOutputName,
    })
    repositoryOutput.overrideLogicalId(repositoryOutputName)
    const bucket = new Bucket(this, 'SourceBucket', {
      versioned: true,
    })
    bucket.grantRead(executionRole)
    const bucketOutputName = `SourceBucketIn${props.stage}`
    const bucketOutput = new CfnOutput(this, bucketOutputName, {
      value: bucket.bucketName,
      exportName: bucketOutputName,
    })
    bucketOutput.overrideLogicalId(bucketOutputName)
    const bucketKey = props.taskFile || 'task.json'
    const trail = new Trail(this, 'Trail')
    trail.addS3EventSelector([{
      bucket,
      objectPrefix: bucketKey,
    }], {
      readWriteType: ReadWriteType.WRITE_ONLY,
    })
    const sourceArtifact = new Artifact('Source')
    const sourceAction = new S3SourceAction({
      actionName: 'SourceAction',
      trigger: S3Trigger.EVENTS,
      output: sourceArtifact,
      bucket,
      bucketKey,
    })
    const sourceActions = [
      sourceAction,
    ]
    const sourceStage = {
      stageName: 'Source',
      actions: sourceActions,
    }
    stages.push(sourceStage)
    const inputs = [
      sourceArtifact,
    ]
    const specsArtifact = new Artifact('Specs')
    const outputs = [
      specsArtifact,
    ]
    const directory = join(__dirname, 'specs')
    const code = new AssetCode(directory)
    const lambda = new Function(this, 'SpecsFunction', {
      code,
      handler: 'handler.on_event',
      runtime: Runtime.PYTHON_3_10,
      timeout: Duration.minutes(1),
      logRetention: RetentionDays.ONE_DAY,
    })
    const userParameters = {
      taskDefinitionArn: taskDefinition.taskDefinitionArn,
      containerName: containerDefinition.containerName,
      containerPort: containerDefinition.containerPort,
      repositoryUri: repository.repositoryUri,
      family: taskDefinition.family,
      taskRoleArn: taskDefinition.taskRole.roleArn,
      executionRoleArn: executionRole.roleArn,
    }
    const specsAction = new LambdaInvokeAction({
      actionName: 'SpecsAction',
      lambda,
      inputs,
      outputs,
      userParameters,
    })
    const specsActions = [
      specsAction,
    ]
    const specsStage = {
      stageName: 'Specs',
      actions: specsActions,
    }
    stages.push(specsStage)
    const loadBalancer = props.loadBalancer
    const blueTargetGroup = props.targetGroup
    const greenTargetGroup = new ApplicationTargetGroup(this, 'GreenTargetGroup', {
      targetType: TargetType.IP,
      protocol: props.protocol,
      vpc: props.vpc,
    })
    const blueGreenDeploymentConfig = {
      blueTargetGroup,
      greenTargetGroup,
      listener: loadBalancer.listeners[0],
    }
    let alarms = []
    const metric = loadBalancer.metrics.httpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT)
    const http5xxAlarm = new Alarm(this, '5xxAlarm', {
      metric,
      threshold: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
    })
    alarms.push(http5xxAlarm)
    if (props.alarmOnHttp4xx) {
      const metric = loadBalancer.metrics.httpCodeTarget(HttpCodeTarget.TARGET_4XX_COUNT)
      const threshold = props.http4xxThreshold || 10
      const http4xxAlarm = new Alarm(this, '4xxAlarm', {
        metric,
        threshold,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 1,
      })  
      alarms.push(http4xxAlarm)
    }
    const deploymentGroup = new EcsDeploymentGroup(this, 'BlueGreenDeployment', {
      service: props.service,
      blueGreenDeploymentConfig,
      alarms,
      deploymentConfig: EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
    })
    const deployAction = new CodeDeployEcsDeployAction({
      actionName: 'DeployAction',
      deploymentGroup,
      appSpecTemplateInput: specsArtifact,
      taskDefinitionTemplateInput: specsArtifact,
    })
    const deployActions = [
      deployAction,
    ]
    const deployStage = {
      stageName: 'Deploy',
      actions: deployActions,
    }
    stages.push(deployStage)
    new Pipeline(this, 'Pipeline', {
      stages,
    })
  }

}