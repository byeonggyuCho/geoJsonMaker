'use strict';

const axios = require("axios");
const cheerio = require("cheerio"); 
const download = require("download"); 
const AdmZip = require('adm-zip');
const fs = require("fs");
const _ = require('lodash')

const gulp = require('gulp');
const clean = require('gulp-clean');
const { exec } = require('child_process');
const iconv = require('iconv-lite');


const downladPath = 'download'

const shpPath = {
    ctprvn: {
        source: 'src/rawData/TL_SCCO_CTPRVN.shp',
        convert: 'src/CONVERT/TL_SCCO_CTPRVN_CONVERT.shp',
        json: 'dist/ctprvn.json'
    },

    sig: {
        source: 'src/rawData/TL_SCCO_SIG.shp',
        convert: 'src/CONVERT/TL_SCCO_SIG_CONVERT.shp',
        json: 'dist/sig.json'
    },
    emd: {
        source: 'src/rawData/TL_SCCO_EMD.shp',
        convert: 'src/CONVERT/TL_SCCO_EMD_CONVERT.shp',
        json: 'dist/emd.json'
    }
}


const downloadMapData = async (done) => {
  const getRawData = async () => {
    try {
      return await axios.get(
        `http://www.gisdeveloper.co.kr/?p=2332`
      );
    } catch (error) {
      console.error(error);
    }
  };

  return getRawData()
    .then(html => {
      const $ = cheerio.load(html.data);
      const $tableList = $('div.entry-content').find('table');


    let result = [];
        
      $tableList.each((i,elem)=>{
            let tbdoy = elem.children[0];
            let trTag = tbdoy.next.children[0]
            let tdTag = trTag.children[3];
            let aTagList = tdTag.children.filter((item)=>{
                    return item.name === 'a'
            })
            let targetAddr = aTagList[0].attribs.href;

            result.push(targetAddr);
      })


        console.log("===================result========================");
        console.log(result);

        Promise.all(result.map(x => 
            download(x, downladPath))
        ).then((rtn) => {
            console.log('all process is done');
            done();
        });


    })
};




const decompressAll = (done) => {

   let targetFoler = "./"+downladPath;

   fs.readdir(targetFoler, (error, fileList)=>{

        if(error){
            console.error(error);
            return
        }
  
        fileList.forEach((fileName)=>{
            if(fileName.includes('.zip')){

                let fullPath = [targetFoler,"/",fileName].join("");
                decompress(fullPath);     //fullPath
            }
        })

        console.log('[task] decompess done')
        done();
   })

}

//압축풀기
const decompress = (filePath) => {

    console.log(filePath)
    const zip = new AdmZip(filePath)
    let zipEntries = zip.getEntries();
    zipEntries.forEach(zipEntry => {
        //파일쓰기.
        let content = zipEntry.getData()
        fs.writeFileSync(`src/rawData/${zipEntry.entryName}`,content);
    });
}




const cleanShp = (done) => {
    gulp.src(['dist/*.json', 'src/**/*_CONVERT.*'])
        .pipe(clean());

    done();
}


const convert =  function (done) {


    let keys = Object.keys(shpPath);

    console.log(keys);
/* 
    keys.forEach(async function(key){

        try{
            let path = shpPath[key].source
            let result = await mapshaper(key, path);

            await ogr2ogr(result);

        }catch(e){
            console.error(e);
        }

    })

    console.log('[task] convert is done')
    done(); */

    return Promise.all(keys.map( key => 
        mapshaper(key, shpPath[key].source)
        .then(ogr2ogr)
        .catch(e=>{
            console.error(e);
        })
    ))
    .then((rtn) => {
        console.log(`[task] convert is done`);
        done();
    });
}



const cleanSplit = (done) => {
    if (!fs.existsSync('dist/sig')) {
        fs.mkdirSync('dist/sig');
    }

    if (!fs.existsSync('dist/emd')) {
        fs.mkdirSync('dist/emd');
    }

    gulp.src(['dist/sig/*.json', 'dist/emd/*.json'])
        .pipe(clean());

    done();
}



function split(done) {

    // 시군구 geojson 생성
    splitGeojson('sig');

    // 동 geojson 생성
    splitGeojson('emd');


    done();
    console.log('[task] split done')
}



