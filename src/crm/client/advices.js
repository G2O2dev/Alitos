
import session from './session.js';
class AdviceSystem {
    #advices = [];
    #isLoading = false;
    #isLoaded = false;
    #eventTarget = new EventTarget();
    #worker = new Worker(chrome.runtime.getURL('src/crm/client/advice-worker.js'));

    constructor() {
        this.#worker.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'newAdvice') {
                this.#advices.push(data);
                this.#emitEvent('newAdvice', { advice: data });
            } else if (type === 'loadComplete') {
                this.#isLoading = false;
                this.#isLoaded = true;
                this.#emitEvent('loadComplete');
            } else if (type === 'requestAnalytics') {
                this.#handleAnalyticsRequest(data.sliceName);
            } else if (type === 'requestProjectsConfig') {
                this.#handleConfigRequest();
            }
        };
    }

    async #handleAnalyticsRequest(sliceName) {
        const analytics = await session.getAnalyticBySliceName(sliceName);
        this.#worker.postMessage({
            type: 'analyticsResponse',
            data: { sliceName, analytics }
        });
    }
    async #handleConfigRequest() {
        const config = await session.getProjectsConfig();
        this.#worker.postMessage({
            type: 'projectsConfigResponse',
            data: { config }
        });
    }

    getAdvices() {
        if (!this.#isLoading && !this.#isLoaded) {
            this.#isLoading = true;
            this.#isLoaded = false;
            this.#advices = [];
            this.#worker.postMessage({ type: 'getAdvices' });
        }
        return this.#advices;
    }
    isLoading() {
        return this.#isLoading;
    }

    #emitEvent(eventName, detail = {}) {
        this.#eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    onNewAdvice(callback) {
        this.#eventTarget.addEventListener('newAdvice', (event) => callback(event.detail.advice));
    }
    onLoadComplete(callback) {
        if (this.#isLoaded) {
            callback();
            return;
        }
        this.#eventTarget.addEventListener('loadComplete', callback);
    }
    offNewAdvice(callback) {
        this.#eventTarget.removeEventListener('newAdvice', callback);
    }
    offLoadComplete(callback) {
        this.#eventTarget.removeEventListener('loadComplete', callback);
    }
}

const adviceSystem = Object.freeze(new AdviceSystem());
export default adviceSystem;