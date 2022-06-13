# Overview

This repo includes a complete Digital Ocean infrastructure complete with Kubernetes, Container Registry, Postgres, Spaces, Load Balancers
SSL (via LetsEncrypt) and Project Resource Management all built using CDKTF & Terraform Cloud.

The repo also includes a PaaS workflow integration with CTO.ai that streamlines Developer Experience for utilizing the infrastructure, 
which includes interative workflows that work in the CLI & Slack, but also full CI/CD & Preview Environments for all delivery.


## Table of contents

- [Overview](#overview)
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Demo](#demo)
  - [Latest Version](#latest-version)
  - [Getting Started](#getting-started)
    - [Create API keys on DigitalOcean](#create-api-keys-on-digitalocean)
    - [Create an Account on Terraform Cloud](#create-an-account-on-terraform-cloud)
    - [Create Secrets from Settings](#create-secrets-from-settings)
    - [Create your Sample - App](#create-your-sample---app)
  - [Usage](#usage)
  - [Getting help](#getting-help)
  - [Reporting bugs and Contributing](#reporting-bugs-and-contributing)
  - [Limitations](#limitations)
  - [Learn more](#learn-more)
  - [License](#license)

---

## Prerequisites

- [CTO.ai Account](https://cto.ai/docs/setup-flow) and [CLI installed](https://cto.ai/docs/install-cli) 
- [Docker](https://docs.docker.com/get-docker/), [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html), and [AWS CLI installed on your machine](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
- [Digital Ocean Account](https://www.digitalocean.com/) & [CLI installed](https://docs.digitalocean.com/reference/doctl/) 
- [Terraform Cloud Account](https://app.terraform.io/session) 
- Kubernetes Lens or any Kubernetes Orchestration tool installed on your machine.

## Demo 

You can try run and deploy the DigitalOcean Kubernetes workflow directly on our [Platform](CTO.ai).

## Latest Version 

The DigitalOcean Kubernetes workflow is updated and running the latest version 

---

## Getting Started 

Before you can deploy this Workflow, you need to [Setup your account on CTO.ai](https://cto.ai/docs/setup-flow)

### Create API keys on DigitalOcean


- [In your DigitalOcean account, create your API keys for your CTO.ai Workflow setup](https://cto.ai/docs/digital-ocean#create-api-keys)


---

### Create an Account on Terraform Cloud

- Sign up and log in to your account on [Terraform Cloud](https://cto.ai/docs/digital-ocean#create-account-on-terraform-cloud)





### Create Secrets from Settings 

Secrets are encrypted environment variables that CTO.ai utilizes within your workflow to build and run your application and deployments. [Follow this guide to create secrets from settings.](https://cto.ai/docs/aws-ecs-fargate#create-secrets-from-settings), and also [generate your Github token](https://cto.ai/docs/aws-ecs-fargate#generate-github-token)

### Create your Sample - App

[You need to build and run your Sample-app](https://cto.ai/docs/aws-ecs-fargate#ecs---fargate-demo). Your sample App can be a Node.js HTTP server with a Dockerfile and `ops.yml` file.


- [Creating and setting up your Account on CTO.ai](https://cto.ai/auth/realms/ops/protocol/openid-connect/registrations?client_id=www&redirect_uri=https://cto.ai/questions&response_mode=fragment&response_type=code&scope=openid&nonce=d2e4022c-04e1-4f70-910c-31a9d25ef321)
- [Creating your API keys and Spaces Access and Secret keys on DigitalOcean]()
- [Creating your API token on Terraform Cloud]()
- [Add and update your tokens on CTO.ai secrets dashboard]()

## Usage 

- [Building your Digital Ocean Workflow]()
- [Running your Digital Ocean Workflow]()
- [Publishing Workflow]()


## Getting help 

CTO.ai DigitalOcean Kubernetes Workflow is an open source project and is supported by the community. You can buy a supported version of CTO DOKS at CTO.ai

Learn more about CTO.ai community support channels [here](https://cto.ai/community)

- Slack (chat): https://cto.ai/community


## Reporting bugs and Contributing 

Feel free to submit PRs or to fill issues. Every kind of help is appreciated.

Kindly check our [Contributing guide]() on how to propose bugfixes and improvements, and submitting pull requests to the project.

- View issues related to this image in our GitHub repository: https://github.com/workflows-sh/do-k8s/issues


## Limitations 


## Learn more 

- Read the manual at: https://cto.ai/docs#


## License 

&copy; CTO.ai, Inc., 2022

Distributed under MIT License (`The MIT License`).

See [LICENSE](LICENSE) for more information.
