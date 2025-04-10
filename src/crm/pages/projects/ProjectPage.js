import {Page} from '../Page.js';
import {AnalyticGrid} from "./grid/AnalyticGrid.js";
import {ToggleBtn} from "../../../components/toggle-btn/toggle-btn.js";
import crmSession from "../../client/crm-session.js";
import {SearchComponent} from "../../../components/search/search.js";
import {AdviceModal} from "./AdviceModal.js";
import adviceSystem from "../../client/advices.js";
import {PeriodBtn} from "../../../components/period-btn/period-btn.js";
import {TaskTracker} from "../../../lib/task-tracker.js";
import {Loader} from "../../../components/loader/loader.js";
import {ProjectFastActions} from "./ProjectFastActions.js";

export class ProjectPage extends Page {
    #periods;
    #periodsEl;
    #periodsAddBtn;
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

        this.#setupFastActions();

        this.#setupEvents();

        this.#setupPeriodBtns();
        this.#initSearch();

        this.#startLoading();
    }

    #setupFastActions() {
        this.fastActions = new ProjectFastActions('.projects-fast-actions', {
            actionItems: [
                // {
                //     label: "Установить лимит",
                //     value: "setLimit",
                //     tooltip: "Устанавливает указанный лимит для выбранных проектов",
                //     inputConfig: {
                //         mode: "number",
                //         allowNegative: false,
                //         allowPercent: false,
                //         min: 0,
                //         placeholder: "Новый лимит",
                //         tooltip: "Ойойоой"
                //     },
                //     callback: async (newLimit) => {
                //         this.taskTracker.addTask({
                //             method: async () => this.#applyToSelected(async (selected) => {
                //                 for (const project of selected) {
                //                     project.projectData.limit = newLimit;
                //                     await session.updateProject(project.projectData);
                //                 }
                //             }),
                //             info: {loaderText: 'Включаю проекты'},
                //             parallel: true
                //         });
                //     }
                // },
                // {
                //     label: "Корректировать лимит",
                //     value: "correctLimit",
                //     tooltip: "Принимает положительное, отрицательное значение, и значение со знаком %, применяет значение к лимиту каждого выбранного проекта",
                //     inputConfig: {
                //         mode: "number",
                //         allowNegative: true,
                //         allowPercent: true,
                //         min: 0,
                //         placeholder: "Корректировка лимита"
                //     },
                // },
                // {
                //     label: "Установить имя",
                //     value: "setName",
                //     inputConfig: {
                //         mode: "text",
                //         placeholder: "Новое имя"
                //     },
                // },
                // {
                //     label: "Установить тег",
                //     value: "setTag",
                //     tooltip: "Новый тег в формате ...",
                //     inputConfig: {
                //         mode: "text",
                //         placeholder: "Новый тег"
                //     },
                // },
                // {
                //     label: "Отключить",
                //     value: "disable",
                //     callback: async () => {
                //         this.taskTracker.addTask({
                //             method: async () => this.#applyToSelected(async (selected) => {
                //                 const selectedIds = selected.map(i => i.id);
                //
                //                 await crmSession.disableProjects(selectedIds);
                //
                //                 for (const project of selected) {
                //                     project.status = 0;
                //                 }
                //             }),
                //             info: {loaderText: 'Отключаю проекты'},
                //             parallel: true
                //         });
                //     }
                // },
                // {
                //     label: "Включить",
                //     value: "enable",
                //     callback: async () => {
                //         this.taskTracker.addTask({
                //             method: async () => this.#applyToSelected(async (selected) => {
                //                 const selectedIds = selected.map(i => i.id);
                //
                //                 await crmSession.enableProjects(selectedIds);
                //
                //                 for (const project of selected) {
                //                     project.static.status = 1;
                //                 }
                //             }),
                //             info: {loaderText: 'Включаю проекты'},
                //             parallel: true
                //         });
                //     }
                // }
            ]
        });

        this.gridManager.on('selectionChanged', () => {
            if (this.gridManager.gridApi.getSelectedRows().length > 0) {
                this.fastActions.show();
            } else {
                this.fastActions.hide();
            }
        });
    }

    async #applyToSelected(fn) {
        const selected = this.gridManager.gridApi.getSelectedRows();

        await fn(selected);

        this.gridManager.gridApi.deselectAll();

        this.gridManager.gridApi.refreshCells({
            rowNodes: selected,
            force: true
        });
    }

    #startLoading() {
        this.taskTracker.addTasks([
            {
                method: () => this.loadAnalytics(false),
                info: {loaderText: 'Загружаю аналитику'}
            },
            {
                method: () => this.loadProjectInfo(false),
                info: {loaderText: 'Загружаю настройки проектов'}
            },
            // {
            //     method: () => this.loadProjectInfo(false),
            //     info: { loaderText: 'Выстраиваю хролонологии изменений' }
            // },
            {
                method: () => this.#loadLimitRate(false),
                info: {loaderText: 'Анализирую лимиты'}
            },
            // {
            //     method: () => adviceSystem.waitForLoadComplete(),
            //     info: {loaderText: 'Думаю над рекомендациями'}
            // },
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
                onChanged: async (newPeriodData) => await this.#changePeriod(i, newPeriodData),
            });

            btns.push(btn);
            this.#periodsEl.appendChild(periodBtn);

            crmSession.getClient().then(client => {
                const now = new Date();
                const createdAt = new Date(Number(client.created_at) * 1000);
                createdAt.setHours(0, 0, 0, 0);


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

        // this.taskTracker.on("start", () => this.setLoading(true));
        this.taskTracker.on("finish", () => {
            // this.setLoading(false);
            this.loader.stop();
        });

        this.taskTracker.on("taskStart", () => this.#updateLoaderText());
        this.taskTracker.on("taskEnd", () => this.#updateLoaderText());
        this.taskTracker.on("taskCanceled", () => this.#updateLoaderText());
    }

    #updateLoaderText() {
        const tasks = this.taskTracker.getActiveTasks().sort((a, b) => {
            if (a.parallel && !b.parallel) return -1;
            if (!a.parallel && b.parallel) return 1;
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return 0;
        });

        if (tasks.length) this.loader.setText(tasks[0].info.loaderText);
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


    #getDefaultPeriods() {
        const now = new Date();
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        now.setHours(0, 0, 0, 0);
        weekAgo.setHours(0, 0, 0, 0);

        return [
            {from: weekAgo, to: now, name: "Неделя"}
        ];
    }

    #deletePeriod(index) {

    }

    async #changePeriod(index, newPeriodData) {
        this.#periods[index] = {from: newPeriodData.from, to: newPeriodData.to, name: newPeriodData.name};

        const period = this.#periods[index];

        if (period.analytic) this.taskTracker.cancelTask(period.analytic.task.id);

        period.analytic = this.taskTracker.addTask({
            method: async () => {
                const analytic = [];
                analytic.push(...await crmSession.getAnalytic(period.from, period.to, false));
                if (this.#deletedLoaded) {
                    analytic.push(...await crmSession.getAnalytic(period.from, period.to, true));
                }

                return analytic;
            },
            info: {loaderText: `Загружаю данные за ${period.name.toLowerCase()}`},
            callback: analytic => this.#applyPeriodToGrid(analytic, index),
            parallel: true,
        });
    }

    #addPeriod(from, to) {

    }

    async #applyPeriodToGrid(analytic, periodIndex) {
        const newRows = [];
        const staticData = await crmSession.getStaticData();
        const rowsMap = this.gridManager.rows;

        for (const [pId, periodData] of analytic) {
            const existingRow = rowsMap.get(pId);
            if (existingRow) {
                existingRow.periods[periodIndex] = periodData;
            } else {
                const periodsData = [];
                periodsData[periodIndex] = periodData;
                newRows.push({
                    periods: periodsData,
                    static: staticData.get(pId),
                });
            }
        }

        const newRowsLen = newRows.length;
        if (newRowsLen)
            this.gridManager.addRows(newRows);

        if (rowsMap.size !== newRowsLen)
            this.gridManager.refreshCells();

        if (this.gridManager.sourcesGrouping)
            this.gridManager.gridApi.refreshClientSideRowModel('aggregate');
    }
    #applyFullStaticDataToGrid(projectsInfo) {
        for (const staticData of projectsInfo.values()) {
            const rowData = this.gridManager.rows.get(staticData.id);
            rowData.static = staticData;
        }

        this.gridManager.refreshCells();
    }

    async #loadLimitRate(deleted) {
        const rows = this.gridManager.rows;
        if (!rows.size) return;

        const current = new Date();
        const today = new Date(current);
        // Если менее 7 утра, то берём за день назад так как не вся аналитика и данные пришли
        if (current.getHours() < 7) {
            today.setDate(today.getDate() - 1);
        }

        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);

        const limitTouches = new Map();
        for await (const analytic of crmSession.forEachDayAnalytic(startDate, today, deleted)) {
            for (let [id, callCounts] of analytic) {
                const project = rows.get(id);
                if (project && callCounts.processed >= project.static.limit) {
                    limitTouches.set(id, (limitTouches.get(id) || 0) + 1);
                }
            }
        }

        for (let touch of limitTouches) {
            const project = rows.get(touch[0]);
            if (touch[1] >= 3) {
                project.static.limitState = "warning";
            } else if (touch[1] > 0) {
                project.static.limitState = "hint";
            }
        }

        const managerInfo = await crmSession.getManagerInfo();
        if (managerInfo?.role === "Manager") {
            try {
                for await (const limitPotential of crmSession.forEachDayLimitPotential(startDate, today)) {
                    limitPotential.forEach(({id, cnt_without_limit_filter}) => {
                        const project = rows.get(id);
                        if (project && cnt_without_limit_filter && (!project.static.limitPotential || project.static.limitPotential < cnt_without_limit_filter)) {
                            project.static.limitPotential = cnt_without_limit_filter;
                        }
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }

        this.gridManager.refreshCells();
    }

    async loadAnalytics(deleted) {
        let haveNewData = false;

        for (let i = 0; i < this.#periods.length; i++) {
            const period = this.#periods[i];

            const analytic = await crmSession.getAnalytic(period.from, period.to, deleted);
            if (analytic.size) {
                await this.#applyPeriodToGrid(analytic, i);
                haveNewData = true;
            }
        }

        return haveNewData;
    }

    async loadProjectInfo(deleted) {
        await crmSession.loadFullStaticData(deleted);
        const projectInfo = await crmSession.getStaticData();
        this.#applyFullStaticDataToGrid(projectInfo);
    }

    async getUsedStatuses() {
        const client = await crmSession.getClient();

        const now = new Date();
        const createdAt = new Date(Number(client.created_at) * 1000);
        const allTimeAnalytic = await crmSession.getAnalytic(createdAt, now, false);

        const usedStatuses = new Map();
        for (const callCounts of allTimeAnalytic.values()) {
            for (const status in callCounts) {
                const value = callCounts[status]?.value;
                if (value !== undefined && value !== 0) {
                    usedStatuses.set(status, true);
                }
            }
        }

        const usedCrmColumns = [...usedStatuses.keys()];
        return usedCrmColumns.filter(status => !['leads', 'missed', 'declined'].includes(status));
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

    #setToggleState(action, state) {
        const btn = document.querySelector(`[data-action="${action}"]`);
        if (btn?._toggleInstance) {
            btn._toggleInstance.setActive(state);
        }
    }

    async toggleCrmStatuses() {
        this.#setToggleState('toggleCrmStatuses', !this.gridManager.useCrmStatuses);

        if (!this.#usedCrmColumns) {
            this.#usedCrmColumns = this.taskTracker.addTask({
                method: async () => await this.getUsedStatuses(),
                info: {loaderText: 'Получаю используемые статусы'},
                parallel: true,
            });

            this.gridManager.toggleCrmStatuses(await this.#usedCrmColumns);
        } else {
            const used = await this.#usedCrmColumns;
            this.gridManager.toggleCrmStatuses(used);
        }
    }

    async toggleDeleted() {
        this.gridManager.deletedShown = !this.gridManager.deletedShown;
        this.#setToggleState('toggleDeleted', this.gridManager.deletedShown);

        if (this.gridManager.deletedShown && !this.#deletedLoaded) {
            const analyticHaveNewData = await this.taskTracker.addTask({
                method: () => this.loadAnalytics(true),
                info: {loaderText: 'Загружаю аналитику удалённых проектов'},
                parallel: true,
            });

            if (analyticHaveNewData) {
                await this.taskTracker.addTask({
                    method: () => this.loadProjectInfo(true),
                    info: {loaderText: 'Загружаю настройки удалённых проектов'},
                    parallel: true,
                });
            }

            this.#deletedLoaded = true;
        }
    }

    toggleSourceGrouping() {
        this.#setToggleState('toggleSourceGrouping', this.gridManager.toggleSourcesGrouping());
    }

    togglePercentSort() {
        this.#setToggleState('togglePercentSort', this.gridManager.togglePercentSort());
    }

    restoreHidden() {
    }

    refreshData() {
    }

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
        this.element.querySelector('.advice-btn').setAttribute('data-advice-count', adviceSystem.getAdvicesCount());
    }

    //#endregion
}