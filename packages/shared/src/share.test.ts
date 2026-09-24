import { describe, expect, it } from "vitest";
import { draftsFromSharedText, sharedTextFromQuery, stripShareParams } from "./share";

describe("draftsFromSharedText", () => {
  it("splits lines, trims and de-duplicates", () => {
    expect(draftsFromSharedText(["  Buy milk \n\nbuy MILK\ncall mom  "])).toEqual([
      { title: "Buy milk" },
      { title: "call mom" },
    ]);
  });

  it("skips titles already in the list", () => {
    expect(draftsFromSharedText(["Buy milk", "Walk dog"], [{ title: "buy milk" }])).toEqual([
      { title: "Walk dog" },
    ]);
  });

  it("returns nothing for blank input", () => {
    expect(draftsFromSharedText(["", "   \n  "])).toEqual([]);
  });
});

describe("query helpers", () => {
  it("reads repeatable add params and share-target keys", () => {
    expect(sharedTextFromQuery("?add=one&add=two&text=three&filter=all")).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(sharedTextFromQuery("")).toEqual([]);
  });

  it("strips only the share params", () => {
    expect(stripShareParams("?add=one&filter=all")).toBe("?filter=all");
    expect(stripShareParams("?add=one")).toBe("");
  });
});
