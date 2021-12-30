import { App } from "cdktf";
import Cluster from './cluster'
import Service from './service'
import Registry from './registry'

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

    const registry = new Registry(app, `${repo}`, {
      repo: repo
    })
    registry.initialize()

    // create each vpc, cluster & db
    const cluster = new Cluster(app, `${env}-${key}`, {
      env: env,
      repo: repo,
      tag: tag,
      key: key
    })

    const service = new Service(app, `${env}-${repo}`)
    service.initialize()

    app.synth()

  }
}

export default Stack
