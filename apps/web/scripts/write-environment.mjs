import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const environmentFilePath = resolve('apps/web/src/environments/environment.ts');
const netlifyBuild = process.env.NETLIFY === 'true';

const config = {
  apiUrl: readEnvironmentVariable({
    name: 'SPARKFLOW_API_URL',
    fallback: 'http://localhost:3000',
  }),
  auth: {
    issuer: readEnvironmentVariable({
      name: 'SPARKFLOW_AUTH_ISSUER',
      fallback: 'http://localhost:8080/realms/sparkflow',
    }),
    clientId: readEnvironmentVariable({
      name: 'SPARKFLOW_AUTH_CLIENT_ID',
      fallback: 'sparkflow-web',
    }),
  },
};

mkdirSync(dirname(environmentFilePath), { recursive: true });
writeFileSync(
  environmentFilePath,
  `export const environment = ${JSON.stringify(config, null, 2)};\n`,
);

function readEnvironmentVariable(input) {
  const value = process.env[input.name];

  if (value !== undefined && value.length > 0) {
    return value;
  }

  if (!netlifyBuild) {
    return input.fallback;
  }

  console.error(`${input.name} must be configured for Netlify builds.`);
  process.exit(1);
}
