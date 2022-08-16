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
  cluster: any,
 }

export default class Egress extends TerraformStack{

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

    const defaultIstioConfig = '{ "host":"ifconfig.co", "port": 443, "portName":"https", "protocol": "TCP" }'
    var istioConfig: string;

    switch(this.env) { 
      case 'dev': { 
        istioConfig = process.env.DO_DEV_ISTIO || defaultIstioConfig;
        break; 
      } 
      case 'stg': { 
        istioConfig = process.env.DO_STG_ISTIO || defaultIstioConfig;
        break; 
      }
      case 'prd': { 
        istioConfig = process.env.DO_PRD_ISTIO || defaultIstioConfig;
        break; 
      } 
      default: { 
        istioConfig = defaultIstioConfig;
        break; 
      } 
    }

    const jsonIstioConfig = JSON.parse(istioConfig);
    let protocol = jsonIstioConfig['protocol'].toLowerCase( )
    var environment: object;
 
    const policyYaml = {
      apiVersion: 'policy/v1beta1',
      kind: 'PodDisruptionBudget',
      metadata: {
        name: 'istio-egressgateway',
        namespace: 'istio-system',
        labels: {
          app: 'istio-egressgateway',
          istio: 'egressgateway',
          release: 'cto',
          'istio.io/rev': 'default',
          'install.operator.istio.io/owning-resource': 'unknown',
          'operator.istio.io/component': "EgressGateways"
        }
      },
      spec: {
        minAvailable: 1,
        selector: {
          matchLabels: {
            app: 'istio-egressgateway',
            istio: 'egressgateway'
          }
        }
      }
    };

