export type FilterConditionally<Source, Condition> = Pick<
  Source,
  { [K in keyof Source]: Source[K] extends Condition ? K : never }[keyof Source]
>;
export type KeyOfType<T, V> = keyof {
  // TODO: should switch to unknown??
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T as T[P] extends V ? P : never]: any;
};

type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U;
};
