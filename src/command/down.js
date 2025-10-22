const { execSync } = require("child_process");
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
  const containerName = `juzt-wp-${slugify(config.name, { lower: true })}-${config.server.port}`;

  try {
    console.log(`🛑 Deteniendo contenedor ${containerName}...`);
    execSync(`docker stop ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ El contenedor no estaba corriendo.");
  }

  try {
    console.log(`🧨 Eliminando contenedor ${containerName}...`);
    execSync(`docker rm ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ El contenedor ya había sido eliminado.");
  }

  // Opcional: eliminar wp-config.php
  if (fs.existsSync(wpConfigPath)) {
    fs.unlinkSync(wpConfigPath);
    console.log("🧹 Archivo wp-config.php eliminado.");
  }

  console.log("✅ Entorno limpio.");
};