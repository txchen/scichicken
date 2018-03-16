const CONSTS = require('../constants')

function processPlayer (buf, actor, repObj, waitingHandle, dataOut, i) {
  //console.log('    playerStateProcess handle=', waitingHandle, actor.guid, buf.remainingBits, i)
  switch (waitingHandle) {
    case 1:
      buf.readBit() // bHidden
      break
    case 2:
      buf.readBit() // bReplicateMovement
      break
    case 3:
      buf.readBit() // bTearOff
      break
    case 4:
      buf.readInt(CONSTS.ROLE_MAX) // role
      break
    case 5:
      buf.readObject() // [ownerGuid, owner]
      break
    case 7:
      buf.readObject() // ???
      break
    case 13:
      buf.readInt(CONSTS.ROLE_MAX)
      break
    case 16:
      buf.readFloat() // score
      break
    case 17:
      buf.readByte() // ping
      break
    case 18:
      dataOut.playerName = buf.readString()
      break
    case 19:
      buf.readUInt32() // playerID
      break
    case 20:
      buf.readBit() // bIsSpectator
      break
    case 21:
      buf.readBit() // bOnlySpectator
      break
    case 22:
      buf.readBit() // isABot
      break
    case 23:
      buf.readBit() // bIsInactive
      break
    case 24:
      buf.readBit() // bFromPreviousLevel
      break
    case 25:
      buf.readUInt32() // startTime
      break
    case 26:
      const uniqueId = buf.readPropertyNetId()
      break
    case 27:
      dataOut.ranking = buf.readUInt32() // ranking
      break
    case 28:
      buf.readString() // accountId
      break
    case 29:
      buf.readString() // ReportToken
      break
    case 31:
      buf.readInt(4) // ObserverAuthorityType
      break
    case 32:
      let teamNumber = buf.readInt(100) // 0 - 99 actually
      if (teamNumber === 0) {
        teamNumber = 100 // hack, map 0 to 100, so that handling can be easiers
      }
      dataOut.teamNumber = teamNumber
      break
    case 33:
      dataOut.isZombie = buf.readBit() // bIsZombie
      break
    case 34:
      buf.readFloat() // scoreByDamage
      break
    case 35:
      buf.readFloat() // scoreByKill
      break
    case 36:
      buf.readFloat() // ScoreByRanking
      break
    case 37:
      buf.readFloat() // scorefactor
      break
    case 38:
      dataOut.numKills = buf.readUInt32() // numKills
      break
    case 39:
      // only self will receive this. data itself not helpful
      const totalMove = buf.readFloat() // TotalMovedDistanceMeter
      dataOut.selfGuid = actor.guid // use this to find self player guid
      break
    case 40:
      buf.readFloat() // TotalGivenDamages
      break
    case 41:
      buf.readFloat() // LongestDistanceKill
      break
    case 42:
      buf.readUInt32() // headshots
      break
    case 43:
      return false // ReplicatedEquipableItems
      break
    case 44:
      buf.readBit() // bIsInAircraft
      break
    case 45:
      buf.readFloat() // lastHitTime
      break
    case 46:
      buf.readString() // currentAttackerPlayerNetId
    default:
      return false
  }
  return true
}

module.exports = processPlayer
