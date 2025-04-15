import { DropDown } from "../../../components/drop-down/drop-down.js";
import { Input } from "../../../components/input/input.js";

export class ProjectFastActions {
    #hideTimeout = null;

    constructor(container, config = {}) {
        this.container = typeof container === "string"
            ? document.querySelector(container)
            : container;
        this.config = config;
        this.dropdownElement = document.createElement("div");
        this.dropdownElement.classList.add("dropdown");
        this.dropdownInstance = new DropDown(this.dropdownElement, {
            placeholder: "Выбери действие",
            position: "top",
            options: config.actionItems,
            onChange: v => this.#onChange(v)
        });
        this.container.appendChild(this.dropdownElement);
        this.actionControls = document.createElement("div");
        this.actionControls.classList.add("action-controls");
        this.inputEl = document.createElement("input");
        this.inputEl.classList.add("input-hidden");
        this.input = new Input(this.inputEl);
        this.applyButton = document.createElement("button");
        this.applyButton.textContent = config.applyButtonText || "Применить";
        this.applyButton.addEventListener("click", () => this.#onApply());
        this.actionControls.appendChild(this.inputEl);
        this.actionControls.appendChild(this.applyButton);
        this.container.appendChild(this.actionControls);
        this.container.classList.add("hidden");
    }

    updateActions(newActions) {
        this.config.actionItems = newActions;
        this.dropdownInstance.updateOptions(newActions);
    }

    updateApplyButtonText(text) {
        if (typeof text === "string") {
            this.applyButton.textContent = text;
        }
    }

    #onChange(value) {
        const item = this.config.actionItems.find(i => i.value === value);
        if (item) {
            item.tooltip
                ? this.dropdownElement.setAttribute("data-tooltip", item.tooltip)
                : this.dropdownElement.removeAttribute("data-tooltip");
            if (item.inputConfig) {
                this.input.reconfigure(item.inputConfig);
                this.inputEl.classList.remove("input-hidden");
            } else {
                this.inputEl.classList.add("input-hidden");
            }
            this.actionControls.classList.add("active");
        } else {
            this.actionControls.classList.remove("active");
            this.dropdownElement.removeAttribute("data-tooltip");
        }
    }

    #onApply() {
        const actionValue = this.dropdownInstance.getValue();
        const item = this.config.actionItems.find(i => i.value === actionValue);
        if (item && typeof item.callback === "function") {
            item.callback(item.inputConfig ? this.inputEl.value : undefined);
        }
    }

    show() {
        if (this.#hideTimeout) {
            clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }
        this.container.classList.remove("hidden");
        void this.container.offsetWidth;
        this.container.classList.add("active");
    }

    hide() {
        this.container.classList.remove("active");
        if (this.#hideTimeout) {
            clearTimeout(this.#hideTimeout);
            this.#hideTimeout = null;
        }
        const transitionEndHandler = () => {
            this.container.classList.add("hidden");
            this.container.removeEventListener('transitionend', transitionEndHandler);
        };
        this.container.addEventListener('transitionend', transitionEndHandler, { once: true });
        this.#hideTimeout = setTimeout(() => {
            if (!this.container.classList.contains("hidden")) {
                this.container.classList.add("hidden");
            }
            this.#hideTimeout = null;
        }, 500);
    }
}