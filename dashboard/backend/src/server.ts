import Ajv from 'ajv'
import { Config, ModuleSettings, logger } from './config.js'
import { hubConfigSchema, adminConfigSchema, readerConfigSchema } from './config.js'
import { runSubprocess, readConfigFileSections, patchConfigFile } from './utils'

export class Server {

	config: Config

	constructor(config: Config) {
		this.config = config
	}

	handleGetHubConfig(): Promise<{ status: any, statusCode: number }> {
		return this.handleGetFields(this.config.hubSettings, Object.keys(hubConfigSchema.properties))
	}

	handleSetHubConfig(newConfig: any): Promise<{ status: any, statusCode: number }> {
		const ajv = new Ajv({ strict: false })
		const valid = ajv.validate(hubConfigSchema, newConfig)
		if (!valid) {
			logger.error(`Failed to validate Hub configuration: ${JSON.stringify(ajv.errors)}`)
			const ret = {
				statusCode: 400,
				status: {
					error: 'Invalid Hub configuration',
					more: JSON.parse(JSON.stringify(ajv.errors))
				}
			}
			return Promise.resolve().then(() => ret)
		}
		return this.handleSetFields(this.config.hubSettings, newConfig, Object.keys(hubConfigSchema.properties))
	}

	handleGetAdminConfig(): Promise<{ status: any, statusCode: number }> {
		return this.handleGetFields(this.config.adminSettings, Object.keys(adminConfigSchema.properties))
	}

	handleSetAdminConfig(newConfig: any): Promise<{ status: any, statusCode: number }> {
		const ajv = new Ajv({ strict: false })
		const valid = ajv.validate(adminConfigSchema, newConfig)
		if (!valid) {
			logger.error(`Failed to validate Admin configuration: ${JSON.stringify(ajv.errors)}`)
			const ret = {
				statusCode: 400,
				status: {
					error: 'Invalid Admin configuration',
					more: JSON.parse(JSON.stringify(ajv.errors))
				}
			}
			return Promise.resolve().then(() => ret)
		}
		return this.handleSetFields(this.config.adminSettings, newConfig, Object.keys(adminConfigSchema.properties))
	}

	handleGetReaderConfig(): Promise<{ status: any, statusCode: number }> {
		return this.handleGetFields(this.config.readerSettings, Object.keys(readerConfigSchema.properties))
	}

	handleSetReaderConfig(newConfig: any): Promise<{ status: any, statusCode: number }> {
		const ajv = new Ajv({ strict: false })
		const valid = ajv.validate(readerConfigSchema, newConfig)
		if (!valid) {
			logger.error(`Failed to validate Reader configuration: ${JSON.stringify(ajv.errors)}`)
			const ret = {
				statusCode: 400,
				status: {
					error: 'Invalid Reader configuration',
					more: JSON.parse(JSON.stringify(ajv.errors))
				}
			}
			return Promise.resolve().then(() => ret)
		}
		return this.handleSetFields(this.config.readerSettings, newConfig, Object.keys(readerConfigSchema.properties))
	}

	// Reloads the Gaia hub by launching the reload subprocess
	handleReload(config: ModuleSettings): Promise<{ status: any, statusCode: number }> {
		if (!config.reloadCommandLine.command) {
			// reload is not defined 
			const ret = { statusCode: 404, status: { error: 'No reload command defined' } }
			return Promise.resolve().then(() => ret)
		}

		return Promise.resolve().then(() => {
			const cmd = config.reloadCommandLine.command
			const argv = config.reloadCommandLine.argv
			const env = config.reloadCommandLine.env
			const uid = config.reloadCommandLine.setuid
			const gid = config.reloadCommandLine.setgid
			return runSubprocess(cmd, argv, env, uid, gid)
		})
			.then(() => {
				return { statusCode: 200, status: { result: 'OK' } }
			})
			.catch((e) => {
				return { statusCode: 500, status: { error: e.message } }
			})
	}

	// don't call this from outside this class
	handleGetFields(config: ModuleSettings, fieldList: string[]): Promise<{ status: any, statusCode: number }> {
		return Promise.resolve().then(() => {
			const configPath = config.configPath
			return readConfigFileSections(configPath, fieldList)
		})
			.then((fields) => {
				return { statusCode: 200, status: { config: fields } }
			})
			.catch((e) => {
				return { statusCode: 500, status: { error: e.message } }
			})
	}

	// don't call this from outside this class
	handleSetFields(config: ModuleSettings, newFields: any, allowedFields: string[]): Promise<{ status: any, statusCode: number }> {
		// only allow fields in allowedFields to be written
		const fieldsToWrite: Record<string, any> = {}
		for (const allowedField of allowedFields) {
			if (allowedField in newFields) {
				fieldsToWrite[allowedField] = newFields[allowedField]
			}
		}

		if (Object.keys(fieldsToWrite).length == 0) {
			const ret = { statusCode: 400, status: { error: 'No valid fields given' } }
			return Promise.resolve().then(() => ret)
		}

		return Promise.resolve().then(() => {
			const configPath = config.configPath
			return patchConfigFile(configPath, newFields)
		})
			.then(() => {
				const ret = {
					statusCode: 200,
					status: {
						message: 'Config updated -- you should reload your Gaia hub now.'
					}
				}
				return ret
			})
			.catch((e) => {
				const ret = {
					statusCode: 500,
					status: {
						error: e.message
					}
				}
				return ret
			})
	}
}
