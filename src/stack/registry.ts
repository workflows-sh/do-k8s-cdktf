import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider, ContainerRegistry } from '../../.gen/providers/digitalocean';

interface StackProps {
  repo: string
 }

export default class Registry extends TerraformStack{

  public registry: ContainerRegistry
  public readonly props: StackProps | undefined
  public readonly id: string | undefined
  public readonly repo: string | undefined

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id)

    this.id = id
    this.props = props
    this.repo = props?.repo ?? 'sample-app'

    //TODO: make dynamic
    let prefix = 'ctoai'
    let suffix = '20211208'

    new DigitaloceanProvider(this, `${this.repo}-provider`, {
      token: process.env.DO_TOKEN 
    })

    const registry = new ContainerRegistry(this, `${this.repo}-registry`,{
      name: `${prefix}-${this.repo}-${suffix}`,
      subscriptionTierSlug: 'starter'
    })

    this.registry = registry;

    new TerraformOutput(this, 'registry', {
      value: this.registry
    })

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: process?.env?.TFC_ORG ?? '',
      workspaces: {
        name: this.id
      }
    })
  }
}
