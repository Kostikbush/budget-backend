import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  startOfDay,
  endOfDay,
  max as maxDate,
  min as minDate,
  isBefore,
  subYears,
  isAfter,
  subMonths,
  subDays,
  subWeeks,
} from "date-fns";

export function getStepOps(freq) {
  const daySteps = {
    daily: 1,
    every_2_days: 2,
    every_3_days: 3,
    every_4_days: 4,
    every_5_days: 5,
    every_6_days: 6,
  };
  const weekSteps = {
    weekly: 1,
    every_2_weeks: 2,
    every_3_weeks: 3,
    every_4_weeks: 4,
  };
  const monthSteps = {
    monthly: 1,
    every_2_months: 2,
    every_3_months: 3,
    every_4_months: 4,
    every_5_months: 5,
    every_6_months: 6,
  };

  if (freq in daySteps) {
    const step = daySteps[freq];
    return {
      add: (d, k = 1) => addDays(d, step * k),
      sub: (d, k = 1) => subDays(d, step * k),
      unit: "day",
    };
  }
  if (freq in weekSteps) {
    const step = weekSteps[freq];
    return {
      add: (d, k = 1) => addWeeks(d, step * k),
      sub: (d, k = 1) => subWeeks(d, step * k),
      unit: "week",
    };
  }
  if (freq in monthSteps) {
    const step = monthSteps[freq];
    return {
      add: (d, k = 1) => addMonths(d, step * k),
      sub: (d, k = 1) => subMonths(d, step * k),
      unit: "month",
    };
  }
  if (freq === "yearly") {
    return {
      add: (d, k = 1) => addYears(d, 1 * k),
      sub: (d, k = 1) => subYears(d, 1 * k),
      unit: "year",
    };
  }
  return null;
}

/**
 * Восстанавливает первое наступление по расписанию, которое >= createdAt.
 * baseDate — текущая «следующая» дата из документа (которую система уже сдвинула вперёд).
 * Для once возвращаем сам baseDate.
 */
export function alignStartFromCreated(baseDate, freq, createdAt) {
  const created = startOfDay(new Date(createdAt));
  const base = startOfDay(new Date(baseDate));
  if (freq === "once") return base;

  const ops = getStepOps(freq);
  if (!ops) return base;

  // быстрый «прыжок» назад крупными шагами (без бесконечного цикла)
  // сколько шагов назад минимум, чтобы оказаться < created
  let cur = base;

  // Примерная оценка количества шагов назад (формульно по разнице календаря)
  // чтобы не крутить по одному:
  try {
    let roughK = 0;
    if (ops.unit === "day") {
      const msPerDay = 86400000;
      const diff = Math.floor((cur - created) / msPerDay);
      roughK = Math.max(0, Math.floor(diff / 1)); // шаг уже учтён в ops
    } else if (ops.unit === "week") {
      const msPerWeek = 7 * 86400000;
      const diff = Math.floor((cur - created) / msPerWeek);
      roughK = Math.max(0, Math.floor(diff / 1));
    } else if (ops.unit === "month" || ops.unit === "year") {
      // для месяцев/лет оценка грубая, но потом дотюним циклом
      roughK = 12; // начать с десятка шагов назад — затем поправим
    }
    if (roughK > 0) cur = ops.sub(cur, roughK);
  } catch (_) {}

  // докручиваем по одному шагу назад, пока cur >= created
  while (!isBefore(cur, created)) {
    const next = ops.sub(cur, 1);
    if (isBefore(next, created)) break;
    cur = next;
  }
  // теперь cur < created, значит первый >= created — это шаг вперёд
  const firstOnOrAfterCreated = ops.add(cur, 1);
  return firstOnOrAfterCreated;
}

/**
 * Считает количество наступлений события с частотой freq
 * начиная с даты start, с (опционально) датой окончания end,
 * которые попадают в интервал [from, to] включительно.
 */
export function countOccurrencesBetween(start, freq, from, to, end) {
  const lifeFrom = startOfDay(start);
  const lifeTo = end ? endOfDay(end) : endOfDay(to);
  const windowFrom = startOfDay(from);
  const windowTo = endOfDay(to);

  if (isAfter(windowFrom, lifeTo) || isBefore(windowTo, lifeFrom)) {
    return 0;
  }

  const searchFrom = maxDate([lifeFrom, windowFrom]);
  const searchTo = minDate([lifeTo, windowTo]);

  // Одноразовое событие
  if (freq === "once") {
    return lifeFrom >= searchFrom && lifeFrom <= searchTo ? 1 : 0;
  }

  // ---- Ежедневные ----
  const daySteps = {
    daily: 1,
    every_2_days: 2,
    every_3_days: 3,
    every_4_days: 4,
    every_5_days: 5,
    every_6_days: 6,
  };
  if (daySteps[freq]) {
    const step = daySteps[freq];
    // индекс первого ≥ searchFrom
    const offset = Math.ceil(differenceInDays(searchFrom, lifeFrom) / step);
    const first = addDays(lifeFrom, offset * step);
    if (first > searchTo) return 0;
    const remaining = Math.floor(differenceInDays(searchTo, first) / step);
    return 1 + remaining;
  }

  // ---- Еженедельные ----
  const weekSteps = {
    weekly: 1,
    every_2_weeks: 2,
    every_3_weeks: 3,
    every_4_weeks: 4,
  };
  if (weekSteps[freq]) {
    const step = weekSteps[freq];
    const offset = Math.ceil(differenceInWeeks(searchFrom, lifeFrom) / step);
    const first = addWeeks(lifeFrom, offset * step);
    if (first > searchTo) return 0;
    const remaining = Math.floor(differenceInWeeks(searchTo, first) / step);
    return 1 + remaining;
  }

  // ---- Ежемесячные ----
  const monthSteps = {
    monthly: 1,
    every_2_months: 2,
    every_3_months: 3,
    every_4_months: 4,
    every_5_months: 5,
    every_6_months: 6,
  };
  if (monthSteps[freq]) {
    const step = monthSteps[freq];
    const offset = Math.ceil(differenceInMonths(searchFrom, lifeFrom) / step);
    let first = addMonths(lifeFrom, offset * step);

    // гарантируем first >= searchFrom
    while (first < searchFrom) first = addMonths(first, step);
    if (first > searchTo) return 0;

    let cnt = 0;
    let cur = first;
    while (cur <= searchTo) {
      // только если "день месяца" совпадает с якорем (31-е может пропасть)
      if (cur.getDate() === lifeFrom.getDate()) cnt++;
      cur = addMonths(cur, step);
    }
    return cnt;
  }

  // ---- Ежегодные ----
  if (freq === "yearly") {
    const offset = Math.ceil(differenceInYears(searchFrom, lifeFrom));
    let first = addYears(lifeFrom, offset);

    // 🔧 КРИТИЧЕСКОЕ: гарантируем first >= searchFrom
    while (first < searchFrom) first = addYears(first, 1);
    if (first > searchTo) return 0;

    let cnt = 0;
    let cur = first;
    while (cur <= searchTo) {
      if (
        cur.getDate() === lifeFrom.getDate() &&
        cur.getMonth() === lifeFrom.getMonth()
      ) {
        cnt++;
      }
      cur = addYears(cur, 1);
    }
    return cnt;
  }

  return 0;
}
