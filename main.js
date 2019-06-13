const cheerio = require('cheerio')
const https = require('https')
const express = require('express')
const request = require('request')
const querystring = require('querystring')
const DomParser = require('dom-parser')
const parser = new DomParser()
const app = express()
const url = 'https://ecommerceportal.dhl.com/track/'

/* 本地开发时允许跨域 */
app.all('*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "X-Requested-With")
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS")
    res.header("X-Powered-By", ' 3.2.1')
    //这段仅仅为了方便返回json而已
    res.header("Content-Type", "application/json;charset=utf-8")
    if(req.method == 'OPTIONS') {
        //让options请求快速返回
        res.sendStatus(200)
    } else {     
        next()
    }
});


/* 获取FormData的ViewState字段 */
const getViewState = () => {
    return new Promise((resolve,reject) => {
        https.get(url,(res) => {
            let _page = ''
            let viewState = ''
            
            res.on('data',(conent) => {
                _page += conent
            })
        
            res.on('end',() => {
                //请求end后解析html
                let $ = cheerio.load(_page,{decodeEntities: false})
                viewState = $('#trackItNowForm').children().last().val()
                resolve(viewState)
            })
            
        })
    })
}

/* 查询物流信息 */
const getInfo = (state,number) => {
    return new Promise((resolve,reject) => {
        /* 请求的数据字段 */
        let data = {
            'javax.faces.partial.ajax':true,
            'javax.faces.source':'trackItNowForm:searchSkuBtn',
            'javax.faces.partial.execute':'@all',
            'javax.faces.partial.render':'trackItNowForm:searchSkuBtn trackItNowForm messages',
            'trackItNowForm:searchSkuBtn':'trackItNowForm:searchSkuBtn',
            'trackItNowForm':'trackItNowForm',
            'trackItNowForm:trackItNowSearchBox':number,
            'hiddenFocus':'',
            'trackItNowForm:faqAccordion_active':null,
            'trackItNowForm:country1_focus':'',
            'trackItNowForm:country1_input':0,
            'javax.faces.ViewState':state
        }

        let formData = querystring.stringify(data);

        request({
            url:url,
            headers: {
                'Accept':'application/xml, text/xml, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Faces-Request':'partial/ajax',
                'Origin':'https://ecommerceportal.dhl.com',
                'Referer':'https://ecommerceportal.dhl.com/track/',
                'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36',
                'X-Requested-With':'XMLHttpRequest'
            },
            body: formData,
            method: 'POST'
        }, (err, res, body) => {
            if (err) reject('error')
            let dom = parser.parseFromString(body)
            if(Boolean(dom.getElementsByTagName('error')[0])){
                reject('error')
            }else{
                let cbJson = {
                    'address':'',
                    'content':{}
                }
                /* 筛选数据 */
                let trackAddress = dom.getElementsByClassName('TrackingFromData')[2].innerHTML + ' - ' + dom.getElementsByClassName('TrackingFromData')[3].innerHTML
                cbJson.address = trackAddress
                let trackTime = dom.getElementsByClassName('timeline-delivered')[0].getElementsByTagName('li')
                let mainDate = ''
                for(let i = 0; i < trackTime.length; i++){
                    if(trackTime[i].attributes[0].value == 'timelineDate'){
                        mainDate = trackTime[i].getElementsByTagName('label')[0].innerHTML
                        cbJson.content[`${mainDate}`] = []
                    }else if(trackTime[i].attributes[0].value == 'Timeline-event'){
                        let time = trackTime[i].getElementsByTagName('span')[0].textContent,
                            place = trackTime[i].getElementsByClassName('timeline-unit')[0].getElementsByClassName('timeline-location')[0].childNodes[0].innerHTML,
                            info = trackTime[i].getElementsByClassName('timeline-unit')[0].getElementsByClassName('timeline-description')[0].childNodes[0].innerHTML
                        time = time.replace(/^\s+|\n|\r|\t/g,"")
                        time += '||' + place + '||' +info
                        cbJson.content[`${mainDate}`].push(time)
                        
                    }
                }
                resolve(cbJson)
            }
        });
    })
}

app.get('/get',async (req,res) => {
    let num = req.query.num
    try {
        let data = await getViewState()
        let result = await getInfo(data,num)
        res.send(result)
    }catch(err){
        res.send('error')
    }
})

app.listen(3235,() => {
    console.log('port on 3235')
})