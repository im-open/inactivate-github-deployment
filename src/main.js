const core = require('@actions/core');
const { setup } = require('./library.js');
const { inactivateDeployment } = require('./deployments.js');

async function run(context) {
  await inactivateDeployment(context);
}

try {
  const setupContext = setup();
  const runPromise = new Promise((resolve, reject) => {
    resolve(run(setupContext));
  });

  runPromise.then(() => {
    // The token can be sent by and filtered out in the log
    // but we'll delete it just to be safe.
    delete setupContext.token;
    console.log('Deployment inactivated.', setupContext);
  });
} catch (error) {
  //Anything that shows up here should be a re-thrown error where the detailed error was already logged.
  //We can set a generic failure message because the more detailed one should already have been logged.
  core.setFailed(`An error occurred retrieve GitHub deployments: ${error}`);
  return;
}
