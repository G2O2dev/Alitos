import {ModalWindow} from "./modal.js";

export class AlitosModal extends ModalWindow {
    constructor(options) {
        if (options.contentClasses === undefined) {
            options.contentClasses = ['alitos-modal', 'border-loader'];
        } else {
            options.contentClasses = [...options.contentClasses, 'alitos-modal', 'border-loader'];
        }

        super(options);
    }

    #renderHeader() {
        return `
            <div class="alitos-modal__header">
                <div class="alitos-modal__header-left">
                    <p class="alitos-modal__header-title">${this.options.header}</p>
                </div>
                <div class="alitos-modal__header-close"></div>
            </div>
        `
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.contentElement.style.removeProperty("animation");
            this.contentElement.classList.add("border-loader--loading");
        } else {
            this.contentElement.classList.remove("border-loader--loading");
            this.contentElement.addEventListener(
                "transitionend",
                () => {
                    this.contentElement.style.animation = "none";
                },
                { once: true }
            );
        }
    }

    render(content) {
        const isRendered = super.render(`
            ${this.#renderHeader()}
            <div class="alitos-modal__content">
                ${typeof content === 'string' ? content : ''}
            </div>
        `);

        this.innerCcontentElement = this.contentElement.querySelector('.alitos-modal__content');

        if (Array.isArray(content)) {
            for (const item of content) {
                this.appendContent(item);
            }
        }

        this.contentElement.querySelector('.alitos-modal__header-close').addEventListener('click', () => this.close());

        return isRendered;
    }
}