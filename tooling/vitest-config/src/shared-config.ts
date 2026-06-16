export const sharedConfig = {
  test: {
    globals: true,
    coverage: {
      provider: "v8" as const,
      reporter: [
        [
          "json",
          {
            file: "../coverage.json",
          },
        ],
      ] as const,
      enabled: true,
    },
  },
};
