const appData = {
  autoRefresh: true,
  refreshInterval: 1000,
  gsTime: 0,
  me: [-1, -1, 0, 0],
  meGuid: -1,
  safe: [-1, -1, 0],
  poison: [-1, -1, 0],

  showingPlayers: new Map(), // guid -> obj { loc: team: kills: name: guid: friend: dead: }, replicate the server data.
  playerFeatures: new Map(), // guid -> ol.Feature

  showingAPawns: new Map(), // guid -> obj { loc, guid, owner, T }, replicate server data
  apawnFeatures: new Map(), // guid -> ol.Feature

  showingItems: new Map(), // itemguid -> obj { loc: name: FT:}
  itemFeatures: new Map(), // itemguid -> olFeature
}

// vue app just for html map option control
vapp = new Vue({
  el: '#app',
  data: {
    gameStartTime: '',
    lastPacketTime: '',
    mapType: 'erangel',
    followMe: true,
    isDesert: false,
    showBox: false,
    showAirDrop: true,
    showCar: true,

    showItemTop: true,
    showItemDuoDuo: true,
    showItemBasic: true,
    showItemAR: false,
    showItemSR: false,
    showItemHealth: false,
    showItemThrow: false,
    showItemAmmo: false,
    showItemAll: false,

    coordinate: '',
    toggleButtonText: '停止刷新'
  },
  watch: {
    mapType: (val) => {
      showMap(val === 'miramar')
    },
    followMe: (val) => {
      renderMap()
    }
  },
  computed: {
    showItemFlags: function () {
      if (this.showItemAll) {
        return 0b1111111111111111
      }
      let flags = 0
      if (this.showItemTop) {
        flags |= 0b1000000000000000
      }
      if (this.showItemDuoDuo) {
        flags |= 0b0100000000000000 // 雷 水 疼 急
      }
      if (this.showItemBasic) {
        flags |= 0b0001010100010000 // 基本出装: 穿戴 | 步枪 | 瞄准 | 狙枪
      }
      if (this.showItemAR) {
        flags |= 0b0000011000000000 // 步枪和配件
      }
      if (this.showItemSR) {
        flags |= 0b0000000110000000 // 狙击和配件
      }
      if (this.showItemHealth) {
        flags |= 0b0000100000000000
      }
      if (this.showItemThrow) {
        flags |= 0b0000000001000000
      }
      if (this.showItemAmmo) {
        flags |= 0b0000000000100000
      }
      return flags
    }
  },
  methods: {
    toggleRefresh () {
      if (appData.autoRefresh) {
        appData.autoRefresh = false
        this.toggleButtonText = 'Start Refresh'
      } else {
        appData.autoRefresh = true
        this.toggleButtonText = ' Stop Refresh'
      }
    },
    setFPS (fps) {
      appData.refreshInterval = Math.floor(1000 / fps)
    },
    showNoItems () {
      this.showItemAll = this.showItemDuoDuo = this.showItemTop = this.showItemBasic = this.showItemAR = this.showItemSR = this.showItemHealth = this.showItemThrow = this.showItemAmmo = this.showItemAll = false
    }
  }
})

const projection = ol.proj.get('EPSG:21781')
// The extent is used to determine zoom level 0. Recommended values for a
// projection's validity extent can be found at https://epsg.io/.
// 0,0 at left bottom, 0, 8192 at left top
projection.setExtent([0, 0, 8192, 8192])

function getMapSource (mapType) {
  const mapPath = mapType === 'erangel'
    ? 'erangel/v11'
    : 'miramar/v5'
  // if false, will use https://tiles2-v2.pubgmap.net/tiles/erangel/v11/{z}/{x}/{y}.png not sure if it is stable or not. But it will have more zoom, up to 5. Local only has up to 4
  let useLocalResource = false
  const mapBase = useLocalResource
    ? '../maptiles'
    : 'https://tiles2-v2.pubgmap.net/tiles'

  return new ol.source.XYZ({
    url: `${mapBase}/${mapPath}/{z}/{x}/{y}.png`,
    wrapX: false,
    minZoom: 1,
    maxZoom: useLocalResource ? 4 : 5,
    projection: projection
  })
}

