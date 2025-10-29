function buildSshCommand({ ssh, remoteCommand }) {
  const parts = ["ssh"];

  if (ssh.privateKeyPath) parts.push("-i", `"${ssh.privateKeyPath}"`);
  if (ssh.port) parts.push("-p", ssh.port);

  parts.push(`${ssh.user}@${ssh.host}`);
  parts.push(`"${remoteCommand}"`);

  return parts.join(" ");
}

module.exports = { buildSshCommand };