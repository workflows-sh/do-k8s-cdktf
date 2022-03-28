import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec } from 'child_process';
import { getWorkspaceOutputs } from './helpers/tfc/index'
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

  const { OPERATION } = await ux.prompt<{
    OPERATION: string,
  }>({
      type: 'list',
      name: 'OPERATION',
      default: 'service',
      choices: ['service', 'cluster'],
      message: 'Do you want to destroy cluster or a service?'
    })

  let STACK_REPO = 'cluster'

  if(OPERATION === 'service') {
    ({ STACK_REPO } = await ux.prompt<{
      STACK_REPO: string
    }>({
      type: 'input',
      name: 'STACK_REPO',
      default: 'sample-app',
      message: 'What is the name of the application repo?'
    }))
  }

  function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
  console.log('')
  await ux.spinner.start(`🗑  Collecting resources...`)
  await delay(2000); // give user 2 seconds to think about it
  await ux.spinner.stop(`🗑  Collecting resources...    ✅`)
  console.log('')

  const { CONFIRM } = await ux.prompt<{
    CONFIRM: boolean
  }>({
      type: 'confirm',
      name: 'CONFIRM',
      default: false,
      message: `Are you sure that you want to destroy the ${STACK_REPO} in ${STACK_ENV}?`
    })

  if(!CONFIRM){
    await ux.print(`\n⚠️  Destroy was not confirmed. Exiting.\n`)
    process.exit(1)
  }

  const STACKS:any = {
    'dev': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'stg': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'prd': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`],
    'all': [
      `registry-${STACK_TYPE}`,

      `dev-${STACK_TYPE}`, 
      `stg-${STACK_TYPE}`,
      `prd-${STACK_TYPE}`,
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


  if(OPERATION === "service") {
    let service = `${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`
    STACKS[STACK_ENV] = [service]
  }

  // destroy in reverse order
  STACKS[STACK_ENV].reverse()

  console.log('')
  await ux.print(`🗑  Attempting to destroy the following stacks: ${ux.colors.white(STACKS[STACK_ENV].join(' '))}`)
  await ux.print(`📝 ${ux.colors.green('FYI:')} There may be stack resources that must be manually deleted.`)
  await ux.print(`👉 ${ux.colors.green('So...')} If this destroy fails, you may have to clean up resources manuallyi & run again.`)
  console.log('')

  // then we build a command to deploy each stack
  const stacks = STACKS[STACK_ENV].map(stack => {
    return {
      command: './node_modules/.bin/cdktf',
      args: ['destroy', stack, '--auto-approve'],
      options: {
        stdio: 'inherit',
        env: {
          ...process.env,
          CDKTF_LOG_LEVEL: 'fatal',
          STACK_ENV: STACK_ENV,
          STACK_REPO: STACK_REPO,
          STACK_TYPE: STACK_TYPE
        }
      }
    }
  })

  // deploy stack in synchronous series
  exec(stacks).then(async () => {  

    if(OPERATION === 'service') {
      console.log('')
      await ux.print(`✅ Completed destroy of ${ux.colors.red(STACK_REPO)} in ${ux.colors.green(ux.colors.red(STACK_ENV))} cluster.`)
      console.log('')
      return;
    }

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

      const CONFIG_KEY = `${STACK_ENV}_${STACK_TYPE}_STATE`.toUpperCase().replace(/-/g,'_')
      await ux.print(`\n✅ Cleared the state in your ${ux.colors.white(STACK_TEAM)} config as ${ux.colors.white(CONFIG_KEY)}:`)
      await sdk.setConfig(CONFIG_KEY, JSON.stringify(outputs))
      await ux.print(`✅ Completed destroy of ${ux.colors.green(ux.colors.red(STACK_ENV))} cluster.`)
      console.log('')

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
          } else {
            console.log(ux.colors.red('Failure: '), ux.colors.white(`${obj.command} ${obj.args.join(' ')}`))
          }
        })

      }
    )
  })
}

run()