const view = new ol.View({
  center: [4096, 4096],
  zoom: 3,
  minZoom: 1,
  maxZoom: 7,
  projection: projection
})

const map = new ol.Map({
  controls: ol.control
    .defaults({
      attribution: false
    })
    .extend([
      new ol.control.ScaleLine({
        units: 'metric'
      })
    ]),
  loadTilesWhileAnimating: true,
  loadTilesWhileInteracting: true,
  view: view,
  target: 'map'
})

// Layer 0, the base PUBG maps
const erangelMapLayer = new ol.layer.Tile({
  source: getMapSource('erangel')
})
erangelMapLayer.visible = false
erangelMapLayer.setZIndex(0)
map.addLayer(erangelMapLayer)
const miramarMapLayer = new ol.layer.Tile({
  source: getMapSource('miramar')
})
miramarMapLayer.visible = false
miramarMapLayer.setZIndex(0)
map.addLayer(miramarMapLayer)
// end of Layer 0

// SVGs
const carSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#FFFFFFFF" id="svg_2" d="m9.86048,0.09798l-3.95767,0c-1.04907,0 -1.89924,1.16687 -1.89924,2.21595l0,11.71383c0,1.04874 0.85016,1.89958 1.89924,1.89958l3.95767,0c1.04874,0 1.89958,-0.8505 1.89958,-1.89958l0,-11.71383c-0.00067,-1.04907 -0.85084,-2.21595 -1.89958,-2.21595zm1.56671,4.77519l0,3.92604l-0.91849,0.11813l0,-1.61753l0.91849,-2.42664zm-0.48196,-1.14937c-0.34195,1.31261 -0.74684,2.86417 -0.74684,2.86417l-4.63383,0l-0.74785,-2.86417c0.00034,0 2.99005,-1.01575 6.12852,0zm-5.68022,3.68203l0,1.51185l-0.91882,-0.11746l0,-3.82137l0.91882,2.42697zm-0.91882,5.46078l0,-3.48648l0.91882,0.11544l0,2.75849l-0.91882,0.61255zm0.52403,0.99085l0.7465,-1.12278l4.63484,0l0.74684,1.12278l-6.12819,0zm5.63848,-1.70874l0,-2.64944l0.91849,-0.11948l0,3.38181l-0.91849,-0.61289z"/></svg>'
const carSvgImg = new Image()
carSvgImg.src = 'data:image/svg+xml,' + escape(carSvg)

const boxSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#FFC107D0" d="m7.90051,0.27295c-3.58696,0 -6.49475,2.90779 -6.49475,6.49475l0,4.54633l0,0.02888l0.00069,0c0.01459,0.58708 0.47052,1.21066 1.02621,1.3959l2.22047,0.74014l0,1.29895c0,0.59535 0.48711,1.08246 1.08246,1.08246l4.32983,0c0.59535,0 1.08246,-0.48711 1.08246,-1.08246l0,-1.29895l2.22047,-0.74014c0.55569,-0.18523 1.01162,-0.80886 1.02621,-1.3959l0.00069,0l0,-0.02888l0,-4.54633c0,-3.58696 -2.90779,-6.49475 -6.49475,-6.49475zm2.38141,6.92773c1.07609,0 1.94843,0.87229 1.94843,1.94843s-0.87233,1.94843 -1.94843,1.94843s-1.94843,-0.87229 -1.94843,-1.94843s0.87229,-1.94843 1.94843,-1.94843zm-4.76282,0c1.07614,0 1.94843,0.87229 1.94843,1.94843s-0.87229,1.94843 -1.94843,1.94843s-1.94843,-0.87229 -1.94843,-1.94843s0.87229,-1.94843 1.94843,-1.94843zm3.24738,5.1958c0,0.47827 -0.38769,0.86597 -0.86597,0.86597s-0.86597,-0.38769 -0.86597,-0.86597s0.86597,-1.73193 0.86597,-1.73193s0.86597,1.25366 0.86597,1.73193z"></path></svg>'
const boxSvgImg = new Image()
boxSvgImg.src = 'data:image/svg+xml,' + escape(boxSvg)

const airdropSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#FFC107D0" d="m15.26816,3.06316l-3.35309,0c0.33525,-0.54274 0.39587,-1.24248 0.09583,-1.85723c-0.32147,-0.65802 -0.97206,-1.06693 -1.69981,-1.06693c-0.29085,0 -0.57191,0.06614 -0.83521,0.19688c-0.63804,0.31742 -1.13464,0.93464 -1.48029,1.4953c-0.34566,-0.56097 -0.84195,-1.17819 -1.48029,-1.49561c-0.26269,-0.13043 -0.54344,-0.19657 -0.8349,-0.19657c-0.72714,0 -1.37834,0.40891 -1.6992,1.06662c-0.30004,0.61506 -0.23942,1.3145 0.09613,1.85754l-3.35186,0c-0.33678,0 -0.61232,0.27817 -0.61232,0.61815l0,3.20634c0,0.33998 0.27555,0.61815 0.61232,0.61815l0.16716,0l0,2.64723l0,1.2363l0,3.15782c0,0.65864 0.52874,1.19148 1.18056,1.19148l11.84725,0c0.65182,0 1.18056,-0.53408 1.18056,-1.19148l0,-7.04134l0.16716,0c0.33678,0 0.61232,-0.27817 0.61232,-0.61815l0,-3.20634c0,-0.33998 -0.27555,-0.61815 -0.61232,-0.61815zm-5.25007,-1.61832c0.32637,-0.16226 0.73632,-0.01762 0.89491,0.30722c0.16288,0.33411 0.02633,0.73962 -0.30371,0.90373c-0.2535,0.12579 -0.58232,0.18977 -0.97819,0.18977c-0.17329,0 -0.33953,-0.01484 -0.49935,-0.03369c-0.02939,-0.09921 -0.06919,-0.19317 -0.12124,-0.27971c0.26361,-0.43889 0.61447,-0.89199 1.00758,-1.08733zm-4.93717,0.3066c0.11328,-0.23212 0.34321,-0.37645 0.60038,-0.37645c0.10226,0 0.20145,0.02349 0.29392,0.06954c0.39281,0.19534 0.74367,0.64875 1.00758,1.08702c-0.05205,0.08685 -0.09154,0.1805 -0.12063,0.28002c-0.15982,0.01916 -0.32576,0.03369 -0.49904,0.03369c-0.39556,0 -0.72499,-0.06398 -0.97788,-0.18946c-0.33066,-0.16443 -0.4672,-0.57024 -0.30433,-0.90435zm2.32928,12.44212l-4.98677,0l0,-2.80454l4.98677,0l0,2.80454zm-4.98677,-4.04115l0,-2.64692l4.98677,0l0,2.64692l-4.98677,0zm11.14675,4.04115l-4.98677,0l0,-2.80454l4.98677,0l0,2.80454zm0,-4.04115l-4.98677,0l0,-2.64692l4.98677,0l0,2.64692z"></path></svg>'
const airdropSvgImg = new Image()
airdropSvgImg.src = 'data:image/svg+xml,' + escape(airdropSvg)

const parachuteSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#FF17FFD0" d="m8.00098,0.15001c-4.36542,0 -7.91697,3.07764 -7.91697,6.86053c0,0.18948 0.09936,0.36865 0.27015,0.48702l5.60843,3.88803c-0.34066,0.04928 -0.60059,0.30523 -0.60059,0.61441l0,3.3263c0,0.34445 0.32225,0.6237 0.71974,0.6237l3.83855,0c0.39749,0 0.71974,-0.27925 0.71974,-0.6237l0,-3.3263c0,-0.30918 -0.25993,-0.56513 -0.60059,-0.61441l5.60843,-3.88803c0.17076,-0.11838 0.27015,-0.29755 0.27015,-0.48702c-0.00007,-3.7829 -3.55163,-6.86053 -7.91704,-6.86053l0,0zm-6.15296,6.78573c0.37339,-0.31381 0.87447,-0.49755 1.40017,-0.49755c0.67092,0 1.30024,0.29508 1.67523,0.77744c0.0047,0.01157 0.00887,0.02324 0.01439,0.03472l1.31776,2.74084l-4.40754,-3.05545zm6.15321,3.44301l-1.57698,-3.28007c0.38126,-0.41244 0.96051,-0.66048 1.57513,-0.66048c0.61636,0 1.197,0.24934 1.57826,0.66375l-1.57641,3.2768l0,0zm1.7462,-0.38818l1.31826,-2.74006c0.00734,-0.01531 0.01335,-0.03086 0.01919,-0.04635c0.37613,-0.47542 1.00032,-0.76593 1.66572,-0.76593c0.52865,0 1.03098,0.18358 1.40398,0.49711l-4.40715,3.05523z"></path></svg>'
const parachuteSvgImg = new Image()
parachuteSvgImg.src = 'data:image/svg+xml,' + escape(parachuteSvg)

