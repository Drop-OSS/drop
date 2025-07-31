import type { FilterConditionally } from "./types";

interface PriorityTagged<T> {
  object: T;
  priority: number; // Higher takes priority
  addedIndex: number; // Lower takes priority
}

export class PriorityList<T> {
  private source: Array<PriorityTagged<T>> = [];
  private cachedSorted: Array<T> | undefined;

  push(item: T, priority: number = 0) {
    this.source.push({
      object: item,
      priority,
      addedIndex: this.source.length,
    });
    this.cachedSorted = undefined;
  }

  pop(index: number = 0) {
    this.cachedSorted = undefined;
    return this.source.splice(index, 1)[0];
  }

  values() {
    if (this.cachedSorted !== undefined) {
      return this.cachedSorted;
    }

    const sorted = this.source
      .sort((a, b) => {
        if (a.priority == a.priority) {
          return a.addedIndex - b.addedIndex;
        }

        return b.priority - a.priority;
      })
      .map((e) => e.object);
    this.cachedSorted = sorted;

    return this.cachedSorted;
  }

  find(predicate: (value: T, index: number, obj: T[]) => boolean) {
    return this.source.map((e) => e.object).find(predicate);
  }
}

type IndexableProperty<T> = keyof FilterConditionally<
  T,
  (() => string) | string
>;
export class PriorityListIndexed<T> extends PriorityList<T> {
  private indexName: IndexableProperty<T>;
  private indexMap = new Map<string, T>();

  constructor(indexName: IndexableProperty<T>) {
    super();
    this.indexName = indexName;
  }

  private getIndex(object: T): string {
    const index = object[this.indexName];

    if (typeof index === "function") {
      return index();
    }

    return index as string;
  }

  override push(item: T, priority?: number): void {
    const index = this.getIndex(item);
    this.indexMap.set(index, item);

    super.push(item, priority);
  }

  override pop(position?: number): PriorityTagged<T> {
    const value = super.pop(position);

    const index = this.getIndex(value.object);
    this.indexMap.delete(index);

    return value;
  }

  get(index: string) {
    return this.indexMap.get(index);
  }
}
