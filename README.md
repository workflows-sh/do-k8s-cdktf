
![digitalocean](https://user-images.githubusercontent.com/24816990/174116002-537e98e5-3f4c-4c02-9419-49fc0b9ffe39.svg)



# Overview

This repo includes a complete Digital Ocean infrastructure complete with Kubernetes, Container Registry, Postgres, Spaces, Load Balancers
SSL (via LetsEncrypt) and Project Resource Management all built using CDKTF & Terraform Cloud.

The repo also includes a PaaS workflow integration with CTO.ai that streamlines Developer Experience for utilizing the infrastructure, 
which includes interative workflows that work in the CLI & Slack, but also full CI/CD & Preview Environments for all delivery.


## Table of contents

- [Overview](#overview)
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [DigitalOcean Infrastructure](#digitalocean-infrastructure)
  - [Demo](#demo)
  - [Latest Version](#latest-version)
  - [Getting Started](#getting-started)
    - [Create Account](#create-account)
    - [Create API keys on DigitalOcean](#create-api-keys-on-digitalocean)
    - [Create an Account on Terraform Cloud](#create-an-account-on-terraform-cloud)
  - [Usage](#usage)
    - [Build Pipelines for your DigitalOcean Infrastructure](#build-pipelines-for-your-digitalocean-infrastructure)
    - [Setup DigitalOcean Kubernetes Infrastructure](#setup-digitalocean-kubernetes-infrastructure)
    - [View Configuration in Terraform Workspace](#view-configuration-in-terraform-workspace)
    - [Run the Deploy Workflow](#run-the-deploy-workflow)
    - [View your Kubernetes Services](#view-your-kubernetes-services)
    - [Destroy your Environment](#destroy-your-environment)
  - [Getting help](#getting-help)
  - [Reporting bugs and Contributing](#reporting-bugs-and-contributing)
  - [Learn more](#learn-more)
  - [Commands](#commands)
  - [Other questions?](#other-questions)
  - [License](#license)

---

## Prerequisites

- [CTO.ai Account](https://cto.ai/docs/setup-flow) and [CLI installed](https://cto.ai/docs/install-cli) 
- [Docker](https://docs.docker.com/get-docker/), [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html), and [AWS CLI installed on your machine](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
- [Digital Ocean Account](https://www.digitalocean.com/) & [CLI installed](https://docs.digitalocean.com/reference/doctl/) 
- [Terraform Cloud Account](https://app.terraform.io/session) 
- Kubernetes Lens or any Kubernetes Orchestration tool installed on your machine.

## DigitalOcean Infrastructure

This repo includes the following resrouces:
* Docker Registry
* Kubernetes Cluster
* MySQL Databases
* Postgres Databases
* Redis Databases
* Load balancers

## Demo 

You can try run, configure, and deploy the DigitalOcean Kubernetes workflow directly on our [Platform](https://cto.ai/platform). kindly follow the steps below to get started 🚀

## Latest Version 

The DigitalOcean Kubernetes workflow is updated and running the latest version 

---

## Getting Started 

```
git clone https://github.com/workflows-sh/do-k8s-cdktf.git

cd do-k8s-cdktf
```

---

### Create Account 

Before you can deploy this Workflow, you need to [Setup your account on CTO.ai](https://cto.ai/docs/setup-flow)

### Create API keys on DigitalOcean


- [In your DigitalOcean account, create your API keys for your CTO.ai Workflow setup](https://cto.ai/docs/digital-ocean#create-api-keys)


---

### Create an Account on Terraform Cloud

- Sign up and log in to your account on [Terraform Cloud](https://cto.ai/docs/digital-ocean#create-account-on-terraform-cloud) and add your [**Tokens** to your account on CTO.ai](https://cto.ai/docs/digital-ocean#add-tokens-to-ctoai).

---

## Usage 

After creating your accounts on CTO.ai and Terraform Cloud, set up your Infrastructure. 

### Build Pipelines for your DigitalOcean Infrastructure

In your application directory, build your DigitalOcean workflow, the Docker image from your Dockerfile, and your `ops.yml` file located in the specified path you created in your source directory using the `ops build .` command.

- [Check out the documentation to learn more on building pipelines](https://cto.ai/docs/digital-ocean#build--digitalocean-workflow)
- 

### Setup DigitalOcean Kubernetes Infrastructure 

Next, set up your DigitalOcean Kubernetes infrastructure to build, and run your DOKS workflow using the `ops run .`  and select `setup kubernetes infrastructure on DigitalOcean` the command will provision your DigitalOcean stack using CDK and Terraform.

- [Check out the documentation to learn more](https://cto.ai/docs/digital-ocean#setup-digitalocean-infrastructure-workflow)


### View Configuration in Terraform Workspace

- Back in your Terraform Workspace you will see your [DigitalOcean workflow created in your Terraform workspace](https://cto.ai/docs/digital-ocean#view-configurations-in-terraform-workspace) As it is synchronizing the state to Terraform Cloud and your workflow grabs the output and synchronizes it in your developer control plane. 


### Run the Deploy Workflow

Next, deploy your changes to your environment using `ops run -b .`. This command will deploy your DigitalOcean Kubernetes CDKTF workflow to your managed Kubernetes environment on DigitalOcean where you'll be able to input your `environment name`, `application repo` and `branch`

- [Learn more about running the deploy workflow](https://cto.ai/docs/digital-ocean#run-the-deploy-workflow)


### View your Kubernetes Services 

Back in your service application, [you can view all running services and nodes using a Kubernetes tool like Lens](https://cto.ai/docs/digital-ocean#kubernetes-services-are-running)

---

### Destroy your Environment 

After configuring your DigitalOcean Kubernetes Workflow, you can destroy your environment and services that are running using the `ops run .` command and select `destroy an environment`

- [Learn more about destroying an environment](https://cto.ai/docs/digital-ocean#destroy-your-environment)

---

## Getting help 

CTO.ai DigitalOcean Kubernetes Workflow is an open-source project and is supported by the community. All versions on DOKS CTO.ai are supported on our Platform.  

Learn more about CTO.ai community support channels [here](https://cto.ai/community)

- **Slack (Chat):** https://cto.ai/community


## Reporting bugs and Contributing 

Feel free to submit PRs or to fill issues. Every kind of help is appreciated.

Kindly check our [Contributing guide](https://github.com/workflows-sh/do-k8s-cdktf/blob/main/Contributing.md) on how to propose bugfixes and improvements, and submitting pull requests to the project.

- View issues related to this image in our GitHub repository [issue tracker](https://github.com/workflows-sh/do-k8s-cdktf/issues)


## Learn more 

- Read the manual on our [website](https://cto.ai/docs/digital-ocean)

## Commands 

- Check out our [Commands](Commands.md) file on how to set up **configs** in your environment. 

---

## Other questions?

Check out our [FAQ](https://cto.ai/docs/faq), send us an [email](https://cto.ai/docs/contact-support), or open an issue with your question. We'd love to hear from you!


## License 

&copy; CTO.ai, Inc., 2023

Distributed under MIT License (`The MIT License`).

See [LICENSE](LICENSE) for more information.
