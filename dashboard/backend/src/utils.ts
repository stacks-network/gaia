import fs from 'fs'
import childProcess from 'child_process'
import { logger } from './config.js'

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function notEmpty<TValue>(value: TValue): value is NonNullable<TValue> {
  return value !== null && value !== undefined;
}

export function runSubprocess(
	cmd: string,
	argv: string[],
	env: NodeJS.ProcessEnv,
	uid?: number,
	gid?: number
): Promise<{ 'status': any, 'statusCode': number }> {
	const opts: childProcess.SpawnOptions = {
		cwd: '/',
		env: env,
		stdio: [
			null,             // no stdin
			'pipe',           // send stdout to log
			'pipe'            // send stderr to log
		],
		detached: false,    // child will die with this process, if need be
		shell: false,
		windowsHide: true
	}

	if (uid) {
		opts.uid = uid
	}

	if (gid) {
		opts.gid = gid
	}

	return new Promise((resolve) => {
		childProcess.spawn(cmd, argv, opts)
			.on('exit', (code: number, signal: string) => {
				if (code === 0) {
					const ret = { statusCode: 200, status: { result: 'OK' } }
					resolve(ret)
				} else {
					const ret = {
						statusCode: 500,
						status: { error: `Command exited with code ${code} (signal=${signal})` }
					}
					resolve(ret)
				}
			})
			.on('close', (code: number, signal: string) => {
				if (code === 0) {
					const ret = { statusCode: 200, status: { result: 'OK' } }
					resolve(ret)
				} else {
					const ret = {
						statusCode: 500,
						status: { error: `Command closed with code ${code} (signal=${signal})` }
					}
					resolve(ret)
				}
			})
			.on('error', () => {
				const ret = {
					statusCode: 500,
					status: { error: 'Command could not be spawned, killed, or signaled' }
				}
				resolve(ret)
			})
	})
}

// Atomically modify the config file.
// The Gaia config file is a set of key/value pairs, where each top-level key is one aspect
// of its configuration.  THis method "patches" the set of key/value pairs with `newFields`.
// The set of top-level key/value pairs in the existing config file and `newFields` will be merged,
// but if key1 === key2, then value2 overwrites value1 completely (even if value1 and value2 are
// objects with their own key/value pairs).
export function patchConfigFile(configFilePath: string, newFields: Record<string, any>) {
	if (!configFilePath) {
		throw new Error('Config file not given')
	}

	try {
		fs.accessSync(configFilePath, fs.constants.R_OK | fs.constants.W_OK)
	} catch (e) {
		logger.error(`Config file does not exist or cannot be read/written: ${configFilePath}`)
		throw new Error('Config file does not exist or cannot be read/written')
	}

	let configData
	let config

	try {
		configData = fs.readFileSync(configFilePath).toString()
	} catch (e) {
		logger.error(`Failed to read config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to read config file')
	}

	try {
		config = JSON.parse(configData)
	} catch (e) {
		logger.error(`Failed to parse config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to parse config file')
	}

	config = Object.assign(config, newFields)
	const tmpConfigPath = `${configFilePath}.new`

	try {
		fs.writeFileSync(tmpConfigPath, JSON.stringify(config, null, 2))
	} catch (e) {
		logger.error(`Failed to write config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to write new config file')
	}

	try {
		fs.renameSync(tmpConfigPath, configFilePath)
	} catch (e) {
		logger.error(`Failed to rename config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to update config file')
	}
}

// get part(s) of a config file 
export function readConfigFileSections(configFilePath: string, fields: string | string[]): any {

	if (!configFilePath) {
		throw new Error('Config file nto given')
	}

	try {
		fs.accessSync(configFilePath, fs.constants.R_OK)
	} catch (e) {
		logger.error(`Config file does not exist or cannot be read: ${getErrorMessage(e)}`)
		throw new Error('Config file does not exist or cannot be read')
	}

	let configData
	let config
	const ret: Record<string, any> = {}

	try {
		configData = fs.readFileSync(configFilePath).toString()
	} catch (e) {
		logger.error(`Failed to read config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to read config file')
	}

	try {
		config = JSON.parse(configData)
	} catch (e) {
		logger.error(`Failed to parse config file: ${getErrorMessage(e)}`)
		throw new Error('Failed to parse config file')
	}

	if (typeof fields === 'string') {
		fields = [fields]
	}

	for (const field of fields) {
		if (config[field] !== undefined) {
			ret[field] = config[field]
		}
	}

	return ret
}