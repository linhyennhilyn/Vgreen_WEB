const express = require("express");
const bcrypt = require("bcrypt");
const { User, generateCustomerID } = require("../db");
const backupService = require("../services/backup.service");

const router = express.Router();

// Middleware validate dữ liệu đầu vào
const validateRegisterData = (req, res, next) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({
      error: "Thiếu thông tin bắt buộc: phoneNumber, password",
    });
  }

  if (phoneNumber.length < 10) {
    return res.status(400).json({
      error: "Số điện thoại phải có ít nhất 10 chữ số",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Mật khẩu phải có ít nhất 8 ký tự",
    });
  }

  next();
};

const validateLoginData = (req, res, next) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({
      error: "Thiếu thông tin: phoneNumber và password",
    });
  }

  next();
};

const validateUpdateData = (req, res, next) => {
  const { phoneNumber, customerID, income, fee } = req.body;

  // Require either phoneNumber or customerID
  if (!phoneNumber && !customerID) {
    return res.status(400).json({
      error: "Thiếu thông tin: phoneNumber hoặc customerID",
    });
  }

  if (income !== undefined && (typeof income !== "number" || income < 0)) {
    return res.status(400).json({
      error: "Income phải là số dương",
    });
  }

  if (fee !== undefined && (typeof fee !== "number" || fee < 0)) {
    return res.status(400).json({
      error: "Fee phải là số dương",
    });
  }

  next();
};

const validateResetPasswordData = (req, res, next) => {
  const { phoneNumber, newPassword } = req.body;

  if (!phoneNumber || !newPassword) {
    return res.status(400).json({
      error: "Thiếu thông tin: phoneNumber và newPassword",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: "Mật khẩu mới phải có ít nhất 8 ký tự",
    });
  }

  next();
};

// Middleware validate change password (requires current password)
const validateChangePasswordData = (req, res, next) => {
  const { customerID, currentPassword, newPassword } = req.body;

  if (!customerID || !currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Thiếu thông tin: customerID, currentPassword và newPassword",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: "Mật khẩu mới phải có ít nhất 8 ký tự",
    });
  }

  next();
};

// API kiểm tra số điện thoại đã tồn tại (cho đăng ký)
router.post("/check-phone", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: "Số điện thoại không được để trống",
      });
    }

    const existingUser = await User.findOne({ Phone: phoneNumber });

    if (existingUser) {
      return res.status(400).json({
        error: "Số điện thoại đã được đăng ký",
      });
    }

    res.json({
      message: "Số điện thoại có thể sử dụng",
      available: true,
    });
  } catch (error) {
    console.error(" Lỗi kiểm tra số điện thoại:", error);
    res.status(500).json({
      error: "Lỗi server khi kiểm tra số điện thoại",
    });
  }
});

// API kiểm tra số điện thoại tồn tại (cho quên mật khẩu)
router.post("/check-phone-exists", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: "Số điện thoại không được để trống",
      });
    }

    // console.log(" Kiểm tra số điện thoại cho quên mật khẩu:", phoneNumber);

    const existingUser = await User.findOne({ Phone: phoneNumber });

    if (!existingUser) {
      return res.status(400).json({
        error: "Số điện thoại chưa được đăng ký",
      });
    }

    // console.log(" Số điện thoại tồn tại:", {
    //   CustomerID: existingUser.CustomerID,
    //   Phone: existingUser.Phone,
    //   RegisterDate: existingUser.RegisterDate,
    // });

    res.json({
      message: "Số điện thoại tồn tại",
      exists: true,
      user: {
        CustomerID: existingUser.CustomerID,
        Phone: existingUser.Phone,
        RegisterDate: existingUser.RegisterDate,
      },
    });
  } catch (error) {
    console.error(" Lỗi kiểm tra số điện thoại cho quên mật khẩu:", error);
    res.status(500).json({
      error: "Lỗi server khi kiểm tra số điện thoại",
    });
  }
});

// API gửi OTP (mock - trong thực tế sẽ gửi SMS)
router.post("/send-otp", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: "Số điện thoại không được để trống",
      });
    }

    // console.log(" Gửi OTP cho số điện thoại:", phoneNumber);

    // Mock OTP - trong thực tế sẽ gửi SMS thật
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("🔐 Mã OTP được tạo:", otpCode);
    // console.log(
    //   " Lưu ý: Trong môi trường thực tế, OTP này sẽ được gửi qua SMS"
    // );

    // Trong thực tế, bạn sẽ:
    // 1. Lưu OTP vào database với thời gian hết hạn
    // 2. Gửi SMS thật qua service như Twilio, AWS SNS, etc.
    // 3. Trả về response thành công

    res.json({
      message: "OTP đã được gửi thành công",
      phoneNumber: phoneNumber,
      otpCode: otpCode, // Chỉ trả về trong development
      expiresIn: 300, // 5 phút
    });
  } catch (error) {
    console.error(" Lỗi gửi OTP:", error);
    res.status(500).json({
      error: "Lỗi server khi gửi OTP",
    });
  }
});

