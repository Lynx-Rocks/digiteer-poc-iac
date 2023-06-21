import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  HostedZone,
} from 'aws-cdk-lib/aws-route53'
import {
  UniqueWebDomainConfig,
} from '../config'

export interface WebDomainProps extends UniqueWebDomainConfig {
  readonly hostedZone?: HostedZone
}

export class WebDomain extends Resource {

  public readonly hostedZone?: HostedZone
  public readonly hostName?: string

  constructor(scope: Construct, id: string, props: WebDomainProps) {
    super(scope, id)
    let hostedZone = props.hostedZone
    const zoneName = props.root
    if (!hostedZone && zoneName) {
      hostedZone = new HostedZone(this, 'HostedZone', {
        zoneName,
      })
    }
    if (hostedZone) {
      const sub = props.sub
      this.hostName = (sub ? `${sub}.` : '') + hostedZone.zoneName
    }
    this.hostedZone = hostedZone
  }

}
