#!/usr/bin/env node
import 'source-map-support/register'
import merge from 'lodash.merge'
import {
  readFileSync,
} from 'fs'
import {
  load,
} from 'js-yaml'
import {
  App,
} from 'aws-cdk-lib'
import {
  AppConfig,
  StageConfig,
} from '../config'
import {
  BackEndStack,
} from '../lib/back-end-stack'

const configYaml = readFileSync('config.yaml', 'utf8')
const appConfig = load(configYaml) as AppConfig
const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
}
const app = new App()
let stacks: BackEndStack[] = []
for (const stage of appConfig.stages) {
  const stageConfig = merge({}, appConfig.common, stage) as StageConfig
  // ToDo: Loop this.
  let vpc
  const useVpcFromStage = stageConfig.network?.useFromStage
  if (useVpcFromStage && useVpcFromStage != stageConfig.name) {
    const sourceStackName = `${appConfig.name}-${useVpcFromStage}`
    const sourceStack = stacks.find(stack => stack.stackName == sourceStackName)
    if (sourceStack) {
      vpc = sourceStack.vpc
    } else {
      throw new Error(`Cannot find stack for stage ${useVpcFromStage} to be able to use the same network.`)
    }
  }
  let hostedZone
  const useHostedZoneFromStage = stageConfig.domain?.useFromStage
  if (useHostedZoneFromStage && useHostedZoneFromStage != stageConfig.name) {
    const sourceStackName = `${appConfig.name}-${useHostedZoneFromStage}`
    const sourceStack = stacks.find(stack => stack.stackName == sourceStackName)
    if (sourceStack) {
      hostedZone = sourceStack.hostedZone
    } else {
      throw new Error(`Cannot find stack for stage ${useHostedZoneFromStage} to be able to use the same domain.`)
    }
  }
  const stackName = `${appConfig.name}-${stageConfig.name}`
  const stageStack = new BackEndStack(app, stackName, {
    ...stageConfig,
    env,
    vpc,
    hostedZone,
  })
  stacks.push(stageStack)
}
