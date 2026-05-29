/**
 * Script để import tất cả các file JSON từ thư mục data/ vào MongoDB
 * Sử dụng: node scripts/import-all-json.js
 * Hoặc: npm run import-all-json (từ root) / npm run import-all-json (từ backend)
 */

const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs").promises;
const path = require("path");
const { MONGODB_URI, DATABASE_NAME } = require("../config/database");

/**
 * Quét tất cả file JSON trong thư mục và các thư mục con
 * @param {string} dir - Đường dẫn thư mục cần quét
 * @param {string} baseDir - Thư mục gốc (để tính relative path)
 * @returns {Promise<Array>} - Mảng các file JSON tìm được
 */
async function findJsonFiles(dir, baseDir = dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Bỏ qua thư mục temp và .DS_Store
      if (entry.name === "temp" || entry.name === ".DS_Store") {
        continue;
      }

      if (entry.isDirectory()) {
        // Đệ quy vào thư mục con
        const subFiles = await findJsonFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Thêm file JSON
        files.push({
          fullPath: fullPath,
          relativePath: relativePath.replace(/\\/g, "/"), // Normalize path separators
          fileName: entry.name,
        });
      }
    }
  } catch (error) {
    // Nếu không đọc được thư mục, bỏ qua
    console.log(`⚠️  Không thể đọc thư mục ${dir}: ${error.message}`);
  }

  return files;
}

/**
 * Map tên file sang tên collection MongoDB
 * @param {string} relativePath - Đường dẫn relative từ data/
 * @param {string} fileName - Tên file
 * @returns {string} - Tên collection
 */
function mapFileToCollection(relativePath, fileName) {
  // Xử lý các trường hợp đặc biệt
  const specialMappings = {
    "tree_complete.json": "tree_complete",
    "promotion_target.json": "promotion_target",
    "promotion_usage.json": "promotion_usage",
    "chat_conversations.json": "chat_conversations",
  };

  // Kiểm tra mapping đặc biệt trước
  if (specialMappings[fileName]) {
    return specialMappings[fileName];
  }

  // Nếu file nằm trong thư mục con, dùng tên thư mục
  const dir = path.dirname(relativePath);
  if (dir !== "." && dir !== "") {
    // Ví dụ: "address/tree_complete.json" -> "tree_complete" (đã xử lý ở trên)
    // Ví dụ: "promotion/promotions.json" -> "promotions"
    // Ví dụ: "cookbook/dishes.json" -> "dishes"
    // Lấy tên file không có extension
    const baseName = path.basename(fileName, ".json");
    return baseName;
  }

  // Lấy tên file không có extension
  const baseName = path.basename(fileName, ".json");
  return baseName;
}

/**
 * Xác định xem có cần clear collection trước khi import không
 * @param {string} relativePath - Đường dẫn relative
 * @param {string} fileName - Tên file
 * @returns {boolean}
 */
function shouldClearCollection(relativePath, fileName) {
  // Nếu có file blogs/blogs.json, clear collection blogs
  if (relativePath === "blogs/blogs.json") {
    return true;
  }
  return false;
}

/**
 * Chuyển đổi MongoDB Extended JSON format
 * Xử lý $oid, $date, và các format khác
 */
function convertMongoExtendedJSON(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Xử lý $oid
  if (value && typeof value === "object" && value.$oid) {
    // Convert $oid to ObjectId hoặc string
    try {
      return new ObjectId(value.$oid);
    } catch (e) {
      // Nếu không phải ObjectId hợp lệ, trả về string
      return value.$oid;
    }
  }

  // Xử lý $date
  if (value && typeof value === "object" && value.$date) {
    return new Date(value.$date);
  }

  // Xử lý array
  if (Array.isArray(value)) {
    return value.map((item) => convertMongoExtendedJSON(item));
  }

  // Xử lý object
  if (typeof value === "object" && value.constructor === Object) {
    const converted = {};
    for (const [key, val] of Object.entries(value)) {
      converted[key] = convertMongoExtendedJSON(val);
    }
    return converted;
  }

  // Xử lý date string
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }

  return value;
}

/**
 * Chuyển đổi MongoDB date format ($date) sang Date object (backward compatibility)
 */
function convertMongoDate(value) {
  if (value && typeof value === "object" && value.$date) {
    return new Date(value.$date);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }
  return value;
}

