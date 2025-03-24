import crmApi from "./crm-api.js";
import bigdataApi from "./bigdata-api.js";

export const analyticType = Object.freeze({
    Normal: 0,
    Deleted: 1,
    All: 2,
});

class Session {
    #periodsData;
    #projects;
    #deletedProjects;
    #RtkAnalytic;

    #clientInfo;
    #projectsConfig;

    constructor() {
        this.#periodsData = {};
        this.#RtkAnalytic = {};
        this.#projects = undefined;
        this.#deletedProjects = undefined;
        this.#clientInfo = undefined;
    }

    getAnalyticSliceName(from, to, deleted) {
        const fromFormated = crmApi.formatDate(from);
        const toFormated = crmApi.formatDate(to);

        return `start=${fromFormated}&end=${toFormated}${deleted ? "&type=deleted" : ""}`;
    }
    async #getAnalytic(from, to, deleted) {
        const sliceName = this.getAnalyticSliceName(from, to, deleted);

        if (!(sliceName in this.#periodsData)) {
            this.#periodsData[sliceName] = await crmApi.getAnalytic(sliceName);
        }

        return structuredClone(this.#periodsData[sliceName]);
    }

    async hasManagerAccess() {
        return await bigdataApi.hasManagerAccess();
    }

    *forEachDayAnalytic(startDate, endDate, deleted) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        while (start <= end) {
            yield session.getAnalytic(start, start, deleted);
            start.setDate(start.getDate() + 1);
        }
    }

    async getLimitPotential(date, userId = undefined) {
        if (userId === undefined)
            userId = (await this.getClient()).user_id;
        const formatedDate = crmApi.formatDate(date);
        const query = `date=${formatedDate}&user_id=${userId}`;

        if (!(query in this.#RtkAnalytic)) {
            const resp = await bigdataApi.getLimitPotential(query);

            if (!resp)
                throw new Error("Не могу получить аналитику РТК");

            this.#RtkAnalytic[query] = resp;
        }

        return this.#RtkAnalytic[query];
    }
    async getAnalytic(from, to, deleted) {
        return await this.#getAnalytic(from, to, deleted);
    }
    async getProjects(deleted) {
        if (deleted) {
            if (!this.#deletedProjects) {
                this.#deletedProjects = await crmApi.getProjects(true);
            }

            return this.#deletedProjects;
        } else {
            if (!this.#projects) {
                this.#projects = await crmApi.getProjects(false);
            }

            return this.#projects;
        }
    }

    async getClient() {
        if (!this.#clientInfo) {
            this.#clientInfo = await crmApi.getClient();
        }

        return this.#clientInfo;
    }
    async getProjectsConfig() {
        if (!this.#projectsConfig) {
            this.#projectsConfig = await crmApi.getProjectsConfig();
        }

        return this.#projectsConfig;
    }
}


const session = Object.freeze(new Session());
export default session;