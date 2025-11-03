export const sum = (array: number[]) =>
  array.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

export function lastItem<T>(array: T[]) {
  return array[array.length - 1];
}
