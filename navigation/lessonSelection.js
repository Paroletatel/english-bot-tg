import {showTasks} from "./tasksList.js";
import {stageManager} from "../config/config.js";

export async function selectLesson(bot, chatId, text){
    const user = await stageManager.getUserState(chatId)
    const lessonNum = Number(text.split(".")[0])
    const unitNum = user.unitNum
    const tasks = await stageManager.getTasks(lessonNum, unitNum)
    await stageManager.setUserState(chatId, unitNum, lessonNum)
    await showTasks(chatId, tasks)

}