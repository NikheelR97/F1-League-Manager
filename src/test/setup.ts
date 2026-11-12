// jest-dom matchers are registered via vitest.config.ts setupFiles.

// Node 25+ ships a built-in `localStorage` global that is undefined unless
// node runs with --localstorage-file, and it shadows jsdom's Web Storage.
// Tests that touch localStorage then crash on `undefined.clear()`. Provide a
// spec-shaped in-memory Storage when the global is missing; a no-op on Node 24
// (CI), where jsdom's implementation is already in place.
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) {
  class MemoryStorage implements Storage {
    #data = new Map<string, string>();
    get length() {
      return this.#data.size;
    }
    clear() {
      this.#data.clear();
    }
    getItem(key: string) {
      return this.#data.has(key) ? (this.#data.get(key) as string) : null;
    }
    key(index: number) {
      return [...this.#data.keys()][index] ?? null;
    }
    removeItem(key: string) {
      this.#data.delete(key);
    }
    setItem(key: string, value: string) {
      this.#data.set(key, String(value));
    }
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
}
