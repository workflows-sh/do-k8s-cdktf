import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec } from 'child_process';
import { createWorkspace, getWorkspaceOutputs } from './helpers/tfc/index'
const pexec = util.promisify(oexec);
const spawn = require('spawn-series');

async function run() {

  // make sure terraform config is setup for ephemeral state
  // TODO @kc refactor this to .terraformrc to avoid conflict 
  const tfrc = '/home/ops/.terraform.d/credentials.tfrc.json'
  await pexec(`sed -i 's/{{token}}/${process.env.TFC_TOKEN}/g' ${tfrc}`)
    .catch(e => console.log(e))

  const TFC_ORG = process.env.TFC_ORG || ''
  const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s';
  const STACK_TEAM = process.env.OPS_TEAM_NAME || 'private'

  sdk.log(`\n🛠 Loading the ${ux.colors.white(STACK_TYPE)} stack for the ${ux.colors.white(STACK_TEAM)} team...\n`)

  const { STACK_ENV } = await ux.prompt<{
    STACK_ENV: string
  }>({
      type: 'input',
      name: 'STACK_ENV',
      default: 'dev',
      message: 'What is the name of the environment?'
    })

  const { ISTIO_ACTION } = await ux.prompt<{
    ISTIO_ACTION: string;
  }>({
    type: "list",
    name: "ISTIO_ACTION",
    choices: ["install", "uninstall"],
    message: "What do you want to do with Istio?",
  });

  let ENV_STACKS: string[] = [];


  const STACKS:any = {
    'dev': ENV_STACKS,
    'stg': ENV_STACKS,
    'prd': ENV_STACKS,
  }

  try {
    console.log(`\n🛰  Attempting to bootstrap ${ux.colors.white(STACK_ENV)} state...`)
    const PREFIX = `${STACK_ENV}_${STACK_TYPE}`.replace(/-/g, '_').toUpperCase()
    const STATE_KEY = `${PREFIX}_STATE`
    const STATE = process.env[`${STATE_KEY}`]

    const outputs = JSON.parse(STATE || '')

    // make sure doctl config is setup for the ephemeral state
    console.log(`\n🔐 Configuring access to ${ux.colors.white(STACK_ENV)} cluster`)
    await pexec(`doctl auth init -t ${process.env.DO_TOKEN}`)
      .catch(err => { throw err })

    // populate our kubeconfig from doctl into the container
    await pexec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
      .then((out) => console.log(out.stdout))
      .catch(err => { throw err })

    // confirm we can connect to the cluster to see nodes
    console.log(`\n⚡️ Confirming connection to ${ux.colors.white(outputs.cluster.name)}:`)
    await pexec('kubectl get nodes')
      .then((out) => console.log(out.stdout))
      .catch(err => console.log(err))

  } catch(e) {
    console.log(`⚠️  Could not boostrap ${ux.colors.white(STACK_ENV)} state. Proceeding with setup...`)
  }


  await ux.print(`⚙️  Installing Istio on ${ux.colors.white(STACK_ENV)} cluster`)
  console.log('')

  // then we build a command to deploy each stack
  let stacks = [{}]
  if(ISTIO_ACTION === "install") {
    stacks = [
      {
        command: '/home/ops/.istioctl/bin/istioctl',
        args: ['install', '--set', 'profile=demo', '-y'],
        options: {
        stdio: 'inherit'
        }
      },
      {
        command: 'kubectl',
        args: ['delete', 'deployment', 'istio-ingressgateway', '--namespace=istio-system'],
        options: {
        stdio: 'inherit'
        }
      },
      {
        command: 'kubectl',
        args: ['delete', 'deployment', 'istio-egressgateway', '--namespace=istio-system'],
        options: {
        stdio: 'inherit'
        }
      },
      {
        command: 'kubectl',
        args: ['label', 'namespace', 'default', 'istio-injection=enabled', '--overwrite'],
        options: {
        stdio: 'inherit'
        }
      },
      {
        command: 'kubectl',
        args: ['delete', 'service', 'istio-ingressgateway', '--namespace=istio-system'],
        options: {
        stdio: 'inherit'
        }
      }
  ];
  }
  else {
    stacks = [
      {
        command: '/home/ops/.istioctl/bin/istioctl',
        args: ['x', 'uninstall', '--purge','-y'],
        options: {
          stdio: 'inherit'
        }
      },
      {
        command: 'kubectl',
        args: ['label', 'namespace', 'default', 'istio-injection-', '--overwrite'],
        options: {
        stdio: 'inherit'
        }
      }
    ];
  }


  // deploy stack in synchronous series
  exec(stacks).then(async () => {  

     try {

      console.log(`👀 Check your ${ux.colors.white('Digital Ocean')} dashboard or Lens for status.`)
      console.log(`\n${ux.colors.italic.white('Happy Workflowing!')}\n`)

    } catch (e) {
      console.log('There was an error updating workflow state', e)
      process.exit(1)
    }

  })
  .catch(e => {
    process.exit(1)
  })

}

async function exec(stacks: any) {
  return new Promise((resolve, reject) => {
    spawn(stacks,
      function(code, i, obj) {
        if(code === 0) {
          return resolve(code)
        } else {
          return reject(code)
        }
      },
      function(child, i, obj) {
        console.log(ux.colors.green('Running: '), ux.colors.white(`${obj.command} ${obj.args.join(' ')}`))
        child.on('close', (code) => {
          if(code === 0) {
            console.log(ux.colors.green('Finished: '), ux.colors.white(`${obj.command} ${obj.args.join(' ')}`))
            console.log('')
          } else {
            console.log(ux.colors.red('Failure: '), ux.colors.white(`${obj.command} ${obj.args.join(' ')}`))
          }
        })

      }
    )
  })
}

run()
