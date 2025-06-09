import type { Type } from "arktype";
import { type } from "arktype";
import type { StoreComponentType } from "~/prisma/client";

export const StoreComponentSource = type({
  name: type.enumerated(
    "newlyAdded", // Sorted by added date
    "newlyReleased", // Sorted by release date
    "featured", // custom pool created by admin
    "newlyUpdated", // newly updated (new version)
    "companies", // random companies
  ),
  id: "string?",
});

export type StoreComponentSource = typeof StoreComponentSource.infer;

export const TitleSourceValidator = type({
  source: StoreComponentSource,
  title: "string",
});

// Note: we can't infer types because Vue compiles types into runtime shit
// AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
export type TitleSourceValidatorType = {
  source: StoreComponentSource;
  title: string;
};

export const JustSourceValidator = type({
  source: StoreComponentSource,
});

export type JustSourceValidatorType = {
  source: StoreComponentSource;
};

export const storeComponentConfiguration: {
  [key in StoreComponentType]: Type<unknown>;
} = {
  BigCarousel: TitleSourceValidator,
  SmallCarousel: TitleSourceValidator,
};
