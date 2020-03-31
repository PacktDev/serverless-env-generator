#!/usr/bin/env node
// Copyright 2019 Packt Publishing Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const log = require('debug')('packt:serverless-env-generator');

const commander = require('commander');
const Fs = require('fs');
const fse = require('fs-extra');
const YAML = require('yamljs');
const path = require('path');


const loadDotEnv = async (filename) => {
  const buffer = await fse.readFile(filename);
  const asString = buffer.toString();
  log('current: %S', asString);

  const result = {};
  asString
    .split('\n')
    .forEach((record) => {
      const split = record.split('=');
      // eslint-disable-next-line prefer-destructuring
      if (split && split[0] && split[1]) result[split[0]] = split[1];
    });

  return result;
};

const buildEnvFile = (envVariables) => {
  let file = '';
  Object.keys(envVariables)
    .forEach((key) => {
      const value = envVariables[key];

      file += `${key}=${value}\n`;
    });

  return file;
};

const loadFile = (filename) => {
  if (!commander.D) return YAML.load(filename);

  return loadDotEnv(filename);
};

(async () => {
  // Commander config
  commander
    .version(require('./package.json').version)
    .option('--stage [type]', 'Add deployment stage [stage]', 'dev')
    .option(
      '--serverless-env-file [filename]',
      'Set the serverless env file',
      'serverless.env.yml',
    )
    .option('--env-variables [filename|string]', 'Set the serverless env file')
    .option('--local, -l', 'Use .env file')
    .option('--dotenv, -d', 'Write .env file rather than yaml')
    .parse(process.argv);

  // Use local ENV
  if (commander.local) {
    require('dotenv').load();
  }

  // log('commander: %O', commander);

  // Name of the ENV storage file
  const serverlessEnvFile = commander.D ? '.env' : commander.serverlessEnvFile;

  const CWD = process.cwd();

  log('PWD: %O', CWD);

  log('Env File: %O', serverlessEnvFile);

  // Hard code the STAGE to dev for initial run through or if not set
  const STAGE = commander.stage;
  log('Stage: %O', STAGE);

  // The ENV variables
  if (!commander.envVariables) {
    console.log(
      'Please provide --env-variables either file containing an array of ENV variable names or a comma (,) separated list of ENV variable names',
    );
    process.exit(1);
  }

  const envVariablesPath = path.join(CWD, commander.envVariables);

  log('Env Variables: %O', envVariablesPath);

  const availableEnvs = Fs.existsSync(envVariablesPath)
    ? require(envVariablesPath)
    : commander.envVariables.split(',');

  log('available envs: %O', availableEnvs);

  // Prepopulate the ENV if a serverless.env.yml exists
  const envVariables = Fs.existsSync(serverlessEnvFile)
    ? await loadFile(serverlessEnvFile)
    : {};

  log('current env: %O', envVariables);

  // If the STAGE doesn't exist, create it
  if (!commander.D && !envVariables[STAGE]) {
    envVariables[STAGE] = {};
  }

  // Populate with blank variables for anything not already defined
  if (!commander.D) {
    for (let i = 0; i < availableEnvs.length; i += 1) {
      if (!envVariables[STAGE][availableEnvs[i]]) {
        envVariables[STAGE][availableEnvs[i]] = '';
      }
    }
  } else {
    for (let i = 0; i < availableEnvs.length; i += 1) {
      if (!envVariables[availableEnvs[i]]) {
        envVariables[availableEnvs[i]] = '';
      }
    }
  }

  // Populate from ENV variables
  if (!commander.D) {
    Object.keys(envVariables[STAGE]).map((key) => {
      const stageKey = `${STAGE}_${key}`.toUpperCase();
      if (process.env[key] || process.env[stageKey]) {
        envVariables[STAGE][key] = process.env[stageKey]
          ? process.env[stageKey]
          : process.env[key];
      }

      return true;
    });
  } else {
    Object.keys(envVariables).map((key) => {
      const stageKey = `${STAGE}_${key}`.toUpperCase();
      if (process.env[key] || process.env[stageKey]) {
        envVariables[key] = process.env[stageKey]
          ? process.env[stageKey]
          : process.env[key];
      }

      return true;
    });
  }

  // Convert the object into YAML
  if (!commander.D) {
    const ymlEnv = YAML.stringify(envVariables);

    // Write the YAML to disk so it can be read by sls deploy --stage <STAGE>
    Fs.writeFile(serverlessEnvFile, ymlEnv, (err) => {
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
  } else {
    const envFile = buildEnvFile(envVariables);
    fse.writeFile(serverlessEnvFile, envFile)
      .then(() => {
        console.log(`${serverlessEnvFile} has been created`);
        process.exit(0);
      })
      .catch((error) => {
        log('error: %O', error);
        console.error(error);
        process.exit(1);
      });
  }
})();
