import { App } from "cdktf";
import Registry from './registry'
import Cluster from './cluster'

interface StackProps {
  env: string
  repo: string
  tag: string
  key: string
}

export class Stack {
  constructor(props?: StackProps) {

    const app = new App();

    const env = props?.env ?? 'dev'
    const repo = props?.repo ?? 'sample-app'
    const tag = props?.tag ?? 'main'
    const key = props?.key ?? 'do-k8s'

    console.log(process.env)

    const registry = new Registry(app, `${repo}`, {
      repo: repo
    })
    registry.initialize()

    // create each vpc, cluster & db
    new Cluster(app, `${env}-${key}`, {
      env: env,
      repo: repo,
      tag: tag,
      key: key
    })

    app.synth()

  }
}

export default Stack
