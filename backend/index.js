const Koa = require('koa')
const koaStatic = require('koa-static')
const etag = require('koa-etag')
const conditional = require('koa-conditional-get')
const mount = require('koa-mount')
const api = require('./api')

const app = new Koa()
app.proxy = true

app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  ctx.set('X-SCICHIKEN-Latency', ms)
})

app.use(mount('/api', api.routes()))

app.use(conditional())
app.use(etag())
app.use(koaStatic('static', { gzip: true }))

module.exports = app
