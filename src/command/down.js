const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");
const wpConfigPath = path.join(process.cwd(), "wp-config.php");

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.error("❌ No se encontró juzt.config.js en el directorio actual.");
    process.exit(1);
  }

  const config = require(configPath);
  const manager = config.containerManager || "docker";
  const container = require(`../helpers/${manager}.js`);

  const wpContainerName = `juzt-wp-${slugify(config.name, { lower: true })}-${config.server.port}`;
  const dbContainerName = `juzt-db-${slugify(config.name, { lower: true })}-${config.server.port}`;

  console.log(`🛑 Deteniendo contenedor ${wpContainerName}...`);
  container.stopContainer(wpContainerName);

  console.log(`🧨 Eliminando contenedor ${wpContainerName}...`);
  container.removeContainer(wpContainerName);

  if (config.useLocalDatabase) {
    console.log(`🛑 Deteniendo contenedor DB ${dbContainerName}...`);
    container.stopContainer(dbContainerName);

    console.log(`🧨 Eliminando contenedor DB ${dbContainerName}...`);
    container.removeContainer(dbContainerName);
  }

  if (fs.existsSync(wpConfigPath)) {
    fs.unlinkSync(wpConfigPath);
    console.log("🧹 Archivo wp-config.php eliminado.");
  }

  console.log("✅ Entorno limpio.");
};