# Depoy Infrastructure from IaC using CTO.ai

This repo includes a complete Digital Ocean infrastructure with Kubernetes, Container Registry, MySQL, Postgres, Redis, Load Balancers and Project Resource Management all built using CDKTF & Terraform Cloud.

The repo also includes a PaaS workflow integration with CTO.ai that streamlines Developer Experience for utilizing the infrastructure, 
which includes interative workflows that work in the CLI & Slack, but also full CI/CD & Preview Environments for all delivery.

## Pre-requesites
* Docker, Node (NVM) 12+ & npm installed
* Sign up for CTO.ai, setup CTO.ai team
* Install Ops CLI, Connect Github & Slack

Follow the CTO.ai [documentation](https://cto.ai/docs/gettingstarted) to get your environment ready for start using this workflows

## DigitalOcean Infrastructure
These workflows allows to manage Crystal Commerce Infrastructure over DigitalOcean, the resources that are defined for be managed are the following.
* Docker Registry
* Kubernetes Cluster
* MySQL Databases
* Postgres Databases
* Redis Databases
* Load balancers

You can add or remove resources changing the code of this repository or by editing the configuration parameters in your CTO.ai [team]().

## Commands
The following are the commands already implemented in this repository and are able to run from the **CLI** or **Slack**

### Sign In
In first place you need to sign in into the CTO.ai plataform for that you can run in your **CLI** the following command.

```
ops account:signin
```
your browser goings to pops up asking for login credentials, once done you can go back to the **CLI**
```
💻 CTO.ai - The CLI built for Teams 🚀

👋 Welcome to the The Ops CLI! 

Authenticating using Single Sign On... Finished

Authenticating... Done!

👋 Welcome back demo-user!
```

### Team switch
You need to be sure that you are running in the right CTO.ai team, you can do it using the following command.

```
ops team:switch
```
Then select the desired team
```
🔍 Searching for your teams... Done
Here's the list of your teams:

 Select a team (Use arrow keys or type to search)
→ demo-user
  cto-ai 
```
### Setup
This command deploys/updates your infrastructure reading its configuration from your CTO.ai team, the following are the parameters related with the infrastructure deployment
- **DO_DEV_K8S_CONFIG**: Kubernetes configuration for **DEV** environment.
- **DO_STG_K8S_CONFIG**: Kubernetes configuration for **STG** environment.
- **DO_PRD_K8S_CONFIG**: Kubernetes configuration for **PRD** environment.
- **DO_DEV_REDIS_CONFIG**: Redis configuration for **DEV** environment.
- **DO_STG_REDIS_CONFIG**: Redis configuration for **STG** environment.
- **DO_PRD_REDIS_CONFIG**: Redis configuration for **PRD** environment.
- **DO_DEV_POSTGRES_CONFIG**: Postgres configuration for **DEV** environment.
- **DO_STG_POSTGRES_CONFIG**: Postgres configuration for **STG** environment.
- **DO_PRD_POSTGRES_CONFIG**: Postgres configuration for **PRD** environment.
- **DO_DEV_MYSQL_CONFIG**: MySQL configuration for **DEV** environment.
- **DO_STG_MYSQL_CONFIG**: MySQL configuration for **STG** environment.
- **DO_PRD_MYSQL_CONFIG**: MySQL configuration for **PRD** environment.

You can check the current values for this parameters going to your CTO.ai [team]( ). In a later section this parameters would be explained in detail.

Then you can deploy/setup your infrastructure with the following command

```
ops run setup
```
for almost all commands you going to be asked for the environment
```
Select a •Command, •Pipeline or •Service to run →
🌎 = Public 🔑 = Private 🖥  = Local  🔍 Search:  • 🔑  setup - Setup Kubernetes infrastructure on Digital Ocean
⚙️  Running setup...

🛠 Loading the do-k8s stack for the cto-ai team...

What is the name of the environment? [dev]: dev
```
Then all your infrastructure would be deployed/updated a the end you going to get some information about the resources deployed.
```
.
.
.
    urn: 'do:vpc:ac43df94-962a-414e-9e1f-b0dfc0755f6a'
  },
  'cross-stack-output-digitalocean_container_registryregistry-do-k8s-registryendpoint': 'registry.digitalocean.com/cto-ai',
  registry: {
    createdAt: '2022-03-04 16:40:48 +0000 UTC',
    endpoint: 'registry.digitalocean.com/cto-ai',
    id: 'cto-ai',
    name: 'cto-ai',
    region: 'fra1',
    serverUrl: 'registry.digitalocean.com',
    storageUsageBytes: 1901222912,
    subscriptionTierSlug: 'professional'
  }
}
👀 Check your Digital Ocean dashboard or Lens for status.

Happy Workflowing!
```
### Destroy
This command is for destroy infrstructure or a service, you need to be **extremly careful** with this one.
```
ops run destroy
```
you going to get all the info about the destroy process, a the end a summary of the destroyed resources would be shown.
```
Destroying Stack: stg-do-k8s
Resources
 ✔ DIGITALOCEAN_DATABAS                     digitalocean_database_cluster.stg-do-k8
   E_CLUSTER                                s-postgres
 ✔ DIGITALOCEAN_DATABAS                     digitalocean_database_cluster.stg-do-k8
   E_CLUSTER                                s-redis-1
 ✔ DIGITALOCEAN_DATABAS                     digitalocean_database_cluster.stg-do-k8
   E_CLUSTER                                s-redis-2
 ✔ DIGITALOCEAN_DATABAS                     digitalocean_database_db.stg-do-k8s-db
   E_DB
 ✔ DIGITALOCEAN_DATABAS                     digitalocean_database_user.stg-do-k8s-d
   E_USER                                   b-user
 ✔ DIGITALOCEAN_KUBERNE                     digitalocean_kubernetes_cluster.stg-do-
   TES_CLUSTER                              k8s-k8s
 ✔ DIGITALOCEAN_PROJECT                     digitalocean_project.stg-do-k8s-project
 ✔ DIGITALOCEAN_PROJECT                     digitalocean_project_resources.stg-do-k
   _RESOURCES                               8s-resources
 ✔ DIGITALOCEAN_VPC                         digitalocean_vpc.stg-do-k8s-vpc

Summary: 9 destroyed.
```
### Deploy
This command deploys a Service Docker Image into Kubernetes cluster applying all configurations defined for each service in CTO.ai [team]( ). it includes a certain number of replicas, a load balancer, health checks and set some environment variables. The parameters that are consider for this config are the following.

- **DO_DEV_SERVICES**: Services settings for **DEV** environment.
- **DO_STG_SERVICES**: Services settings for **STG** environment.
- **DO_PRD_SERVICES**: Services settings for **PRD** environment.

The command is the following.
```
ops run deploy
```
We going to be asked for which service we want to deploy (service are get from config)
```
Select a •Command, •Pipeline or •Service to run →
🌎 = Public 🔑 = Private 🖥  = Local  🔍 Search:  • 🔑  deploy - Deploy a service to Kubernetes infrastructure on DigitalOcean
⚙️  Running deploy...

🛠 Loading the do-k8s stack for the cto-ai team...

What is the name of the environment?: dev
What is the name of the application repo?:
  my-service-app
> my-service-api
  my-service-backend
```
then it ask again for the tag of the image that we want to deploy
```
What is the name of the environment?: dev
What is the name of the application repo?: my-service-api
What is the name of the tag or branch?: do-dev
```
after the process completes we got a confirmation
```
✅ Deployed. Load Balancer may take some time to provision on your first deploy.
✅ View state in Terraform Cloud (https://app.terraform.io/app/cto-ai/workspaces/).
👀 Check your Digital Ocean dashboard or Lens.app for status & IP.

Happy Workflowing!
```

### Vault
This command allows to manage secrets in Kubernetes, these secrets are inyected as environment variables to your pods in Kubernetes.

* **Init**<br>
This command option allows you to initialize the vault, and it should be executed when you create a new Kubernetes cluster.
```
ops run . vault init
``` 
* **Set**<br>
Set command option creates or update a new key/value pair in the vault
```
ops run . vault set
```
then you just need to provide the environment, key and value
```
⚙️  Running vault...
🛠 Loading the do-k8s stack for the cto-ai team...
What is the name of the environment?: dev
What is the key for the secret?: test-key
What is the value for the secret?: test-val
Are you sure you want to set test-key to test-val in the dev-do-k8s? → yes
Notice: Adding cluster credentials to kubeconfig file found in "/home/ops/.kube/config"
Notice: Setting current-context to do-nyc3-dev-k8s-cto-ai-02022022

⚡️ Confirming connection to dev-k8s-cto-ai-02022022:
NAME                                                 STATUS   ROLES    AGE   VERSION
dev-do-k8s-k8s-node-cto-ai-02022022-c3flc   Ready    <none>   41d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c3flu   Ready    <none>   41d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c8lk1   Ready    <none>   35d   v1.22.7

🔐 Setting test-key to test-val on the dev-do-k8s with type string
✅ test-key set to test-val in the dev-do-k8s vault
```
* **List**<br>
This command option list all key/value pairs in the vault
```
ops run . vault ls
```
```
Select a •Command, •Pipeline or •Service to run →
🌎 = Public 🔑 = Private 🖥  = Local  🔍 Search:  • 🖥   vault - manage secrets vault
⚙️  Running vault...
🛠 Loading the do-k8s stack for the cto-ai team...
What is the name of the environment?: dev
Notice: Adding cluster credentials to kubeconfig file found in "/home/ops/.kube/config"
Notice: Setting current-context to do-nyc3-dev-k8s-cto-ai-02022022

⚡️ Confirming connection to dev-k8s-cto-ai-02022022:
NAME                                                 STATUS   ROLES    AGE   VERSION
dev-do-k8s-k8s-node-cto-ai-02022022-c3flc   Ready    <none>   41d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c3flu   Ready    <none>   41d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c8lk1   Ready    <none>   35d   v1.22.7

🔐 dev-do-k8s has the following secrets: 
test-key: test-val
```
* **Delete**<br>
This option allows to delete any key value pair from the vault
```
ops run . vault rm
```
```
Select a •Command, •Pipeline or •Service to run →
🌎 = Public 🔑 = Private 🖥  = Local  🔍 Search:  • 🖥   vault - manage secrets vault
⚙️  Running vault...
🛠 Loading the do-k8s stack for the cto-ai team...
What is the name of the environment?: dev
What is the key for the secret?: test-key
Are you sure you want to remove test-key from the dev-do-k8s vault? → yes
Notice: Adding cluster credentials to kubeconfig file found in "/home/ops/.kube/config"
Notice: Setting current-context to do-nyc3-dev-k8s-cto-ai-02022022

⚡️ Confirming connection to dev-k8s-cto-ai-02022022:
NAME                                                 STATUS   ROLES    AGE   VERSION
dev-do-k8s-k8s-node-cto-ai-02022022-c3flc   Ready    <none>   42d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c3flu   Ready    <none>   42d   v1.22.7
dev-do-k8s-k8s-node-cto-ai-02022022-c8lk1   Ready    <none>   36d   v1.22.7

🔐 Deleting test-key from the dev-do-k8s vault
✅ test-key removed from the dev-do-k8s vault
```
* **Destroy**<br>
This vault option destroys the vault from the Kubernetes cluster, so you need to be **extremly careful** with this, because after the deletion you going to lose all you key/value for the selected environment
```
ops run . vault destroy
```

## Service and Infrastructure Configuration
Most of the changes against infrastructure and services can be done without modify the code, just adjusting the parameters in CTO.ai [team]( ) config.Then you can re-run `ops run setup` for apply the changes in infrastructure and re-run `ops run deploy` for apply changes in services. 

## Kubernetes capacity setup
These parameters set the Kubernetes capacity cluster depending on the environment and taking this values from the `config` in the CTO's [team]( ). The definition of the size of the cluster is given in the following 3 `config` parameters:

- **DO_DEV_K8S_CONFIG** 
- **DO_STG_K8S_CONFIG**
- **DO_PRD_K8S_CONFIG**

One parameter for each environment, this config parameter is a string cotaining a `json` in the following format:

```
{ 
 "dropletSize": "s-1vcpu-2gb", 
 "nodeCount": 3, 
 “minNodes": 1, 
 "maxNodes": 5, 
 "autoScale": true 
}
```
### Redis, MySQL, Postgres Cluster Capacity/Scale Setup
The same aproach can be used for other resources, like in this case a `Redis`, `MySQL` and `Postgres` clusters which is defined by the following parameters:

- **DO_DEV_REDIS_CONFIG** 
- **DO_STG_REDIS_CONFIG**
- **DO_PRD_REDIS_CONFIG**
- **DO_DEV_MYSQL_CONFIG** 
- **DO_STG_MYSQL_CONFIG**
- **DO_PRD_MYSQL_CONFIG**
- **DO_DEV_POSTGRES_CONFIG** 
- **DO_STG_POSTGRES_CONFIG**
- **DO_PRD_POSTGRES_CONFIG**

In this case the redis clustre config string has the following format.

```
[
  {
    "name": "my-service-api-redis",
    "dropletSize": "db-s-1vcpu-1gb",
    "nodeCount": 1,
    "version": "6"
  },
  {
    "name": "my-service-app-redis",
    "dropletSize": "db-s-1vcpu-1gb",
    "nodeCount": 1,
    "version": "6"
  }
]
```
The same aproach is used for MySQL and Postgres
```
[
  {
    "name": "my-service-api-db",
    "dropletSize": "db-s-1vcpu-1gb",
    "nodeCount": 1,
    "version": "8",
    "db_user": "my-service-api",
    "db_name": "dev-my-service-api-db",
    "auth": "mysql_native_password"
  },
  {
    "name": "my-service-app-db",
    "dropletSize": "db-s-1vcpu-1gb",
    "nodeCount": 1,
    "version": "8",
    "db_user": "my-service-app-db",
    "db_name": "dev-my-service-app-db",
    "auth": "mysql_native_password"
  }
]
```
### Services Parameters Definition
To setup multiple services in the same cluster, we store all the deployment paramenters like port, replicas, etc. as `config` parameter in CTO.ai [team]( ), it would makes deployments easier. The variables as shown before would be by environment as follows.

- **DO_DEV_SERVICES** 
- **DO_STG_SERVICES**
- **DO_PRD_SERVICES**

It containes an array of services with parameters in `json` format.

```
{ 
	"sample-app": 
		{ 
			"replicas" : 2, 
			"ports" : [ { 
				"containerPort" : 3000 
			} ], 
			"lb_ports" : [ { 
				"protocol": "TCP", 
				"port": 3000, 
				"targetPort": 3000 
			} ], 
			"hc_port": 3000 
		 }
}
```
### Maping vault secrets to environment variables in a pod
Since in many cases you have to deploy multiple services using the same vault, you can find cases in which a varable name is the same for different services and generates conflicts, in order to solve this issue you can use `map` parameter in the json string for services, this allows you to map this variables. following is the json for a sample service.

```
{ 
	"sample-expressjs": { 
				"replicas" : 2, 
				"ports" : [ { 
					"containerPort" : 3000 
					} ], 
				"lb_ports" : [ {
					 "protocol": "TCP", 
					"port": 3000, 
					"targetPort": 3000 
					} ], 
				"hc_port": 3000, 
				"sticky_sessions": "no",
				"map": { 
					"DB_HOST" : "SP_DB_HOST", 
					"DB_USER":"SP_DB_USER", 
					"DB_PASS":"SP_DB_PASS", 
					"DB_PORT":"SP_DB_PORT", 
					"DB_NAME":"SP_DB_NAME"
				}
	 } 
}
```
each pair maps **pod env variable** to **vault variable** so for example **DB_HOST** in the pod going to have the value of **SP_DB_HOST** from the vault.