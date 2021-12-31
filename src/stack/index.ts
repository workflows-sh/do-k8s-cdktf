import { App } from "cdktf";
import Cluster from './cluster'
import Service from './service'
import Registry from './registry'

interface StackProps {
  repo: string
  tag: string
  key: string
}

export class Stack {

  public readonly repo: string
  public readonly tag: string
  public readonly key: string

  constructor(props?: StackProps) {
    this.repo = props?.repo ?? 'sample-app'
    this.tag = props?.tag ?? 'main'
    this.key = props?.key ?? 'do-k8s'

    const app = new App();

    const registry = new Registry(app, `${this.repo}`, {
      repo: this.repo
    })

    // create each vpc, cluster & db
    const cluster = new Cluster(app, `dev-${this.key}`, {
      repo: this.repo,
      tag: this.tag
    })

    const service = new Service(app, `dev-${this.repo}`)

    app.synth()

  }
}

export default Stack