function mapshaper(key) {


    return new Promise((resolve,reject)=>{

        console.log(`mapshaper key == ${key}`)

        let {source,convert} = shpPath[key]; 

        var command = `mapshaper -i ${source}  encoding=euc-kr -simplify weighted 0.5% -o format=shapefile ${convert}`;
            // + shpPath[key].source
            // + ''
            // + shpPath[key].convert;
    
        console.log(command);
    
        exec(command,  (error, stdout, stderr) => {
            if (error) {
               // console.error(`exec error: ${error}`);
                reject(error);
                return;
            }
    
            console.log(stdout);
            console.log(stderr);
            console.log('=> convert size')
            console.log('%s : %d bytes', shpPath[key].source, fs.statSync(shpPath[key].source).size);
            console.log('%s : %d bytes', shpPath[key].convert, fs.statSync(shpPath[key].convert).size);
            
            resolve(key);
            // ogr2ogr(key);
        });
    }).catch(e=>{
        console.error(e);
    })

}

// ogr2ogr -f GeoJSON -t_srs epsg:4326 dist/sig.json src/CONVERT/TL_SCCO_SIG_CONVERT.shp
function ogr2ogr(key) {

    let {json, convert} = shpPath[key];

    var command = `ogr2ogr -f GeoJSON -t_srs epsg:4326 ${json} ${convert}`  //-lco COORDINATE_PRECISION=3
       // + shpPath[key].json
        //+ ' ' + shpPath[key].convert;

    console.log("ogr2ogr :", command);

    return new Promise((resolve,reject)=>{
        
        exec(command,  (error, stdout, stderr) => {
            if (error) {
                console.error(error.message);
                reject(error);
                //console.error(`exec error: ${error}`);
                return;
            }

            console.log(stdout);
            console.log(stderr);
            console.log('=> convert json size')
            console.log('%s : %d bytes', shpPath[key].json, fs.statSync(shpPath[key].json).size);
            resolve("ogr2ogr done");
        });

    }).catch(e=>{
        console.error(e);
    })

}

function splitGeojson(type) {
    console.log("\n *Split geoJSON START* \n");
    console.log(type);

    var fileName = shpPath[type].json;
    var exception = [];

    // 시군구 데이터 sido 별로 자르기
    var contents = fs.readFileSync(fileName);
    var features = {};
    contents = iconv.decode(contents, 'euc-kr');

    var jsonContent = JSON.parse(contents);

    for (var key in jsonContent.features) {
        var feature = jsonContent.features[key];
        var subKey, cd, name;

        if (type == 'sig') {
            cd = feature.properties.SIG_CD;
            name = feature.properties.SIG_KOR_NM;
            subKey = feature.properties.SIG_CD.substr(0, 2);
        } else if (type == 'emd') {
            cd = feature.properties.EMD_CD;
            name = feature.properties.EMD_KOR_NM;
            subKey = feature.properties.EMD_CD.substr(0, 5);
        }

        console.log(`feature.properties.cd: ${cd}, feature.properties.name: ${name}`);

        if (features.hasOwnProperty(subKey)) {
            if (exception.includes(cd)) {
                features[subKey].push(feature);
            }
        } else {
            features[subKey] = [];

            if (exception.includes(cd)) {
                features[subKey].push(feature);
            }
        }
    }

    for (var key in features) {

        // let iterator = features[key];
        // let jsonStr = iterator.reduce((prev, cur, index, list) => {

        //     prev += JSON.stringify(cur);

        //     if (index < list.length - 1)
        //         prev += ", ";

        //     return prev;

        // }, "");


        var featuresCollection = _.template('{"type": "FeatureCollection", "features": [ \
                <% _.forEach(iterator, function(val, index, list) { %> \
                \n  <%= JSON.stringify(val) %><% \
                if (index < list.length - 1) { \
                %>, <% \
                } \
                }); %> \
            \n]}');

        var jsonStr = featuresCollection({
            'iterator': features[key]
        });

        // split json파일 생성
        fs.writeFileSync("dist/" + type + "/" + key + ".json", jsonStr);
    }

    console.log("\n *EXIT* \n");
}



exports.default = gulp.series(downloadMapData,decompressAll,cleanShp,convert,cleanSplit, split)
//exports.default = gulp.series(downloadMapData,decompressAll,cleanShp,convert)
exports.download = gulp.series(downloadMapData);
exports.decompress = gulp.series(decompressAll);
exports.convert = gulp.series(cleanShp, convert)
exports.split = gulp.series(cleanSplit, split)