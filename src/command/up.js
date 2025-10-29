const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const { execSync } = require("child_process");

const configPath = path.join(process.cwd(), "juzt.config.js");
const wpContentPath = path.join(process.cwd(), "wp-content");
const wpConfigPath = path.join(process.cwd(), "wp-config.php");
const dockerfilePath = path.join(process.cwd(), "Dockerfile");
const muPluginDir = path.join(wpContentPath, "mu-plugins");
const remoteMediaPluginPath = path.join(muPluginDir, "serve-remote-media.php");

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

function generateWpConfig(config, dbHost) {
  const isLocal = config.useLocalDatabase;

  const dbName = isLocal ? config.database.name : config.database.name;
  const dbUser = isLocal ? "root" : config.database.user;
  const dbPassword = isLocal ? config.localDatabase.rootPassword : config.database.password;

  const content = `<?php
define('DB_NAME', '${dbName}');
define('DB_USER', '${dbUser}');
define('DB_PASSWORD', '${dbPassword}');
define('DB_HOST', '${dbHost}');
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
  console.log("✅ wp-config.php generado con credenciales " + (isLocal ? "locales" : "remotas"));
}


function generateRemoteMediaPlugin(config) {
  const shouldServe = config.serveRemoteMedia !== false;
  const remoteUrl = config.proxy?.uploads;

  if (!shouldServe || !remoteUrl) {
    console.log("🚫 Plugin de medios remotos desactivado por configuración.");
    return;
  }

  if (!fs.existsSync(muPluginDir)) {
    fs.mkdirSync(muPluginDir, { recursive: true });
  }

  const pluginContent = `<?php
/**
 * Plugin para servir medios desde dominio remoto
 */
add_filter('wp_get_attachment_url', function($url) {
  return str_replace(
    home_url('/wp-content/uploads'),
    '${remoteUrl}',
    $url
  );
});
`;

  fs.writeFileSync(remoteMediaPluginPath, pluginContent);
  console.log("🌐 Plugin para servir medios remotos generado en mu-plugins");
}

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.log("⚙️ No se encontró juzt.config.js. Ejecutando init...");
    await require("./init")();
  }

  const config = require(configPath);
  const manager = config.containerManager || "docker";
  const container = require(`../helpers/${manager}.js`);

  const wpContainerName = `juzt-wp-${slugify(config.name, { lower: true })}-${config.server.port}`;
  const dbContainerName = `juzt-db-${slugify(config.name, { lower: true })}-${config.server.port}`;

  // 🌐 Crear red compartida si no existe
  try {
    execSync(`${manager} network inspect juzt-net`, { stdio: "ignore" });
  } catch {
    console.log("🌐 Creando red juzt-net...");
    execSync(`${manager} network create juzt-net`);
  }

  ensureDockerfileExists(config.wp_version);

  if (!container.checkImageExists("juzt-wordpress:dev")) {
    container.buildImage();
  }

  if (!fs.existsSync(wpContentPath)) {
    console.error("❌ La carpeta wp-content no existe.");
    process.exit(1);
  }

  // 🧱 Levantar contenedor DB si está activado
  if (config.useLocalDatabase) {
    if (!container.checkContainerExists(dbContainerName)) {
      console.log("🗄️ Levantando contenedor de base de datos local...");
      const dbCmd = [
        `${manager} run -d`,
        `--name ${dbContainerName}`,
        `--network juzt-net`,
        `-e MYSQL_ROOT_PASSWORD=${config.localDatabase.rootPassword}`,
        `-e MYSQL_DATABASE=${config.database.name}`,
        `-e MYSQL_USER=${config.database.user}`,
        `-e MYSQL_PASSWORD=${config.database.password}`,
        `-p ${config.localDatabase.port}:3306`,
        `${config.localDatabase.image}`
      ].join(" ");
      execSync(dbCmd, { stdio: "inherit" });
      console.log(`✅ Contenedor DB ${dbContainerName} levantado`);
    } else {
      console.log(`⚠️ El contenedor DB ${dbContainerName} ya existe.`);
    }
  }

  const dbHost = config.useLocalDatabase ? dbContainerName : config.database.host;

  generateWpConfig(config, dbHost);
  generateRemoteMediaPlugin(config);

  if (container.checkContainerExists(wpContainerName)) {
    console.log(`⚠️ El contenedor ${wpContainerName} ya existe. Usa 'juzt-cli down' para eliminarlo.`);
    return;
  }

  const wpCmd = [
    `${manager} run -d`,
    `--name ${wpContainerName}`,
    `--network juzt-net`,
    `-p ${config.server.port}:80`,
    `-v ${wpContentPath}:/var/www/html/wp-content`,
    `-v ${wpConfigPath}:/var/www/html/wp-config.php`,
    `juzt-wordpress:dev`
  ].join(" ");

  console.log("🚀 Levantando entorno WordPress...");
  execSync(wpCmd, { stdio: "inherit" });
  console.log(`✅ Contenedor ${wpContainerName} levantado en http://localhost:${config.server.port}`);
};