const apawnStyleFunc = function (feature) {
  let apawnImg = null
  switch (this.get('_T')) {
    case 'PARACHUTE':
      apawnImg = parachuteSvgImg
      break
    case 'AIRDROP':
      apawnImg = airdropSvgImg
      break
    case 'BOX':
      apawnImg = boxSvgImg
      break
    case 'CAR':
      apawnImg = carSvgImg
      break
    default:
      break
  }
  var style = new ol.style.Style({
    image: new ol.style.Icon({
      img: apawnImg,
      imgSize: [16, 16],
      scale: 1.5,
      rotation: this.get('_rotation') || 0 // 0 - 6.28
    }),
    text: new ol.style.Text({
      font: '12px Calibri,sans-serif',
      textAlign: 'center',
      fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.9)' }),
      text: this.get('_label') || '' ,
      offsetY: 15
    })
  })
  return [style]
}

const playerSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#FF1744D0" d="m15.59534,14.12918c0,0.43359 -0.35149,0.78508 -0.78508,0.78508l-6.86926,-2.94398l-6.86932,2.94402c-0.43362,0 -0.78508,-0.35152 -0.78508,-0.78511l7.06556,-12.75726c0,0 0.58881,-0.58881 1.17756,0c0.58884,0.58884 7.06562,12.75726 7.06562,12.75726z"></path></svg>'
const playerSvgImg = new Image()
playerSvgImg.src = 'data:image/svg+xml,' + escape(playerSvg)

const friendSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="0 0 16 16">' +
'<path fill="#00C853D0" d="m15.59534,14.12918c0,0.43359 -0.35149,0.78508 -0.78508,0.78508l-6.86926,-2.94398l-6.86932,2.94402c-0.43362,0 -0.78508,-0.35152 -0.78508,-0.78511l7.06556,-12.75726c0,0 0.58881,-0.58881 1.17756,0c0.58884,0.58884 7.06562,12.75726 7.06562,12.75726z"></path></svg>'
const friendSvgImg = new Image()
friendSvgImg.src = 'data:image/svg+xml,' + escape(friendSvg)

const playerStyleFunc = function (feature) {
  var iconStyle = new ol.style.Style({
    image: new ol.style.Icon({
      img: this.get('_friend') ? friendSvgImg : playerSvgImg,
      imgSize: [16, 16],
      scale: 1,
      rotation: this.get('_rotation') || 0, // 0 - 6.28,
    }),
    text: new ol.style.Text({
      font: '12px Calibri,sans-serif',
      textAlign: 'center',
      fill: new ol.style.Fill({ color: 'rgba(255,255,255,1)' }),
      text: this.get('_label') || '' ,
      offsetY: 15
    })
  })
  const result = [iconStyle]
  if (this.get('_friend') && this.get('_lineGeo')) {
    result.push(new ol.style.Style({
      geometry: this.get('_lineGeo'),
      stroke: new ol.style.Stroke({ color: '#FFFFFFFF', width: 1.8 })
    }))
  }
  return result
}
// End of SVGs

