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

    const defaultServicesConfig = '{ "sample-app": { "replicas" : 2, "ports" : [ { "containerPort" : 3000 } ], "lb_ports" : [ { "protocol": "TCP", "port": 3000, "targetPort": 3000 } ], "hc_port": 3000 } }'
    var servicesConfig: string;

    switch(this.env) { 
      case 'dev': { 
        servicesConfig = process.env.DO_DEV_SERVICES || defaultServicesConfig;
        break; 
      } 
      case 'stg': { 
        servicesConfig = process.env.DO_STG_SERVICES || defaultServicesConfig;
        break; 
      }
      case 'prd': { 
        servicesConfig = process.env.DO_PRD_SERVICES || defaultServicesConfig;
        break; 
      } 
      default: { 
        servicesConfig = defaultServicesConfig;
        break; 
      } 
    }

    const jsonServicesConfig = JSON.parse(servicesConfig);
    const serviceConfig = jsonServicesConfig[`${this.repo}`]
    var environment: object;

    if(serviceConfig.hasOwnProperty('map'))
    {
      const serviceMapConfig =  serviceConfig['map']
      Object.keys(serviceMapConfig).map(function(key) {
        serviceMapConfig[key] = secrets[serviceMapConfig[key]];
      });
      environment = serviceMapConfig
    }
    else
    {
      environment = Object.assign({
        PORT: "80",
      }, { ...secrets })
    }
    

    const env = Object.keys(environment).map((e) => {
      return { name: e, value: environment[e] }
    })
     
    const dYaml = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${this.env}-${this.repo}`,
        labels: {
          'service': `srv-${this.repo}`,
          'env': `${this.env}`
        },
      },
      spec: {
        replicas: serviceConfig['replicas'],
        selector: {
          matchLabels: {
            'service': `srv-${this.repo}`,
            'env': `${this.env}`
          }
        },
        template: {
          metadata: {
            labels: {
              'service': `srv-${this.repo}`,
              'env': `${this.env}`
            },
          },
          spec: {
            containers: [{
              //image: `digitalocean/flask-helloworld:latest`, // uncomment to test
              image: `${this.props?.registry.registry.endpoint}/${this.repo}-${this.key}:${this.tag}`,
              name: `${this.repo}`,
              env: env,
              imagePullPolicy: 'Always',
              ports: serviceConfig['ports']
            }]
          }
        }
      }
    };

    var lbAnnotations: any
    if (serviceConfig['sticky_sessions'] == "yes")
    {
      lbAnnotations = {
        'service.beta.kubernetes.io/do-loadbalancer-protocol': 'http',
        'service.beta.kubernetes.io/do-loadbalancer-sticky-sessions-type': 'cookies',
        'service.beta.kubernetes.io/do-loadbalancer-sticky-sessions-cookie-name': `${this.env}-lb-${this.repo}`,
        'service.beta.kubernetes.io/do-loadbalancer-sticky-sessions-cookie-ttl': '60',
        'service.beta.kubernetes.io/do-loadbalancer-healthcheck-port': `${serviceConfig['hc_port']}`
      }
    }
    else
    {
      lbAnnotations = {
        'service.beta.kubernetes.io/do-loadbalancer-healthcheck-port': `${serviceConfig['hc_port']}`
      }
    }

    const lbYaml = {
      apiVersion: 'v1',
      kind: 'Service',
      annotations: lbAnnotations,
      metadata: {
        name: `${this.env}-lb-${this.repo}`,
        labels: {
          'service': `srv-${this.repo}`,
          'env': `${this.env}`
        }
      },
      spec: {
        selector: {
          'service': `srv-${this.repo}`,
          'env': `${this.env}`
        },
        ports: serviceConfig['lb_ports'],
        type: 'LoadBalancer'
      }
    };

    new Manifest(this, `${this.id}-deployment-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(dYaml),
      waitForRollout: true
    })

    new Manifest(this, `${this.id}-lb-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(lbYaml),
      waitForRollout: true
    })

  }
}
