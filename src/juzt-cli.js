#!/usr/bin/env node

const { Command } = require("commander");
const program = new Command();

const runInit = require("./command/init");
const runUp = require("./command/up");
const runDown = require("./command/down");

program
    .command("init")
    .description("Generate juzt.config.js configuration file")
    .action(runInit);

program
    .command("up")
    .description("Start dev server")
    .action(runUp);

program
    .command("down")
    .description("Cancel dev server")
    .action(runDown);

program
  .command("db:pull")
  .description("Sync remote database to local via SSH")
  .action(require("./command/db-pull"));

program
  .command("uploads:pull")
  .description("Sync a remote folder within WordPress")
  .requiredOption("--path <path>", "Relative path inside WordPress (e.g., wp-content/plugins/)")
  .option("--method <method>", "Sync method: rsync or scp", "rsync")
  .action((options) => require("./command/uploads-pull")(options));

program.parse(process.argv);