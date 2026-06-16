export const readEnvironmentVariable = (input: {
  readonly name: string;
  readonly fallback?: string;
}): string => {
  const value = process.env[input.name];

  if (value !== undefined && value.length > 0) {
    return value;
  }

  if (input.fallback !== undefined) {
    return input.fallback;
  }

  throw new Error(`Missing environment variable: ${input.name}`);
};

export const readIntegerEnvironmentVariable = (input: {
  readonly name: string;
  readonly fallback: number;
}): number => {
  const rawValue = process.env[input.name];

  if (rawValue === undefined || rawValue.length === 0) {
    return input.fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (Number.isNaN(value)) {
    throw new Error(`Invalid integer environment variable: ${input.name}`);
  }

  return value;
};
