import { EventBase } from "../../crm/utils/EventBase.js";
import { PeriodPickModal } from "../../crm/pages/projects/PeriodPickModal.js";
import { PeriodBtn } from "../period-btn/period-btn.js";

export class DatesSelector extends EventBase {
    #element;
    #config; // { minDates, maxDates, initialDates, datePickerConfig, addButtonLabel }
    #periodsContainer;
    #addBtn;
    #periodBtns = new Map(); // Map<string, PeriodBtn>
    #periods = []; // Array<{id: string, start: Date, end: Date}>
    #nextId = 0;

    #boundHandlePeriodChange = this.#handlePeriodChange.bind(this);
    #boundHandlePeriodDelete = this.#handlePeriodDelete.bind(this);
    #boundAddPeriod = this.#addPeriod.bind(this);

    constructor(elementOrSelector, config = {}) {
        super();

        const {
            minDates = 1,
            maxDates = Infinity,
            initialDates = [],
            datePickerConfig = {},
            addButtonLabel = ''
        } = config;

        this.#config = { minDates, maxDates, initialDates, datePickerConfig, addButtonLabel };

        this.#element = typeof elementOrSelector === 'string'
            ? document.querySelector(elementOrSelector)
            : elementOrSelector;

        this.#renderLayout();
        this.#initializePeriods();
        this.#updateUI();
    }

    setAllowedRange(minDate, maxDate) {
        this.#config.datePickerConfig = {
            allowedRange: { minDate, maxDate }
        };

        this.#periods.forEach(periodData => {
            const periodBtn = this.#periodBtns.get(periodData.id);
            if (periodBtn) {
                periodBtn.setAllowedRange(minDate, maxDate);
            }
        });
    }

    #generateId() {
        return `period-${this.#nextId++}`;
    }

    #renderLayout() {
        this.#element.classList.add('dates-selector');
        this.#element.innerHTML = ''; // Очистка содержимого

        this.#periodsContainer = document.createElement('div');
        this.#periodsContainer.classList.add('dates-selector__periods-container');
        this.#element.appendChild(this.#periodsContainer);

        this.#addBtn = document.createElement('button');
        this.#addBtn.type = 'button';
        this.#addBtn.classList.add('dates-selector__add-btn');
        this.#addBtn.classList.add('cooltip');
        this.#addBtn.setAttribute('data-tooltip', 'Добавить период');
        this.#addBtn.setAttribute('data-tooltip-delay', 400);
        this.#addBtn.textContent = this.#config.addButtonLabel;
        this.#addBtn.addEventListener('click', this.#boundAddPeriod);
        this.#element.appendChild(this.#addBtn);
    }

    #initializePeriods() {
        this.#periods = (this.#config.initialDates || []).map(p => this.#createPeriod(p));
    }

    #createPeriod(periodData) {
        return {
            id: periodData.id || this.#generateId(),
            start: periodData.start instanceof Date ? periodData.start : new Date(periodData.start || Date.now()),
            end: periodData.end instanceof Date ? periodData.end : new Date(periodData.end || Date.now()),
            ...periodData
        };
    }

    #updateUI() {
        const currentPeriodIds = new Set(this.#periods.map(p => p.id));
        const canDelete = this.#periods.length > this.#config.minDates;

        this.#removeStalePeriodBtns(currentPeriodIds);

        this.#periods.forEach(periodData => {
            const periodBtn = this.#periodBtns.get(periodData.id);
            if (!periodBtn) {
                this.#createPeriodBtn(periodData, canDelete);
            } else {
                periodBtn.setAllowDelete(canDelete);
            }
        });

        this.#toggleAddButton();
    }

    #removeStalePeriodBtns(currentIds) {
        for (const [id, periodBtn] of this.#periodBtns.entries()) {
            if (!currentIds.has(id)) {
                periodBtn.off('change', this.#boundHandlePeriodChange);
                periodBtn.off('delete', this.#boundHandlePeriodDelete);
                periodBtn.destroy();
                this.#periodBtns.delete(id);
            }
        }
    }

    #createPeriodBtn(periodData, canDelete) {
        const btnElement = document.createElement('div');
        const periodBtn = new PeriodBtn(btnElement, periodData, {
            allowDelete: canDelete,
            datePickerConfig: this.#config.datePickerConfig
        });
        periodBtn.on('change', this.#boundHandlePeriodChange);
        periodBtn.on('delete', this.#boundHandlePeriodDelete);
        this.#periodBtns.set(periodData.id, periodBtn);
        this.#periodsContainer.appendChild(btnElement);
    }

    #toggleAddButton() {
        this.#addBtn.style.display = this.#periods.length < this.#config.maxDates ? '' : 'none';
    }

    #addPeriod() {
        if (this.#periods.length >= this.#config.maxDates) return;

        const periodPickModal = new PeriodPickModal({
            callingElement: this.#addBtn,
            onRangeSelected: (start, end) => {
                const newPeriod = {
                    id: this.#generateId(),
                    start,
                    end
                };
                this.#periods.push(newPeriod);
                this.#updateUI();
                this._emit('period:added', { period: newPeriod });
            },
            datePickerConfig: {
                ...this.#config.datePickerConfig
            }
        });
        periodPickModal.open();
    }

    #handlePeriodChange(event) {
        const { period, oldPeriod } = event.detail;
        if (oldPeriod.start === period.start && oldPeriod.end === period.end) return;
        const index = this.#periods.findIndex(p => p.id === period.id);
        if (index !== -1) {
            this.#periods[index] = period;
            this._emit('period:changed', { id: period.id, oldPeriod, period });
        }
    }

    #handlePeriodDelete(event) {
        const { period } = event.detail;
        this.#periods = this.#periods.filter(p => p.id !== period.id);
        this._emit('period:deleted', { id: period.id, period });
        this.#updateUI();
    }

    getPeriods() {
        return this.#periods;
    }

    setPeriods(newPeriodsData) {
        const validatedPeriods = newPeriodsData
            .map(p => this.#createPeriod(p))
            .slice(0, this.#config.maxDates);

        while (validatedPeriods.length < this.#config.minDates) {
            validatedPeriods.push(this.#createPeriod({}));
        }

        this.#periods = validatedPeriods;
        this.#updateUI();
    }

    destroy() {
        this.#addBtn.removeEventListener('click', this.#boundAddPeriod);
        for (const periodBtn of this.#periodBtns.values()) {
            periodBtn.off('change', this.#boundHandlePeriodChange);
            periodBtn.off('delete', this.#boundHandlePeriodDelete);
            periodBtn.destroy();
        }
    }
}