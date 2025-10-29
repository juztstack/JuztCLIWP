const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

function ensureTrailingSlash(p) {
  return p.endsWith("/") ? p : p + "/";
}

function toCygwinPath(winPath) {
  const driveLetter = winPath[0].toLowerCase();
  const rest = winPath.slice(2).replace(/\\/g, "/");
  return `/cygdrive/${driveLetter}/${rest}`;
}

function getSyncCommand({ ssh, remotePath, localPath, method }) {
  const isWindows = os.platform() === "win32";
  const binDir = path.join(__dirname, "..", "..", "bin");

  const rsyncEmbedded = path.join(binDir, "rsync.exe");
  const scpEmbedded = path.join(binDir, "scp.exe");

  const remote = ensureTrailingSlash(remotePath);
  const normalizedLocal = isWindows ? toCygwinPath(localPath) : localPath;

  if (method === "rsync") {
    const hasSystemRsync = (() => {
      try {
        execSync(`${isWindows ? "where" : "which"} rsync`, { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    })();

    const rsyncBin = hasSystemRsync && !isWindows ? "rsync" : rsyncEmbedded;

    console.log(
      hasSystemRsync && !isWindows
        ? "📦 Usando rsync del sistema"
        : "📦 Usando rsync embebido con PATH temporal"
    );

    return [
      `"${rsyncBin}" -avz`,
      `-e "ssh -i \\"${ssh.privateKeyPath}\\" -p ${ssh.port}"`,
      `${ssh.user}@${ssh.host}:"${remote}"`,
      `${normalizedLocal}/`
    ].join(" ");
  }

  // Fallback: SCP
  console.log("📦 Usando SCP como fallback");
  return [
    `"${scpEmbedded}"`,
    "-r",
    `-i "${ssh.privateKeyPath}"`,
    `-P ${ssh.port}`,
    `${ssh.user}@${ssh.host}:${remote}`,
    `"${localPath}"`
  ].join(" ");
}

module.exports = { getSyncCommand };