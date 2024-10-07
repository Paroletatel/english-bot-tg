import {showTasks} from "../navigation/tasksList.js";
import {bot, stageManager} from "../config/config.js";
import {startMessage} from "../index.js";
import {unitList} from "../navigation/unitsList.js";
import {lessonTask} from "../navigation/lessonsTasks.js";

export async function callbackListener(data, chatId) {
    const user = await stageManager.getUserState(chatId)
    const tasks = await stageManager.getTasks(user.lessonNum, user.unitNum)

    console.log(data)

    if (data === "/tasks") {
        if (tasks === undefined) {
            return startMessage(bot, chatId)
        }
        return showTasks(chatId, tasks)
    }

    if (data === '/next') {
        const next = await stageManager.getNext(user.unitNum, user.lessonNum, user.taskNumber)
        if (!next) {
            bot.sendMessage(chatId, 'Поздравляю! Ты решил все задания!')
            await stageManager.setUserState(chatId);
            return unitList(bot, chatId)
        }
        await stageManager.setUserState(chatId, next.unitNum, next.lessonNum, next.taskNumber);
        return await lessonTask(bot, chatId, next.taskNumber);
    }

    return bot.sendMessage(chatId, 'Неверно, попробуй еще раз)')
}