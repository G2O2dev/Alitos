export class Loader {
    #started = false;

    constructor(container) {
        if (typeof container === 'string') {
            this.loader = document.querySelector(container);
        } else if (container instanceof HTMLElement) {
            this.loader = container;
        }

        this.loader.classList.add("loader");

        this.spinner = document.createElement("div");
        this.spinner.classList.add("spinner");

        this.textElement = document.createElement("span");
        this.textElement.classList.add("loader-text");

        this.loader.appendChild(this.spinner);
        this.loader.appendChild(this.textElement);
    }

    #start() {
        this.spinner.style.animation = "";
        this.loader.classList.add("active");

        this.#started = true;
    }

    stop() {
        this.#started = false;
        this.loader.classList.remove("active");
        this.loader.addEventListener('transitionend', () => {
            this.spinner.style.animation = "none";
        }, { once: true });
        setTimeout(() => this.spinner.style.animation = "none", 500);
    }

    setText(text) {
        if (!this.#started) this.#start();
        this.textElement.textContent = text;
    }
}