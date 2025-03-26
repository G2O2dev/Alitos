class BigdataApi {
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

    async getManagerInfo() {
        const resp = await this.fetch("/admin/user/account", {
            credentials: "include"
        });
        const html = await resp.text();

        return this.#parseManagerInfo(html);
    }
    async getLimitPotential(query) {
        const resp = await this.fetch(`/admin/gck/analytics-projects-load?${query}`);
        const json = await resp.json();
        return json.projects;
    }
}

const bigdataApi = Object.freeze(new BigdataApi());
export default bigdataApi;