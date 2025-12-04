const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");
const dumpPath = path.join(process.cwd(), "dump.sql");

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.error("❌ juzt.config.js not found.");
    process.exit(1);
  }

  const config = require(configPath);

  if (!config.useLocalDatabase) {
    console.error("🚫 This command requires an active local database.");
    return;
  }

  /*if (!config.ssh || !config.ssh.host || !config.ssh.user) {
    console.error("🚫 SSH configuration is incomplete.");
    return;
  }*/

  const db = config.database;
  const ssh = config.ssh;
  const manager = config.containerManager || "docker";
  const dbContainerName = `juzt-db-${slugify(config.name, { lower: true })}-${config.server.port}`;
  const container = require(`../helpers/${manager}.js`);

  // ✅ Verify DB container is running
  if (!container.checkContainerExists(dbContainerName)) {
    console.error(`❌ Database container ${dbContainerName} is not running.`);
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

  console.log("📡 Connecting via SSH and extracting remote database...");
  try {
    const dump = execSync(sshCmd.join(" "), { encoding: "utf8" });
    fs.writeFileSync(dumpPath, dump);
    console.log("✅ Dump received and saved as dump.sql");
  } catch (err) {
    console.error("❌ Error executing remote mysqldump:", err.message);
    return;
  }

  // 📥 Importar en contenedor local
  try {
    console.log("📦 Copying dump to container...");
    execSync(`${manager} cp ${dumpPath} ${dbContainerName}:/dump.sql`);

    console.log("📥 Importing dump into local container...");
    execSync(`${manager} exec ${dbContainerName} sh -c "mysql -u root -p${config.localDatabase.rootPassword} ${db.name} < /dump.sql"`);

    console.log("✅ Database synchronized successfully.");
  } catch (err) {
    console.error("❌ Error importing into local container:", err.message);
  }

  // 🧹 Limpieza
  try {
    fs.unlinkSync(dumpPath);
    console.log("🧹 Local dump removed.");
  } catch {
    console.warn("⚠️ Could not remove local dump.");
  }
};