const { execSync } = require("child_process");

function checkImageExists(imageName) {
  try {
    execSync(`podman image inspect ${imageName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkContainerExists(containerName) {
  try {
    execSync(`podman inspect ${containerName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildImage() {
  console.log("📦 Construyendo imagen personalizada con Podman...");
  execSync(`podman build -t juzt-wordpress:dev -f Dockerfile .`, { stdio: "inherit" });
}

function runContainer(config) {
  const containerName = `juzt-wp-${require("slugify")(config.name, { lower: true })}-${config.server.port}`;
  const cmd = [
    "podman run -d",
    `--name ${containerName}`,
    `-p ${config.server.port}:80`,
    `-v ${process.cwd()}/wp-content:/var/www/html/wp-content`,
    `-v ${process.cwd()}/wp-config.php:/var/www/html/wp-config.php`,
    `juzt-wordpress:dev`
  ].join(" ");
  console.log("🚀 Levantando entorno con Podman...");
  execSync(cmd, { stdio: "inherit" });
}

function stopContainer(containerName) {
  try {
    execSync(`podman stop ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ El contenedor no estaba corriendo.");
  }
}

function removeContainer(containerName) {
  try {
    execSync(`podman rm ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ El contenedor ya había sido eliminado.");
  }
}

module.exports = {
  checkImageExists,
  checkContainerExists,
  buildImage,
  runContainer,
  stopContainer,
  removeContainer
};