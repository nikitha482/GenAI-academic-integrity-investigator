import { afterEach, describe, expect, it, vi } from "vitest";

const { mockStreamText } = vi.hoisted(() => ({ mockStreamText: vi.fn() }));
vi.mock("ai", async (original) => ({
  ...await original<typeof import("ai")>(),
  streamText: mockStreamText,
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ responses: () => ({}) }) }));

import { GatewayError, llmAnalyze } from "./ai.server";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("analysis stream failures", () => {
  it.each([402, 403, 429])("preserves gateway status %i and its safe remedy", async (status) => {
    vi.stubEnv("LOVABLE_API_KEY", "test-only-key");
    mockStreamText.mockImplementation(({ onError }) => ({
      output: Promise.resolve().then(() => {
        onError({ error: { statusCode: status, responseBody: JSON.stringify({ error: { message: "Gateway remedy" } }) } });
        throw new Error("No output generated. Check the stream for errors.");
      }),
    }));
    await expect(llmAnalyze("A submission", [])).rejects.toMatchObject({ status, message: "Gateway remedy" });
  });

  it("explains exhausted credits when the gateway supplies no message", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-only-key");
    mockStreamText.mockImplementation(({ onError }) => ({
      output: Promise.resolve().then(() => {
        onError({ error: { statusCode: 402, responseBody: "Payment Required" } });
        throw new Error("No output generated.");
      }),
    }));
    await expect(llmAnalyze("A submission", [])).rejects.toMatchObject({ status: 402, message: "AI credits are exhausted for this workspace." });
  });

  it("keeps successful structured results unchanged", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-only-key");
    const result = { verdict: "Review complete" };
    mockStreamText.mockReturnValue({ output: Promise.resolve(result) });
    await expect(llmAnalyze("A submission", [])).resolves.toBe(result);
  });

  it("reports missing configuration without making a request", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    await expect(llmAnalyze("A submission", [])).rejects.toBeInstanceOf(GatewayError);
    expect(mockStreamText).not.toHaveBeenCalled();
  });
});