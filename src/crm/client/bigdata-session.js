import crmApi from "./crm-api.js";
import bigdataApi from "./bigdata-api.js";
import {DeepCache} from "../../lib/deep-cache.js";

class BigdataSession {
    #cache;

    constructor() {
        this.#cache = new DeepCache({
            useStorage: false,
        });
    }

    async getLimitPotential(date, userId) {
        const formatedDate = crmApi.formatDate(date);
        const query = `date=${formatedDate}&user_id=${userId}`;

        return this.#cache.get(
            `rtk_analytic_${query}`,
            async () => {
                const resp = await bigdataApi.getLimitPotential(query);
                if (!resp) throw new Error("Cant load RTK analytic");
                return resp;
            },
        );
    }
}


const bigdataSession = Object.freeze(new BigdataSession());
export default bigdataSession;