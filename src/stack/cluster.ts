import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput, TerraformRemoteState,  } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Project, ProjectResources, Vpc, KubernetesCluster, SpacesBucket, Certificate, Droplet, Loadbalancer, Cdn, DatabaseCluster, DatabaseUser, DatabaseDb } from '../../.gen/providers/digitalocean';

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  tag: string
  entropy: string
}

export default class Cluster extends TerraformStack{
  public readonly vpc: Vpc
  public readonly cluster: KubernetesCluster
  public readonly db: DatabaseCluster
  public readonly props: StackProps | undefined
  public readonly id: string | undefined
  public readonly org: string | undefined
  public readonly env: string | undefined
  public readonly key: string | undefined
  public readonly repo: string | undefined
  public readonly tag: string | undefined
  public readonly entropy: string | undefined

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id)

    //TODO: make dynamic
    const region = 'nyc3'
    const domains = ['tryapp.xyz', '*.tryapp.xyz']
    const k8ver = '1.21.5-do.0';
    const dropletSize = 's-1vcpu-2gb';

    this.id = id
    this.props = props
    this.org = props?.org ?? 'cto-ai'
    this.env = props?.env ?? 'dev'
    this.key = props?.key ?? 'do-k8s'
    this.repo = props?.repo ?? 'sample-app'
    this.tag = props?.tag ?? 'main'
    this.entropy = props?.entropy ?? '01012022'

    new DigitaloceanProvider(this, `${this.id}-provider`, {
      token: process.env.DO_TOKEN,
      spacesAccessId: process.env.DO_SPACES_ACCESS_KEY_ID,
      spacesSecretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY
    })
 
    const vpc = new Vpc(this, `${this.id}-vpc`, {
      name: `${this.env}-vpc-${this.org}-${this.entropy}`,
      region: region
    })
  
    const project = new Project(this, `${this.id}-project`, {
      name: `${this.env}`
    })

    const cluster = new KubernetesCluster(this, `${this.id}-k8s`, {
      name: `${this.env}-k8s-${this.org}-${this.entropy}`,
      region: region,
      version: k8ver,
      nodePool: {
        name: `${this.id}-k8s-node-${this.org}-${this.entropy}`,
        size: dropletSize,
        nodeCount: 3,
        minNodes: 1,
        maxNodes: 5
      },
    });

    const db = new DatabaseCluster(this, `${this.id}-postgres`, {
      name: `${this.env}-psql-${this.org}-${this.entropy}`,
      engine: 'pg',
      version: '13',
      size: 'db-s-1vcpu-1gb',
      region: region,
      nodeCount: 1
    })

    new DatabaseUser(this, `${this.id}-db-user`, {
      clusterId: `${db.id}`,
      name: `root`
    })

    new DatabaseDb(this, `${this.id}-db`, {
      clusterId: `${db.id}`,
      name: `${this.id}`
    })

    const bucket = new SpacesBucket(this, `${this.id}-bucket`,{
      name: `${this.env}-bucket-${this.org}-${this.entropy}`,
      region: region,
      acl: 'private'
    })

    const stackCert = new Certificate(this, `${id}-cert`,{
      name: `${this.key}-ssl-${this.org}-${this.entropy}`,
      type: 'lets_encrypt',
      domains: domains
    })

    new Cdn(this, `${id}-cdn`, {
      origin:  bucket.bucketDomainName,
      certificateName: stackCert.name
    })

    const vm_lb = new Droplet(this, `${this.id}-lb-vm`, {
      name: `${this.env}-lb-vm-${this.org}-${this.entropy}`,
      size: dropletSize,
      region: region,
      image: 'ubuntu-20-04-x64',
      tags: [`${this.env}-lb-vm-${this.org}-${this.entropy}`],
      vpcUuid: vpc.id
    })

    const lb = new Loadbalancer(this, `${this.id}-lb`, {
      name: `${this.env}-lb-${this.org}-${this.entropy}`,
      region: region,
      forwardingRule:[{
        entryPort: 443,
        entryProtocol: 'https',
        targetPort: 80,
        targetProtocol: 'http',
        certificateName: stackCert.name,
      }],
      vpcUuid: vpc.id,
      dropletTag: `${this.env}-lb-vm-${this.org}-${this.entropy}`,
      dependsOn: [ vm_lb ]
    })

    new ProjectResources(this, `${this.id}-resources`, {
      project: project.id,
      resources: [
        lb.urn,
        bucket.urn,
        vm_lb.urn,
        cluster.urn,
        db.urn
      ],
      dependsOn: [ project, lb, bucket, vm_lb, cluster, db ]
    })

    this.vpc = vpc
    this.cluster = cluster
    this.db = db

    new TerraformOutput(this, 'vpc', {
      value: {
        name: this.vpc.name,
        urn: this.vpc.urn
      }
    })
    new TerraformOutput(this, 'cluster', {
      value: {
        name: this.cluster.name,
        endpoint: this.cluster.endpoint,
        version: this.cluster.version,
        urn: this.cluster.urn
      }
    })
    new TerraformOutput(this, 'db', {
      value: {
        name: this.db.name,
        host: this.db.host,
        user: this.db.user,
        urn: this.db.urn
      }
    })

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: this.org,
      workspaces: {
        name: this.id
      }
    })
  }
}
