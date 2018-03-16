const logger = require('./logger')
// make the cache singleton

const UEGUIDCache = {
  _cacheMap: new Map(),
  isExportingUEGUIDBunch: false,

  reset () {
    logger.warn('UEGUIDCache reseted!')
    this._cacheMap.clear()
    this.isExportingUEGUIDBunch = false
  },
  getCachedCount () {
    return this._cacheMap.size
  },
  getObjectFromUEGuid (ueguid) {
    const obj = this._cacheMap.get(ueguid)
    if (!obj || !obj[0]) {
      return null
    }
    return obj
  },
  getSimple (ueguid) {
    return this._cacheMap.get(ueguid)
  },
  registerUEGUIDFromPathClient (ueguid, pathName, outerGuid) {
    const existingObj = this._cacheMap.get(ueguid)
    if (existingObj != null) {
      // nothing to do, maybe do some logging here
      return
    }
    const newObj = [pathName, outerGuid] // [0] pathname [1] outerGuid
    this._cacheMap.set(ueguid, newObj)
    // if (pathName) {
    //   console.log(ueguid, newObj)
    // }
    logger.debug({ guid: ueguid, owner: newObj[1], path: newObj[0] }, 'registered guid cache')
  },
  registerUEGUIDClient (ueguid, pathName) {
    const existing = this._cacheMap.get(ueguid)
    if (existing != null) {
      this._cacheMap.delete(ueguid)
    }
    this._cacheMap.set(ueguid, [pathName, ueguid])
  }
}

module.exports = UEGUIDCache
