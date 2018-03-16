const TYPES = require('./constants').EventTypes
const ACTOR_TYPES = require('./constants').ACTOR_TYPES
const bunchStash = require('./bunchstash')
const logger = require('./logger')
const UEGUIDCache = require('./ueguidcache')
const utils = require('./utils')

const PLAYBACK_TICK = 100 // 100ms

// make this a singleton instance
const gameState = {
  playbackState: null, // can be 'Paused' 'Playing'
  playbackEvents: null,
  playbackIndex: 0,
  playbackDoneMs: 0, // in playback timeline, how many time has been processed
  playbackStartTS: 0,
  playbackSpeed: 1.0,
  playbackRemaining: -1, // count for event
  playbackMagic: 0, // use to make the gsTime different
  totalProcessedEvents: 0,

  stateTime: 0,
  gsTime: 0, // gameStartTime

  me: [-1, -1, 0, -360], // x, y, z, yaw
  meGuid: -1,
  meAttachedTo: -1,
  safe: [-1, -1, 0], // x, y, radius
  poison: [-1, -1, 0], // x, y, radius
  players: [], // store the player objects
  playerMap: new Map(), // guid -> player object
  playerNameMap: new Map(), // playerName -> playerObject
  playerStateToPlayerMap: new Map(), // playerStateGuid -> playerGuid
  playerStateMap: new Map(), // playerStateGuid -> playerStateObj
  showingPlayers: new Map(), // guid -> player object

  apawns: [], // store the apawn objects { T: ACTOR_TYPE, ... }
  apawnsMap: new Map(), // guid -> apawn objects
  showingAPawns: new Map(), // guid -> apawn objects

  itemMap: new Map(), // itemGuid -> obj { loc: name: FT(filterType) }
  DItoIMap: new Map(), // droppedItemGuid -> itemGuid
  DIGChildrenMap: new Map(), // droppedItemGroupGuid -> [...ItemInteractionGuid]
  IItoIMap: new Map(), // itemInteractionId -> itemGuid

  teamMembers: new Set(), // store my team member names

  isDesert: false,

  getGameState (noBox, noCar, noAirdrop, itemFlags) {
    const result = {
      sTime: this.stateTime,
      gsTime: this.gsTime,
      me: this.me,
      meAttachedTo: this.meAttachedTo,
      safe: this.safe,
      poison: this.poison,
      desert: this.isDesert,
      displayPlayers: [...this.showingPlayers.entries()],
      displayAPawns: [...this.showingAPawns.entries()]
    }
    if (noBox) {
      result.displayAPawns = result.displayAPawns.filter(pair => pair[1].T !== ACTOR_TYPES.BOX)
    }
    if (noCar) {
      result.displayAPawns = result.displayAPawns.filter(pair => pair[1].T !== ACTOR_TYPES.CAR)
    }
    if (noAirdrop) {
      result.displayAPawns = result.displayAPawns.filter(pair => pair[1].T !== ACTOR_TYPES.AIRDROP)
    }
    result.displayItems = []
    if (itemFlags) {
      for (const pair of this.itemMap.entries()) {
        if ((pair[1].flags & itemFlags) > 0) {
          result.displayItems.push(pair)
        }
      }
    }
    if (this.meGuid > 0) {
      result.meGuid = this.meGuid
    }
    if (this.playbackState) {
      result.playbackState = this.playbackState
      result.playbackIndex = this.playbackIndex
      result.playbackDoneMs = this.playbackDoneMs
      result.playbackStartTS = this.playbackStartTS
      result.playbackSpeed = this.playbackSpeed
      result.totalProcessedEvents = this.totalProcessedEvents
    }
    return result
  },

  // for debug purpose
  dump () {
    const result = {
      sTime: this.stateTime,
      gsTime: this.gsTime,
      me: this.me,
      meGuid: this.meGuid,
      meAttachedTo: this.meAttachedTo,
      safe: this.safe,
      poison: this.poison,
      desert: this.isDesert,
      players: this.players,
      displayPlayers: [...this.showingPlayers.entries()],
      displayAPawns: [...this.showingAPawns.entries()],

      teamMembers: [...this.teamMembers.entries()],
      playerStateToPlayerMap: [...this.playerStateToPlayerMap.entries()],
      playerStateMap: [...this.playerStateMap.entries()],
      playerNameMap: [...this.playerNameMap.entries()],
      playerMap: [...this.playerMap.entries()],
      apawnsMap: [...this.apawnsMap.entries()],
      itemMap: [...this.itemMap.entries()],
      DItoIMap: [...this.DItoIMap.entries()],
      DIGChildrenMap: [...this.DIGChildrenMap.entries()],
      IItoIMap: [...this.IItoIMap.entries()],

      UEGUIDCacheCount: UEGUIDCache.getCachedCount(),
    }
    return result
  },

  resetGameState () {
    logger.warn('In GameState resetGameState()')
    this.me = [-1, -1, 0, -360]
    this.meGuid = -100
    this.meAttachedTo = -1000
    this.safe = [-1, -1, 0]
    this.poison = [-1, -1, 0]
    this.teamMembers.clear()

    this.stateTime = 0
    this.gsTime = 0
    this.players = []
    this.playerMap.clear()
    this.playerNameMap.clear()
    this.playerStateToPlayerMap.clear()
    this.playerStateMap.clear()
    this.showingPlayers.clear()

    this.apawns = []
    this.apawnsMap.clear()
    this.showingAPawns.clear()

    this.itemMap.clear()
    this.DItoIMap.clear()
    this.DIGChildrenMap.clear()
    this.IItoIMap.clear()

    // and reset the guid cache
    UEGUIDCache.reset()
    // also reset the stash, removing the state of temp bunches
    bunchStash.reset()
  },

  setPlaybackMode (events) {
    if (events == null || events.length === 0) {
      throw new Error('Empty events, cannot playback.')
    }
    this.playbackState = 'Paused'
    this.playbackEvents = events
    this.playbackIndex = 0
    this.playbackDoneMs = 0
    this.playbackStartTS = events[0].time
    logger.warn({ eventCount: events.length }, 'Playback events feeded')
  },

  startPlayback (speed = 1.0, eventCount) {
    if (this.playbackEvents == null || this.playbackEvents.length === 0) {
      throw new Error('not ready for playback.')
    }
    this.playbackState = 'Playing'
    this.playbackSpeed = speed
    const interval = PLAYBACK_TICK / speed
    if (eventCount) {
      this.playbackRemaining = eventCount
    }
    logger.warn({ interval, speed, toPlayCount: eventCount }, 'Started playback')
    this._playbackChunk(interval)
  },

  _playbackChunk (interval) {
    if (this.playbackState === 'Playing') {
      this.playbackDoneMs += PLAYBACK_TICK
      // good to go, until enough events has been processed
      while (this.playbackIndex < this.playbackEvents.length) {
        const event = this.playbackEvents[this.playbackIndex]
        if (event.time - this.playbackStartTS > this.playbackDoneMs) {
          break // cannot process more now, wait some time
        }
        this.processPUBGEvent(event)
        this.playbackIndex++
        if (this.playbackRemaining > 0) {
          this.playbackRemaining--
          if (this.playbackRemaining === 0) {
            logger.warn({ evt: this.playbackEvents[this.playbackIndex - 1] }, 'Playback Paused2')
            this.pausePlayback()
            return
          }
        }
      }
      if (this.playbackIndex < this.playbackEvents.length) {
        setTimeout(() => {
          this._playbackChunk(interval)
        }, interval)
      } else {
        this.stopPlayback()
      }
    }
  },

  pausePlayback () {
    this.playbackState = 'Paused'
    this.playbackRemaining = -1
    logger.warn({ currentIndex: this.playbackIndex }, 'Playback Paused')
  },

  // stop playback, return to the beginning
  stopPlayback () {
    this.playbackIndex = 0
    this.playbackDoneMs = 0
    this.totalProcessedEvents = 0
    this.playbackRemaining = -1
    this.playbackMagic++
    //this.resetGameState()
    this.playbackState = 'Paused'
    logger.warn('Playback Stopped')
  },

  // find the playerState
  _updatePlayerObjectData (playerObj, playerStateObj, playerGuid) {
    if (playerStateObj.numKills) {
      playerObj.kills = playerStateObj.numKills
    }
    if (playerStateObj.ranking) {
      playerObj.ranking = playerStateObj.ranking
      if (!playerObj.dead) { // make it dead
        playerObj.dead = true
        logger.info({ guid: playerGuid, obj: playerObj }, 'Player is dead')
        this.showingPlayers.delete(playerGuid)
      }
    }
    if (playerStateObj.teamNumber) {
      playerObj.team = playerStateObj.teamNumber
    }
    if (playerStateObj.playerName) {
      playerObj.name = playerStateObj.playerName
      this.playerNameMap.set(playerStateObj.playerName, playerObj)
      if (this.teamMembers.has(playerObj.name) && !playerObj.friend) {
        playerObj.friend = true
        logger.warn({ playerName: playerObj.name }, 'Player is friend because of his name')
      }
    }
  },

  processPUBGEvent (event) {
    if (!event) {
      return
    }
    switch (event.type) {
      case TYPES.SELFLOCEX:
        if (event.data.loc) {
          this.me[0] = event.data.loc[0]
          this.me[1] = 8192 - event.data.loc[1]
          this.me[2] = event.data.loc[2]
        }
        if (event.data.rotation) {
          this.me[3] = event.data.rotation
        }
        this.meGuid = event.guid
        break
      case TYPES.GAMESTART:
        this.resetGameState()
        this.gsTime = this.sTime = (event.time + this.playbackMagic)
        this.isDesert = !!event.data.isMiramar
        logger.warn({ desert: this.isDesert, gsTime: event.time }, 'Game started')
        break
      case TYPES.GAMESTOP:
        logger.warn({ gsTime: this.gsTime }, 'Game stopped!!!!') // do we really get this event?
        break
      case TYPES.GAMESTATEUPDATE:
        if (event.data.safezone) {
          this.safe[0] = event.data.safezone[0] / 100
          this.safe[1] = 8192 - event.data.safezone[1] / 100
        }
        if (event.data.safezoneRadius) {
          this.safe[2] = event.data.safezoneRadius / 100
        }
        if (event.data.poison) {
          this.poison[0] = event.data.poison[0] / 100
          this.poison[1] = 8192 - event.data.poison[1] / 100
        }
        if (event.data.poisonRadius) {
          this.poison[2] = event.data.poisonRadius / 100
        }
        break
      case TYPES.ACTOROPEN:
        this.processActorOpen(event)
        break
      case TYPES.ACTORCLOSE:
        this.processActorClose(event)
        break
      case TYPES.PLAYERUPDATE:
        if (event.data.attachedTo != null && event.guid === this.meGuid) {
          this.meAttachedTo = event.data.attachedTo
        }
        // example: [03-02T20:51:22.322 - Symbol(PlayerUpdate) - guid:368 -- {"newLoc":[850.21,676.1535999999996,51.0422,225.2197265625],"pToPS":362}
        // find the existing player first
        const player = this.playerMap.get(event.guid)
        if (player) {
          if (event.data.disappear) {
            // otherwise, will have stale displaying players
            this.showingPlayers.delete(event.guid)
          }
          if (event.data.newLoc && event.data.newLoc[0] >= 0 && event.data.newLoc[1] >= 0) {
            player.loc = event.data.newLoc
            this.showingPlayers.set(event.guid, player)
          }
          if (event.data.health) {
            player.health = event.data.health
          }
          if (event.data.pToPS) {
            this.playerStateToPlayerMap.set(event.data.pToPS, event.guid)
            // maybe PS already exists, so sync the data
            const playerStateObj = this.playerStateMap.get(event.data.pToPS)
            if (playerStateObj) {
              this._updatePlayerObjectData(player, playerStateObj, event.guid)
            }
          }
          // handle the get on/off car issue, might not be 100% precise
          if (event.data.attachedTo) { // maybe the player get on a car
            const theAPawn = this.apawnsMap.get(event.data.attachedTo)
            if (theAPawn && theAPawn.T === ACTOR_TYPES.CAR) {
              theAPawn.driverCount = theAPawn.driverCount ? theAPawn.driverCount + 1 : 1
              player.inCar = event.data.attachedTo
            }
          } else if (event.data.attachedTo === 0) { // maybe player get off a car
            if (player.inCar) { // try to clear the driver info of the car
              const theAPawn = this.apawnsMap.get(player.inCar)
              if (theAPawn && theAPawn.T === ACTOR_TYPES.CAR) {
                theAPawn.driverCount = theAPawn.driverCount ? theAPawn.driverCount - 1 : 0
              }
              player.inCar = undefined
            }
          }
        }
        break
      case TYPES.PLAYERSTATEUPDATE:
        // example: [03-02T20:54:04.683 - Symbol(PlayerStateUpdate) - guid:362 -- {"numKills":1}
        // example: [03-02T20:51:49.548 - Symbol(PlayerStateUpdate) - guid:3752 -- {"playerName":"zacang\u0000","teamNumber":32}
        let playerStateObj = this.playerStateMap.get(event.guid)
        if (!playerStateObj) { // no? create the playerStateMap
          playerStateObj = Object.assign({}, event.data) // copy out data
          this.playerStateMap.set(event.guid, playerStateObj)
        } else {
          Object.assign(playerStateObj, event.data)
        }
        // find the corresponding playerObj
        const playerGuid = this.playerStateToPlayerMap.get(event.guid)
        if (playerGuid) {
          const playerObj = this.playerMap.get(playerGuid)
          if (!playerObj) {
            break
          }
          // Now let's update the playerObject
          this._updatePlayerObjectData(playerObj, playerStateObj, playerGuid)
          // special handling for self
          if (event.data.selfGuid) {
            // console.log('Got self guid', event.data.selfGuid, playerGuid)
            this.meGuid = playerGuid
            this.showingPlayers.delete(playerGuid)
          }
        }
        break
      case TYPES.APAWNUPDATE:
        // this can be parachute, car, boat, AIRDROP
        // examples: [03-02T20:47:05.995 - Symbol(APawnUpdate) - guid:4234 -- //..{"apawnOwner":1694} --- (11695)
        // examples: [03-02T20:47:06.114 - Symbol(APawnUpdate) - guid:4234 -- {"newLoc":[1493.5509,3994.3576000000003,1499.088,0]} --- (11713)
      case TYPES.CARSYNC:
        // this is new protocol, when self driving the car
        // sent out by car object
        if (this.meAttachedTo === event.guid && event.data.newLoc) { // this apawn can be car or parachute
          this.me[0] = event.data.newLoc[0]
          this.me[1] = event.data.newLoc[1]
          this.me[2] = event.data.newLoc[2]
          this.me[3] = -360 // so that map will not render aim line
        }
        const apawnObj = this.apawnsMap.get(event.guid)
        if (apawnObj) {
          // for box and airdrop, as they cannot move, don't process
          if (apawnObj.T === ACTOR_TYPES.BOX || apawnObj.T === ACTOR_TYPES.AIRDROP) {
            return
          }
          if (event.data.disappear) {
            // otherwise, will have stale displaying apawns
            this.showingAPawns.delete(event.guid)
          }
          if (event.data.newLoc && event.data.newLoc[0] >= 0 && event.data.newLoc[1] >= 0) {
            apawnObj.loc = event.data.newLoc
            if (event.data.rotation != null) {
              apawnObj.loc[3] = event.data.rotation
            }
            this.showingAPawns.set(event.guid, apawnObj)
          }
          if (event.data.apawnOwner) {
            apawnObj.owner = event.data.apawnOwner
          }
        }
        break
      case TYPES.TEAMUPDATE:
        if (event.data.playerName) {
          this.teamMembers.add(event.data.playerName)
          logger.warn({ playerName: event.data.playerName }, 'GotTeam member playerName')
          // try to find the playerObj, set isTeam to true
          for (const p of this.players) {
            if (p.name === event.data.playerName) {
              p.friend = true
              logger.warn({ obj: p }, 'SetA player to friend')
            }
          }
        }
        break
      // the following 3 types of event is for item
      case TYPES.ITEMDROP:
        // exapmle: Symbol(ItemDrop) - guid:61832 -- {"item":"scar","location":[7058.491,4702.171,74.593,0],"groupId":61830}
        // the groupId can be DroppedItem or DroppedItemGroup
        this.itemMap.set(event.guid,
          { name: event.data.item,
            loc: event.data.location,
            flags: event.data.flags })
        break
      case TYPES.ITEMGONE:
        // itemGone only sent by DroppedItem, seems it is 1-1 mapping to item
        // try to find the itemGuid in DItoI
        const itemGuid = this.DItoIMap.get(event.guid)
        if (itemGuid) {
          this.itemMap.delete(itemGuid)
        }
        break
      case TYPES.DROPPEDITEMUPDATE: // this can be generated by DroppedItem and DroppedItemGroup
        // example: Symbol(DroppedItemUpdate) - guid:61830 -- {"DItoI":61832}
        // example: Symbol(DroppedItemUpdate) - guid:54046 -- {"relativeLoc":[-51.4375,650.53125,170.30810546875],"interactionGuid":54060,"itemGuid":54072}
        // example: Symbol(DroppedItemUpdate) - guid:54046 -- {"DIGChildren":[54052,54054,54056,54058,54060]}
        if (event.data.DItoI) { // sent by DroppedItem
          this.DItoIMap.set(event.guid, event.data.DItoI)
        }
        if (event.data.interactionGuid && event.data.itemGuid) {
          this.IItoIMap.set(event.data.interactionGuid, event.data.itemGuid)
        }
        if (event.data.relativeLoc && event.data.itemGuid) {
          const itemObj = this.itemMap.get(event.data.itemGuid)
          if (itemObj) {
            itemObj.loc[0] = itemObj.loc[0] + (event.data.relativeLoc[0] / 100)
            itemObj.loc[1] = itemObj.loc[1] - (event.data.relativeLoc[1] / 100)
          }
        }
        if (event.data.DIGChildren) {
          const currentChildren = this.DIGChildrenMap.get(event.guid)
          if (currentChildren) {
            // now let's compare
            const toRemoveList = currentChildren.reduce((r, a) => !event.data.DIGChildren.includes(a) && r.concat(a) || r, [])
            for (const toRemove of toRemoveList) {
              // toRemove is itemInteractionGuid
              const itemGuid = this.IItoIMap.get(toRemove)
              if (itemGuid) {
                this.itemMap.delete(itemGuid)
              }
            }
          }
          // now anyway, set to the latest state
          this.DIGChildrenMap.set(event.guid, event.data.DIGChildren)
        }
        break
      default:
        break
    }
    this.totalProcessedEvents++
    if (event.time) {
      this.stateTime = event.time
    }
  },

  processActorOpen (event) {
    const actor = event.data.actor
    switch (actor.T) {
      case ACTOR_TYPES.PLAYER:
        let playerObj = this.playerMap.get(actor.guid)
        if (!playerObj) {
          playerObj = {
            loc: actor.location || [-1, -1, 0, 0],
            guid: actor.guid
          }
          // this is the only place to create playerObj
          this.players.push(playerObj)
          this.playerMap.set(actor.guid, playerObj)
        } else {
          playerObj.loc = actor.location || [-1, -1, 0, 0]
        }
        this.showingPlayers.set(actor.guid, playerObj)
        break
      case ACTOR_TYPES.PLAYER_STATE:
        // when playerState open, actually nothing to care about
        break
      case ACTOR_TYPES.PARACHUTE:
      case ACTOR_TYPES.CAR:
      case ACTOR_TYPES.BOX:
      case ACTOR_TYPES.AIRDROP:
        // a new apawn appear
        let apawnObj = this.apawnsMap.get(actor.guid)
        if (!apawnObj) {
          // this is the only place to create apawnObj
          apawnObj = {
            loc: actor.location || [-1, -1, 0, 0],
            guid: actor.guid,
            T: actor.T
          }
          // calculate the minute, might be helpful for box or airdrop
          const openTime = event.time - this.gsTime
          if (openTime > 0 && openTime < 2400000) { // valid range, 0 - 40 min
            apawnObj.MINUTE = Math.ceil(openTime / 60000)
          }
          this.apawns.push(apawnObj)
          this.apawnsMap.set(actor.guid, apawnObj)
        } else {
          apawnObj.loc = actor.location || [-1, -1, 0, 0]
        }
        if (actor.T === ACTOR_TYPES.BOX || actor.T === ACTOR_TYPES.AIRDROP) {
          apawnObj.loc[3] = 270 // we don't care rotation of these
        }
        this.showingAPawns.set(actor.guid, apawnObj)
        break
      default:
        break
    }
  },

  processActorClose (event) {
    const actor = event.data.actor
    switch (actor.T) {
      case ACTOR_TYPES.PLAYER:
        let playerObj = this.playerMap.get(actor.guid)
        if (playerObj) {
          // if channel close, then we don't display.
          this.showingPlayers.delete(actor.guid)
        }
        break
      case ACTOR_TYPES.PLAYER_STATE:
        // when playerState close, actually nothing to care about
        break
      case ACTOR_TYPES.PARACHUTE:
      case ACTOR_TYPES.CAR:
        let apawnObj = this.apawnsMap.get(actor.guid)
        if (apawnObj) {
          // if channel close, then we don't display.
          this.showingAPawns.delete(actor.guid)
          // actor closed, let's clear the driver
          // this might have problem, if car go far away and go back.
          apawnObj.driverCount = undefined
        }
        break
      case ACTOR_TYPES.BOX:
      case ACTOR_TYPES.AIRDROP:
        // box and airdrop cannot go away, so no logic here
        break
      default:
        break
    }
  },
}

module.exports = gameState
