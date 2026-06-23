import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  eventNames,
  type ChallengeDto,
  type DomainEvent,
  type EventName,
  type SubmissionDto,
} from "./index.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

type JsonRecord = {
  readonly [key: string]: unknown;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readFixture = async (input: { readonly fileName: string }): Promise<unknown> => {
  const fixturePath = join(currentDirectory, "../fixtures", input.fileName);
  const fileContent = await readFile(fixturePath, "utf8");

  return JSON.parse(fileContent) as unknown;
};

const assertDomainEventEnvelope = (input: {
  readonly value: unknown;
  readonly eventName: EventName;
  readonly producer: string;
}): JsonRecord => {
  if (!isRecord(input.value) || !isRecord(input.value.payload)) {
    expect.fail("Fixture must be a domain event with an object payload");
  }

  if (
    typeof input.value.eventId !== "string" ||
    input.value.eventName !== input.eventName ||
    typeof input.value.occurredAt !== "string" ||
    typeof input.value.correlationId !== "string" ||
    input.value.producer !== input.producer
  ) {
    expect.fail("Fixture does not match DomainEvent envelope");
  }

  return input.value;
};

const parseChallengePublishedEvent = (value: unknown): DomainEvent<ChallengeDto> => {
  const event = assertDomainEventEnvelope({
    value,
    eventName: eventNames.challengePublished,
    producer: "challenge-service",
  });
  const payload = event.payload;

  if (
    !isRecord(payload) ||
    typeof payload.id !== "string" ||
    typeof payload.title !== "string" ||
    typeof payload.description !== "string" ||
    typeof payload.ownerOrganizationId !== "string" ||
    payload.status !== "published" ||
    typeof payload.createdAt !== "string" ||
    typeof payload.publishedAt !== "string"
  ) {
    expect.fail("Fixture does not match DomainEvent<ChallengeDto>");
  }

  return event as unknown as DomainEvent<ChallengeDto>;
};

const isSubmissionStatus = (value: unknown): value is SubmissionDto["status"] =>
  value === "submitted" || value === "accepted" || value === "rejected" || value === "selected";

const parseSubmissionEvent = (input: {
  readonly value: unknown;
  readonly eventName: EventName;
  readonly status: SubmissionDto["status"];
}): DomainEvent<SubmissionDto> => {
  const event = assertDomainEventEnvelope({
    value: input.value,
    eventName: input.eventName,
    producer: "submission-service",
  });
  const payload = event.payload;

  if (
    !isRecord(payload) ||
    typeof payload.id !== "string" ||
    typeof payload.challengeId !== "string" ||
    typeof payload.startupOrganizationId !== "string" ||
    typeof payload.summary !== "string" ||
    !isSubmissionStatus(payload.status) ||
    payload.status !== input.status ||
    typeof payload.createdAt !== "string" ||
    !(typeof payload.decidedAt === "string" || payload.decidedAt === null)
  ) {
    expect.fail("Fixture does not match DomainEvent<SubmissionDto>");
  }

  return event as unknown as DomainEvent<SubmissionDto>;
};

describe("platform event contracts", () => {
  it("keeps challenge.published compatible with TypeScript contracts", async () => {
    const event = parseChallengePublishedEvent(
      await readFixture({ fileName: "challenge-published-event.json" }),
    );

    expect(event.eventName).toBe(eventNames.challengePublished);
    expect(event.payload.status).toBe("published");
    expect(event.payload.ownerOrganizationId).toBe("org-company");
  });

  it.each([
    {
      fileName: "submission-created-event.json",
      eventName: eventNames.submissionCreated,
      status: "submitted",
      decidedAt: null,
    },
    {
      fileName: "submission-accepted-event.json",
      eventName: eventNames.submissionAccepted,
      status: "accepted",
      decidedAt: "2026-06-16T11:00:00.000Z",
    },
    {
      fileName: "submission-rejected-event.json",
      eventName: eventNames.submissionRejected,
      status: "rejected",
      decidedAt: "2026-06-16T11:00:00.000Z",
    },
    {
      fileName: "submission-selected-event.json",
      eventName: eventNames.submissionSelected,
      status: "selected",
      decidedAt: "2026-06-16T12:00:00.000Z",
    },
  ] as const)(
    "keeps $eventName compatible with TypeScript contracts",
    async ({ decidedAt, eventName, fileName, status }) => {
      const event = parseSubmissionEvent({
        value: await readFixture({ fileName }),
        eventName,
        status,
      });

      expect(event.eventName).toBe(eventName);
      expect(event.payload.status).toBe(status);
      expect(event.payload.decidedAt).toBe(decidedAt);
      expect(event.payload.startupOrganizationId).toBe("org-startup");
    },
  );
});
