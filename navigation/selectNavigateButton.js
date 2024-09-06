import {navigationPanel, stageManager} from "../config/config.js";

export async function selectNavigateButton(chatId){
    const user = await stageManager.getUserState(chatId)
    for(let [key, value] of Object.entries(navigationPanel)){
        if(user === undefined) return
        if(value.unitNum(user.unitNum) && value.lessonNum(user.lessonNum) && value.taskNumber(user.taskNumber)){
            return key
        }
    }
    return 'В главное меню'
}