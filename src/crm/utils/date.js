import { pluralize } from "./helpers.js";

export const months = [
    "Январь", "Февраль", "Март", "Апрель",
    "Май", "Июнь", "Июль", "Август",
    "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];
export const msInDay = 24 * 60 * 60 * 1000;

/**
 * Форматирует дату в виде dd.mm или dd.mm.yy
 * @param {Date} date – объект даты
 * @param {boolean} showYear – показывать ли год в формате (по умолчанию true)
 * @returns {string} – форматированная дата
 */
export function formatDate(date, showYear = true) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    if (showYear) {
        const year = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    }
    return `${day}.${month}`;
}

/**
 * Возвращает название месяца по дате
 * @param {Date} date – объект даты
 * @returns {string} – название месяца
 */
export function getMonthName(date) {
    return months[date.getMonth()];
}

/**
 * Проверяет, соответствует ли период полному месяцу
 * @param {Date} start – дата начала периода
 * @param {Date} end – дата конца периода
 * @returns {boolean} – true, если период равен полному месяцу
 */
export function isFullMonth(start, end) {
    const firstDay = 1;
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return start.getDate() === firstDay &&
        end.getDate() === lastDay &&
        start.getMonth() === end.getMonth() &&
        start.getFullYear() === end.getFullYear();
}

/**
 * Рассчитывает разницу между двумя датами в днях
 * @param {Date} start – начальная дата
 * @param {Date} end – конечная дата
 * @returns {number} – разница в днях (округленная)
 */
export function daysDiff(start, end) {
    return Math.round((end - start) / msInDay);
}

/**
 * Форматирует одиночную дату. Если дата равна сегодняшней, вчера или позавчера,
 * возвращаются соответствующие строки.
 * @param {Date} date – объект даты
 * @returns {string} – форматированная дата или строка "Сегодня", "Вчера" и т.п.
 */
export function formatSingleDate(date) {
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = daysDiff(today, target);

    if (diffDays === 0) {
        return "Сегодня";
    } else if (diffDays === -1) {
        return "Вчера";
    } else if (diffDays === -2) {
        return "Позавчера";
    }

    const showYear = date.getFullYear() !== now.getFullYear();
    return formatDate(date, showYear);
}

/**
 * Форматирует диапазон дат с учетом различных случаев:
 * - Если даты совпадают – используется формат одиночной даты.
 * - Если период соответствует полному месяцу – возвращается название месяца.
 * - Если одна из дат совпадает с сегодняшней и период короткий – возвращается количество дней.
 * - В остальных случаях возвращается диапазон дат с форматированием.
 *
 * @param {Date} start – дата начала периода
 * @param {Date} end – дата конца периода
 * @returns {string} – человекочитаемое представление периода
 */
export function formatPeriod(start, end) {
    function resetTime(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    const today = resetTime(new Date());
    start = resetTime(start);
    end = resetTime(end);

    // Если даты совпадают
    if (start.getTime() === end.getTime()) {
        return formatSingleDate(start);
    }

    // Если период равен полному месяцу
    if (isFullMonth(start, end)) {
        return getMonthName(start);
    }

    // Если одна из дат совпадает с сегодняшней и разница в днях от 2 до 30
    if (start.getTime() === today.getTime() || end.getTime() === today.getTime()) {
        const daysCount = daysDiff(start, end) + 1;
        if (daysCount >= 2 && daysCount <= 30) {
            return pluralize(daysCount, "Дн", "я", "я", "ей");
        }
    }

    // Разница в месяцах между датами
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (monthsDiff === 1) {
        return "Месяц";
    }
    if (monthsDiff && monthsDiff < 12) {
        return pluralize(monthsDiff, "Месяц", "а", "а", "ев");
    }
    if (monthsDiff === 12) {
        return "Год";
    }

    // Форматирование диапазона. Если год одинаков, можно не выводить год для каждой даты.
    return start.getFullYear() === end.getFullYear()
        ? `${formatDate(start, false)} / ${formatDate(end, false)}`
        : `${formatDate(start)} / ${formatDate(end)}`;
}
