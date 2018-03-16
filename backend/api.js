const KoaRouter = require('koa-router')
const bodyParser = require('koa-bodyparser')
const os = require('os')
const gamestate = require('./gamestate')

const router = new KoaRouter()

router.use(
  bodyParser({
    onerror (_err, ctx) {
      ctx.throw(422, 'body parse error')
    }
  })
)

router.get('/ping', async (ctx, next) => {
  ctx.body = {
    pid: process.pid,
    uptime: process.uptime(),
    user: ctx.state.user,
    client_ip: ctx.ip,
    host: os.hostname(),
    query: ctx.request.query
  }
})

router.get('/gamestate', async (ctx, next) => {
  const query = ctx.request.query
  ctx.body = gamestate.getGameState(query.noBox, query.noCar, query.noAirdrop, parseInt(query.itemFlags))
})

router.get('/dump', async (ctx, next) => {
  ctx.body = gamestate.dump()
})

// input: { action: 'start'/'pause'/'stop', speed: '1.0'}
router.post('/playback', async (ctx, next) => {
  const input = ctx.request.body
  switch (input.action) {
    case 'start':
      let inputSpeed = parseFloat(input.speed)
      let restart = input.restart === 'true'
      if (restart) {
        gamestate.stopPlayback()
      }
      let eventCount = parseInt(input.eventCount) // optional, play for a certain amount of events and pause
      inputSpeed = inputSpeed > 0 ? inputSpeed : 1.0
      gamestate.startPlayback(inputSpeed, eventCount)
      break
    case 'pause':
      gamestate.pausePlayback()
      break
    case 'stop':
      gamestate.stopPlayback()
      break
    default:
      ctx.throw('invalid action', 400)
  }
  ctx.body = 'OK'
})

module.exports = router
