import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider } from '../../.gen/providers/digitalocean'
import { Project, ProjectResources, Vpc, KubernetesCluster, KubernetesNodePool, DatabaseCluster, DatabaseUser, DatabaseDb } from '../../.gen/providers/digitalocean';

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  tag: string
  entropy: string
}

interface StackOutputs {
  vpc_id: string;
}

export default class Cluster extends TerraformStack{
  public vpc: Vpc
  public cluster: KubernetesCluster
  public pgArr: DatabaseCluster[]
  public redisArr: DatabaseCluster[]
  public mysqlArr: DatabaseCluster[]

  public readonly props: StackProps | undefined
  public readonly id: string | undefined
  public readonly org: string | undefined
  public readonly env: string | undefined
  public readonly key: string | undefined
  public readonly repo: string | undefined
  public readonly tag: string | undefined
  public readonly entropy: string | undefined
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
    const k8ver = '1.22.12-do.0';
    const defaultK8sConfig = '{ "dropletSize": "s-1vcpu-2gb", "nodeCount": 3, "minNodes": 1, "maxNodes": 5, "autoScale": true }';
    const defaultRedisConfig = '[{ "name":"default","dropletSize": "db-s-1vcpu-1gb", "nodeCount": 1, "version": "6" }]';
    const defaultMySQLConfig = '[{ "name":"default","dropletSize": "db-s-1vcpu-1gb", "nodeCount": 1, "version": "8", "db_user": "root", "db_name": "default_db", "auth": "mysql_native_password" }]';
    const defaultPostgresSQLConfig = '[{ "name": "default", "dropletSize": "db-s-1vcpu-1gb", "nodeCount": 1, "version": "8", "db_user": "root", "db_name": "default_db" }]';
    var k8sConfig: string;
    var redisConfig: string;
    var mysqlConfig: string;
    var postgresConfig: string;
    var redisCount = 0;
    var pgCount = 0;
    var mysqlCount = 0;
    var npCount = 0;
    var egCount = 0;
    
    switch(this.env) { 
      case 'dev': { 
        k8sConfig = process.env.DO_DEV_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_DEV_REDIS_CONFIG || defaultRedisConfig;
        mysqlConfig = process.env.DO_DEV_MYSQL_CONFIG || defaultMySQLConfig;
        postgresConfig = process.env.DO_DEV_POSTGRES_CONFIG || defaultPostgresSQLConfig;
        break; 
      } 
      case 'stg': { 
        k8sConfig = process.env.DO_STG_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_STG_REDIS_CONFIG || defaultRedisConfig;
        mysqlConfig = process.env.DO_STG_MYSQL_CONFIG || defaultMySQLConfig;
        postgresConfig = process.env.DO_STG_POSTGRES_CONFIG || defaultPostgresSQLConfig;
        break; 
      }
      case 'prd': { 
        k8sConfig = process.env.DO_PRD_K8S_CONFIG || defaultK8sConfig;
        redisConfig = process.env.DO_PRD_REDIS_CONFIG || defaultRedisConfig;
        mysqlConfig = process.env.DO_PRD_MYSQL_CONFIG || defaultMySQLConfig;
        postgresConfig = process.env.DO_PRD_POSTGRES_CONFIG || defaultPostgresSQLConfig;
        break; 
      } 
      default: { 
        k8sConfig = defaultK8sConfig;
        redisConfig = defaultRedisConfig;
        mysqlConfig = defaultMySQLConfig;
        postgresConfig = defaultPostgresSQLConfig;
        break; 
      } 
    }
    const jsonK8sConfig = JSON.parse(k8sConfig);
    const jsonRedisConfig = JSON.parse(redisConfig);
    const jsonMySQLConfig = JSON.parse(mysqlConfig);
    const jsonPostgresConfig = JSON.parse(postgresConfig);

    const dropletSize = jsonK8sConfig.dropletSize;
    const nodeCount = jsonK8sConfig.nodeCount;
    const minNodes = jsonK8sConfig.minNodes;
    const maxNodes = jsonK8sConfig.maxNodes;
    const autoScale = jsonK8sConfig.autoScale;

    
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

    var nodePoolArr : KubernetesNodePool[];
    nodePoolArr = [];
    npCount = 0;
    if(jsonK8sConfig.hasOwnProperty('nodePools'))
    {
      for (let nodePool of jsonK8sConfig.nodePools)
      {
        npCount = npCount + 1;
        nodePoolArr.push(
          new KubernetesNodePool(this, `${this.id}-pool-${npCount}`, {
            name: `${this.env}-${nodePool.name}-pool-${this.org}-${this.entropy}`,
            clusterId: cluster.id,
            size: nodePool.dropletSize,
            nodeCount: nodePool.nodeCount,
            minNodes: nodePool.minNodes,
            maxNodes: nodePool.maxNodes,
            autoScale: nodePool.autoScale,
            labels: nodePool.labels
          })
        );
      }
    }

    if(jsonK8sConfig.hasOwnProperty('egressPool'))
    {

      const egressPool  =  new KubernetesNodePool(this, `${this.id}-egress-pool`, {
            name: `${this.env}-egress-pool-${this.org}-${this.entropy}`,
            clusterId: cluster.id,
            size: jsonK8sConfig.egressPool.dropletSize,
            nodeCount: jsonK8sConfig.egressPool.nodeCount,
            autoScale: false,
            labels: jsonK8sConfig.egressPool.labels,
            taint: [{
              key: "workloadKind",
              value: "egress",
              effect: "NoSchedule",
            }],
          })
       
      
    }


