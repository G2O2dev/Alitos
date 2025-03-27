import { Page } from '../Page.js';
import { GridManager } from "../../utils/grid-manager.js";
import { ToggleBtn } from "../../../components/toggle-btn/toggle-btn.js";
import session from "../../client/session.js";
import { SearchComponent } from "../../../components/search/search.js";
import {AdviceModal} from "./AdviceModal.js";
import adviceSystem from "../../client/advices.js";
import {PeriodBtn} from "../../../components/period-btn/period-btn.js";

export class ProjectPage extends Page {
    #periods;
    #periodsEl;
    #periodsAddBtn;
    #gridLoaded = false;
    #gridLoading = false;
    #deletedLoaded = false;

    #adviceModal;
    #collectionsModal;

    constructor() {
        super('projects');
        this.#periods = this.#getDefaultPeriods();
        this.gridManager = new GridManager({
            selector: "#grid",
            periods: this.#periods,
        });
        this.#setupEvents();
    }
    show() {
        super.show();
        if (this.#gridLoaded || this.#gridLoading) return;
        this.#gridLoading = true;

        this.setLoading(true);
        this.#setupPeriodBtns();
        this.#initSearch();

        this.loadGridData(false).then(() => {
            this.setLoading(false);
            this.#gridLoaded = true;
        }).catch(this.#onError);
    }

    async #setupPeriodBtns() {
        this.#periodsEl = document.querySelector('.periods-settings');
        this.#periodsAddBtn = document.querySelector('.periods-settings__add-period');
        let btns = [];

        for (let i = 0; i < this.#periods.length; i++) {
            const period = this.#periods[i];

            const periodBtn = document.createElement("div");
            periodBtn.classList.add("periods-settings__period");

            const btn = new PeriodBtn(periodBtn, {
                firstDate: period.from,
                secondDate: period.to,
                allowDelete: false,

                onDelete: () => this.#deletePeriod(i),
                onChanged: async (newFrom, newTo) => {
                    this.setLoading(true);
                    await this.#changePeriod(i, newFrom, newTo)
                    this.setLoading(false);
                },
            });

            btns.push(btn);
            this.#periodsEl.appendChild(periodBtn);

            session.getClient().then(client => {
                const now = new Date();
                const createdAt = new Date(Number(client.created_at) * 1000);
                btns.forEach(btn => btn.setAllowedRange(createdAt, now));
            })
        }
    }
    #setupEvents() {
        this.element.querySelectorAll(".toggle-btn").forEach(btn => {
            btn._toggleInstance = new ToggleBtn(btn);
            btn.addEventListener("toggleRequest", () => {
                const action = btn.getAttribute("data-action");
                this.#toggleActions[action]();
            });
        });
        this.element.addEventListener("keydown", e => {
            if (e.code === "KeyP") {
                this.#toggleActions.togglePercentSort();
            }
        });

        this.element.querySelectorAll(".action-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const action = btn.getAttribute("data-action");
                this.#btnActions[action]();
            });
        });

        this.gridManager.onReset = () => {
            const btn = document.querySelector('[data-action="toggleSourceGrouping"]');
            btn._toggleInstance.setActive(false);
        };

        adviceSystem.onNewAdvice(() => this.onAdvicesCountChanged());
        adviceSystem.onLoadComplete(() => this.onAdvicesCountChanged());
    }
    #initSearch() {
        this.mainSearch = new SearchComponent(this.element.querySelector(".projects-search"));
        this.mainSearch.element.addEventListener("search-input", e => this.gridManager.search(e.detail.query));
        document.addEventListener("keydown", e => {
            if (this.isShown() && (e.ctrlKey || e.metaKey) && e.code === "KeyF") {
                e.preventDefault();
                this.mainSearch.input.focus();
            }
        });
    }
    #onError(err) {
        console.error(err);
    }


    #deletePeriod(index) {

    }
    async #changePeriod(index, newFrom, newTo) {
        this.#periods[index] = { from: newFrom, to: newTo, name: this.#periods[index].name };

        const period = this.#periods[index];
        const analytic = await session.getAnalytic(period.from, period.to, false);
        await this.#applyAnalyticToGridRows(analytic, index);
    }
    #addPeriod(from, to) {

    }

    #getDefaultPeriods() {
        const now = new Date();
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

        return [
            { from: weekAgo, to: now, name: "Неделя" }
        ];
    }

    #applyAnalyticToGridRows(analytic, periodIndex) {
        const newRows = [];
        analytic.forEach(project => {
            const existingRow = this.gridManager.rows.get(project.id);
            if (existingRow) {
                existingRow.periodsData[periodIndex] = project.callCounts;
            } else {
                project.periodsData = [project.callCounts];
                newRows.push(structuredClone(project));
            }
        });
        const newRowsLen = newRows.length;
        this.gridManager.addRows(newRows);
        if (this.gridManager.rows.size !== newRowsLen)
            this.gridManager.refreshCells();
    }
    #applyProjectInfoToGridRows(projectsInfo) {
        for (const project of projectsInfo) {
            if (this.gridManager.rows.has(project.id)) {
                const rowData = this.gridManager.rows.get(project.id);

                rowData.today_numbers = project.phones_cnt_now;
                rowData.duplicate_count = project.duplicate_cnt;
                rowData.today_duplicate_count = project.duplicate_cnt_now;
                rowData.send_status = project.state;
                rowData.regions_reverse = project.regions_reverse;
            }
        }

        this.gridManager.refreshCells();
    }
    async #loadLimitRate(deleted) {
        const rows = this.gridManager.rows;
        if (rows.size === 0) return;

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);

        const limitTouches = new Map();
        const dayAnalyticPromises = [];
        for (const analyticPromise of session.forEachDayAnalytic(sevenDaysAgo, now, deleted)) {
            dayAnalyticPromises.push(analyticPromise);
        }

        const daysData = await Promise.all(dayAnalyticPromises);
        for (const dayData of daysData) {
            for (const aProject of dayData) {
                const project = rows.get(aProject.id);

                if (project && aProject.callCounts.processed >= project.limit) {
                    limitTouches.set(aProject.id, (limitTouches.get(aProject.id) || 0) + 1);
                }
            }
        }

        for (const row of rows.values()) {
            const touches = limitTouches.get(row.id) || 0;

            if (touches >= 3) {
                row.limitState = "warning";
            } else if (touches > 0) {
                row.limitState = "hint";
            }
        }

        const managerInfo = await session.getManagerInfo();
        if (managerInfo?.role === "Manager") {
            try {
                const limitPotential = await session.getLimitPotential(new Date());
                for (const aProject of limitPotential) {
                    const project = rows.get(aProject.id);
                    if (project) {
                        project.limitPotential = aProject.cnt_without_limit_filter;
                    }
                }
            } catch (e) { console.error(e); }
        }

        this.gridManager.refreshCells();
    }

    async loadGridData(deleted) {
        for (let i = 0; i < this.#periods.length; i++) {
            const period = this.#periods[i];
            const analytic = await session.getAnalytic(period.from, period.to, deleted);
            this.#applyAnalyticToGridRows(analytic, i);
        }

        const projectInfo = await session.getProjects(deleted);
        this.#applyProjectInfoToGridRows(projectInfo);

        await this.#loadLimitRate(deleted);

        adviceSystem.getAdvices();
    }

    search(value) {
        this.mainSearch.search(value);
        this.gridManager.search(value);
    }

    //#region Toggle
    #toggleActions = {
        toggleDeleted: () => this.toggleDeleted(),
        togglePercentSort: () => this.togglePercentSort(),
        restoreHidden: () => this.restoreHidden(),
        refreshData: () => this.refreshData(),
        toggleSourceGrouping: () => this.toggleSourceGrouping()
    };

    async toggleDeleted() {
        this.setLoading(true);
        this.gridManager.deletedShown = !this.gridManager.deletedShown;

        const btn = document.querySelector('[data-action="toggleDeleted"]');
        btn._toggleInstance.setActive(this.gridManager.deletedShown);

        if (this.gridManager.deletedShown && !this.#deletedLoaded) {
            await this.loadGridData(true);
            this.#deletedLoaded = true;
        }
        this.setLoading(false);
    }

    toggleSourceGrouping() {
        const isGrouping = this.gridManager.toggleSourcesGrouping();
        const btn = document.querySelector('[data-action="toggleSourceGrouping"]');
        btn._toggleInstance.setActive(isGrouping);
    }

    togglePercentSort() {
        const newState = this.gridManager.togglePercentSort();
        const btn = document.querySelector('[data-action="togglePercentSort"]');
        btn._toggleInstance.setActive(newState);
    }

    restoreHidden() {}

    refreshData() {}
    //#endregion

    //#region Header buttons
    #btnActions = {
        openAdviceModal: () => this.openAdviceModal(),
        openCollectionsModal: () => this.openCollectionsModal(),
    };

    openAdviceModal() {
        if (!this.#adviceModal) {
            this.#adviceModal = new AdviceModal();
        }

        this.#adviceModal.open();
        this.#adviceModal.render();
    }
    onAdvicesCountChanged() {
        this.element.querySelector('.advice-btn').setAttribute('data-advice-count', adviceSystem.getAdvices().length);
    }

    openCollectionsModal() {

    }

    //#endregion
}