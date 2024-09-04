import dotenv from 'dotenv';
import TelegramApi from 'node-telegram-bot-api';
import axios from 'axios';
import request from 'request-promise';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import fsExists from 'fs.promises.exists';
import OpenAI from 'openai';
import HttpsProxyAgent from 'https-proxy-agent';
import dedent from 'dedent';
import { State } from './state.js';
import { fileURLToPath } from 'url';
dotenv.config();

const token = process.env.BOT_TOKEN;
const yandexToken = process.env.YANDEX_TOKEN;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const httpsAgent = new HttpsProxyAgent({
    host: '45.141.185.132',
    port: '5914',
    auth: 'user95700:qkpa03',
})
const openAi = new OpenAI({
    apiKey: process.env.API_KEY,
    httpAgent: httpsAgent,
});


const __filename = fileURLToPath(import.meta.url);

// Получаем путь к каталогу
const directory = path.dirname(__filename);
const bot = new TelegramApi(token, {polling: true})
let counter = 5
const stageManager = new State();


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
            await stageManager.setUserState(chatId)
            await unitList(bot, chatId)
        }
    },
    'Выбор Урока': {
        unitNum: (x)=>{return x > 0},
        lessonNum: (x)=>{return x > 0},
        taskNumber: (x)=>{return x === null},
        fun: async (bot, chatId, unitNum)=>{
            await stageManager.setUserState(chatId, unitNum)
            await selectUnit(bot, chatId, `${unitNum}.`)
        }
    }
}


