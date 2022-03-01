import { RemoteBackend } from 'cdktf';
import { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf'
import { DigitaloceanProvider, SpacesBucket } from '../../.gen/providers/digitalocean';
import { KubectlProvider } from '../../.gen/providers/kubectl/kubectl-provider'
import { Manifest } from '../../.gen/providers/kubectl/manifest'

import YAML from 'yaml';

import util from 'util';
import { exec as oexec } from 'child_process';
const pexec = util.promisify(oexec);
const convert = require('string-type-convertor');

interface StackProps {
  org: string
  env: string
  key: string
  repo: string
  tag: string
  entropy: string,
  cluster: any, // fix
  registry: any, //fix 
 }

export default class Service extends TerraformStack{

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

    const bucket = new SpacesBucket(this, `${this.id}-assets`,{
      name: `${this.key}-${this.repo}-${this.org}-${this.entropy}`,
      region: 'nyc3',
      acl: 'private'
    })

    new KubectlProvider(this, `${this.id}-kubectl-provider`, {
      host: this.props?.cluster?.cluster?.endpoint,
      configPath: '/home/ops/.kube/config',
      loadConfigFile: true
    })

    let secrets = {}
    const decode = (str: string):string => Buffer.from(str, 'base64').toString('binary');

    try {
      const VAULT_KEY = `${this.env}-${this.key}`
      const vault = await pexec(`kubectl get secret ${VAULT_KEY} -o json`) 
      const data = JSON.parse(vault.stdout); 
      for(let index of Object.keys(data.data)){
          let e = decode(data.data[index])
          secrets[index] = e
      }
    } catch(e) {
      //console.log('There was an error fetching secrets from the cluster vault:', e)
    }

    const environment = Object.assign({
      PORT: "3000",
      // DB_HOST: 
      // DB_PORT: 
      // DB_USER: 
      // REDIS_HOST: 
      // REDIS_PORT: 
      // MQ_URL: 
      // MQ_NAME: 
      CDN_URL: bucket.bucketDomainName
    }, { ...secrets })

    const env = Object.keys(environment).map((e) => {
      return { name: e, value: environment[e] }
    })
     
    const dYaml = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${this.repo}`,
        labels: {
          'app.kubernetes.io/name': `load-balancer-${this.repo}`
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': `load-balancer-${this.repo}`
          }
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': `load-balancer-${this.repo}`
            },
          },
          spec: {
            containers: [{
              //image: `digitalocean/flask-helloworld:latest`, // uncomment to test
              image: `${this.props?.registry.registry.endpoint}/${this.repo}-${this.key}:${this.tag}`,
              name: `${this.repo}`,
              env: env,
              ports: [{
                containerPort: convert(environment.PORT) || 3000
              }]
            }]
          }
        }
      }
    };

    const sYaml = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${this.repo}-service`,
        labels: {
          'app.kubernetes.io/name': `load-balancer-${this.repo}`
        }
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': `load-balancer-${this.repo}`
        },
        ports: [{
          'protocol': 'TCP',
          'port': 80,
          'targetPort': convert(environment.PORT) || 3000
        }],
        type: 'LoadBalancer'
      }
    };

    new Manifest(this, `${this.id}-deployment-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(dYaml),
      waitForRollout: true
    })

    new Manifest(this, `${this.id}-service-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(sYaml),
      waitForRollout: true
    })

    new TerraformOutput(this, `bucket`, {
      value: bucket
    })

  }
}
