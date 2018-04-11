const backend = require('./backend')
const PacketByPacket = require('p-by-p')
const PacketParser = require('./backend/packetparser')
const utils = require('./backend/utils')
const gamestate = require('./backend/gamestate')
const bunchStash = require('./backend/bunchstash')
const CONSTS = require('./backend/constants')
const Cap = require('cap').Cap

function printUsage () {
  console.log(
    `Usage:
  * node index.js sniff <interface> <game_pc_ip>
  * node index.js playback <pcapfile>
Example: node index.js playback '/SOME/COOL/DIR/pubg-game1.pcap' | pino
         node index.js sniff en5 192.168.0.100 | pino`
  )
  process.exit(1)
}

function startWebServer () {
  const apiServerPort = 20086
  backend.listen(apiServerPort, () => {
    console.log('Scientific Chicken Dinner listening on http://localhost:' + apiServerPort)
  })
}

function printStateOnConsole() {
  setInterval(() => {
    console.log(`[${utils.toLocalISOString(new Date())}] - playbackState: ${gamestate.playbackState}, speed: ${gamestate.playbackSpeed}, playbackIndex: ${gamestate.playbackIndex}, processedEvents: ${gamestate.totalProcessedEvents}/${gamestate.playbackEvents.length}`)
  }, 5000)
}

function main () {
  const args = process.argv.slice(2)
  if (args.length < 2 || !['sniff', 'playback'].includes(args[0])) {
    printUsage()
  }
  if (args[0] === 'sniff') {
    if (args.length !== 3) {
      printUsage()
    }
    const c = new Cap()
    const device = args[1]
    const filter = `(src host ${args[2]} and udp dst portrange 7000-7999) or (dst host ${args[2]} and udp src portrange 7000-7999)`
    const bufSize = 10 * 1024 * 1024
    const capBuffer = Buffer.alloc(65535)
    const linkType = c.open(device, filter, bufSize, capBuffer)
    c.setMinBytes && c.setMinBytes(0)
    const parser = PacketParser()
    let pIndex = 0
    c.on('packet', function (nbytes, trunc) {
      // raw packet data === buffer.slice(0, nbytes)
      pIndex++
      const rawPacketData = capBuffer.slice(0, nbytes)
      // one packet can generate 1 or 0 event
      const result = parser.parse(rawPacketData, new Date().getTime(), pIndex)
      if (result != null) {
        // result can only be UEBunch event
        const l2Evts = bunchStash.feedEvent(result)
        if (l2Evts) {
          for (const l2Evt of l2Evts) {
            if (l2Evt.type === CONSTS.EventTypes.ENCRYPTIONKEY) {
              console.log(`Got EncryptionToken ${l2Evt.data.EncryptionToken}`)
              parser.setEncryptionToken(l2Evt.data.EncryptionToken)
            } else {
              if (l2Evt.type === CONSTS.EventTypes.GAMESTOP) {
                parser.clearEncryptionToken()
              }
              gamestate.processPUBGEvent(l2Evt)
            }
          }
        }
      }
    })
    
    startWebServer()
  } else if (args[0] === 'playback') {
    const parser = PacketParser()
    // read the file and get all the events out first
    const pbyp = PacketByPacket(args[1])
    const finalEvents = []
    pbyp.on('packet', packet => {
      const result = parser.parse(packet.data, packet.header.timestamp)
      if (result != null) {
        const l2Evts = bunchStash.feedEvent(result)
        if (l2Evts) {
          for (const l2Evt of l2Evts) {
            if (l2Evt.type === CONSTS.EventTypes.ENCRYPTIONKEY) {
              console.log(`Got EncryptionToken ${l2Evt.data.EncryptionToken}`)
              parser.setEncryptionToken(l2Evt.data.EncryptionToken)
            } else {
              if (l2Evt.type === CONSTS.EventTypes.GAMESTOP) {
                parser.clearEncryptionToken()
              } else if (l2Evt.type === CONSTS.EventTypes.GAMESTART) {
                // reset the state, so that stash can process further games
                gamestate.resetGameState()
              }
              finalEvents.push(l2Evt)
            }
          }
        }
      }
    })
    pbyp.on('error', err => {
      console.log('ERROR happened during parsing the pcap file', err)
    })
    pbyp.on('end', result => {
      console.log('pcap file processing finished.', result)
      if (finalEvents.length > 0) {
        // now set the mode to playback and start the api server
        gamestate.setPlaybackMode(finalEvents)
        printStateOnConsole()
        startWebServer()
        gamestate.startPlayback(1.0, finalEvents.length)
      }
    })
    pbyp.resume()
  }
}

main()
