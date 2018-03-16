// here still use prototype + constructor to get better performance

// options contains
// bOpen: Boolean,
// bClose: Boolean,
// bDormant: Boolean,
// bIsReplicationPaused: Boolean,
// bReliable: Boolean,
// bPartial: Boolean,
// bPartialInitial: Boolean,
// bPartialFinal: Boolean,
// bHasPackageMapExports: Boolean,
// bHasMustBeMappedGUIDs: Boolean
const Bunch = function (totalBits, uebuffer, packetId, chIndex, chType, chSeq, pindex, isOutTraffic, options) {
  this.totalBits = totalBits
  this.uebuffer = uebuffer
  this.packetId = packetId
  this.chIndex = chIndex
  this.chType = chType
  this.chSeq = chSeq
  this.pIndexes = [pindex]
  this.isOutTraffic = isOutTraffic
  this.options = options
}

Bunch.prototype.toString = function () {
  return `[Bits:${this.totalBits} IsOut:${this.isOutTraffic} packetId:${this.packetId} chIndex:${this.chIndex} chType:${this.chType} chSeq:${this.chSeq} pIndexes:${this.pIndexes}]-(${this.options.bOpen?'O ':''}${this.options.bClose?'C ':''}${this.options.Dormant?'D ':''}${this.options.bIsReplicationPaused?'IRP ':''}${this.options.bReliable?'R ':''}${this.options.bPartialInitial?'PI ':''}${this.options.bPartialFinal?'PF ':''}${this.options.bHasPackageMapExports?'HPM ':''}${this.options.bHasMustBeMappedGUIDs?'HM ':''})  `
}

// still expose factory function because I am cool
const bunch = (totalBits, uebuffer, packetId, chIndex, chType, chSeq, pindex, isOutTraffic, options) => {
  return new Bunch(totalBits, uebuffer, packetId, chIndex, chType, chSeq, pindex, isOutTraffic, options)
}

module.exports = bunch
