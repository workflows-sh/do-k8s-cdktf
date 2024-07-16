import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec, execSync } from 'child_process';
import { createWorkspace } from './helpers/tfc/index'
import { stackEnvPrompt, stackRepoPrompt, stackTagPrompt } from './prompts';
const pexec = util.promisify(oexec);
const spawn = require('spawn-series');

async function run() {

  // make sure terraform config is setup for ephemeral state
  // TODO @kc refactor this to .terraformrc to avoid conflict 
  const tfrc = '/home/ops/.terraform.d/credentials.tfrc.json'
  await pexec(`sed -i 's/{{token}}/${process.env.TFC_TOKEN}/g' ${tfrc}`)
    .catch(err => console.log(err))

  // make sure doctl config is setup for the ephemeral state
  await pexec(`doctl auth init -t ${process.env.DO_TOKEN}`)
    .catch(err => console.log(err))

  const TFC_ORG = process.env.TFC_ORG || ''
  const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s-cdktf';
  const STACK_TEAM = process.env.OPS_TEAM_NAME || 'private'

  const { SRV_TYPE } = await ux.prompt<{
    SRV_TYPE: string
  }>({
    type: 'list',
    name: 'SRV_TYPE',
    choices: ['app', 'util'],
    default: 'app',
    message: 'Which type of application?'
  })

  const doraController = 'dora-controller'
  let UTIL_NAME: string = '';
  let STACK_TAG: string = '';
  let STACK_REPO: string = '';
  if (SRV_TYPE === "util") {
    ({ UTIL_NAME } = await ux.prompt<{
      UTIL_NAME: string
    }>({
      type: 'list',
      name: 'UTIL_NAME',
      choices: [doraController],
      default: doraController,
      message: 'Select the Service to install'
    }))
  }

  const isApp = (SRV_TYPE === "util") ? false : true;
  const { STACK_ENV } = await stackEnvPrompt()

  if (isApp) {
    ({ STACK_REPO } = await stackRepoPrompt())


    await ux.print(`\n🛠 Loading the latest tags for ${ux.colors.green(STACK_TYPE)} environment and ${ux.colors.green(STACK_REPO)} service...`)

    // TODO: Write function to return currently running image name and display it to the user.
    //
    // async function retrieveCurrentlyDeployedImage(env: string, service: string): Promise<string> {
    //   return ""
    // }
    // const currentImage = await retrieveCurrentlyDeployedImage(STACK_ENV, STACK_REPO)
    // await ux.print(`\n🖼️  Currently deployed image - ${ux.colors.green(currentImage)}\n`)

    const regImages: string[] = JSON.parse(execSync(
      `doctl registry repository list-tags ${STACK_REPO} --output json --format Tag `,
      {
        env: process.env
      }
    ).toString().trim()).filter(image => 'tag' in image).map(image => { return image.tag }) || []

    const defaultImage = regImages.length ? regImages[0] : undefined
    const imageTagLimit = 20

    const { STACK_TAG_CUSTOM } = await ux.prompt<{
      STACK_TAG_CUSTOM: boolean
    }>({
      type: 'confirm',
      name: 'STACK_TAG_CUSTOM',
      default: false,
      message: 'Do you want to deploy a custom image?'
    });

    if (STACK_TAG_CUSTOM) {
      ({ STACK_TAG } = await ux.prompt<{
        STACK_TAG: string
      }>({
        type: 'input',
        name: 'STACK_TAG',
        message: 'What is the name of the tag or branch?',
        allowEmpty: false
      }))
    } else {
      ({ STACK_TAG } = await stackTagPrompt(
        regImages.slice(0, regImages.length < imageTagLimit ? regImages.length : imageTagLimit),
        defaultImage
      ))
    }

    await ux.print(`\n🛠 Loading the ${ux.colors.white(STACK_TYPE)} stack for the ${ux.colors.white(STACK_TEAM)}...\n`)
  }
  
  let STACKS = {
    'dev': [`${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'stg': [`${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'prd': [`${STACK_ENV}-${STACK_REPO}-${STACK_TYPE}`],
    'all': [
      `registry-${STACK_TYPE}`,
      `dev-${STACK_TYPE}`,
      `stg-${STACK_TYPE}`,
      `prd-${STACK_TYPE}`
    ]
  }
  if (!isApp) {
    STACKS[STACK_ENV] = [`${STACK_ENV}-${UTIL_NAME}-${STACK_TYPE}`]
  }

  if (!STACKS[STACK_ENV].length) {
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
      .catch(err => console.log(err))

    // populate our kubeconfig from doctl into the container
    await pexec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
      .then(out => console.log(out.stdout))
      .catch(err => { throw err })

    // await pexec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
    //   .catch(err => { throw err })

    // confirm we can connect to the cluster to see nodes
    console.log(`\n⚡️ Confirming connection to ${ux.colors.white(outputs.cluster.name)}:`)
    await pexec('kubectl get nodes')
      .then(out => console.log(out.stdout))
      .catch(err => console.log(err))

  } catch (e) {
    console.log(`⚠️  Could not bootstrap ${ux.colors.white(STACK_ENV)} state. Proceeding with setup...`)
  }

  // sync stacks>workspaces for separated imperative state
  console.log(`🛠  We will now initialize ${ux.colors.white('Terraform Cloud')} workspaces for the ${ux.colors.white(TFC_ORG)} organization...\n`)
  const errors: any[] = []
  for (const stack of STACKS[STACK_ENV]) {
    ux.print(`✅ Setting up a ${ux.colors.green(stack)} workspace in Terraform Cloud...`)
    try {
      let res = await createWorkspace(TFC_ORG, stack, process?.env?.TFC_TOKEN ?? '')
    } catch (e) {
      errors.push(ux.colors.gray(`   - ${ux.colors.green(stack)}: ${e} \n`) as string)
    }
  }

  if (errors.length > 0) { // TODO: Improve this to check the error cases
    console.log(`\n⚠️  ${ux.colors.italic('It appears that Terraform Cloud returned at least one non-200 status for your stack')}`)
    console.log(`${ux.colors.gray(' - If this your first run & workspaces have not been created you may need to set a TFC_TOKEN secret')}`)
    console.log(`${ux.colors.gray(' - If this is not your first run & workspaces have been created correctly you can safely ignore this')}`)
    console.log(`${ux.colors.gray('   Details...')}`)
    console.log(errors.join(''))
  }

  let deployMsg = `📦 Deploying ${ux.colors.white(STACK_REPO)}:${ux.colors.white(STACK_TAG)} to ${ux.colors.white(STACK_ENV)} cluster`
  if (!isApp) {
    deployMsg = `📦 Deploying ${ux.colors.white(UTIL_NAME)} to ${ux.colors.white(STACK_ENV)} cluster`
  }
  console.log('')
  await ux.print(deployMsg)
  console.log('')

  let parallelism: any[] = []
  if(UTIL_NAME===doraController){
    parallelism = ["--parallelism", 1]
  }

  // then we build a command to deploy each stack
  const stacks = STACKS[STACK_ENV].map(stack => {
    return {
      command: './node_modules/.bin/cdktf',
      args: ['deploy', '--ignore-missing-stack-dependencies', '--auto-approve', stack, ...parallelism],
      options: {
        stdio: 'inherit',
        env: {
          ...process.env,
          CDKTF_LOG_LEVEL: 'error',
          STACK_ENV: STACK_ENV,
          STACK_TYPE: STACK_TYPE,
          STACK_REPO: STACK_REPO,
          STACK_TAG: STACK_TAG,
        }
      }
    }
  })

  // deploy stack in synchronous series
  exec(stacks).then(async () => {
    if (isApp) {
      console.log('✅ Deployed. Load Balancer may take some time to provision on your first deploy.')
    } else {
      console.log(`✅ Deployed. ${UTIL_NAME} may take some time to provision on your first deploy.`)
    }
    let url = `https://app.terraform.io/app/${TFC_ORG}/workspaces/`
    console.log(`✅ View state in ${ux.colors.blue(ux.url('Terraform Cloud', url))}.`)
    console.log(`👀 Check your ${ux.colors.white('Digital Ocean')} dashboard or ${ux.colors.white('Lens.app')} for status & IP.`)
    console.log(`\n${ux.colors.italic.white('Happy Workflowing!')}\n`)
  })
    .catch(e => {
      console.log('There was an error deploying the infrastructure.')
      process.exit(1)
    })

}

async function exec(stacks: any) {
  return new Promise((resolve, reject) => {
    spawn(stacks,
      function (code, i, obj) {
        if (code === 0) {
          return resolve(code)
        } else {
          return reject(code)
        }
      },
      function (child, i, obj) {
        console.log(ux.colors.green('Running: '), ux.colors.white(`${obj.command} ${obj.args.join(' ')}`))
        child.on('close', (code) => {
          if (code === 0) {
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
