const { spawn } = require("child_process");
const path = require("path");

// console.log("🚀 Khởi động VGreen Fullstack Application...");
// console.log("📦 Backend: Node.js + Express + MongoDB");
// console.log("🌐 Frontend: Angular");
// console.log("");

// Khởi động Backend
// console.log("🔧 Đang khởi động Backend...");
const backend = spawn("npm", ["start"], {
  cwd: path.join(__dirname, "backend"),
  stdio: "inherit",
  shell: true,
});

// Đợi 3 giây rồi khởi động Frontend
setTimeout(() => {
  // console.log("🌐 Đang khởi động Frontend...");
  const frontend = spawn("ng", ["serve", "--open", "--port", "4201"], {
    cwd: path.join(__dirname, "my-user"),
    stdio: "inherit",
    shell: true,
  });

  // Xử lý khi frontend thoát
  frontend.on("close", (code) => {
    // console.log(`Frontend đã thoát với mã: ${code}`);
    backend.kill();
    process.exit(code);
  });
}, 3000);

// Xử lý khi backend thoát
backend.on("close", (code) => {
  // console.log(`Backend đã thoát với mã: ${code}`);
  process.exit(code);
});

// Xử lý lỗi
backend.on("error", (err) => {
  // console.error("❌ Lỗi khởi động Backend:", err);
  process.exit(1);
});
