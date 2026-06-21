import { Component, computed, effect, input, output, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  minLength,
  required,
  submit,
  debounce,
} from '@angular/forms/signals';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import type { ChallengeId } from '@shared/domain/result';

type ChallengeFormModel = {
  readonly title: string;
  readonly description: string;
};

export type ChallengeFormSubmitted = ChallengeFormModel & {
  readonly challengeId: ChallengeId | null;
};

type ValidationMessage = {
  readonly kind: string;
  readonly message?: string;
};

const emptyChallengeFormModel: ChallengeFormModel = {
  title: '',
  description: '',
};

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 1000;
const validationPriority = ['required', 'minLength', 'maxLength'] as const;

@Component({
  selector: 'challenge-form',
  imports: [Button, FormField, InputText, Skeleton],
  templateUrl: './challenge-form.html',
})
export class ChallengeForm {
  readonly challengeId = input<ChallengeId | null>(null);
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly resetKey = input(0);
  readonly submitted = output<ChallengeFormSubmitted>();
  readonly cancelled = output<void>();

  protected readonly challengeFormModel = signal<ChallengeFormModel>(emptyChallengeFormModel);
  private readonly previousResetKey = signal(this.resetKey());
  protected readonly submitLabel = computed(() =>
    this.challengeId() === null ? 'Create' : 'Save',
  );
  protected readonly challengeForm = form(this.challengeFormModel, (challengePath) => {
    required(challengePath.title, { message: 'Title is required.' });
    debounce(challengePath.title, 600);
    minLength(challengePath.title, TITLE_MIN_LENGTH, {
      message: `Title is too short. Minimum is ${TITLE_MIN_LENGTH} characters.`,
    });
    maxLength(challengePath.title, TITLE_MAX_LENGTH, {
      message: `Title is too long. Maximum is ${TITLE_MAX_LENGTH} characters.`,
    });
    required(challengePath.description, { message: 'Description is required.' });
    debounce(challengePath.description, 600);
    minLength(challengePath.description, DESCRIPTION_MIN_LENGTH, {
      message: `Description is too short. Minimum is ${DESCRIPTION_MIN_LENGTH} characters.`,
    });
    maxLength(challengePath.description, DESCRIPTION_MAX_LENGTH, {
      message: `Description is too long. Maximum is ${DESCRIPTION_MAX_LENGTH} characters.`,
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

  protected shouldShowTitleError(): boolean {
    const titleField = this.challengeForm.title();

    return titleField.touched() && titleField.invalid();
  }

  protected shouldShowDescriptionError(): boolean {
    const descriptionField = this.challengeForm.description();

    return descriptionField.touched() && descriptionField.invalid();
  }

  protected titleErrorMessage(): string {
    return getFirstValidationMessage({
      errors: this.challengeForm.title().errors(),
      fallback: 'Title is invalid.',
    });
  }

  protected descriptionErrorMessage(): string {
    return getFirstValidationMessage({
      errors: this.challengeForm.description().errors(),
      fallback: 'Description is invalid.',
    });
  }

  protected async submitChallenge(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.challengeForm().valid()) {
      await submit(this.challengeForm, async () => {
        this.submitted.emit({
          ...this.challengeFormModel(),
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
    this.challengeForm().reset(emptyChallengeFormModel);
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
