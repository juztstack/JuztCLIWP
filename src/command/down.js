const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

const configPath = path.join(process.cwd(), "juzt.config.js");
const wpConfigPath = path.join(process.cwd(), "wp-config.php");

module.exports = async function () {
  if (!fs.existsSync(configPath)) {
    console.error("❌ juzt.config.js not found in the current directory.");
    process.exit(1);
  }

  const config = require(configPath);
  const manager = config.containerManager || "docker";
  const container = require(`../helpers/${manager}.js`);

  const wpContainerName = `juzt-wp-${slugify(config.name, { lower: true })}-${config.server.port}`;
  const dbContainerName = `juzt-db-${slugify(config.name, { lower: true })}-${config.server.port}`;

  console.log(`🛑 Stopping container ${wpContainerName}...`);
  container.stopContainer(wpContainerName);

  console.log(`🧨 Removing container ${wpContainerName}...`);
  container.removeContainer(wpContainerName);

  if (config.useLocalDatabase) {
    console.log(`🛑 Stopping DB container ${dbContainerName}...`);
    container.stopContainer(dbContainerName);

    console.log(`🧨 Removing DB container ${dbContainerName}...`);
    container.removeContainer(dbContainerName);
  }

  if (fs.existsSync(wpConfigPath)) {
    fs.unlinkSync(wpConfigPath);
    console.log("🧹 File wp-config.php removed.");
  }

  console.log("✅ Environment cleaned.");
};