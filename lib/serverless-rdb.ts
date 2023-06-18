import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  IVpc,
  ISecurityGroup,
  SecurityGroup,
  Peer,
  Port,
} from 'aws-cdk-lib/aws-ec2'
import {
  DatabaseSecret,
  ClusterInstance,
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraMysqlEngineVersion,
  AuroraPostgresEngineVersion,
  IClusterInstance,
} from 'aws-cdk-lib/aws-rds'
import {
  ServerlessRdbConfig,
} from '../config'

export interface ServerlessRdbProps extends ServerlessRdbConfig {
  readonly vpc: IVpc
  readonly peerSecurityGroup: ISecurityGroup
}

export class ServerlessRdb extends Resource {

  constructor(scope: Construct, id: string, props: ServerlessRdbProps) {
    super(scope, id)
    // Create the serverless cluster, provide all values needed to customise the database.
    let engine
    let port
    if (props.engine == 'MySQL') {
      const version = AuroraMysqlEngineVersion.of(props.version)
      engine = DatabaseClusterEngine.auroraMysql({
        version,
      })
      port = Port.tcp(3306)
    } else /* props.engine == 'PostgreSQL' */ {
      const fullVersion = props.version
      const verArr = fullVersion.split('.')
      const majorVersion = verArr[0]
      const version = AuroraPostgresEngineVersion.of(fullVersion, majorVersion)
      engine = DatabaseClusterEngine.auroraPostgres({
        version,
      })
      port = Port.tcp(5432)
    }
    // Create username and password secret for DB Cluster
    new DatabaseSecret(this, 'DbCredentials', {
      username: props.username,
    })
    const credentials = {
      username: props.username,
    }
    const enablePerformanceInsights = true
    const writer = ClusterInstance.serverlessV2('Writer', {
      enablePerformanceInsights,
    })
    let readers: IClusterInstance[] = []
    if (props.createReader) {
      const reader = ClusterInstance.serverlessV2('Reader', {
        enablePerformanceInsights,
        scaleWithWriter: props.scaleWithWriter,
      })
      readers = [
        reader,
      ]  
    }
    const vpc = props.vpc
    const securityGroup = new SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
    })
    const peer = Peer.securityGroupId(props.peerSecurityGroup.securityGroupId)
    securityGroup.addIngressRule(peer, port)
    const securityGroups = [
      securityGroup,
    ]
    new DatabaseCluster(this, 'DbCluster', {
      engine,
      credentials,
      writer,
      readers,
      defaultDatabaseName: props.name,
      serverlessV2MaxCapacity: 128,
      securityGroups,
      vpc,
    })
  }

}
