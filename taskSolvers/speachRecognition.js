import dedent from "dedent";
import request from "request-promise";
import { pipeline } from 'stream/promises';
import axios from "axios";
import path from "path";
import fsExists from "fs.promises.exists";
import fs from "fs";
import {bot, openAi, yandexToken} from "../config/config.js";
import {directory} from "../index.js";
import {createClient} from "@deepgram/sdk";

export async function solveSpeechRecognition(rightAnswer, asw, task) {
    const system = dedent`
        You are the best teacher of English for russian people

        At the entrance you will be given a transcription of the user's speech

        Your main task is compare [rightAnswer] with a answer of a user.
        
        Check the user's answer with the correct answer and give him a hint if the answer does not match. Always explain what was a mistake.

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

    try {
        await bot.sendVoice(chatId, voice);
    } catch (e) {
        console.error(e)
        await bot.sendMessage(chatId, 'Не удалось отправить вам голосовое сообщение. Возможно вы ограничили возможность отправки вам голосовых сообщений')
    }
}

export async function recognizeSpeech(fileLink){
    try {
        // const response = await request.defaults({ encoding: null }).get(fileLink)
        //
        // const url = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'
        // try {
        //     const res = await axios.post(url, response, {
        //         headers: {
        //             Authorization: `Api-Key ${yandexToken}`,
        //         },
        //         params: {
        //             lang: 'en-US',
        //         }
        //     })
        //
        //     return Promise.resolve(res.data.result)
        // } catch (e) {
        //     console.log(e)
        //     return Promise.reject(e)
        // }
        const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
        const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
            {
                url: fileLink,
            },
            {
                model: "general",
                punctuate: false,
                profanity_filter: false,
                smart_format: false,
                tier: 'base',
            }
        );

        if (error) {
            console.error(error);
            return null;
        }
        if (!error) return result.results.channels[0].alternatives[0].transcript;
    }
    catch (error) {
        return error;
    }
}

export async function getSpeechFromText(text) {

    try {
        const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
        const response = await deepgram.speak.request(
            { text },
            {
                model: 'aura-athena-en', // Указываем модель
                encoding: 'mp3',
            }
        );

        const stream = await response.getStream();
        if (stream) {
            return await stream2buffer(stream);
        } else {
            console.error('Error generating audio');
        }
    } catch (e) {
        console.log(e)
        return e
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

    const reader = stream.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const dataArray = chunks.reduce(
        (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
        new Uint8Array(0)
    );

    return Buffer.from(dataArray.buffer);
}

export async function getVoice(text){
    const wd = path.join(directory, 'voice')
    const filePath = path.join(wd, `${text}.mp3`);

    if (!await fs.promises.stat(filePath).then(() => true).catch(() => false)) {
        await fs.promises.mkdir(wd, { recursive: true });

        // Получаем аудио через API Deepgram в формате MP3
        const buffer = await getSpeechFromText(text);

        // Сохраняем MP3 файл
        await fs.promises.writeFile(filePath, buffer);
    }

    // Читаем MP3 файл и отправляем его через Telegram
    return filePath//await fs.promises.readFile(filePath);
}