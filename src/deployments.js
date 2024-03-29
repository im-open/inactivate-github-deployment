const { Octokit } = require('@octokit/rest');
const { graphql } = require('@octokit/graphql');
const WORKFLOW_DEPLOY = 'workflowdeploy';

async function inactivateDeployment(context) {
  const octokit = new Octokit({ auth: context.token });
  const octokitGraphQl = graphql.defaults({
    headers: {
      authorization: `token ${context.token}`
    }
  });

  const params = {
    owner: context.owner,
    repo: context.repo,
    task: WORKFLOW_DEPLOY,
    environment: context.environment,
    per_page: 100
  };

  const deploymentsList = (
    await octokit.paginate(octokit.rest.repos.listDeployments, params)
  ).filter(d => d.payload.entity == context.entity && d.payload.instance == context.instance);

  const deploymentNodeIds = deploymentsList.map(d => d.node_id);
  const statusesQuery = `
      query($deploymentNodeIds: [ID!]!) {
        deployments: nodes(ids: $deploymentNodeIds) {
          ... on Deployment {
            id
            databaseId
            statuses(first:1) {
              nodes {
                description
                state
                createdAt
              }
            }
          }
        }
      }`;

  const statuses = await octokitGraphQl(statusesQuery, { deploymentNodeIds: deploymentNodeIds });

  for (let i = 0; i < statuses.deployments.length; i++) {
    let deploymentQl = statuses.deployments[i];
    let deployment = deploymentsList.filter(d => d.node_id == deploymentQl.id)[0];

    for (let j = 0; j < deploymentQl.statuses.nodes.length; j++) {
      const status = deploymentQl.statuses.nodes[j];

      if (deployment.payload.instance == context.instance && status.state == 'SUCCESS') {
        await createDeploymentStatus(
          octokit,
          context.owner,
          context.repo,
          deployment.id,
          'inactive',
          'Inactivated by workflow'
        );
      }
    }
  }
}

async function createDeploymentStatus(octokit, owner, repo, deployment_id, state, description) {
  const statusParams = {
    owner: owner,
    repo: repo,
    deployment_id: deployment_id,
    state: state,
    description: description,
    auto_inactive: false // we will manually inactivate prior deployments
  };
  const status = await octokit.rest.repos.createDeploymentStatus(statusParams);
}

module.exports = {
  inactivateDeployment
};
