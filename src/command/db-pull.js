const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");
const dumpPath = path.join(process.cwd(), "dump.sql");

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.error("❌ No se encontró juzt.config.js.");
    process.exit(1);
  }

  const config = require(configPath);

  if (!config.useLocalDatabase) {
    console.error("🚫 Este comando requiere una base de datos local activa.");
    return;
  }

  if (!config.ssh || !config.ssh.host || !config.ssh.user) {
    console.error("🚫 La configuración SSH está incompleta.");
    return;
  }

  const db = config.database;
  const ssh = config.ssh;
  const manager = config.containerManager || "docker";
  const dbContainerName = `juzt-db-${slugify(config.name, { lower: true })}-${config.server.port}`;
  const container = require(`../helpers/${manager}.js`);

  // ✅ Verificar que el contenedor DB esté corriendo
  if (!container.checkContainerExists(dbContainerName)) {
    console.error(`❌ El contenedor de base de datos ${dbContainerName} no está corriendo.`);
    return;
  }

  // 🧠 Comando remoto para generar el dump
  const remoteDumpCmd = `mysqldump -u${db.user} -p'${db.password}' ${db.name}`;
  const sshCmd = [
    "ssh",
    `${ssh.user}@${ssh.host}`,
    `"${remoteDumpCmd}"`
  ];

  if (ssh.port) sshCmd.splice(1, 0, `-p ${ssh.port}`);
  if (ssh.privateKeyPath) sshCmd.splice(1, 0, `-i ${ssh.privateKeyPath}`);

  console.log("📡 Conectando vía SSH y extrayendo base de datos remota...");
  try {
    const dump = execSync(sshCmd.join(" "), { encoding: "utf8" });
    fs.writeFileSync(dumpPath, dump);
    console.log("✅ Dump recibido y guardado como dump.sql");
  } catch (err) {
    console.error("❌ Error al ejecutar mysqldump remoto:", err.message);
    return;
  }

  // 📥 Importar en contenedor local
  try {
    console.log("📦 Copiando dump al contenedor...");
    execSync(`${manager} cp ${dumpPath} ${dbContainerName}:/dump.sql`);

    console.log("📥 Importando dump en contenedor local...");
    execSync(`${manager} exec ${dbContainerName} sh -c "mysql -u root -p${config.localDatabase.rootPassword} ${db.name} < /dump.sql"`);

    console.log("✅ Base de datos sincronizada con éxito.");
  } catch (err) {
    console.error("❌ Error al importar en contenedor local:", err.message);
  }

  // 🧹 Limpieza
  try {
    fs.unlinkSync(dumpPath);
    console.log("🧹 Dump local eliminado.");
  } catch {
    console.warn("⚠️ No se pudo eliminar el dump local.");
  }
};