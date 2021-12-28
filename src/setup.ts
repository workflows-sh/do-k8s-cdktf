import fs from 'fs'
import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import * as tfc from './helper/tfc'
import { exec as oexec } from 'child_process';
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
    'dev': [`${STACK_ENV}-${STACK_TYPE}`],
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

  // tempoary work around until cdktf 0.9 solves multi-stack & workspaces
  // see: https://github.com/hashicorp/terraform-cdk/issues/650
  // see: https://github.com/hashicorp/terraform-cdk/issues/651
  // see: https://github.com/hashicorp/terraform-cdk/issues/670
  const stacks = STACKS[STACK_ENV].map(async (stack) => {

    // try {

      // // always aggressively create the workspace
      // let token = process?.env?.TFC_TOKEN ?? ''
      // await tfc.createWorkspace("cto-ai", stack, token)

    // } catch(e) {
      // console.log('createWorkspace', e)
    // }

    return  `./node_modules/.bin/cdktf deploy --auto-approve ${stack}`
  })

  console.log(stacks);

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
    process.exit(1)
  })

}

// custom promisify exec that pipes stdout too
async function exec(cmd, env?: any | null) {
  return new Promise(function(resolve, reject) {
    const child = oexec(cmd, env)
    child?.stdout?.pipe(process.stdout)
    child?.stderr?.pipe(process.stderr)
    child.on('close', (code) => { code ? reject(child) : resolve(child) })
  })
}


run()
