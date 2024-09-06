import axios from "axios";
import {selectNavigateButton} from "./selectNavigateButton.js";
import {stageManager} from "../config/config.js";

export async function selectUnit(bot, chatId, text){
    const res = await axios.get(process.env.BE_URL+ '/lesson/all')
    const unitNum = Number(text.split(".")[0])
    const lessons = res.data.filter(item => item.unitNum === unitNum)

    await stageManager.setUserState(chatId, unitNum)

    const buttons = {
        reply_markup: JSON.stringify({
            keyboard:
                [
                    ...lessons.map(item => {
                        return [{text: `Lesson ${item.lessonNum}. ${item.lessonName}`}]
                    }),
                    [{text: await selectNavigateButton(chatId)}]
                ]

        })
    }


    return await bot.sendMessage(chatId, "Выбери урок!", buttons)
}