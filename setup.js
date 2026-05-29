const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// console.log("🚀 Bắt đầu cài đặt dependencies cho toàn bộ dự án...\n");

const projects = [
  { name: "Root", path: "." },
  { name: "Backend", path: "backend" },
  { name: "My-User", path: "my-user" },
  { name: "My-Admin", path: "my-admin" },
];

function installDependencies(project) {
  const projectPath = path.resolve(project.path);

  if (!fs.existsSync(path.join(projectPath, "package.json"))) {
    // console.log(`⚠️  Bỏ qua ${project.name}: Không tìm thấy package.json`);
    return;
  }

  // console.log(`\n📦 Đang cài đặt dependencies cho ${project.name}...`);

  try {
    const isAngularProject =
      project.path.includes("my-user") || project.path.includes("my-admin");
    // Đảm bảo cài đặt đầy đủ cả devDependencies cho Angular projects
    const command = isAngularProject
      ? "npm install --include=dev --force"
      : "npm install";

    execSync(command, {
      cwd: projectPath,
      stdio: "inherit",
      shell: true,
    });

    // console.log(`✅ Hoàn thành cài đặt cho ${project.name}`);
  } catch (error) {
    // console.error(`❌ Lỗi khi cài đặt ${project.name}:`, error.message);
    process.exit(1);
  }
}

// Cài đặt tuần tự từng project
projects.forEach((project) => {
  installDependencies(project);
});

// console.log("\n🎉 Hoàn thành cài đặt tất cả dependencies!");
// console.log("\n📝 Các lệnh hữu ích:");
// console.log("   - npm run backend    : Chạy backend server");
// console.log("   - npm run serve      : Chạy backend + my-user");
// console.log("   - cd my-user && npm start  : Chạy my-user");
// console.log("   - cd my-admin && npm start : Chạy my-admin");
