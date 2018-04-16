#!/usr/bin/env node
const commander = require('commander');
const Fs = require('fs');
const YAML = require('yamljs');

// Commander config
commander
  .version(require('./package.json').version)
  .option('--stage [type]', 'Add deployment stage [stage]', 'dev')
  .option(
    '--serverless-env-file [filename]',
    'Set the serverless env file',
    'serverless.env.yml'
  )
  .option('--env-variables [filename|string]', 'Set the serverless env file')
  .parse(process.argv);

// Name of the ENV storage file
const serverlessEnvFile = commander.serverlessEnvFile;

// Hard code the STAGE to dev for initial run through or if not set
const STAGE = commander.stage;

// The ENV variables
if (!commander.envVariables) {
  console.log(
    'Please provide --env-variables either file containing an array of ENV variable names or a comma (,) separated list of ENV variable names'
  );
  process.exit(1);
}
const availableEnvs = Fs.existsSync(commander.envVariables)
  ? require(commander.envVariables)
  : commander.envVariables.split(',');

// Prepopulate the ENV if a serverless.env.yml exists
const envVariables = Fs.existsSync(serverlessEnvFile)
  ? YAML.load(serverlessEnvFile)
  : {};

// If the STAGE doesn't exist, create it
if (!envVariables[STAGE]) {
  envVariables[STAGE] = {};
}

// Populate with blank variables for anything not already defined
for (let i = 0; i < availableEnvs.length; i += 1) {
  if (!envVariables[STAGE][availableEnvs[i]]) {
    envVariables[STAGE][availableEnvs[i]] = '';
  }
}

// Populate from ENV variables
Object.keys(envVariables[STAGE]).map(key => {
  if (process.env[key] || process.env[`${STAGE}-${key}`]) {
    envVariables[STAGE][key] = process.env[`${STAGE}-${key}`]
      ? process.env[`${STAGE}-${key}`]
      : process.env[key];
  }
  return true;
});

// Convert the object into YAML
const ymlEnv = YAML.stringify(envVariables);

// Write the YAML to disk so it can be read by sls deploy --stage <STAGE>
Fs.writeFile(serverlessEnvFile, ymlEnv, err => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${serverlessEnvFile} has been created`);
    process.exit(0);
  }
});
