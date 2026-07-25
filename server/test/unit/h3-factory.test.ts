import { describe, expect, it } from "vitest";
import { createMockH3Event } from "../utils/h3";

describe("createMockH3Event", () => {
  it("returns a mock event with sensible defaults", () => {
    const event = createMockH3Event() as {
      method: string;
      getRequestURL: () => URL;
    };
    expect(event.method).toBe("GET");
    expect(event.getRequestURL().toString()).toBe("http://localhost/");
  });

  it("accepts overrides", async () => {
    const event = createMockH3Event({
      method: "POST",
      body: { id: 1 },
      routerParams: { slug: "abc" },
    }) as {
      method: string;
      readBody: () => Promise<unknown>;
      getRouterParam: (n: string) => string | undefined;
    };
    expect(event.method).toBe("POST");
    await expect(event.readBody()).resolves.toEqual({ id: 1 });
    expect(event.getRouterParam("slug")).toBe("abc");
  });
});