// API đăng ký
router.post("/register", validateRegisterData, async (req, res) => {
  // console.log(" ===== API ĐĂNG KÝ ĐƯỢC GỌI =====");
  // console.log("📅 Thời gian:", new Date().toISOString());
  // console.log(" Request body:", req.body);

  try {
    const { phoneNumber, password } = req.body;
    // console.log(" Dữ liệu nhận được:", {
    //   phoneNumber,
    //   password: "***", // Ẩn password trong log
    // });

    // Kiểm tra xem số điện thoại đã tồn tại chưa
    const existingUser = await User.findOne({ Phone: phoneNumber });
    if (existingUser) {
      return res.status(400).json({
        error: "Số điện thoại đã được đăng ký",
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo CustomerID tự động (đảm bảo unique)
    let customerID;
    let isUnique = false;
    while (!isUnique) {
      customerID = generateCustomerID();
      const existingID = await User.findOne({ CustomerID: customerID });
      if (!existingID) {
        isUnique = true;
      }
    }

    // Tạo user mới (chỉ lưu các trường cần thiết)
    const newUser = new User({
      CustomerID: customerID,
      Phone: phoneNumber,
      Password: hashedPassword,
      CustomerTiering: "Đồng", // Mặc định là đồng cho khách hàng mới
    });

    await newUser.save();

    // Backup vào file JSON (commented - chỉ dùng MongoDB)
    // const backupData = {
    //   CustomerID: newUser.CustomerID,
    //   FullName: "", // Để trống, sẽ cập nhật sau
    //   Phone: newUser.Phone,
    //   Email: "", // Để trống, sẽ cập nhật sau
    //   Address: "", // Để trống, sẽ cập nhật sau
    //   RegisterDate: newUser.RegisterDate,
    //   CustomerType: "", // Để trống, để lưu mục đích khác
    //   CustomerTiering: "Đồng", // Mặc định là đồng cho khách hàng mới
    //   Password: hashedPassword,
    // };
    // backupService.addUser(backupData);

    res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        CustomerID: newUser.CustomerID,
        Phone: newUser.Phone,
        RegisterDate: newUser.RegisterDate,
        FullName: newUser.FullName || "",
        Email: newUser.Email || "",
        Address: newUser.Address || "",
        CustomerTiering: newUser.CustomerTiering || "Đồng",
        TotalSpent: newUser.TotalSpent || 0,
      },
    });
  } catch (error) {
    console.error(" Lỗi đăng ký:", error);
    console.error(" Chi tiết lỗi:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      error: "Lỗi server khi đăng ký",
    });
  }
});

// API đăng nhập
router.post("/login", validateLoginData, async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    // Tìm user theo số điện thoại
    const user = await User.findOne({ Phone: phoneNumber });
    if (!user) {
      return res.status(401).json({
        error: "Số điện thoại hoặc mật khẩu không đúng",
      });
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Số điện thoại hoặc mật khẩu không đúng",
      });
    }

    // Trả về thông tin user (ẩn password)
    console.log(" Đăng nhập thành công!");
    console.log(" Thông tin user đăng nhập:", {
      CustomerID: user.CustomerID,
      Phone: user.Phone,
      RegisterDate: user.RegisterDate,
    });

    res.json({
      message: "Đăng nhập thành công",
      user: {
        CustomerID: user.CustomerID,
        Phone: user.Phone,
        RegisterDate: user.RegisterDate,
        FullName: user.FullName || "",
        Email: user.Email || "",
        Address: user.Address || "",
        CustomerTiering: user.CustomerTiering || "Đồng",
        TotalSpent: user.TotalSpent || 0,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({
      error: "Lỗi server khi đăng nhập",
    });
  }
});

