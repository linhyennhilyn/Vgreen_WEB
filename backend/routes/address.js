const express = require("express");
const router = express.Router();
const { UserAddress, User } = require("../db");

// Lấy tất cả địa chỉ của user 
router.get("/:customerID", async (req, res) => {
  try {
    const { customerID } = req.params;

    let userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

 // Nếu chưa có, tự động tạo mới 
    if (!userAddress) {
      userAddress = new UserAddress({
        CustomerID: customerID,
        addresses: [],
      });
      await userAddress.save();
    }

    res.json({
      success: true,
      data: userAddress,
    });
  } catch (error) {
 // console.error("Lỗi lấy địa chỉ:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy địa chỉ",
 // error: error.message, 
    });
  }
});

// Thêm địa chỉ mới 
router.post("/:customerID/add", async (req, res) => {
  try {
    const { customerID } = req.params;
    const addressData = req.body;

 // Validate dữ liệu 
    const requiredFields = [
      "fullName",
      "phone",
      "city",
      "district",
      "ward",
      "detail",
    ];
    for (const field of requiredFields) {
      if (!addressData[field]) {
        return res.status(400).json({
          success: false,
 // message: `Thiếu trường bắt buộc: ${field}`, 
        });
      }
    }

    let userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

 // Nếu chưa có, tạo mới 
    if (!userAddress) {
      userAddress = new UserAddress({
        CustomerID: customerID,
        addresses: [],
      });
    }

 // Nếu đây là địa chỉ đầu tiên hoặc được đặt làm mặc định 
    const isFirstAddress = userAddress.addresses.length === 0;
    if (isFirstAddress || addressData.isDefault) {
 // Bỏ default của các địa chỉ khác 
      userAddress.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      addressData.isDefault = true;
    }

 // Thêm địa chỉ mới 
    const newAddress = {
      ...addressData,
      createdAt: new Date(),
    };
    userAddress.addresses.push(newAddress);

    await userAddress.save();

 // Nếu địa chỉ mới là default, cập nhật field Address trong collection users 
    if (addressData.isDefault) {
      const addressString = `${addressData.detail}, ${addressData.ward}, ${addressData.district}, ${addressData.city}`;

      await User.findOneAndUpdate(
        { CustomerID: customerID },
        { Address: addressString },
        { new: true }
      );

 // console.log( 
 // ` [Address] Updated Address field in users collection for ${customerID}:`, 
 // addressString 
 // ); 
    }

    res.json({
      success: true,
      message: "Đã thêm địa chỉ mới",
      data: userAddress,
    });
  } catch (error) {
 // console.error("Lỗi thêm địa chỉ:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi thêm địa chỉ",
 // error: error.message, 
    });
  }
});

// Cập nhật địa chỉ 
router.put("/:customerID/update/:address_id", async (req, res) => {
  try {
    const { customerID, address_id } = req.params;
    const addressData = req.body;

    const userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ của user",
      });
    }

    const addressIndex = userAddress.addresses.findIndex(
      (addr) => addr._id.toString() === address_id
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ cần cập nhật",
      });
    }

 // Nếu đặt làm địa chỉ mặc định 
    if (addressData.isDefault) {
      userAddress.addresses.forEach((addr, index) => {
        addr.isDefault = index === addressIndex;
      });
    }

 // Cập nhật địa chỉ 
    Object.keys(addressData).forEach((key) => {
      if (key !== "_id" && addressData[key] !== undefined) {
        userAddress.addresses[addressIndex][key] = addressData[key];
      }
    });

    await userAddress.save();

 // Nếu địa chỉ được update là default, cập nhật field Address trong collection users 
    const updatedAddress = userAddress.addresses[addressIndex];
    if (updatedAddress.isDefault) {
      const addressString = `${updatedAddress.detail}, ${updatedAddress.ward}, ${updatedAddress.district}, ${updatedAddress.city}`;

      await User.findOneAndUpdate(
        { CustomerID: customerID },
        { Address: addressString },
        { new: true }
      );

 // console.log( 
 // ` [Address] Updated Address field in users collection for ${customerID}:`, 
 // addressString 
 // ); 
    }

    res.json({
      success: true,
      message: "Đã cập nhật địa chỉ",
      data: userAddress,
    });
  } catch (error) {
 console.error("Lỗi cập nhật địa chỉ:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật địa chỉ",
      error: error.message,
    });
  }
});

