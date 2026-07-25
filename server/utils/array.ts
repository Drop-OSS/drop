export const sum = (array: number[]) =>
  array.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

/**
 * Retrieves the last element of an array.
 *
 * @param array - The array to inspect
 * @returns The last element, or `undefined` if the array is empty
 */
export function lastItem<T>(array: T[]) {
  return array.at(-1);
}
