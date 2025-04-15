export class Loader {
    #started = false;
    #hideTimeout = null;

    constructor(container) {
        if (typeof container === 'string') {
            this.loader = document.querySelector(container);
        } else if (container instanceof HTMLElement) {
            this.loader = container;
        }

        this.loader.classList.add("loader");
        this.loader.classList.add("hidden");

        this.spinner = document.createElement("div");
        this.spinner.classList.add("spinner");

        this.textElement = document.createElement("span");
        this.textElement.classList.add("loader-text");

        this.loader.appendChild(this.spinner);
        this.loader.appendChild(this.textElement);
    }

    #start() {
        if (this.#hideTimeout) {
            clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }

        this.loader.classList.remove("hidden");

        void this.loader.offsetWidth;

        this.loader.classList.add("active");
        this.#started = true;
    }

    stop() {
        this.#started = false;
        this.loader.classList.remove("active");

        if (this.#hideTimeout) {
            clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }

        const transitionEndHandler = () => {
            this.loader.classList.add("hidden");
            this.loader.removeEventListener('transitionend', transitionEndHandler);
        };

        this.loader.addEventListener('transitionend', transitionEndHandler, { once: true });

        this.#hideTimeout = setTimeout(() => {
            if (!this.loader.classList.contains("hidden")) {
                this.loader.classList.add("hidden");
            }
            this.#hideTimeout = null;
        }, 500);
    }

    setText(text) {
        if (!this.#started) {
            this.#start();
        }
        this.textElement.textContent = text;
    }
}