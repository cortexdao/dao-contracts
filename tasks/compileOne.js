// Copied over from
// https://github.com/SetProtocol/index-deployments/blob/master/tasks/compileOne.ts
// only changing/removing some types for TypeScript
const { task } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
  TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH,
  TASK_COMPILE_SOLIDITY_COMPILE_JOB,
} = require("hardhat/builtin-tasks/task-names");

task("compile:one", "Compiles a single contract in isolation")
  .addPositionalParam("contractName")
  .setAction(async function (args, env) {
    const sourceName = env.artifacts.readArtifactSync(
      args.contractName
    ).sourceName;

    const dependencyGraph = await env.run(
      TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH,
      { sourceNames: [sourceName] }
    );

    const resolvedFiles = dependencyGraph
      .getResolvedFiles()
      .filter((resolvedFile) => {
        return resolvedFile.sourceName === sourceName;
      });

    const compilationJob = await env.run(
      TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
      {
        dependencyGraph,
        file: resolvedFiles[0],
      }
    );

    await env.run(TASK_COMPILE_SOLIDITY_COMPILE_JOB, {
      compilationJob,
      compilationJobs: [compilationJob],
      compilationJobIndex: 0,
      emitsArtifacts: true,
      quiet: true,
    });
  });
