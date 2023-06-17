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
} from '../lib/config'
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
new BackEndStack(app, appConfig.name, {
  ...appConfig,
  env,
})
