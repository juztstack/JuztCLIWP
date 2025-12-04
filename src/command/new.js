const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const slugify = require("slugify");

module.exports = async function () {
  const configPath = path.join(process.cwd(), "juzt.config.js");
  if (!fs.existsSync(configPath)) {
    console.error("❌ No existe juzt.config.js. Ejecuta primero 'juzt-cli-wp init'.");
    process.exit(1);
  }

  const config = require(configPath);

  if (!config.isFreshInstall) {
    console.error("🚫 Este proyecto no está marcado como instalación nueva. Usa 'juzt-cli-wp up' para entornos clonados.");
    return;
  }

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

  // 🗄️ Levantar DB limpia
  if (config.useLocalDatabase) {
    if (!container.checkContainerExists(dbContainerName)) {
      console.log("🗄️ Iniciando contenedor de base de datos limpia...");
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
      console.log(`✅ Contenedor DB ${dbContainerName} iniciado`);
    } else {
      console.log(`⚠️ El contenedor DB ${dbContainerName} ya existe.`);
    }
  }

  // 🧱 Levantar WordPress limpio
  if (!container.checkContainerExists(wpContainerName)) {
    console.log("🚀 Iniciando contenedor WordPress limpio...");
    const wpCmd = [
      `${manager} run -d`,
      `--name ${wpContainerName}`,
      `--network juzt-net`,
      `-p ${config.server.port}:80`,
      `juzt-wordpress:dev`
    ].join(" ");
    execSync(wpCmd, { stdio: "inherit" });
    console.log(`✅ Contenedor ${wpContainerName} iniciado en http://localhost:${config.server.port}`);
    console.log("👉 Abre el navegador y completa la instalación inicial de WordPress.");
  } else {
    console.log(`⚠️ El contenedor ${wpContainerName} ya existe. Usa 'juzt-cli-wp down' para eliminarlo si quieres reiniciar.`);
  }
};