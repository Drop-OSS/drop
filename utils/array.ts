export const sum = (array: number[]) =>
  array.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

export function lastItem<T>(array: T[]) {
  return array[array.length - 1];
}

export function replaceItem<T>(array: T[], newValue: T, index: number) {
  const output = [
    ...array.slice(0, index),
    newValue,
    ...array.slice(index + 1),
  ];
  return output;
}
