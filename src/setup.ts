import fs from 'fs'
import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec } from 'child_process';
import { createWorkspace, getWorkspaceOutputs } from './helpers/tfc/index'
const pexec = util.promisify(oexec);

async function run() {

  // make sure terraform config is setup for ephemeral state
  const tfrc = '/home/ops/.terraform.d/credentials.tfrc.json'
  await pexec(`sed -i 's/{{token}}/${process.env.TFC_TOKEN}/g' ${tfrc}`)
    .catch(e => console.log(e))

  // make sure doctl config is setup for the ephemeral state
  await pexec(`doctl auth init -t ${process.env.DO_TOKEN}`)
    .catch(err => console.log(err))

  const TFC_ORG = process.env.TFC_ORG || ''
  const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s';
  const STACK_TEAM = process.env.OPS_TEAM_NAME || 'private'

  sdk.log(`🛠 Loading up ${STACK_TYPE} stack...`)

  const { STACK_ENV } = await ux.prompt<{
    STACK_ENV: string
  }>({
      type: 'input',
      name: 'STACK_ENV',
      default: 'dev',
      message: 'What is the name of the environment?'
    })

  const { STACK_REPO } = await ux.prompt<{
    STACK_REPO: string
  }>({
      type: 'input',
      name: 'STACK_REPO',
      default: 'sample-app',
      message: 'What is the name of the application repo?'
    })

  const { STACK_TAG } = await ux.prompt<{
    STACK_TAG: string
  }>({
      type: 'input',
      name: 'STACK_TAG',
      default: 'main',
      message: 'What is the name of the tag or branch?'
    })

  const STACKS:any = {
    'dev': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'stg': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'prd': [`registry-${STACK_TYPE}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'all': [
      `registry-${STACK_TYPE}`,
      `dev-${STACK_TYPE}`, 
      `stg-${STACK_TYPE}`,
      `prd-${STACK_TYPE}`,
      `dev-${STACK_REPO}-${STACK_TYPE}`,
      `stg-${STACK_REPO}-${STACK_TYPE}`,
      `stg-${STACK_REPO}-${STACK_TYPE}`
    ]
  }

  if(!STACKS[STACK_ENV].length) {
    return console.log('Please try again with environment set to <dev|stg|prd|all>')
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

  // then we build a command to deploy each stack
  const stacks = STACKS[STACK_ENV].map(stack => {
    return  `./node_modules/.bin/cdktf deploy --auto-approve ${stack}`
  })

  ux.print(`⚙️  Deploying the stack via ${ux.colors.white('Terraform Cloud')} for the ${ux.colors.white(TFC_ORG)} organization...`)
  await exec(stacks.join(' && '), {
    env: { 
      ...process.env, 
      CDKTF_LOG_LEVEL: 'fatal',
      STACK_ENV: STACK_ENV,
      STACK_TYPE: STACK_TYPE, 
      STACK_REPO: STACK_REPO, 
      STACK_TAG: STACK_TAG
    }
  })
  // post processing
  .then(async () => {

    let url = `https://app.terraform.io/app/${TFC_ORG}/workspaces/`
    console.log(`✅ View progress in ${ux.colors.blue(ux.url('Terraform Cloud', url))}.`)

     try {

      console.log(`\n🔒 Syncing infrastructure state with ${ux.colors.white(STACK_TEAM)} team...`)

      // get workspace outputs
      const outputs:any = {}
      await Promise.all(STACKS[STACK_ENV].map(async (stack) => {
        let output = await getWorkspaceOutputs(TFC_ORG, stack, process?.env?.TFC_TOKEN ?? '')
        Object.assign(outputs, output)
      }))

      // populate our kubeconfig from doctl into the container
      await exec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
        .catch(err => { throw err })

      // confirm we can connect to the cluster to see nodes
      console.log(`\n⚡️ Confirming connection to ${ux.colors.white(outputs.cluster.name)}:`)
      await exec('kubectl get nodes')
        .catch(err => console.log(err))

      const CONFIG_KEY = `${STACK_ENV}_${STACK_TYPE}_STATE`.toUpperCase().replace(/-/g,'_')
      // If state doesn't exist, lets bootstrap the cluster
      if(!process.env[CONFIG_KEY]) {

        console.log(`\n🔒 Configuring ${ux.colors.white(outputs.cluster.name)} with pull access on ${ux.colors.white(outputs.registry.endpoint)}`)
        await exec(`doctl registry kubernetes-manifest | kubectl apply -f -`)
          .catch(err => console.log(err))

       }

      console.log('\n✅ The output => vault sync for your stacks is complete.')
      console.log(`Saving the following state in your ${ux.colors.white(STACK_TEAM)} config as ${ux.colors.white(CONFIG_KEY)}:`)
      await sdk.setConfig(CONFIG_KEY, JSON.stringify(outputs))
      console.log(outputs)

      console.log('\n🚀 Deploying a hello world application to cluster to finalize setup...')
      await exec('kubectl apply -f src/kubectl/hello-world/')
        .catch(err => console.log(err))

      console.log('\n✅ Deployed. Load Balancer is provisioning...')
      console.log(`👀 Check your ${ux.colors.white('Digital Ocean')} dashboard or Lens for status.`)
      console.log(`\n${ux.colors.italic.white('Happy Workflowing!')}\n`)

    } catch (e) {
      console.log
      process.exit(1)
    }

  })
  .catch(e => {
    console.log('Could not deploy infrastructure', e)
    process.exit(1)
  })

}

// custom promisify exec that pipes stdout too
async function exec(cmd, env?: any | null) {
  return new Promise(function(resolve, reject) {
    const child = oexec(cmd, env)
    child?.stdout?.pipe(process.stdout)
    child?.stderr?.pipe(process.stderr)
    child.on('close', (code) => { code ? reject(child.stdout) : resolve(child.stderr) })
  })
}

run()
