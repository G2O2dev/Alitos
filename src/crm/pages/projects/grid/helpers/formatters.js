export function dateFormatter(params) {
    if (!params.value || typeof params.value.getMonth !== "function") return "";
    return params.value.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    });
}

export function weekdaysFormatter(params) {
    if (!params.value || params.value.length === 0) {
        return "";
    }

    const dayMap = {
        1: 'Пн',
        2: 'Вт',
        3: 'Ср',
        4: 'Чт',
        5: 'Пт',
        6: 'Сб',
        7: 'Вс'
    };

    const nums = params.value.map(Number).sort((a, b) => a - b);

    if (nums.length === 1) {
        return dayMap[nums[0]];
    }

    let isConsecutive = true;
    for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[i - 1] + 1) {
            isConsecutive = false;
            break;
        }
    }

    if (isConsecutive) {
        const startDay = dayMap[nums[0]];
        const endDay = dayMap[nums[nums.length - 1]];
        return `${startDay}-${endDay}`;
    } else {
        const dayNames = nums.map(num => dayMap[num]);
        return dayNames.join('. ') + '.';
    }
}
