const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const chokidar = require("chokidar");

module.exports = async function(options) {
  const name = options.name;
  if (!name) {
    console.error("❌ Debes pasar --name=<themeName>");
    process.exit(1);
  }

  const config = require(path.join(process.cwd(), "juzt.config.js"));
  const ssh = config.ssh;

  const localThemePath = path.join(process.cwd(), "wp-content/themes", name);
  const remoteThemePath = `${ssh.remoteWpPath}/wp-content/themes/${name}`;

  if (!fs.existsSync(localThemePath)) {
    console.error(`❌ No existe la carpeta local del tema: ${localThemePath}`);
    process.exit(1);
  }

  // 1. Crear carpeta remota
  try {
    let mkdirCmd = ["ssh"];
    if (ssh.port) mkdirCmd.push("-p", ssh.port);
    if (ssh.privateKeyPath) mkdirCmd.push("-i", ssh.privateKeyPath);
    mkdirCmd.push(`${ssh.user}@${ssh.host}`, `"mkdir -p ${remoteThemePath}"`);
    execSync(mkdirCmd.join(" "), { stdio: "inherit" });
  } catch (err) {
    console.error("❌ Error creando carpeta remota:", err.message);
    process.exit(1);
  }

  // 2. Subir archivos iniciales con rsync
  try {
    console.log("⬆️ Subiendo archivos iniciales del tema...");
    const rsyncCmd = [
      "rsync -az --inplace --no-whole-file",
      `-e "ssh -i ${ssh.privateKeyPath} -p ${ssh.port}"`,
      `${localThemePath}/`,
      `${ssh.user}@${ssh.host}:${remoteThemePath}/`
    ].join(" ");
    execSync(rsyncCmd, { stdio: "inherit" });
    console.log("✅ Archivos iniciales subidos");
  } catch (err) {
    console.error("❌ Error subiendo archivos iniciales:", err.message);
    process.exit(1);
  }

  // 3. Iniciar watcher con debounce
  console.log("👀 Observando cambios en el tema...");

  let pendingChanges = new Set();
  let debounceTimer = null;

  function triggerSync() {
    if (pendingChanges.size === 0) return;
    console.log(`🔄 Sincronizando ${pendingChanges.size} archivo(s)...`);

    try {
      const rsyncCmd = [
        "rsync -az --inplace --no-whole-file",
        `-e "ssh -i ${ssh.privateKeyPath} -p ${ssh.port}"`,
        `${localThemePath}/`,
        `${ssh.user}@${ssh.host}:${remoteThemePath}/`
      ].join(" ");
      execSync(rsyncCmd, { stdio: "inherit" });
      console.log("✅ Cambios sincronizados");
    } catch (err) {
      console.error("❌ Error sincronizando cambios:", err.message);
    }

    pendingChanges.clear();
    debounceTimer = null;
  }

  chokidar.watch(localThemePath, { ignoreInitial: true }).on("change", filePath => {
    const relativePath = path.relative(localThemePath, filePath);
    console.log(`📌 Detectado cambio en ${relativePath}`);
    pendingChanges.add(relativePath);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerSync, 1000); // espera 1s antes de sincronizar
  });

  // 4. Mostrar preview
  console.log(`🌐 Preview: ${ssh.domain}/?wpvtheme=${name}`);
};