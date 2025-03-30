import { Page } from '../Page.js';
import { AnalyticGrid } from "./grid/AnalyticGrid.js";
import { ToggleBtn } from "../../../components/toggle-btn/toggle-btn.js";
import session from "../../client/session.js";
import { SearchComponent } from "../../../components/search/search.js";
import {AdviceModal} from "./AdviceModal.js";
import adviceSystem from "../../client/advices.js";
import {PeriodBtn} from "../../../components/period-btn/period-btn.js";
import {TaskTracker} from "../../../lib/task-tracker.js";
import {Loader} from "../../../components/loader/loader.js";

export class ProjectPage extends Page {
    #periods;
    #periodsEl;
    #periodsAddBtn;
    #gridLoaded = false;
    #gridLoading = false;
    #deletedLoaded = false;
    #usedCrmColumns;

    #adviceModal;
    #collectionsModal;

    taskTracker = new TaskTracker();

    constructor() {
        super('projects');
        this.loader = new Loader('.project-loader');
        this.#periods = this.#getDefaultPeriods();
        this.gridManager = new AnalyticGrid({
            selector: "#grid",
            periods: this.#periods,
        });
        this.#setupEvents();

        this.#setupPeriodBtns();
        this.#initSearch();

        this.#startLoading();
    }

    #startLoading() {
        this.taskTracker.addTasks([
            {
                method: () => this.loadAnalytics(false),
                info: { loaderText: 'Загружаю аналитику' }
            },
            {
                method: () => this.loadProjectInfo(false),
                info: { loaderText: 'Загружаю настройки проектов' }
            },
            // {
            //     method: () => this.loadProjectInfo(false),
            //     info: { loaderText: 'Выстраиваю хролонологии изменений' }
            // },
            {
                method: () => this.#loadLimitRate(false),
                info: { loaderText: 'Анализирую лимиты' }
            },
            {
                method: () => adviceSystem.waitForLoadComplete(),
                info: { loaderText: 'Думаю над рекомендациями' }
            },
        ]);
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

        adviceSystem.on("adviceAdded", () => this.onAdvicesCountChanged());
        adviceSystem.on("adviceRemoved", () => this.onAdvicesCountChanged());

        this.taskTracker.on("start", () => this.setLoading(true));
        this.taskTracker.on("finish", () => {
            this.setLoading(false);
            this.loader.stop();
        });

        this.taskTracker.on("taskStart", (task) => this.loader.setText(task.info.loaderText));
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
        await this.#applyAnalyticToRows(analytic, index);
    }
    #addPeriod(from, to) {

    }

    #getDefaultPeriods() {
        const now = new Date();
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        now.setHours(0, 0, 0, 0);
        weekAgo.setHours(0, 0, 0, 0);

        return [
            { from: weekAgo, to: now, name: "Неделя" }
        ];
    }

    #applyAnalyticToRows(analytic, periodIndex) {
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
    #applyProjectInfoToRows(projectsInfo) {
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
        if (!rows.size) return;

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);

        const limitTouches = new Map();
        for (const analyticPromise of session.forEachDayAnalytic(sevenDaysAgo, now, deleted)) {
            const analytic = await analyticPromise;

            analytic.forEach(({ id, callCounts }) => {
                const project = rows.get(id);
                if (project && callCounts.processed >= project.limit) {
                    limitTouches.set(id, (limitTouches.get(id) || 0) + 1);
                }
            });
        }

        for (let touch of limitTouches) {
            const project = rows.get(touch[0]);
            if (touch[1] >= 3) {
                project.limitState = "warning";
            } else if (touch[1] > 0) {
                project.limitState = "hint";
            }
        }

        const managerInfo = await session.getManagerInfo();
        if (managerInfo?.role === "Manager") {
            try {
                const limitPotential = await session.getLimitPotential(now);
                limitPotential.forEach(({ id, cnt_without_limit_filter }) => {
                    const project = rows.get(id);
                    if (project) {
                        project.limitPotential = cnt_without_limit_filter;
                    }
                });
            } catch (e) {
                console.error(e);
            }
        }

        this.gridManager.refreshCells();
    }


    async loadAnalytics(deleted) {
        for (let i = 0; i < this.#periods.length; i++) {
            const period = this.#periods[i];
            const analytic = await session.getAnalytic(period.from, period.to, deleted);
            this.#applyAnalyticToRows(analytic, i);
        }
    }
    async loadProjectInfo(deleted) {
        const projectInfo = await session.getProjects(deleted);
        this.#applyProjectInfoToRows(projectInfo);
    }
    async getUsedStatuses() {
        if (!this.#usedCrmColumns) {
            const client = await session.getClient();

            const now = new Date();
            const createdAt = new Date(Number(client.created_at) * 1000);
            const allTimeAnalytic = await session.getAnalytic(createdAt, now, false);

            const usedStatuses = new Map();
            for (const project of allTimeAnalytic) {
                for (const key in project.callCounts) {
                    const value = project.callCounts[key]?.value;
                    if (value !== undefined && value !== 0) {
                        usedStatuses.set(key, true);
                    }
                }
            }

            this.#usedCrmColumns = [...usedStatuses.keys()];
            this.#usedCrmColumns = this.#usedCrmColumns.filter(status => !['leads', 'missed', 'declined'].includes(status));
        }

        return this.#usedCrmColumns;
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
        toggleSourceGrouping: () => this.toggleSourceGrouping(),
        toggleCrmStatuses: () => this.toggleCrmStatuses(),
    };

    async toggleCrmStatuses() {
        if (!this.#usedCrmColumns) {
            this.taskTracker.addTask({
                method: async () => {
                    const used = await this.getUsedStatuses();
                    this.gridManager.toggleCrmStatuses(used);
                },
                info: { loaderText: 'Получаю используемые статусы' },
                parallel: true
            });
        } else {
            this.gridManager.toggleCrmStatuses(this.#usedCrmColumns);
        }
    }

    async toggleDeleted() {
        this.gridManager.deletedShown = !this.gridManager.deletedShown;

        const btn = document.querySelector('[data-action="toggleDeleted"]');
        btn._toggleInstance.setActive(this.gridManager.deletedShown);

        if (this.gridManager.deletedShown && !this.#deletedLoaded) {
            this.taskTracker.addTasks([
                {
                    method: () => this.loadAnalytics(true),
                    info: { loaderText: 'Загружаю аналитику удалённых проектов' }
                },
                {
                    method: () => this.loadProjectInfo(true),
                    info: { loaderText: 'Загружаю настройки удалённых проектов' }
                },
            ])
            this.#deletedLoaded = true;
        }
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

    //#endregion
}