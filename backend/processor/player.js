const CONSTS = require('../constants')

function processPlayer (buf, actor, repObj, waitingHandle, dataOut, iteration) {
  switch (waitingHandle) {
    case 1:
      if (buf.readBit()) {
        // bHidden
        dataOut.hidden = true
        dataOut.disappear = true
      }
      break
    case 2:
      if (!buf.readBit()) {
        // bReplicateMovement
        dataOut.noMovement = true
        dataOut.disappear = true
      }
      break
    case 3:
      if (buf.readBit()) {
        // tearOff
        dataOut.tearoff = true
        dataOut.disappear = true
      }
      break
    case 4:
      buf.readInt(CONSTS.ROLE_MAX) // role
      break
    case 5:
      [ownerGuid, owner] = buf.readObject()
      dataOut.playerOwner = ownerGuid // seems never hit this
      break
    case 6:
      const movement = buf.readMovement(true /* isMoving */, true /* isPlayer */)
      if (movement[0] >= 0 && movement[1] >= 0) { // readVecotr sometime might get me negative value, might be a bug
        dataOut.newLoc = movement
      }
      break
    case 7:
      // when player get into car, we will get
      // [03-02T20:48:09.272 - Symbol(PlayerUpdate) - guid:xxx -- {"noMovement":true,"disappear":true,"playerAttachTo":5140,"pToPS":0} --- (22500)
      // 5140 is the car guid
      [attachGuid, attachName] = buf.readObject()
      dataOut.attachedTo = attachGuid
      // then when he get off the car
      // [03-02T20:49:37.773 - Symbol(PlayerUpdate) - guid:xxx -- {"newLoc":[1165.6766,2849.3476,164.672,8.4759521484375],"playerAttachTo":0,"pToPS":yyy} --- (27454)
      break
    case 8:
      buf.readVector(10000, 30) // locationOffset, not sure what it is
      break
    case 9:
      buf.readVector(10000, 30) // locationOffset, not sure what it is
      break
    case 10:
      buf.readRotationShort()
      break
    case 11:
      buf.readName() // attachSocket
      break
    case 12:
      [attachComponnent, attachName] = buf.readObject()
      break
    case 13:
      buf.readInt(CONSTS.ROLE_MAX) // role
      break
    case 14:
      buf.readBit()
      break
    case 15:
      buf.readObject()
      break
    case 16:
      [playerStateGuid, playerState] = buf.readObject()
      dataOut.pToPS = playerStateGuid // this mapping is imporatnt
      break
    case 17:
      buf.readUInt16() // pitch
      break
    case 18:
      buf.readObject()
      break
    // ACharacter
    case 19:
      buf.readObject()
      break
    case 20:
      buf.readName()
      break
    case 21:
      buf.readVector(10000, 30)
      break
    case 22:
      buf.readRotationShort()
      break
    case 23:
      buf.readBit()
      break
    case 24:
      buf.readBit()
      break
    case 25:
      buf.readBit()
      break
    case 26:
      buf.readFloat()
      break
    case 27:
      buf.readFloat()
      break
    case 28:
      buf.readByte()
      break
    case 29:
      buf.readBit()
      break
    case 30:
      buf.readFloat()
      break
    case 31:
      buf.readUInt32()
      break
    case 32:
      buf.readBit()
      break
    case 33:
      buf.readObject()
      break
    case 34:
      buf.readFloat()
      break
    case 35:
      buf.readVector(10000, 30)
      break
    case 36:
      buf.readRotationShort()
      break
    case 37:
      buf.readObject()
      break
    case 38:
      buf.readName()
      break
    case 39:
      buf.readBit()
      break
    case 40:
      buf.readBit()
      break
    case 41:
      buf.readBit() // bHasAdditiveSources
      buf.readBit() // bHasOverrideSources
      buf.readVector(10, 24) // lastPreAdditiveVelocity
      buf.readBit() // bIsAdditiveVelocityApplied
      buf.readUInt8() // flags
      break
    case 42:
      buf.readVector(10, 24)
      break
    case 43:
      buf.readVector(10, 24)
      break
    // AMutableCharacter
    case 44:
      const arrayNum = buf.readUInt16()
      let index = buf.readIntPacked()
      while (index != 0) {
        buf.readUInt8()
        index = buf.readIntPacked()
      }
      break
    // ATslCharacter
    case 45:
      buf.readInt(8) // Remote_CastAnim
      break
    case 46:
      buf.readBit() // CurrentWeaponZoomLevel
      break
    case 47:
      buf.readFloat() // BuffFinalSpreadFactor
      break
    case 48:
      buf.readObject() // InventoryFacade
      break
    case 49:
      buf.readObject() // WeaponProcessor
      break
    case 50:
      buf.readByte() // CharacterState
      break
    case 51:
      buf.readBit() // bIsScopingRemote
      break
    case 52:
      buf.readBit() // bIsAimingRemote
      break
    case 53:
      buf.readBit() // bIsFirstPersonRemote
      break
    case 54:
      buf.readBit() // bIsInVehicleRemote
      break
    case 55:
      buf.readUInt32() // SpectatedCount
      break
    case 56:
      buf.readObject() // Team
      break
    case 57: // begin FTakeHitInfo
      buf.readFloat() // ActualDamage
      break
    case 58:
      buf.readObject() // DamageType
      break
    case 59:
      buf.readObject() // PlayerInstigator
      break
    case 60:
      buf.readVector(1, 20) // DamageOrigin
      break
    case 61:
      buf.readVector(1, 20) // RelHitLocation
      break
    case 62:
      buf.readName() // BoneName
      break
    case 63:
      buf.readFloat() // DamageMaxRadius
      break
    case 64:
      buf.readByte() // ShotDirPitch
      break
    case 65:
      buf.readByte() // ShotDirYaw
      break
    case 66:
      buf.readBit() // bPointDamage
      break
    case 67:
      buf.readBit() // bRadialDamage
      break
    case 68:
      buf.readBit() // bKilled
      break
    case 69:
      buf.readByte() // EnsureReplicationByte
      break
    case 70:
      buf.readName() // AttackerWeaponName
      break
    case 71:
      buf.readFloatVector() // AttackerLocation
      break // FTakeHitInfo end
    case 72:
      buf.readInt(3) // TargetingType
      break
    case 73:
      buf.readFloat() // ReviveCastingTime
      break
    case 74:
      buf.readBit() // bWantsToRun
      break
    case 75:
      buf.readBit() // bWantsToSprint
      break
    case 76:
      buf.readBit() // bWantsToSprintingAuto
      break
    case 77:
      buf.readBit() // bWantsToRollingLeft
      break
    case 78:
      buf.readBit() // bWantsToRollingRight
      break
    case 79:
      buf.readBit() // bIsPeekLeft
      break
    case 80:
      buf.readBit() // bIsPeekRight
      break
    case 81:
      buf.readBit() // IgnoreRotation
      break
    case 82:
      buf.readBit() // bIsGroggying
      break
    case 83:
      buf.readBit() // bIsThirdPerson
      break
    case 84:
      buf.readBit() // bIsReviving
      break
    case 85:
      buf.readBit() // bIsWeaponObstructed
      break
    case 86:
      buf.readBit() // bIsCoatEquipped
      break
    case 87:
      buf.readBit() // bIsZombie
      break
    case 88:
      buf.readBit() // bIsThrowHigh
      break
    case 89:
      buf.readBit() // bUseRightShoulderAiming
      break
    case 90:
      buf.readRotationShort() // GunDirectionSway
      break
    case 91:
      buf.readFixedVector(1, 16) // AimOffsets
      break
    case 92:
      buf.readObject() // NetOwnerController
      break
    case 93:
      buf.readBit() // bAimStateActive
      break
    case 94:
      buf.readBit() // bIsHoldingBreath
      break
    case 95:
      const health = buf.readFloat() // Health
      dataOut.health = health
      break
    case 96:
      buf.readBit() // HealthMax
      break
    case 97:
      buf.readFloat() // GroggyHealth
      break
    case 98:
      buf.readFloat() // GroggyHealthMax
      break
    case 99:
      buf.readFloat() // BoostGauge
      break
    case 100:
      buf.readFloat() // BoostGaugeMax
      break
    case 101:
      buf.readInt(8) // ShoesSoundType
      break
    case 102:
      buf.readObject() // VehicleRiderComponent
      break
    case 103:
      buf.readBit() // bIsActiveRagdollActive
      break
    case 104:
      buf.readInt(4) // PreReplicatedStanceMode
      break
    case 105:
      buf.readBit() // bServerFinishedVault
      break
    case 106:
      buf.readBit() // bWantsToCancelVault
      break
    case 107:
      buf.readBit() // bIsDemoVaulting_CP
      break
    default:
      return false
  }
  return true
}

module.exports = processPlayer
