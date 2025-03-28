export function roundTo(num, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}
export function range(from, to) {
    let result = [];
    let step = from < to ? 1 : -1;

    for (let i = from; i !== to + step; i += step) {
        result.push(i);
    }

    return result;
}
export function calcPercent(total, part) {
    return total ? roundTo((part / total) * 100, 1) : 0;
}

export function normalizePhoneNumber(phone) {
    // Убираем все нечисловые символы
    let digits = phone.replace(/\D/g, '');
    // Если номер из 11 цифр и начинается с 8, заменяем 8 на 7
    if (digits.length === 11 && digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    return digits;
}

export function findStringsWithPhone(strings, searchedPhone) {
    // Регулярное выражение для поиска номеров в разных форматах
    const regex = /[+]?[78]?\s*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g;

    // Фильтруем массив строк
    return strings.filter(str => {
        if (!str) return false;

        // Ищем все совпадения с форматом номера в строке
        const matches = str.match(regex);
        if (matches) {
            // Проверяем каждое совпадение
            for (let match of matches) {
                const normalizedMatch = normalizePhoneNumber(match);
                // Если нормализованный номер совпадает с искомым, включаем строку в результат
                if (normalizedMatch === searchedPhone) {
                    return true;
                }
            }
        }
        return false;
    });
}

export function formatPercentage(num) {
    let str = num.toString();
    return str.endsWith('.0') ? str.slice(0, -2) : str;
}

export function percentageDiff(base, compared) {
    return ((compared - base) / base) * 100;
}

export function pluralize(number, base, suffixOne, suffixFew, suffixMany) {
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

export function toLocalISOString(date) {
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - userTimezoneOffset).toISOString();
}

export function replaceDomainsWithLinks(text, blankTarget = false) {
    const regex = /(https?:\/\/[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?:\/\S*)?)|((?<!https?:\/\/)(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?:\/\S*)?)/gu;

    return text.replace(regex, (match, group1, group2) => {
        let url;
        if (group1) {
            url = group1;
        } else if (group2) {
            url = 'http://' + group2;
        } else {
            url = match;
        }
        return `<a href="${url}" ${blankTarget ? 'target="_blank"' : ''}>${match}</a>`;
    });
}