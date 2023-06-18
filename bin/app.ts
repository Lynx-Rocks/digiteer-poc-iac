#!/usr/bin/env node
import 'source-map-support/register'
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
} from '../config'
import {
  BackEndStack,
} from '../lib/back-end-stack'

const configYaml = readFileSync('config.yaml', 'utf8')
let appConfig = load(configYaml) as AppConfig
appConfig.stage = appConfig.stage || 'dev'
const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
}
const app = new App()
const stackId = `${appConfig.name}-${appConfig.stage}`
new BackEndStack(app, stackId, {
  ...appConfig,
  env,
})
