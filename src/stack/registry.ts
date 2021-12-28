import { RemoteBackend } from "cdktf";
import { Construct } from "constructs";
import { TerraformStack } from 'cdktf'
import { DigitaloceanProvider, ContainerRegistry } from "../../.gen/providers/digitalocean";

interface StackProps {
  repo: string
 }

export default class Registry extends TerraformStack{
  public registry: ContainerRegistry
  public readonly props: StackProps | undefined
  public readonly repo: string | undefined
  constructor(app: Construct, name: string, props?: StackProps) {
    super(app, name)
    this.props = props;
    this.repo = props?.repo ?? 'sample-app'
  }

  async initialize() { 

    //TODO: make dynamic
    let prefix = "ctoai"
    let suffix = "20211208"

    new DigitaloceanProvider(this, `${this.repo}-provider`, {
      token: process.env.DO_TOKEN 
    })

    new RemoteBackend(this, {
      hostname: "app.terraform.io",
      organization: "cto-ai",
      workspaces: {
        name: "sample-app"
      }
    })

    const registry = new ContainerRegistry(this, `${this.repo}-registry`,{
      name: `${prefix}-${this.repo}-${suffix}`,
      subscriptionTierSlug: "starter"
    })

    this.registry = registry;

  }
}
