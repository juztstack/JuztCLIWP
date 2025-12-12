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

    console.log("🧪 Dockerfile not found. Generating one...");

    const dockerfileContent = `FROM wordpress:${wpVersion}

RUN apt-get update && apt-get install -y \\
  git \\
  unzip \\
  curl \\
  && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
`;

    fs.writeFileSync(dockerfilePath, dockerfileContent);
    console.log("✅ Dockerfile generated");
}

function generateWpConfig(config, dbHost) {
    const dbName = config.database.name;
    const dbUser = config.database.user;
    const dbPassword = config.database.password;

    const homeUrl = config.useLocalDomain && config.localDomain
        ? `http://${config.localDomain}`
        : `http://localhost:${config.server.port}`;

    const content = `<?php
define('DB_NAME', '${dbName}');
define('DB_USER', '${dbUser}');
define('DB_PASSWORD', '${dbPassword}');
define('DB_HOST', '${dbHost}');
$table_prefix = '${config.database.tablePrefix}';
define('WP_DEBUG', true);
define('WP_HOME', '${homeUrl}');
define('WP_SITEURL', '${homeUrl}');
if ( !defined('ABSPATH') ) define('ABSPATH', __DIR__ . '/');
require_once(ABSPATH . 'wp-settings.php');
`;
    fs.writeFileSync(wpConfigPath, content);
    console.log("✅ wp-config.php generado apuntando a DB host:", dbHost, "y URL:", homeUrl);
}

function generateRemoteMediaPlugin(config) {
    const remoteUrl = config.proxy?.uploads;
    if (!remoteUrl) {
        console.log("🚫 Remote media plugin disabled by configuration.");
        return;
    }

    if (!fs.existsSync(muPluginDir)) {
        fs.mkdirSync(muPluginDir, { recursive: true });
    }

    const pluginContent = `<?php
add_filter('wp_get_attachment_url', function($url) {
  return str_replace(home_url('/wp-content/uploads'), '${remoteUrl}', $url);
});
`;
    fs.writeFileSync(remoteMediaPluginPath, pluginContent);
    console.log("🌐 Remote media plugin generated in mu-plugins");
}

function ensureTraefikProxy(manager) {
    const proxyName = "juzt-proxy";

    const home = process.env.HOME || process.env.USERPROFILE;
    const juztDir = path.join(home, ".juzt");
    const dynamicFile = path.join(juztDir, "traefik_dynamic.yml");

    // Crear carpeta ~/.juzt
    if (!fs.existsSync(juztDir)) {
        fs.mkdirSync(juztDir, { recursive: true });
    }

    // Crear archivo dinámico si no existe
    if (!fs.existsSync(dynamicFile)) {
        fs.writeFileSync(dynamicFile, "http:\n  routers: {}\n  services: {}\n");
    }

    // Verificar si ya está corriendo
    try {
        execSync(`${manager} ps --format "{{.Names}}" | grep "^${proxyName}$"`, {
            stdio: "ignore",
            shell: true,
        });
        console.log("🔁 Proxy juzt-proxy ya está corriendo.");
        return;
    } catch { }

    console.log("🚦 Starting Traefik proxy (juzt-proxy)...");

    const traefikCmd = [
        `${manager} run -d`,
        `--name ${proxyName}`,
        `--network juzt-net`,
        `-p 9080:9080`,   // HTTP
        `-p 9000:8080`,   // Dashboard
        `-v "${dynamicFile}:/etc/traefik/dynamic.yml"`,
        `traefik:v3.0`,
        `--api.dashboard=true`,
        `--api.insecure=true`,
        `--providers.file.filename=/etc/traefik/dynamic.yml`,
        `--entrypoints.web.address=:9080`
    ].join(" ");

    execSync(traefikCmd, { stdio: "inherit" });
    console.log("✅ Traefik proxy started.");
}




function updateTraefikDynamicConfig(config, wpContainerName) {
    const home = process.env.HOME || process.env.USERPROFILE;
    const dynamicFile = path.join(home, ".juzt", "traefik_dynamic.yml");

    const domain = config.localDomain;
    const routerName = slugify(config.name, { lower: true });

    const yaml = `
http:
  routers:
    ${routerName}:
      rule: "Host(\`${domain}\`)"
      entryPoints:
        - web
      service: ${routerName}

  services:
    ${routerName}:
      loadBalancer:
        servers:
          - url: "http://${wpContainerName}:80"
`;

    fs.writeFileSync(dynamicFile, yaml);
    console.log("✅ Traefik dynamic config updated.");
}





