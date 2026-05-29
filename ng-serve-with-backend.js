const { spawn } = require("child_process");
const path = require("path");

// console.log("🚀 Khởi động VGreen với ng serve --o...");
// console.log("📦 Backend: Node.js + Express + MongoDB");
// console.log("🌐 Frontend: Angular (ng serve --o)");
// console.log("");

// Khởi động Backend trước
// console.log("🔧 Đang khởi động Backend...");
// Allow overriding backend port via env var BACKEND_PORT or PORT
const backendPort = process.env.BACKEND_PORT || process.env.PORT || "3000";
// console.log(`🔧 Backend sẽ chạy trên port: ${backendPort}`);
const backend = spawn("npm", ["start"], {
  cwd: path.join(__dirname, "backend"),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: backendPort },
});

// Đợi 2 giây rồi khởi động Frontend
setTimeout(() => {
  // console.log("🌐 Đang khởi động Frontend (ng serve --o)...");
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
}, 2000);

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
