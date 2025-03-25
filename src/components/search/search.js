export class SearchComponent {
    constructor(element) {
        this.element = element;
        this.#init();
    }

    search(value) {
        this.input.value = value;
        this.handleChange();
    }

    updateState() {
        if (this.input.value !== "") {
            this.searchIcon.classList.add("has-text");
        } else {
            this.searchIcon.classList.remove("has-text");
        }
    }

    notifyChange() {
        this.element.dispatchEvent(new CustomEvent("search-input", { bubbles: true, detail: { query: this.input.value } }));
    }

    handleChange() {
        this.updateState();
        this.notifyChange();
    }

    #init() {
        this.searchEl = this.element;
        this.input = this.searchEl.querySelector(".search__input");
        this.searchIcon = this.searchEl.querySelector(".search__icon");

        this.updateState();

        this.searchEl.addEventListener("click", () => this.input.focus());

        this.input.addEventListener("input", () => this.handleChange());

        this.searchIcon.addEventListener("click", () => {
            if (this.searchIcon.classList.contains("has-text")) {
                this.input.value = "";
                this.handleChange();
            }
        });
    }
}