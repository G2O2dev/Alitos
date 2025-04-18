import crmSession from './crm-session.js';

class AdviceSystem {
    #advices = [];
    #loading = false;
    #loaded = false;
    #worker = new Worker(chrome.runtime.getURL('src/crm/client/advice-worker.js'));
    #adviceQueue = [];
    #adviceResolvers = [];
    #loadCompletePromise = null;
    #loadCompleteResolve = null;
    #eventTarget = new EventTarget();

    constructor() {
        this.#worker.onmessage = this.#handleWorkerMessage.bind(this);
    }

    #handleWorkerMessage = ({ data: { type, data } }) => {
        switch (type) {
            case 'newAdvice':
                this.#handleNewAdvice(data);
                break;
            case 'loadComplete':
                this.#handleLoadComplete();
                break;
            case 'requestPeriod':
                this.#handlePeriodRequest(data.sliceName);
                break;
            case 'requestProjectsConfig':
                this.#handleProjectsConfigRequest();
                break;
            case 'requestClientInfo':
                this.#handleClientInfoRequest();
                break;
            case 'requestStaticData':
                this.#handleStaticDataRequest(data.deleted);
                break;
            default:
                console.warn('Неизвестный тип сообщения от воркера:', type);
        }
    };

    #handleNewAdvice(data) {
        this.#advices.push(data);
        if (this.#adviceResolvers.length) {
            this.#adviceResolvers.shift()({ advice: data, done: false });
        } else {
            this.#adviceQueue.push(data);
        }

        this.#emitEvent('adviceAdded', { advice: data, count: this.#advices.length });
    }

    #handleLoadComplete() {
        this.#loading = false;
        this.#loaded = true;
        if (this.#loadCompleteResolve) {
            this.#loadCompleteResolve();
        }
        while (this.#adviceResolvers.length) {
            this.#adviceResolvers.shift()({ advice: null, done: true });
        }
    }

    async #handlePeriodRequest(sliceName) {
        const analytics = await crmSession.getAnalyticBySliceName(sliceName);
        this.#worker.postMessage({
            type: 'periodResponse',
            data: { sliceName, analytics }
        });
    }

    async #handleStaticDataRequest(deleted) {
        await crmSession.loadFullStaticData(deleted);
        this.#worker.postMessage({
            type: 'staticDataResponse',
            data: { staticData: await crmSession.getStaticData(), deleted }
        });
    }

    async #handleProjectsConfigRequest() {
        const config = await crmSession.getProjectsConfig();
        this.#worker.postMessage({
            type: 'projectsConfigResponse',
            data: { config }
        });
    }
    async #handleClientInfoRequest() {
        const info = await crmSession.getClient();
        this.#worker.postMessage({
            type: 'clientInfoResponse',
            data: { info }
        });
    }

    #startLoading() {
        this.#loading = true;
        this.#loaded = false;
        this.#advices = [];
        this.#adviceQueue = [];
        this.#adviceResolvers = [];
        this.#loadCompletePromise = new Promise(resolve => {
            this.#loadCompleteResolve = resolve;
        });
        this.#worker.postMessage({ type: 'getAdvices' });
    }

    async *loadAdvices() {
        if (!this.#loading && !this.#loaded) {
            this.#startLoading();
        }
        while (true) {
            if (this.#adviceQueue.length) {
                yield this.#adviceQueue.shift();
            } else if (this.#loaded) {
                return;
            } else {
                const nextAdvice = await new Promise(resolve => {
                    this.#adviceResolvers.push(resolve);
                });
                if (nextAdvice.done) return;
                yield nextAdvice.advice;
            }
        }
    }
    async waitForLoadComplete() {
        if (this.#loaded) return;
        if (!this.#loading) this.#startLoading();
        return this.#loadCompletePromise;
    }
    async applyAdvice(advice) {
        const index = this.#advices.indexOf(advice);
        if (index !== -1) {
            this.#advices.splice(index, 1);
            this.#emitEvent('adviceRemoved', { advice, count: this.#advices.length });
        }
        return Promise.resolve();
    }
    getAdvicesCount() { return this.#advices.length; }

    #emitEvent(eventName, detail = {}) {
        this.#eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
    on(eventName, callback) {
        this.#eventTarget.addEventListener(eventName, callback);
    }
    off(eventName, callback) {
        this.#eventTarget.removeEventListener(eventName, callback);
    }
}

const adviceSystem = Object.freeze(new AdviceSystem());
export default adviceSystem;