    var pgArr : DatabaseCluster[]; 
    pgArr = [];
    pgCount = 0;
    
    for (let pgInstance of jsonPostgresConfig) {
      pgCount = pgCount + 1;
      pgArr.push(new DatabaseCluster(this, `${this.id}-pg-${pgCount}`, {
        name: `${this.env}-${pgInstance.name}-pg-${this.org}-${this.entropy}`,
        engine: 'pg',
        version: pgInstance.version,
        size: pgInstance.dropletSize,
        region: region,
        nodeCount: pgInstance.nodeCount
      }))

      new DatabaseUser(this, `${this.id}-db-user-${pgCount}`, {
        clusterId: `${pgArr[pgCount-1].id}`,
        name: pgInstance.db_user,
      })
  
      new DatabaseDb(this, `${this.id}-db-${pgCount}`, {
        clusterId: `${pgArr[pgCount-1].id}`,
        name: pgInstance.db_name
        // need to add ENV var for DB Pass
      })
    }

    var mysqlArr : DatabaseCluster[]; 
    mysqlArr = [];
    mysqlCount = 0;

    for (let mysqlInstance of jsonMySQLConfig) {
      mysqlCount = mysqlCount + 1;
      mysqlArr.push(new DatabaseCluster(this, `${this.id}-mysql-${mysqlCount}`, {
        name: `${this.env}-${mysqlInstance.name}-mysql-${this.org}-${this.entropy}`,
        engine: 'mysql',
        version: mysqlInstance.version,
        size: mysqlInstance.dropletSize,
        region: region,
        nodeCount: mysqlInstance.nodeCount
      }))

      const db_user = new DatabaseUser(this, `${this.id}-mysql-user-${mysqlCount}`, {
        clusterId: `${mysqlArr[mysqlCount-1].id}`,
        name: mysqlInstance.db_user,
        mysqlAuthPlugin: mysqlInstance.auth
      })
  
      new DatabaseDb(this, `${this.id}-mysql-db-name-${mysqlCount}`, {
        clusterId: `${mysqlArr[mysqlCount-1].id}`,
        name: mysqlInstance.db_name
      })
    }

    

    var redisArr : DatabaseCluster[]; 
    redisArr = [];
    redisCount = 0;
    for (let redisInstance of jsonRedisConfig) {
      redisCount = redisCount + 1;
      redisArr.push(new DatabaseCluster(this, `${this.id}-redis-${redisCount}`, {
        name: `${this.env}-${redisInstance.name}-redis-${this.org}-${this.entropy}`,
        engine: 'redis',
        version: redisInstance.version,
        size: redisInstance.dropletSize,
        region: region,
        nodeCount: redisInstance.nodeCount
      }))
    }

    var resourcesArr = redisArr.concat(pgArr);
    resourcesArr = resourcesArr.concat(mysqlArr);

    const project = new Project(this, `${this.id}-project`, {
      name: `${this.env}`,
      dependsOn: [vpc, cluster]
    })
    
    var resourcesUrnArr: string [];
    var redisUrnArray: string[];
    var pgUrnArray: string[];
    var mysqlUrnArray: string[];
    resourcesUrnArr = [];
    redisUrnArray = [];
    pgUrnArray = [];
    mysqlUrnArray = [];


    redisArr.forEach(function (redisInstance) {
      redisUrnArray.push(redisInstance.urn)
    })

    pgArr.forEach(function (pgInstance) {
      pgUrnArray.push(pgInstance.urn)
    })

    mysqlArr.forEach(function (mysqlInstance) {
      mysqlUrnArray.push(mysqlInstance.urn)
    })

    resourcesUrnArr = redisUrnArray.concat(pgUrnArray);
    resourcesUrnArr = resourcesUrnArr.concat(mysqlUrnArray);

    new ProjectResources(this, `${this.id}-resources`, {
      project: project.id,
      resources: [
        cluster.urn
      ].concat(resourcesUrnArr),
      dependsOn: [ project, cluster ]
    })

    this.vpc = vpc
    this.cluster = cluster
    this.pgArr = pgArr
    this.redisArr = redisArr
    this.mysqlArr = mysqlArr

    this.stackOutputs = {
      vpc_id: this.vpc.id,
    }

    new TerraformOutput(this, `${this.id}-outputs`, {
      description:
        "An object with attributes from cluster resources",
      value: this.stackOutputs,
    });

    new TerraformOutput(this, 'vpc', {
      value: {
        name: this.vpc.name,
        urn: this.vpc.urn,
        id: this.vpc.id,
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
    
    pgCount = 0;
    for (let pgObjInstance of pgArr) {
      pgCount = pgCount + 1;
      new TerraformOutput(this, `pg-${pgCount}`, {
        value: {
          name: pgObjInstance.name,
          host: pgObjInstance.host,
          user: pgObjInstance.user,
          urn: pgObjInstance.urn
        }
      })
    }

    mysqlCount = 0;
    for (let mysqlObjInstance of mysqlArr) {
      mysqlCount = mysqlCount + 1;
      new TerraformOutput(this, `mysql-${mysqlCount}`, {
        value: {
          name: mysqlObjInstance.name,
          host: mysqlObjInstance.host,
          user: mysqlObjInstance.user,
          urn: mysqlObjInstance.urn
        }
      })
    }

    redisCount = 0;
    for (let redisObjInstance of redisArr) {
      redisCount = redisCount + 1;
      new TerraformOutput(this, `redis-${redisCount}`, {
        value: {
          name: redisObjInstance.name,
          host: redisObjInstance.host,
          user: redisObjInstance.user,
          urn: redisObjInstance.urn
        }
      })
    }

  }
}
