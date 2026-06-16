import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { eventNames, type DomainEvent, type EvaluationDto } from "./index.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDirectory, "../fixtures/evaluation-submitted-event.json");

type JsonRecord = {
  readonly [key: string]: unknown;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEvaluationRecommendation = (value: unknown): value is EvaluationDto["recommendation"] =>
  value === "strong-fit" || value === "possible-fit" || value === "not-fit";

const parseEvaluationSubmittedEvent = (value: unknown): DomainEvent<EvaluationDto> => {
  if (!isRecord(value) || !isRecord(value.payload)) {
    expect.fail("Fixture must be a domain event with an object payload");
  }

  const payload = value.payload;

  if (
    typeof value.eventId !== "string" ||
    value.eventName !== eventNames.evaluationSubmitted ||
    typeof value.occurredAt !== "string" ||
    typeof value.correlationId !== "string" ||
    typeof value.producer !== "string" ||
    typeof payload.id !== "string" ||
    typeof payload.submissionId !== "string" ||
    typeof payload.reviewerId !== "string" ||
    typeof payload.score !== "number" ||
    !isEvaluationRecommendation(payload.recommendation) ||
    typeof payload.comment !== "string" ||
    typeof payload.createdAt !== "string"
  ) {
    expect.fail("Fixture does not match DomainEvent<EvaluationDto>");
  }

  return {
    eventId: value.eventId,
    eventName: value.eventName,
    occurredAt: value.occurredAt,
    correlationId: value.correlationId,
    producer: value.producer,
    payload: {
      id: payload.id,
      submissionId: payload.submissionId,
      reviewerId: payload.reviewerId,
      score: payload.score,
      recommendation: payload.recommendation,
      comment: payload.comment,
      createdAt: payload.createdAt,
    },
  };
};

const readFixture = async (): Promise<DomainEvent<EvaluationDto>> => {
  const fileContent = await readFile(fixturePath, "utf8");
  const parsed: unknown = JSON.parse(fileContent);

  return parseEvaluationSubmittedEvent(parsed);
};

describe("evaluation.submitted contract", () => {
  it("keeps the shared fixture compatible with TypeScript contracts", async () => {
    const event = await readFixture();

    expect(event).toEqual({
      eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      eventName: eventNames.evaluationSubmitted,
      occurredAt: "2026-06-16T10:00:00+00:00",
      correlationId: "correlation-id",
      producer: "evaluation-service",
      payload: {
        id: "evaluation-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        submissionId: "submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        reviewerId: "user-reviewer",
        score: 91,
        recommendation: "strong-fit",
        comment: "Strong strategic fit.",
        createdAt: "2026-06-16T10:00:00+00:00",
      },
    });
  });
});
