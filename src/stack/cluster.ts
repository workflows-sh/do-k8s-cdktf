import { RemoteBackend } from "cdktf";
import { Construct } from "constructs";
import { TerraformStack } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Project, ProjectResources, Vpc, KubernetesCluster, SpacesBucket, Certificate, Droplet, Loadbalancer, Cdn, DatabaseCluster, DatabaseUser, DatabaseDb } from "../../.gen/providers/digitalocean";

interface StackProps {
  env: string
  repo: string
  tag: string
  key: string
}

export default class Cluster extends TerraformStack{
  public readonly vpc: Vpc
  public readonly cluster: KubernetesCluster
  public readonly db: DatabaseCluster
  constructor(app: Construct, name: string, props?: StackProps) {
    super(app, name)

    //TODO: make dynamic
    const region = "nyc3"
    const prefix = "ctoai"
    const suffix = "20211208"
    const domains = ["tryapp.xyz"]
    const k8ver = "1.21.5-do.0";
    const dropletSize = "s-1vcpu-2gb";

    const env = props?.env ?? 'dev'
    const repo = props?.repo ?? 'sample-app'
    const tag = props?.tag ?? 'main'
    const key = props?.key ?? 'do-k8s'

    // console.log('repo:', repo)
    // console.log('tag:', tag)
    //
    const id = `${env}-${key}`
    
    new DigitaloceanProvider(this, `${id}-provider`, {
      token: process.env.DO_TOKEN,
      spacesAccessId: process.env.DO_SPACES_ACCESS_KEY_ID,
      spacesSecretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY
    })
 
    const vpc = new Vpc(this, `${id}-vpc`, {
      name: `${prefix}-my-vpc-${suffix}`,
      region: region
    })
  
    const project = new Project(this, `${id}-project`, {
      name: `${env}`
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
      region: 'sfo3',
      nodeCount: 1
    })

    new DatabaseUser(this, `${id}-db-user`, {
      clusterId: `${db.id}`,
      name: `root`
    })

    new DatabaseDb(this, `${id}-db`, {
      clusterId: `${db.id}`,
      name: `${env}`
    })

    const bucket = new SpacesBucket(this, `${id}-bucket`,{
      name: `${prefix}-${id}-${suffix}`,
      region: region,
      acl: "private"
    })

    const stackCert = new Certificate(this, `${id}-cert`,{
      name: `${prefix}-${id}-${suffix}`,
      type: "lets_encrypt",
      domains: domains
    })

    new Cdn(this, `${id}-cdn`, {
      origin:  bucket.bucketDomainName,
      certificateName: stackCert.name
    })

    
    const vm1 = new Droplet(this, `${id}-droplet`, {
      name: `${prefix}-${id}-${suffix}`,
      size: dropletSize,
      region: region,
      image: 'ubuntu-20-04-x64',
      vpcUuid: vpc.id
    })

    const lb = new Loadbalancer(this, `${id}-lb`, {
      name: `${prefix}-${id}-${suffix}`,
      region: region,
      forwardingRule:[{
        entryPort: 443,
        entryProtocol: "https",
        targetPort: 80,
        targetProtocol: "http",
        certificateName: stackCert.name,
      }],

      dependsOn: [
        vm1
      ]
    })

    new ProjectResources(this, `${id}-resources`, {
      project: project.id,
      resources: [
        lb.urn,
        bucket.urn,
        vm1.urn,
        cluster.urn,
        db.urn
      ],
      dependsOn: [ project, lb, bucket, vm1, cluster, db ]
    })

    this.vpc = vpc
    this.cluster = cluster
    this.db = db

    // temporary until KC gets access to TFC
    //new LocalBackend(this, { path: `/ops/state/${env}-${key}.tfstate` })

    new RemoteBackend(this, {
      hostname: "app.terraform.io",
      organization: "cto-ai",
      workspaces: {
        name: "dev-do-k8s"
      }
    })
  }
}
