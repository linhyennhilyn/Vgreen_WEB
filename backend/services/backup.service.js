const fs = require("fs");
const path = require("path");

class BackupService {
  constructor() {
    this.dataPath = path.join(__dirname, "../../data/users.json");
  }

 // Đọc dữ liệu từ file JSON
  readUsers() {
    try {
 console.log("� Đang đọc dữ liệu từ file JSON...");
      const data = fs.readFileSync(this.dataPath, "utf8");
      const users = JSON.parse(data);
 console.log(` Đã đọc ${users.length} users từ file JSON`);
      return users;
    } catch (error) {
 console.error(" Lỗi đọc file JSON:", error.message);
      return [];
    }
  }

 // Ghi dữ liệu vào file JSON
  writeUsers(users) {
    try {
 console.log(" Đang ghi dữ liệu vào file JSON...");
 // Sử dụng replacer để ép phone thành string
      const jsonString = JSON.stringify(
        users,
        (key, value) => {
          if (key === "phone") {
            return String(value); // Ép kiểu string
          }
          return value;
        },
        2
      );
      fs.writeFileSync(this.dataPath, jsonString);
 console.log(" Đã ghi dữ liệu vào file JSON thành công!");
      return true;
    } catch (error) {
 console.error(" Lỗi ghi file JSON:", error.message);
      return false;
    }
  }

 // Thêm user mới vào file JSON
  addUser(userData) {
    try {
 console.log(" Đang thêm user mới vào file JSON...");
      const users = this.readUsers();

 // Tạo user mới theo cấu trúc file JSON
      const newUser = {
        _id: { $oid: this.generateObjectId() },
        user_id: users.length + 1,
        full_name: userData.FullName || "",
        phone: userData.Phone, // Giữ nguyên dạng string
        email: userData.Email || "",
        address: userData.Address || "",
        register_date: userData.RegisterDate
          ? userData.RegisterDate.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        customer_type:
          userData.CustomerTiering || userData.CustomerType || "Đồng",
        password: userData.Password,
      };

      users.push(newUser);
      this.writeUsers(users);

 console.log(" User đã được thêm vào file JSON:", {
        user_id: newUser.user_id,
        full_name: newUser.full_name,
        phone: newUser.phone, // Giữ nguyên dạng string
        register_date: newUser.register_date,
      });

      return newUser;
    } catch (error) {
 console.error(" Lỗi thêm user vào file JSON:", error.message);
      return null;
    }
  }

 // Cập nhật user trong file JSON
  updateUser(phone, updateData) {
    try {
 console.log(" Đang cập nhật user trong file JSON...");
      const users = this.readUsers();
      const userIndex = users.findIndex(
        (user) => user.phone === phone // So sánh string với string
      );

      if (userIndex === -1) {
 console.log(" Không tìm thấy user trong file JSON");
        return null;
      }

 // Cập nhật thông tin
      if (updateData.Income !== undefined) {
        users[userIndex].income = updateData.Income;
      }
      if (updateData.Fee !== undefined) {
        users[userIndex].fee = updateData.Fee;
      }
      if (updateData.Password) {
        users[userIndex].password = updateData.Password;
      }
      if (updateData.PasswordVersion !== undefined) {
        users[userIndex].password_version = updateData.PasswordVersion;
      }
      if (updateData.LastPasswordReset) {
        users[userIndex].last_password_reset =
          updateData.LastPasswordReset.toISOString();
      }
      if (updateData.CustomerTiering !== undefined) {
        users[userIndex].customer_type = updateData.CustomerTiering;
      }
      if (updateData.TotalSpent !== undefined) {
        users[userIndex].total_spent = updateData.TotalSpent;
      }

      this.writeUsers(users);
 console.log(" User đã được cập nhật trong file JSON:", {
        user_id: users[userIndex].user_id,
        phone: users[userIndex].phone,
      });

      return users[userIndex];
    } catch (error) {
 console.error(" Lỗi cập nhật user trong file JSON:", error.message);
      return null;
    }
  }

 // Tạo ObjectId giả
  generateObjectId() {
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
    const random = Math.floor(Math.random() * 16777216).toString(16);
    return (
      timestamp + "0000000000000000".substring(0, 16 - random.length) + random
    );
  }
}

module.exports = new BackupService();