    const serviceAccountYaml = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'istio-egressgateway-service-account',
        namespace: 'istio-system',
        labels: {
          app: 'istio-egressgateway',
          istio: 'egressgateway',
          release: 'cto',
          'istio.io/rev': 'default',
          'install.operator.istio.io/owning-resource': 'unknown',
          'operator.istio.io/component': "EgressGateways"
        }
      }
    };

    const roleYaml = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: 'istio-egressgateway-sds',
        namespace: 'istio-system',
        labels: {
          release: 'cto',
          'istio.io/rev': 'default',
          'install.operator.istio.io/owning-resource': 'unknown',
          'operator.istio.io/component': "EgressGateways"
        }
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get","watch","list"]
        }
      ]
    };

    const roleBindingYaml = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'istio-egressgateway-sds',
        namespace: 'istio-system',
        labels: {
          release: 'cto',
          'istio.io/rev': 'default',
          'install.operator.istio.io/owning-resource': 'unknown',
          'operator.istio.io/component': "EgressGateways"
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'istio-egressgateway-sds',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'istio-egressgateway-service-account'
        }
      ]
    };

    const serviceYaml = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'istio-egressgateway',
        namespace: 'istio-system',
        annotations: {},
        labels: {
          app: 'istio-egressgateway',
          istio: 'egressgateway',
          release: 'cto',
          'istio.io/rev': 'default',
          'install.operator.istio.io/owning-resource': 'unknown',
          'operator.istio.io/component': "EgressGateways"
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: 'istio-egressgateway',
          istio: 'egressgateway'
        },
        ports: [
          {
            name: jsonIstioConfig['portName'],
            port: jsonIstioConfig['port']            
          },
        ]
      }
    };

    const deploymentYaml = {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": {
        "name": "istio-egressgateway",
        "namespace": "istio-system",
        "labels": {
          "app": "istio-egressgateway",
          "istio": "egressgateway",
          "release": "release-name",
          "istio.io/rev": "default",
          "install.operator.istio.io/owning-resource": "unknown",
          "operator.istio.io/component": "EgressGateways"
        }
      },
      "spec": {
        "selector": {
          "matchLabels": {
            "app": "istio-egressgateway",
            "istio": "egressgateway"
          }
        },
        "strategy": {
          "rollingUpdate": {
            "maxSurge": "100%",
            "maxUnavailable": "25%"
          }
        },
        "template": {
          "metadata": {
            "labels": {
              "app": "istio-egressgateway",
              "istio": "egressgateway",
              "heritage": "Tiller",
              "release": "istio",
              "chart": "gateways",
              "service.istio.io/canonical-name": "istio-egressgateway",
              "service.istio.io/canonical-revision": "latest",
              "istio.io/rev": "default",
              "install.operator.istio.io/owning-resource": "unknown",
              "operator.istio.io/component": "EgressGateways",
              "sidecar.istio.io/inject": "false"
            },
            "annotations": {
              "prometheus.io/port": "15020",
              "prometheus.io/scrape": "true",
              "prometheus.io/path": "/stats/prometheus",
              "sidecar.istio.io/inject": "false"
            }
          },
          "spec": {
            "securityContext": {
              "runAsUser": 1337,
              "runAsGroup": 1337,
              "runAsNonRoot": true,
              "fsGroup": 1337
            },
            "serviceAccountName": "istio-egressgateway-service-account",
            "containers": [
              {
                "name": "istio-proxy",
                "image": "docker.io/istio/proxyv2:1.13.2",
                "ports": [
                  {
                    "containerPort": jsonIstioConfig['port'],
                    "protocol": "TCP"
                  },
                  {
                    "containerPort": 15090,
                    "protocol": "TCP",
                    "name": "http-envoy-prom"
                  }
                ],
                "args": [
                  "proxy",
                  "router",
                  "--domain",
                  "$(POD_NAMESPACE).svc.cluster.local",
                  "--proxyLogLevel=warning",
                  "--proxyComponentLogLevel=misc:error",
                  "--log_output_level=default:info"
                ],
                "securityContext": {
                  "allowPrivilegeEscalation": false,
                  "capabilities": {
                    "drop": [
                      "ALL"
                    ]
                  },
                  "privileged": false,
                  "readOnlyRootFilesystem": true
                },
                "readinessProbe": {
                  "failureThreshold": 30,
                  "httpGet": {
                    "path": "/healthz/ready",
                    "port": 15021,
                    "scheme": "HTTP"
                  },
                  "initialDelaySeconds": 1,
                  "periodSeconds": 2,
                  "successThreshold": 1,
                  "timeoutSeconds": 1
                },
                "resources": {
                  "limits": {
                    "cpu": "2000m",
                    "memory": "1024Mi"
                  },
                  "requests": {
                    "cpu": "100m",
                    "memory": "128Mi"
                  }
                },
                "env": [
                  {
                    "name": "JWT_POLICY",
                    "value": "third-party-jwt"
                  },
                  {
                    "name": "PILOT_CERT_PROVIDER",
                    "value": "istiod"
                  },
                  {
                    "name": "CA_ADDR",
                    "value": "istiod.istio-system.svc:15012"
                  },
                  {
                    "name": "NODE_NAME",
                    "valueFrom": {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "spec.nodeName"
                      }
                    }
                  },
                  {
                    "name": "POD_NAME",
                    "valueFrom": {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.name"
                      }
                    }
                  },
                  {
                    "name": "POD_NAMESPACE",
                    "valueFrom": {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      }
                    }
                  },
                  {
                    "name": "INSTANCE_IP",
                    "valueFrom": {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "status.podIP"
                      }
                    }
                  },
                  {
                    "name": "HOST_IP",
                    "valueFrom": {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "status.hostIP"
                      }
                    }
                  },
                  {
                    "name": "SERVICE_ACCOUNT",
                    "valueFrom": {
                      "fieldRef": {
                        "fieldPath": "spec.serviceAccountName"
                      }
                    }
                  },
                  {
                    "name": "ISTIO_META_WORKLOAD_NAME",
                    "value": "istio-egressgateway"
                  },
                  {
                    "name": "ISTIO_META_OWNER",
                    "value": "kubernetes://apis/apps/v1/namespaces/istio-system/deployments/istio-egressgateway"
                  },
                  {
                    "name": "ISTIO_META_MESH_ID",
                    "value": "cluster.local"
                  },
                  {
                    "name": "TRUST_DOMAIN",
                    "value": "cluster.local"
                  },
                  {
                    "name": "ISTIO_META_UNPRIVILEGED_POD",
                    "value": "true"
                  },
                  {
                    "name": "ISTIO_META_CLUSTER_ID",
                    "value": "Kubernetes"
                  }
                ],
                "volumeMounts": [
                  {
                    "name": "istio-envoy",
                    "mountPath": "/etc/istio/proxy"
                  },
                  {
                    "name": "config-volume",
                    "mountPath": "/etc/istio/config"
                  },
                  {
                    "mountPath": "/var/run/secrets/istio",
                    "name": "istiod-ca-cert"
                  },
                  {
                    "name": "istio-token",
                    "mountPath": "/var/run/secrets/tokens",
                    "readOnly": true
                  },
                  {
                    "mountPath": "/var/lib/istio/data",
                    "name": "istio-data"
                  },
                  {
                    "name": "podinfo",
                    "mountPath": "/etc/istio/pod"
                  },
                  {
                    "name": "egressgateway-certs",
                    "mountPath": "/etc/istio/egressgateway-certs",
                    "readOnly": true
                  },
                  {
                    "name": "egressgateway-ca-certs",
                    "mountPath": "/etc/istio/egressgateway-ca-certs",
                    "readOnly": true
                  }
                ]
              }
            ],
            "volumes": [
              {
                "name": "istiod-ca-cert",
                "configMap": {
                  "name": "istio-ca-root-cert"
                }
              },
              {
                "name": "podinfo",
                "downwardAPI": {
                  "items": [
                    {
                      "path": "labels",
                      "fieldRef": {
                        "fieldPath": "metadata.labels"
                      }
                    },
                    {
                      "path": "annotations",
                      "fieldRef": {
                        "fieldPath": "metadata.annotations"
                      }
                    }
                  ]
                }
              },
              {
                "name": "istio-envoy",
                "emptyDir": {}
              },
              {
                "name": "istio-data",
                "emptyDir": {}
              },
              {
                "name": "istio-token",
                "projected": {
                  "sources": [
                    {
                      "serviceAccountToken": {
                        "path": "istio-token",
                        "expirationSeconds": 43200,
                        "audience": "istio-ca"
                      }
                    }
                  ]
                }
              },
              {
                "name": "config-volume",
                "configMap": {
                  "name": "istio",
                  "optional": true
                }
              },
              {
                "name": "egressgateway-certs",
                "secret": {
                  "secretName": "istio-egressgateway-certs",
                  "optional": true
                }
              },
              {
                "name": "egressgateway-ca-certs",
                "secret": {
                  "secretName": "istio-egressgateway-ca-certs",
                  "optional": true
                }
              }
            ],
            "tolerations":[
              {
                "key":"workloadKind",
                "operator": "Equal",
                "value": "egress",
                "effect": "NoSchedule",
              }
            ],
            "affinity": {
              "nodeAffinity":{
                "requiredDuringSchedulingIgnoredDuringExecution":{
                  "nodeSelectorTerms": [
                    {
                      "matchExpressions": [
                        {
                          "key": "type",
                          "operator": "In",
                          "values": ["istio"]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      }
    };

    const hpaYaml = {
      "apiVersion": "autoscaling/v2beta1",
      "kind": "HorizontalPodAutoscaler",
      "metadata": {
        "name": "istio-egressgateway",
        "namespace": "istio-system",
        "labels": {
          "app": "istio-egressgateway",
          "istio": "egressgateway",
          "release": "release-name",
          "istio.io/rev": "default",
          "install.operator.istio.io/owning-resource": "unknown",
          "operator.istio.io/component": "EgressGateways"
        }
      },
      "spec": {
        "maxReplicas": 5,
        "minReplicas": 1,
        "scaleTargetRef": {
          "apiVersion": "apps/v1",
          "kind": "Deployment",
          "name": "istio-egressgateway"
        },
        "metrics": [
          {
            "type": "Resource",
            "resource": {
              "name": "cpu",
              "targetAverageUtilization": 80
            }
          }
        ]
      }
    };
  // customize  
    const serviceEntryYaml = {
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "ServiceEntry",
      "metadata": {
        "name": jsonIstioConfig['portName']
      },
      "spec": {
        "hosts": [
          jsonIstioConfig['host']
        ],
        "ports": [
          {
            "number": jsonIstioConfig['port'],
            "name": jsonIstioConfig['portName'],
            "protocol": jsonIstioConfig['protocol']
          },
          {
            "number": 80,
            "name": "http",
            "protocol": "HTTP"
          }
        ],
        "resolution": "DNS"
      }
    };

    const gatewayYaml = {
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "Gateway",
      "metadata": {
        "name": "istio-egressgateway"
      },
      "spec": {
        "selector": {
          "istio": "egressgateway"
        },
        "servers": [
          {
            "port": {
              "number": jsonIstioConfig['port'],
              "name": jsonIstioConfig['portName'],
              "protocol": jsonIstioConfig['protocol']
            },
            "hosts": [
              jsonIstioConfig['host']
            ],
          },
        ]
      }
    };

    const dsRuleYaml = {
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "DestinationRule",
      "metadata": {
        "name": "egressgateway-for-poc"
      },
      "spec": {
        "host": "istio-egressgateway.istio-system.svc.cluster.local",
        "subsets": [
          {
            "name": jsonIstioConfig['portName']
          }
        ]
      }
    };

    let virtualSpec = {
      "hosts": [
        jsonIstioConfig['host']
      ],
      "gateways": [
        "istio-egressgateway",
        "mesh"
      ]
    };

    virtualSpec[protocol] = [
      {
        "match": [
          {
            "gateways": [
              "mesh"
            ],
            "port": jsonIstioConfig['port'],
            "sniHosts":[
              jsonIstioConfig['host']
            ]
          }
        ],
        "route": [
          {
            "destination": {
              "host": "istio-egressgateway.istio-system.svc.cluster.local",
              "subset": jsonIstioConfig['portName'],
              "port": {
                "number": jsonIstioConfig['port'],
              }
            },
            "weight": 100
          }
        ]
      },
      {
        "match": [
          {
            "gateways": [
              "istio-egressgateway"
            ],
            "port": jsonIstioConfig['port'],
            "sniHosts":[
              jsonIstioConfig['host']
            ]
          }
        ],
        "route": [
          {
            "destination": {
              "host": jsonIstioConfig['host'],
              "port": {
                "number": jsonIstioConfig['port']
              }
            },
            "weight": 100
          }
        ]
      }
    ];

    const virtualServiceYaml = {
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "VirtualService",
      "metadata": {
        "name": "poc-egress-gateway"
      },
      "spec": virtualSpec,
    };



    new Manifest(this, `${this.id}-policy-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(policyYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-serviceaccount-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(serviceAccountYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-role-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(roleYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-rolebinding-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(roleBindingYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-service-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(serviceYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-deployment-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(deploymentYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-hpa-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(hpaYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-serviceentry-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(serviceEntryYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-gateway-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(gatewayYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-dsrule-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(dsRuleYaml),
      waitForRollout: true
    });

    new Manifest(this, `${this.id}-virtualservice-manifest`, {
      wait: true,
      yamlBody: YAML.stringify(virtualServiceYaml),
      waitForRollout: true
    });

  }
}
