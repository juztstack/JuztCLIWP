#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");

const prompt = inquirer.default?.prompt || inquirer.prompt;

async function runInit() {
  console.log("🛠️ Bienvenido a Juzt-CLI Init");

  const answers = await prompt([
    {
      name: "name",
      message: "Nombre del proyecto:",
      validate: input => input ? true : "Este campo es obligatorio"
    },
    {
      name: "wp_version",
      message: "Versión de WordPress:",
      default: "6.8.3"
    },
    {
      name: "port",
      message: "Puerto local:",
      default: 8080,
      validate: input => /^\d+$/.test(input) ? true : "Debe ser un número"
    },
    {
      name: "db_host",
      message: "Host de la base de datos remota:"
    },
    {
      name: "db_name",
      message: "Nombre de la base de datos:"
    },
    {
      name: "db_user",
      message: "Usuario de la base de datos:"
    },
    {
      name: "db_password",
      message: "Contraseña de la base de datos:"
    },
    {
      name: "tablePrefix",
      message: "Prefijo de tablas:",
      default: "wp_"
    },
    {
      name: "proxy_uploads",
      message: "URL de proxy para uploads (opcional):"
    }
  ]);

  const config = {
    name: answers.name,
    wp_version: answers.wp_version,
    database: {
      host: answers.db_host,
      name: answers.db_name,
      user: answers.db_user,
      password: answers.db_password,
      tablePrefix: answers.tablePrefix
    },
    server: {
      port: parseInt(answers.port)
    },
    proxy: answers.proxy_uploads
      ? { uploads: answers.proxy_uploads }
      : undefined
  };

  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};\n`;

  fs.writeFileSync(configPath, configContent);
  console.log(`✅ Archivo de configuración generado en ${configPath}`);
}

module.exports = runInit;