// Xóa địa chỉ 
router.delete("/:customerID/delete/:address_id", async (req, res) => {
  try {
    const { customerID, address_id } = req.params;

    const userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ của user",
      });
    }

    const addressToDelete = userAddress.addresses.find(
      (addr) => addr._id.toString() === address_id
    );

    if (!addressToDelete) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ cần xóa",
      });
    }

    const wasDefault = addressToDelete.isDefault;

 // Xóa địa chỉ 
    userAddress.addresses = userAddress.addresses.filter(
      (addr) => addr._id.toString() !== address_id
    );

 // Nếu xóa địa chỉ mặc định và còn địa chỉ khác, đặt địa chỉ đầu tiên làm mặc định 
    if (wasDefault && userAddress.addresses.length > 0) {
      userAddress.addresses[0].isDefault = true;
    }

    await userAddress.save();

 // Cập nhật field Address trong collection users 
    if (wasDefault) {
      if (userAddress.addresses.length > 0) {
 // Có địa chỉ mới làm default, cập nhật Address 
        const newDefaultAddress = userAddress.addresses[0];
        const addressString = `${newDefaultAddress.detail}, ${newDefaultAddress.ward}, ${newDefaultAddress.district}, ${newDefaultAddress.city}`;

        await User.findOneAndUpdate(
          { CustomerID: customerID },
          { Address: addressString },
          { new: true }
        );

 console.log( 
          ` [Address] Updated Address field after delete for ${customerID}:`,
          addressString
        );
      } else {
 // Không còn địa chỉ nào, set Address = null 
        await User.findOneAndUpdate(
          { CustomerID: customerID },
          { Address: null },
          { new: true }
        );

 console.log( 
          ` [Address] Cleared Address field for ${customerID} (no addresses left)`
        );
      }
    }

    res.json({
      success: true,
      message: "Đã xóa địa chỉ",
      data: userAddress,
    });
  } catch (error) {
 console.error("Lỗi xóa địa chỉ:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa địa chỉ",
      error: error.message,
    });
  }
});

// Đặt địa chỉ mặc định 
router.put("/:customerID/set-default/:address_id", async (req, res) => {
  try {
    const { customerID, address_id } = req.params;

    const userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ của user",
      });
    }

    const addressExists = userAddress.addresses.some(
      (addr) => addr._id.toString() === address_id
    );

    if (!addressExists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

 // Tìm địa chỉ mới sẽ làm mặc định 
    let newDefaultAddress = null;

 // Đặt địa chỉ mặc định 
    userAddress.addresses.forEach((addr) => {
      if (addr._id.toString() === address_id) {
        addr.isDefault = true;
        newDefaultAddress = addr;
      } else {
        addr.isDefault = false;
      }
    });

    await userAddress.save();

 // Cập nhật field Address trong collection users 
    if (newDefaultAddress) {
      const addressString = `${newDefaultAddress.detail}, ${newDefaultAddress.ward}, ${newDefaultAddress.district}, ${newDefaultAddress.city}`;

      await User.findOneAndUpdate(
        { CustomerID: customerID },
        { Address: addressString },
        { new: true }
      );

 console.log( 
        ` [Address] Updated Address field in users collection for ${customerID}:`,
        addressString
      );
    }

    res.json({
      success: true,
      message: "Đã đặt địa chỉ mặc định",
      data: userAddress,
    });
  } catch (error) {
 console.error("Lỗi đặt địa chỉ mặc định:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đặt địa chỉ mặc định",
      error: error.message,
    });
  }
});

// Lấy địa chỉ mặc định 
router.get("/:customerID/default", async (req, res) => {
  try {
    const { customerID } = req.params;

    const userAddress = await UserAddress.findOne({
      CustomerID: customerID,
    });

    if (!userAddress || userAddress.addresses.length === 0) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const defaultAddress =
      userAddress.addresses.find((addr) => addr.isDefault) ||
      userAddress.addresses[0];

    res.json({
      success: true,
      data: defaultAddress,
    });
  } catch (error) {
 console.error("Lỗi lấy địa chỉ mặc định:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy địa chỉ mặc định",
      error: error.message,
    });
  }
});

module.exports = router;
