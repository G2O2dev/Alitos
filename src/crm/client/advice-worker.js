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
        case 'periodResponse':
            const { sliceName, analytics } = data;
            periodsCache.set(sliceName, analytics);
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
const periodsCache = new Map();
async function getPeriod(from, to, deleted) {
    const cacheKey = getAnalyticSliceName(from, to, deleted);
    if (periodsCache.has(cacheKey)) {
        return periodsCache.get(cacheKey);
    }
    self.postMessage({ type: 'requestPeriod', data: { sliceName: cacheKey } });

    const analyticPromise = waitForMessage('periodResponse', e => e.data.data.sliceName === cacheKey)
        .then(response => response.data.analytics);

    periodsCache.set(cacheKey, analyticPromise);
    return await analyticPromise;
}

let projectsConfigCache = undefined;
async function getProjectsConfig() {
    if (projectsConfigCache) return projectsConfigCache;

    self.postMessage({ type: 'requestProjectsConfig' });
    projectsConfigCache = waitForMessage('projectsConfigResponse').then(response => response.data.config);

    return await projectsConfigCache;
}

let clientInfo = undefined;
async function getClientInfo() {
    if (clientInfo) return projectsConfigCache;

    self.postMessage({ type: 'requestClientInfo' });
    clientInfo = waitForMessage('clientInfoResponse').then(response => response.data.info);

    return await clientInfo;
}

let staticInfo = undefined;
let deletedStaticInfo = undefined;
async function getStaticData(deleted = false) {
    if (!deleted && staticInfo) return staticInfo;
    if (deleted && deletedStaticInfo) return deletedStaticInfo;

    self.postMessage({ type: 'requestStaticData', data: {deleted} });
    const resp = waitForMessage('staticDataResponse', e => e.data.data.deleted === deleted).then(response => response.data.staticData);
    if (deleted) {
        deletedStaticInfo = resp;
    } else {
        staticInfo = resp;
    }

    return await resp;
}

function *forEachDayAnalytic(startDate, endDate, deleted) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    while (start <= end) {
        yield getPeriod(start, start, deleted);
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
    // getLimitAdvice,
];
async function getAdvices() {
    for (const analyzer of adviceAnalyzers) {
        const advice = await analyzer();
        if (advice) {
            self.postMessage({ type: 'newAdvice', data: advice });
        }
    }
}

function calculateCR(total, leads) {
    if (total === 0 || !total) {
        return 0;
    }

    return (leads / total) * 100;
}
function calculateExponentiallySmoothed(CRs, alpha) {
    let smoothedCR = CRs[0];

    for (let i = 1; i < CRs.length; i++) {
        smoothedCR = alpha * CRs[i] + (1 - alpha) * smoothedCR;
    }

    return Math.round(smoothedCR * 100) / 100;
}
async function getInterestConversion() {
    const client = await getClientInfo();
    const now = new Date();
    let createdAt = new Date(Number(client.created_at) * 1000);

    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

    if (now.getTime() - createdAt.getTime() < TWO_WEEKS_MS) {
        const analytic = await getPeriod(createdAt, now);
        let totalProcessed = 0;
        let totalLeads = 0;
        for (const project of analytic) {
            totalProcessed += project.callCounts.processed;
            totalLeads += project.callCounts.leads.value;
        }
        return calculateCR(totalProcessed, totalLeads);
    }

    const nineMonthsAgo = new Date(now);
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
    if (createdAt < nineMonthsAgo) {
        createdAt = nineMonthsAgo;
    }

    const diffMonths = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
    let iterationCount;
    if (diffMonths < 1) {
        iterationCount = 2;
    } else if (diffMonths === 1) {
        iterationCount = 2;
    } else if (diffMonths === 2) {
        iterationCount = 3;
    } else if (diffMonths === 3) {
        iterationCount = 4;
    } else {
        iterationCount = 5;
    }

    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const step = Math.floor(diffDays / iterationCount);
    const stepMs = step * 24 * 60 * 60 * 1000;

    let stepsConversion = [];
    let lastEndTime = now;
    for (let i = 0; i < iterationCount; i++) {
        let startTime = new Date(lastEndTime.getTime() - stepMs);

        const analytic = await getPeriod(startTime, lastEndTime);

        let stepProcessed = 0;
        let stepLeads = 0;
        for (const project of analytic) {
            stepProcessed += project.callCounts.processed;
            stepLeads += project.callCounts.leads.value;
        }

        stepsConversion.push(calculateCR(stepProcessed, stepLeads));
        lastEndTime = startTime;
    }

    stepsConversion.reverse();
    return calculateExponentiallySmoothed(stepsConversion, 0.7);
}


