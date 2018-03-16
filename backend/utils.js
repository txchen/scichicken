const ACTOR_TYPES = require('./constants').ACTOR_TYPES

const toLocalISOString = (time) => {
  time = time instanceof Date ? time : new Date(time)
  var tzoffset = time.getTimezoneOffset() * 60000
  return (new Date(time - tzoffset)).toISOString().slice(0, -1).slice(5)
}

const getActorType = (pathName) => {
  if (pathName.startsWith('Default__TSLGameState')  ) {
    return ACTOR_TYPES.GAME_STATE
  }
  if (pathName.startsWith('Default__Player')) {
    return ACTOR_TYPES.PLAYER
  }
  if (/DroppedItemGroup/.test(pathName)) {
    return ACTOR_TYPES.DROPPED_ITEM_GROUP
  }
  if (/DroppedItem/.test(pathName)) {
    return ACTOR_TYPES.DROPPED_ITEM
  }
  if (/Aircraft/.test(pathName)) {
    return ACTOR_TYPES.PLANE
  }
  if (/Parachute/.test(pathName)) {
    return ACTOR_TYPES.PARACHUTE
  }
  // HACK: map all vehicles to CAR, to make logic easier
  if (/bike|buggy|sidecart/i.test(pathName)) {
    return ACTOR_TYPES.CAR  // should be ACTOR_TYPES.TWO_SEAT_CAR
  }
  if (/dacia|uaz|pickup/i.test(pathName)) {
    return ACTOR_TYPES.CAR // should be ACTOR_TYPES.FOUR_SEAT_CAR
  }
  if (/bus|van/i.test(pathName)) {
    return ACTOR_TYPES.CAR // should be ACTOR_TYPES.SIX_SEAT_CAR
  }
  if (/aquarail|boat|pg117/i.test(pathName)) {
    return ACTOR_TYPES.CAR // should be ACTOR_TYPES.BOAT
  }
  if (/carapackage/i.test(pathName)) {
    return ACTOR_TYPES.AIRDROP
  }
  if (/SmokeBomb|Molotov|Grenade|FlashBang|BigBomb/i.test(pathName)) {
    return ACTOR_TYPES.THROW
  }
  if (/Default__TslPlayerState/.test(pathName)) {
    return ACTOR_TYPES.PLAYER_STATE
  }
  if (/Default__Team/i.test(pathName)) {
    return ACTOR_TYPES.TEAM
  }
  if (/DeathDropItemPackage/i.test(pathName)) {
    return ACTOR_TYPES.BOX
  }
  // if (!unameSet.has(pathName)) {
  //   console.log('!!!!!!!', pathName)
  //   unameSet.add(pathName)
  // }
  return ACTOR_TYPES.OTHER
}

