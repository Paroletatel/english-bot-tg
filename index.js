require('dotenv').config()
const TelegramApi = require('node-telegram-bot-api')
const token = process.env.BOT_TOKEN
const yandexToken = process.env.YANDEX_TOKEN
const axios = require('axios')
const request = require('request-promise')
const stringSimilarity = require("string-similarity");
const ft = require('flip-text')
const path = require('path')
const fs =  require('fs')
const fsExists = require('fs.promises.exists')
const OpenAI  = require('openai');
const HttpsProxyAgent = require('https-proxy-agent')
const dedent = require('dedent')

//process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const httpsAgent = new HttpsProxyAgent({
    host: '45.141.185.132',
    port: '5914',
    auth: 'user95700:qkpa03',
})
const openAi = new OpenAI({
    apiKey: process.env.API_KEY,
    httpAgent: httpsAgent,
});


const directory = path.dirname(require.main.filename)
const bot = new TelegramApi(token, {polling: true})
const arrUsers = {}
let counter = 5


const navigationPanel = {
    'В главное меню': {
        unitNum: (x)=>{return x === null},
        lessonNum: (x)=>{return x === null},
        taskNumber: (x)=>{return x === null},
        fun: startMessage
    },
    'Выбор Раздела': {
        unitNum: (x)=>{return x > 0},
        lessonNum: (x)=>{return x === null},
        taskNumber: (x)=>{return x === null},
        fun: async (bot, chatId)=>{
            await setUserState(chatId)
            unitList(bot, chatId)
        }
    },
    'Выбор Урока': {
        unitNum: (x)=>{return x > 0},
        lessonNum: (x)=>{return x > 0},
        taskNumber: (x)=>{return x === null},
        fun: async (bot, chatId)=>{
            await setUserState(chatId, arrUsers[chatId].unitNum)
            selectUnit(bot, chatId, `${arrUsers[chatId].unitNum}.`)
        }
    }
}