// API lấy thông tin user theo CustomerID (không cần password)
router.get("/user/:customerID", async (req, res) => {
  try {
    const { customerID } = req.params;

    if (!customerID) {
      return res.status(400).json({
        success: false,
        error: "CustomerID is required",
      });
    }

    // Tìm user theo CustomerID
    const user = await User.findOne({ CustomerID: customerID });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      });
    }

    // Đảm bảo TotalSpent và CustomerTiering được trả về đúng (không bị undefined/null)
    // Lấy trực tiếp từ MongoDB document
    const totalSpent =
      user.TotalSpent !== undefined && user.TotalSpent !== null
        ? Number(user.TotalSpent)
        : 0;
    const customerTiering = user.CustomerTiering || "Đồng";

    // console.log(`\n✅ [Auth] GET /user/${customerID}:`);
    // console.log(`   📊 Raw MongoDB data:`, {
    //   TotalSpent: user.TotalSpent,
    //   CustomerTiering: user.CustomerTiering,
    //   TotalSpentType: typeof user.TotalSpent,
    //   CustomerTieringType: typeof user.CustomerTiering,
    // });
    // console.log(`   📊 Parsed data:`, {
    //   TotalSpent: totalSpent,
    //   CustomerTiering: customerTiering,
    // });

    // Trả về thông tin user (ẩn password) - Đảm bảo trả về đúng giá trị đã parse
    const responseData = {
      success: true,
      user: {
        CustomerID: user.CustomerID,
        Phone: user.Phone,
        RegisterDate: user.RegisterDate,
        FullName: user.FullName || "",
        Email: user.Email || "",
        Address: user.Address || "",
        CustomerTiering: customerTiering, // Sử dụng giá trị đã parse
        TotalSpent: totalSpent, // Sử dụng giá trị đã parse
      },
    };

    // console.log(`   📤 Response data:`, {
    //   CustomerTiering: responseData.user.CustomerTiering,
    //   TotalSpent: responseData.user.TotalSpent,
    // });
    // console.log(`\n`);

    res.json(responseData);
  } catch (error) {
    console.error("Lỗi lấy thông tin user:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi server khi lấy thông tin user",
    });
  }
});

// API cập nhật thông tin
router.put("/user/update", validateUpdateData, async (req, res) => {
  try {
    const {
      phoneNumber,
      customerID,
      income,
      fee,
      fullName,
      email,
      address,
      birthDay,
      gender,
    } = req.body;

    // Tìm user theo Phone hoặc CustomerID
    let query = {};
    if (phoneNumber) {
      query.Phone = phoneNumber;
    } else if (customerID) {
      query.CustomerID = customerID;
    } else {
      return res.status(400).json({
        error: "Vui lòng cung cấp phoneNumber hoặc customerID",
      });
    }

    // Tìm user
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy người dùng",
      });
    }

    // Cập nhật thông tin
    const updateData = {};
    if (income !== undefined) updateData.Income = income;
    if (fee !== undefined) updateData.Fee = fee;
    if (fullName !== undefined) updateData.FullName = fullName;
    if (email !== undefined) updateData.Email = email;
    if (address !== undefined) updateData.Address = address;
    if (birthDay !== undefined)
      updateData.BirthDay = birthDay ? new Date(birthDay) : null;
    if (gender !== undefined) updateData.Gender = gender;

    // console.log(" Đang cập nhật thông tin trong MongoDB...");
    const updatedUser = await User.findOneAndUpdate(query, updateData, {
      new: true,
    });
    // console.log(" Thông tin đã được cập nhật thành công trong MongoDB!");
    // console.log(" Thông tin user đã cập nhật:", {
    //   CustomerID: updatedUser.CustomerID,
    //   Phone: updatedUser.Phone,
    //   FullName: updatedUser.FullName,
    //   Email: updatedUser.Email,
    //   Address: updatedUser.Address,
    //   BirthDay: updatedUser.BirthDay,
    //   Gender: updatedUser.Gender,
    // });

    res.json({
      success: true,
      message: "Cập nhật thành công",
      data: {
        CustomerID: updatedUser.CustomerID,
        Phone: updatedUser.Phone,
        FullName: updatedUser.FullName,
        Email: updatedUser.Email,
        Address: updatedUser.Address,
        BirthDay: updatedUser.BirthDay,
        Gender: updatedUser.Gender,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi server khi cập nhật",
    });
  }
});

