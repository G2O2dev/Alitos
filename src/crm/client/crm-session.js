import crmApi from "./crm-api.js";
import bigdataApi from "./bigdata-api.js";
import {DeepCache} from "../../lib/deep-cache.js";
import bigdataSession from "./bigdata-session.js";

class CrmSession {
    #cache;

    static CACHE_PREFIX_PROJECTS_STATIC = 'projects_static';
    static CACHE_PREFIX_PROJECTS_ANALYTIC = 'projects_analytic_';
    static CACHE_KEY_CLIENT_INFO = 'client_info';
    static CACHE_KEY_PROJECTS_CONFIG = 'projects_config';
    static CACHE_KEY_MANAGER_INFO = 'manager_info';

    constructor() {
        this.#cache = new DeepCache({
            useStorage: false,
        });
    }
    #mergeMaps(map1, map2) {
        for (const [key, value] of map2) {
            if (map1.has(key)) {
                const existing = map1.get(key);
                for (const prop in value) {
                    existing[prop] = value[prop];
                }
            } else {
                map1.set(key, { ...value });
            }
        }
        return map1;
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
        const staticLoaded = await this.getStaticData() === null;

        if (staticLoaded) {
            const data = await crmApi.getAnalytic(sliceName, staticLoaded);
            this.#cache.set("static_data", data.staticData);
            this.#cache.set(`analytic_${sliceName}`, data.analytic);
            return data.analytic;
        }

        return this.#cache.get(
            `analytic_${sliceName}`,
            () => crmApi.getAnalytic(sliceName, false),
        );
    }

    async getStaticData() {
        return this.#cache.get("static_data", () => null);
    }
    async loadFullStaticData(deleted) {
        const fullStaticData = await crmApi.getProjects(deleted);
        const basicData = await this.#cache.get("static_data");
        const merged = this.#mergeMaps(fullStaticData, basicData);
        console.log(merged)

        this.#cache.set("static_data", merged);
        return merged;
    }

    async getManagerInfo() {
        return this.#cache.get(
            CrmSession.CACHE_KEY_MANAGER_INFO,
            () => bigdataApi.getManagerInfo(),
        );
    }
    *forEachDayAnalytic(startDate, endDate, deleted) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        while (start <= end) {
            yield crmSession.getAnalytic(start, start, deleted);
            start.setDate(start.getDate() + 1);
        }
    }

    async getLimitPotential(date) {
        const actualUserId = (await this.getClient()).user_id;

        return await bigdataSession.getLimitPotential(date, actualUserId);
    }
    async getAnalytic(from, to, deleted) {
        return await this.#getAnalytic(from, to, deleted);
    }

    async getClient() {
        return this.#cache.get(
            CrmSession.CACHE_KEY_CLIENT_INFO,
            () => crmApi.getClient(),
        );
    }
    async getProjectsConfig() {
        return this.#cache.get(
            CrmSession.CACHE_KEY_PROJECTS_CONFIG,
            () => crmApi.getProjectsConfig(),
        );
    }

    async updateProject(newProjectData) {
        // const resp = await crmApi.updateProject(newProjectData);
        //
        // if (resp.ok) {
        //     await this.#cache.updateByPrefix(CrmSession.CACHE_PREFIX_ANALYTIC, (project) => {
        //         if (newProjectData.id === project.id) {
        //             Object.keys(newProjectData).forEach(key => {
        //                 if (project.hasOwnProperty(key)) {
        //                     project[key] = newProjectData[key];
        //                 }
        //             });
        //         }
        //
        //         return project;
        //     });
        // } else {
        //     throw new Error("Cant update project", resp);
        // }
    }
    async disableProjects(ids) {
        const resp = await crmApi.disableProject(ids);

        await this.#cache.updateByPrefix('analytic_', (project) => {
            if (ids.some(id => id === project.id)) {
                project.state = "Неактивен";
            }

            return project;
        });
    }
    async enableProjects(ids) {
        const resp = await crmApi.enableProject(ids);

        await this.#cache.updateByPrefix('analytic_', (project) => {
            if (ids.some(id => id === project.id)) {
                project.state = "Активен";
            }

            return project;
        });
    }
}


const crmSession = Object.freeze(new CrmSession());
export default crmSession;