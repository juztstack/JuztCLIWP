const { execSync } = require("child_process");

function checkImageExists(imageName) {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkContainerExists(containerName) {
  try {
    execSync(`docker inspect ${containerName}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildImage() {
  console.log("📦 Building custom image with Docker...");
  execSync(`docker build -t juzt-wordpress:dev -f Dockerfile .`, { stdio: "inherit" });
}

function runContainer(config) {
  const containerName = `juzt-wp-${require("slugify")(config.name, { lower: true })}-${config.server.port}`;
  const cmd = [
    "docker run -d",
    `--name ${containerName}`,
    `-p ${config.server.port}:80`,
    `-v ${process.cwd()}/wp-content:/var/www/html/wp-content`,
    `-v ${process.cwd()}/wp-config.php:/var/www/html/wp-config.php`,
    `juzt-wordpress:dev`
  ].join(" ");
  console.log("🚀 Starting environment with Docker...");
  execSync(cmd, { stdio: "inherit" });
}

function stopContainer(containerName) {
  try {
    execSync(`docker stop ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ The container was not running.");
  }
}

function removeContainer(containerName) {
  try {
    execSync(`docker rm ${containerName}`, { stdio: "ignore" });
  } catch {
    console.log("⚠️ The container had already been removed.");
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