/**
 * Chuyển đổi tất cả dates trong object
 */
function convertDates(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertDates(item));
  }

  if (typeof obj === "object") {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert date fields
      if (
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("time") ||
        key === "createdAt" ||
        key === "updatedAt" ||
        key === "created_at" ||
        key === "updated_at"
      ) {
        converted[key] = convertMongoDate(value);
      } else {
        converted[key] = convertDates(value);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Import một file JSON vào một collection
 */
async function importJsonFile(client, filePath, collectionName, options = {}) {
  try {
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(collectionName);

    // Kiểm tra file có tồn tại không
    try {
      await fs.access(filePath);
    } catch (error) {
      console.log(`⚠️  File không tồn tại: ${filePath}`);
      return { success: false, skipped: true, message: "File not found" };
    }

    // Đọc file JSON
    console.log(`\n📂 Đang đọc file: ${filePath}`);
    const fileContent = await fs.readFile(filePath, "utf8");
    let data = JSON.parse(fileContent);

    // Xử lý đặc biệt cho tree_complete.json (cấu trúc nested object)
    if (collectionName === "tree_complete") {
      // tree_complete.json là array chứa 1 object lớn, convert thành array of documents
      if (
        Array.isArray(data) &&
        data.length === 1 &&
        typeof data[0] === "object"
      ) {
        // Lưu toàn bộ cấu trúc tree vào một document
        data = [{ tree: convertMongoExtendedJSON(data[0]) }];
      } else if (!Array.isArray(data)) {
        // Nếu không phải array, wrap nó vào array
        data = [{ tree: convertMongoExtendedJSON(data) }];
      }
    }

    if (!Array.isArray(data)) {
      console.log(`⚠️  File ${filePath} không phải là mảng JSON, bỏ qua`);
      return { success: false, skipped: true, message: "Not an array" };
    }

    if (data.length === 0) {
      console.log(`⚠️  File ${filePath} rỗng, bỏ qua`);
      return { success: true, count: 0, message: "Empty array" };
    }

    console.log(`📊 Tìm thấy ${data.length} documents trong file`);

    // Convert MongoDB Extended JSON format (bao gồm $oid, $date, etc.)
    const convertedData = data.map((item) => {
      const converted = convertMongoExtendedJSON(item);
      // Đảm bảo _id được xử lý đúng (nếu có $oid)
      if (converted._id && typeof converted._id === "object") {
        if (converted._id.$oid) {
          try {
            converted._id = new ObjectId(converted._id.$oid);
          } catch (e) {
            converted._id = converted._id.$oid;
          }
        } else if (
          converted._id.constructor === Object &&
          Object.keys(converted._id).length === 0
        ) {
          // Nếu _id là empty object, xóa nó để MongoDB tự tạo
          delete converted._id;
        }
      }
      return converted;
    });

    // Xóa collection cũ nếu cần (option: clearCollection)
    if (options.clearCollection) {
      console.log(`🗑️  Đang xóa collection cũ: ${collectionName}`);
      await collection.deleteMany({});
    }

    // Insert documents
    // console.log(`📥 Đang import vào collection: ${collectionName}...`);

    // Sử dụng insertMany với ordered: false để tiếp tục khi có lỗi duplicate
    const result = await collection
      .insertMany(convertedData, {
        ordered: false, // Tiếp tục insert các documents khác khi có lỗi
      })
      .catch(async (error) => {
        // Nếu có lỗi duplicate, thử insert từng document một
        if (error.code === 11000 || error.writeErrors) {
          console.log(
            `ℹ️  Phát hiện documents trùng lặp (đã tồn tại trong database), đang kiểm tra từng document...`
          );
          let successCount = 0;
          let duplicateCount = 0;

          for (const doc of convertedData) {
            try {
              await collection.insertOne(doc);
              successCount++;
            } catch (err) {
              if (err.code === 11000) {
                // Duplicate key, skip - không phải lỗi, chỉ là đã tồn tại
                duplicateCount++;
              } else {
                // Lỗi khác, throw để xử lý ở ngoài
                throw err;
              }
            }
          }

          return {
            insertedCount: successCount,
            errorCount: 0, // Không đếm duplicate là lỗi
            duplicateCount: duplicateCount,
          };
        }
        throw error;
      });

    const insertedCount =
      result.insertedCount || result.insertedIds?.length || 0;
    const errorCount = result.errorCount || 0;
    const duplicateCount = result.duplicateCount || 0;

    if (insertedCount > 0) {
      console.log(
        `✅ Đã import ${insertedCount} documents mới vào ${collectionName}`
      );
    }
    if (duplicateCount > 0) {
      console.log(
        `ℹ️  ${duplicateCount} documents đã tồn tại trong database (bỏ qua)`
      );
    }
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} documents gặp lỗi khi import`);
    }

    return {
      success: true,
      count: insertedCount,
      errorCount: errorCount,
      duplicateCount: duplicateCount,
      collection: collectionName,
    };
  } catch (error) {
    console.error(`❌ Lỗi khi import ${filePath}:`, error.message);
    return {
      success: false,
      error: error.message,
      collection: collectionName,
      file: filePath,
    };
  }
}

/**
 * Main function
 */
async function main() {
  let client;

  try {
    console.log("🚀 Bắt đầu import dữ liệu JSON vào MongoDB...");
    console.log(`📡 Đang kết nối đến MongoDB: ${MONGODB_URI}`);

    // Kết nối MongoDB với timeout và error handling tốt hơn
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout sau 5 giây
    });

    try {
      await client.connect();
      // Kiểm tra kết nối bằng cách ping database
      await client.db(DATABASE_NAME).admin().ping();
      console.log("✅ Đã kết nối MongoDB thành công\n");
    } catch (connectError) {
      console.error("\n❌ Lỗi kết nối MongoDB!");
      console.error("=".repeat(60));

      if (
        connectError.message.includes("ECONNREFUSED") ||
        connectError.message.includes("connection refused") ||
        connectError.name === "MongoServerSelectionError"
      ) {
        console.error("⚠️  MongoDB không đang chạy hoặc không thể kết nối.");
        console.error("\n📋 Hướng dẫn khắc phục:");
        console.error("\n1. Kiểm tra MongoDB đã được cài đặt chưa:");
        console.error("   - Windows: Cài đặt MongoDB Community Server");
        console.error("   - macOS: brew install mongodb-community");
        console.error("   - Linux: sudo apt-get install mongodb");

        console.error("\n2. Khởi động MongoDB service:");
        console.error("   - Windows:");
        console.error("     net start MongoDB");
        console.error("     hoặc:");
        console.error("     mongod --dbpath <đường_dẫn_data>");
        console.error("   - macOS:");
        console.error("     brew services start mongodb-community");
        console.error("   - Linux:");
        console.error("     sudo systemctl start mongod");
        console.error("     hoặc:");
        console.error("     sudo service mongod start");

        console.error("\n3. Kiểm tra MongoDB đang chạy:");
        console.error("   - Windows:");
        console.error("     tasklist | findstr mongod");
        console.error("   - macOS/Linux:");
        console.error("     ps aux | grep mongod");

        console.error("\n4. Kiểm tra port MongoDB (mặc định: 27017):");
        console.error("   - Windows:");
        console.error("     netstat -an | findstr 27017");
        console.error("   - macOS/Linux:");
        console.error("     netstat -an | grep 27017");

        console.error("\n5. Nếu MongoDB đang chạy trên host/port khác:");
        console.error(
          "   - Tạo file .env trong thư mục backend/ với nội dung:"
        );
        console.error("     MONGODB_HOST=your-host");
        console.error("     MONGODB_PORT=your-port");

        console.error("\n6. Kiểm tra connection string trong:");
        console.error(`   - backend/config/database.js`);
        console.error(`   - Hiện tại: ${MONGODB_URI}`);
      } else {
        console.error(`   Lỗi: ${connectError.message}`);
        console.error(`   Code: ${connectError.code || "N/A"}`);
      }

      console.error("\n" + "=".repeat(60));
      throw connectError;
    }

    const dataDir = path.join(__dirname, "../../data");
    const results = [];

    // Tự động tìm tất cả file JSON trong thư mục data/
    console.log("🔍 Đang quét tất cả file JSON trong thư mục data/...");
    const jsonFiles = await findJsonFiles(dataDir);
    const totalJsonFilesFound = jsonFiles.length;
    console.log(`📋 Tìm thấy ${totalJsonFilesFound} file JSON\n`);

    if (jsonFiles.length === 0) {
      console.log("⚠️  Không tìm thấy file JSON nào trong thư mục data/");
      return;
    }

    // Tạo danh sách import tasks từ các file tìm được
    const importTasks = jsonFiles.map((file) => {
      const collection = mapFileToCollection(file.relativePath, file.fileName);
      const clearCollection = shouldClearCollection(
        file.relativePath,
        file.fileName
      );

      return {
        file: file.relativePath,
        fullPath: file.fullPath,
        collection: collection,
        clearCollection: clearCollection,
      };
    });

    // Sắp xếp để import blogs/blogs.json sau blogs.json (nếu có)
    importTasks.sort((a, b) => {
      // Nếu cả hai đều là blogs, ưu tiên blogs/blogs.json sau
      if (a.collection === "blogs" && b.collection === "blogs") {
        if (a.file === "blogs/blogs.json") return 1;
        if (b.file === "blogs/blogs.json") return -1;
      }
      return a.file.localeCompare(b.file);
    });

    // Import từng file
    for (const task of importTasks) {
      const result = await importJsonFile(
        client,
        task.fullPath,
        task.collection,
        {
          clearCollection: task.clearCollection || false,
        }
      );
      results.push({
        file: task.file,
        ...result,
      });
    }

    // Tổng kết
    console.log("\n" + "=".repeat(60));
    console.log("📊 TỔNG KẾT IMPORT");
    console.log("=".repeat(60));

    let totalSuccess = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;
    let filesImported = 0; // Đếm số file đã import thành công
    let filesFailed = 0; // Đếm số file bị lỗi

    results.forEach((result) => {
      if (result.skipped) {
        console.log(`⚠️  ${result.file}: Bỏ qua`);
        totalSkipped++;
      } else if (result.success) {
        const newDocs = result.count || 0;
        const duplicates = result.duplicateCount || 0;
        const errors = result.errorCount || 0;

        let statusMsg = `✅ ${result.file}: ${newDocs} documents mới`;
        if (duplicates > 0) {
          statusMsg += `, ${duplicates} đã tồn tại`;
        }
        if (errors > 0) {
          statusMsg += `, ${errors} lỗi`;
        }
        console.log(statusMsg);

        totalSuccess += newDocs;
        totalDuplicates += duplicates;
        totalErrors += errors;
        filesImported++; // Đếm file đã import thành công
      } else {
        console.log(
          `❌ ${result.file}: ${result.error || "Lỗi không xác định"}`
        );
        totalErrors++;
        filesFailed++; // Đếm file bị lỗi
      }
    });

    console.log("=".repeat(60));
    console.log("📁 THỐNG KÊ FILES:");
    console.log(`   🔍 Tìm thấy: ${totalJsonFilesFound} file JSON`);
    console.log(`   ✅ Đã import: ${filesImported} file (thành công)`);
    if (filesFailed > 0) {
      console.log(`   ❌ Thất bại: ${filesFailed} file`);
    }
    if (totalSkipped > 0) {
      console.log(`   ⏭️  Bỏ qua: ${totalSkipped} file`);
    }

    console.log("\n📄 THỐNG KÊ DOCUMENTS:");
    console.log(`   ✅ Đã import: ${totalSuccess} documents mới`);
    if (totalDuplicates > 0) {
      console.log(`   ℹ️  Đã tồn tại: ${totalDuplicates} documents (bỏ qua)`);
    }
    if (totalErrors > 0) {
      console.log(`   ⚠️  Gặp lỗi: ${totalErrors} documents`);
    }
    console.log("=".repeat(60));
    console.log("\n✅ Hoàn tất import dữ liệu!\n");
  } catch (error) {
    // Nếu lỗi là kết nối MongoDB, đã được xử lý ở trên
    if (
      error.message &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("connection refused") ||
        error.name === "MongoServerSelectionError")
    ) {
      // Đã hiển thị thông báo chi tiết ở trên, chỉ exit
      process.exit(1);
    }

    // Các lỗi khác
    console.error("\n❌ Lỗi khi import dữ liệu:");
    console.error("   ", error.message || error);
    if (error.stack) {
      console.error("\n   Stack trace:");
      console.error("   ", error.stack.split("\n").slice(0, 3).join("\n   "));
    }
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.close();
        console.log("🔌 Đã đóng kết nối MongoDB");
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
}

// Chạy script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Lỗi không mong đợi:", error);
    process.exit(1);
  });
}

module.exports = { importJsonFile, convertDates };
