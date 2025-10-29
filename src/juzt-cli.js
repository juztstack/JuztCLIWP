#!/usr/bin/env node

const { Command } = require("commander");
const program = new Command();

const runInit = require("./command/init");
const runUp = require("./command/up");
const runDown = require("./command/down");

program
    .command("init")
    .description("Genera el archivo juzt.config.js")
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
  .description("Sincroniza la base de datos remota con la local vía SSH")
  .action(require("./command/db-pull"));

program
  .command("uploads:pull")
  .description("Sincroniza una carpeta remota dentro de WordPress")
  .requiredOption("--path <path>", "Ruta relativa dentro de WordPress (ej: wp-content/plugins/)")
  .option("--method <method>", "Método de sincronización: rsync o scp", "rsync")
  .action((options) => require("./command/uploads-pull")(options));

program.parse(process.argv);