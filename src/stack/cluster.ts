import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput, TerraformRemoteState,  } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Project, ProjectResources, Vpc, KubernetesCluster, SpacesBucket, Certificate, Droplet, Loadbalancer, Cdn, DatabaseCluster, DatabaseUser, DatabaseDb } from '../../.gen/providers/digitalocean';

interface StackProps {
  repo: string
  tag: string
}

export default class Cluster extends TerraformStack{
  public readonly vpc: Vpc
  public readonly cluster: KubernetesCluster
  public readonly db: DatabaseCluster
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id)

    //TODO: make dynamic
    const region = 'nyc3'
    const prefix = 'ctoai'
    const suffix = '20211208'
    const domains = ['tryapp.xyz', '*.tryapp.xyz']
    const k8ver = '1.21.5-do.0';
    const dropletSize = 's-1vcpu-2gb';

    const repo = props?.repo ?? 'sample-app'
    const tag = props?.tag ?? 'main'

    new DigitaloceanProvider(this, `${id}-provider`, {
      token: process.env.DO_TOKEN,
      spacesAccessId: process.env.DO_SPACES_ACCESS_KEY_ID,
      spacesSecretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY
    })
 
    const vpc = new Vpc(this, `${id}-vpc`, {
      name: `${prefix}-vpc-${suffix}`,
      region: region
    })
  
    const project = new Project(this, `${id}-project`, {
      name: `${process.env.STACK_ENV}`
    })

    const cluster = new KubernetesCluster(this, `${id}-k8s`, {
      name: `${prefix}-${id}-k8s-${suffix}`,
      region: region,
      version: k8ver,
      nodePool: {
        name: `${prefix}-${id}-k8s-worker-${suffix}`,
        size: dropletSize,
        nodeCount: 3
      },
    });

    const db = new DatabaseCluster(this, `${id}-postgres`, {
      name: `${id}-postgres`,
      engine: 'pg',
      version: '13',
      size: 'db-s-1vcpu-1gb',
      region: region,
      nodeCount: 1
    })

    new DatabaseUser(this, `${id}-db-user`, {
      clusterId: `${db.id}`,
      name: `root`
    })

    new DatabaseDb(this, `${id}-db`, {
      clusterId: `${db.id}`,
      name: `${id}`
    })

    const bucket = new SpacesBucket(this, `${id}-bucket`,{
      name: `${prefix}-${id}-${suffix}`,
      region: region,
      acl: 'private'
    })

    const stackCert = new Certificate(this, `${id}-cert`,{
      name: `${prefix}-${id}-${suffix}`,
      type: 'lets_encrypt',
      domains: domains
    })

    new Cdn(this, `${id}-cdn`, {
      origin:  bucket.bucketDomainName,
      certificateName: stackCert.name
    })

    
    const vm_lb = new Droplet(this, `${id}-lb-vm`, {
      name: `${prefix}-${id}-lb-vm-${suffix}`,
      size: dropletSize,
      region: region,
      image: 'ubuntu-20-04-x64',
      tags: [`${prefix}-${id}-lb-vm-${suffix}`],
      vpcUuid: vpc.id
    })

    const lb = new Loadbalancer(this, `${id}-lb`, {
      name: `${prefix}-${id}-lb-${suffix}`,
      region: region,
      forwardingRule:[{
        entryPort: 443,
        entryProtocol: 'https',
        targetPort: 80,
        targetProtocol: 'http',
        certificateName: stackCert.name,
      }],
      vpcUuid: vpc.id,
      dropletTag: `${prefix}-${id}-lb-vm-${suffix}`,
      dependsOn: [ vm_lb ]
    })

    new ProjectResources(this, `${id}-resources`, {
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
      organization: process?.env?.TFC_ORG ?? '',
      workspaces: {
        name: id
      }
    })
  }
}
