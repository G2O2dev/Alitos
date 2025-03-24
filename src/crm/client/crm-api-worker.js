function parseSources(content) {
    return content.replace(/"/g, "").split(",").map(s => s.trim());
}
function calcPercent(total, value) {
    return total === 0 ? 0 : Math.round((value / total) * 100);
}
function assocType(type) {
    return (
        {
            calls: "Звонки",
            hosts: "Сайты",
            hosthost: "Сайты (П)",
            sms: "СМС"
        }[type] || type
    );
}

function countCalls(project) {
    const {cnt: processed, cnt4, cnt6, cnt7, cnt8, cnt9, cnt11, cnt12, cnt14, cnt5, cnt10, cnt13} = project;
    const lead = cnt6 + cnt7 + cnt8 + cnt9 + cnt11 + cnt12;
    const missed = cnt14 + cnt5;
    const declined = cnt10 + cnt13;

    return {
        processed: processed,
        leads: {
            value: lead,
            percent: calcPercent(processed, lead),
        },
        missed: {
            value: missed,
            percent: calcPercent(processed, missed),
        },
        declined: {
            value: declined,
            percent: calcPercent(processed, declined),
        },
        crm_base: {
            value: cnt4,
            percent: calcPercent(processed, cnt4),
        },
        crm_missed: {
            value: cnt5,
            percent: calcPercent(processed, cnt5),
        },
        crm_conversation: {
            value: cnt6,
            percent: calcPercent(processed, cnt6),
        },
        crm_payexpect: {
            value: cnt7,
            percent: calcPercent(processed, cnt7),
        },
        crm_partner: {
            value: cnt8,
            percent: calcPercent(processed, cnt8),
        },
        crm_payed: {
            value: cnt9,
            percent: calcPercent(processed, cnt9),
        },
        crm_closed: {
            value: cnt10,
            percent: calcPercent(processed, cnt10),
        },
        crm_test: {
            value: cnt11,
            percent: calcPercent(processed, cnt11),
        },
        crm_hot: {
            value: cnt12,
            percent: calcPercent(processed, cnt12),
        },
        crm_forreplace: {
            value: cnt13,
            percent: calcPercent(processed, cnt13),
        },
        crm_finalymissed: {
            value: cnt14,
            percent: calcPercent(processed, cnt14),
        },
    };
}
function parseAnalytic(analyticHtml) {
    const match = analyticHtml.match(/projects:\s*(\[[\s\S]*?\])/);
    if (!match) {
        console.error("Analytic data not found", analyticHtml);
        return [];
    }

    const analytic = JSON.parse(match[1]);

    return analytic.map(project => {
        const callCounts = countCalls(project);
        const deleted = project.deleted_at !== null;

        return {
            id: project.id,
            tag: project.tag,
            name: project.name,
            state: deleted ? "Удалён" : project.status === 1 ? "Активен" : "Неактивен",
            project_type: assocType(project.type),
            operator: project.src,
            limit: Number(project.lim),
            workdays: project.workdays,
            region_limit: project.regions,
            creation_date: new Date(project.created_at).toISOString(),
            edit_date: new Date(project.updated_at).toISOString(),
            delete_date: deleted ? new Date(project.deleted_at).toISOString() : null,
            sources: parseSources(project.content),
            callCounts: callCounts,
        };
    });
}

self.onmessage = function(e) {
    const { analyticHtml } = e.data;
    const result = parseAnalytic(analyticHtml);
    self.postMessage(result);
};