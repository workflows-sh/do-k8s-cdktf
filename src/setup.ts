import fs from 'fs'
import util from 'util';
import { ux, sdk } from '@cto.ai/sdk';
import { exec as oexec } from 'child_process';
import { createWorkspace, getWorkspaceOutputs } from './helpers/tfc/index'
const pexec = util.promisify(oexec);

async function run() {

  // make sure terraform has the appropriate credentials in rc
  const tfrc = '/home/ops/.terraform.d/credentials.tfrc.json'
  await exec(`sed -i 's/{{token}}/${process.env.TFC_TOKEN}/g'  ${tfrc}`)
    .catch(e => { console.log(e)})

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

  // Pull env vars from secret vault and set on process.env
  // Its super annoying that it auto prompts if you cannot find it
  // const secret = await sdk.getSecret(`${STACK_ENV.toUpperCase()}_KUBE_CONFIG`) 
  // process.env.KUBE_CONFIG = secret[`${STACK_ENV.toUpperCase()}_KUBE_CONFIG`]

  sdk.log(`📦 Setting up the stack...`)
  // await exec(`./node_modules/.bin/cdktf synth`, {
    // env: { 
      // ...process.env, 
      // CDKTF_LOG_LEVEL: 'info',
      // STACK_ENV: STACK_ENV,
      // STACK_TYPE: STACK_TYPE, 
      // STACK_REPO: STACK_REPO,
      // STACK_TAG: STACK_TAG
    // }
  // })
  // .catch(e => {
    // console.log('Could not synthesize', e)
    // process.exit(1)
  // })

  // sync stacks>workspaces for separated imperative state
  console.log(`🛠  We will now initialize ${ux.colors.white('Terraform Cloud')} workspaces for your stack...\n`)
  const errors:any[] = [] 
  for(const stack of STACKS[STACK_ENV]) {
    ux.print(`✅ Setting up a ${ux.colors.green(stack)} workspace in Terraform Cloud...`)
   try {
      let res = await createWorkspace(process?.env?.STACK_ORG ?? '', stack, process?.env?.TFC_TOKEN ?? '')
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

  ux.print(`⚙️  Deploying the stack via ${ux.colors.white('Terraform Cloud')}...`)
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
  // Get the AWS command to retrieve kube config
  .then(async () => {

    let url = `https://app.terraform.io/app/${process.env.STACK_ORG}/workspaces/`
    console.log(`✅ View progress in ${ux.colors.blue(ux.url('Terraform Cloud', url))}.`)

     try {

      // get workspace outputs
      const outputs:any = {}
      await Promise.all(STACKS[STACK_ENV].map(async (stack) => {
        let output = await getWorkspaceOutputs(process?.env?.STACK_ORG ?? '', stack, process?.env?.TFC_TOKEN ?? '')
        Object.assign(outputs, output)
     }))

      const CONFIG_KEY = `${STACK_ENV}_CONFIG`
      const K8S_SECRET_KEY = `${STACK_ENV}_${STACK_TYPE}_KUBE_CONFIG`.toUpperCase().replace('-','_')

      // If we don't already have a kube config, let's get it and store it
      if(!process.env[K8S_SECRET_KEY]) {

        console.log('🔒 Syncing state with vault.')

        // get the dok8s kubeconfig
        await exec(`doctl kubernetes cluster kubeconfig save ${outputs.cluster.name} -t ${process.env.DO_TOKEN}`)
          .catch(err => { throw err })

        const config = await pexec('cat ~/.kube/config')
        //console.log(config.stdout)
        console.log('')

        // save the KubeConfig to secret store using the env and stack name prefix
        sdk.setSecret(K8S_SECRET_KEY, config.stdout)
        ux.print(`✅ Saving k8s config to team vault for ${outputs.cluster.name} as ${K8S_SECRET_KEY}`)
        console.log(`⚠️  You can configure this k8s config in ~/.kube/config or upload it to Lens:`)
        console.log(config.stdout)
        console.log('')

        await exec(`doctl auth init -t ${process.env.DO_TOKEN}`)
          .catch(err => console.log(err))

        await exec(`doctl registry login -t ${process.env.DO_TOKEN}`)
          .catch(err => console.log(err))

        console.log(`\n🚀 Confirming connection to ${outputs.cluster.name}:`)
        await exec('kubectl get nodes')
          .catch(err => console.log(err))

        console.log(`\n🔒 Configuring k8s cluster with access to registry ${outputs.registry.name}`)
        await exec(`doctl registry kubernetes-manifest | kubectl apply -f -`)
          .catch(err => console.log(err))
       }

      console.log('\n✅ The output => vault sync for your stacks is complete.')
      console.log(`Saving the following outputs in your team config as ${CONFIG_KEY}:`)
      console.log(outputs)

    } catch (e) {
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
