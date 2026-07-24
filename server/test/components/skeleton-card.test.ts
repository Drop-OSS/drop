/**
 * Component integration tests for visual primitives.
 *
 * These tests verify the contract of stateless UI components without
 * exercising the full Nuxt app. They use `mount` from @vue/test-utils
 * with `happy-dom` (configured in vitest.config.ts).
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SkeletonCard from "../../components/SkeletonCard.vue";

describe("SkeletonCard", () => {
  it("renders with default props", () => {
    const wrapper = mount(SkeletonCard);
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.classes()).toContain("rounded-lg");
    expect(wrapper.classes()).toContain("w-48");
    expect(wrapper.classes()).toContain("h-64");
  });

  it("renders custom message when provided", () => {
    const wrapper = mount(SkeletonCard, {
      props: { message: "Loading Games…" },
    });
    expect(wrapper.text()).toContain("Loading Games…");
  });

  it("applies animate-pulse class when loading is true", () => {
    const wrapper = mount(SkeletonCard, {
      props: { loading: true },
    });
    expect(wrapper.classes()).toContain("animate-pulse");
  });

  it("does not apply animate-pulse class when loading is false", () => {
    const wrapper = mount(SkeletonCard, {
      props: { loading: false },
    });
    expect(wrapper.classes()).not.toContain("animate-pulse");
  });

  it("renders empty p tag when no message provided", () => {
    const wrapper = mount(SkeletonCard);
    const p = wrapper.find("p");
    expect(p.exists()).toBe(true);
    expect(p.text()).toBe("");
  });
});
