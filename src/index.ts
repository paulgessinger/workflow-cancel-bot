import { Application } from 'probot' // eslint-disable-line no-unused-vars

export = (app: Application) => {
  app.on('pull_request.synchronize', async (context) => {
    // console.log(context);
    // const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    // await context.github.issues.createComment(issueComment)

    const { name, payload, github } = context;
    console.log(name);

    const {pull_request: { head: {ref, sha, repo: {full_name: source_repo}}}} = payload;

    console.log(ref, sha);

  // console.log({ eventName, sha, headSha, branch, owner, repo, GITHUB_RUN_ID });
  let workflow_ids: number[] = [];

  // get workflow IDs

  let workflows = await github.actions.listRepoWorkflows(context.repo());

  for (let wf of workflows.data.workflows) {
    // console.log(wf);
    workflow_ids.push(wf.id);
  }

  console.log(`Found workflow_id: ${JSON.stringify(workflow_ids)}`);

  await Promise.all(workflow_ids.map(async (workflow_id) => {
    try {
      console.log(`Looking for runs of workflow ID ${workflow_id}, and ref ${source_repo}:${ref}`);
      const { data } = await github.actions.listWorkflowRuns(context.repo({
        workflow_id,
        ref
      }));
      console.log(`Found ${data.total_count} runs total.`);
      // console.log(data.workflow_runs);
      const runningWorkflows = data.workflow_runs.filter(
        workflow => (
          workflow.head_repository.full_name === source_repo 
          && workflow.head_branch === ref 
          && workflow.head_sha !== sha 
          && workflow.status !== 'completed'
        )
      );
      console.log(`Found ${runningWorkflows.length} runs in progress.`);
      for (const {id, head_sha, head_branch, status, head_repository: {full_name}} of runningWorkflows) {
        console.log('Cancelling another run: ', {id, full_name, head_branch, head_sha, status});
        const res = await github.actions.cancelWorkflowRun(context.repo({
          run_id: id
        }));
        console.log(`Cancel run ${id} responded with status ${res.status}`);
      }
    } catch (e) {
      const msg = e.message || e;
      console.log(`Error while cancelling workflow_id ${workflow_id}: ${msg}`);
    }
  }));

  });
};
