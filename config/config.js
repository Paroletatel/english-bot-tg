import HttpsProxyAgent from "https-proxy-agent";
import OpenAI from "openai";
import TelegramApi from "node-telegram-bot-api";
import {startMessage} from "../index.js";
import {State} from "../state.js";
import dotenv from "dotenv";
import {selectUnit} from "../navigation/unitSelection.js";
import {unitList} from "../navigation/unitsList.js";
dotenv.config();

export const token = process.env.BOT_TOKEN;
export const yandexToken = process.env.YANDEX_TOKEN;


const httpsAgent = new HttpsProxyAgent({
    host: '45.141.185.132',
    port: '5914',
    auth: 'user95700:qkpa03',
})
export const openAi = new OpenAI({
    apiKey: process.env.API_KEY,
    httpAgent: httpsAgent,
});



export const bot = new TelegramApi(token, {polling: true})
export const stageManager = new State();


export const navigationPanel = {
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
        fun: async (bot, chatId)=>{
            const user = await stageManager.getUserState(chatId);
            await stageManager.setUserState(chatId, user.unitNum)
            await selectUnit(bot, chatId, `${user.unitNum}.`)
        }
    }
}