const advicePriority = Object.freeze({
    Low: 'low',
    Medium: 'medium',
    High: 'high',
});
const adviceActions = Object.freeze({
    copy: {
        name: "Копировать",
        key: "copy",
    },
    viewProjects: {
        name: "Смотреть проекты",
        key: "viewProjects",
    },
    apply: {
        name: "Применить",
        key: "apply",
        class: 'primary',
    },
});

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    switch (type) {
        case 'getAdvices':
            await getAdvices();
            self.postMessage({ type: 'loadComplete' });
            break;
        case 'analyticResponse':
            const { sliceName, analytics } = data;
            analyticsCache.set(sliceName, analytics);
            break;
    }
});

//#region Helpers
function inlineProjects(projects) {
    return `<span class="advices__inlined-projects">${projects.join(', ')}</span>`;
}

function pluralize(number, base, suffixOne, suffixFew, suffixMany) {
    const pluralRules = new Intl.PluralRules("ru-RU");
    const rule = pluralRules.select(number);

    let suffix;
    if (rule === "one") {
        suffix = suffixOne;
    } else if (rule === "few") {
        suffix = suffixFew;
    } else {
        suffix = suffixMany;
    }

    return `${number} ${base}${suffix}`;
}

function percentageDifference(base, compared) {
    return ((compared - base) / base) * 100;
}

function toLocalISOString(date) {
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - userTimezoneOffset).toISOString();
}

function formatDate(date) {
    return toLocalISOString(date).split("T")[0];
}

function getAnalyticSliceName(from, to, deleted) {
    const fromFormated = formatDate(from);
    const toFormated = formatDate(to);

    return `start=${fromFormated}&end=${toFormated}${deleted ? "&type=deleted" : ""}`;
}

function getDateOffset(baseDate, offsetDays) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offsetDays);
    return date;
}
//#endregion

//#region Communicator
const analyticsCache = new Map();
async function getAnalytic(from, to, deleted) {
    const cacheKey = getAnalyticSliceName(from, to, deleted);
    if (analyticsCache.has(cacheKey)) {
        return analyticsCache.get(cacheKey);
    }
    self.postMessage({ type: 'requestAnalytics', data: { sliceName: cacheKey } });

    const analyticPromise = waitForMessage('analyticsResponse', e => e.data.data.sliceName === cacheKey)
        .then(response => response.data.analytics);

    analyticsCache.set(cacheKey, analyticPromise);
    return await analyticPromise;
}

let projectsConfigCache = undefined;
async function getProjectsConfig() {
    if (projectsConfigCache) return projectsConfigCache;

    self.postMessage({ type: 'requestProjectsConfig' });
    projectsConfigCache = waitForMessage('projectsConfigResponse').then(response => response.data.config);

    return await projectsConfigCache;
}

function *forEachDayAnalytic(startDate, endDate, deleted) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    while (start <= end) {
        yield getAnalytic(start, start, deleted);
        start.setDate(start.getDate() + 1);
    }
}

function waitForMessage(type, predicate = (e) => true, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const listener = (event) => {
            if (event.data.type === type && predicate(event)) {
                self.removeEventListener('message', listener);
                resolve(event.data);
            }
        };
        self.addEventListener('message', listener);

        setTimeout(() => {
            self.removeEventListener('message', listener);
            reject(new Error(`Timeout waiting for message: ${type}`));
        }, timeout);
    });
}
//#endregion


//#region Analyzers
const adviceAnalyzers = [
    getWantedNumbersAdvice,
    getMissedAdvice,
    getUngroupAdvice,
    getStatusAdvice,
];
async function getAdvices() {
    for (const analyzer of adviceAnalyzers) {
        const advice = await analyzer();
        if (advice) {
            self.postMessage({ type: 'newAdvice', data: advice });
        }
    }
}


