import {
  Construct,
} from 'constructs'
import {
  Resource,
} from 'aws-cdk-lib'
import {
  CfnWebACL,
  CfnWebACLAssociation,
} from 'aws-cdk-lib/aws-wafv2'
import {
  IApplicationLoadBalancer,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {
  WebFirewallConfig,
} from '../config'

export interface WebFirewallProps extends WebFirewallConfig {
  readonly loadBalancer: IApplicationLoadBalancer
}

export class WebFirewall extends Resource {

  constructor(scope: Construct, id: string, props: WebFirewallProps) {
    super(scope, id)
    const awsManagedRules = [
      {
        name: 'AWSManagedRulesCommonRuleSet',
        include: props.core,
      },
      {
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
        include: props.knownBadInputs,
      },
      {
        name: 'AWSManagedRulesAmazonIpReputationList',
        include: props.ipReputationList,
      },
      {
        name: 'AWSManagedRulesSQLiRuleSet',
        include: props.sqlInjection,
      },
      {
        name: 'AWSManagedRulesLinuxRuleSet',
        include: props.linuxVulnerabilities,
      },
      {
        name: 'AWSManagedRulesUnixRuleSet',
        include: props.posixVulnerabilities,
      },
    ]
    const vendorName = 'AWS'
    const overrideAction = {
      none: {},
    }
    const includedRules = awsManagedRules.filter(rule => rule.include)
    const rules = includedRules.map((rule, ndx) => {
      const name = rule.name
      const priority = 10 * (ndx + 1)
      const managedRuleGroupStatement = {
        vendorName,
        name,
      }
      const statement = {
        managedRuleGroupStatement,
      }
      const visibilityConfig = {
        metricName: name,
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
      }
      const wafRule = {
        name,
        priority,
        statement,
        overrideAction,
        visibilityConfig,
      }
      return wafRule
    })
    if (rules) {
      const defaultAction = {
        allow: {},
      }
      const visibilityConfig = {
        metricName: 'WebFirewall',
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: false,
      }
      const webFirewall = new CfnWebACL(this, 'WebFirewall', {
        defaultAction,
        visibilityConfig,
        scope: 'REGIONAL',
        rules,
      })
      new CfnWebACLAssociation(this, 'WebFirewallAssociation', {
        resourceArn: props.loadBalancer.loadBalancerArn,
        webAclArn: webFirewall.attrArn,
      })  
    }
  }

}
