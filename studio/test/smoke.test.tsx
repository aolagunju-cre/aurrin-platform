import React from "react";
import "@testing-library/jest-dom";
import fs from "node:fs";
import path from "node:path";
import Home from "../src/app/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("App shell", () => {
  it("redirects the home page to the public directory", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/public/directory");
  });

  it("includes required judge scoring guide sections", () => {
    const guidePath = path.join(process.cwd(), "docs", "JUDGE_GUIDE.md");
    const guide = fs.readFileSync(guidePath, "utf8");

    expect(guide).toContain("## How to score a founder pitch");
    expect(guide).toContain("## Rubric explanation (categories, weights, scales)");
    expect(guide).toContain("## How to submit scores");
    expect(guide).toContain("## Score lock and publish process (admin action)");
    expect(guide).toContain("## What happens after publishing");
    expect(guide).toContain("This score was updated elsewhere");
    expect(guide).toContain("/judge/events/[eventId]/pitch/[pitchId]");
    expect(guide).toContain("state: submitted");
    expect(guide).toContain("`locked`");
  });
});
