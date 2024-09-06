import {bot} from "../config/config.js";
import path from "path";
import ffmpeg from "ffmpeg";


export async function chanellListener(chatId, video) {
    const filePath = await bot.downloadFile(msg.video.file_id, './');
    const inputFilePath = path.resolve(filePath);
    const outputFilePath = `${inputFilePath}_converted.mp4`;

    ffmpeg.ffprobe(inputFilePath, async (err, metadata) => {
        if (err) {
            throw err;
        }

        const hasH264 = metadata.streams.some((stream) =>
            stream.codec_name === 'h264' && stream.codec_type === 'video');

        if (!hasH264) {
            await convertVideoToH264(inputFilePath, outputFilePath);

            await bot.sendMessage(chatId, `Видео сконвертировано, перешлите его в этот канал для получения id\n⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️`);
            await bot.sendVideo(chatId, outputFilePath);

            fs.unlinkSync(inputFilePath);
            fs.unlinkSync(outputFilePath);
        } else {
            const videoFileId = msg.video.file_id;
            await bot.sendMessage(chatId, `${videoFileId}`);

            fs.unlinkSync(inputFilePath);
        }
    });
}

async function convertVideoToH264(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',  // Конвертация видео в H.264
                '-preset fast',  // Быстрый пресет
                '-crf 22'        // Константа качества (0 - наилучшее качество, 51 - наихудшее)
            ])
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
    });
}
