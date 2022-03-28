import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Project, ProjectResources, Vpc, KubernetesCluster, DatabaseCluster, DatabaseUser, DatabaseDb } from '../../.gen/providers/digitalocean';

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  tag: string
  entropy: string
}

export default class Cluster extends TerraformStack{
  public vpc: Vpc
  public cluster: KubernetesCluster
  public db: DatabaseCluster
  public redis: DatabaseCluster

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

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: process.env.TFC_ORG || this.org,
      workspaces: {
        name: this.id
      }
    })

  }

  async initialize() {

    //TODO: make dynamic
    const region = 'nyc3';
    const k8ver = '1.22.7-do.0';
    const defaultK8sConfig = '{ "dropletSize": "s-1vcpu-2gb", "nodeCount": 3, "minNodes": 1, "maxNodes": 5, "autoScale": true }';
    const defaultRedisConfig = '{ "dropletSize": "db-s-1vcpu-1gb", "nodeCount": 1, "version": "6" }';
    var k8sConfig: string;
    var redisConfig: string;
    
    switch(this.env) { 
      case 'dev': { 
        k8sConfig = process.env.DO_DEV_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_DEV_REDIS_CONFIG || defaultRedisConfig;
        break; 
      } 
      case 'stg': { 
        k8sConfig = process.env.DO_STG_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_STG_REDIS_CONFIG || defaultRedisConfig;
        break; 
      }
      case 'prd': { 
        k8sConfig = process.env.DO_PRD_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_PRD_REDIS_CONFIG || defaultRedisConfig;
        break; 
      } 
      default: { 
        k8sConfig = defaultK8sConfig;
        redisConfig = defaultRedisConfig;
        break; 
      } 
    }
    const jsonK8sConfig = JSON.parse(k8sConfig);
    const jsonRedisConfig = JSON.parse(redisConfig);

    const dropletSize = jsonK8sConfig.dropletSize;
    const nodeCount = jsonK8sConfig.nodeCount;
    const minNodes = jsonK8sConfig.minNodes;
    const maxNodes = jsonK8sConfig.maxNodes;
    const autoScale = jsonK8sConfig.autoScale;

    const redisDropletSize = jsonRedisConfig.dropletSize;
    const redisNodeCount = jsonRedisConfig.nodeCount;
    const redisVersion = jsonRedisConfig.version;


    const vpc = new Vpc(this, `${this.id}-vpc`, {
      name: `${this.env}-vpc-${this.org}-${this.entropy}`,
      region: region
    })

    const cluster = new KubernetesCluster(this, `${this.id}-k8s`, {
      name: `${this.env}-k8s-${this.org}-${this.entropy}`,
      region: region,
      version: k8ver,
      nodePool: {
        name: `${this.id}-k8s-node-${this.org}-${this.entropy}`,
        size: dropletSize,
        nodeCount: nodeCount,
        minNodes: minNodes,
        maxNodes: maxNodes,
        autoScale: autoScale
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
      name: `root`,
    })

    new DatabaseDb(this, `${this.id}-db`, {
      clusterId: `${db.id}`,
      name: `${this.id}`
      // need to add ENV var for DB Pass
    })

    const redis = new DatabaseCluster(this, `${this.id}-redis`, {
      name: `${this.env}-redis-${this.org}-${this.entropy}`,
      engine: 'redis',
      version: redisVersion,
      size: redisDropletSize,
      region: region,
      nodeCount: redisNodeCount
    })

    const project = new Project(this, `${this.id}-project`, {
      name: `${this.env}`,
      dependsOn:[vpc, cluster, db, redis]
    })

    new ProjectResources(this, `${this.id}-resources`, {
      project: project.id,
      resources: [
        cluster.urn,
        db.urn,
        redis.urn,
      ],
      dependsOn: [ project, cluster, db ]
    })

    this.vpc = vpc
    this.cluster = cluster
    this.db = db
    this.redis = redis

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
        urn: this.cluster.urn,
        id: this.cluster.id
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

    new TerraformOutput(this, 'redis', {
      value: {
        name: this.redis.name,
        host: this.redis.host,
        user: this.redis.user,
        urn: this.redis.urn
      }
    })

  }
}
