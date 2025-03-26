import { ModalWindow } from "../../../components/modal/modal.js";
import { AlitosPeriodPicker } from "../../../components/data-picker/altios-period-picker.js";

export class PeriodPickModal extends ModalWindow {
    #periodPicker;
    #callingElement;

    constructor(config) {
        super({ contentClasses: ['period-pick-modal'] });
        this.config = config;
        this.#periodPicker = new AlitosPeriodPicker(this.contentElement, {
            mode: 'range',
            twoMonths: true,
            ...this.config.datePickerConfig,
            onRangeSelected: (from, to) => this.onRangeSelected(from, to)
        });
        this.#callingElement = this.config.callingElement || null;
        this._boundUpdatePositions = this.updatePositions.bind(this);
    }

    #clonedElement;

    show() {
        if (this.#callingElement) {
            const rect = this.#callingElement.getBoundingClientRect();
            const clone = this.#callingElement.cloneNode(true);

            clone.style.position = 'absolute';
            clone.style.top = `${rect.top + window.scrollY}px`;
            clone.style.left = `${rect.left + window.scrollX}px`;
            clone.style.pointerEvents = 'none';

            this.modalContainer.appendChild(clone);
            this.#clonedElement = clone;

            requestAnimationFrame(() => this.positionModal());

            window.addEventListener('scroll', this._boundUpdatePositions);
            window.addEventListener('resize', this._boundUpdatePositions);
        }
        super.open();
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

    close() {
        super.close();

        this.onClosed = () => {
            window.removeEventListener('scroll', this._boundUpdatePositions);
            window.removeEventListener('resize', this._boundUpdatePositions);

            if (this.#clonedElement) {
                this.#clonedElement.remove();
                this.#clonedElement = null;
            }
        };
    }

    onRangeSelected(from, to) {
        this.close();
        this.config.onRangeSelected(from, to);
    }

    async render() {
        super.render('');
    }
}