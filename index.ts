import { Stack } from './src/stack/index';

const STACK_ENV = process.env.STACK_ENV || 'dev'
const STACK_ORG = process.env.STACK_ORG || 'cto-ai'
const STACK_REPO = process.env.STACK_REPO || 'sample-app'
const STACK_TAG = process.env.STACK_TAG || 'main'
const STACK_TYPE = process.env.STACK_TYPE || 'do-k8s'
const STACK_ENTROPY = process.env.STACK_ENTROPY || '01012022'

async function run() {

  new Stack({
    org: STACK_ORG,
    env: STACK_ENV,
    repo: STACK_REPO,
    tag: STACK_TAG,
    key: STACK_TYPE,
    entropy: STACK_ENTROPY
  });

}

run()
