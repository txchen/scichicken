const CONSTS = require('./constants')
const ACTOR_TYPES = CONSTS.ACTOR_TYPES
const EVENT_TYPES = CONSTS.EventTypes
const logger = require('./logger')
const utils = require('./utils')
const apawnFunc = require('./processor/apawn')
const gameFunc = require('./processor/game')
const playerFunc = require('./processor/player')
const playerStateFunc = require('./processor/playerstate')
const teamFunc = require('./processor/team')
const droppedItemFunc = require('./processor/droppeditem')

const repLayoutProcessor = {
  process (repLayoutBuffer, repObj, actor) {
    let procFunc = null
    let evtType = null
    switch (repObj[0]) {
      case ACTOR_TYPES.PLAYER:
        procFunc = playerFunc
        evtType = EVENT_TYPES.PLAYERUPDATE
        break
      case ACTOR_TYPES.GAME_STATE:
        procFunc = gameFunc
        evtType = EVENT_TYPES.GAMESTATEUPDATE
        break
      case ACTOR_TYPES.PLAYER_STATE:
        procFunc = playerStateFunc
        evtType = EVENT_TYPES.PLAYERSTATEUPDATE
        break
      case ACTOR_TYPES.TEAM:
        procFunc = teamFunc
        evtType = EVENT_TYPES.TEAMUPDATE
        break
      case ACTOR_TYPES.CAR:
      case ACTOR_TYPES.PARACHUTE:
      case ACTOR_TYPES.PLANE:
      case ACTOR_TYPES.DROPPED_ITEM_GROUP: // do we really need this? maybe just to get the location?
      //case ACTOR_TYPES.AIRDROP: // I think airdrop will not move, so don't care, loc update
      //case ACTOR_TYPES.BOX: // I think box will not move, so don't care loc update
      //case ACTOR_TYPES.THROW: // I don't care
        // basically will get newLocation, owner or attachedTo
        procFunc = apawnFunc
        evtType = EVENT_TYPES.APAWNUPDATE
        break
      // all these 3 types use a single cmd processor, this is complex
      case ACTOR_TYPES.DROPPED_ITEM:
      case 'DroppedItemInteractionComponent':
      case 'DroppedItemGroupRootComponent':
        procFunc = droppedItemFunc
        evtType = EVENT_TYPES.DROPPEDITEMUPDATE
        break
      case ACTOR_TYPES.OTHER: // type that we don't understand
      default:
        break
    }
    if (procFunc == null) {
      return
    }
    // console.log('repLayout proc started', evtType, repLayoutBuffer.remainingBits)
    const bDoChecksum = repLayoutBuffer.readBit()
    let waitingHandle = 0
    const dataOut = {}
    let i = 0
    try {
      do {
        i++
        waitingHandle = repLayoutBuffer.readIntPacked()
      } while (waitingHandle > 0 &&
        procFunc(repLayoutBuffer, actor, repObj, waitingHandle, dataOut, i) &&
        !repLayoutBuffer.ended())
      // console.log('repLayout do while ended', evtType, repLayoutBuffer.remainingBits, i)
    } catch (e) {
      if (e.name === 'BufferNotEnoughError') {
        logger.info(
          { chunk: i, actor },
          'Got not buffer enough error in repLayoutProcessor'
        )
      } else {
        throw e
      }
    }

    if (Object.keys(dataOut).length > 0) {
      // EVT_HERE: all kinds of update event from repLayout data
      return { type: evtType, guid: actor.guid, data: dataOut }
    }
  }
}

module.exports = repLayoutProcessor
