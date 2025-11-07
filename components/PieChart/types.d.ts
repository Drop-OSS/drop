import type Tuple from "~/utils/tuple";
import type { ChartColour } from "~/utils/colors";

export type Slice = {
  start: Tuple;
  center: Tuple;
  percentage: number;
  totalPercentage: number;
  radius: number;
  color: ChartColour;
  label: string;
  value: number;
};

export type SliceData = {
  value: number;
  color?: ChartColour;
  label: string;
};
