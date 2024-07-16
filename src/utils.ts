import { exec as oexec } from 'child_process';
import util from 'util';
export function Exec(cmd, env?: any | null) {
    return new Promise(function (resolve, reject) {
        const child = oexec(cmd, env)
        child.stdout?.pipe(process.stdout)
        child.stderr?.pipe(process.stderr)
        child.on('close', (code) => { code ? reject(child.stderr) : resolve(child.stdout) })
    })
}

export const pexec = util.promisify(oexec)