import {getMonthName, months} from "../../crm/utils/dates.js";

export class DatePicker {
    constructor(container, config = {}) {
        this.container = container;
        this.config = Object.assign(
            {
                mode: 'single',
                twoMonths: false,
                firstDayOfWeek: 1,
                defaultRange: { start: null, end: null },
                allowedRange: { minDate: null, maxDate: null },
            },
            config
        );

        if (this.config.mode === 'range' && this.config.defaultRange) {
            this.rangeStart = this.config.defaultRange.start ? this.roundToDate(this.config.defaultRange.start) : null;
            this.rangeEnd = this.config.defaultRange.end ? this.roundToDate(this.config.defaultRange.end) : null;
        }

        if (this.config.mode === 'range' && (this.rangeStart || this.rangeEnd)) {
            const baseDate = this.rangeEnd || this.rangeStart;
            this.openMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        } else {
            this.openMonth = this.config.openMonth ? new Date(this.config.openMonth) : new Date();
        }

        this.currentDate = new Date(this.openMonth.getFullYear(), this.openMonth.getMonth(), 1);
        this.selectedDate = null;
        this.isSelectingRange = false;

        this.build();
        this.bindEvents();
    }

    build() {
        this.root = document.createElement('div');
        this.root.className = 'datepicker';

        this.nav = document.createElement('div');
        this.nav.className = 'datepicker-header';
        this.prevBtn = document.createElement('button');
        this.prevBtn.className = 'datepicker__nav-btn datepicker__nav-btn--prev';
        this.nextBtn = document.createElement('button');
        this.nextBtn.className = 'datepicker__nav-btn datepicker__nav-btn--next';
        this.monthDisplay = document.createElement('div');
        this.monthDisplay.className = 'datepicker__months-wrapper';

        if (this.config.mode === 'range') {
            this.monthDisplayFirst = document.createElement('p');
            this.monthDisplaySecond = document.createElement('p');
            this.monthDisplay.appendChild(this.monthDisplayFirst);
            this.monthDisplay.appendChild(this.monthDisplaySecond);
        }

        this.nav.appendChild(this.prevBtn);
        this.nav.appendChild(this.monthDisplay);
        this.nav.appendChild(this.nextBtn);
        this.root.appendChild(this.nav);

        this.calendarsContainer = document.createElement('div');
        this.calendarsContainer.className = 'datepicker__calendars';
        this.calendar1 = document.createElement('div');
        this.calendar1.className = 'datepicker__calendar datepicker__calendar--primary';
        this.calendarsContainer.appendChild(this.calendar1);

        if (this.config.twoMonths) {
            this.calendar2 = document.createElement('div');
            this.calendar2.className = 'datepicker__calendar datepicker__calendar--secondary';
            this.calendarsContainer.appendChild(this.calendar2);
        }

        this.root.appendChild(this.calendarsContainer);
        this.container.appendChild(this.root);

        this.renderCalendars(true);
        this.updateMonthDisplay();
    }

    setAllowedRange(minDate, maxDate) {
        this.config.allowedRange.minDate = minDate;
        this.config.allowedRange.maxDate = maxDate;
        this.renderCalendars();
    }

    roundToDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    bindEvents() {
        this.prevBtn.addEventListener('click', () => this.changeMonth(-1));
        this.nextBtn.addEventListener('click', () => this.changeMonth(1));
        this.monthDisplay.addEventListener('click', () => this.showMonthSelection());

        this.root.addEventListener('click', (e) => {
            const day = e.target.closest('.datepicker__day:not(.disabled)');
            if (day) {
                const timestamp = Number(day.getAttribute('data-timestamp'));
                const clickedDate = new Date(timestamp);
                this.handleDateClick(clickedDate);
            }
        });

        if (this.config.mode === 'range') {
            this.root.addEventListener('mouseover', (e) => {
                const day = e.target.closest('.datepicker__day:not(.disabled)');
                if (this.isSelectingRange && day) {
                    const timestamp = Number(day.getAttribute('data-timestamp'));
                    const hoveredDate = new Date(timestamp);
                    this.renderSelection(hoveredDate);
                }
            });
        }
    }

    isDateDisabled(date) {
        const { minDate, maxDate } = this.config.allowedRange;
        if (minDate && date < minDate) return true;
        if (maxDate && date > maxDate) return true;
        return false;
    }

