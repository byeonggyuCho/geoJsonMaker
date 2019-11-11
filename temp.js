const axios = require("axios");
const cheerio = require("cheerio"); 
const download = require("download"); 


const getParsingData = async (areaCode, theaterCode, date) => {
  const getTheaterData = async () => {
    try {
      return await axios.get(
        `http://www.gisdeveloper.co.kr/?p=2332`
      );
    } catch (error) {
      console.error(error);
    }
  };

  return getTheaterData()
    .then(html => {
      const ulList = {
        areaCode,
        theaterCode,
        date,
        dataList: []
      };
      const $ = cheerio.load(html.data);
      const $tableList = $('div.entry-content').find('table');


    /**
    var tr = table tbody tr
    var td_2= tr.next().next() //두번째 td
    var a = td_2.next()		//첫번째 aTag

    var addr = a.href
    
     */



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
            download(x, 'download'))
        ).then((rtn) => {
            console.log('all process is done');
        });


      return ulList;
    })
};

getParsingData();