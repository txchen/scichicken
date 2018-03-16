const CONSTS = require('../constants')
const utils = require('../utils')

const ShortRotationScale = 360.0 / 65536.0

// return null or SelfLocEx event
function processCarSync (buf, actor) {
  const dataOut = {}
  while (!buf.ended()) {
    const repIndex = buf.readInt(6)
    const payloadBits = buf.readIntPacked()
    const preReadBitsLeft = buf.remainingBits
    if (payloadBits > preReadBitsLeft) {
      break
    }
    // repIndex can be 5
    switch (repIndex) {
      case 5:
        if (buf.readBit()) {
          buf.readUInt32() // InCorrectionId
        }
        if (buf.readBit()) {
          dataOut.newLoc = buf.readVector(10000, 30) // ClientLocation
          dataOut.newLoc[1] = 8192 - dataOut.newLoc[1]
        }
        if (buf.readBit()) {
          buf.readVector(10000, 30) // ClientLinearVelocity
        }
        if (buf.readBit()) {
          //FVector_NetQuantizeNormal ClientRotator
          const view = buf.readUInt32()
          dataOut.rotation = (view >> 16) * ShortRotationScale
        }
        if (buf.readBit()) {
          buf.readVector(10000, 30) // ClientAngularVelocity
        }
      default:
        break
    }
    const postReadBitsLeft = buf.remainingBits
    if (preReadBitsLeft - postReadBitsLeft < payloadBits) {
      buf.skipBits(payloadBits - preReadBitsLeft + postReadBitsLeft)
    }
  } // end of while loop
  if (Object.keys(dataOut).length > 0) {
    // EVT_HERE: CARSYNC
    return { type: CONSTS.EventTypes.CARSYNC, guid: actor.guid, data: dataOut }
  }
  return null
}

module.exports = processCarSync
