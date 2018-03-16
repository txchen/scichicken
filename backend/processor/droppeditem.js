const CONSTS = require('../constants')
const utils = require('../utils')

function processDroppedItem (buf, actor, repObj, waitingHandle, dataOut) {
  //console.log('processDroppedItem handle=', waitingHandle, actor.guid, buf.remainingBits)
  switch (waitingHandle) {
    case 1:
      buf.readBit()
      break
    case 2:
      buf.readBit()
      break
    case 3:
      buf.readObject() // attachParent
      break
    // 4 is for DroppedItemGroupRootComponent
    case 4:
      const arraySize = buf.readUInt16()
      let index = buf.readIntPacked()
      const children = []
      while (index !== 0) {
        [childguid, childobj] = buf.readObject()
        children.push(childguid)
        index = buf.readIntPacked()
      }
      dataOut.DIGChildren = children
      break
    case 5:
      buf.readName()
      break
    case 6:
      buf.readBit() // bReplicatesAttachmentReference
      break
    case 7:
      buf.readBit() // bReplicatesAttachment
      break
    case 8:
      buf.readBit() // bAbsoluteLocation
      break
    case 9:
      buf.readBit() // bAbsoluteRotation
      break
    case 10:
      buf.readBit() // bAbsoluteScale
      break
    case 11:
      buf.readBit() // bVisible
      break
    // 12 is for DroppedItemInteractionComponent
    case 12:
      dataOut.relativeLoc = buf.readFloatVector()
      break
    // 13 is for DroppedItemInteractionComponent
    case 13:
      buf.readRotationShort() // but we don't care
      break
    // 14 is for DroppedItemInteractionComponent
    case 14:
      buf.readFloatVector() // relativeScale3D, but we don't care
      break
    // 15 is for DroppedItemInteractionComponent
    case 15:
      [itemGuid, itemObj] = buf.readObject()
      // from the itemGuid, we can get itemLocation
      // repObj[1] is the outerGuid, which is guid of droppedItemInteraction
      // we can set the map of droppedItemInteractionGuid -> itemGuid, but is this map useful?
      dataOut.interactionGuid = repObj[1]
      dataOut.itemGuid = itemGuid
      break
    // 16 is for DroppedItem
    case 16:
      [itemGuid, itemObj] = buf.readObject()
      dataOut.DItoI = itemGuid
      break
    default:
      return false
  }
  return true
}

module.exports = processDroppedItem
