const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");
const wpContentPath = path.join(process.cwd(), "wp-content");
const wpConfigPath = path.join(process.cwd(), "wp-config.php");
const dockerfilePath = path.join(process.cwd(), "Dockerfile");

function checkDockerImage(imageName) {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkDockerContainer(containerName) {
  try {
    execSync(`docker inspect ${containerName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureDockerfileExists(wpVersion) {
  if (fs.existsSync(dockerfilePath)) return;

  console.log("🧪 No se encontró Dockerfile. Generando uno...");

  const dockerfileContent = `FROM wordpress:${wpVersion}

RUN apt-get update && apt-get install -y \\
  git \\
  unzip \\
  curl \\
  && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
`;

  fs.writeFileSync(dockerfilePath, dockerfileContent);
  console.log("✅ Dockerfile generado");
}

function buildCustomImage() {
  console.log("📦 Construyendo imagen personalizada...");
  execSync(`docker build -t juzt-wordpress:dev -f Dockerfile .`, { stdio: "inherit" });
}

function generateWpConfig(config) {
  const content = `<?php
define('DB_NAME', '${config.database.name}');
define('DB_USER', '${config.database.user}');
define('DB_PASSWORD', '${config.database.password}');
define('DB_HOST', '${config.database.host}');
$table_prefix = '${config.database.tablePrefix}';
define('WP_DEBUG', true);
define('WP_HOME', 'http://localhost:${config.server.port}');
define('WP_SITEURL', 'http://localhost:${config.server.port}');
define('FORCE_SSL_ADMIN', false);
define('COOKIE_DOMAIN', false);
if ( !defined('ABSPATH') ) define('ABSPATH', __DIR__ . '/');
require_once(ABSPATH . 'wp-settings.php');
`;

  fs.writeFileSync(wpConfigPath, content);
  console.log("✅ wp-config.php generado");
}

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.log("⚙️ No se encontró juzt.config.js. Ejecutando init...");
    await require("./init")();
  }

  const config = require(configPath);
  const containerName = `juzt-wp-${slugify(config.name, { lower: true })}-${config.server.port}`;

  ensureDockerfileExists(config.wp_version);

  if (!checkDockerImage("juzt-wordpress:dev")) {
    buildCustomImage();
  }

  if (!fs.existsSync(wpContentPath)) {
    console.error("❌ La carpeta wp-content no existe.");
    process.exit(1);
  }

  generateWpConfig(config);

  if (checkDockerContainer(containerName)) {
    console.log(`⚠️ El contenedor ${containerName} ya existe. Usa 'juzt-cli down' para eliminarlo.`);
    return;
  }

  const dockerCmd = [
    "docker run -d",
    `--name ${containerName}`,
    `-p ${config.server.port}:80`,
    `-v ${wpContentPath}:/var/www/html/wp-content`,
    `-v ${wpConfigPath}:/var/www/html/wp-config.php`,
    `juzt-wordpress:dev`
  ].join(" ");

  console.log("🚀 Levantando entorno...");
  execSync(dockerCmd, { stdio: "inherit" });
  console.log(`✅ Contenedor ${containerName} levantado en http://localhost:${config.server.port}`);
};