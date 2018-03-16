const UEBuffer = require('../backend/uebuffer')

it('readBit test', () => {
  const buf = UEBuffer(Buffer.from([0b00110100, 0b00010101]))
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readBit()).toBeTruthy()
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readBit()).toBeTruthy()
  expect(buf.posBits).toBe(5)
  expect(buf.remainingBits).toBe(11)
})

it('readByte test', () => {
  const buf = UEBuffer(Buffer.from([0b00110100, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readByte()).toBe(0x34)
  expect(buf.readByte()).toBe(0x15)
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readByte()).toBe(0b10011010)
  expect(buf.posBits).toBe(25)
  expect(buf.remainingBits).toBe(7)
})

it('readBytes test', () => {
  const buf = UEBuffer(Buffer.from([0b00110100, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readBytes(3)).toEqual([0b00110100, 0b00010101, 0b00110100])
  expect(buf.posBits).toBe(24)
  expect(buf.remainingBits).toBe(8)
})

it('readBits test', () => {
  const buf = UEBuffer(Buffer.from([0b00110100, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readBits(1)).toEqual([0b00000000])
  expect(buf.readBits(2)).toEqual([0b00000010])
  expect(buf.readBits(16)).toEqual([0b10100110, 0b10000010])
  expect(buf.posBits).toBe(19)
  expect(buf.remainingBits).toBe(13)
})

it('readInt test', () => {
  const buf = UEBuffer(Buffer.from([0b00110100, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readInt(16384)).toBe(1357)
})

it('readPackedInt test', () => {
  const buf = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readIntPacked()).toBe(0b1101000010100011010)
})

it('skipBits test', () => {
  const buf = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  expect(() => buf.skipBits(33)).toThrow('only 32 bits left')
  buf.skipBits(17)
  expect(buf.posBits).toBe(17)
  expect(buf.remainingBits).toBe(15)
  expect(buf.ended()).toBeFalsy()
  expect(buf.readBit()).toBeFalsy()
  expect(buf.readBit()).toBeTruthy()
  buf.skipBits(13)
  expect(buf.posBits).toBe(32)
  expect(buf.remainingBits).toBe(0)
  expect(buf.ended()).toBeTruthy()
})

it('readUInt8 test', () => {
  const buf = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readUInt8()).toBe(53)
  expect(buf.posBits).toBe(8)
  expect(buf.remainingBits).toBe(24)
})

it('readInt8 test', () => {
  const buf = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readInt8()).toBe(53)
  expect(buf.posBits).toBe(8)
  expect(buf.remainingBits).toBe(24)
})

it('readUInt16 test', () => {
  const buf = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  expect(buf.readUInt16()).toBe(5429)
  expect(buf.posBits).toBe(16)
  expect(buf.remainingBits).toBe(16)
})

it('readFloat test', () => {
  let buf = UEBuffer(Buffer.from([0b00000001, 0b00000010, 0b00000011, 0b00000100]))
  expect(buf.readFloat()).toBe(1.539989614439558e-36)
  buf = UEBuffer(Buffer.from([0b00000100, 0b00000011, 0b00000010, 0b00000001]))
  expect(buf.readFloat()).toBe(2.387939260590663e-38)
  buf = UEBuffer(Buffer.from([0b10000000, 0b01000000, 0b00100000, 0b00010000]))
  expect(buf.readFloat()).toBe(3.1604125201405663e-29)
})

it('copyOut', () => {
  const buf1 = UEBuffer(Buffer.from([0b00110101, 0b00010101, 0b00110100, 0b00010101]))
  buf1.skipBits(10)
  expect(buf1.posBits).toBe(10)
  expect(buf1.remainingBits).toBe(22)

  expect(() => buf1.copyOut(23)).toThrow('Not enough data to copy out')

  const buf2 = buf1.copyOut(19) // [0b00010101, 0b00110100, 0b00010101], start from pos2
  expect(buf1.posBits).toBe(10)
  expect(buf1.remainingBits).toBe(22)
  expect(buf2.posBits).toBe(2)
  expect(buf2.remainingBits).toBe(19)
  expect(buf2.buffer.length).toBe(3)
  expect(buf2.readBit()).toBeTruthy()
  expect(buf2.readBit()).toBeFalsy()
  expect(buf2.readBit()).toBeTruthy()
  expect(buf2.readBit()).toBeFalsy()
  expect(buf2.readBit()).toBeFalsy()
  expect(buf2.remainingBits).toBe(14)
})

it('append buffer', () => {
  const buf1 = UEBuffer(Buffer.from([0b11111111, 0b11111111]))
  const buf2 = UEBuffer(Buffer.from([0b00000000]))
  const buf3 = UEBuffer(Buffer.from([0b01010101]))
  buf1.skipBits(3) // remaining = 13
  buf2.skipBits(4) // remaining = 4
  buf3.skipBits(5) // remaining = 3
  const buf4 = buf3.copyOut(2)
  expect(buf4.remainingBits).toBe(2)
  expect(buf4._localRemainingBits).toBe(2)

  buf1.append(buf2)
  expect(buf1.remainingBits).toBe(17)
  for (let i = 0; i < 13; i++) {
    expect(buf1.readBit()).toBeTruthy()
  }
  expect(buf1._localRemainingBits).toBe(0)

  for (let i = 0; i < 2; i++) {
    expect(buf1.readBit()).toBeFalsy()
  }
  expect(buf1.remainingBits).toBe(2)
  expect(buf1._localRemainingBits).toBe(2)
  buf1.append(buf4)
  expect(buf1.remainingBits).toBe(4)
  expect(buf1._localRemainingBits).toBe(2)
  for (let i = 0; i < 2; i++) {
    expect(buf1.readBit()).toBeFalsy()
  }
  expect(buf1.remainingBits).toBe(2)
  expect(buf1._localRemainingBits).toBe(0)

  expect(buf1.readBit()).toBeFalsy()
  expect(buf1.remainingBits).toBe(1)
  expect(buf1._localRemainingBits).toBe(1)
  expect(buf1.readBit()).toBeTruthy()
  expect(buf1.remainingBits).toBe(0)
  expect(buf1._localRemainingBits).toBe(0)
  expect(() => buf1.readBit()).toThrow('UEBuffer is at end, cannot read more')
})
