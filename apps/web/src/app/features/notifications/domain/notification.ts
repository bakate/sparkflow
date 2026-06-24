export type Notification = {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly createdAt: Date;
};
