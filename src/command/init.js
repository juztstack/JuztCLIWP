#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");

const prompt = inquirer.default?.prompt || inquirer.prompt;

async function runInit() {
  console.log("🛠️ Welcome to Juzt-CLI-WP 1.2.0 Init");

  const answers = await prompt([
    {
      name: "name",
      message: "Project name:",
      validate: input => input ? true : "This field is required"
    },
    {
      name: "wp_version",
      message: "WordPress version:",
      default: "6.8.3"
    },
    {
      name: "port",
      message: "Local port:",
      default: 8080,
      validate: input => /^\d+$/.test(input) ? true : "Must be a number"
    },
    {
      type: "list",
      name: "containerManager",
      message: "Which container manager do you want to use?",
      choices: ["docker", "podman"],
      default: "docker"
    },
    {
      type: "confirm",
      name: "useLocalDatabase",
      message: "Do you want to use a local database in a container?",
      default: true
    },
    {
      name: "localDbImage",
      message: "Local database image:",
      default: "mysql:5.7",
      when: answers => answers.useLocalDatabase
    },
    {
      name: "localDbPassword",
      message: "Local DB root password:",
      default: "root",
      when: answers => answers.useLocalDatabase
    },
    {
      name: "localDbPort",
      message: "DB container internal port:",
      default: 3306,
      when: answers => answers.useLocalDatabase
    },
    {
      name: "db_host",
      message: "Remote database host:"
    },
    {
      name: "db_name",
      message: "Database name:"
    },
    {
      name: "db_user",
      message: "Database user:"
    },
    {
      name: "db_password",
      message: "Database password:"
    },
    {
      name: "tablePrefix",
      message: "Table prefix:",
      default: "wp_"
    },
    {
      name: "proxy_uploads",
      message: "Proxy URL for uploads (optional):"
    },
    {
      type: "confirm",
      name: "useSSH",
      message: "Do you want to configure SSH connection?",
      default: false
    },
    {
      name: "ssh_host",
      message: "SSH host:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_port",
      message: "SSH port:",
      default: 22,
      when: answers => answers.useSSH
    },
    {
      name: "ssh_user",
      message: "SSH user:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_password",
      message: "SSH password:",
      when: answers => answers.useSSH
    },
    {
      name: "ssh_key",
      message: "Path to private key file (optional):",
      when: answers => answers.useSSH
    },
    {
      "name": "remote_wp_path",
      "message": "Remote WordPress path (e.g., /var/www/html):",
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
  console.log(`✅ Configuration file generated at ${configPath}`);
}

module.exports = runInit;