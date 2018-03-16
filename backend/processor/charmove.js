const CONSTS = require('../constants')
const utils = require('../utils')

const ShortRotationScale = 360.0 / 65536.0

// return null or SelfLocEx event
function processCharMove (buf, actor) {
  const dataOut = {}
  while (!buf.ended()) {
    const repIndex = buf.readInt(128)
    const payloadBits = buf.readIntPacked()
    const preReadBitsLeft = buf.remainingBits
    if (payloadBits > preReadBitsLeft) {
      break
    }
    // repIndex can be 110, with payLoadBits = 49, not like loc info
    switch (repIndex) {
      case 29:
      case 33:
        if (buf.readBit()) {
          buf.readFloat() // timestamp
        }
        if (buf.readBit()) {
          buf.readVector(10, 24) // inAccel
        }
        if (buf.readBit()) {
          dataOut.loc = buf.readVector(10000, 30)
        }
        if (buf.readBit()) {
          buf.readUInt8() // compressedMoveFlags
        }
        if (buf.readBit()) {
          buf.readUInt8() // clientRoll
        }
        if (buf.readBit()) {
          const view = buf.readUInt32()
          dataOut.rotation = (view >> 16) * ShortRotationScale
        }
        break
      case 30:
      case 34:
        if (buf.readBit()) {
          buf.readFloat() // timestamp
        }
        if (buf.readBit()) {
          buf.readVector(10, 24) // inAccel
        }
        if (buf.readBit()) {
          buf.readUInt8() // pendingFlags
        }
        if (buf.readBit()) {
          buf.readUInt32() // view
        }

        if (buf.readBit()) {
          buf.readFloat() // timestamp
        }
        if (buf.readBit()) {
          buf.readVector(10, 24) // inAccel
        }
        if (buf.readBit()) {
          dataOut.loc = buf.readVector(10000, 30)
        }
        if (buf.readBit()) {
          buf.readUInt8() // compressedMoveFlags
        }
        if (buf.readBit()) {
          buf.readUInt8() // clientRoll
        }
        if (buf.readBit()) {
          const view = buf.readUInt32()
          dataOut.rotation = (view >> 16) * ShortRotationScale
        }
        break
      default:
        break
    }
    const postReadBitsLeft = buf.remainingBits
    if (preReadBitsLeft - postReadBitsLeft < payloadBits) {
      buf.skipBits(payloadBits - preReadBitsLeft + postReadBitsLeft)
    }
  } // end of while loop
  if (Object.keys(dataOut).length > 0) {
    // EVT_HERE: SELFLOCEX
    return { type: CONSTS.EventTypes.SELFLOCEX, guid: actor.guid, data: dataOut }
  }
  return null
}

module.exports = processCharMove
