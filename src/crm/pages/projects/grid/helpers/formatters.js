export function dateFormatter(params) {
    if (!params.value || typeof params.value.getMonth !== "function") return "";
    return params.value.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    });
}

export function weekdaysFormatter(params) {
    if (!params.value) return "";
    const daysMapping = {
        "1": "Пн",
        "2": "Вт",
        "3": "Ср",
        "4": "Чт",
        "5": "Пт",
        "6": "Сб",
        "7": "Вс",
    };

    const daysArr = Array.from(new Set(params.value.split("")))
        .map(Number)
        .sort((a, b) => a - b);

    let ranges = [];
    let start = daysArr[0];
    let end = daysArr[0];

    for (let i = 1; i < daysArr.length; i++) {
        if (daysArr[i] === end + 1) {
            end = daysArr[i];
        } else {
            ranges.push([start, end]);
            start = daysArr[i];
            end = daysArr[i];
        }
    }
    ranges.push([start, end]);

    return ranges
        .map((range) => {
            if (range[0] === range[1]) {
                return daysMapping[range[0].toString()] + ".";
            } else {
                return daysMapping[range[0].toString()] + "-" + daysMapping[range[1].toString()];
            }
        })
        .join(" ");
}
