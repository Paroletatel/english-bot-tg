import {bot, stageManager} from "../config/config.js";

export async function solveVideo(chatId, task, asw, stage){
    const user = await stageManager.getUserState(chatId)
    const rightAnswer = task.rightAnswer[stage]
    if (rightAnswer === asw) {
        if(stage === task.rightAnswer.length - 1){
            return {
                res: true,
                text: 'Верно!\nСупер, с этим покончено!'
            }
        }else{
            await bot.sendMessage(chatId, 'Верно!')
            await stageManager.setUserState(chatId, user.unitNum, user.lessonNum, task.taskNumber, stage+1)
            await createVideo(chatId, task, stage+1)
            return {
                res: false,
                text: ''
            }
        }
    }
    return {
        res: false,
        text: 'Неверно, поробуйте еще раз)'
    }
}

export async function createVideo(chatId, task, stage){
    const arrAnswers = []
    for (let i = 0; i < task.taskAnswers[stage].length; i++) {
        arrAnswers[i] = [{text: task.taskAnswers[stage][i]}]
    }
    const buttonsAnswers = {
        reply_markup: JSON.stringify({
            keyboard: arrAnswers
                .map(function(elem,index) { return [elem, Math.random()]})
                .sort(function(a,b){ return a[1] - b[1]})
                .map(function(elem){return elem[0]})
        })
    }
    if(stage === 0){
        try {
            await bot.sendVideo(chatId, task.video)
            return bot.sendMessage(chatId, task.taskText.length > 1? task.taskText[stage] : task.taskText[0], buttonsAnswers)
        }
        catch (error) {
            return Promise.reject(error);
        }
    }else{
        return bot.sendMessage(chatId, task.taskText.length > 1? task.taskText[stage] : task.taskText[0], buttonsAnswers)
    }

}