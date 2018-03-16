const CONSTS = require('../constants')
const utils = require('../utils')

function processAPawn (buf, actor, repObj, waitingHandle, dataOut) {
  //console.log('processAPawn handle=', waitingHandle, actor.guid, buf.remainingBits)
  switch (waitingHandle) {
    case 1:
      if (buf.readBit()) { // bHidden
        dataOut.hidden = true
        dataOut.disappear = true
      }
      break
    case 2:
      if (!buf.readBit()) { // bReplicateMovement
        dataOut.notMovement = true
        dataOut.disappear = true
      }
      break
    case 3:
      if (buf.readBit()) { // tearOff
        dataOut.tearoff = true
        // hack?
        if (actor.T !== CONSTS.ACTOR_TYPES.CAR) {
          dataOut.disappear = true
        }
      }
      break
    case 4:
      buf.readInt(CONSTS.ROLE_MAX) // role
      break
    case 5:
      [ownerGuid, owner] = buf.readObject()
      dataOut.apawnOwner = ownerGuid // seems never got a meaningful owner, maybe data error
      break
    case 6:
      // this can be airdrop, droppedItemGroup?, or other apawn
      let moving = true
      if (actor.T === CONSTS.ACTOR_TYPES.BOX || actor.T === CONSTS.ACTOR_TYPES.AIRDROP) {
        moving = false // low def location
      }
      const movement = buf.readMovement(moving /*isMoving*/, false /*isPlayer*/)
      if (movement[0] >= 0 && movement[1] >= 0) { // readVecotr sometime might get me negative value, might be a bug
        dataOut.newLoc = movement
      }
      break
    case 7:
      [ownerGuid, owner] = buf.readObject()
      dataOut.attachedTo = ownerGuid  // seems never got a meaningful owner, maybe data error
      break
    case 8:
      buf.readVector(10000, 30) // locationOffset, not sure what it is
      break
    default:
      return false
  }
  return true
}

module.exports = processAPawn
