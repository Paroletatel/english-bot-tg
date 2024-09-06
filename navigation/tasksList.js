import {selectNavigateButton} from "./selectNavigateButton.js";
import {bot, stageManager} from "../config/config.js";

export async function showTasks (chatId, tasks){
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