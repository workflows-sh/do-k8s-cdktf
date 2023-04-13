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
  const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s-cdktf';
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

  const STACKS:any = {
    'dev': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'stg': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'prd': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'all': [
      `registry-${STACK_TYPE}`,
      `dev-${STACK_TYPE}`, 
      `stg-${STACK_TYPE}`,
      `prd-${STACK_TYPE}`
    ]
  }

  if(!STACKS[STACK_ENV].length) {
    return console.log('Please try again with environment set to <dev|stg|prd|all>')
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
      .then((out) => console.log(out.stdout))
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

  sdk.log(`\n📦 Setting up the ${ux.colors.white(STACK_TYPE)} ${ux.colors.white(STACK_ENV)} stack for ${ux.colors.white(STACK_TEAM)} team...`)

  // sync stacks>workspaces for separated imperative state
  console.log(`🛠  We will now initialize ${ux.colors.white('Terraform Cloud')} workspaces for the ${ux.colors.white(TFC_ORG)} organization...\n`)
  const errors:any[] = [] 
  for(const stack of STACKS[STACK_ENV]) {
    ux.print(`✅ Setting up a ${ux.colors.green(stack)} workspace in Terraform Cloud...`)
   try {
      let res = await createWorkspace(TFC_ORG, stack, process?.env?.TFC_TOKEN ?? '')
    } catch(e) {
      errors.push(ux.colors.gray(`   - ${ux.colors.green(stack)}: ${e} \n`) as string)
    }
  }

  if(errors.length > 0) { // TODO: Improve this to check the error cases
    console.log(`\n⚠️  ${ux.colors.italic('It appears that Terraform Cloud returned at least one non-200 status for your stack')}`)
    console.log(`${ux.colors.gray(' - If this your first run & workspaces have not been created you may need to set a TFC_TOKEN secret')}`)
    console.log(`${ux.colors.gray(' - If this is not your first run & workspaces have been created correctly you can safely ignore this')}`)
    console.log(`${ux.colors.gray('   Details...')}`)
    console.log(errors.join(''))
  }

  await ux.print(`⚙️  Deploying the stack via ${ux.colors.white('Terraform Cloud')} for the ${ux.colors.white(TFC_ORG)} organization...`)
  console.log('')

  // then we build a command to deploy each stack
  const stacks = STACKS[STACK_ENV].map(stack => {
    return {
      command: './node_modules/.bin/cdktf',
      args: ['deploy', stack, '--auto-approve'],
      options: {
        stdio: 'inherit',
        env: {
          ...process.env,
          CDKTF_LOG_LEVEL: 'error',
          STACK_ENV: STACK_ENV,
          STACK_TYPE: STACK_TYPE
        }
      }
    }
  })

  // deploy stack in synchronous series
  exec(stacks).then(async () => {  

    let url = `https://app.terraform.io/app/${TFC_ORG}/workspaces/`
    console.log(`✅ View state in ${ux.colors.blue(ux.url('Terraform Cloud', url))}.`)

     try {

      console.log(`\n🔒 Syncing infrastructure state with ${ux.colors.white(STACK_TEAM)} team...`)

      // get workspace outputs
      const outputs:any = {}
      await Promise.all(STACKS[STACK_ENV].map(async (stack) => {
        let output = await getWorkspaceOutputs(TFC_ORG, stack, process?.env?.TFC_TOKEN ?? '')
        Object.assign(outputs, output)
      }))

      console.log(`\n🔐 AUTHENTICATING with DO CLUSTER: ${ux.colors.white(STACK_ENV)}`)
      await pexec(`doctl auth init -t ${process.env.DO_TOKEN}`)
        .then((out) => console.log(out.stdout))
        .catch(err => { throw err })

      // populate our kubeconfig from doctl into the container
      await pexec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
        .catch(err => { throw err })

      // confirm we can connect to the cluster to see nodes
      console.log(`\n⚡️ Confirming connection to ${ux.colors.white(outputs.cluster.name)}:`)
      await pexec('kubectl get nodes')
        .then(out => console.log(out.stdout))
        .catch(err => console.log(err))

      // Lets make sure cluster is authenticated with registry
      console.log(`\n🔒 Configuring ${ux.colors.white(outputs.cluster.name)} with pull access on ${ux.colors.white(outputs.registry.endpoint)}`)
      await pexec(`doctl registry kubernetes-manifest | kubectl apply -f -`)
        .then(out => console.log(out.stdout))
        .catch(err => console.log(err))

      const CONFIG_KEY = `${STACK_ENV}_${STACK_TYPE}_STATE`.toUpperCase().replace(/-/g,'_')
      console.log(`\n✅ Saved the following state in your ${ux.colors.white(STACK_TEAM)} config as ${ux.colors.white(CONFIG_KEY)}:`)
      await sdk.setConfig(CONFIG_KEY, JSON.stringify(outputs))
      console.log(outputs)

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
