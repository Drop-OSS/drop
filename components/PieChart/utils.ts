import Tuple from "~/utils/tuple";
import type { Slice, SliceData } from "~/components/PieChart/types";
import { sum, lastItem } from "~/utils/array";

export const START = new Tuple(50, 10);
export const CENTER = new Tuple(50, 50);
export const RADIUS = 40;

export const polarToCartesian = (
  center: Tuple,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  const x = center.x + radius * Math.cos(angleInRadians);
  const y = center.y + radius * Math.sin(angleInRadians);
  return new Tuple(x, y);
};

export const percent2Degrees = (percentage: number) => (360 * percentage) / 100;

export function generateSlices(data: SliceData[]): Slice[] {
  return data.reduce((accumulator, currentValue, index, array) => {
    const percentage =
      (currentValue.value * 100) / sum(array.map((slice) => slice.value));
    return [
      ...accumulator,
      {
        start: accumulator.length
          ? polarToCartesian(
              CENTER,
              RADIUS,
              percent2Degrees(lastItem(accumulator).totalPercentage),
            )
          : START,
        radius: RADIUS,
        percentage: percentage,
        totalPercentage:
          sum(accumulator.map((element) => element.percentage)) + percentage,
        center: CENTER,
        color: PIE_COLOURS[index % PIE_COLOURS.length],
        label: currentValue.label,
        value: currentValue.value,
      },
    ];
  }, [] as Slice[]);
}

export const getFlags = (percentage: number) =>
  percentage > 50 ? new Tuple(1, 1) : new Tuple(0, 1);
