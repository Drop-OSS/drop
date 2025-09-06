export type StoreFilterOption = {
  name: string;
  param: string;
  options: Array<StoreSortOption>;
  multiple?: boolean;
};

export type StoreSortOption = {
  name: string;
  param: string;
  platformIcon?: { key: string; fallback?: string };
};