// START OF gridLayer - layer 1
const gridSource = new ol.source.Vector({
  wrapX: false
})
const majorLineStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: [255, 255, 0, 0.6]
  })
})
const minorLineStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: [0xcc, 0xcc, 0xcc, 0.4]
  })
})
const gridLayer = new ol.layer.Vector({
  source: gridSource
})
for (let i = 0; i <= 7; i++) {
  const linex = new ol.Feature({
    geometry: new ol.geom.LineString([[1024 * i, 0], [1024 * i, 8192]])
  })
  const liney = new ol.Feature({
    geometry: new ol.geom.LineString([[0, 1024 * i], [8192, 1024 * i]])
  })
  linex.setStyle(majorLineStyle)
  liney.setStyle(majorLineStyle)
  gridSource.addFeature(liney)
  gridSource.addFeature(linex)
  for (let ii = 1; ii <= 9; ii++) {
    const lineMinorX = new ol.Feature({
      geometry: new ol.geom.LineString([
        [1024 * i + 102.4 * ii, 0],
        [1024 * i + 102.4 * ii, 8192]
      ])
    })
    lineMinorX.setStyle(minorLineStyle)
    gridSource.addFeature(lineMinorX)
    const lineMinorY = new ol.Feature({
      geometry: new ol.geom.LineString([
        [0, 1024 * i + 102.4 * ii],
        [8192, 1024 * i + 102.4 * ii]
      ])
    })
    lineMinorY.setStyle(minorLineStyle)
    gridSource.addFeature(lineMinorY)
  }
}
// blue and white circle
const zoneStyleFunc = function (feature) {
  const style = new ol.style.Style({
    fill : new ol.style.Fill({
      color: [0, 0, 0, 0]
    }),
    stroke: new ol.style.Stroke({
      color: this.get('_color'),
      width: 1.5
    })
  })
  return [style]
}
const safeCircle = new ol.Feature({
  geometry: new ol.geom.Circle([-1, -1], 100)
})
safeCircle.setId('safe')
safeCircle.set('_color', 'rgba(255,255,255,0.9)')
safeCircle.setStyle(zoneStyleFunc)
gridSource.addFeature(safeCircle)

const poisonCircle = new ol.Feature({
  geometry: new ol.geom.Circle([-1, -1], 0)
})
poisonCircle.setId('poison')
poisonCircle.set('_color', 'rgba(0,0,255,0.9)')
poisonCircle.setStyle(zoneStyleFunc)
gridSource.addFeature(poisonCircle)

gridLayer.setZIndex(1)
map.addLayer(gridLayer)
// END OF gridLayer - layer 1

// item layer - layer 2
const itemSource = new ol.source.Vector({
  wrapX: false
})
var itemLayer = new ol.layer.Vector({
  source: itemSource
})
const itemStyleFunc = function (feature) {
  var style = new ol.style.Style({
    image: new ol.style.Circle({
      radius: 3,
      fill: new ol.style.Fill({
        color: 'rgba(0,255,0,1)'
      }),
      stroke: new ol.style.Stroke({color: 'rgba(0,0,255,0.8)', width: 1.5 })
    }),
    text: new ol.style.Text({
      font: 'bold 14px Calibri,sans-serif',
      textAlign: 'center',
      fill: new ol.style.Fill({ color: 'rgba(239,108,0,1)' }),
      text: this.get('_label') || '' ,
      offsetY: 12,
      stroke: new ol.style.Stroke({color: 'rgba(255,255,255,1)', width: 2.5 })
    })
  })
  return [style]
}
itemLayer.setZIndex(2)
map.addLayer(itemLayer)
// END of item layer - layer 2

// meLayer - layer 8
const meSource = new ol.source.Vector({
  wrapX: false
})
var meLayer = new ol.layer.Vector({
  source: meSource
})
const mePoint = new ol.Feature({
  geometry: new ol.geom.Point([appData.me[0], appData.me[1]])
})
mePoint.setId('me')
mePoint.set('_radius', 6)
const meStyleFunc = function (feature) {
  const meIconStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: this.get('_radius'),
      fill: new ol.style.Fill({
        color: 'rgba(255,255,255,1)'
      }),
      stroke : new ol.style.Stroke({
        width : this.get('_radius') - 1,
        color : 'rgba(239,108,0,1)'
      })
    }),
  })
  const result = [meIconStyle]
  const lineGeo = this.get('_lineGeo')
  if (lineGeo)
  result.push(new ol.style.Style({
    geometry: this.get('_lineGeo'),
    stroke: new ol.style.Stroke({ color: 'rgba(239,108,0,0.8)', width: 2.2 })
  }))
  return result
}
mePoint.setStyle(meStyleFunc)
// removeFeature can be used. For dead enemies
meLayer.getSource().addFeature(mePoint)
meLayer.setZIndex(8)
map.addLayer(meLayer)
// End of Layer 8