module.exports = async function () {
    if (!fs.existsSync(configPath)) {
        console.log("⚙️ juzt.config.js not found. Running init...");
        await require("./init")();
    }

    const config = require(configPath);
    const manager = config.containerManager || "docker";
    const container = require(`../helpers/${manager}.js`);

    const projectSlug = slugify(config.name, { lower: true });
    const wpContainerName = `juzt-wp-${projectSlug}-${config.server.port}`;
    const dbContainerName = `juzt-db-${projectSlug}-${config.server.port}`;

    // 🌐 Crear red compartida si no existe
    try {
        execSync(`${manager} network inspect juzt-net`, { stdio: "ignore" });
    } catch {
        console.log("🌐 Creating network juzt-net...");
        execSync(`${manager} network create juzt-net`);
    }

    if (config.useLocalDomain && config.localDomain) {
        ensureTraefikProxy(manager);
        updateTraefikDynamicConfig(config, wpContainerName);
        console.log(`✅ Domain ready at http://${config.localDomain}:9080`);
    }




    ensureDockerfileExists(config.wp_version);

    if (!container.checkImageExists("juzt-wordpress:dev")) {
        container.buildImage();
    }

    if (!fs.existsSync(wpContentPath)) {
        console.error("❌ wp-content folder does not exist.");
        process.exit(1);
    }

    // 🧱 Levantar contenedor DB si está activado
    if (config.useLocalDatabase) {
        if (!container.checkContainerExists(dbContainerName)) {
            console.log("🗄️ Starting local database container...");

            const dbEnv = [
                `-e MYSQL_ROOT_PASSWORD=${config.localDatabase.rootPassword}`,
                `-e MYSQL_DATABASE=${config.database.name}`,
            ];

            if (config.database.user && config.database.user !== "root") {
                dbEnv.push(`-e MYSQL_USER=${config.database.user}`);
                dbEnv.push(`-e MYSQL_PASSWORD=${config.database.password}`);
            }

            const dbCmd = [
                `${manager} run -d`,
                `--name ${dbContainerName}`,
                `--network juzt-net`,
                ...dbEnv,
                `-p ${config.localDatabase.port}:3306`,
                `${config.localDatabase.image}`,
            ].join(" ");

            execSync(dbCmd, { stdio: "inherit" });
            console.log(`✅ DB container ${dbContainerName} started`);
        } else {
            console.log(`⚠️ DB container ${dbContainerName} already exists.`);
        }
    }

    const dbHost = config.useLocalDatabase ? dbContainerName : config.database.host;

    generateWpConfig(config, dbHost);
    generateRemoteMediaPlugin(config);

    if (container.checkContainerExists(wpContainerName)) {
        console.log(
            `⚠️ Container ${wpContainerName} already exists. Use 'juzt-cli down' to remove it.`
        );
        return;
    }

    const wpCmdParts = [
        `${manager} run -d`,
        `--name ${wpContainerName}`,
        `--network juzt-net`,
        `-v "${wpContentPath}:/var/www/html/wp-content"`,
        `-v "${wpConfigPath}:/var/www/html/wp-config.php"`,
    ];

    if (config.useLocalDomain && config.localDomain) {
        const routerName = projectSlug;
        wpCmdParts.push(
            `--network juzt-net`,
            `-v "${wpContentPath}:/var/www/html/wp-content"`,
            `-v "${wpConfigPath}:/var/www/html/wp-config.php"`
        );

    } else {
        // modo clásico localhost:puerto
        wpCmdParts.push(`-p ${config.server.port}:80`);
    }

    wpCmdParts.push(`juzt-wordpress:dev`);

    const wpCmd = wpCmdParts.join(" ");

    console.log("🚀 Starting WordPress environment...");
    execSync(wpCmd, { stdio: "inherit" });

    if (config.useLocalDomain && config.localDomain) {
        console.log(`✅ Container ${wpContainerName} started at http://${config.localDomain}:9080`);
    } else {
        console.log(
            `✅ Container ${wpContainerName} started at http://localhost:${config.server.port}`
        );
    }
};

