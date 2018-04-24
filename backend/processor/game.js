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
    case 24:
      buf.readBit() // bIsCustomGame
      break
    case 25:
      buf.readBit() // bIsWinnerombieTeam
      break
    case 26:
      buf.readUInt32() // NumTeams
      break
    case 27:
      buf.readUInt32() // RemainingTime
      break
    case 28:
      buf.readUInt32() // MatchElapsedMinutes
      break
    case 29:
      buf.readFloat() // MatchElapsedTimeSec
      break
    case 30:
      buf.readBit() // bTimerPaused
      break
    case 31:
      buf.readBit() // bShowLastCircleMark
      break
    case 32:
      buf.readBit() // bCanShowLastCircleMark
      break
    case 33:
      buf.readBit() // bCanKillerSpectate
      break
    case 34:
      buf.readUInt32() // NumJoinPlayers
      break
    case 35:
      buf.readUInt32() // NumAlivePlayers
      break
    case 36:
      buf.readUInt32() // NumAliveZombiePlayers
      break
    case 37:
      buf.readUInt32() // NumAliveTeams
      break
    case 38:
      buf.readUInt32()  //NumStartPlayers
      break
    case 39:
      buf.readUInt32() // NumStartTeams
      break
    case 40:
      dataOut.safezone = buf.readFloatVector() // SafetyZonePosition
      break
    case 41:
      dataOut.safezoneRadius = buf.readFloat() // SafetyZoneRadius
      break
    case 42:
      dataOut.poison = buf.readFloatVector() // PoisonGasWarningPosition
      break
    case 43:
      dataOut.poisonRadius = buf.readFloat() // PoisonGasWarningRadius
      break
    case 44:
      buf.readFloatVector() // RedZonePosition
      break
    case 45:
      buf.readFloat() // RedZoneRadius
      break
    //case 46:
    //  // LastCirclePosition
    //  break
    case 47:
      buf.readFloat() // TotalReleaseDuration
      break
    case 48:
      buf.readFloat() // ElapsedReleaseDuration
      break
    case 49:
      buf.readFloat() // TotalWarningDuration
      break
    case 50:
      buf.readFloat() // ElapsedWarningDuration
      break
    case 51:
      buf.readBit() // bIsGasRelease
      break
    case 52:
      buf.readBit() // bIsTeamMatch
      break
    case 53:
      buf.readBit() // bIsZombieMode
      break
    case 54:
      buf.readBit() // bUseXboxUnauthorizedDevice
      break
    case 55:
      buf.readFloatVector() // SafetyZoneBeginPosition
      break
    case 56:
      buf.readFloat() // SafetyZoneBeginRadius
      break
    case 57:
      buf.readBit() // MatchStartType
      break
    case 58:
      buf.readBit() // bShowAircraftRoute
      break
    case 59:
      buf.readBit() // bIsWarMode
      break
    case 60:
      buf.readUInt32() // GoalScore
      break
    //case 61:
    //  // TeamScores
    //  break
    //case 62:
    //  // NextRespawnTimeTick
    //  break
    //case 63:
    //  // TimeLimitTick
    //  break
    //case 64:
    //  // bIsTeamElimination
    //  break
    //case 65:
    //  // bUseWarRoyaleBluezone
    //  break
    //case 66:
    //  // bUsingSquadInTeam
    //  break
    //case 67:
    //  // TeamIds
    //  break
    //case 68:
    //  // TeamIndices
    //  break
    //case 69:
    //  // TeamLeaderNames
    //  break
    default:
      return false
  }
  return true
}

module.exports = processGame
