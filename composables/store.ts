export type StoreFilterOption = {
  name: string;
  param: string;
  options: Array<{
    name: string;
    value: string;
  }>;
  multiple?: boolean;
};

export type StoreSortOption = {
  name: string;
  param: string;
}