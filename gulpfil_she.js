const { series, parallel, src } = require('gulp')

const fs = require("fs")
const clean = require('gulp-clean')
const exec = require('child_process').execSync
const _ = require('lodash')
const iconv = require('iconv-lite')

const shpPath = {
  ctprvn: {
    source: 'src/CTPRVN/TL_SCCO_CTPRVN.shp',
    convert: 'src/CTPRVN/TL_SCCO_CTPRVN_CONVERT.shp',
    json: 'dist/ctprvn.json'
  },
  sig: {
    source: 'src/SIG/TL_SCCO_SIG.shp',
    convert: 'src/SIG/TL_SCCO_SIG_CONVERT.shp',
    json: 'dist/sig.json'
  },
  emd: {
    source: 'src/EMD/TL_SCCO_EMD.shp',
    convert: 'src/EMD/TL_SCCO_EMD_CONVERT.shp',
    json: 'dist/emd.json'
  }
}

const cleanShp = () => {
  console.log("cleanShp!!!!!!!!!!!!!")
  return src(['dist/*.json', 'src/**/*_CONVERT.*']).pipe(clean())
}
const mapshaperTask = (done) => {
  mapshaper('ctprvn')
  mapshaper('sig')
  mapshaper('emd')
  done()
}

const ogr2ogrTask = (done) => {
  ogr2ogr('ctprvn')
  ogr2ogr('sig')
  ogr2ogr('emd')
  done()
}

// 시군구 & 동 geojson 생성
const split = () => {
  splitGeojson('sig')
  splitGeojson('emd')
}

// Clean dist Dir
const cleanSplit = () => src(['dist/sig/*.json', 'dist/emd/*.json']).pipe(clean())

//---------------------------------------------------------

const mapshaper = (key) => {
  const mapshaperCommand = `mapshaper -i ${shpPath[key].source} encoding=euc-kr -simplify weighted 0.5% -o format=shapefile ${shpPath[key].convert}`

  exec(mapshaperCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }

    console.log(stdout)
    console.log(stderr)

    console.log('=> convert size')
    console.log('%s : %d bytes', shpPath[key].source, fs.statSync(shpPath[key].source).size)
    console.log('%s : %d bytes', shpPath[key].convert, fs.statSync(shpPath[key].convert).size)
    console.log('=>')
  })
}

const ogr2ogr = (key) => {
  //-lco COORDINATE_PRECISION=3
  const command = `ogr2ogr -f GeoJSON ${shpPath[key].json} ${shpPath[key].convert}`

  exec(command, function (error, stdout, stderr) {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }

    console.log(stdout)
    console.log(stderr)

    console.log('=> convert json size')
    console.log('%s : %d bytes', shpPath[key].json, fs.statSync(shpPath[key].json).size)
    console.log('=>')
  })
}

function splitGeojson(type) {
  console.log("\n *Split geoJSON START* \n")
  console.log(type)

  var fileName = shpPath[type].json
  //var exception = [ "47940" ]
  var exception = []

  // 시군구 데이터 sido 별로 자르기
  var contents = fs.readFileSync(fileName)
  var features = {}
  contents = iconv.decode(contents, 'utf-8')

  var jsonContent = JSON.parse(contents)
  

  for (var key in jsonContent.features) {
    var feature = jsonContent.features[key]
    var subKey, cd, name

    console.log('TEST!!!!', feature.properties)

    if (type == 'sig') {
      cd = feature.properties.SIG_CD
      name = feature.properties.SIG_KOR_NM
      subKey = feature.properties.SIG_CD.substr(0, 2)
    } else if (type == 'emd') {
      cd = feature.properties.EMD_CD
      name = feature.properties.EMD_KOR_NM
      subKey = feature.properties.EMD_CD.substr(0, 5)
    }

    console.log(`feature.properties.cd: ${cd}, feature.properties.name: ${name}`)

    if (features.hasOwnProperty(subKey)) {
      if (!_.has(exception, cd)) {
        features[subKey].push(feature)
      }
    } else {
      features[subKey] = []

      if (!_.has(exception, cd)) {
        features[subKey].push(feature)
      }
    }
  }

  for (var key in features) {
    var featuresCollection = _.template('{"type": "FeatureCollection", "features": [ \
                <% _.forEach(iterator, function(val, index, list) { %> \
                \n  <%= JSON.stringify(val) %><% \
                if (index < list.length - 1) { \
                %>, <% \
                } \
                }) %> \
            \n]}')

    var jsonStr = featuresCollection({
      'iterator': features[key]
    })

    // split json파일 생성
    fs.writeFileSync("dist/" + type + "/" + key + ".json", jsonStr)
  }

  console.log("\n *EXIT* \n")
}

// Default task to convert
// Gulp 4.0부터는 Task함수를 사용하기보다 일반 기명함수로 Task를 만들고, CommonJS 모듈 형식으로 내보내기를 권장한다.
// gulp.task('default', ['convert'])
exports.default = series(cleanShp, mapshaperTask, ogr2ogrTask, cleanSplit, split)