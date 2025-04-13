import { ModalWindow } from "../../../components/modal/modal.js";
import { AlitosPeriodPicker } from "../../../components/data-picker/altios-period-picker.js";

export class PeriodPickModal extends ModalWindow {
    #callingElement;
    #clonedElement;
    #observer;

    constructor(config) {
        super({
            renderOnShow: true,
            ...config
        });
        this.config = config;
        this.#callingElement = this.config.callingElement || null;
        this._boundUpdatePositions = this.updatePositions.bind(this);
    }

    open() {
        super.open();
        this.modalContainer.classList.add('period-pick-container');

        new AlitosPeriodPicker(this.contentElement, {
            mode: 'range',
            twoMonths: true,
            ...this.config.datePickerConfig,
            onRangeSelected: (from, to) => this.onRangeSelected(from, to)
        });

        if (this.#callingElement) {
            this.#clonedElement = this.#callingElement.cloneNode(true);
            this.#positionCloned();

            this.modalContainer.appendChild(this.#clonedElement);

            this.#observer = new MutationObserver(() => {
                if (this.#callingElement && this.#clonedElement) {
                    this.#clonedElement.remove();
                    this.#clonedElement = this.#callingElement.cloneNode(true);
                    this.#positionCloned();
                    this.modalContainer.appendChild(this.#clonedElement);
                }
            });
            this.#observer.observe(this.#callingElement, {
                attributes: true,
                childList: true,
                subtree: true,
                characterData: true
            });

            requestAnimationFrame(() => this.positionModal());

            window.addEventListener('scroll', this._boundUpdatePositions);
            window.addEventListener('resize', this._boundUpdatePositions);
        }
    }
    close() {
        super.close();

        this.onClosed = () => {
            if (this.#observer) {
                this.#observer.disconnect();
                this.#observer = null;
            }

            window.removeEventListener('scroll', this._boundUpdatePositions);
            window.removeEventListener('resize', this._boundUpdatePositions);

            if (this.#clonedElement) {
                this.#clonedElement.remove();
                this.#clonedElement = null;
            }
        };
    }

    #positionCloned() {
        const rect = this.#callingElement.getBoundingClientRect();

        this.#clonedElement.style.position = 'absolute';
        this.#clonedElement.style.height = rect.height + 'px';
        this.#clonedElement.style.top = `${rect.top + window.scrollY}px`;
        this.#clonedElement.style.left = `${rect.left + window.scrollX}px`;
        this.#clonedElement.style.pointerEvents = 'none';
    }

    positionModal() {
        if (!this.#callingElement) return;
        const rect = this.#callingElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2 + window.scrollX;
        const modalWidth = this.contentElement.offsetWidth;
        const modalHeight = this.contentElement.offsetHeight;
        let left = centerX - modalWidth / 2;
        let top = rect.top + rect.height + 10;
        const minX = window.scrollX;
        const minY = window.scrollY;
        const maxX = window.innerWidth + window.scrollX - modalWidth;
        const maxY = window.innerHeight + window.scrollY - modalHeight;

        if (left < minX) left = minX;
        if (left > maxX) left = maxX;
        if (top < minY) top = minY;
        if (top > maxY) top = maxY;

        this.contentElement.style.position = 'absolute';
        this.contentElement.style.left = `${left}px`;
        this.contentElement.style.top = `${top}px`;
    }

    updatePositions() {
        if (this.#callingElement && this.#clonedElement) {
            const rect = this.#callingElement.getBoundingClientRect();
            this.#clonedElement.style.top = `${rect.top + window.scrollY}px`;
            this.#clonedElement.style.left = `${rect.left + window.scrollX}px`;
            this.positionModal();
        }
    }

    onRangeSelected(from, to) {
        this.config.datePickerConfig.defaultRange = { start: from, end: to };
        this.config.onRangeSelected(from, to);
        this.close();
    }

    async render() {
        super.render('');
    }
}