const start = () => {
    // getAllTasks()
    initUsers()

    bot.setMyCommands([
        {command: '/start', description: 'Познакомиться'},
    ])
    bot.on('voice', async msg => {
        const chatId = msg.chat.id
        const user = msg.from.username

        const fileLink = await bot.getFileLink(msg.voice.file_id)

        const text = await recognizeSpeech(fileLink)

        if(typeof text != "string"){
            return bot.sendMessage(chatId, `Ошибка:\n${text.message}`)
        }

        if((arrUsers[chatId]? arrUsers[chatId].taskNumber : arrUsers[chatId])){
            return solveTask(chatId, text, bot)
        }

        return  bot.sendMessage(chatId, `Вы сказали:\n${text}`)
    })

    bot.on('message', async msg => {
        
        const text = msg.text
        const chatId = msg.chat.id
        const user = msg.from.username
        //return


        if(Object.keys(msg).includes("voice")){
            return
        }

        if (text === '/start') {
            return startMessage(bot, chatId)
        }

        if (text === 'Список разделов') {
            return unitList(bot, chatId)
        }

        if(Object.keys(navigationPanel).includes(text)){
            return navigationPanel[text].fun(bot, chatId)
        }

        if(text !== undefined){
            if (text.slice(0, 1) !== '/' && (arrUsers[chatId]? arrUsers[chatId].taskNumber : arrUsers[chatId])) {
                return solveTask(chatId, text, bot)
            }

            if (text.split(' ')[1] !== undefined && !isNaN(text.split(' ')[1].slice(0, 1))){
                if (arrUsers[chatId] === undefined) return
                if(arrUsers[chatId].unitNum === null && text.split(' ')[0] === 'Unit'){
                    return selectUnit(bot, chatId, text.split(' ')[1])
                }
                if(arrUsers[chatId].lessonNum === null && text.split(' ')[0] === 'Lesson'){
                    return selectLesson(bot, chatId, text.split(' ')[1])
                }
                if(arrUsers[chatId].taskNumber === null && text.split(' ')[0] === 'Exercise'){
                    return lessonTask(bot, chatId, text.split(' ')[1])
                }
            }
        }


        return bot.sendMessage(chatId, 'Неверная команда')
    })
    bot.on('callback_query', async msg => {
        const data = msg.data
        const chatId = msg.message.chat.id
        const user = msg.from.username

        // return

        console.log(data)

        if (data === "/tasks") {
            if(arrUsers[chatId].arrTasks === undefined){
                return startMessage(bot, chatId)
            }
            // await getAllTasks()
            return showTasks(chatId, arrUsers[chatId].arrTasks)
        }
        // if (data.slice(0, 1) !== '/') {
        //     return createTask(bot, chatId, data)
        // }

        return bot.sendMessage(chatId, 'Неверно, попробуй еще раз)')
    })

    // function createTasksButtons() {
    //
    //     const arrTasksButtons = []
    //
    //     for (let i = 0; i < arrTasks.length; i++) {
    //         arrTasksButtons[i] = [{text: arrTasks[i].taskNumber, callback_data: arrTasks[i].taskNumber}]
    //     }
    //
    //     const buttonsTasks = {
    //         reply_markup: JSON.stringify({
    //             inline_keyboard: arrTasksButtons
    //         })
    //     }
    //     return buttonsTasks
    // }

    async function lessonTask(bot, chatId, text) {
        const taskNumber = Number(text.split(".")[0])

        setUserState(chatId, arrUsers[chatId].unitNum, arrUsers[chatId].lessonNum, taskNumber)

        const arrTasks = arrUsers[chatId].arrTasks

        const task = arrTasks.filter(item => item.taskNumber == taskNumber)[0]
        // return
        const taskType = task.type

        const returnButtons = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{text: 'Список заданий', callback_data: "/tasks"}],
                ]
            })
        }

        await bot.sendMessage(chatId, `Задание №${taskNumber}`, returnButtons)


        if(taskType === 'the_video'){
            await bot.sendMessage(chatId, task.taskType)
            await setUserState(chatId, arrUsers[chatId].unitNum, arrUsers[chatId].lessonNum, taskNumber, 0)
            await createVideo(chatId, task, 0)
        }
        if(taskType === 'the_translate'){
            await bot.sendMessage(chatId, task.taskType, 
                {
                    reply_markup: JSON.stringify({remove_keyboard: true})
                }
            )
            await createTranslate(chatId, task)
        }
        if(taskType === 'the_repeat'){
            await bot.sendMessage(chatId, task.taskType, 
                {
                    reply_markup: JSON.stringify({remove_keyboard: true})
                }
            )
            await createRepeat(chatId, task)
        }
        if(taskType === 'the_speech_recognition'){
            await bot.sendMessage(chatId, task.taskType, 
                {
                    reply_markup: JSON.stringify({remove_keyboard: true})
                }
            )
            await createSpeechRecognition(chatId, task)
        }
        if(taskType === 'the_right_one'){
            await bot.sendMessage(chatId, task.taskType)
            await createRightOne(chatId, task)
        }
    }

    async function solveTask(chatId, text, bot){
        const arrTasks = arrUsers[chatId].arrTasks

        const taskNumber = arrUsers[chatId].taskNumber
        const task = arrTasks.filter(item => item.taskNumber == taskNumber)[0]
        const taskType = task.type

        if(taskType === 'the_video'){
            const stage = arrUsers[chatId].stage
            var res = await solveVideo(chatId, task, text, stage)
        }

        if(taskType === 'the_translate'){
            var res = await solveTranslate(task.rightAnswer, text)
        }

        if(taskType === 'the_repeat'){
            var res = await solveSpeechRecognition(task.rightAnswer, text)
        }

        if(taskType === 'the_speech_recognition'){
            var res = await solveSpeechRecognition(task.rightAnswer, text, task.taskText)
        }

        if(taskType === 'the_right_one'){
            var res = await solveRightOne(task.rightAnswer, text)
        }

        if(res.res){
            await bot.sendMessage(chatId, res.text, {
                reply_markup: JSON.stringify({
                    remove_keyboard: true
                })
            })
            await setUserState(chatId, arrUsers[chatId].unitNum, arrUsers[chatId].lessonNum, null)
            return bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/04b/607/04b60777-fa2d-3852-9086-a52e95fc223b/3.webp', {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: 'Список заданий', callback_data: "/tasks"}],
                    ]
                })
            })}
        return res.text? bot.sendMessage(chatId, res.text) : null
        }
    }

    async function solveRightOne(rightAnswer, asw) {
        if (rightAnswer === asw) {
            return {
                res: true,
                text: 'Верно!'
            }
        }
        return {
            res: false,
            text: 'Неверно, поробуйте еще раз)'
        }
    }

    async function createRightOne(chatId, task) {
        const arrAnswers = []
        for (let i = 0; i < task.taskAnswers.length; i++) {
            arrAnswers[i] = [{text: task.taskAnswers[i]}]
        }
        const buttonsAnswers = {
            reply_markup: JSON.stringify({
                keyboard: arrAnswers
                    .map(function(elem,index) { return [elem, Math.random()]})
                    .sort(function(a,b){ return a[1] - b[1]})
                    .map(function(elem){return elem[0]})
            })
        }
        await bot.sendMessage(chatId, task.taskText, buttonsAnswers)
    }

    async function solveSpeechRecognition(rightAnswer, asw, task) {
        const system = dedent`
        You are the best teacher of English for russian people

        At the entrance you will be given a transcription of the user's speech

        Your main task is compare [rightAnswer] with a answer of a user.
        
        Check the user's answer with the correct answer and give him a hint if the answer does not match.

        The answer must meet all standards of the English language

        #exercise: ${task}
        #rightAnswer: ${rightAnswer.replace(/[.,!?$%\^&\*;:{}=\-_`~()«»"'\[\]]/g, "")}

        return json

        response format:

        {
            res: boolean,
            text: string //not empty
        }

        VERY IMPORTANT
        - PUNCTUATION IS NOT A SUBJECT OF THE ASSESSMENT
        - DON'T SAY ANYTHING ABOUT PUNCTUATION
        - LOOK ONLY AT THE WORDS THEMSELVES
        `

        const res = await openAi.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {role: 'system', content: system},
                {role: "user", content: 'user said: ' + asw}
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7
        });
        
            const message = res.choices[0].message.content;
        
            // Попытаемся распарсить ответ как JSON
            let result;
            try {
                result = JSON.parse(message);
            } catch (e) {
                result = { res: false, text: "Ошибка в ответе искуственного интеллекта. Попробуйте ещё раз!" };
                console.log(result)
            }
        
            // Проверка на наличие необходимых полей в результате
            if (typeof result.res === 'boolean' && typeof result.text === 'string') {
                return result;
            } else {
                return { res: false, text: "Ошибка в формате ответа искуственного интеллекта. Попробуйте ещё раз!" };
            }
    }

    async function createSpeechRecognition(chatId, task){
        await bot.sendMessage(chatId, task.taskText)
    }

    async function createRepeat(chatId, task){
        // try {
        //     const response = await request.defaults({ encoding: null }).get(task.audio, {
        //         headers: {
        //             'Connection': 'keep-alive',
        //             'Accept-Encoding': '',
        //             'Accept-Language': 'en-US,en;q=0.8'
        //         }
        //     })
        //     await bot.sendMessage(chatId, task.taskText)
        //     await bot.sendVoice(chatId, response)
        // }
        // catch (error) {
        //     return Promise.reject(error);
        // }

        await bot.sendMessage(chatId, task.taskText)

        const voice = await getVoice(task.audio)

        await bot.sendVoice(chatId, voice)
    }

    async function solveTranslate(rightAnswers, userAnswer){
            const prompt = `Верни json! Ты - учитель английского языка для учеников говорящих на русском. У тебя есть несколько или один правильных переводов русской фразы на английский: [${rightAnswers.join(', ')}].\nПользователь перевел эту фразу как: "${userAnswer}".\nПроверь соответствует ли перевод пользователя хотя бы одному из верных переводов. Не называй правильный ответ целиком пока пользователь не переведет верно! При проверке учитывай правила английсткого языка: предложение должно быть составлено грамматически и лексически верно. Если перевод не соотносится ни с одним из верных или имеет ошибки, объясните почему и дайте подсказку, но не говорите полностью верный вариант а так же попроси его попробовать еще раз. А если перевод верный то скажи как еще можно перевести если для этого задания было несколько правильных вариантов\nВерните результат в формате JSON с полями "res" (true если перевод верный и false если нет) и "text" (пояснение для пользователя на русском языке, поясняй как учитель). Не возвращай ничего кроме json`;

        const res = await openAi.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {role: "user", content: prompt}
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7
        });
        
            const message = res.choices[0].message.content;
        
            // Попытаемся распарсить ответ как JSON
            let result;
            try {
                result = JSON.parse(message);
            } catch (e) {
                result = { res: false, text: "Ошибка в ответе искуственного интеллекта. Попробуйте ещё раз!" };
                console.log(result)
            }
        
            // Проверка на наличие необходимых полей в результате
            if (typeof result.res === 'boolean' && typeof result.text === 'string') {
                return result;
            } else {
                return { res: false, text: "Ошибка в формате ответа искуственного интеллекта. Попробуйте ещё раз!" };
            }
    }

    async function createTranslate(chatId, task){
        await bot.sendMessage(chatId, task.taskText)
    }

    async function solveVideo(chatId, task, asw, stage){
        const rightAnswer = task.rightAnswer[stage]
        if (rightAnswer === asw) {
            if(stage === task.rightAnswer.length - 1){
                return {
                    res: true,
                    text: 'Верно!\nСупер, с этим покончено!'
                }
            }else{
                await bot.sendMessage(chatId, 'Верно!')
                await setUserState(chatId, arrUsers[chatId].unitNum, arrUsers[chatId].lessonNum, task.taskNumber, stage+1)
                createVideo(chatId, task, stage+1)
                return {
                    res: false,
                    text: ''
                }
            }
        }
        return {
            res: false,
            text: 'Неверно, поробуйте еще раз)'
        }
    }

    async function createVideo(chatId, task, stage){
        const arrAnswers = []
        for (let i = 0; i < task.taskAnswers[stage].length; i++) {
            arrAnswers[i] = [{text: task.taskAnswers[stage][i]}]
        }
        const buttonsAnswers = {
            reply_markup: JSON.stringify({
                keyboard: arrAnswers
                    .map(function(elem,index) { return [elem, Math.random()]})
                    .sort(function(a,b){ return a[1] - b[1]})
                    .map(function(elem){return elem[0]})
            })
        }
        if(stage === 0){
            try {
                await bot.sendVideo(chatId, task.video)
                return bot.sendMessage(chatId, task.taskText.length > 1? task.taskText[stage] : task.taskText[0], buttonsAnswers)
            }
            catch (error) {
                return Promise.reject(error);
            }
        }else{
            return bot.sendMessage(chatId, task.taskText.length > 1? task.taskText[stage] : task.taskText[0], buttonsAnswers)
        }

    }

    async function recognizeSpeech(fileLink){
        try {
            const response = await request.defaults({ encoding: null }).get(fileLink)

            const url = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'
            try {
                const res = await axios.post(url, response, {
                    headers: {
                        Authorization: `Api-Key ${yandexToken}`,
                    },
                    params: {
                        lang: 'en-US',
                    }
                })

                return Promise.resolve(res.data.result)
            } catch (e) {
                console.log(e)
                return Promise.reject(e)
            }
        }
        catch (error) {
            return Promise.reject(error);
        }
    }

    async function setUserState(chatId, unitNum=null, lessonNum=null, taskNumber=null, stage = null) {
        const res = await axios.post(process.env.BE_URL+ '/user/'+chatId, {chatId: chatId, unitNum: unitNum, lessonNum: lessonNum, taskNumber: taskNumber, stage: stage})
        const user = res.data
        arrUsers[chatId] = {...arrUsers[chatId], ...{user: chatId, unitNum: user.unitNum, lessonNum: user.lessonNum,  taskNumber: user.taskNumber, stage: user.stage}}
    }

    // async function getAllTasks() {
    //     // if(counter >= 5){
    //     //     counter = 0
    //         const res = await axios.get(process.env.BE_URL+ '/exercise/all')
    //         arrTasks = res.data
    //         return
    //     // }
    //     // counter++
    // }

    async function initUsers() {
        const res = await axios.get(process.env.BE_URL+ '/user/all')
        for(const user of res.data){
            arrUsers[user.chatId] = {user: user.chatId, taskNumber: res.data.taskNumber, stage: res.data.stage}
        }
    }

    async function startMessage(bot, chatId){
        const startStudy = {
            reply_markup: JSON.stringify({
                keyboard: [
                    [{text: 'Список разделов'}],
                ]
            })
        }

        setUserState(chatId)

        try {
            await bot.sendSticker(chatId, 'https://tlgrm.eu/_/stickers/556/44c/55644c98-65e1-4e92-b22e-26c930f07378/8.webp'
                //     , {
                //     reply_markup: JSON.stringify({
                //         remove_keyboard: true
                //     })
                // }
                )
        } catch(e) {
            console.log('error')

        }
        
        return await bot.sendMessage(chatId, "Привет, я бот - учитель английского языка!", startStudy)
    }

    async function unitList(bot, chatId){
        const res = await axios.get(process.env.BE_URL+ '/lesson/all')

        const buttons = {
            reply_markup: JSON.stringify({
                keyboard:
                [
                    ...res.data.filter((x,i,a) => a.map(item => item.unitNum).indexOf(x.unitNum) === i).map(item => {
                        return [{text: `Unit ${item.unitNum}. ${item.unitName}`}]
                    })  ,
                    [{text: selectNavigateButton(chatId)}]
                ]

            })
        }

        return await bot.sendMessage(chatId, "Выбери unit!", buttons)
    }

    async function selectUnit(bot, chatId, text){
        const res = await axios.get(process.env.BE_URL+ '/lesson/all')
        const unitNum = Number(text.split(".")[0])
        const lessons = res.data.filter(item => item.unitNum === unitNum)

        await setUserState(chatId, unitNum)

        const buttons = {
            reply_markup: JSON.stringify({
                keyboard:
                [
                    ...lessons.map(item => {
                        return [{text: `Lesson ${item.lessonNum}. ${item.lessonName}`}]
                    }),
                    [{text: selectNavigateButton(chatId)}]
                ]

            })
        }


        return await bot.sendMessage(chatId, "Выбери урок!", buttons)
    }

    async function selectLesson(bot, chatId, text){
        const res = await axios.get(process.env.BE_URL+ '/exercise/all')
        const lessonNum = Number(text.split(".")[0])
        const unitNum = arrUsers[chatId].unitNum
        const tasks = res.data.filter(item => item.unitNum === unitNum && item.lessonNum === lessonNum)
        await setUserState(chatId, unitNum, lessonNum)
        showTasks(chatId, tasks)

    }

    async function showTasks (chatId, tasks){
        await setUserState(chatId, arrUsers[chatId].unitNum, arrUsers[chatId].lessonNum)

        const buttons = {
            reply_markup: JSON.stringify({
                keyboard:
                [
                    ...tasks.sort((a,b) => a.taskNumber - b.taskNumber)
                        .map(item => {
                        return [{text: `Exercise ${item.taskNumber}. ${item.taskName}`}]
                    }),
                    [{text: selectNavigateButton(chatId)}]
                ]

            })
        }

        arrUsers[chatId] = {...arrUsers[chatId], arrTasks: tasks}

        return await bot.sendMessage(chatId, "Выбери задание!", buttons)
    }


    function selectNavigateButton(chatId){
        for([key, value] of Object.entries(navigationPanel)){
            if(arrUsers[chatId] === undefined) return
            if(value.unitNum(arrUsers[chatId].unitNum) && value.lessonNum(arrUsers[chatId].lessonNum) && value.taskNumber(arrUsers[chatId].taskNumber)){
                return key
            }
        }
        return 'В главное меню'
    }


    async function getSpeechFromText(text) {

        const ssmlText = await useSSML(text)

        const url = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
        try {
            const res = await axios.get(url, {
                headers: {
                    Authorization: `Api-Key ${yandexToken}`,
                },
                params: {
                    // text: text,
                    lang: 'en-US',
                    format: 'mp3',
                    voice: 'john',
                    speed: 0.8,
                    ssml: ssmlText
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
        const file = path.join(wd, `/${text}`)

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




start()
















