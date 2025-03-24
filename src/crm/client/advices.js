import session from "./session.js";
import {percentageDifference, pluralize} from "../utils/helpers.js";

export const advicePriority = Object.freeze({
    Low: "low",
    Medium: "medium",
    High: "high"
});
const adviceBasicActions = Object.freeze({
    Copy: {
        name: "Копировать",
        action: (advice) => {
            navigator.clipboard.writeText(advice.description);
        },
    },
});

const getDateOffset = (baseDate, offsetDays) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offsetDays);
    return date;
};

class AdviceSystem {
    #advices = [];
    #isLoading = false;
    #isLoaded = false;
    #eventTarget = new EventTarget();
    #adviceAnalyzers = {
        limitAdvice: () => this.#getLimitAdvice(),
        wantedNumbersAdvice: () => this.#getWantedNumbersAdvice(),
        ungroupAdvice: () => this.#getUngroupAdvice(),
        missedAdvice: () => this.#getMissedAdvice(),
        statusAdvice: () => this.#getStatusAdvice(),
    }

    async #getAdvices() {
        this.#isLoading = true;
        this.#isLoaded = false;

        const analyzerPromises = Object.values(this.#adviceAnalyzers).map(fn => fn());

        for (const analyzerPromise of analyzerPromises) {
            const result = await analyzerPromise;
            if (result) {
                this.#advices.push(result);
                this.#emitEvent('new-advice', { advice: result });
            }
        }

        this.#isLoaded = true;
        this.#isLoading = false;
        this.#emitEvent('load-complete');
    }

    #emitEvent(eventName, detail = {}) {
        this.#eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
    #inlineProjects(projects) {
        return `<span class="advices__inlined-projects">${projects.join(', ')}</span>`;
    }

    getAdvices() {
        if (!this.#isLoading && !this.#isLoaded) {
            this.#isLoading = true;
            this.#getAdvices();
        }

        return this.#advices;
    }

    isLoading() {
        return this.#isLoading;
    }

    //#region Events
    on(eventName, callback) {
        this.#eventTarget.addEventListener(eventName, callback);
    }
    off(eventName, callback) {
        this.#eventTarget.removeEventListener(eventName, callback);
    }

    onNewAdvice(callback) {
        this.#eventTarget.addEventListener('new-advice', callback);
    }
    onAdviceComplete(callback) {
        this.#eventTarget.addEventListener('advice-complete', callback);
    }
    onLoadComplete(callback) {
        if (this.#isLoaded) {
            callback();
            return;
        }

        this.#eventTarget.addEventListener('load-complete', callback);
    }

    offNewAdvice(callback) {
        this.#eventTarget.addEventListener('new-advice', callback);
    }
    offAdviceComplete(callback) {
        this.#eventTarget.addEventListener('advice-complete', callback);
    }
    offLoadComplete(callback) {
        this.#eventTarget.removeEventListener('load-complete', callback);
    }
    //#endregion

    //#region Analysers
    async #getLimitAdvice() {
        const description = `
        `;

        const base = {
            title: 'Увеличение лимитов',
            description: description,

            priority: advicePriority.Medium,

            actions: [
                adviceBasicActions.Copy,
                {
                    name: "Смотреть проекты",
                    action: (advice) => {

                    }
                },
                {
                    name: "Применить",
                    class: 'primary',
                    action: (advice) => {

                    }
                },
            ]
        }
    }
    async #getWantedNumbersAdvice() {
        const advice = {
            title: '',
            description: '',
            priority: advicePriority.Low,
            actions: [adviceBasicActions.Copy],
        };
        const config = await session.getProjectsConfig();

        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 6);

        const daysPhones = await Promise.all(
            [...session.forEachDayAnalytic(sevenDaysAgo, now, false)].map(async analyticPromise => {
                const analytic = await analyticPromise;
                return analytic.reduce((sum, project) => {
                    return project.state === "Активен"
                        ? sum + project.callCounts.processed
                        : sum;
                }, 0);
            })
        );

        const workDaysCount = daysPhones.filter(day => day === 0).length || 1;


        const avgPhones = daysPhones.reduce((total, day) => total + day, 0) / workDaysCount;

        if (config.wantPhones === 0) {
            advice.title = 'Установить желаемое кол-во номеров';
            advice.description = `Вы не указали желаемое количество номеров, его установка поможет лучше понимать, когда масштабироваться, а когда наоборот, также, я буду лучше понимать ваши потребности и предлагать лучшие советы. ${avgPhones <= 5 ? 'Рекомендую ставить относительно амбициозное количество, например, для начала 30 номеров' : `На основе среднего кол-ва номеров за последние дни рекомендую установить более ${pluralize(avgPhones, "номер", "а", "а", "ов")}`}.`;

            return advice;
        }

        if (workDaysCount < 3)
            return;
        const percentDiff = percentageDifference(avgPhones, config.wantPhones);

        if (percentDiff >= 20) {
            const suggested = Math.round(config.wantPhones * ((percentDiff + 100) / 100));

            advice.title = 'Увеличение желаемого кол-ва номеров';
            advice.description = `В среднем приходит по ${pluralize(avgPhones, "номер", "", "а", "ов")} в день, что на ~${Math.round(percentDiff)}% больше желаемого количества - ${config.wantPhones}. Предлагаю отключить/ограничить проекты что бы уложиться желаемое количество номеров или увеличить его до ${pluralize(suggested, "номер", "а", "а", "ов")}.`;

            advice.actions.push({
                name: `Установить ${suggested}`,
                action: (advice) => {

                }
            });

            advice.actions.push({
                name: "Установить своё",
                action: (advice) => {

                }
            });

            return advice;
        } else if (percentDiff <= 20) {
            const suggested = Math.round(config.wantPhones * ((percentDiff + 100) / 100));

            advice.title = 'Проведение досбора';
            advice.description = `В среднем приходит по ${pluralize(avgPhones, "номер", "", "а", "ов")} в день, что на ~${Math.abs(Math.round(percentDiff))}% меньше желаемого количества - ${config.wantPhones}. Предлагаю принять меры по увеличению количества номеров (досбор, увелечения лимитов и тд.) или уменьшить желаемое количество до ${pluralize(suggested, "номер", "а", "а", "ов")}.`;

            return advice;
        }
    }
    async #getMissedAdvice() {
        const now = new Date();
        const twoDaysAgo = getDateOffset(now, -2);
        const sevenDaysAgo = getDateOffset(now, -6);

        const analytics = await Promise.all([
            ...session.forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)
        ]);

        let missedTotal = 0;
        let total = 0;

        analytics.forEach(analytic => {
            analytic.forEach(project => {
                missedTotal += project.callCounts.missed.value;
                total += project.callCounts.processed;
            });
        });

        if (total < 15) return;

        const missedPercent = (missedTotal / total) * 100;

        if (missedPercent > 35) {
            const priority = missedPercent < 45 ? advicePriority.Low : advicePriority.Medium;
            const config = await session.getProjectsConfig();

            const actionText = config.isCallCenter
                ? "написать ответственному за колл-центр и попросить обзвонить номера ещё раз"
                : "попробовать прозвонить недозвоны ещё раз";

            return {
                title: 'Высокий % недозвона',
                description: `За последнюю неделю, не считая последние 2 дня, процент недозвона ${Math.round(missedPercent)}%, что много. Предлагаю ${actionText}.`,
                priority: priority,
                actions: [adviceBasicActions.Copy],
            };
        }
    }
    async #getUngroupAdvice() {
        const today = new Date();
        const projects = await session.getAnalytic(today, today, false);
        const groupedProjectIds = projects
            .filter(project => project.state === "Активен" && project.sources.length > 1 && (project.project_type === "Звонки" || project.project_type === "Сайты"))
            .map(project => project.id);

        if (!groupedProjectIds.length) return;

        return {
            title: 'Разгруппировка источников',
            description: `Активные проекты: ${this.#inlineProjects(groupedProjectIds)} содержат несколько источников. Предлагаю разгруппировать их, создав отдельный проект для каждого источника. Это позволит лучше анализировать конверсию и принимать оптимальные решения.`,
            priority: advicePriority.Medium,
            actions: [adviceBasicActions.Copy],
        };
    }
    async #getStatusAdvice() {
        const now = new Date();
        const twoDaysAgo = getDateOffset(now, -2);
        const sevenDaysAgo = getDateOffset(now, -6);

        const analytics = await Promise.all([...session.forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)]);

        let noStatusTotal = 0;
        let total = 0;

        analytics.forEach(analytic => {
            let statusedLocal = 0;
            let totalLocal = 0;

            analytic.forEach(project => {
                statusedLocal += project.callCounts.missed.value;
                statusedLocal += project.callCounts.declined.value;
                statusedLocal += project.callCounts.leads.value;

                totalLocal += project.callCounts.processed;
            });

            total += totalLocal;
            noStatusTotal += totalLocal - statusedLocal;
        });

        if (noStatusTotal < 5) return;
        const config = await session.getProjectsConfig();

        if (config.isCallCenter) {
            return {
                title: `${pluralize(noStatusTotal, 'номер', '', 'а', 'ов')} не обзвонили`,
                description: `За последнюю неделю, не считая последние 2 дня, вижу, что по ${pluralize(noStatusTotal, 'номер', 'у', 'ам', 'ам')} не был выставлен статус. Так как вы используете колл-центр, это может быть связано с ошибкой в системе, предлагаю написать ответственному за колл-центр и уточнить в чём дело.`,
                priority: advicePriority.High,
                actions: [adviceBasicActions.Copy],
            };
        }
    }

    async #getOverlimitAdvice() {

    }
    async #getCollectionAdvice() {

    }
    async #getLowConversionAdvice() {

    }
    async #getWrongSourceAdvice() {

    }
    async #getDeletedUsedAgainAdvice() {

    }
    async #getToManyNewSourcesAdvice() {

    }
    async #getZeroNumbersAdvice() {

    }
    async #getConversionProjectsEnableAdvice() {

    }
    async #getNotEnoughTestedAdvice() {
        // которые слишком рано отключили не получив выборку
    }
    //#endregion
}


const adviceSystem = Object.freeze(new AdviceSystem());
export default adviceSystem;