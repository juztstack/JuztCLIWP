const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

function getRsyncCommand({ ssh, remotePath, localPath }) {
  const isWindows = os.platform() === "win32";
  const binDir = path.join(__dirname, "..", "..", "bin", "rsync", "bin");

  const rsyncEmbedded = path.join(binDir, "rsync.exe");

  const hasSystemRsync = (() => {
    try {
      execSync(`${isWindows ? "where" : "which"} rsync`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (!isWindows || hasSystemRsync) {
    console.log("📦 Usando rsync del sistema");
    return [
      "rsync -avz",
      `-e "ssh -i \\"${ssh.privateKeyPath}\\" -p ${ssh.port}"`,
      `${ssh.user}@${ssh.host}:"${remotePath}"`,
      `"${localPath}/"`
    ].join(" ");
  }

  console.log("📦 Usando rsync embebido con PATH temporal");

  return [
    `"${rsyncEmbedded}" -avz`,
    `-e "ssh -i \\"${ssh.privateKeyPath}\\" -p ${ssh.port}"`,
    `${ssh.user}@${ssh.host}:"${remotePath}"`,
    `"${localPath}/"`
  ].join(" ");
}

module.exports = { getRsyncCommand };