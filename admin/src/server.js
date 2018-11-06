/* @flow */

import Path from 'path'
import fs from 'fs'

const METADATA_DIRNAME = '.gaia-metadata'

function runSubprocess(cmd: string, argv: Array<string>, env: Object, uid: ?number, gid: ?number) 
: Promise<{ 'status': Object, 'statusCode': number }> {
    const opts = {
      cwd: '/',
      env,
      stdio: [
        null,             // no stdin
        'pipe',           // send stdout to log
        'pipe'            // send stderr to log
      ],
      detached: false,    // child will die with this process, if need be
      shell: false,
      windowsHide: true
    }

    if (!!uid) {
      opts.setuid = uid
    }

    if (!!gid) {
      opts.setgid = gid
    }
   
    const subproc = child_process.spawn(cmd, argv, opts)
    
    return new Promise((resolve, reject) => {
      subproc.on('exit', (code, signal) => {
        if (code === 0) {
          const ret = { 'statusCode': 200, 'status': 'OK' }
          resolve(ret)
        } else {
          const ret = { 
            'statusCode': 500, 
            'status': { 'error': `Command exited with code ${code} (signal=${signal})` }
          }
          resolve(ret)
        }
      })

      subproc.on('close', (code, signal) => {
        if (code === 0) {
          const ret = { 'statusCode': 200, 'status': 'OK' }
          resolve(ret)
        } else {
          const ret = { 
            'statusCode': 500, 
            'status': { 'error': `Command closed with code ${code} (signal=${signal})` }
          }
          resolve(ret)
        }
      })

      subproc.on('error', () => {
        const ret = { 
          'statusCode': 500, 
          'status': { 'error': 'Command could not be spawned, killed, or signaled' }
        }
        resolve(ret)
      })
    })
}

export class AdminAPI {

  constructor() {
  }

  checkAuthorization(config: Object, authHeader: string) : Promise<boolean> {
    return Promise.resolve().then(() => {
      if (!authHeader) {
        logger.error('No authorization header given')
        return false
      }
      if (!authHeader.toLowerCase().startsWith('bearer')) {
        logger.error('Malformed authorization header')
        return false
      }

      const bearer = authHeader.toLowerCase().slice('bearer '.length)
      if (!!config.apiKey && bearer === config.apiKey) {
        return true
      }

      logger.error('Invalid authorization header')
      return false
    })
  }
  
  // Reloads the Gaia hub by launching the reload subprocess
  handleReload(config: Object) : Promise<{ 'status': Object, 'statusCode': number }> {
    if (!config.reloadSettings.command) {
      // reload is not defined 
      const ret = { 'statusCode': 404, 'status': { 'error': 'No reload command defined' } }
      return Promise.resolve().then(() => ret)
    }

    const cmd = config.reloadSettings.command
    const argv = config.reloadSettings.argv ? config.reloadSettings.argv : []
    const env = config.reloadSettings.env ? config.reloadSettings.env : {}
    const uid = config.reloadSettings.setuid
    const gid = config.reloadSettings.setgid

    return runSubprocess(cmd, argv, env, uid, gid)
  }

  // Sets 
}
