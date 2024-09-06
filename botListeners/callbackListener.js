
import {showTasks} from "../navigation/tasksList.js";
import {bot, stageManager} from "../config/config.js";
import {startMessage} from "../index.js";

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

    return bot.sendMessage(chatId, 'Неверно, попробуй еще раз)')
}