import {toLocalISOString} from "../utils/helpers.js";
import crmSession from "./crm-session.js";

const baseProjectBody = {
    "project_ids": [],
    "showSrc": false,
    "id": "",
    "show": true,
    "isLoading": true,
    "tag": "",
    "name": "",
    "inname": "",
    "go": false,
    "status": false,
    "stock": false,
    "multigroup": false,
    "prpr": null,
    "srcrt": true,
    "srcbl": false,
    "srcmg": false,
    "srclal": false,
    "srcmt": true,
    "user_id": null,
    "token": null,
    "depth": 1,
    "type": "calls",
    "activeContentTab": "textarea",
    "filename": "",
    "sep": null,
    "isHeader": false,
    "radioColumn": 0,
    "content": "",
    "sphere": "",
    "dopcontent": "",
    "regular_value": null,
    "limit": 0,
    "total_limit": 0,
    "common_limit": 0,
    "limit_off": false,
    "workdays": [],
    "regions": [],
    "regions_reverse": false,
    "is_crm": 0,
    "category": null,
    "source": null,
}

class CrmApi {
    #clientInfo;
    #worker = new Worker(chrome.runtime.getURL('src/crm/client/crm-api-worker.js'));

    async fetch(url, params) {
        return await chrome.runtime.sendMessage({action: "fetch", url, params});
    }
    async updateProject(projectData) {
        const base = JSON.parse(JSON.stringify(baseProjectBody));

        Object.keys(projectData).forEach(key => {
            if (base.hasOwnProperty(key)) {
                base[key] = projectData[key];
            }
        });

        return this.fetch("/admin/visit/rt-project-save", {
            method: "POST",
            body: JSON.stringify(base)
        })
    }
    async enableProject(id) {
        return this.updateProjects(Array.isArray(id) ? id : [id], "/admin/visit/rt-project-update", id => ({
            id,
            name: "status",
            value: true
        }));
    }
    async disableProject(id) {
        return this.updateProjects(Array.isArray(id) ? id : [id], "/admin/visit/rt-project-update", id => ({
            id,
            name: "status",
            value: false
        }));
    }
    async deleteProject(id) {
        return this.updateProjects(Array.isArray(id) ? id : [id], "/admin/visit/rt-project-delete", id => ({id}));
    }



    formatDate(date) {
        return toLocalISOString(date).split("T")[0];
    }

    #parseClient(text) {
        const match = text.match(/window\.intercomSettings\s*=\s*(\{[\s\S]*?\})\s*;/);
        if (match) {
            const jsonStr = match[1].replace(/([\{\s,])(\w+)\s*:/g, '$1"$2":');
            const clientData = JSON.parse(jsonStr);
            document.title = clientData.username;

            return clientData;
        } else {
            console.warn("Client data not found.", text);
        }
    }

    async getProjects(deleted) {
        const url = `/admin/visit/rt-projects-load?&src=none${deleted ? "&type=deleted" : ""}`;
        const data = await this.fetch(url);
        const {projects} = JSON.parse(data);

        const result = new Map();
        for (const project of projects) {
            result.set(project.id, project);
        }
        return result;
    }
    async getAnalytic(sliceName, extractStaticData = false) {
        const url = `/admin/visit/rt-stat?${sliceName}`;
        const html = await this.fetch(url);

        this.#clientInfo = this.#parseClient(html);

        return new Promise((resolve, reject) => {
            this.#worker.onmessage = function(e) {
                if (e.data.type === 'analyticsResponse' && e.data.key === sliceName) {
                    resolve(e.data.data);
                }
            };
            this.#worker.onerror = function(error) {
                reject(error);
            };
            this.#worker.postMessage({ key: sliceName, analyticHtml: html, extractStaticData: extractStaticData });
        });
    }

    async getClient() {
        if (!this.#clientInfo) {
            const now = new Date();
            await this.getAnalytic(crmSession.getAnalyticSliceName(now, now, false));
        }

        return this.#clientInfo;
    }
    async getProjectsConfig() {
        const html = await this.fetch("/admin/visit/rt");

        const match = html.match(/wantPhones:\s*(\d+)/);
        const isCallCenter = html.includes("Диалоги КЦ");
        const wantPhones = match ? parseInt(match[1], 10) : null;

        const config = {
            wantPhones,
            isCallCenter
        };

        return config;
    }
}


const crmApi = Object.freeze(new CrmApi());
export default crmApi;