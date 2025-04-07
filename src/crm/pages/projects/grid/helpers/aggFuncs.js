export const aggFuncs = {
    activeInactive: (params) => {
        let active = 0;
        let inactive = 0;
        let deleted = 0;

        const countChildLeaf = (rowNode) => {
            for (const child of rowNode.childrenAfterFilter || []) {
                if (child.childrenAfterFilter) {
                    countChildLeaf(child);
                } else {
                    switch (child.data.static.state) {
                        case "Активен":
                            active++;
                            break;
                        case "Неактивен":
                            inactive++;
                            break;
                        case "Удалён":
                            deleted++;
                            break;
                    }
                }
            }
        };

        countChildLeaf(params.rowNode);
        return `${active} / ${inactive}${deleted ? ` / ${deleted}` : ""}`;
    },
    same: (params) => {
        let reference = params.values[0];
        for (let i = 1; i < params.values.length; i++) {
            const value = params.values[i];
            if (value === "") continue;
            if (reference === "") {
                reference = value;
                continue;
            }
            if (value !== reference) return null;
        }
        return reference;
    },
    sameDate: (params) => {
        let refDate = null;
        for (const value of params.values) {
            if (!value) continue;
            const date = new Date(value);
            date.setHours(0, 0, 0, 0);
            if (!refDate) {
                refDate = date;
            } else if (date.getTime() !== refDate.getTime()) {
                return;
            }
        }
        return refDate;
    },
    period: (params) => {
        let sum = 0;
        const periodId = params.colDef.context.periodId;
        const field = params.colDef.field;

        const countChildLeaf = (rowNode) => {
            for (const child of rowNode.childrenAfterFilter || []) {
                if (child.data) {
                    const periodData = child.data.periods[periodId];
                    if (periodData == null) continue;
                    const value = periodData[field];
                    sum += value.value === undefined ? value : value.value;
                }
                if (child.childrenAfterFilter) {
                    countChildLeaf(child);
                }
            }
        };
        countChildLeaf(params.rowNode);
        return sum;
    },
    name: (params) => {
        let reference = params.values[0];
        if (reference && reference.length > 3) {
            reference = reference.slice(3);
        }
        for (let i = 1; i < params.values.length; i++) {
            let value = params.values[i];
            if (value === "" || !value) continue;
            if (value.length > 3) {
                value = value.slice(3);
            }
            if (reference === "") {
                reference = value;
                continue;
            }
            if (value !== reference) return null;
        }
        return reference;
    },
};