const UEGUIDCache = require('./ueguidcache')
const logger = require('./logger')
const utils = require('./utils')
const CONSTS = require('./constants')
// the unreal engine bit buffer implementation

const SHIFTS = [
  1, 2, 4, 8, 16, 32, 64, 128
]

const ShortRotationScale = 360.0 / 65536.0

const ByteRotationScale = 360.0 / 256.0

const ueBufferProto = {
  // copy from underlying buffer to get a new uebuffer, cannot handle linked buffer case
  copyOut (bitsCount) {
    if (bitsCount > this.remainingBits) {
      throw new Error('Not enough data to copy out')
    }
    const currentByteIndex = this.posBits >> 3
    const endByteIndex = (this.posBits + bitsCount) >> 3
    const newBuffer = Buffer.alloc(endByteIndex - currentByteIndex + 1)
    this.buffer.copy(newBuffer, 0, currentByteIndex, endByteIndex + 1)
    const newUEBuffer = ueBuffer(newBuffer)
    newUEBuffer.skipBits(this.posBits % 8)
    newUEBuffer.remainingBits = bitsCount
    newUEBuffer._localRemainingBits = bitsCount
    return newUEBuffer
  },
  // connect two buffers, just like linked list
  append (nextBuf) {
    this.lastBuffer.nextBuffer = nextBuf
    this.lastBuffer = nextBuf
    this.remainingBits += nextBuf.remainingBits
  },
  ended () {
    return this.remainingBits <= 0
  },
  remainingBytes () {
    return (this.remainingBits + 7) >> 3
  },
  _readLocalBit () {
    const b = this.buffer[this.posBits >> 3] & SHIFTS[this.posBits & 0b0111] // x & 0111 means x % 8 -> 0..7
    this.posBits++
    this._localRemainingBits--
    return b != 0
  },
  _moveToNextBuffer () {
    const nextBuf = this.curBuffer.nextBuffer
    if (nextBuf != null) {
      this.curBuffer = nextBuf
      this.buffer = nextBuf.buffer
      this.nextBuffer = nextBuf.nextBuffer
      this.posBits = nextBuf.posBits
      this._localRemainingBits = nextBuf._localRemainingBits
    }
  },
  // return true of false
  readBit () {
    if (this.remainingBits <= 0) {
      //throw new Error('UEBuffer is at end, cannot read more')
      throw new utils.BufferNotEnoughError('UEBuffer is at end, cannot read more')
    }
    if (this._localRemainingBits == 0) { // we need next buffer to come in
      this._moveToNextBuffer()
    }
    this.remainingBits--
    return this._readLocalBit()
  },
  readByte () {
    let ret = 0
    for (let i = 0; i < 8; i++) {
      if (this.readBit()) {
        ret = ret | SHIFTS[i & 0b0111]
      }
    }
    return ret
  },
  // returns byte array
  readBytes (sizeBytes) {
    let ret = []
    for (let i = 0; i < sizeBytes; i++) {
      ret.push(this.readByte())
    }
    return ret
  },
  // returns byte array
  readBits (sizeBits = 8) {
    let ret = new Array((sizeBits + 7) >> 3)
    ret.fill(0)
    for (let i = 0; i < sizeBits; i++) {
      if (this.readBit()) {
        const b = i >> 3
        ret[b] = ret[b] | SHIFTS[i & 0b0111]
      }
    }
    return ret
  },
  // MAX_PACKETID = 16384
  readInt(maxValue = 16384) {
    let mask = 1
    let ret = 0
    while (ret + mask < maxValue) {
      if (this.readBit()) {
        ret = ret + mask
      }
      mask = mask << 1
    }
    return ret
  },
  readIntPacked () {
    let ret = 0
    let count = 0
    let more = 1
    while (more > 0) {
      let nextByte = this.readByte()
      more = nextByte & 1
      nextByte = nextByte >> 1
      ret += (nextByte << (7 * count++)) // 8 << 28 = -2147483648, in KT, same
    }
    // so, ret can actually be negative
    return ret
  },
  readInt8 () {
    // return readByte().toByte().toInt()  will this have negative?
    return this.readByte()
  },
  readUInt8 () {
    return this.readByte()
  },
  readInt16 () {
    // ?????
  },
  readUInt32 () {
    let ret = this.readByte()
    ret |= (this.readByte() << 8)
    ret |= (this.readByte() << 16)
    ret |= (this.readByte() << 24)
    return ret
  },
  readString () {
    let saveNum = this.readUInt32()
    const loadUCS2Char = saveNum > 2147483647 // means int32 is negative
    if (loadUCS2Char) {
      saveNum = 4294967296 - saveNum
    }
    if (saveNum > 1024) {
      throw new utils.BufferNotEnoughError(`Too big saveNum: ${saveNum}`)
    }
    if (saveNum === 0) {
      return ''
    }
    if (loadUCS2Char) {
      return new Buffer(this.readBytes(saveNum + 2)).toString('utf-16').replace('\u0000', '')
    } else {
      let bytes = this.readBytes(saveNum)
      return new Buffer(bytes).toString('utf-8').replace('\u0000', '')
    }
  },
  readName () {
    const bHardcoded = this.readBit()
    if (bHardcoded) {
      const nameIndex = this.readInt(CONSTS.MAX_NETWORKED_HARDCODED_NAME + 1)
      return CONSTS.PUBGNAMES[nameIndex]
    } else {
      const inString = this.readString()
      const inNumber = this.readUInt32()
      return inString
    }
  },
  readUInt16 () {
    let ret = this.readByte()
    ret = ret | (this.readByte() << 8)
    return ret
  },
  skipBits (bitsCount) {
    if (bitsCount > this.remainingBits) {
      throw new Error(`only ${this.remainingBits} bits left`)
    }
    this.remainingBits -= bitsCount
    while (bitsCount > this._localRemainingBits) {
      bitsCount -= this._localRemainingBits
      this._moveToNextBuffer()
    }
    this.posBits += bitsCount
    this._localRemainingBits -= bitsCount
  },
  readUEGuid () {
    return this.readIntPacked()
  },
  readObject () {
    const ueguid = this.readUEGuid()
    let obj = null
    const ueguidValid = ueguid > 0
    const ueguidDefault = ueguid === 1
    if (!ueguidValid) {
      return [ueguid, null]
    }
    if (ueguidValid && !ueguidDefault) {
      obj = UEGUIDCache.getObjectFromUEGuid(ueguid)
    }

    if (ueguidDefault || UEGUIDCache.isExportingUEGUIDBunch) { // need to read something from the packet and set to cache
      const exportFlags = this.readUInt8()
      const bHasPath = (exportFlags & 1) > 0
      if (bHasPath) {
        [outerGuid, outerObj] = this.readObject() // [ueguid, obj]
        const pathName = this.readString()
        let networkCheckSum = 0
        if ((exportFlags & 0b100) > 0) {
          networkCheckSum = this.readUInt32()
        }
        const bIsPackage = ((ueguid & 1) === 0) && (outerGuid === 0)
        if (obj != null || ueguidDefault) {
          return [ueguid, obj]
        }
        // register to cache
        UEGUIDCache.registerUEGUIDFromPathClient(ueguid, pathName, outerGuid)

        // try again
        obj = UEGUIDCache.getObjectFromUEGuid(ueguid)
      }
    }
    return [ueguid, obj]
  },
  // return [x, y, z]
  readVector (scaleFactor = 1000, maxBitsPerComponent = 24) {
    const bits = this.readInt(maxBitsPerComponent)
    const bias = 1 << (bits + 1)
    const max = 1 << (bits + 2)
    return [
      (this.readInt(max) - bias) / scaleFactor,
      (this.readInt(max) - bias) / scaleFactor,
      (this.readInt(max) - bias) / scaleFactor
    ]
  },
  readRotationShort () {
    const result = [0, 0, 0]
    if (this.readBit()) {
      result[0] = this.readUInt16() * ShortRotationScale // pitch
    }
    if (this.readBit()) {
      result[1] = this.readUInt16() * ShortRotationScale // yaw
    }
    if (this.readBit()) {
      result[2] = this.readUInt16() * ShortRotationScale // roll
    }
    return result
  },
  readRotation () {
    const result = [0, 0, 0]
    if (this.readBit()) {
      result[0] = this.readUInt8() * ByteRotationScale // pitch
    }
    if (this.readBit()) {
      result[1] = this.readUInt8() * ByteRotationScale // yaw
    }
    if (this.readBit()) {
      result[2] = this.readUInt8() * ByteRotationScale // roll
    }
    return result
  },
  readFloat () {
    var buffer = new ArrayBuffer(4)
    var uint8Array = new Uint8Array(buffer)
    uint8Array[0] = this.readByte()
    uint8Array[1] = this.readByte()
    uint8Array[2] = this.readByte()
    uint8Array[3] = this.readByte()
    return new Float32Array(buffer)[0]
  },
  readPropertyNetId () {
    if (this.readUInt32() > 0) {
      return this.readString()
    }
    return ''
  },
  readFloatVector () {
    return [this.readFloat(), this.readFloat(), this.readFloat()]
  },
  // data to read is [location, rotation, velocity]
  // OPTIMIZATION: we dont care about velocity, we only return [x, y, z, yaw]
  readMovement (isMoving, isPlayer) {
    const bSimulatedPhysicSleep = this.readBit()
    const bRepPhysics = this.readBit()
    const result = [0, 0, 0, 0] // x, y, z, yaw
    let location = [0, 0, 0]
    if (isMoving) {
      location = this.readVector(10000, 30) // location
    } else {
      location = this.readVector(100, 24) // location
    }
    result[0] = location[0]
    result[1] = 8192 - location[1] // Map to my openlayer map
    result[2] = location[2]

    let rotation = [0, 0, 0]
    if (isPlayer) {
      rotation = this.readRotationShort()
    } else {
      rotation = this.readRotation()
    }
    result[3] = rotation[1]

    this.readVector(1000, 24) // velocity

    if (bRepPhysics) {
      this.readVector(1000, 24)
    }
    return result
  },
  readFixedVector (maxValue, numBits) {
    return [
      this.readFixedCompressedFloat(maxValue, numBits),
      this.readFixedCompressedFloat(maxValue, numBits),
      this.readFixedCompressedFloat(maxValue, numBits)
    ]
  },
  readFixedCompressedFloat (maxValue, numBits) {
    const maxBitValue = (1 << (numBits - 1)) - 1 //0111 1111 - Max abs value we will serialize
    const bias = 1 << (numBits - 1) //1000 0000 - Bias to pivot around (in order to support signed
    const serIntMax = 1 << (numBits - 0) // 1 0000 0000 - What we pass into SerializeInt
    const maxDelta = (1 << (numBits - 0)) - 1//   1111 1111 - Max delta is
    const delta = this.readInt(serIntMax)
    const unscaledValue = delta - bias
    if (maxValue > maxBitValue) {
      return unscaledValue * (maxValue / maxBitValue)
    } else {
      const invScale = 1 / (maxBitValue / maxValue)
      return unscaledValue * invScale
    }
  }
}

// create uebuffer from nodejs Buffer
const ueBuffer = buffer => {
  const self = Object.create(ueBufferProto)
  self.buffer = buffer
  self.nextBuffer = null
  self.lastBuffer = self
  self.posBits = 0
  self.remainingBits = buffer.length * 8
  self._localRemainingBits = buffer.length * 8
  self.curBuffer = self
  return self
}

module.exports = ueBuffer
