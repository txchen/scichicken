const logger = require('pino')()
let logLevel = process.env.LOGLEVEL
logLevel = logLevel || 'warn'
logger.level = logLevel

module.exports = logger
