import {bot} from "../config/config.js";

export async function solveRightOne(rightAnswer, asw) {
    if (rightAnswer === asw) {
        return {
            res: true,
            text: 'Верно!'
        }
    }
    return {
        res: false,
        text: 'Неверно, поробуйте еще раз)'
    }
}

export async function createRightOne(chatId, task) {
    const arrAnswers = []
    for (let i = 0; i < task.taskAnswers.length; i++) {
        arrAnswers[i] = [{text: task.taskAnswers[i]}]
    }
    const buttonsAnswers = {
        reply_markup: JSON.stringify({
            keyboard: arrAnswers
                .map(function(elem,index) { return [elem, Math.random()]})
                .sort(function(a,b){ return a[1] - b[1]})
                .map(function(elem){return elem[0]})
        })
    }
    await bot.sendMessage(chatId, task.taskText, buttonsAnswers)
}