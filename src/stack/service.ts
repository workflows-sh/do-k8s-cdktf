import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider, SpacesBucket, ContainerRegistry } from '../../.gen/providers/digitalocean';

interface StackProps {
  repo: string
 }

export default class Service extends TerraformStack{

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
      token: process.env.DO_TOKEN,
      spacesAccessId: process.env.DO_SPACES_ACCESS_KEY_ID,
      spacesSecretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY
    })

    const bucket = new SpacesBucket(this, `${id}-assets`,{
      name: `${prefix}-${id}-${suffix}`,
      region: 'nyc3',
      acl: 'private'
    })

    new TerraformOutput(this, `bucket`, {
      value: bucket
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