    isMonthDisabled(date) {
        const { minDate, maxDate } = this.config.allowedRange;
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        if (minDate && lastDayOfMonth < minDate) return true;
        if (maxDate && firstDayOfMonth > maxDate) return true;
        return false;
    }

    getMonthYear(date) {
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    updateMonthDisplay() {
        requestAnimationFrame(() => {
            if (this.config.mode === 'range') {
                const nextMonth = new Date(this.currentDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                this.monthDisplayFirst.textContent = this.getMonthYear(this.currentDate);
                this.monthDisplaySecond.textContent = this.getMonthYear(nextMonth);
                this.monthDisplay.style.left = (this.calendar1.offsetWidth - this.monthDisplayFirst.offsetWidth - 12) + "px";
            } else {
                this.monthDisplay.textContent = this.getMonthYear(this.currentDate);
            }
        });
    }

    changeMonth(offset) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth() + offset;

        const newDate = new Date(year, month, 1);

        if (this.isMonthDisabled(newDate)) {
            return;
        }

        this.currentDate = newDate;
        this.updateMonthDisplay();
        this.renderCalendars();
    }

    updateYearButtons() {
        const prevYearBtn = this.monthSelectionOverlay.querySelector('.datepicker__nav-btn--prev');
        const nextYearBtn = this.monthSelectionOverlay.querySelector('.datepicker__nav-btn--next');

        const prevYear = this.currentDate.getFullYear() - 1;
        const nextYear = this.currentDate.getFullYear() + 1;

        if (this.isYearDisabled(prevYear)) {
            prevYearBtn.classList.add('disabled');
        } else {
            prevYearBtn.classList.remove('disabled');
        }

        if (this.isYearDisabled(nextYear)) {
            nextYearBtn.classList.add('disabled');
        } else {
            nextYearBtn.classList.remove('disabled');
        }
    }

    showMonthSelection() {
        if (this.monthSelectionOverlay) {
            this.root.removeChild(this.monthSelectionOverlay);
            this.monthSelectionOverlay = null;
            return;
        }

        this.monthSelectionOverlay = document.createElement('div');
        this.monthSelectionOverlay.className = 'datepicker__month-selection';

        const header = document.createElement('div');
        header.className = 'datepicker__month-selection-header';

        const prevYearBtn = document.createElement('button');
        prevYearBtn.className = 'datepicker__nav-btn datepicker__nav-btn--prev';

        const yearDisplay = document.createElement('div');
        yearDisplay.className = 'datepicker__year-display';
        yearDisplay.textContent = this.currentDate.getFullYear();

        const nextYearBtn = document.createElement('button');
        nextYearBtn.className = 'datepicker__nav-btn datepicker__nav-btn--next';

        header.appendChild(prevYearBtn);
        header.appendChild(yearDisplay);
        header.appendChild(nextYearBtn);
        this.monthSelectionOverlay.appendChild(header);

        const list = document.createElement('ul');
        list.className = 'datepicker__month-list';
        for (let i = 0; i < 12; i++) {
            const li = document.createElement('li');
            li.className = 'datepicker__month-item';
            const monthDate = new Date(this.currentDate.getFullYear(), i, 1);
            li.textContent = getMonthName(monthDate);
            li.setAttribute('data-month', i);

            // Добавляем специальный класс для текущего реального месяца (если год совпадает)
            const today = new Date();
            if (today.getFullYear() === this.currentDate.getFullYear() && today.getMonth() === i) {
                li.classList.add('datepicker__month-item--current');
            }

            if (this.isMonthDisabled(monthDate)) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', (e) => {
                    const month = Number(e.currentTarget.getAttribute('data-month'));
                    this.currentDate.setMonth(month);
                    this.updateMonthDisplay();
                    this.renderCalendars();
                    this.root.removeChild(this.monthSelectionOverlay);
                    this.monthSelectionOverlay = null;
                });
            }
            list.appendChild(li);
        }
        this.monthSelectionOverlay.appendChild(list);
        this.root.appendChild(this.monthSelectionOverlay);

        prevYearBtn.addEventListener('click', () => this.changeYear(-1));
        nextYearBtn.addEventListener('click', () => this.changeYear(1));

        this.updateYearButtons();
    }

    updateMonthSelection() {
        const yearDisplay = this.monthSelectionOverlay.querySelector('.datepicker__year-display');
        yearDisplay.textContent = this.currentDate.getFullYear();

        const list = this.monthSelectionOverlay.querySelector('.datepicker__month-list');
        list.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const li = document.createElement('li');
            li.className = 'datepicker__month-item';
            const monthDate = new Date(this.currentDate.getFullYear(), i, 1);
            li.textContent = getMonthName(monthDate);
            li.setAttribute('data-month', i);

            // Отмечаем текущий месяц (согласно реальной дате)
            const today = new Date();
            if (today.getFullYear() === this.currentDate.getFullYear() && today.getMonth() === i) {
                li.classList.add('datepicker__month-item--current');
            }

            if (this.isMonthDisabled(monthDate)) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', (e) => {
                    const month = Number(e.currentTarget.getAttribute('data-month'));
                    this.currentDate.setMonth(month);
                    this.updateMonthDisplay();
                    this.renderCalendars();
                    this.root.removeChild(this.monthSelectionOverlay);
                    this.monthSelectionOverlay = null;
                });
            }
            list.appendChild(li);
        }
        this.updateYearButtons();
    }

    isYearDisabled(year) {
        const { minDate, maxDate } = this.config.allowedRange;
        const firstDayOfYear = new Date(year, 0, 1);
        const lastDayOfYear = new Date(year, 11, 31);

        if (minDate && lastDayOfYear < minDate) return true;
        if (maxDate && firstDayOfYear > maxDate) return true;
        return false;
    }

    changeYear(offset) {
        const newYear = this.currentDate.getFullYear() + offset;
        if (this.isYearDisabled(newYear)) {
            return;
        }
        this.currentDate.setFullYear(newYear);
        this.updateMonthSelection();
    }

    renderCalendars(initial = false) {
        this.renderCalendar(this.calendar1, new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1), initial);
        if (this.config.twoMonths && this.calendar2) {
            const nextMonthDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
            this.renderCalendar(this.calendar2, nextMonthDate, initial);
        }

        if (this.config.mode === 'range' && (this.rangeStart || this.rangeEnd)) {
            this.renderSelection();
        }

        const prevMonthDate = new Date(this.currentDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        if (this.isMonthDisabled(prevMonthDate)) {
            this.prevBtn.classList.add('disabled');
        } else {
            this.prevBtn.classList.remove('disabled');
        }

        const nextMonthDate = new Date(this.currentDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        if (this.isMonthDisabled(nextMonthDate)) {
            this.nextBtn.classList.add('disabled');
        } else {
            this.nextBtn.classList.remove('disabled');
        }
    }

    renderCalendar(calendarEl, date, initial = false) {
        if (initial || !calendarEl._cellsCreated) {
            calendarEl.innerHTML = '';
            const fragment = document.createDocumentFragment();
            const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            const firstDayIndex = this.config.firstDayOfWeek % 7;
            const weekdays = weekdayNames.slice(firstDayIndex).concat(weekdayNames.slice(0, firstDayIndex));
            weekdays.forEach((day) => {
                const dayEl = document.createElement('div');
                dayEl.className = 'datepicker__cell datepicker__cell--weekday';
                dayEl.textContent = day;
                fragment.appendChild(dayEl);
            });

            const dayCells = [];
            for (let i = 0; i < 42; i++) {
                const dayCell = document.createElement('div');
                dayCell.className = 'datepicker__cell datepicker__day';

                fragment.appendChild(dayCell);
                dayCells.push(dayCell);
            }
            calendarEl.appendChild(fragment);

            calendarEl._dayCells = dayCells;
            calendarEl._cellsCreated = true;
        }

        const dayCells = calendarEl._dayCells;
        const currentYear = date.getFullYear();
        const currentMonth = date.getMonth();
        let startDay = new Date(currentYear, currentMonth, 1).getDay();
        if (this.config.firstDayOfWeek === 1) {
            startDay = (startDay === 0) ? 6 : startDay - 1;
        }
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        let previousMonth = currentMonth - 1;
        let previousYear = currentYear;
        if (previousMonth < 0) {
            previousMonth = 11;
            previousYear--;
        }
        const daysInPreviousMonth = new Date(previousYear, previousMonth + 1, 0).getDate();
        const prevMonthDaysToShow = startDay;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        for (let i = 0; i < 42; i++) {
            const cell = dayCells[i];
            cell.className = 'datepicker__cell datepicker__day';
            let cellDate, dayNum, currentMonthFlag;
            if (i < prevMonthDaysToShow) {
                dayNum = daysInPreviousMonth - (prevMonthDaysToShow - 1 - i);
                cellDate = new Date(previousYear, previousMonth, dayNum);
                cell.classList.add('datepicker__day--prev');
                currentMonthFlag = false;
            } else if (i < prevMonthDaysToShow + daysInMonth) {
                dayNum = i - prevMonthDaysToShow + 1;
                cellDate = new Date(currentYear, currentMonth, dayNum);
                cell.setAttribute('data-current-month', 'true');
                currentMonthFlag = true;
            } else {
                dayNum = i - (prevMonthDaysToShow + daysInMonth) + 1;
                let nextMonth = currentMonth + 1;
                let nextYear = currentYear;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextYear++;
                }
                cellDate = new Date(nextYear, nextMonth, dayNum);
                cell.classList.add('datepicker__day--next');
                currentMonthFlag = false;
            }
            cell.textContent = dayNum;
            cell.setAttribute('data-timestamp', cellDate.getTime());
            cell.setAttribute('data-current-month', currentMonthFlag ? 'true' : 'false');

            if (this.isDateDisabled(cellDate)) {
                cell.classList.add('disabled');
            }
            if (cellDate.getTime() === todayTimestamp) {
                cell.classList.add('today');
            }
        }
    }

    handleDateClick(date) {
        if (this.isDateDisabled(date)) return;

        if (this.config.mode === 'single') {
            this.selectedDate = date;
            this.highlightSelectedDate(date);
        } else if (this.config.mode === 'range') {
            if (!this.isSelectingRange) {
                this.rangeStart = date;
                this.rangeEnd = null;
                this.isSelectingRange = true;
            } else {
                if (date < this.rangeStart) {
                    this.rangeEnd = this.rangeStart;
                    this.rangeStart = date;
                } else {
                    this.rangeEnd = date;
                }
                this.isSelectingRange = false;
            }
            this.renderSelection();
        }

        if (this.rangeEnd) this.config.onRangeSelected?.(this.rangeStart, this.rangeEnd);
    }

    highlightSelectedDate(date) {
        const days = this.root.querySelectorAll('.datepicker__day');
        days.forEach((day) => day.classList.remove('selected'));
        const selectedCell = this.root.querySelector(`.datepicker__day[data-timestamp="${date.getTime()}"]`);
        if (selectedCell) selectedCell.classList.add('selected');
    }

    renderSelection(hoveredDate) {
        if (this.config.mode !== 'range' || !this.rangeStart) return;

        const days = this.root.querySelectorAll('.datepicker__day[data-current-month="true"]');
        const rangeEndDate = this.rangeEnd || hoveredDate;

        if (this.prevRange) {
            this.prevRange.forEach(day =>
                day?.classList.remove('selected', 'range-start', 'range-end', 'range-middle', 'in-range')
            );
        }

        if (!rangeEndDate) {
            const startCell = this.root.querySelector(
                `.datepicker__day[data-timestamp="${this.rangeStart.getTime()}"][data-current-month="true"]`
            );
            if (startCell) startCell.classList.add('selected');
            this.prevRange = [startCell];
            return;
        }

        const start = this.rangeStart < rangeEndDate ? this.rangeStart : rangeEndDate;
        const end = this.rangeStart > rangeEndDate ? this.rangeStart : rangeEndDate;

        const isSameDay = start.getTime() === end.getTime();

        const newRange = [];
        days.forEach(day => {
            const dayTs = Number(day.getAttribute('data-timestamp'));

            if (isSameDay && dayTs === start.getTime()) {
                day.classList.add('range-middle');
                newRange.push(day);
            } else if (dayTs === start.getTime()) {
                day.classList.add('range-start');
                newRange.push(day);
            } else if (dayTs === end.getTime()) {
                day.classList.add('range-end');
                newRange.push(day);
            } else if (dayTs > start.getTime() && dayTs < end.getTime()) {
                day.classList.add('in-range');
                newRange.push(day);
            }
        });

        this.prevRange = newRange;
    }
}