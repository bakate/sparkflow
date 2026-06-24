export type Notification = {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;
};
