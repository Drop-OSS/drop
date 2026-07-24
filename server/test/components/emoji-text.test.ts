/**
 * Component integration tests for EmojiText.
 *
 * Verifies the emoji conversion + URL composition contract.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmojiText from "../../components/EmojiText.vue";

describe("EmojiText", () => {
  it("renders an img with the computed emoji URL", () => {
    const wrapper = mount(EmojiText, {
      props: { emoji: "🎮" },
    });
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("alt")).toBe("🎮");
    expect(img.attributes("src")).toContain("/api/v1/emoji/");
  });

  it("uses correct classes for inline + emoji styling", () => {
    const wrapper = mount(EmojiText, {
      props: { emoji: "😀" },
    });
    const img = wrapper.find("img");
    expect(img.classes()).toContain("inline-block");
    expect(img.classes()).toContain("emoji");
  });

  it("re-renders when emoji prop changes", async () => {
    const wrapper = mount(EmojiText, {
      props: { emoji: "🎮" },
    });
    const initialSrc = wrapper.find("img").attributes("src");
    await wrapper.setProps({ emoji: "🎲" });
    const updatedSrc = wrapper.find("img").attributes("src");
    expect(updatedSrc).not.toBe(initialSrc);
  });
});
