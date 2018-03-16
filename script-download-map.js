// download tiled map png from pubgmap.io
const readline = require('readline')
const axios = require('axios')
const fs = require('fs')
const mkdirp = require('mkdirp')

// example: https://tiles1.pubgmap.net/maptiles/miramar/v3/5/31/31.png
const zooms = [0, 1, 2, 3, 4] // 5 might be too many
const baseurl = 'https://tiles3.pubgmap.net/maptiles' // tiles0-3 can be used, I think they are the same
const maps = ['elevation-erangel/v5', 'erangel/v10', 'miramar/v3', 'elevation-miramar/v2']
const downloadLoc = './static/maptiles'

async function downloadImage (map, z, x, y) {
  const pngUrl = `${baseurl}/${map}/${z}/${x}/${y}.png`
  process.stdout.write(`Try to download ${pngUrl}`)

  const downloadPath = `${downloadLoc}/${map}/${z}/${x}`
  mkdirp.sync(downloadPath)
  let response = null
  try {
    response = await axios.get(pngUrl, { responseType: 'arraybuffer' })
    fs.writeFileSync(`${downloadPath}/${y}.png`, response.data)
    console.log(' - OK!')
  } catch (err) {
    console.log(' - failed!', err.message)
  }
}

async function main () {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('Do you really want to download? (type `yes` to confirm) ', async (answer) => {
    if (answer !== 'yes') {
      console.log('okay byebye')
      process.exit(0)
    }
    for (const map of maps) {
      for (const zoom of zooms) {
        console.log(`== Processing zoom ${zoom} of map ${map}`)
        for (let x = 0; x < Math.pow(2, zoom); x++) {
          for (let y = 0; y < Math.pow(2, zoom); y++) {
            await downloadImage(map, zoom, x, y)
          }
        }
      }
    }
    process.exit(0)
  })
}

main().catch(err => {
  console.log('unexpected error', err)
  cleanup.then(() => {
    process.exit(2)
  })
})
