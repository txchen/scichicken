// download data from pubgmap.io
const axios = require('axios')
const fs = require('fs')

const dataMap = {
  'erangel-info.json': 'https://api.pubgmap.io/maps/erangel',
  'erangel-garages.json': 'https://api.pubgmap.io/maps/erangel/layers/garages',
  'erangel-vehicle.json': 'https://api.pubgmap.io/maps/erangel/layers/vehicle_spawns',
  'erangel-boat.json': 'https://api.pubgmap.io/maps/erangel/layers/boat_spawns',
  'erangel-loot.json': 'https://api.pubgmap.io/maps/erangel/layers/loot_heatmap',

  'miramar-info.json': 'https://api.pubgmap.io/maps/miramar',
  'miramar-vehicle.json': 'https://api.pubgmap.io/maps/miramar/layers/vehicle_spawns',
  'miramar-offroad.json': 'https://api.pubgmap.io/maps/miramar/layers/offroad',
  'miramar-boat.json': 'https://api.pubgmap.io/maps/miramar/layers/boat_spawns',
  'miramar-loot.json': 'https://api.pubgmap.io/maps/miramar/layers/loot_heatmap',
}
const fileBase = './static/data'

async function main () {
  for (const key in dataMap) {
    process.stdout.write(`Downloading ${dataMap[key]} to ${fileBase}/${key} `)
    let response = null
    try {
      response = await axios.get(dataMap[key], { responseType: 'arraybuffer' })
      fs.writeFileSync(`${fileBase}/${key}`, response.data)
      console.log(' - OK!')
    } catch (err) {
      console.log(' - failed!', err.message)
    }
  }
}

main().catch(err => {
  console.log('unexpected error', err)
  cleanup.then(() => {
    process.exit(2)
  })
})
