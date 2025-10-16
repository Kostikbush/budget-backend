import {
  parse,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isValid,
  parseISO,
  format,
} from "date-fns";

// Набор поддерживаемых текстовых форматов (можно расширять при необходимости)
const KNOWN_FORMATS = [
  "dd.MM.yyyy HH:mm:ss",
  "dd.MM.yyyy HH:mm",
  "dd.MM.yyyy",
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd",
  "dd-MM-yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
];

function toMillis(value) {
  if (value == null) return Infinity;

  // Date
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : Infinity;
  }

  // Число: авто-распознавание секунд vs миллисекунд
  if (typeof value === "number") {
    const abs = Math.abs(value);
    const ms = abs >= 1e12 || abs < 1e9 ? value : value * 1000; // <1e9 и >=1e12 - эвристика
    return Number.isFinite(ms) ? ms : Infinity;
  }

  // Строка: ISO → известные форматы
  if (typeof value === "string") {
    let d = parseISO(value);
    if (!isValid(d)) {
      for (const fmt of KNOWN_FORMATS) {
        d = parse(value, fmt, new Date());
        if (isValid(d)) break;
      }
    }
    return isValid(d) ? d.getTime() : Infinity;
  }

  return Infinity;
}

export function sortByDateAsc(items, key = "date") {
  return items
    .map((item, i) => ({ item, i, t: toMillis(item[key]) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.item);
}

const MOSCOW_TZ = "Europe/Moscow";

export const labelOf = (d1, d2) => {
  return `${format(d1, "dd.MM.yyyy")}–${format(d2, "dd.MM.yyyy")}`;
};

export const DAYS_PER_YEAR = 365.2425;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

export const FREQ_TO_DAY_FACTOR = {
  daily: 1,
  every_2_days: 2,
  every_3_days: 3,
  every_4_days: 4,
  every_5_days: 5,
  every_6_days: 6,
  weekly: 7,
  every_2_weeks: 14,
  every_3_weeks: 21,
  every_4_weeks: 28,
  monthly: DAYS_PER_MONTH,
  every_2_months: 2 * DAYS_PER_MONTH,
  every_3_months: 3 * DAYS_PER_MONTH,
  every_4_months: 4 * DAYS_PER_MONTH,
  every_5_months: 5 * DAYS_PER_MONTH,
  every_6_months: 6 * DAYS_PER_MONTH,
  yearly: DAYS_PER_YEAR,
};
export const toDays = (f) => FREQ_TO_DAY_FACTOR[f] ?? DAYS_PER_MONTH;

/**
 * Возвращает следующую дату на основе частоты.
 *
 * @param {Date | string} startDate - Начальная дата (объект Date или строка ISO)
 * @param {"once" | "daily" | "weekly" | "monthly" | "yearly"} frequency - Частота
 * @returns {Date | null} - Следующая дата или null, если once или невалидная дата
 */
export function getNextDateFromFrequency(startDate, frequency) {
  console.log(startDate)
  const date = typeof startDate === "string" ? parseISO(startDate) : new Date(startDate);
  
  if (!isValid(date)) return null;

  switch (frequency) {
    case "daily":
      return addDays(date, 1);
    case "every_2_days":
      return addDays(date, 2);
    case "every_3_days":
      return addDays(date, 3);
    case "every_4_days":
      return addDays(date, 4);
    case "every_5_days":
      return addDays(date, 5);
    case "every_6_days":
      return addDays(date, 6);
    case "weekly":
      return addWeeks(date, 1);
    case "every_2_weeks":
      return addWeeks(date, 2);
    case "every_3_weeks":
      return addWeeks(date, 3);
    case "every_4_weeks":
      return addWeeks(date, 4);
    case "monthly":
      return addMonths(date, 1);
    case "every_2_months":
      return addMonths(date, 2);
    case "every_3_months":
      return addMonths(date, 3);
    case "every_4_months":
      return addMonths(date, 4);
    case "every_5_months":
      return addMonths(date, 5);
    case "every_6_months":
      return addMonths(date, 6);
    case "yearly":
      return addYears(date, 1);
    default:
      return null;
  }
}
