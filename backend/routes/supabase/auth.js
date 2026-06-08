const express = require("express");
const bcrypt = require("bcrypt");
const { supabase } = require("../../supabase");
const router = express.Router();

const sanitizeUser = (user) => {
  if (!user) return null;
  const { Password, ...safeUser } = user;
  return safeUser;
};

const generateCustomerID = () => {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `KH${Date.now()}${suffix}`;
};

router.post("/check-phone", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: "Số điện thoại không được để trống" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("CustomerID")
      .eq("Phone", phoneNumber)
      .limit(1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (data && data.length > 0) {
      return res.status(400).json({ error: "Số điện thoại đã được đăng ký" });
    }

    res.json({ message: "Số điện thoại có thể sử dụng", available: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/check-phone-exists", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: "Số điện thoại không được để trống" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("CustomerID, Phone, RegisterDate")
      .eq("Phone", phoneNumber)
      .limit(1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "Số điện thoại chưa được đăng ký" });
    }

    res.json({
      message: "Số điện thoại tồn tại",
      exists: true,
      user: data[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/send-otp", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: "Số điện thoại không được để trống" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("🔐 OTP generated:", otpCode);

    res.json({
      message: "OTP đã được gửi thành công",
      phoneNumber,
      otpCode,
      expiresIn: 300,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: phoneNumber, password" });
    }

    const existing = await supabase
      .from("users")
      .select("CustomerID")
      .eq("Phone", phoneNumber)
      .limit(1);

    if (existing.error) {
      return res.status(500).json({ error: existing.error.message });
    }
    if (existing.data && existing.data.length > 0) {
      return res.status(400).json({ error: "Số điện thoại đã được đăng ký" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let customerID = generateCustomerID();

    const { data: sameId, error: sameIdErr } = await supabase
      .from("users")
      .select("CustomerID")
      .eq("CustomerID", customerID)
      .limit(1);
    if (sameIdErr) {
      return res.status(500).json({ error: sameIdErr.message });
    }
    if (sameId && sameId.length > 0) {
      customerID = generateCustomerID();
    }

    const payload = {
      CustomerID: customerID,
      Phone: phoneNumber,
      Password: hashedPassword,
      RegisterDate: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("users").insert(payload);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ success: true, user: sanitizeUser(data[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ error: "Thiếu thông tin: phoneNumber và password" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("Phone", phoneNumber)
      .limit(1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(400).json({ error: "Số điện thoại chưa được đăng ký" });
    }

    const user = data[0];
    const match = await bcrypt.compare(password, user.Password || "");
    if (!match) {
      return res.status(400).json({ error: "Sai mật khẩu" });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/user/:customerID", async (req, res) => {
  try {
    const { customerID } = req.params;
    if (!customerID) {
      return res.status(400).json({ error: "CustomerID is required" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("CustomerID", customerID)
      .limit(1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: sanitizeUser(data[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
