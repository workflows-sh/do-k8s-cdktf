import { App } from "cdktf";
import Cluster from './cluster'
import Service from './service'
import Registry from './registry'

interface StackProps {
  org: string
  env: string
  repo: string
  tag: string
  key: string
  entropy: string
}

export class Stack {

  public readonly org: string
  public readonly env: string
  public readonly repo: string
  public readonly tag: string
  public readonly key: string
  public readonly entropy: string

  constructor(props?: StackProps) {
    this.org = props?.org ?? 'cto-ai'
    this.env = props?.env ?? 'dev'
    this.key = props?.key ?? 'do-k8s'
    this.repo = props?.repo ?? 'sample-app'
    this.tag = props?.tag ?? 'main'
    this.entropy = props?.entropy ?? '01012022'
  }

  async initialize() {

    const app = new App();

    const registry = new Registry(app, `registry-${this.key}`, {
      org: this.org,
      env: this.env,
      key: this.key,
      repo: this.repo,
      entropy: this.entropy
    })
    await registry.initialize()

    // create each vpc, cluster & db
    const cluster = new Cluster(app, `${this.env}-${this.key}`, {
      org: this.org,
      env: this.env,
      key: this.key,
      repo: this.repo,
      tag: this.tag,
      entropy: this.entropy
    })
    await cluster.initialize()

    const service = new Service(app, `${this.env}-${this.repo}-${this.key}`, {
      org: this.org,
      env: this.env,
      key: this.key,
      repo: this.repo,
      tag: this.tag,
      entropy: this.entropy,
      registry: registry,
      cluster: cluster,
    })
    await service.initialize()

    app.synth()

  }
}

export default Stack
