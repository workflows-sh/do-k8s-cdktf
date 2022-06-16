
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
  - [Demo](#demo)
  - [Latest Version](#latest-version)
  - [Getting Started](#getting-started)
    - [Create API keys on DigitalOcean](#create-api-keys-on-digitalocean)
    - [Create an Account on Terraform Cloud](#create-an-account-on-terraform-cloud)
  - [Usage](#usage)
    - [Build your Workflow](#build-your-workflow)
    - [Run your Workflow](#run-your-workflow)
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

- Sign up and log in to your account on [Terraform Cloud](https://cto.ai/docs/digital-ocean#create-account-on-terraform-cloud) and add your [**Tokens** to your account on CTO.ai](https://cto.ai/docs/digital-ocean#add-tokens-to-ctoai).

---

## Usage 

After creating your accounts on CTO.ai and Terraform Cloud, set up your Infrastructure. 

### Build your Workflow

- [Build your DigitalOcean Command and setup your Kubernetes infrastructure on DigitalOcean using the CLI](https://cto.ai/docs/digital-ocean#build-and-run-your-workflow)


### Run your Workflow 

- [Run your DigitalOcean Workflow locally using the CLI](https://cto.ai/docs/digital-ocean#run-digitalocean-workflow)


---

## Getting help 

CTO.ai DigitalOcean Kubernetes Workflow is an open source project and is supported by the community. You can buy a supported version of CTO DOKS at CTO.ai

Learn more about CTO.ai community support channels [here](https://cto.ai/community)

- **Slack (Chat):** https://cto.ai/community


## Reporting bugs and Contributing 

Feel free to submit PRs or to fill issues. Every kind of help is appreciated.

Kindly check our [Contributing guide]() on how to propose bugfixes and improvements, and submitting pull requests to the project.

- View issues related to this image in our GitHub repository: https://github.com/workflows-sh/do-k8s/issues


## Limitations 

You can only deploy and set up this workflow on Digital Ocean. 


## Learn more 

- Read the manual at: https://cto.ai/docs#


## License 

&copy; CTO.ai, Inc., 2022

Distributed under MIT License (`The MIT License`).

See [LICENSE](LICENSE) for more information.
