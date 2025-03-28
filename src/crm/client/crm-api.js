import {toLocalISOString} from "../utils/helpers.js";
import session from "./session.js";

class CrmApi {
    #clientInfo;
    #worker = new Worker(chrome.runtime.getURL('src/crm/client/crm-api-worker.js'));

    async fetch(url, params) {
        return await chrome.runtime.sendMessage({action: "fetch", url, params});
    }
    async updateProjects(ids, endpoint, transform) {
        return Promise.all(
            ids.map(id =>
                this.fetch(endpoint, {
                    method: "POST",
                    body: JSON.stringify(transform(id))
                })
            )
        );
    }
    async enableProjects(ids) {
        return this.updateProjects(ids, "/admin/visit/rt-project-update", id => ({
            id,
            name: "status",
            value: true
        }));
    }
    async disableProjects(ids) {
        return this.updateProjects(ids, "/admin/visit/rt-project-update", id => ({
            id,
            name: "status",
            value: false
        }));
    }
    async deleteProjects(ids) {
        return this.updateProjects(ids, "/admin/visit/rt-project-delete", id => ({id}));
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

        return projects;
    }
    async getAnalytic(sliceName) {
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
            this.#worker.postMessage({ key: sliceName, analyticHtml: html });
        });
    }

    async getClient() {
        if (!this.#clientInfo) {
            const now = new Date();
            await this.getAnalytic(session.getAnalyticSliceName(now, now, false));
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