import { AlitosPeriodPicker } from "../data-picker/altios-period-picker.js";
import { PeriodPickModal } from "../../crm/pages/projects/PeriodPickModal.js";

export class PeriodBtn {
    constructor(element, config) {
        this.element = element;
        this.config = config;

        this.defaultRange = {
            start: config.firstDate,
            end: config.secondDate
        };

        this.render();
        this.#setupEvents();
    }

    #formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    }

    #setupEvents() {
        if (this.config.allowDelete) {
            this.deleteBtn.addEventListener('click', () => this.config.onDelete());
        }
        this.element.addEventListener('click', () => this.openRangePicker());
    }

    openRangePicker() {
        const datePicker = document.createElement('div');
        datePicker.classList.add('period-btn__range-picker');

        const periodPickModal = new PeriodPickModal({
            callingElement: this.element,
            onRangeSelected: (start, end) => {
                this.firsDate.textContent = this.#formatDate(start);
                this.secondDate.textContent = this.#formatDate(end);

                this.defaultRange = { start, end };

                this.config.onChanged(start, end);
            },
            datePickerConfig: Object.assign({}, this.config, {
                defaultRange: this.defaultRange
            })
        });

        periodPickModal.show();
    }

    render() {
        this.element.classList.add("period-btn");

        this.firsDate = document.createElement('p');
        this.firsDate.classList.add("period-btn__date");
        this.secondDate = document.createElement('p');
        this.secondDate.classList.add("period-btn__date");

        this.firsDate.textContent = this.#formatDate(this.config.firstDate);
        this.secondDate.textContent = this.#formatDate(this.config.secondDate);

        if (this.config.firstDate.getTime() === this.config.secondDate.getTime()) {
            this.firsDate.classList.add("disabled");
        }

        this.element.appendChild(this.firsDate);
        this.element.appendChild(this.secondDate);

        if (this.config.allowDelete) {
            this.deleteBtn = document.createElement('div');
            this.deleteBtn.classList.add("period-btn__delete-btn");

            this.element.classList.add("period-btn--deletable");
            this.element.appendChild(this.deleteBtn);
        }
    }
}
