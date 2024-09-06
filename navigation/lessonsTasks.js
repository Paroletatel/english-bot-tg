import {stageManager} from "../config/config.js";
import {createVideo} from "../taskSolvers/video.js";
import {createRightOne} from "../taskSolvers/rightOne.js";
import {createRepeat, createSpeechRecognition} from "../taskSolvers/speachRecognition.js";
import {createTranslate} from "../taskSolvers/translate.js";

export async function lessonTask(bot, chatId, text) {
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
        await createRightOne(chatId, task);
    }
}