// API quên mật khẩu
router.post("/reset-password", validateResetPasswordData, async (req, res) => {
  // console.log(" ===== API RESET PASSWORD ĐƯỢC GỌI =====");
  // console.log("📅 Thời gian:", new Date().toISOString());
  // console.log(" Request body:", req.body);

  try {
    const { phoneNumber, newPassword } = req.body;
    console.log(" Dữ liệu nhận được:", { phoneNumber });

    // Tìm user theo số điện thoại
    const user = await User.findOne({ Phone: phoneNumber });
    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy người dùng",
      });
    }

    // Hash mật khẩu mới
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Cập nhật mật khẩu với version tracking
    // console.log(" Đang cập nhật mật khẩu trong MongoDB...");
    // console.log(" Password version hiện tại:", user.PasswordVersion);

    const updatedUser = await User.findOneAndUpdate(
      { Phone: phoneNumber },
      {
        Password: hashedPassword,
        PasswordVersion: user.PasswordVersion + 1, // Tăng version
        LastPasswordReset: new Date(), // Cập nhật thời gian reset
      },
      { new: true }
    );

    // console.log(" Mật khẩu đã được cập nhật thành công trong MongoDB!");
    // console.log(" Thông tin user đã cập nhật:", {
    //   CustomerID: updatedUser.CustomerID,
    //   Phone: updatedUser.Phone,
    //   RegisterDate: updatedUser.RegisterDate,
    //   PasswordVersion: updatedUser.PasswordVersion,
    //   LastPasswordReset: updatedUser.LastPasswordReset,
    // });

    // Backup vào file JSON (commented - chỉ dùng MongoDB)
    // console.log(" Đang backup cập nhật mật khẩu vào file JSON...");
    // const backupResult = backupService.updateUser(phoneNumber, {
    //   Password: hashedPassword,
    //   PasswordVersion: updatedUser.PasswordVersion,
    //   LastPasswordReset: updatedUser.LastPasswordReset,
    // });
    // if (backupResult) {
    //   console.log(" Backup cập nhật mật khẩu vào file JSON thành công!");
    // } else {
    //   console.log(" Backup cập nhật mật khẩu vào file JSON thất bại!");
    // }

    res.json({
      message: "Đặt lại mật khẩu thành công",
    });
  } catch (error) {
    console.error("Lỗi reset password:", error);
    res.status(500).json({
      error: "Lỗi server khi đặt lại mật khẩu",
    });
  }
});

// API đổi mật khẩu (change password) - yêu cầu mật khẩu cũ
router.post(
  "/change-password",
  validateChangePasswordData,
  async (req, res) => {
    // console.log(" ===== API CHANGE PASSWORD ĐƯỢC GỌI =====");
    // console.log("📅 Thời gian:", new Date().toISOString());
    // console.log(" Request body:", req.body);

    try {
      const { customerID, currentPassword, newPassword } = req.body;
      console.log(" Dữ liệu nhận được:", { customerID });

      // Tìm user theo CustomerID
      const user = await User.findOne({ CustomerID: customerID });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy người dùng",
        });
      }

      // Xác minh mật khẩu cũ
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.Password
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: "Mật khẩu hiện tại không đúng",
        });
      }

      // Hash mật khẩu mới
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Cập nhật mật khẩu với version tracking
      // console.log(" Đang cập nhật mật khẩu trong MongoDB...");
      // console.log(" Password version hiện tại:", user.PasswordVersion);

      const updatedUser = await User.findOneAndUpdate(
        { CustomerID: customerID },
        {
          Password: hashedPassword,
          PasswordVersion: user.PasswordVersion + 1, // Tăng version
          LastPasswordReset: new Date(), // Cập nhật thời gian reset
        },
        { new: true }
      );

      // console.log(" Mật khẩu đã được cập nhật thành công trong MongoDB!");
      // console.log(" Thông tin user đã cập nhật:", {
      //   CustomerID: updatedUser.CustomerID,
      //   Phone: updatedUser.Phone,
      //   RegisterDate: updatedUser.RegisterDate,
      //   PasswordVersion: updatedUser.PasswordVersion,
      //   LastPasswordReset: updatedUser.LastPasswordReset,
      // });

      // Backup vào file JSON (commented - chỉ dùng MongoDB)
      // console.log(" Đang backup cập nhật mật khẩu vào file JSON...");
      // const backupResult = backupService.updateUser(updatedUser.Phone, {
      //   Password: hashedPassword,
      //   PasswordVersion: updatedUser.PasswordVersion,
      //   LastPasswordReset: updatedUser.LastPasswordReset,
      // });
      // if (backupResult) {
      //   console.log(" Backup cập nhật mật khẩu vào file JSON thành công!");
      // } else {
      //   console.log(" Backup cập nhật mật khẩu vào file JSON thất bại!");
      // }

      res.json({
        success: true,
        message: "Đổi mật khẩu thành công",
      });
    } catch (error) {
      console.error("Lỗi change password:", error);
      res.status(500).json({
        success: false,
        error: "Lỗi server khi đổi mật khẩu",
      });
    }
  }
);

// API xem thông tin password version của user
router.get("/password-info/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // console.log(" Kiểm tra thông tin password version:", phoneNumber);

    const user = await User.findOne({ Phone: phoneNumber });
    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy người dùng",
      });
    }

    res.json({
      CustomerID: user.CustomerID,
      Phone: user.Phone,
      PasswordVersion: user.PasswordVersion,
      LastPasswordReset: user.LastPasswordReset,
      RegisterDate: user.RegisterDate,
    });
  } catch (error) {
    console.error(" Lỗi lấy thông tin password:", error);
    res.status(500).json({
      error: "Lỗi server khi lấy thông tin password",
    });
  }
});

module.exports = router;
