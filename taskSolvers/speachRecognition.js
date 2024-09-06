import dedent from "dedent";
import request from "request-promise";
import axios from "axios";
import path from "path";
import fsExists from "fs.promises.exists";
import fs from "fs";
import {bot, openAi, yandexToken} from "../config/config.js";
import {directory} from "../index.js";

export async function solveSpeechRecognition(rightAnswer, asw, task) {
    const system = dedent`
        You are the best teacher of English for russian people

        At the entrance you will be given a transcription of the user's speech

        Your main task is compare [rightAnswer] with a answer of a user.
        
        Check the user's answer with the correct answer and give him a hint if the answer does not match.

        The answer must meet all standards of the English language
        
        Upper or lower case doesnt meter. For example: right answer is [I am Anna], so it should be correct if user said [i am anna] or [I am anna] or [i am Anna]
        
        Words with "s" ending should be processed as correct even if they written with spase or \` or without. For example:
        right answer is [That\`s], so it should be correct if user said [that\`s] or [That s] or [THATS]

        #exercise: ${task}
        #rightAnswer: ${rightAnswer.replace(/[.,!?$%\^&\*;:{}=\-_`~()«»"'\[\]]/g, "")}

        return json

        response format:

        {
            res: boolean,
            text: string //not empty!!!, in russian language
        }

        VERY IMPORTANT
        - PUNCTUATION IS NOT A SUBJECT OF THE ASSESSMENT
        - DON'T SAY ANYTHING ABOUT PUNCTUATION
        - LOOK ONLY AT THE WORDS THEMSELVES
        `

    const res = await openAi.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {role: 'system', content: system},
            {role: "user", content: 'user said: ' + asw}
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
    });

    const message = res.choices[0].message.content;

    // Попытаемся распарсить ответ как JSON
    let result;
    try {
        result = JSON.parse(message);
    } catch (e) {
        result = { res: false, text: "Ошибка в ответе искусственного интеллекта. Попробуйте ещё раз!" };
        console.log(result)
    }

    // Проверка на наличие необходимых полей в результате
    if (typeof result.res === 'boolean' && typeof result.text === 'string') {
        return result;
    } else {
        return { res: false, text: "Ошибка в формате ответа искусственного интеллекта. Попробуйте ещё раз!" };
    }
}

export async function createSpeechRecognition(chatId, task){
    await bot.sendMessage(chatId, task.taskText)
}

export async function createRepeat(chatId, task){
    await bot.sendMessage(chatId, task.taskText)

    const voice = await getVoice(task.audio)

    await bot.sendVoice(chatId, voice)
}

export async function recognizeSpeech(fileLink){
    try {
        const response = await request.defaults({ encoding: null }).get(fileLink)

        const url = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'
        try {
            const res = await axios.post(url, response, {
                headers: {
                    Authorization: `Api-Key ${yandexToken}`,
                },
                params: {
                    lang: 'en-US',
                }
            })

            return Promise.resolve(res.data.result)
        } catch (e) {
            console.log(e)
            return Promise.reject(e)
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

export async function getSpeechFromText(text) {

    const ssmlText = await useSSML(text)

    const url = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
    try {
        const res = await axios.get(url, {
            headers: {
                Authorization: `Api-Key ${yandexToken}`,
            },
            params: {
                lang: 'en-US',
                format: 'mp3',
                voice: 'john',
                speed: 0.8,
                ssml: ssmlText
            },
            responseType: 'stream'
        })

        const stream = res.data

        return Promise.resolve(stream)
    } catch (e) {
        console.log(e)
        return Promise.reject(e)
    }
}

export async function useSSML(text){
    const parts = text.split(/[!.?]/gm)
    return (
        `<speak>
                <s>
                    ${parts.filter(item => item !== '').join('</s><s>')}
                </s>
            </speak>`
    )
}


export async function stream2buffer(stream) {

    return new Promise((resolve, reject) => {

        const _buf = [];

        stream.on("data", (chunk) => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", (err) => reject(err));
    });
}

export async function getVoice(text){
    const wd = path.join(directory, 'voice')
    const file = path.join(wd, `/${text}`)

    if(!await fsExists(file)){
        await fs.promises.mkdir(file)
        const stream = await getSpeechFromText(text)
        const buffer = await stream2buffer(stream)

        await fs.promises.writeFile(path.join(file,'voice.mp3'), buffer)
        return buffer
    }else{
        const buffer = await fs.promises.readFile(path.join(file,'voice.mp3'))
        return buffer
    }
}