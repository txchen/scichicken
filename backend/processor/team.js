function processTeam (buf, actor, repObj, waitingHandle, dataOut) {
  // console.log('!!!!!!!!!!processTeam handle=', waitingHandle, actor.guid, buf.remainingBits)
  switch (waitingHandle) {
    case 5:
      [ownerGuid, owner] = buf.readObject() // [ownerGuid, owner]
      dataOut.ownerGuid = ownerGuid
      break
    case 16:
      const location = buf.readVector(10000, 30)
      break
    case 17:
      const rotation = buf.readRotationShort()
      break
    case 18:
      dataOut.playerName = buf.readString()
      break
    default:
      return false
  }
  return true
}

module.exports = processTeam