async function getWantedNumbersAdvice() {
    const advice = {
        title: '',
        description: '',
        priority: advicePriority.Low,
        actions: [adviceActions.copy],
    };
    const config = await getProjectsConfig();
    const staticData = await getStaticData(false);

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);

    const daysPhones = [];
    for await (const period of forEachDayAnalytic(sevenDaysAgo, now, false)) {
        const index = daysPhones.length;
        daysPhones[index] = 0;

        for (const [id, analytic] of period) {
            const staticInfo = staticData.get(id);

            if (staticInfo.status === 1) {
                daysPhones[index] += analytic.processed;
            }
        }
    }
    // const daysPhones = await Promise.all(
    //     [...forEachDayAnalytic(sevenDaysAgo, now, false)].map(async analyticPromise => {
    //         const analytic = await analyticPromise;
    //         return analytic.reduce((sum, project) => {
    //             return project.state === "Активен"
    //                 ? sum + project.callCounts.processed
    //                 : sum;
    //         }, 0);
    //     })
    // );

    const workDaysCount = daysPhones.filter(day => day === 0).length || 1;


    const avgPhones = daysPhones.reduce((total, day) => total + day, 0) / workDaysCount;

    if (config.wantPhones === 0) {
        advice.title = 'Установить желаемое кол-во номеров';
        advice.description = `Вы не указали желаемое количество номеров, его установка поможет лучше понимать, когда масштабироваться, а когда наоборот, также, я буду лучше понимать ваши потребности и предлагать лучшие советы. ${avgPhones <= 5 || workDaysCount < 3 ? 'Рекомендую ставить относительно амбициозное количество, например, для начала 30 номеров' : `На основе среднего кол-ва номеров за последние дни рекомендую установить более ${pluralize(Math.round(avgPhones), "номер", "а", "а", "ов")}`}.`;

        return advice;
    }

    if (workDaysCount < 3 || avgPhones <= 5)
        return;
    const percentDiff = percentageDifference(config.wantPhones, avgPhones);

    if (percentDiff >= 20) {
        const suggested = Math.round(config.wantPhones * ((percentDiff + 100) / 100));

        advice.title = 'Увеличение желаемого кол-ва номеров';
        advice.description = `В среднем приходит по ${pluralize(avgPhones, "номер", "", "а", "ов")} в день, что на ~${Math.round(percentDiff)}% больше желаемого количества: ${config.wantPhones}. Предлагаю отключить/ограничить проекты что бы уложиться желаемое количество номеров или увеличить его до ${pluralize(suggested, "номер", "а", "а", "ов")}.`;

        advice.actions.push({
            name: `Установить ${suggested}`,
        });

        advice.actions.push({
            name: "Установить своё",
        });

        return advice;
    } else if (percentDiff <= -20) {
        const suggested = Math.round(config.wantPhones * ((percentDiff + 100) / 100));

        advice.title = 'Проведение досбора';
        advice.description = `В среднем приходит по ${pluralize(avgPhones, "номер", "", "а", "ов")} в день, что на ~${Math.abs(Math.round(percentDiff))}% меньше желаемого количества: ${config.wantPhones}. Предлагаю принять меры по увеличению количества номеров (досбор, увелечения лимитов и тд.) или уменьшить желаемое количество до ${pluralize(suggested, "номер", "а", "а", "ов")}.`;

        return advice;
    }
}
async function getMissedAdvice() {
    const now = new Date();
    const twoDaysAgo = getDateOffset(now, -2);
    const sevenDaysAgo = getDateOffset(now, -6);

    let missedTotal = 0;
    let total = 0;

    for await (const period of forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)) {
        period.forEach(project => {
            missedTotal += project.missed.value;
            total += project.processed;
        });
    }

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
    const projects = await getStaticData(false);
    const groupedProjectIds = [];

    for (let [id, p] in projects) {
        if (p.status !== 1) return false;

        const sourcesCount = p.sources.length ?? (
            p.sources.hosts_content.length +
            p.sources.calls_content.length +
            p.sources.sms_content.length
        );

        if (sourcesCount > 1 && (p.project_type === "Звонки" || p.project_type === "Сайты")) {
            groupedProjectIds.push(id);
        }
    }

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

    let noStatusTotal = 0;
    let total = 0;

    for await (const analytic of forEachDayAnalytic(sevenDaysAgo, twoDaysAgo, false)) {
        let statusedLocal = 0;
        let totalLocal = 0;

        analytic.forEach(project => {
            statusedLocal += project.missed.value;
            statusedLocal += project.declined.value;
            statusedLocal += project.leads.value;

            totalLocal += project.processed;
        });

        total += totalLocal;
        noStatusTotal += totalLocal - statusedLocal;
    }

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
    // const iConversion = await getInterestConversion();
    // console.log(iConversion);

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