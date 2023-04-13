import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider, ContainerRegistry } from '../../.gen/providers/digitalocean';

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  entropy: string
  region: string
 }

export default class Registry extends TerraformStack{

  public registry: ContainerRegistry
  public readonly props: StackProps | undefined
  public readonly id: string | undefined
  public readonly org: string | undefined
  public readonly env: string | undefined
  public readonly key: string | undefined
  public readonly repo: string | undefined
  public readonly entropy: string | undefined
  public readonly region: string | undefined

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id)

    this.id = id
    this.props = props
    this.org = props?.org ?? 'cto-ai'
    this.env = props?.env ?? 'dev'
    this.key = props?.env ?? 'do-k8s-cdktf'
    this.repo = props?.repo ?? 'sample-expressjs-do-k8s-cdktf'
    this.entropy = props?.entropy ?? '20220921'
    this.region = props?.region ?? 'SFO3'

    new DigitaloceanProvider(this, `${this.id}-provider`, {
      token: process.env.DO_TOKEN 
    })

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: process.env.TFC_ORG || this.org,
      workspaces: {
        name: this.id
      }
    })

  }

  async initialize() {

    const registry = new ContainerRegistry(this, `${this.id}-registry`, {
      name: `${this.org}`,
      subscriptionTierSlug: 'basic',
      region: `${this.region}`
    })

    this.registry = registry;

    new TerraformOutput(this, 'registry', {
      value: this.registry
    })

  }
}
