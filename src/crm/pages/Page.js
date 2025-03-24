export class Page {
    constructor(id) {
        this.id = id;
        this.element = document.getElementById(id);
    }

    isShown() {
        return !this.element.classList.contains('hidden');
    }

    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
        }
    }

    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }

    setLoading(isLoading) {
        const loader = this.element.querySelector(".border-loader");

        if (isLoading) {
            loader.style.removeProperty("animation");
            loader.classList.add("border-loader--loading");
        } else {
            loader.classList.remove("border-loader--loading");
            loader.addEventListener(
                "transitionend",
                () => {
                    loader.style.animation = "none";
                },
                { once: true }
            );
        }
    }
}