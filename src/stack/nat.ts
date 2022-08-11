import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput, Fn } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Droplet, ReservedIp } from '../../.gen/providers/digitalocean';

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  tag: string
  entropy: string
  vpc_id: string
}

interface StackOutputs {
  dropletId: number;
}

export default class Nat extends TerraformStack{
  public readonly props: StackProps | undefined
  public readonly id: string | undefined
  public readonly org: string | undefined
  public readonly env: string | undefined
  public readonly key: string | undefined
  public readonly repo: string | undefined
  public readonly tag: string | undefined
  public readonly entropy: string | undefined
  public readonly vpc_id: string | undefined
  public stackOutputs: StackOutputs

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id)

    this.id = id
    this.props = props
    this.org = props?.org ?? 'cto-ai'
    this.env = props?.env ?? 'dev'
    this.key = props?.key ?? 'do-k8s'
    this.repo = props?.repo ?? 'sample-app'
    this.tag = props?.tag ?? 'main'
    this.entropy = props?.entropy ?? '01012022'
    this.vpc_id = props?.vpc_id ?? '' 

    new DigitaloceanProvider(this, `${this.id}-provider`, {
      token: process.env.DO_TOKEN,
      spacesAccessId: process.env.DO_SPACES_ACCESS_KEY_ID,
      spacesSecretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY
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
    const region = 'nyc3';
    //TODO: make dynamic
    const userData = `
    #cloud-config

    packages:

      - iptables
      - iptables-persistent

    runcmd:

      - sysctl -w net.ipv4.ip_forward=1 && echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
      - export PUBLIC_IF=$(route -n | awk '$1 == "0.0.0.0" {print $8}')
      - export PRIVATE_IF=$(route -n | awk '$2 == "0.0.0.0" {print $8}'| grep -v $PUBLIC_IF)
      - export PRIVATE_NET=$(route -n | awk -v p_if="$PRIVATE_IF" '$8 == p_if {print $1}')
      - export PRIVATE_MASK=$(route -n | awk -v p_if="$PRIVATE_IF" '$8 == p_if {print $3}')
      - iptables -t nat -A POSTROUTING -s $PRIVATE_NET/$PRIVATE_MASK -o $PUBLIC_IF -j MASQUERADE
      - iptables-save > /etc/iptables/rules.v4
    `
    const natDroplet = await new Droplet(this, `${this.id}-nat`, {
      name: `${this.env}-nat-${this.org}-${this.entropy}`,
      image: "ubuntu-18-04-x64",
      region: region,
      size: "s-1vcpu-1gb",
      vpcUuid: this.vpc_id,
      userData: userData,
    });

    const dropletId: number = Fn.tonumber(natDroplet.id)
    
    const outputs = new TerraformOutput(this, `${this.id}-droplet-output`, {
      value: {
        dropletId: dropletId,
      }
    });

    const publicIp = new ReservedIp(this, `${this.id}-reserved-ip`, {
      region: region,
      dropletId: outputs.value.dropletId,
    });

    new TerraformOutput(this, `${this.id}-ip-address-output`, {
      value: {
        ipAddress: publicIp.ipAddress,
      }
    });

  }
}
