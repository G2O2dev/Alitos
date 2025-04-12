export class EventBase {
    #eventTarget = new EventTarget();

    _emit(eventName, detail = {}) {
        this.#eventTarget.dispatchEvent(new CustomEvent(eventName, {detail}));
    }

    on(eventName, callback) {
        this.#eventTarget.addEventListener(eventName, callback);
    }

    off(eventName, callback) {
        this.#eventTarget.removeEventListener(eventName, callback);
    }
}