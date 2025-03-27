import crmApi from "./crm-api.js";
import bigdataApi from "./bigdata-api.js";
import {DeepCache} from "../../lib/deep-cache.js";

class Session {
    #cache;

    constructor() {
        this.#cache = new DeepCache();
    }

    getAnalyticSliceName(from, to, deleted) {
        const fromFormated = crmApi.formatDate(from);
        const toFormated = crmApi.formatDate(to);

        return `start=${fromFormated}&end=${toFormated}${deleted ? "&type=deleted" : ""}`;
    }
    async #getAnalytic(from, to, deleted) {
        const sliceName = this.getAnalyticSliceName(from, to, deleted);

        return this.getAnalyticBySliceName(sliceName);
    }

    async getAnalyticBySliceName(sliceName) {
        console.log(sliceName);
        return this.#cache.get(
            `analytic_${sliceName}`,
            () => crmApi.getAnalytic(sliceName),
        );
    }

    async getManagerInfo() {
        return this.#cache.get(
            'manager_info',
            () => bigdataApi.getManagerInfo(),
        );
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
        const actualUserId = userId ?? (await this.getClient()).user_id;
        const formatedDate = crmApi.formatDate(date);
        const query = `date=${formatedDate}&user_id=${actualUserId}`;

        return this.#cache.get(
            `rtk_analytic_${query}`,
            async () => {
                const resp = await bigdataApi.getLimitPotential(query);
                if (!resp) throw new Error("Cant load RTK analytic");
                return resp;
            },
        );
    }
    async getAnalytic(from, to, deleted) {
        return await this.#getAnalytic(from, to, deleted);
    }
    async getProjects(deleted) {
        const cacheKey = deleted ? 'deleted_projects' : 'active_projects';
        return this.#cache.get(
            cacheKey,
            () => crmApi.getProjects(deleted),
        );
    }

    async getClient() {
        return this.#cache.get(
            'client_info',
            () => crmApi.getClient(),
        );
    }
    async getProjectsConfig() {
        return this.#cache.get(
            'projects_config',
            () => crmApi.getProjectsConfig(),
        );
    }
}


const session = Object.freeze(new Session());
export default session;