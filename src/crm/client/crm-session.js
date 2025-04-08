import crmApi from "./crm-api.js";
import bigdataApi from "./bigdata-api.js";
import {DeepCache} from "../../lib/deep-cache.js";
import bigdataSession from "./bigdata-session.js";

class CrmSession {
    #cache;

    static CACHE_STATIC_DATA = 'static_data';
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

    #staticDataSources = {
        default: { loaded: false, loader: null },
        deleted: { loaded: false, loader: null },
        fullLoaders: {
            true: null,
            false: null,
        }
    };
    async getAnalyticBySliceName(sliceName) {
        const isDeleted = sliceName.includes("type=deleted");
        const key = isDeleted ? "deleted" : "default";
        const source = this.#staticDataSources[key];
        const currentStaticData = await this.getStaticData() || new Map();

        if (!source.loaded) {
            // Если статические данные ещё не загружены, экстрактим статические данные из аналитики
            if (!source.loader) {
                source.loader = crmApi.getAnalytic(sliceName, true).then(data => {
                    this.#cache.set(`analytic_${sliceName}`, data.analytic);
                    this.#cache.set(CrmSession.CACHE_STATIC_DATA, new Map([...currentStaticData, ...data.staticData]));
                    source.loaded = true;
                });
            }
            await source.loader;
            return this.#cache.get(`analytic_${sliceName}`);
        }

        return this.#cache.get(
            `analytic_${sliceName}`,
            async () => (await crmApi.getAnalytic(sliceName, false)).analytic,
        );
    }

    async getStaticData() {
        return this.#cache.get(CrmSession.CACHE_STATIC_DATA, () => null);
    }
    async loadFullStaticData(deleted) {
        if (!this.#staticDataSources.fullLoaders[deleted]) {
            this.#staticDataSources.fullLoaders[deleted] = crmApi.getProjects(deleted).then(async fullStaticData => {
                const basicData = await this.#cache.get(CrmSession.CACHE_STATIC_DATA);

                const merged = this.#mergeMaps(fullStaticData, basicData);
                this.#cache.set(CrmSession.CACHE_STATIC_DATA, merged);
            });
        }

        await this.#staticDataSources.fullLoaders[deleted];
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
            // if (ids.some(id => id === project.id)) {
            //     project.state = "Неактивен";
            // }

            return project;
        });
    }
    async enableProjects(ids) {
        const resp = await crmApi.enableProject(ids);

        await this.#cache.updateByPrefix('analytic_', (project) => {
            // if (ids.some(id => id === project.id)) {
            //     project.state = "Активен";
            // }

            return project;
        });
    }
}


const crmSession = Object.freeze(new CrmSession());
export default crmSession;