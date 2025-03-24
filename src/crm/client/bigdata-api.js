class BigdataApi {
    #managerInfo;

    async fetch(url, params) {
        return await fetch("https://gck.bigdata-it.ru" + url, params);
    }

    #parseManagerInfo(html) {
        const match = html.match(/window\.intercomSettings\s*=\s*(\{[\s\S]*?\})\s*;/);
        if (match) {
            const jsonStr = match[1].replace(/([\{\s,])(\w+)\s*:/g, '$1"$2":');
            return JSON.parse(jsonStr);
        }
    }

    async hasManagerAccess() {
        try {
            const managerInfo = await this.getManagerInfo();
            if (managerInfo.role === "Manager") {
                return true;
            }
        } catch { }

        return false;
    }
    async getManagerInfo() {
        if (this.#managerInfo === undefined) {
            const resp = await this.fetch("/admin/user/account", {
                credentials: "include"
            });
            const html = await resp.text();

            this.#managerInfo = this.#parseManagerInfo(html);
        }

        return this.#managerInfo;
    }
    async getLimitPotential(query) {
        const resp = await this.fetch(`/admin/gck/analytics-projects-load?${query}`);
        const json = await resp.json();
        return json.projects;
    }
}

const bigdataApi = Object.freeze(new BigdataApi());
export default bigdataApi;