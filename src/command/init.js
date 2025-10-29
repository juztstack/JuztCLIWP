#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");

const prompt = inquirer.default?.prompt || inquirer.prompt;

async function runInit() {
  console.log("🛠️ Bienvenido a Juzt-CLI 1.1.0 Init");

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
      type: "list",
      name: "containerManager",
      message: "¿Qué gestor de contenedores deseas usar?",
      choices: ["docker", "podman"],
      default: "docker"
    },
    {
      type: "confirm",
      name: "useLocalDatabase",
      message: "¿Deseas usar una base de datos local en contenedor?",
      default: true
    },
    {
      name: "localDbImage",
      message: "Imagen de base de datos local:",
      default: "mysql:5.7",
      when: answers => answers.useLocalDatabase
    },
    {
      name: "localDbPassword",
      message: "Contraseña root de la base local:",
      default: "root",
      when: answers => answers.useLocalDatabase
    },
    {
      name: "localDbPort",
      message: "Puerto interno del contenedor DB:",
      default: 3306,
      when: answers => answers.useLocalDatabase
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
    },
    {
      type: "confirm",
      name: "useSSH",
      message: "¿Deseas configurar conexión SSH?",
      default: false
    },
    {
      name: "ssh_host",
      message: "Host SSH:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_port",
      message: "Puerto SSH:",
      default: 22,
      when: answers => answers.useSSH
    },
    {
      name: "ssh_user",
      message: "Usuario SSH:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_password",
      message: "Contraseña SSH:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_key",
      message: "Ruta al archivo de clave privada (opcional):",
      when: answers => answers.useSSH
    },
    {
      "name": "remote_wp_path",
      "message": "Ruta al WordPress remoto (ej. /var/www/html):",
      "when": answers => answers.useSSH
    }
  ]);

  const config = {
    name: answers.name,
    wp_version: answers.wp_version,
    containerManager: answers.containerManager || "docker",
    useLocalDatabase: answers.useLocalDatabase,
    localDatabase: answers.useLocalDatabase
      ? {
          image: answers.localDbImage,
          rootPassword: answers.localDbPassword,
          port: parseInt(answers.localDbPort)
        }
      : undefined,
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
      : undefined,
    ssh: answers.useSSH
      ? {
          host: answers.ssh_host,
          port: parseInt(answers.ssh_port),
          user: answers.ssh_user,
          password: answers.ssh_password,
          privateKeyPath: answers.ssh_key || null,
          remoteWpPath: answers.remote_wp_path || null
        }
      : undefined
  };

  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};\n`;

  fs.writeFileSync(configPath, configContent);
  console.log(`✅ Archivo de configuración generado en ${configPath}`);
}

module.exports = runInit;