'use strict';

var fs = require("fs");

var gulp = require('gulp');

const clean = require('gulp-clean');
const { exec } = require('child_process');
const iconv = require('iconv-lite');

const shpPath = {
    ctprvn: {
        source: 'src/CTPRVN/TL_SCCO_CTPRVN.shp',
        convert: 'src/CONVERT/TL_SCCO_CTPRVN_CONVERT.shp',
        json: 'dist/ctprvn.json'
    },
    sig: {
        source: 'src/SIG/TL_SCCO_SIG.shp',
        convert: 'src/CONVERT/TL_SCCO_SIG_CONVERT.shp',
        json: 'dist/sig.json'
    },
    emd: {
        source: 'src/EMD/TL_SCCO_EMD.shp',
        convert: 'src/CONVERT/TL_SCCO_EMD_CONVERT.shp',
        json: 'dist/emd.json'
    }
}




const cleanShp = () => {
    return gulp
        .src(['dist/*.json', 'src/**/*_CONVERT.*'])
        .pipe(clean());
}


const convert = () => {
    for (var key in shpPath) {
        console.log('==========');

        mapshaper(key, shpPath[key].source);
    }
}



const cleanSplit = () => {
    if (!fs.existsSync('dist/sig')) {
        fs.mkdirSync('dist/sig');
    }

    if (!fs.existsSync('dist/emd')) {
        fs.mkdirSync('dist/emd');
    }

    return gulp
        .src(['dist/sig/*.json', 'dist/emd/*.json'])
        .pipe(clean());

}



function split() {

    // 시군구 geojson 생성
    splitGeojson('sig');

    // 동 geojson 생성
    splitGeojson('emd');

}



function mapshaper(key) {
    var command = 'mapshaper -i '
        + shpPath[key].source
        + ' encoding=euc-kr -simplify weighted 0.5% -o format=shapefile '
        + shpPath[key].convert;

    console.log(command);

    exec(command, function (error, stdout, stderr) {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }

        console.log(stdout);
        console.log(stderr);
        console.log('=> convert size')
        console.log('%s : %d bytes', shpPath[key].source, fs.statSync(shpPath[key].source).size);
        console.log('%s : %d bytes', shpPath[key].convert, fs.statSync(shpPath[key].convert).size);
        console.log('=>')

        ogr2ogr(key);
    });
}

// ogr2ogr -f GeoJSON -t_srs epsg:4326 dist/sig.json src/CONVERT/TL_SCCO_SIG_CONVERT.shp
function ogr2ogr(key) {
    var command = 'ogr2ogr -f GeoJSON -t_srs epsg:4326 '  //-lco COORDINATE_PRECISION=3
        + shpPath[key].json
        + ' ' + shpPath[key].convert;

    console.log("ogr2ogr :", command);

    exec(command, function (error, stdout, stderr) {
        if (error) {
            console.error(error.message);
            //console.error(`exec error: ${error}`);
            return;
        }

        console.log(stdout);
        console.log(stderr);
        console.log('=> convert json size')
        console.log('%s : %d bytes', shpPath[key].json, fs.statSync(shpPath[key].json).size);
        console.log('=>')
    });
}

function splitGeojson(type) {
    console.log("\n *Split geoJSON START* \n");
    console.log(type);

    var fileName = shpPath[type].json;
    var exception = [];

    // 시군구 데이터 sido 별로 자르기
    var contents = fs.readFileSync(fileName);
    var features = {};
    contents = iconv.decode(contents, 'utf-8');

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

        let iterator = features[key];
        let jsonStr = iterator.reduce((prev, cur, index, list) => {

            prev += JSON.stringify(cur);

            if (index < list.length - 1)
                prev += ", "

            return prev;

        }, "");


        // var featuresCollection = _.template('{"type": "FeatureCollection", "features": [ \
        //         <% _.forEach(iterator, function(val, index, list) { %> \
        //         \n  <%= JSON.stringify(val) %><% \
        //         if (index < list.length - 1) { \
        //         %>, <% \
        //         } \
        //         }); %> \
        //     \n]}');

        // var jsonStr = featuresCollection({
        //     'iterator': features[key]
        // });

        // split json파일 생성
        fs.writeFileSync("dist/" + type + "/" + key + ".json", jsonStr);
    }

    console.log("\n *EXIT* \n");
}



//exports.default = defaultTask
exports.build = gulp.series(cleanShp, convert, cleanSplit, split)