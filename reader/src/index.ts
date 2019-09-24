import { makeHttpServer } from './http'
import { getConfig, logger } from './config'

const conf = getConfig()
const app = makeHttpServer(conf)

app.listen(
  conf.port,
  () => logger.warn(`server starting on port ${conf.port} in ${app.settings.env} mode`))

