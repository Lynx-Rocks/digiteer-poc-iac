import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  IGatewayVpcEndpointService,
  IGatewayVpcEndpoint,
  IInterfaceVpcEndpointService,
  IInterfaceVpcEndpoint,
  Vpc,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2'
import {
  SecureReliableNetworkConfig,
} from '../config'

export interface SecureReliableNetworkProps extends SecureReliableNetworkConfig {
  readonly vpc?: Vpc
  readonly gatewayEndpointServices?: IGatewayVpcEndpointService[]
  readonly interfaceEndpointServices?: IInterfaceVpcEndpointService[]
}

export class SecureReliableNetwork extends Resource {

  public readonly vpc: Vpc
  public readonly gatewayEndpoints: IGatewayVpcEndpoint[]
  public readonly interfaceEndpoints: IInterfaceVpcEndpoint[]

  constructor(scope: Construct, id: string, props: SecureReliableNetworkProps) {
    super(scope, id)
    let vpc = props.vpc
    if (!vpc) {
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
      const natGateways = props.allowExternalAccess ? maxAzs : 0
      vpc = new Vpc(this, 'SecureReliableVpc', {
        maxAzs,
        natGateways,
        subnetConfiguration,
      })
    }
    this.vpc = vpc
    // ToDo: Loop this.
    let gatewayEndpoints = []
    const gatewayEndpointServices = props.gatewayEndpointServices || []
    for (const service of gatewayEndpointServices) {
      const name = service.name.replace(/\$\{(.*?)\}/g, '')
      if (!vpc.node.tryFindChild(name)) {
        const endpoint = vpc.addGatewayEndpoint(name, {
          service,
        })
        gatewayEndpoints.push(endpoint)
      }
    }
    this.gatewayEndpoints = gatewayEndpoints
    let interfaceEndpoints = []
    const interfaceEndpointServices = props.interfaceEndpointServices || []
    for (const service of interfaceEndpointServices) {
      const name = service.name.replace(/\$\{(.*?)\}/g, '')
      if (!vpc.node.tryFindChild(name)) {
        const endpoint = vpc.addInterfaceEndpoint(name, {
          service,
        })
        interfaceEndpoints.push(endpoint)
      }
    }
    this.interfaceEndpoints = interfaceEndpoints

  }

}