import { PeriodPickModal } from "../../crm/pages/projects/PeriodPickModal.js";
import { pluralize } from "../../crm/utils/helpers.js";

export class PeriodBtn {
    static months = [
        "Январь", "Февраль", "Март", "Апрель",
        "Май", "Июнь", "Июль", "Август",
        "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    static msInDay = 24 * 60 * 60 * 1000;

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

    #formatDate(date, showYear = true) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        if (showYear) {
            const year = String(date.getFullYear()).slice(-2);
            return `${day}.${month}.${year}`;
        }
        return `${day}.${month}`;
    }

    #getMonthName(date) {
        return PeriodBtn.months[date.getMonth()];
    }

    #isFullMonth(start, end) {
        const firstDay = 1;
        const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        return start.getDate() === firstDay && end.getDate() === lastDay &&
            start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    }

    #daysDiff(start, end) {
        return Math.round((end - start) / PeriodBtn.msInDay);
    }

    #formatSingleDate(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = this.#daysDiff(today, target);

        if (diffDays === 0) {
            return "Сегодня";
        } else if (diffDays === -1) {
            return "Вчера";
        } else if (diffDays === -2) {
            return "Позавчера";
        }
        const showYear = (date.getFullYear() !== now.getFullYear());
        return this.#formatDate(date, showYear);
    }

    #formatPeriod(start, end) {
        const resetTime = date => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        };

        const today = resetTime(new Date());
        start = resetTime(start);
        end = resetTime(end);

        if (start.getTime() === end.getTime()) {
            return this.#formatSingleDate(start);
        }

        if (this.#isFullMonth(start, end)) {
            return this.#getMonthName(start);
        }

        if (start.getTime() === today.getTime() || end.getTime() === today.getTime()) {
            const daysCount = this.#daysDiff(start, end) + 1;
            if (daysCount >= 2 && daysCount <= 30) {
                return pluralize(daysCount, "Дн", "я", "я", "ей");
            }
        }

        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (monthsDiff === 1) {
            return "Месяц";
        }
        if (monthsDiff && monthsDiff < 12) {
            return pluralize(monthsDiff, "Месяц", "а", "а", "ев");
        }
        if (monthsDiff === 12) {
            return "Год";
        }

        return start.getFullYear() === end.getFullYear()
            ? `${this.#formatDate(start, false)} / ${this.#formatDate(end, false)}`
            : `${this.#formatDate(start)} / ${this.#formatDate(end)}`;
    }

    #setupEvents() {
        if (this.config.allowDelete) {
            this.deleteBtn.addEventListener('click', () => this.config.onDelete());
        }
        this.element.addEventListener('click', () => this.openRangePicker());
    }

    setAllowedRange(start, end) {
        this.config.allowedRange = { minDate: start, maxDate: end };
    }

    openRangePicker() {
        const datePicker = document.createElement('div');
        datePicker.classList.add('period-btn__range-picker');

        const periodPickModal = new PeriodPickModal({
            callingElement: this.element,
            onRangeSelected: (start, end) => {
                this.labelElem.textContent = this.#formatPeriod(start, end);
                this.defaultRange = { start, end };
                this.config.onChanged({
                    from: start,
                    to: end,
                    name: this.labelElem.textContent,
                });
            },
            datePickerConfig: { ...this.config, defaultRange: this.defaultRange }
        });

        periodPickModal.show();
    }

    render() {
        this.element.classList.add("period-btn");

        this.labelElem = document.createElement('p');
        this.labelElem.classList.add("period-btn__label");
        this.labelElem.textContent = this.#formatPeriod(this.config.firstDate, this.config.secondDate);
        this.element.appendChild(this.labelElem);

        if (this.config.allowDelete) {
            this.deleteBtn = document.createElement('div');
            this.deleteBtn.classList.add("period-btn__delete-btn");
            this.element.classList.add("period-btn--deletable");
            this.element.appendChild(this.deleteBtn);
        }
    }
}