// player layer - layer 7
const playerSource = new ol.source.Vector({
  wrapX: false
})
var playerLayer = new ol.layer.Vector({
  source: playerSource
})

playerLayer.setZIndex(7)
map.addLayer(playerLayer)
// End of player layer - layer 7

// Apawn layer - layer 6
const apawnSource = new ol.source.Vector({
  wrapX: false
})
var apawnLayer = new ol.layer.Vector({
  source: apawnSource
})
apawnLayer.setZIndex(6)
map.addLayer(apawnLayer)
// End of apawn layer - layer 6

// Event handling
map.on('singleclick', e => {
  vapp.$data.coordinate = `${parseInt(e.coordinate[0])}, ${parseInt(e.coordinate[1])}`
})
window.addEventListener('keyup', (event) => {
  if (event.keyCode == 187) {
    view.setZoom(view.getZoom() + 1)
  }
  if (event.keyCode == 189) {
    view.setZoom(view.getZoom() - 1)
  }
})
// End of Event handling

// Functions
const showMap = (isDesert) => {
  console.log('in showMap: isDesert =', isDesert)
  if (isDesert) {
    miramarMapLayer.setVisible(true)
    erangelMapLayer.setVisible(false)
  } else {
    miramarMapLayer.setVisible(false)
    erangelMapLayer.setVisible(true)
  }
}

const isInMap = (location) => {
  return location[0] <= 8192 && location[0] >= 0 &&
    location[1] <= 8192 && location[1] >= 0
}

