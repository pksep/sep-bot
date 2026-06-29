const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(rootDir, '..');
const packageName = '@pksep/bot-api';
const outfile = path.resolve(
  rootDir,
  'static',
  'vendor',
  'pksep-bot-api.mjs'
);

const requireEsbuild = () => {
  const candidates = [
    'esbuild',
    path.resolve(workspaceDir, 'chat_client', 'node_modules', 'esbuild')
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next installed workspace copy.
    }
  }

  throw new Error(
    'Cannot find esbuild. Install it in sep-bot or run from a workspace that has chat_client/node_modules.'
  );
};

let entryPoint;

try {
  entryPoint = require.resolve(packageName, { paths: [rootDir] });
} catch {
  throw new Error(
    `Cannot find ${packageName}. Run "bun install" in sep-bot before building the browser SDK.`
  );
}

const browserEntryPath = `./${path
  .relative(rootDir, entryPoint)
  .split(path.sep)
  .join('/')}`;

fs.mkdirSync(path.dirname(outfile), { recursive: true });

requireEsbuild().buildSync({
  stdin: {
    contents: `
      import * as sdk from ${JSON.stringify(browserEntryPath)};

      export const SepBot = sdk.SepBot;
      export const ApiClient = sdk.ApiClient;
      export const parseWebhookUpdate = sdk.parseWebhookUpdate;
      export const SepBotError = sdk.SepBotError;
      export const ApiError = sdk.ApiError;
      export const PollingError = sdk.PollingError;
      export default sdk;
    `,
    loader: 'js',
    resolveDir: rootDir,
    sourcefile: 'pksep-bot-api-browser-entry.js'
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile,
  sourcemap: false,
  legalComments: 'none',
  absWorkingDir: rootDir
});

console.log(`Bundled ${packageName} browser SDK to ${outfile}`);
