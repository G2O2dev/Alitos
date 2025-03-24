import {ModalWindow} from "../../../components/modal/modal.js";
import {AlitosPeriodPicker} from "../../../components/data-picker/altios-period-picker.js";

export class PeriodPickModal extends ModalWindow {
    #periodPicker;
    #callingElement;

    constructor(config) {
        super({
            contentClasses: ['advice-modal'],
        });

        this.config = config;
        this.#periodPicker = new AlitosPeriodPicker(this.contentElement, {
            mode: 'range',
            twoMonths: true,
            ...this.config.datePickerConfig,

            onRangeSelected: (from, to) => this.onRangeSelected(from, to),
        });
        this.#callingElement = this.config.callingElement || null;
    }


    #placeholderElement;

    show() {
        if (this.#callingElement) {
            const rect = this.#callingElement.getBoundingClientRect();

            this.#placeholderElement = document.createElement('div');
            this.#placeholderElement.style.width = `${rect.width}px`;
            this.#placeholderElement.style.height = `${rect.height}px`;

            this.#callingElement.parentNode.insertBefore(this.#placeholderElement, this.#callingElement.nextSibling);

            this.modalContainer.appendChild(this.#callingElement);
            this.#callingElement.style.position = 'absolute';
            this.#callingElement.style.top = `${rect.top + window.scrollY}px`;
            this.#callingElement.style.left = `${rect.left + window.scrollX}px`;
            this.#callingElement.style.pointerEvents = 'none';

            requestAnimationFrame(() => {
                const picker = this.#periodPicker.periodPicker;
                const pickerWidth = picker.offsetWidth;
                const pickerHeight = picker.offsetHeight;

                let top = rect.bottom + window.scrollY + 10;
                let left = (rect.left - (pickerWidth / 2)) + window.scrollX;

                const spaceBelow = window.innerHeight - rect.bottom;
                if (spaceBelow < pickerHeight) {
                    if (rect.top >= pickerHeight) {
                        top = rect.top - pickerHeight + window.scrollY;
                    } else {
                        top = window.scrollY + Math.max((window.innerHeight - pickerHeight) / 2, 0);
                    }
                }
                if (left + (pickerWidth / 2) > window.innerWidth) {
                    left = window.innerWidth - pickerWidth + window.scrollX;
                    left = Math.max(left, window.scrollX);
                }

                this.contentElement.style.position = 'absolute';
                this.contentElement.style.top = `${top}px`;
                this.contentElement.style.left = `${left}px`;
            })
        }

        super.open();
    }

    close() {
        super.close();

        this.onClosed = () => {
            if (this.#callingElement && this.#placeholderElement) {
                this.#placeholderElement.parentNode.replaceChild(this.#callingElement, this.#placeholderElement);

                this.#placeholderElement.remove();
                this.#placeholderElement = null;

                this.#callingElement.style.position = '';
                this.#callingElement.style.top = '';
                this.#callingElement.style.left = '';
                this.#callingElement.style.width = '';
                this.#callingElement.style.height = '';
                this.#callingElement.style.pointerEvents = '';
            }
        }

    }

    onRangeSelected(from, to) {
        this.close();
        this.config.onRangeSelected(from, to);
    }

    async render() {
        super.render('');
    }
}