const renderMap = () => {
  // render ME
  mePoint.getGeometry().setCoordinates([appData.me[0], appData.me[1]])
  if (appData.me[3] > -360) {
    const radianAngle = appData.me[3] / 180 * Math.PI
    mePoint.set('_lineGeo', new ol.geom.LineString(
      [[appData.me[0], appData.me[1]],
        [appData.me[0] + Math.cos(radianAngle) * 512, appData.me[1] - Math.sin(radianAngle) * 512]]
      )
    )
  } else {
    mePoint.set('_lineGeo', null)
  }
  const meInMap = isInMap(appData.me)
  if (meInMap && vapp.$data.followMe) {
    view.setCenter([appData.me[0], appData.me[1]])
  }

  // render safezone and poison
  const safeGeo = safeCircle.getGeometry()
  const safeCenter = safeGeo.getCenter()
  if (appData.safe[2] !== safeGeo.getRadius()
    || appData.safe[0] !== safeCenter[0]
    || appData.safe[1] !== safeCenter[1]) {
    safeGeo.setCenterAndRadius([appData.safe[0], appData.safe[1]], appData.safe[2])
  }
  const poisonGeo = poisonCircle.getGeometry()
  const poisonCenter = poisonGeo.getCenter()
  if (appData.poison[2] !== poisonGeo.getRadius()
    || appData.poison[0] !== poisonCenter[0]
    || appData.poison[1] !== poisonCenter[1]) {
    poisonGeo.setCenterAndRadius([appData.poison[0], appData.poison[1]], appData.poison[2])
  }

  // render players
  // (1) foreach player in showingPlayers, create feature if not yet
  for (const pair of appData.showingPlayers.entries()) {
    const playerGuid = pair[0]
    const playerObj = pair[1]
    let feature = appData.playerFeatures.get(playerGuid)
    if (!feature) { // not created yet, create it
      feature = new ol.Feature({
        geometry: new ol.geom.Point([9000, 9000])
      })
      feature.setId(playerGuid)
      feature.setStyle(playerStyleFunc)
      appData.playerFeatures.set(playerGuid, feature)
    }
    // now we have the feature
    const loc = playerObj.loc
    if (loc) {
      feature.getGeometry().setCoordinates([loc[0], loc[1]])
      // game direction 0 is facing east
      feature.set('_rotation', (loc[3] + 90) / 180 * Math.PI)
    }
    let label = ''
    if (playerObj.friend) {
      if (!feature.get('_friend')) { // feature not set to friend yet
        feature.set('_friend', true)
      }
      if (playerObj.name) {
        label = playerObj.name.substring(0, 6) // make it shorter
      }
      // calculate the aim line, for 512 units (500m)
      const radianAngle = loc[3] / 180 * Math.PI
      feature.set('_lineGeo', new ol.geom.LineString(
        [[loc[0], loc[1]],
         [loc[0] + Math.cos(radianAngle) * 512, loc[1] - Math.sin(radianAngle) * 512]]
        )
      )
    } else { // enemy
      if (playerObj.team) {
        label = `${playerObj.team}`
      } else if (playerObj.name) {
        label = playerObj.name
      } else {
        label = `<${playerObj.guid}>`
      }
      if (playerObj.kills) {
        label += `(${playerObj.kills})`
      }
    }
    if (playerObj.health != null) {
      label += `@${Math.floor(playerObj.health)}`
    }
    feature.set('_label', label)
    // re-add should be fine
    playerSource.addFeature(feature)
  }
  // (2) get all the features in the layer, if they are not in showingPlayers, remove them
  for (const renderingFeature of playerSource.getFeatures()) {
    const featureId = renderingFeature.getId()
    if (!appData.showingPlayers.has(featureId) || appData.meGuid === featureId) {
      playerSource.removeFeature(renderingFeature)
    }
  }
  // end of render players

  // render apawns
  // (1) foreach apawn in showingAPawns, create feature if not yet
  for (const pair of appData.showingAPawns.entries()) {
    const apawnGuid = pair[0]
    const apawnObj = pair[1]
    let feature = appData.apawnFeatures.get(apawnGuid)
    if (!feature) { // not created yet, create it
      feature = new ol.Feature({
        geometry: new ol.geom.Point([9000, 9000])
      })
      feature.setId(apawnGuid)
      feature.set('_T', apawnObj.T)
      if (apawnObj.T === 'BOX' || apawnObj.T === 'AIRDROP') {
        if (apawnObj.MINUTE) {
          feature.set('_label', apawnObj.MINUTE.toString()) // this will never change
        }
      }
      // feature.set('_label', apawnGuid.toString()), debug purpose
      feature.setStyle(apawnStyleFunc)
      appData.apawnFeatures.set(apawnGuid, feature)
    }
    // now we have the apawn feature
    const loc = apawnObj.loc
    if (loc) {
      feature.getGeometry().setCoordinates([loc[0], loc[1]])
      // game direction 0 is facing east
      feature.set('_rotation', (loc[3] + 90) / 360 * 6.28)
    }
    // this logic is buggy when I try to repeat the playback, remove it.
    // if (apawnObj.owner) {
    //   if (apawnObj.T === 'PARACHUTE' && !feature.get('_label')) {
    //     // owner is player
    //     const p = appData.playerFeatures.get(apawnObj.owner)
    //     if (p && p.get('_label')) {
    //       feature.set('_label', p.get('_label'))
    //     }
    //   }
    // }
    if (apawnObj.T === 'CAR') {
      feature.set('_label', apawnObj.driverCount ? apawnObj.driverCount.toString() : '')
    }
    // re-add should be fine
    apawnSource.addFeature(feature)
  }
  // (2) get all the features in the layer, if they are not in showingAPawns, remove them
  for (const renderingAPawnFeature of apawnSource.getFeatures()) {
    const featureId = renderingAPawnFeature.getId()
    if (!appData.showingAPawns.has(featureId)) {
      apawnSource.removeFeature(renderingAPawnFeature)
    }
  }

  // renders items
  // (1) foreach item in showingItems, create feature if not yet
  for (const pair of appData.showingItems.entries()) {
    const itemguid = pair[0]
    const itemobj = pair[1]
    let itemFeature = appData.itemFeatures.get(itemguid)
    if (!itemFeature) { // not created yet, create it
      itemFeature = new ol.Feature({
        geometry: new ol.geom.Point([9000, 9000])
      })
      itemFeature.setId(itemguid)
      itemFeature.setStyle(itemStyleFunc)
      itemFeature.set('_label', itemobj.name)
      appData.itemFeatures.set(itemguid, itemFeature)
    }
    // now we have the item feature
    const loc = itemobj.loc
    const itemGeometry = itemFeature.getGeometry()
    const itemCoordinates = itemGeometry.getCoordinates()
    if (loc[0] !== itemCoordinates[0] || loc[1] !== itemCoordinates[1]) {
      itemGeometry.setCoordinates([loc[0], loc[1]])
    }
    // re-add should be fine
    itemSource.addFeature(itemFeature)
  }
  // (2) get all the features in the layer, if they are not in showingItems, remove them
  for (const renderingItemFeature of itemSource.getFeatures()) {
    const itemFeatureId = renderingItemFeature.getId()
    if (!appData.showingItems.has(itemFeatureId)) {
      itemSource.removeFeature(renderingItemFeature)
    }
  }
}

