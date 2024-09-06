import {bot, openAi} from "../config/config.js";

export async function solveTranslate(rightAnswers, userAnswer){
    const prompt = `Верни json! Ты - учитель английского языка для учеников говорящих на русском. У тебя есть несколько или один правильных переводов русской фразы на английский: [${rightAnswers.join(', ')}].\nПользователь перевел эту фразу как: "${userAnswer}".\nПроверь соответствует ли перевод пользователя хотя бы одному из верных переводов. Не называй правильный ответ целиком пока пользователь не переведет верно! При проверке учитывай правила английсткого языка: предложение должно быть составлено грамматически и лексически верно. Если перевод не соотносится ни с одним из верных или имеет ошибки, объясните почему и дайте подсказку, но не говорите полностью верный вариант а так же попроси его попробовать еще раз. А если перевод верный то скажи как еще можно перевести если для этого задания было несколько правильных вариантов\nВерните результат в формате JSON с полями "res" (true если перевод верный и false если нет) и "text" (пояснение для пользователя на русском языке, поясняй как учитель). Не возвращай ничего кроме json`;

    const res = await openAi.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {role: "user", content: prompt}
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
    });

    const message = res.choices[0].message.content;

    let result;
    try {
        result = JSON.parse(message);
    } catch (e) {
        result = { res: false, text: "Ошибка в ответе искуственного интеллекта. Попробуйте ещё раз!" };
        console.log(result)
    }

    if (typeof result.res === 'boolean' && typeof result.text === 'string') {
        return result;
    } else {
        return { res: false, text: "Ошибка в формате ответа искуственного интеллекта. Попробуйте ещё раз!" };
    }
}

export async function createTranslate(chatId, task){
    await bot.sendMessage(chatId, task.taskText);
}