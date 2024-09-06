import axios from "axios";
import {selectNavigateButton} from "./selectNavigateButton.js";

export async function unitList(bot, chatId){
    const res = await axios.get(process.env.BE_URL+ '/lesson/all')

    const buttons = {
        reply_markup: JSON.stringify({
            keyboard:
                [
                    ...res.data.filter((x,i,a) => a.map(item => item.unitNum).indexOf(x.unitNum) === i).map(item => {
                        return [{text: `Unit ${item.unitNum}. ${item.unitName}`}]
                    })  ,
                    [{text: await selectNavigateButton(chatId)}]
                ]

        })
    }

    return await bot.sendMessage(chatId, "Выбери unit!", buttons)
}