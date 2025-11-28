const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { getSyncCommand } = require("../helpers/getSyncCommand");

module.exports = function ({ path: relativePath, method }) {
  const configPath = path.join(process.cwd(), "juzt.config.js");
  if (!fs.existsSync(configPath)) {
    console.error("❌ juzt.config.js not found.");
    process.exit(1);
  }

  const config = require(configPath);
  const ssh = config.ssh;
  const remoteBase = config.remoteWpPath;

  if (!ssh || !remoteBase) {
    console.error("🚫 Missing SSH configuration or remoteWpPath in juzt.config.js.");
    process.exit(1);
  }

  const validMethods = ["rsync", "scp"];
  if (!validMethods.includes(method)) {
    console.error(`❌ Invalid method: ${method}. Use --method rsync or --method scp`);
    process.exit(1);
  }

  const remotePath = remoteBase.endsWith("/")
    ? remoteBase + relativePath
    : remoteBase + "/" + relativePath;

  const localPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
    console.log(`📁 Local folder created: ${localPath}`);
  }

  const syncCmd = getSyncCommand({
    ssh,
    remotePath,
    localPath,
    method
  });

  console.log(`🔄 Running synchronization of: ${relativePath}`);
  try {
    const env = {
      ...process.env,
      PATH: `${path.join(__dirname, "..", "bin")};${process.env.PATH}`
    };

    execSync(syncCmd, { stdio: "inherit", shell: true, env });
    console.log("✅ Synchronization completed.");
  } catch (err) {
    console.error("❌ Error synchronizing:", err.message);
  }
};