// Flags(16bit): 0b  1     1       1     1     1     1     1    1    1     1     1     1      0  0  0  0
//                   顶级  多多益善  好枪   瞄准  医疗   步枪  步配  狙   狙配   投掷   子弹  穿戴
const classNameMap = {
  'Attach': {
    'Weapon': {
      'Lower': {
        'AngledForeGrip': ['角握', 0b0000001000000000],
        'Foregrip': ['垂握',       0b0000001000000000]
      },
      'Magazine': {
        'Extended': {
          //'Medium': '冲长',
          'Large': ['步长',        0b0000001000000000],
          'SniperRifle': ['狙长',  0b0000000000000000]
        },
        'ExtendedQuickDraw': {
          //'Medium': '冲长快',
          'Large': ['步长快',       0b0000001000000000],
          'SniperRifle': ['狙长快', 0b0000000000000000]
        }
      },
      'Muzzle': {
        'Compensator': {
          'Large': ['步补', 0b0000001000000000]
        },
        'FlashHider': {
          'Large': ['步焰',       0b0000001000000000],
          'SniperRifle': ['狙焰', 0b0000000010000000]
        },
        'Suppressor': {
          //'Medium': '冲消',
          'Large': ['步消',       0b1000001000000000],
          'SniperRifle': ['狙消', 0b1000000010000000]
        },
      },
      'Stock': {
        'AR': ['步托',            0b0000001000000000],
        'SniperRifle': {
          'BulletLoops': ['狙弹', 0b0000000010000000],
          'CheekPad': ['狙托',    0b0000000010000000]
        }
      },
      'Upper': {
        'DotSight': ['红点', 0b0001000000000000],
        'Aimpoint': ['2X', 0b0001000000000000],
        'Holosight': ['全息', 0b0001000000000000],
        'ACOG': ['4X', 0b1001000000000000],
        'CQBSS': ['8X', 0b1001000000000000]
      }
    }
  },
  'Weapon': {
    'Grenade': ['雷',   0b0100000001000000],
    'SmokeBomb': ['烟', 0b0000000001000000],
    'FlashBang': ['闪', 0b0000000001000000],
    'Molotov': ['燃',   0b0000000001000000],
    'M16A4': ['m16',    0b0000010000000000],
    'HK416': ['M4',     0b0010010000000000],
    'SCAR-L': ['Scar',  0b0010010000000000],
    'AK47': ['AK',      0b0000010000000000],
    'Kar98k': ['98k',   0b0010000100000000],
    'SKS': ['sks',      0b0010000100000000],
    'Mini14': ['mini',  0b0000000100000000],
    'VSS': ['vss',      0b0000000100000000],
    'Pan': ['锅',       0b0000000000010000],
    //'DP28': '盘',
    //'UMP': 'ump',
    //'Vector': 'vct',
    //'uzi': 'uzi'
  },
  'Ammo': {
    //'9mm': '.9',
    //'45mm': '.45',
    '556mm': ['.5', 0b0000000000100000],
    '762mm': ['.7', 0b0000000000100000],
    //'300mm': '.3',
  },
  'Armor': {
    'C': { '01': { 'Lv3': ['3甲', 0b1000000000010000]} },
    'D': { '01': { 'Lv2': ['2甲', 0b0000000000010000]} },
  },
  'Boost': {
    'EnergyDrink': ['水', 0b0100100000000000],
    'PainKiller': ['疼', 0b0100100000000000]
  },
  'Heal': {
    'FirstAid': ['急', 0b0100100000000000],
    'MedKit': ['医',   0b1000100000000000],
    'Bandage': ['绷',  0b0000100000000000]
  },
  'Back': {
    'C': {
      '01': { 'Lv3': ['3包', 0b1000000000010000] },
      '02': { 'Lv3': ['3包', 0b1000000000010000] }
    },
    'F': {
      '01': { 'Lv2': ['2包', 0b0000000000010000] },
      '02': { 'Lv2': ['2包', 0b0000000000010000] }
    }
  },
  'Head': {
    'F': {
      '01': { 'Lv2': ['2头', 0b0000000000010000] },
      '02': { 'Lv2': ['2头', 0b0000000000010000] }
    },
    'G': {
      '01': { 'Lv3': ['3头', 0b1000000000010000] }
    }
  }
}

const friendlyNameCache = new Map()
// return [friendlyName, flags]
// if the item is not good enough, return ['',0]
const classNameToFriendlyName = (className) => {
  let result = friendlyNameCache.get(className)
  if (result) {
    return result
  }
  result = ['', 0]
  const tokens = className.split('_')
  if (tokens.length > 1 && tokens[0] === 'Item') {
    let cur = classNameMap
    for (let i = 1; i < tokens.length; i++) {
      cur = cur[tokens[i]]
      if (!cur) {
        //result = [className, 0] // when you need to debug name
        break
      }
      if (Array.isArray(cur)) {
        result = cur
      }
    }
  }
  friendlyNameCache.set(className, result)
  return result
}

function BufferNotEnoughError (message) {
  Error.captureStackTrace(this, this.constructor)
  this.name = 'BufferNotEnoughError'
  this.message = (message || '')
}
require('util').inherits(BufferNotEnoughError, Error)

module.exports = {
  toLocalISOString,
  getActorType,
  classNameToFriendlyName,
  BufferNotEnoughError
}
