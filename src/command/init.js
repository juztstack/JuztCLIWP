#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const slugify = require("slugify");
const { execSync } = require("child_process");

const configPath = path.join(process.cwd(), "juzt.config.js");
const prompt = inquirer.default?.prompt || inquirer.prompt;

async function runInit() {
  console.log("🛠️ Bienvenido a Juzt-CLI-WP Init");

  const answers = await prompt([
    {
      name: "name",
      message: "Nombre del proyecto:",
      validate: (input) => (input ? true : "Este campo es obligatorio"),
    },
    {
      name: "wp_version",
      message: "Versión de WordPress:",
      default: "6.8.3",
    },
    {
      name: "port",
      message: "Puerto local:",
      default: 8080,
      validate: (input) => (/^\d+$/.test(input) ? true : "Debe ser un número"),
    },
    {
      type: "list",
      name: "containerManager",
      message: "¿Qué gestor de contenedores quieres usar?",
      choices: ["docker", "podman"],
      default: "docker",
    },
    {
      type: "confirm",
      name: "newProject",
      message:
        "¿Quieres iniciar un proyecto WordPress desde cero (sin clonar DB)?",
      default: false,
    },
    {
      type: "confirm",
      name: "useLocalDatabase",
      message: "¿Quieres usar una base de datos local en un contenedor?",
      default: true,
      when: (answers) => !answers.newProject,
    },
    {
      name: "localDbImage",
      message: "Imagen de base de datos local:",
      default: "mysql:5.7",
      when: (answers) => answers.useLocalDatabase && !answers.newProject,
    },
    {
      name: "localDbPassword",
      message: "Contraseña root de la DB local:",
      default: "root",
      when: (answers) => answers.useLocalDatabase && !answers.newProject,
    },
    {
      name: "localDbPort",
      message: "Puerto interno del contenedor DB:",
      default: 3306,
      when: (answers) => answers.useLocalDatabase && !answers.newProject,
    },
    {
      name: "db_host",
      message: "Host de la base de datos remota:",
      when: (answers) => !answers.newProject,
    },
    {
      name: "db_name",
      message: "Nombre de la base de datos:",
      when: (answers) => !answers.newProject,
    },
    {
      name: "db_user",
      message: "Usuario de la base de datos:",
      when: (answers) => !answers.newProject,
    },
    {
      name: "db_password",
      message: "Contraseña de la base de datos:",
      when: (answers) => !answers.newProject,
    },
    {
      name: "tablePrefix",
      message: "Prefijo de tablas:",
      default: "wp_",
    },
    {
      name: "proxy_uploads",
      message: "URL proxy para uploads (opcional):",
    },
    {
      type: "confirm",
      name: "useSSH",
      message: "¿Quieres configurar conexión SSH?",
      default: false,
      when: (answers) => !answers.newProject,
    },
    {
      name: "ssh_host",
      message: "Host SSH:",
      when: (answers) => answers.useSSH,
    },
    {
      name: "ssh_port",
      message: "Puerto SSH:",
      default: 22,
      when: (answers) => answers.useSSH,
    },
    {
      name: "ssh_user",
      message: "Usuario SSH:",
      when: (answers) => answers.useSSH,
    },
    {
      name: "ssh_password",
      message: "Contraseña SSH:",
      when: (answers) => answers.useSSH,
    },
    {
      name: "ssh_key",
      message: "Ruta al archivo de clave privada (opcional):",
      when: (answers) => answers.useSSH,
    },
    {
      name: "remote_wp_path",
      message: "Ruta remota de WordPress (ej. /var/www/html):",
      when: (answers) => answers.useSSH,
    },
  ]);

  // Construir config a partir de las respuestas
  // Construir config a partir de las respuestas
  const config = {
    name: answers.name,
    wp_version: answers.wp_version,
    containerManager: answers.containerManager || "docker",
    isFreshInstall: answers.newProject,
    // 👇 En proyectos en blanco forzamos useLocalDatabase a true
    useLocalDatabase: answers.newProject ? true : answers.useLocalDatabase,
    // 👇 Solo definimos localDatabase si no es proyecto en blanco
    localDatabase:
      !answers.newProject && answers.useLocalDatabase
        ? {
            image: answers.localDbImage,
            rootPassword: answers.localDbPassword,
            port: parseInt(answers.localDbPort),
          }
        : {
            image: "mysql:5.7",
            rootPassword: "root",
            port: 3306,
          },
    // 👇 Siempre generamos database con datos coherentes
    database: answers.newProject
      ? {
          host: `juzt-db-${slugify(answers.name, { lower: true })}-${
            answers.port
          }`,
          name: "wordpress",
          user: "wpuser", // usuario no root
          password: "wppass", // contraseña para ese usuario
          tablePrefix: answers.tablePrefix,
        }
      : {
          host: answers.db_host,
          name: answers.db_name,
          user: answers.db_user,
          password: answers.db_password,
          tablePrefix: answers.tablePrefix,
        },
    server: {
      port: parseInt(answers.port),
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
          remoteWpPath: answers.remote_wp_path || null,
        }
      : undefined,
  };

  // Guardar config
  const configContent = `module.exports = ${JSON.stringify(
    config,
    null,
    2
  )};\n`;
  fs.writeFileSync(configPath, configContent);
  console.log(`✅ Archivo de configuración generado en ${configPath}`);

  // Descargar WordPress en versión específica
  console.log(`⬇️ Descargando WordPress versión ${config.wp_version}...`);
  try {
    const wpZip = path.join(
      process.cwd(),
      `wordpress-${config.wp_version}.zip`
    );
    const url = `https://wordpress.org/wordpress-${config.wp_version}.zip`;

    execSync(`curl -o "${wpZip}" ${url}`, { stdio: "inherit" });
    execSync(`unzip "${wpZip}" -d "${process.cwd()}"`, { stdio: "inherit" });
    execSync(`rm "${wpZip}"`);
    execSync(
      `mv "${path.join(
        process.cwd(),
        "wordpress/wp-content"
      )}" "${process.cwd()}/wp-content"`
    );
    execSync(`rm -rf "${path.join(process.cwd(), "wordpress")}"`);

    console.log(`✅ wp-content instalado en la carpeta actual`);
  } catch (err) {
    console.error("❌ Error descargando WordPress:", err.message);
  }

  // Generar wp-config.php básico
  console.log("⚙️ Generando wp-config.php...");
  const wpConfig = `
<?php
define( 'DB_NAME', '${config.database.name}' );
define( 'DB_USER', '${config.database.user}' );
define( 'DB_PASSWORD', '${config.database.password}' );
define( 'DB_HOST', '${config.database.host}' );
$table_prefix = '${config.database.tablePrefix}';
define( 'WP_DEBUG', true );
if ( !defined('ABSPATH') ) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
`;
  fs.writeFileSync(path.join(process.cwd(), "wp-config.php"), wpConfig);
  console.log("✅ wp-config.php generado");
}

module.exports = runInit;
