const CONSTS = require('./constants')
const decoders = require('cap').decoders
const UEBuffer = require('./uebuffer')
const logger = require('./logger')
const Bunch = require('./bunch')
const crypto = require('crypto');

const allsame = input => {
  return input === 255 || input === 0
}

const packetParserProto = {
  EncryptionToken: '',
  haveEncryptionToken: false,

  readRawBit (rawPacket, posBits) {
    const SHIFTS = [1, 2, 4, 8, 16, 32, 64, 128]
    const b = rawPacket[posBits >> 3] & SHIFTS[posBits & 0b0111] // x & 0111 means x % 8 -> 0..7
    return b != 0
  },

  // server 7000..7999 -> Game PC packet, UDP. Contains a set of bunches to a certain channel
  parseUEBunchPacket (rawPacket, payloadLength, pindex, isOutTraffic) {
    if (!payloadLength) {
      return
    }
    let buf = UEBuffer(rawPacket)
    buf.skipBits(42 * 8) // skip to udp payload
    // The end of packet might still have udp padding, so use payloadLength
    buf.remainingBits = payloadLength * 8
    buf._localRemainingBits = payloadLength * 8

    let IsHandshake = this.readRawBit(rawPacket, (42 * 8))
    if (IsHandshake) {
      return null
    }
    let IsEncrypted = this.readRawBit(rawPacket, (42 * 8) + 1)

    // adjust size, according to NetConnection.cpp:701
    let lastByte = buf.buffer[41 + payloadLength] & 0xFF
    if (lastByte > 0) {
      // NOTE: UE4 code is remainingBitss - 1, I changed to 2, maybe PUBG modified this
      let finalBitSize = (payloadLength * 8) - (IsEncrypted ? 1 : 2)
      while ((lastByte & 0x80) === 0) {
        lastByte = lastByte * 2
        finalBitSize--
      }
      buf.remainingBits = finalBitSize
      buf._localRemainingBits = finalBitSize
    } else {
      logger.fatal('Got 0 in last byte of udp payload, which looks wrong')
      return
    }

    IsHandshake = buf.readBit()
    IsEncrypted = buf.readBit()

    if (IsEncrypted && !this.haveEncryptionToken) {
      //logger.warn('Got encrypted packet but don\'t have EncryptionToken')
      return null
    } else if (IsEncrypted && this.haveEncryptionToken) {
      const nonce = new Buffer(buf.readBits(96))
      const tag = new Buffer(buf.readBits(128))
      const ciphertext = new Buffer(buf.readBits(buf.remainingBits))
      const cipher = crypto.createDecipheriv('aes-192-gcm', this.EncryptionToken, nonce);
      cipher.setAuthTag(tag)
      try {
        let decryptedRaw = cipher.update(ciphertext)
        decryptedRaw = Buffer.concat([decryptedRaw, cipher.final()]);
        lastByte = decryptedRaw[decryptedRaw.length - 1] & 0xFF
        if (lastByte > 0) {
          // NOTE: UE4 code is remainingBitss - 1, I changed to 2, maybe PUBG modified this
          finalBitSize = (decryptedRaw.length * 8) - 2
          while ((lastByte & 0x80) === 0) {
            lastByte = lastByte * 2
            finalBitSize--
          }
          buf = UEBuffer(decryptedRaw)
          buf.remainingBits = finalBitSize
          buf._localRemainingBits = finalBitSize
        } else {
          logger.fatal('Got 0 in last byte of udp payload, which looks wrong')
          return
        }
      } catch (ex) {
        logger.warn('Missed decrypting packet')
        return null
      }
    }

    // this is Unreal packet id, 15 bit
    const packetId = buf.readInt(CONSTS.MAX_PACKETID)
    const event = { type: CONSTS.EventTypes.UEBUNCHES, valid: true, uepid: packetId, totalBunchesBits: buf.remainingBits, data: [] }
    // in while loop, read multiple bunches
    while (!buf.ended()) {
      //console.log('buf remaining', buf.remainingBits, pindex, payloadLength)
      const isAck = buf.readBit()
      if (isAck) {
        const ackPacketId = buf.readInt(CONSTS.MAX_PACKETID)
        // this should not happen, since in js, no signed int
        if (ackPacketId == -1) {
          event.valid = false
          event.error = 'ackPacketId is -1'
          logger.fatal({ pindex }, 'Got -1 as ackPacketId.') // ??? DON't process further? I don't really know.
          return event
        }
        const bHasServerFrameTime = buf.readBit()
        const remoteInKBytesPerSecond = buf.readIntPacked()
        continue // ignore this chunk
      }
      const bControl = buf.readBit()
      let bOpen = false
      let bClose = false
      let bDormant = false
      if (bControl) {
        bOpen = buf.readBit()
        bClose = buf.readBit()
        if (bClose) {
          bDormant = buf.readBit()
        }
      }
      const bIsReplicationPaused = buf.readBit()
      const bReliable = buf.readBit()
      let chIndex = buf.readInt(CONSTS.MAX_CHANNELS) // 14 bit
      buf.readBit() // after Mar 12nd
      if (isOutTraffic) {
        chIndex += CONSTS.MAX_CHANNELS // for out channel, just + 10240
      }
      const bHasPackageMapExports = buf.readBit()
      const bHasMustBeMappedGUIDs = buf.readBit()
      const bPartial = buf.readBit()
      let chSeq = 0
      if (bReliable) {
        chSeq = buf.readInt(CONSTS.MAX_CHSEQUENCE) // 10 bit
      } else if (bPartial) {
        chSeq = packetId
      }
      let bPartialInitial = false
      let bPartialFinal = false
      if (bPartial) {
        bPartialInitial = buf.readBit()
        bPartialFinal = buf.readBit()
      }
      const chType = bReliable || bOpen
        ? buf.readInt(CONSTS.CHTYPE_MAX)
        : CONSTS.CHTYPE_NONE // when it is not Open or reliable, type = none

      const bunchDataBits = buf.readInt(CONSTS.MAX_BUNCH_DATA_BITS)
      let preLeft = buf.remainingBits
      if (bunchDataBits > preLeft) {
        // this might be caused by non-pubg udp packet
        event.valid = false
        event.error = `bunchDataBits:${bunchDataBits} > preLeft:${preLeft}`
        logger.fatal({ pindex, bunchDataBits, preLeft }, 'bunchDataBits > preLeft') // cannot continue with corrupted data
        return event
      }
      // END OF getting bunch header, now get bunch data
      if (chType > 4) {
        logger.fatal({ pindex, chType }, 'Got unknown channel type')
        return null
      }
      // ignore file and voice and unknown channel type
      if (chType === CONSTS.CHTYPE_FILE || chType === CONSTS.CHTYPE_VOICE) {
        buf.skipBits(bunchDataBits)
        continue
      }
      // assume -> control channel always got channel index = 0
      if (chType === CONSTS.CHTYPE_CONTROL) {
        //if (isOutTraffic) {
        //  // for outTraffic, we dont care control channel
        //  buf.skipBits(bunchDataBits)
        //  continue
        //}
        if (chIndex !== 0 && !isOutTraffic) {
          logger.fatal({ chIndex, pindex }, 'Found non-zero Index CONTROL CHANNEL, not good!')
          buf.skipBits(bunchDataBits)
          continue
        }
      }
      
      // if we are here, we can assume the bunch is valid, bunch can be partial
      //   since bunch might be stashed for a while, we need to copy bits from the current Buffer
      event.data.push(Bunch(bunchDataBits,
        buf.copyOut(bunchDataBits), packetId, chIndex, chType, chSeq, pindex, isOutTraffic, {
        bOpen, bClose, bDormant, bIsReplicationPaused, bReliable, bPartial, bPartialInitial, bPartialFinal, bHasPackageMapExports, bHasMustBeMappedGUIDs }))
      buf.skipBits(bunchDataBits)
    } // end of while (!buf.ended())
    //console.log('buf out of while', buf.remainingBits, pindex, payloadLength)
    return event
  },

  // rawPacket is buffer of entire packet, including ether header, ip header, tcp/udp header and payload
  parse (rawPacket, time, pindex /* the pcap id or realtime id */) {
    const ipv4Info = decoders.IPV4(
      rawPacket,
      14 /* ether header length offset */
    )
    let result = null
    if (ipv4Info.info.protocol === decoders.PROTOCOL.IP.UDP) {
      const udpInfo = decoders.UDP(rawPacket, ipv4Info.offset)
      if (udpInfo.info.srcport >= 7000 && udpInfo.info.srcport <= 7999) {
        // the actor bunch packets, sent by channels
        result = this.parseUEBunchPacket(rawPacket, udpInfo.info.length, pindex, false)
      } else if (udpInfo.info.dstport >= 7000 && udpInfo.info.dstport <= 7999) {
        result = this.parseUEBunchPacket(rawPacket, udpInfo.info.length, pindex, true)
      }
    }
    if (result) {
      result.time = time
    }
    return result
  },
  
  setEncryptionToken (EncryptionToken) {
    if (!this.haveEncryptionToken) {
      this.EncryptionToken = EncryptionToken
      this.haveEncryptionToken = true
    }
  },
  
  clearEncryptionToken () {
    this.haveEncryptionToken = false
    this.EncryptionToken = ''
  }
}

const packetParser = () => {
  const self = Object.create(packetParserProto)
  return self
}

module.exports = packetParser
