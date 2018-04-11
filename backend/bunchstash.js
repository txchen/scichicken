const CONSTS = require('./constants')
const logger = require('./logger')
const UEGUIDCache = require('./ueguidcache')
const utils = require('./utils')
const repLayoutProcessor = require('./replayoutprocessor')
const processCharMove = require('./processor/charmove')
const processCarSync = require('./processor/carsync')
// make the stash singleton

// since bunch can be partial, not every bunch can be processed immediately
// we need a stash to same the temp partial bunches
// when bunch is ready to be processed, it would generate CMD
const bunchStash = {
  _inReliables: Array(20481),
  _bunchStashes: Array(20481),
  _inPartialBunches: Array(20481),
  _actors: Array(20481),

  _closeChannel (index) {
    this._inReliables[index] = undefined
    this._bunchStashes[index] = undefined
    this._inPartialBunches[index] = undefined
    this._actors[index] = undefined
  },

  // when game starts, we should probably do this.
  reset () {
    this._inReliables.fill(undefined)
    this._bunchStashes.fill(undefined)
    this._inPartialBunches.fill(undefined)
    this._actors.fill(undefined)
  },

  // return event[] or null
  feedEvent (inputEvent) {
    if (inputEvent.type !== CONSTS.EventTypes.UEBUNCHES) {
      logger.error('Must input UEBUNCHES event')
      return
    }
    const allEvents = []
    for (const bunch of inputEvent.data) {
      //console.log(`bunch ${i++} of ${inputEvent.data.length}  chIndex: ${bunch.chIndex}  pIndexes: ${bunch.pIndexes}`)
      if (bunch.chType === CONSTS.CHTYPE_CONTROL) {
        if (inputEvent.data.length > 1) {
          logger.fatal(inputEvent, 'I dont expect control bunch in multi bunch event')
        }
        if (bunch.options.bClose === true) {
          logger.warn('got control close event')
          return [{ type: CONSTS.EventTypes.GAMESTOP, time: inputEvent.time }]
        }
        const messageType = bunch.uebuffer.readUInt8()
        if (messageType === 0 /* NMT_Hello */) {
          const IsLittleEndian = bunch.uebuffer.readUInt8()
          const RemoteNetworkVersion = bunch.uebuffer.readUInt32()
          const EncryptionToken = bunch.uebuffer.readString()
          if (EncryptionToken.length === 24) {
            return [{ type: CONSTS.EventTypes.ENCRYPTIONKEY, time: inputEvent.time, data: { EncryptionToken } }]
          } else {
            return null
          }
        } else if (messageType === 1 /* NMT_Welcome */) {
          const map = bunch.uebuffer.readString()
          const gameMode = bunch.uebuffer.readString()
          const unknown = bunch.uebuffer.readString()
          const isMiramar = /desert/i.test(map)
          return [{ type: CONSTS.EventTypes.GAMESTART, time: inputEvent.time, data: { map, isMiramar } }]
        }
        if (bunch.options.bClose) {
          return [{ type: CONSTS.EventTypes.GAMESTOP, time: inputEvent.time }]
        }
      } else if (bunch.chType === CONSTS.CHTYPE_NONE || bunch.chType === CONSTS.CHTYPE_ACTOR) {
        const bunchEvents = this._processRawBunch(bunch)
        if (bunchEvents) {
          allEvents.push(...bunchEvents)
        }
      }
    }
    if (allEvents.length > 0) {
      allEvents.forEach(e => e.time = inputEvent.time)
      return allEvents
    }
    return null
  },

  // return event[] or null
  _processRawBunch (bunch) {
    let events = []
    if (bunch.options.bHasPackageMapExports) {
      this._receiveUEGUIDBunch(bunch)
    }
    if (bunch.options.bReliable && bunch.chSeq <= this._inReliables[bunch.chIndex]) {
      return
    }
    if (this._inReliables[bunch.chIndex] == null) {
      this._inReliables[bunch.chIndex] = bunch.chSeq - 1
    }
    // not in order, stash them, until chSeq is in a string
    if (bunch.options.bReliable &&
        ((bunch.chSeq - 1) !== this._inReliables[bunch.chIndex])
       ) {
      // the fucking stashing logic here. Mine is super simple
      if (this._bunchStashes[bunch.chIndex] == null) {
        this._bunchStashes[bunch.chIndex] = []
      }
      this._bunchStashes[bunch.chIndex].push(bunch)
      if (this._bunchStashes[bunch.chIndex].length > CONSTS.RELIABLE_BUFFER) {
        logger.fatal({ count: this._bunchStashes[bunch.chIndex].length }, 'got too many bunches in stash')
      }
    } else { // not reliable, OR, chSeq is exactly good. Then go ahead and process
      const newEvts = this._receivedNextBunch(bunch)
      if (newEvts) {
        events.push(...newEvts)
      }
      const chIndex = bunch.chIndex
      // processed the stashed bunches, if they are ready to go
      // this._bunchStashes[chIndex] can be undefined or an array
      while (this._bunchStashes[chIndex] && this._bunchStashes[chIndex].length > 0) {
        const seqWanted = this._inReliables[chIndex] + 1
        // find the bunch with chSeq = inReliable[chIndex] + 1
        const readyBunch = this._bunchStashes[chIndex].find(b => b.chSeq === seqWanted)
        if (readyBunch) {
          this._bunchStashes[chIndex] = this._bunchStashes[chIndex].filter(x => x !== readyBunch)
          const evts = this._receivedNextBunch(readyBunch)
          if (evts) {
            events.push(...evts)
          }
        } else {
          break
        }
      }
    }
    if (events.length > 1) {
      logger.info({ chIndex: bunch.chIndex, count: events.length }, 'generated multiple events in bunch processing')
    }
    return events.length > 0 ? events : null
  },

  _receiveUEGUIDBunch (bunch) {
    const bHasRepLayoutExport = bunch.uebuffer.readBit()
    if (bHasRepLayoutExport) {
      logger.debug('Got true for bHasRepLayoutExport')
    }
    UEGUIDCache.isExportingUEGUIDBunch = true
    const NumGUIDsInBunch = bunch.uebuffer.readUInt32()
    if (NumGUIDsInBunch > 2048) {
      UEGUIDCache.isExportingUEGUIDBunch = false
      throw new Error(NumGUIDsInBunch + ' (NumGUIDsInBunch) > 2048')
    }
    for (let i = 0; i < NumGUIDsInBunch; i++) {
      bunch.uebuffer.readObject()
    }
    // logger.warn({ NumGUIDsInBunch, pi: bunch.pIndexes }, 'End UEGuidBunch')
    UEGUIDCache.isExportingUEGUIDBunch = false
  },

  // return final event array, generated from bunch
  _receivedNextBunch (bunch) {
    if (bunch.options.bReliable) {
      this._inReliables[bunch.chIndex] = bunch.chSeq // increase _inReliables
    }
    let bunchToHandle = bunch
    if (bunch.options.bPartial) {
      bunchToHandle = null
      if (bunch.options.bPartialInitial) {
        const curInPartialBunch = this._inPartialBunches[bunch.chIndex]
        if (curInPartialBunch != null) {
          if (!curInPartialBunch.bPartialFinal && curInPartialBunch.bReliable) {
            logger.error({ inPartialSeq: curInPartialBunch.chSeq, newSeq: bunch.chSeq, chIndex: bunch.chIndex },
              'Unreliable partial trying to destroy reliable partial 1')
            return null
          }
        }
        this._inPartialBunches[bunch.chIndex] = bunch
        // logger.error({ inPartialSeq: curInPartialBunch.chSeq, newSeq: bunch.chSeq, chIndex: bunch.chIndex },
        //   'Incoming new partial initial destoried old inPartial')
        if (!bunch.options.bHasPackageMapExports && !bunch.uebuffer.ended()) {
          if (bunch.uebuffer.remainingBits % 8 !== 0) {
            logger.fatal(bunch, 'Got bad bunch')
          }
        }
      } else { // incoming bunch is not partialInitial, so handle it with existing inPartialBunch
        const curInPartialBunch = this._inPartialBunches[bunch.chIndex]
        if (curInPartialBunch) {
          const bReliableSeqMatches = bunch.chSeq == curInPartialBunch.chSeq + 1
          const bUnreliableSeqMatches = bReliableSeqMatches || bunch.chSeq == curInPartialBunch.chSeq
          const bSeqMatches = curInPartialBunch.options.bReliable
            ? bReliableSeqMatches
            : bUnreliableSeqMatches

          if (!curInPartialBunch.bPartialFinal && bSeqMatches && curInPartialBunch.options.bReliable == bunch.options.bReliable) {
            if (!bunch.options.bHasPackageMapExports && !bunch.uebuffer.ended()) {
              // Merge
              curInPartialBunch.uebuffer.append(bunch.uebuffer)
              curInPartialBunch.totalBits += bunch.totalBits
              curInPartialBunch.pIndexes.push(...bunch.pIndexes)
            }
            curInPartialBunch.chSeq = bunch.chSeq
            if (bunch.options.bPartialFinal) {
              //console.log('got inPartialFinal, ready to go')
              bunchToHandle = curInPartialBunch
              curInPartialBunch.options.bPartialFinal = true
              curInPartialBunch.options.bClose = bunch.options.bClose
              curInPartialBunch.options.bDormant = bunch.options.bDormant
              curInPartialBunch.options.bIsReplicationPaused = bunch.options.bIsReplicationPaused
              curInPartialBunch.options.bHasMustBeMappedGUIDs = bunch.options.bHasMustBeMappedGUIDs
            }
          } else {
            // Merge problem - delete InPartialBunch. This is mainly so that in the unlikely chance that ChSequence wraps around, we wont merge two completely separate partial bunches.
            if (curInPartialBunch.options.bReliable) {
              logger.error({ cur: curInPartialBunch, newBunch: bunch }, 'Unreliable partial trying to destroy reliable partial 2')
              return null
            }
            this._inPartialBunches[bunch.chIndex] = undefined
          }
        } // end of if (curInPartialBunch)
      }

      const curInPartialBunch = this._inPartialBunches[bunch.chIndex]
      if (curInPartialBunch != null && curInPartialBunch.uebuffer.remainingBits > CONSTS.MAX_CONSTRUCTED_PARTIAL_SIZE_IN_BYTES) {
        logger.error(curInPartialBunch, 'in Partial bunch too large')
        return null
      }
    } // end of bunch.options.bPartial === true
    if (bunchToHandle != null) {
      return this._receivedSequencedBunch(bunchToHandle)
    }
    return null
  },

   // return final event array, generated from bunch
  _receivedSequencedBunch (bunch) {
    if (bunch.options.bOpen) {
      logger.info({ chIndex: bunch.chIndex }, 'channel opened')
    }
    let finalEvts = null
    try {
      finalEvts = this._parseActorBunch(bunch)
    } catch (e) {
      if (e.name === 'BufferNotEnoughError') {
        logger.info({ pIndexes: bunch.pIndexes, chIndex: bunch.chIndex }, '_parseActorBunch got BufferNotEnoughError')
      } else {
        throw e
      }
    }

    if (bunch.options.bClose) {
      logger.info({ chIndex: bunch.chIndex }, 'channel closed')
      this._closeChannel(bunch.chIndex)
    }
    return finalEvts
  },

  // actor bunch might contain mappedGuids, and CMDs
  _parseActorBunch (bunch) {
    if (!bunch.isOutTraffic && bunch.options.bHasMustBeMappedGUIDs) {
      const numMustBeMappedGUIDs = bunch.uebuffer.readUInt16()
      for (let i = 0; i < numMustBeMappedGUIDs; i++) {
        bunch.uebuffer.readUEGuid()
      }
    }

    const finalEvts = []
    // for InBound traffic - ensure for this channel, actor is already created.
    if (!bunch.isOutTraffic && this._actors[bunch.chIndex] == null) {
      if (!bunch.options.bOpen) {
        return null
      }
      this._deserializeActor(bunch)
      if (this._actors[bunch.chIndex] == null) {
        return null
      } else {
        // EVT_HERE: ACTOROPEN
        // actor just created in _deserializeActor, let's see what happened
        if (this._actors[bunch.chIndex].T !== CONSTS.ACTOR_TYPES.OTHER) {
          // other can be Default__WeaponProcessor, what's this?
          finalEvts.push({ type: CONSTS.EventTypes.ACTOROPEN,
            guid: this._actors[bunch.chIndex].guid,
            data: { actor: Object.assign({}, this._actors[bunch.chIndex]) } })
        }
      }
    }
    // for OutBound traffic - get the actor from inBound traffic data
    if (bunch.isOutTraffic && this._actors[bunch.chIndex] == null) {
      this._actors[bunch.chIndex] = this._actors[bunch.chIndex - CONSTS.MAX_CHANNELS]
      if (this._actors[bunch.chIndex] == null) {
        return null
      }
    }

    // if we reach here, actor must be not null
    const actor = this._actors[bunch.chIndex]
    // if actor.T is OTHER, we dont need to process any further
    if (actor.T === CONSTS.ACTOR_TYPES.OTHER) {
      return null // by comparing before and after, this seems to be safe, maybe
    }
    if (actor.T === CONSTS.ACTOR_TYPES.DROPPED_ITEM && bunch.uebuffer.ended()) {
      // EVT: ITEMGONE
      finalEvts.push({ type: CONSTS.EventTypes.ITEMGONE, guid: actor.guid, data: { T: actor.T }})
      // droppedItemLocation.remove(droppedItemToItem[actor.netGUID] ?: return)
      // droppedItemToItem is set at droppedItem CMD 16, DI to I
    }
    // read bunch until end, a bunch might contain several chunks.
    let bunchChunk = 0
    while (!bunch.uebuffer.ended()) {
      bunchChunk++
      //console.log(' IN while bunch.uebuffer.ended() chIndex', bunch.chIndex, bunchChunk, bunch.uebuffer.remainingBits)
      const bHasRepLayout = bunch.uebuffer.readBit()
      const bIsActor = bunch.uebuffer.readBit()
      let repObj = ['', 0]
      if (bIsActor) {
        repObj = [actor.T, actor.guid]
      } else {
        // bIsActor = false
        [subGuid, subObj] = bunch.uebuffer.readObject()
        if (bunch.isOutTraffic) {
          if (subObj == null) {
            continue
          }
          repObj = subObj
        } else { // inBound traffic
          const bStablyNamed = bunch.uebuffer.readBit()
          if (bStablyNamed) {
            // If this is a stably named sub-object, we shouldn't need to create it
            if (subObj == null) {
              continue
            }
            repObj = subObj
          } else {
            [classGuid, classObj] = bunch.uebuffer.readObject()
            if (classObj != null &&
                (actor.T === CONSTS.ACTOR_TYPES.DROPPED_ITEM_GROUP ||
                actor.T === CONSTS.ACTOR_TYPES.DROPPED_ITEM)
              ) {
              const friendlyName = utils.classNameToFriendlyName(classObj[0])
              // EVT: ITEMDROP, if friendlyName[0] == '', means it is not an ITEM that we care
              if (friendlyName[0] !== '') {
                finalEvts.push({ type: CONSTS.EventTypes.ITEMDROP, guid: subGuid,
                  data: { item: friendlyName[0], location: actor.location.slice(), groupId: actor.guid, flags: friendlyName[1] } })
              }
            }
            if (classGuid === 0 || classObj == null) {
              continue
            }
            UEGUIDCache.registerUEGUIDClient(subGuid, classObj[0])
            repObj = UEGUIDCache.getObjectFromUEGuid(subGuid)
            if (repObj == null) {
              console.log('got null', subGuid, classGuid, classObj)
            }
          }
        }
      }

      //console.log(' before read numPayloadBits', bunch.chIndex, bunchChunk, bunch.uebuffer.remainingBits)
      const numPayloadBits = bunch.uebuffer.readIntPacked()
      //console.log('   Got numPayloadBits', numPayloadBits)
      if (numPayloadBits === 0) {
        continue // no data for this chunk, but we need to continue process further
      }
      if (numPayloadBits > bunch.uebuffer.remainingBits || numPayloadBits < 0) {
        // this can actually happen, we have to ignore this.
        logger.error(
          { bunchChunk, numPayloadBits, remaining: bunch.uebuffer.remainingBits, bunchInfo: bunch.toString(), actor, finalEvts },
          'got invalid numPayloadBits > remainingBits, or negative')
        break
      }
      if (bHasRepLayout && !bunch.isOutTraffic) {
        const repLayoutBuffer = bunch.uebuffer.copyOut(numPayloadBits)

        if (actor.T === CONSTS.ACTOR_TYPES.DROPPED_ITEM_GROUP && repObj[0] === 'RootComponent') {
          repObj = ['DroppedItemGroupRootComponent', repObj[1]]
        }
        // 0 or 1 event, from the repLayout Data
        const repLayoutEvent = repLayoutProcessor.process(repLayoutBuffer, repObj, actor)
        if (repLayoutEvent) {
          finalEvts.push(repLayoutEvent)
        }
      }
      if (bunch.isOutTraffic) {
        let outProcFunc = null
        if (repObj[0] === 'PLAYER') {
          outProcFunc = processCharMove
        } else if (repObj[0] === 'VehicleSyncComponent') {
          outProcFunc = processCarSync
        }
        if (outProcFunc) {
          const repLayoutBuffer = bunch.uebuffer.copyOut(numPayloadBits)
          repLayoutBuffer.pIndexes = bunch.pIndexes
          try {
            const outEvent = outProcFunc(repLayoutBuffer, actor)
            if (outEvent) {
              // outEvent.data.pIndexes = bunch.pIndexes for debugging
              finalEvts.push(outEvent)
            }
          } catch (e) {
            if (e.name === 'BufferNotEnoughError') {
              logger.info({ chunk: bunchChunk, actor }, 'Got not buffer enough error in CharMoveCmpProc')
            } else {
              throw e
            }
          }
        }
      }
      // anyway, we need to move forward
      bunch.uebuffer.skipBits(numPayloadBits)
    } // end of while (!bunch.uebuffer.ended())

    if (bunch.options.bClose && !bunch.isOutTraffic) {
      // EVT_HERE: ACTORCLOSE
      if (actor.T !== CONSTS.ACTOR_TYPES.OTHER) { // other can be Default__WeaponProcessor, etc
        finalEvts.push({ type: CONSTS.EventTypes.ACTORCLOSE, guid: actor.guid, data: { actor: Object.assign({}, actor) } })
      }
    }

    if (finalEvts.length > 0) {
      return finalEvts
    }
    return null
  },

  _deserializeActor (bunch) {
    [ueguid, newActor] = bunch.uebuffer.readObject()
    // console.log('yoyoyyo', ueguid, newActor, bunch)
    const bIsDynamic = ueguid > 0 && ((ueguid & 1) === 0) // Boolean = value > 0 && (value and 1) == 0
    if (bIsDynamic) {
      [archeTypeGuid, archeTypeObj] = bunch.uebuffer.readObject()
      if (archeTypeGuid > 0 && archeTypeObj == null) {
        const existing = UEGUIDCache.getSimple(archeTypeGuid)
        if (existing != null) {
          logger.debug({ path: existing[0], guid: archeTypeGuid}, 'Resolved Archetype GUID from cache.')
        } else {
          logger.debug({ guid: archeTypeGuid}, 'Unresolved Archetype GUID. Guid not registered!')
        }
      }
      const bHasLocationInfo = bunch.uebuffer.readBit()
      const location = bHasLocationInfo ? bunch.uebuffer.readVector() : undefined
      const bHasRotation = bunch.uebuffer.readBit()
      const rotation = bHasRotation ? bunch.uebuffer.readRotationShort() : undefined
      const bHasScale = bunch.uebuffer.readBit()
      const scale = bHasScale ? bunch.uebuffer.readVector() : undefined
      const bHasVelocity = bunch.uebuffer.readBit()
      const velocity = bHasVelocity ? bunch.uebuffer.readVector() : undefined

      if (this._actors[bunch.chIndex] == null && archeTypeObj != null) {
        let actorObj = { guid: ueguid, archeTypeGuid: archeTypeGuid,
          archetype: archeTypeObj[0] /*pathName*/,
          chInex: bunch.chIndex, T: utils.getActorType(archeTypeObj[0]) }
        if (bHasLocationInfo) {
          actorObj.location = [location[0], 8192 - location[1], location[2], 0]
          if (bHasRotation) {
            actorObj.location[3] = rotation[1]
          }
        }
        this._actors[bunch.chIndex] = actorObj
        UEGUIDCache.registerUEGUIDClient(ueguid, actorObj.archetype)
        logger.info(actorObj, 'Created a dynamic actor')
      }
    } else {
      if (newActor == null) {
        return
      }
      // static actor does not location, rotation, velocity
      this._actors[bunch.chIndex] = { guid: ueguid, archeTypeGuid: newActor[1] /*outerGuid*/,
        archetype: newActor[0] /*only care about pathName*/,
        chIndex: bunch.chIndex, isStatic: true, T: utils.getActorType(newActor[0]) }
      // got new static actor
      logger.debug(this._actors[bunch.chIndex], 'Created a static actor')
    }
  }
}

module.exports = bunchStash
