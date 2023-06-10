import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  Vpc,
  SubnetType,
  InterfaceVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2'
import {
  SecureReliableNetworkConfig,
} from './config'

export interface SecureReliableNetworkProps extends SecureReliableNetworkConfig {}

export class SecureReliableNetwork extends Resource {

  public readonly vpc: Vpc

  constructor(scope: Construct, id: string, props: SecureReliableNetworkProps) {
    super(scope, id)
    // Create the minimum configuration for a secure and reliable VPC.
    const publicSubnetConf = {
      name: 'PublicSubnet',
      subnetType: SubnetType.PUBLIC,
    }
    const privateSubnetConf = {
      name: 'PrivateSubnet',
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
    }
    const subnetConfiguration = [
      publicSubnetConf,
      privateSubnetConf,
    ]
    const maxAzs = 2
    const natGateways = props.externalAccess ? maxAzs : 0
    const vpc = new Vpc(this, 'SecureReliableVpc', {
      maxAzs,
      natGateways,
      subnetConfiguration,
    })
    this.vpc = vpc
  }

}