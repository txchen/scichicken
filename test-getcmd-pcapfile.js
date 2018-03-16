// Usage: LOGLEVEL=info node test-getcmd-pcapfile.js '/SOME/COOL/DIR/pubg-game1.pcap' | pino

const PacketByPacket = require('p-by-p')
const PacketParser = require('./backend/packetparser')
const utils = require('./backend/utils')
const logger = require('./backend/logger')
const CONSTS = require('./backend/constants')
const bunchStash = require('./backend/bunchstash')
const gamestate = require('./backend/gamestate')
const stringify = require("json-stringify-pretty-compact")

const parser = PacketParser()

const optionSummary = {}

function main () {
  const args = process.argv.slice(2)
  if (args.length !== 1 && args.length !== 2) {
    console.log(`Usage: test-getcmd-pcapfile.js <pcapfile> <countToSendToGameState>`)
    console.log(
      ` e.g.: test-getcmd-pcapfile.js /DIR/pubg-game1.pcap`
    )
  }
  const pbyp = PacketByPacket(args[0])
  const eventCountMap = new Map()

  let bunchEvents = []
  let errCount = 0
  let packetNumber = 0
  let allFinalEvents = []

  const countType = (type) => {
    const old = eventCountMap.get(type)
    const newValue = old == null ? 1 : old + 1
    eventCountMap.set(type, newValue)
  }
  pbyp.on('packet', packet => {
    // packet contains { header, data }
    packetNumber++
    let result = null
    try {
      result = parser.parse(packet.data, packet.header.timestamp, packetNumber)
    } catch (err) {
      console.log('Parsing error:', err)
      errCount++
    }
    if (result != null && result.type === CONSTS.EventTypes.UEBUNCHES && result.valid) {
      bunchEvents.push(result)
    }
  })
  pbyp.on('error', err => {
    logger.error(err, 'Error happend')
  })
  pbyp.on('end', result => {
    if (errCount) {
      logger.error({ errCount }, 'During parse, got errors')
    }
    // got all the packet parsed into events, now feed them into stash
    logger.warn({count: bunchEvents.length}, 'Got all the UEBunch events')
    for (let evt of bunchEvents) {
      const newEvts = bunchStash.feedEvent(evt)
      if (newEvts) {
        for (let newEvt of newEvts) {
          if (newEvt.type === CONSTS.EventTypes.GAMESTART) {
            gamestate.resetGameState()
          }
          countType(newEvt.type)
          allFinalEvents.push(newEvt)
        }
      }
    }
    let printCount = 0
    for (let evt of allFinalEvents) {
      printCount++
      printEvent(printCount, evt)
      if (printCount > 200000) {
        break
      }
    }
    logger.warn({count: allFinalEvents.length}, 'Got all final events')
    logger.warn('Count by result.type')
    for (let pair of eventCountMap) {
      console.log(pair)
    }
    if (args[1]) {
      const countToSendToGameState = Math.min(parseInt(args[1]), allFinalEvents.length)
      for (let i = 0; i < countToSendToGameState; i++) {
        gamestate.processPUBGEvent(allFinalEvents[i])
      }
      logger.warn(`Feed ${countToSendToGameState} events into gamestate.`)
      logger.warn(stringify(gamestate.dump()))
    }
  })
  pbyp.resume()
}

function printEvent (count, evt) {
  console.log(`[${utils.toLocalISOString(evt.time)} - ${evt.type.toString()} - guid:${evt.guid} -- ${JSON.stringify(evt.data)} --- (${count})`)
}

main()
