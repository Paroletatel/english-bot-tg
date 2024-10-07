import {
    startMessage,
} from "../index.js";
import {lessonTask} from "../navigation/lessonsTasks.js";
import {bot, navigationPanel, stageManager} from "../config/config.js";
import {unitList} from "../navigation/unitsList.js";
import {selectUnit} from "../navigation/unitSelection.js";
import {selectLesson} from "../navigation/lessonSelection.js";
import {solveTask} from "../taskSolvers/solveTasks.js";

export async function messageListener(chatId, text, msg) {
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
            return solveTask(chatId, text, bot, 'text')
        }

        if (text.split(' ')[1] !== undefined && !isNaN(text.split(' ')[1].slice(0, 1))){
            if (user === undefined) return
            if(user.unitNum === null && text.split(' ')[0] === 'Unit'){
                return selectUnit(bot, chatId, text.split(' ')[1])
            }
            if(user.lessonNum === null && text.split(' ')[0] === 'Lesson'){
                return selectLesson(bot, chatId, text.split(' ')[1])
            }
            if(user.taskNumber === null && text.split(' ')[0] === 'Exercise') {
                return lessonTask(bot, chatId, Number(text.split(' ')[1].split(".")[0]));
            }
        }
    }


    return bot.sendMessage(chatId, 'Неверная команда')
}