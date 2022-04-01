const chalk = require("chalk");
const {
  TASK_COMPILE_SOLIDITY_LOG_COMPILATION_ERRORS,
} = require("hardhat/builtin-tasks/task-names");

// eslint-disable-next-line no-undef
subtask(TASK_COMPILE_SOLIDITY_LOG_COMPILATION_ERRORS).setAction(
  async ({ output }) => {
    if ((output || {}).errors === undefined) {
      return;
    }

    for (const error of output.errors) {
      if (error.severity === "error") {
        const errorMessage =
          getFormattedInternalCompilerErrorMessage(error) ||
          error.formattedMessage;

        console.error(chalk.red(errorMessage));
      } else {
        // log error object; useful for figuring out filter rule
        // console.log(error);
        const file = error.sourceLocation.file;
        if (/FluxAggregator/.test(file)) continue;
        if (/^@/.test(file)) continue;
        console.warn(chalk.yellow(error.formattedMessage));
      }
    }

    const hasConsoleErrors = output.errors.some(isConsoleLogError);
    if (hasConsoleErrors) {
      console.error(
        chalk.red(
          `The console.log call you made isn’t supported. See https://hardhat.org/console-log for the list of supported methods.`
        )
      );
      console.log();
    }
  }
);

/* helper functions we had to copy over from
 * https://github.com/nomiclabs/hardhat/blob/master/packages/hardhat-core/src/builtin-tasks/compile.ts
 */
function getFormattedInternalCompilerErrorMessage(error) {
  if (error.formattedMessage.trim() !== "InternalCompilerError:") {
    return;
  }

  return `${error.type}: ${error.message}`.replace(/[:\s]*$/g, "").trim();
}

function isConsoleLogError(error) {
  return (
    error.type === "TypeError" &&
    typeof error.message === "string" &&
    error.message.includes("log") &&
    error.message.includes("type(library console)")
  );
}
/*  end helper functions */
