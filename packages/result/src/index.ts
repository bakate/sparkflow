export type Result<TError, TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly error: TError;
    };

export const succeed = <TValue>(value: TValue): Result<never, TValue> => ({
  ok: true,
  value,
});

export const fail = <TError>(error: TError): Result<TError, never> => ({
  ok: false,
  error,
});
