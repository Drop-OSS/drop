import type Tuple from "~/utils/tuple";

export type Slice = {
  start: Tuple;
  center: Tuple;
  percentage: number;
  totalPercentage: number;
  radius: number;
  color?: string;
};

export type SliceData = {
  percentage: number;
  color?: string;
  label: string;
};
