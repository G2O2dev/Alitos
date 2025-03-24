export class ToggleBtn {
    constructor(selector) {
        this.button =
            typeof selector === "string"
                ? document.querySelector(selector)
                : selector;
        if (!this.button) throw new Error("Элемент не найден");
        this.button.addEventListener("click", () => {
            this.button.dispatchEvent(
                new CustomEvent("toggleRequest", { bubbles: true })
            );
        });
    }

    activate() {
        if (!this.isActive) {
            this.button.classList.add("active");
            this.button.dispatchEvent(
                new CustomEvent("checked", { bubbles: true })
            );
        }
    }

    deactivate() {
        if (this.isActive) {
            this.button.classList.remove("active");
            this.button.dispatchEvent(
                new CustomEvent("unchecked", { bubbles: true })
            );
        }
    }

    setActive(state) {
        state ? this.activate() : this.deactivate();
    }

    toggle() {
        this.setActive(!this.isActive);
    }

    get isActive() {
        return this.button.classList.contains("active");
    }
}
