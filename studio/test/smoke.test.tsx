import React from "react";
import "@testing-library/jest-dom";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import Home from "../src/app/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    <img {...props} />
  ),
}));

describe("App shell", () => {
  it("renders the public marketing homepage", () => {
    render(Home());

    expect(screen.getByRole("heading", { name: "Aurrin Ventures" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Support Founders" })).toHaveAttribute("href", "/public/directory");
    expect(screen.getByRole("link", { name: "Apply to Pitch" })).toHaveAttribute("href", "/public/apply");
    expect(screen.getByText("Join Calgary's Startup Ecosystem")).toBeInTheDocument();
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
