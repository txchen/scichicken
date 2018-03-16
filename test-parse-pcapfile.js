// Usage: LOGLEVEL=info node test-parse-pcapfile.js '/DIR/pubg-game1.pcap' | pino

const PacketByPacket = require('p-by-p')
const PacketParser = require('./backend/packetparser')
const utils = require('./backend/utils')
const logger = require('./backend/logger')
const CONSTS = require('./backend/constants')

const parser = PacketParser()

const optionSummary = {}

function addToSummary (options) {
  for (let key in options) {
    if (options[key] === true) {
      if (optionSummary[key] == null) {
        optionSummary[key] = 1
      } else {
        optionSummary[key]++
      }
    }
  }
}

async function main () {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    console.log(`Usage: test-parse-pcapfile.js <pcapfile>`)
    console.log(
      ` e.g.: test-parse-pcapfile.js /DIR/pubg-game1.pcap`
    )
  }
  const pbyp = PacketByPacket(args[0])

  let eventCount = 0
  let packetNumber = 0
  let invalidEvent = 0
  let channelSet = new Set()
  let errCount = 0
  let totalBunchCount = 0
  pbyp.on('packet', packet => {
    // packet contains { header, data }
    packetNumber++
    let result = null
    try {
      result = parser.parse(packet.data, packet.header.timestamp, packetNumber)
    } catch (err) {
      // console.log(err)
      errCount++
    }
    // parser would only return the event that we are interested in, otherwise, it returns null
    if (result != null) {
      eventCount++
      if (result.valid === false) {
        invalidEvent++ // for those malformatted bunch udp packet
        logger.warn({ packetNumber, ...result }, 'Got Invalid Event')
      } else {
        logger.debug({ packetNumber, ...result }, 'Got Event')
      }
      for (let bunch of result.data) {
        totalBunchCount++
        addToSummary(bunch.options)
        if (bunch.chIndex === 0) {
          console.log(bunch)
        }
        channelSet.add(bunch.chIndex)
      }
    }
  })
  pbyp.on('error', err => {
    logger.error(err, 'Error happend')
  })
  pbyp.on('end', result => {
    logger.warn({ parserResult: result, eventCount, invalidEvent, totalChannel: channelSet.size, totalBunchCount }, 'pcap processing finished')
    logger.warn(optionSummary, 'bunch options summary')
    logger.warn({ errCount }, 'errCount')
  })
  pbyp.resume()
}

main().catch(err => {
  console.log('unexpected error', err)
  cleanup.then(() => {
    process.exit(2)
  })
})