const updatePlayerLocs = () => {
  setTimeout(updatePlayerLocs, appData.refreshInterval)
  if (!appData.autoRefresh) {
    return
  }
  // get data from backend server
  let query = ''
  if (!vapp.showBox) {
    query += 'noBox=true&'
  }
  if (!vapp.showCar) {
    query += 'noCar=true&'
  }
  if (!vapp.showAirDrop) {
    query += 'noAirdrop=true&'
  }
  if (vapp.showItemFlags > 0) {
    query += `itemFlags=${vapp.showItemFlags}&`
  }
  axios.get(`/api/gamestate?${query}`).then(res => {
    if (res.data.gsTime !== appData.gsTime) { // means we got a new game start
      console.log('Seems we got a new game', res.data.gsTime, appData.gsTime)
      // refresh browser should be the safest way.
      if (!res.data.playbackState && appData.gsTime) { // refresh not okay for playback testing
        window.location.reload()
      }
      appData.gsTime = res.data.gsTime
      // set map
      vapp.$data.mapType = res.data.desert === true ? 'miramar' : 'erangel'
      // reset state
      appData.me = [-1, -1, 0, 0]
      appData.meGuid = -1
      appData.safe = [-1, -1, 0]
      appData.poison = [-1, -1, 0]

      appData.showingPlayers.clear()
      appData.playerFeatures.clear()

      appData.showingAPawns.clear()
      appData.apawnFeatures.clear()

      appData.showingItems.clear()
      appData.itemFeatures.clear()

      playerSource.clear()
      apawnSource.clear()
      itemSource.clear()
    }
    if (res.data.me) {
      appData.me = res.data.me
    }
    if (res.data.meGuid) {
      appData.meGuid = res.data.meGuid
    }
    if (res.data.displayPlayers) { // [ [guid, player], [guid, player], [guid, player]]
      appData.showingPlayers = new Map([...res.data.displayPlayers])
    }
    if (res.data.displayAPawns) { // [ [guid, apawn], [guid, apawn] ]
      appData.showingAPawns = new Map([...res.data.displayAPawns])
    }
    if (res.data.displayItems) { // [ [guid, item], [guid, item]]
      appData.showingItems = new Map([...res.data.displayItems])
    }
    vapp.$data.lastPacketTime = res.data.sTime ?
      (new Date(res.data.sTime - 420 * 60000)).toISOString().slice(0, -1).slice(11) :
      ''
    vapp.$data.gameStartTime = appData.gsTime ?
      (new Date(appData.gsTime - 420 * 60000)).toISOString().slice(0, -1).slice(11) :
      ''
    if (res.data.safe) {
      appData.safe = res.data.safe
    }
    if (res.data.poison) {
      appData.poison = res.data.poison
    }
    renderMap()
  })
}
// End of functions

// Let's start
showMap(false)
setTimeout(updatePlayerLocs, appData.refreshInterval)

// testing testing
// appData.showingPlayers.set(1, { loc: [1000, 1000, 0, 270] })
// appData.showingPlayers.set(2, { loc: [2000, 2000, 0, 270] })
