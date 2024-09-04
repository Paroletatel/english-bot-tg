import axios from "axios";


export class State {
    api
    constructor() {
        this.api = axios.create({
            baseURL: process.env.BE_URL,
        });
    }

    async setUserState(chatId, unitNum=null, lessonNum=null, taskNumber=null, stage = null) {
        const res = await this.api.post('/user/'+chatId, {chatId: chatId, unitNum: unitNum, lessonNum: lessonNum, taskNumber: taskNumber, stage: stage})
    }

    async getUserState(chatId) {
        const res = await this.api.get('/user/get/'+chatId)
        return res.data;
    }

    async getTasks(lessonNum, unitNum) {
        const res = await this.api.get('/exercise/all')
        return res.data.filter(item => item.unitNum === unitNum && item.lessonNum === lessonNum)
    }
}