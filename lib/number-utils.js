export function formatNumberWithSpaces(num, startStr) {
  const resString = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return startStr ? `${startStr} ${resString}` : resString;
}
