import {stageManager} from "../config/config.js";
import {solveVideo} from "./video.js";
import {solveTranslate} from "./translate.js";
import {solveSpeechRecognition} from "./speachRecognition.js";
import {solveRightOne} from "./rightOne.js";

export async function solveTask(chatId, text, bot, listener=null){
    const user = await stageManager.getUserState(chatId)
    const arrTasks = await stageManager.getTasks(user.lessonNum, user.unitNum)

    const taskNumber = user.taskNumber
    const task = arrTasks.filter(item => item.taskNumber == taskNumber)[0]
    const taskType = task.type

    if(taskType === 'the_video'){
        const stage = user.stage
        var res = await solveVideo(chatId, task, text, stage)
    }

    if(taskType === 'the_translate'){
        var res = await solveTranslate(task.rightAnswer, text)
    }

    if(taskType === 'the_repeat'){
        if (listener === 'voice') var res = await solveSpeechRecognition(task.rightAnswer, text, task.taskText)
        else await bot.sendMessage(chatId, 'Отправьте голосовое сообщение')
    }

    if(taskType === 'the_speech_recognition'){
        if (listener === 'voice') var res = await solveSpeechRecognition(task.rightAnswer, text, task.taskText)
        else await bot.sendMessage(chatId, 'Отправьте голосовое сообщение')
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
        //await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, null)
        return bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/04b/607/04b60777-fa2d-3852-9086-a52e95fc223b/3.webp', {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [
                        {text: 'Список заданий', callback_data: "/tasks"},
                        {text: 'Следующее задание', callback_data: "/next"}
                    ],
                ]
            })
        })}
    return res.text? bot.sendMessage(chatId, res.text) : null
}
