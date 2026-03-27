export type AnyFunction = (...args: any[]) => any;

export interface SpyFunction<T extends AnyFunction> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: Parameters<T>[];
  reset(): void;
  setImplementation(implementation: T): void;
}

export function createSpy<T extends AnyFunction>(implementation: T): SpyFunction<T> {
  let impl = implementation;

  const spy = ((...args: Parameters<T>) => {
    spy.calls.push(args);
    return impl(...args);
  }) as SpyFunction<T>;

  spy.calls = [];
  spy.reset = () => {
    spy.calls = [];
  };
  spy.setImplementation = (next: T) => {
    impl = next;
  };

  return spy;
}

