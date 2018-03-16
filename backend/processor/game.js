function processGame (buf, actor, repObj, waitingHandle, dataOut, i) {
  // console.log('gameStateProcess handle=', waitingHandle, actor.guid, buf.remainingBits)
  switch (waitingHandle) {
    case 16:
      dataOut.GameModeClass = buf.readObject() // GameModeClass !
      break
    case 17:
      dataOut.SpectatorClass = buf.readObject() // SpectatorClass !
      break
    case 18:
      buf.readBit() // bReplicatedHasBegunPlay
      break
    case 19:
      buf.readFloat() // ReplicatedWorldTimeSeconds
      break
    case 20:
      dataOut.matchState = buf.readName() // matchState !
      break
    case 21:
      buf.readUInt32() // ElapsedTime, never hit this
      break
    case 22:
      dataOut.matchId = buf.readString() // matchId !
      break
    case 23:
      dataOut.matchShortGuid = buf.readString() // matchShortGuid !
      break
    case 25:
      buf.readBit() // bIsWinnerombieTeam
      break
    case 26:
      buf.readUInt32() // RemainingTime
      break
    case 27:
      buf.readUInt32() // MatchElapsedMinutes
      break
    case 28:
      buf.readUInt32() // bTimerPaused
      break
    case 29:
      buf.readBit() // bShowLastCircleMark
      break
    case 30:
      buf.readBit() // bCanShowLastCircleMark
      break
    case 31:
      buf.readUInt32() // numAlivePlayers, never hit this
      break
    case 32:
      buf.readUInt32() // numJoinPlayers
      break
    case 33:
      buf.readUInt32() // NumAlivePlayers
      break
    case 34:
      buf.readUInt32() // NumAliveZombiePlayers
      break
    case 35:
      buf.readUInt32() // NumAliveTeams
      break
    case 36:
      buf.readUInt32()  //NumStartPlayers
      break
    case 37:
      buf.readUInt32() // NumStartTeams
      break
    case 38:
      dataOut.poison = buf.readFloatVector()
      break
    case 39:
      dataOut.poisonRadius = buf.readFloat() // poison radius
      break
    case 40:
      dataOut.safezone = buf.readFloatVector()
      break
    case 41:
      dataOut.safezoneRadius = buf.readFloat() // safezone radius
      break
    case 42:
      buf.readFloatVector() // redzone !
      break
    case 43:
      buf.readFloat() // redzone radius !
      break
    case 44:
      buf.readFloat() // TotalReleaseDuration
      break
    case 45:
      buf.readFloat() // ElapsedReleaseDuration
      break
    case 46:
      buf.readFloat() // TotalWarningDuration
      break
    case 47:
      buf.readFloat() // ElapsedWarningDuration
      break
    case 48:
      buf.readFloat() // not sure what, but it is float
      break
    case 49:
      buf.readBit() // bIsTeamMatch
    case 50:
      buf.readBit() // bIsZombieMode
    case 51:
      buf.readFloatVector() // SafetyZoneBeginPosition
      break
    case 52:
      buf.readFloat()
    case 53:
      buf.readByte() // MatchStartType
      break
    default:
      return false
  }
  return true
}

module.exports = processGame
