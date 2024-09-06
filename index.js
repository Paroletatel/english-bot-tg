import {chanellListener} from "./botListeners/chanellListener.js";
import {voiceListener} from "./botListeners/voiceListener.js";
import {messageListener} from "./botListeners/messageListener.js";
import {callbackListener} from "./botListeners/callbackListener.js";
import {bot, stageManager} from "./config/config.js";
import {fileURLToPath} from "url";
import path from "path";

export const __filename = fileURLToPath(import.meta.url);
export const directory = path.dirname(__filename);


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const start = () => {
    bot.on('channel_post', async (msg) => {
        const chatId = msg.chat.id;

        if (msg.video) {
            try {
                await chanellListener(chatId, msg.video)
            } catch (error) {
                console.error('Ошибка обработки видео:', error);
                await bot.sendMessage(chatId, 'Произошла ошибка при обработке видео.');
            }
        }
    });
    bot.setMyCommands([
        {command: '/start', description: 'Познакомиться'},
    ])
    bot.on('voice', async msg => {
        const chatId = msg.chat.id
        try {
            await voiceListener(chatId, msg)
        } catch (error) {
            console.log(error)
        }

    })

    bot.on('message', async msg => {

        const text = msg.text
        const chatId = msg.chat.id

        try {
            await messageListener(chatId, text, msg)
        } catch (error) {
            console.log(error)
        }

    })
    bot.on('callback_query', async msg => {
        const data = msg.data
        const chatId = msg.message.chat.id

        try {
            await callbackListener(data, chatId)
        } catch (error) {
            console.log(error)
        }

    })
}

export async function startMessage(bot, chatId){
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

start()
