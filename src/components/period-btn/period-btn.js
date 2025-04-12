import { formatPeriod } from "../../crm/utils/date.js";
import { PeriodPickModal } from "../../crm/pages/projects/PeriodPickModal.js";
import {EventBase} from "../../crm/utils/EventBase.js";

export class PeriodBtn extends EventBase{
    #element;
    #period; // { start: Date, end: Date }
    #config; // { allowDelete: boolean, datePickerConfig: object }
    #labelElem;
    #deleteBtn;

    #boundOpenRangePicker = this.#openRangePickerHandler.bind(this);
    #boundHandleDeleteClick = this.#handleDeleteClick.bind(this);

    constructor(element, initialPeriod, config = {}) {
        super();

        this.#element = element;
        this.#period = { ...(initialPeriod || { start: new Date(), end: new Date() }) };
        this.#config = {
            allowDelete: false,
            datePickerConfig: {},
            ...config
        };

        this.#render();
        this.#setupDOMEvents();
    }

    get element() {
        return this.#element;
    }
    get period() {
        return { ...this.#period };
    }

    setAllowDelete(allow) {
        const shouldAllow = Boolean(allow);
        if (this.#config.allowDelete === shouldAllow) return;

        this.#config.allowDelete = shouldAllow;
        this.#updateDeleteButton();
    }
    setAllowedRange(minDate, maxDate) {
        this.#config.datePickerConfig.allowedRange = { minDate, maxDate };
    }

    destroy() {
        this.#element.removeEventListener('click', this.#boundOpenRangePicker);
        this.#deleteBtn?.removeEventListener('click', this.#boundHandleDeleteClick);

        this.#element.remove();
    }

    //#region Private
    #render() {
        this.#element.classList.add("period-btn");
        this.#element.innerHTML = ''; // Clear previous content

        this.#labelElem = document.createElement('p');
        this.#labelElem.classList.add("period-btn__label");
        this.#labelElem.textContent = formatPeriod(this.#period.start, this.#period.end);
        this.#element.appendChild(this.#labelElem);

        this.#deleteBtn = document.createElement('button');
        this.#deleteBtn.type = 'button';
        this.#deleteBtn.classList.add("period-btn__delete-btn");
        this.#deleteBtn.setAttribute('aria-label', 'Удалить период');
        this.#deleteBtn.innerHTML = '&times;';
        this.#element.appendChild(this.#deleteBtn);

        this.#updateDeleteButton(); // Set initial state
    }

    /**
     * Updates the visibility and DOM event listener for the delete button.
     */
    #updateDeleteButton() {
        if (!this.#deleteBtn) return;

        if (this.#config.allowDelete) {
            this.#element.classList.add("period-btn--deletable");
            this.#deleteBtn.style.display = '';
            this.#deleteBtn.removeEventListener('click', this.#boundHandleDeleteClick); // Prevent duplicates
            this.#deleteBtn.addEventListener('click', this.#boundHandleDeleteClick);
        } else {
            this.#element.classList.remove("period-btn--deletable");
            this.#deleteBtn.style.display = 'none';
            this.#deleteBtn.removeEventListener('click', this.#boundHandleDeleteClick);
        }
    }

    /**
     * Sets up initial DOM event listeners for user interaction.
     */
    #setupDOMEvents() {
        this.#element.addEventListener('click', this.#boundOpenRangePicker);
    }

    /**
     * Handles the click on the main element to open the picker.
     * This wrapper prevents the event object from leaking into openRangePicker logic if not needed.
     */
    #openRangePickerHandler() {
        this.periodPickModal = this.periodPickModal ?? new PeriodPickModal({
            callingElement: this.#element,
            onRangeSelected: (start, end) => {
                const oldPeriod = { ...this.#period };
                const newPeriod = { start, end };
                this.#period = newPeriod;
                this.#labelElem.textContent = formatPeriod(start, end);

                this._emit('change', {
                    detail: { oldPeriod, newPeriod: { ...newPeriod } }
                });
            },
            datePickerConfig: {
                ...this.#config.datePickerConfig,
                defaultRange: { start: this.#period.start, end: this.#period.end }
            }
        });

        this.periodPickModal.show();
    }

    #handleDeleteClick(event) {
        event.stopPropagation();
        this._emit('delete');
    }
    //#endregion
}