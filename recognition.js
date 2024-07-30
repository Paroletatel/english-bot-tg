require('dotenv').config()

const yandexToken = process.env.YANDEX_TOKEN
const axios = require("axios");
const path = require("path");
const fsExists = require("fs.promises.exists");
const fs = require("fs");

const directory = path.dirname(require.main.filename)
const text = '**Мы** **открылись**!\n' +
    'Магазин Новоалександровского мясокомбината в **Вашем** районе.\n' +
    'Это всегда **свежее** мясо, **колбасы** и **мясные** **деликатесы**, а так же **продукция** из **индейки**.\n' +
    '**Всё** **напрямую** от производителя. Мы **сами** производим, доставляем и сами следим за свежестью **мяса** и наших продуктов.\n' +
    'Ждем **Вас** в нашем магазине по адресу улица Кирова 47. Остановка торговый центр Витта на территории рынка.\n' +
    'Вас ждёт **деггустация** нашей продукции и приятные цены как на **свежее** мясо, **так** и на готовую продукцию.\n' +
    'Продукция Новоалександровского мясокомбината! Чем натуральнее тем вкуснее.\n' +
    'Теперь и для **Вас** доступна **наша** продукция'


;(async () => {
    await getVoice(text)
})();




async function getSpeechFromText(text) {

    const ssmlText = await useSSML(text)

    const url = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
    try {
        const res = await axios.get(url, {
            headers: {
                Authorization: `Api-Key ${yandexToken}`,
            },
            params: {
                text: text,
                lang: 'ru-RU',
                format: 'mp3',
                voice: 'alena',
                emotion: 'good',
                speed: 1,
                // ssml: ssmlText,
                // tts: text
            },
            responseType: 'stream'
        })

        const stream = res.data

        return Promise.resolve(stream)
    } catch (e) {
        console.log(e)
        return Promise.reject(e)
    }
}

async function useSSML(text){
    const parts = text.split(/[!.?]/gm)
    return (
        `<speak>
            <s>
                ${parts.filter(item => item !== '').join('</s><s>')}
            </s>
        </speak>`
    )
}


async function stream2buffer(stream) {

    return new Promise((resolve, reject) => {

        const _buf = [];

        stream.on("data", (chunk) => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", (err) => reject(err));
    });
}

async function getVoice(text){
    const wd = path.join(directory, 'voice')
    const file = path.join(wd, `/manual`)

    if(!await fsExists(file)){
        await fs.promises.mkdir(file)
        const stream = await getSpeechFromText(text)
        const buffer = await stream2buffer(stream)

        await fs.promises.writeFile(path.join(file,'voice.mp3'), buffer)
        return buffer
    }else{
        const buffer = await fs.promises.readFile(path.join(file,'voice.mp3'))
        return buffer
    }
}