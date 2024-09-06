import {bot, stageManager} from "../config/config.js";
import {recognizeSpeech} from "../taskSolvers/speachRecognition.js";
import {solveTask} from "../taskSolvers/solveTasks.js";


export async function voiceListener(chatId, msg) {
    const user = await stageManager.getUserState(chatId)

    const fileLink = await bot.getFileLink(msg.voice.file_id)

    const text = await recognizeSpeech(fileLink)

    if(typeof text != "string"){
        return bot.sendMessage(chatId, `Ошибка:\n${text.message}`)
    }

    if((user? user.taskNumber : user)){
        return solveTask(chatId, text, bot)
    }
}