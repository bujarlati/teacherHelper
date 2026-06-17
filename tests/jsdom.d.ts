declare module "jsdom" {
  export const JSDOM: {
    new(html: string, options?: { runScripts?: "dangerously" | "outside-only" }): {
      window: Window & typeof globalThis;
    };
  };
}
