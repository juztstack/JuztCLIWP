const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { getSyncCommand } = require("../helpers/getSyncCommand");

module.exports = function ({ path: relativePath, method }) {
  const configPath = path.join(process.cwd(), "juzt.config.js");
  if (!fs.existsSync(configPath)) {
    console.error("❌ No se encontró juzt.config.js.");
    process.exit(1);
  }

  const config = require(configPath);
  const ssh = config.ssh;
  const remoteBase = config.remoteWpPath;

  if (!ssh || !remoteBase) {
    console.error("🚫 Falta configuración SSH o remoteWpPath en juzt.config.js.");
    process.exit(1);
  }

  const validMethods = ["rsync", "scp"];
  if (!validMethods.includes(method)) {
    console.error(`❌ Método inválido: ${method}. Usa --method rsync o --method scp`);
    process.exit(1);
  }

  const remotePath = remoteBase.endsWith("/")
    ? remoteBase + relativePath
    : remoteBase + "/" + relativePath;

  const localPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
    console.log(`📁 Carpeta local creada: ${localPath}`);
  }

  const syncCmd = getSyncCommand({
    ssh,
    remotePath,
    localPath,
    method
  });

  console.log(`🔄 Ejecutando sincronización de: ${relativePath}`);
  try {
    const env = {
      ...process.env,
      PATH: `${path.join(__dirname, "..", "bin")};${process.env.PATH}`
    };

    execSync(syncCmd, { stdio: "inherit", shell: true, env });
    console.log("✅ Sincronización completada.");
  } catch (err) {
    console.error("❌ Error al sincronizar:", err.message);
  }
};