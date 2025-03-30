import { DatePicker } from "./date-picker.js";

export class AlitosPeriodPicker {
    constructor(target, config) {
        this.config = config;
        this.relativeElement = target;
        this.selectedRange = { start: null, end: null };

        this.build();
    }

    build() {
        this.periodPicker = document.createElement('div');
        this.periodPicker.className = 'period-picker';

        this.datePickerContainer = document.createElement('div');
        this.datePickerContainer.className = 'date-picker';
        this.periodPicker.appendChild(this.datePickerContainer);

        this.datePicker = new DatePicker(this.datePickerContainer, {
            ...this.config,
            mode: 'range'
        });

        this.sidebar = document.createElement('div');
        this.sidebar.className = 'sidebar';
        this.periodPicker.appendChild(this.sidebar);

        const periods = [
            { label: 'Сегодня', getRange: () => this.getToday() },
            { label: 'Вчера', getRange: () => this.getYesterday() },
            { label: 'Неделя', getRange: () => this.getWeek() },
            { label: 'Месяц', getRange: () => this.getMonth() },
            { label: '3 месяца', getRange: () => this.getThreeMonths() },
            { label: 'Год', getRange: () => this.getYear() }
        ];

        periods.forEach(period => {
            const button = document.createElement('button');
            button.className = 'sidebar__button';
            button.textContent = period.label;
            button.addEventListener('click', () => {
                const range = period.getRange();
                this.config.onRangeSelected?.(range.start, range.end);
            });
            this.sidebar.appendChild(button);
        });

        this.relativeElement.appendChild(this.periodPicker);
    }

    getToday() {
        const today = new Date();
        return { start: today, end: today };
    }
    getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: yesterday };
    }
    getWeek() {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return { start, end: today };
    }
    getMonth() {
        const today = new Date();

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const end = new Date(today);

        const start = new Date(today);
        start.setDate(today.getDate() - daysInCurrentMonth);

        return { start, end };
    }
    getThreeMonths() {
        const today = new Date();
        const start = new Date(today);
        start.setMonth(today.getMonth() - 3);
        return { start, end: today };
    }
    getYear() {
        const today = new Date();
        const start = new Date(today);
        start.setFullYear(today.getFullYear() - 1);
        return { start, end: today };
    }
}
