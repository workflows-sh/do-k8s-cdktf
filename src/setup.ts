import fs from 'fs'
import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec } from 'child_process';
import { createWorkspace } from './helpers/tfc/index'
const pexec = util.promisify(oexec);

async function run() {

  const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s';

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
    'dev': [`${STACK_REPO}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}`],
    'stg': [`${STACK_REPO}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}`],
    'prd': [`${STACK_REPO}`, `${STACK_ENV}-${STACK_TYPE}`, `${STACK_ENV}-${STACK_REPO}`],
    'all': [
      `${STACK_REPO}`,
      `dev-${STACK_TYPE}`, 
      `stg-${STACK_TYPE}`,
      `prd-${STACK_TYPE}`,
      `dev-${STACK_REPO}`,
      `stg-${STACK_REPO}`,
      `stg-${STACK_REPO}`
    ]
  }

  if(!STACKS[STACK_ENV].length) {
    return console.log('Please try again with environment set to <dev|stg|prd|all>')
  }

  // Pull env vars from secret vault and set on process.env
  // Its super annoying that it auto prompts if you cannot find it
  // const secret = await sdk.getSecret(`${STACK_ENV.toUpperCase()}_KUBE_CONFIG`) 
  // process.env.KUBE_CONFIG = secret[`${STACK_ENV.toUpperCase()}_KUBE_CONFIG`]

  sdk.log(`📦 Setting up the stack...`)
  /*const synth =*/ await exec(`./node_modules/.bin/cdktf synth`, {
    env: { 
      ...process.env, 
      CDKTF_LOG_LEVEL: 'info',
      STACK_ENV: STACK_ENV,
      STACK_TYPE: STACK_TYPE, 
      STACK_REPO: STACK_REPO,
      STACK_TAG: STACK_TAG
    }
  })
  // synth.stdout.pipe(process.stdout)
  // synth.stderr.pipe(process.stdout)

  // tempoary work around until cdktf 0.9 or 0.10 solves multi/cross-stack & workspaces
  // see: https://github.com/hashicorp/terraform-cdk/issues/650
  // see: https://github.com/hashicorp/terraform-cdk/issues/651
  // see: https://github.com/hashicorp/terraform-cdk/issues/670
  // TODO: improve this to support full lifecycle management of TFC

  console.log(`🛠 We will now initialize ${ux.colors.white('Terraform Cloud')} workspaces for your stack...\n`)
  const errors:any[] = []
  // first we make sure to create each workspace
  for(const stack of STACKS[STACK_ENV]) {
    ux.print(`✅ Setting up a ${ux.colors.green(stack)} workspace in Terraform Cloud...`)
   try {

      // We need to create a workspace per stack
      // This is done aggressively as it may already exist & fail
      let token = process?.env?.TFC_TOKEN ?? ''
      let res = await createWorkspace("cto-ai", stack, token)

    } catch(e) {
      errors.push(ux.colors.gray(`   - ${ux.colors.green(stack)}: ${e} \n`) as string)
    }
  }

  if(errors.length > 0) {
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

  console.log(stacks.join(' \n') + '\n')

  ux.print(`⚙️  Deploying the stack via ${ux.colors.white('Terraform Cloud')}...`)
  const deploy = await exec(stacks.join(' && '), {
    env: { 
      ...process.env, 
      CDKTF_LOG_LEVEL: 'fatal',
      STACK_ENV: STACK_ENV,
      STACK_TYPE: STACK_TYPE, 
      STACK_REPO: STACK_REPO, 
      STACK_TAG: STACK_TAG
    }
  })
  // Get the AWS command to retrieve kube config
  .then(async () => {
    console.log('done')

    // try {

      // const outputs = await fs.readFileSync('./outputs.json', 'utf8')
      // const json = JSON.parse(outputs)

      // const cmd = Object.keys(json[STACK_ENV])
        // .find((k) => { return k.indexOf('ConfigCommand') > -1 })

      // console.log('Running: ', json[STACK_ENV][cmd!])
      // const aws = await exec(json[STACK_ENV][cmd!], process.env)
        // .catch(err => { throw err })

      // const config = await pexec('cat ~/.kube/config')
      // console.log(config.stdout)

      // // save the KubeConfig to secret store
      // // WIP: this still will require AWS_* in process.env later I think
      // sdk.setSecret(`${STACK_ENV.toUpperCase()}_KUBE_CONFIG`, config.stdout)

    // } catch (e) {
      // throw e
    // }

  })
  .catch((err) => {
    console.log('cdktf', err)
    console.log()
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
