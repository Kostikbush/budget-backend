import { format } from "date-fns";

const MOSCOW_TZ = "Europe/Moscow";
// export const normalizeRangeToUTC = (r) => {
//   // приводим вход в московскую зону, берём начало/конец суток в Москве и конвертим в UTC
//   const zFrom = utcToZonedTime(new Date(r.dateFrom), MOSCOW_TZ);
//   const zTo = utcToZonedTime(new Date(r.dateTo), MOSCOW_TZ);
//   const startZ = startOfDay(zFrom);
//   const endZ = endOfDay(zTo);
//   const fromUTC = zonedTimeToUtc(startZ, MOSCOW_TZ);
//   const toUTC = zonedTimeToUtc(endZ, MOSCOW_TZ);
//   return { fromUTC, toUTC, startZ, endZ };
// };

export const labelOf = (d1, d2) => {
  // компактная и нейтральная метка на ось X
  return `${format(d1, "dd.MM.yyyy")}–${format(d2, "dd.MM.yyyy")}`;
};
