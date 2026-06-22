import { Component, effect, input, output, signal } from '@angular/core';
import {
  debounce,
  form,
  FormField,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import type { ChallengeId } from '@shared/domain/result';

type ChallengeSubmissionFormModel = {
  readonly summary: string;
};

export type ChallengeSubmissionFormSubmitted = ChallengeSubmissionFormModel & {
  readonly challengeId: ChallengeId;
};

type ValidationMessage = {
  readonly kind: string;
  readonly message?: string;
};

const emptyChallengeSubmissionFormModel: ChallengeSubmissionFormModel = {
  summary: '',
};

const SUMMARY_MIN_LENGTH = 10;
const SUMMARY_MAX_LENGTH = 1000;
const validationPriority = ['required', 'minLength', 'maxLength'] as const;

@Component({
  selector: 'challenge-submission-form',
  imports: [Button, FormField, Skeleton],
  templateUrl: './challenge-submission-form.html',
})
export class ChallengeSubmissionForm {
  readonly challengeId = input.required<ChallengeId>();
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly resetKey = input(0);
  readonly submitted = output<ChallengeSubmissionFormSubmitted>();
  readonly cancelled = output<void>();

  protected readonly proposalFormModel = signal<ChallengeSubmissionFormModel>(
    emptyChallengeSubmissionFormModel,
  );
  private readonly previousResetKey = signal(this.resetKey());
  protected readonly proposalForm = form(this.proposalFormModel, (proposalPath) => {
    required(proposalPath.summary, { message: 'Summary is required.' });
    debounce(proposalPath.summary, 600);
    minLength(proposalPath.summary, SUMMARY_MIN_LENGTH, {
      message: `Summary is too short. Minimum is ${SUMMARY_MIN_LENGTH} characters.`,
    });
    maxLength(proposalPath.summary, SUMMARY_MAX_LENGTH, {
      message: `Summary is too long. Maximum is ${SUMMARY_MAX_LENGTH} characters.`,
    });
  });

  constructor() {
    effect(() => {
      const currentResetKey = this.resetKey();

      if (currentResetKey === this.previousResetKey()) {
        return;
      }

      this.previousResetKey.set(currentResetKey);
      this.resetForm();
    });
  }

  protected shouldShowSummaryError(): boolean {
    const summaryField = this.proposalForm.summary();

    return summaryField.touched() && summaryField.invalid();
  }

  protected summaryErrorMessage(): string {
    return getFirstValidationMessage({
      errors: this.proposalForm.summary().errors(),
      fallback: 'Summary is invalid.',
    });
  }

  protected async submitProposal(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.proposalForm().valid()) {
      await submit(this.proposalForm, async () => {
        this.submitted.emit({
          ...this.proposalFormModel(),
          challengeId: this.challengeId(),
        });
        return undefined;
      });
    }
  }

  protected onCancelForm(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private resetForm(): void {
    this.proposalForm().reset(emptyChallengeSubmissionFormModel);
  }
}

const getFirstValidationMessage = (input: {
  readonly errors: readonly ValidationMessage[];
  readonly fallback: string;
}): string => {
  const prioritizedError = validationPriority
    .map((validationKind) =>
      input.errors.find((validationError) => validationError.kind === validationKind),
    )
    .find((validationError) => validationError !== undefined);

  return prioritizedError?.message ?? input.errors[0]?.message ?? input.fallback;
};