async function getWantedNumbersAdvice() {
    const advice = {
        title: '',
        description: '',
        priority: advicePriority.Low,
        actions: [adviceActions.copy],
    };
    const config = await getProjectsConfig();

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);

    const daysPhones = await Promise.all(
        [...forEachDayAnalytic(sevenDaysAgo, now, false)].map(async analyticPromise => {
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
        });

        advice.actions.push({
            name: "Установить своё",
        });

        return advice;
    } else if (percentDiff <= 20) {
        const suggested = Math.round(config.wantPhones * ((percentDiff + 100) / 100));

        advice.title = 'Проведение досбора';
        advice.description = `В среднем приходит по ${pluralize(avgPhones, "номер", "", "а", "ов")} в день, что на ~${Math.abs(Math.round(percentDiff))}% меньше желаемого количества - ${config.wantPhones}. Предлагаю принять меры по увеличению количества номеров (досбор, увелечения лимитов и тд.) или уменьшить желаемое количество до ${pluralize(suggested, "номер", "а", "а", "ов")}.`;

        return advice;
    }
}
async function getMissedAdvice() {
    const now = new Date();
    const twoDaysAgo = getDateOffset(now, -2);
    const sevenDaysAgo = getDateOffset(now, -6);

    const analytics = await Promise.all([
        ...forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)
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
        const config = await getProjectsConfig();

        const actionText = config.isCallCenter
            ? "написать ответственному за колл-центр и попросить обзвонить номера ещё раз"
            : "попробовать прозвонить недозвоны ещё раз";

        return {
            title: 'Высокий % недозвона',
            description: `За последнюю неделю, не считая последние 2 дня, процент недозвона ${Math.round(missedPercent)}%, что много. Предлагаю ${actionText}.`,
            priority: priority,
            actions: [adviceActions.copy],
        };
    }
}
async function getUngroupAdvice() {
    const today = new Date();
    const projects = await getAnalytic(today, today, false);
    const groupedProjectIds = projects
        .filter(project => project.state === "Активен" && project.sources.length > 1 && (project.project_type === "Звонки" || project.project_type === "Сайты"))
        .map(project => project.id);

    if (!groupedProjectIds.length) return;

    return {
        title: 'Разгруппировка источников',
        description: `Активные проекты: ${inlineProjects(groupedProjectIds)} содержат несколько источников. Предлагаю разгруппировать их, создав отдельный проект для каждого источника. Это позволит лучше анализировать конверсию и принимать оптимальные решения.`,
        priority: advicePriority.Medium,
        actions: [adviceActions.copy],
    };
}
async function getStatusAdvice() {
    const now = new Date();
    const twoDaysAgo = getDateOffset(now, -2);
    const sevenDaysAgo = getDateOffset(now, -6);

    const analytics = await Promise.all([...forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)]);

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
    const config = await getProjectsConfig();

    if (config.isCallCenter) {
        return {
            title: `${pluralize(noStatusTotal, 'номер', '', 'а', 'ов')} не обзвонили`,
            description: `За последнюю неделю, не считая последние 2 дня, вижу, что по ${pluralize(noStatusTotal, 'номер', 'у', 'ам', 'ам')} не был выставлен статус. Так как вы используете колл-центр, это может быть связано с ошибкой в системе, предлагаю написать ответственному за колл-центр и уточнить в чём дело.`,
            priority: advicePriority.High,
            actions: [adviceActions.copy],
        };
    }
}


async function getLimitAdvice() {
    const description = ``;

    const base = {
        title: 'Увеличение лимитов',
        description: description,

        priority: advicePriority.Medium,

        actions: [
            adviceActions.copy,
            {
                name: "Смотреть проекты",
            },
            {
                name: "Применить",
                class: 'primary',
            },
        ]
    }
}
async function getOverlimitAdvice() {

}
async function getCollectionAdvice() {

}
async function getLowConversionAdvice() {

}
async function getWrongSourceAdvice() {

}
async function getDeletedUsedAgainAdvice() {

}
async function getToManyNewSourcesAdvice() {

}
async function getZeroNumbersAdvice() {

}
async function getConversionProjectsEnableAdvice() {

}
async function getNotEnoughTestedAdvice() {
    // которые слишком рано отключили не получив выборку
}
//#endregion