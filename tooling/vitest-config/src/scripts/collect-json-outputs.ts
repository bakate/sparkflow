import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const coverageSourcePatterns = ["../../apps/*", "../../packages/*"] as const;

const removeParentSegments = (value: string): string => value.replace(/\.\.\//g, "");

const copyCoverageFile = async (input: {
  readonly sourceDirectory: string;
  readonly destinationDirectory: string;
}): Promise<boolean> => {
  const coverageFilePath = path.join(input.sourceDirectory, "coverage.json");

  try {
    await fs.access(coverageFilePath);
  } catch {
    return false;
  }

  const directoryName = path.basename(input.sourceDirectory);
  const destinationFile = path.join(input.destinationDirectory, `${directoryName}.json`);
  await fs.copyFile(coverageFilePath, destinationFile);

  return true;
};

const collectCoverageFiles = async (): Promise<void> => {
  const destinationDirectory = path.join(process.cwd(), "coverage/raw");
  await fs.mkdir(destinationDirectory, { recursive: true });

  const directoriesWithCoverage: string[] = [];

  for (const pattern of coverageSourcePatterns) {
    const matches = await glob(pattern);

    for (const match of matches) {
      const stats = await fs.stat(match);

      if (!stats.isDirectory()) {
        continue;
      }

      const copied = await copyCoverageFile({
        sourceDirectory: match,
        destinationDirectory,
      });

      if (copied) {
        directoriesWithCoverage.push(match);
      }
    }
  }

  if (directoriesWithCoverage.length > 0) {
    console.log(
      `Found coverage.json in: ${directoriesWithCoverage.map(removeParentSegments).join(", ")}`,
    );
  }

  console.log(`Coverage collected into: ${process.cwd()}`);
};

await collectCoverageFiles();