const start = () => {
    bot.on('channel_post', async (msg) => {
        const chatId = msg.chat.id;

        if (msg.video) {
            try {
                const filePath = await bot.downloadFile(msg.video.file_id, './');
                const inputFilePath = path.resolve(filePath);
                const outputFilePath = `${inputFilePath}_converted.mp4`;

                ffmpeg.ffprobe(inputFilePath, async (err, metadata) => {
                    if (err) {
                        throw err;
                    }

                    const hasH264 = metadata.streams.some((stream) =>
                        stream.codec_name === 'h264' && stream.codec_type === 'video');

                    if (!hasH264) {
                        await convertVideoToH264(inputFilePath, outputFilePath);

                        await bot.sendMessage(chatId, `Видео сконвертировано, перешлите его в этот канал для получения id\n⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️`);
                        await bot.sendVideo(chatId, outputFilePath);

                        fs.unlinkSync(inputFilePath);
                        fs.unlinkSync(outputFilePath);
                    } else {
                        const videoFileId = msg.video.file_id;
                        bot.sendMessage(chatId, `${videoFileId}`);

                        fs.unlinkSync(inputFilePath);
                    }
                });
            } catch (error) {
                console.error('Ошибка обработки видео:', error);
                bot.sendMessage(chatId, 'Произошла ошибка при обработке видео.');
            }
        }
    });
    bot.setMyCommands([
        {command: '/start', description: 'Познакомиться'},
    ])
    bot.on('voice', async msg => {
        const chatId = msg.chat.id
        const user = await stageManager.getUserState(chatId)

        const fileLink = await bot.getFileLink(msg.voice.file_id)

        const text = await recognizeSpeech(fileLink)

        if(typeof text != "string"){
            return bot.sendMessage(chatId, `Ошибка:\n${text.message}`)
        }

        if((user? user.taskNumber : user)){
            return solveTask(chatId, text, bot)
        }
    })

    bot.on('message', async msg => {
        
        const text = msg.text
        const chatId = msg.chat.id
        const user = await  stageManager.getUserState(chatId)


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
            if (text.slice(0, 1) !== '/' && (user? user.taskNumber : user)) {
                return solveTask(chatId, text, bot)
            }

            if (text.split(' ')[1] !== undefined && !isNaN(text.split(' ')[1].slice(0, 1))){
                if (user === undefined) return
                if(user.unitNum === null && text.split(' ')[0] === 'Unit'){
                    return selectUnit(bot, chatId, text.split(' ')[1])
                }
                if(user.lessonNum === null && text.split(' ')[0] === 'Lesson'){
                    return selectLesson(bot, chatId, text.split(' ')[1])
                }
                if(user.taskNumber === null && text.split(' ')[0] === 'Exercise'){
                    return lessonTask(bot, chatId, text.split(' ')[1])
                }
            }
        }


        return bot.sendMessage(chatId, 'Неверная команда')
    })
    bot.on('callback_query', async msg => {
        const data = msg.data
        const chatId = msg.message.chat.id
        const user = await stageManager.getUserState(chatId)
        const tasks = await stageManager.getTasks(user.lessonNum, user.unitNum)

        console.log(data)

        if (data === "/tasks") {
            if(tasks === undefined){
                return startMessage(bot, chatId)
            }
            return showTasks(chatId, tasks)
        }

        return bot.sendMessage(chatId, 'Неверно, попробуй еще раз)')
    })

    async function lessonTask(bot, chatId, text) {
        const taskNumber = Number(text.split(".")[0])
        const user = await stageManager.getUserState(chatId)

        await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, taskNumber)

        const arrTasks = await stageManager.getTasks(user.lessonNum, user.unitNum)

        const task = arrTasks.filter(item => item.taskNumber == taskNumber)[0]

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
            await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, taskNumber, 0)
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
        const user = await stageManager.getUserState(chatId)
        const arrTasks = await stageManager.getTasks(user.lessonNum, user.unitNum)

        const taskNumber = user.taskNumber
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
            var res = await solveSpeechRecognition(task.rightAnswer, text, task.taskText)
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
            await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, null)
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
            text: string //not empty!!!, in russian language
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

            let result;
            try {
                result = JSON.parse(message);
            } catch (e) {
                result = { res: false, text: "Ошибка в ответе искуственного интеллекта. Попробуйте ещё раз!" };
                console.log(result)
            }

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
    const user = await stageManager.getUserState(chatId)
        const rightAnswer = task.rightAnswer[stage]
        if (rightAnswer === asw) {
            if(stage === task.rightAnswer.length - 1){
                return {
                    res: true,
                    text: 'Верно!\nСупер, с этим покончено!'
                }
            }else{
                await bot.sendMessage(chatId, 'Верно!')
                await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, task.taskNumber, stage+1)
                await createVideo(chatId, task, stage+1)
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

    async function startMessage(bot, chatId){
        const startStudy = {
            reply_markup: JSON.stringify({
                keyboard: [
                    [{text: 'Список разделов'}],
                ]
            })
        }

        await stageManager.setUserState(chatId)

        try {
            await bot.sendSticker(chatId, 'https://tlgrm.eu/_/stickers/556/44c/55644c98-65e1-4e92-b22e-26c930f07378/8.webp'
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
                    [{text: await selectNavigateButton(chatId)}]
                ]

            })
        }

        return await bot.sendMessage(chatId, "Выбери unit!", buttons)
    }

    async function selectUnit(bot, chatId, text){
        const res = await axios.get(process.env.BE_URL+ '/lesson/all')
        const unitNum = Number(text.split(".")[0])
        const lessons = res.data.filter(item => item.unitNum === unitNum)

        await stageManager.setUserState(chatId, unitNum)

        const buttons = {
            reply_markup: JSON.stringify({
                keyboard:
                [
                    ...lessons.map(item => {
                        return [{text: `Lesson ${item.lessonNum}. ${item.lessonName}`}]
                    }),
                    [{text: await selectNavigateButton(chatId)}]
                ]

            })
        }


        return await bot.sendMessage(chatId, "Выбери урок!", buttons)
    }

    async function selectLesson(bot, chatId, text){
        const user = await stageManager.getUserState(chatId)
        const lessonNum = Number(text.split(".")[0])
        const unitNum = user.unitNum
        const tasks = await stageManager.getTasks(lessonNum, unitNum)
        await stageManager.setUserState(chatId, unitNum, lessonNum)
        await showTasks(chatId, tasks)

    }

    async function showTasks (chatId, tasks){
        const user = await stageManager.getUserState(chatId)
        await stageManager.setUserState(chatId, user.unitNum, user.lessonNum)

        const buttons = {
            reply_markup: JSON.stringify({
                keyboard:
                [
                    ...tasks.sort((a,b) => a.taskNumber - b.taskNumber)
                        .map(item => {
                        return [{text: `Exercise ${item.taskNumber}. ${item.taskName}`}]
                    }),
                    [{text: await selectNavigateButton(chatId)}]
                ]

            })
        }

        return await bot.sendMessage(chatId, "Выбери задание!", buttons)
    }


    async function selectNavigateButton(chatId){
    const user = await stageManager.getUserState(chatId)
        for(let [key, value] of Object.entries(navigationPanel)){
            if(user === undefined) return
            if(value.unitNum(user.unitNum) && value.lessonNum(user.lessonNum) && value.taskNumber(user.taskNumber)){
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

async function convertVideoToH264(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',  // Конвертация видео в H.264
                '-preset fast',  // Быстрый пресет
                '-crf 22'        // Константа качества (0 - наилучшее качество, 51 - наихудшее)
            ])
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
    });
}




start()
















