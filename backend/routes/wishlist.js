const express = require("express");
const router = express.Router();
const { UserWishlist, Product } = require("../db");

// Lấy wishlist của user
router.get("/:customerID", async (req, res) => {
  try {
    const { customerID } = req.params;

    let wishlist = await UserWishlist.findOne({ CustomerID: customerID });

 // Nếu chưa có wishlist, tự động tạo mới
    if (!wishlist) {
      wishlist = new UserWishlist({
        CustomerID: customerID,
        wishlist: [],
      });
      await wishlist.save();
    }

    res.json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
 console.error("Lỗi lấy wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy wishlist",
      error: error.message,
    });
  }
});

// Thêm sản phẩm vào wishlist
router.post("/:customerID/add", async (req, res) => {
  try {
    const { customerID } = req.params;
    const { sku, product_name } = req.body;

 console.log(" [Backend] Received request:", {
      customerID,
      sku,
      product_name,
      body: req.body,
    });

    if (!sku || !product_name) {
 console.error(" [Backend] Validation failed:", { sku, product_name });
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp sku và product_name",
      });
    }

    let wishlist = await UserWishlist.findOne({ CustomerID: customerID });

 // Nếu chưa có wishlist, tạo mới
    if (!wishlist) {
      wishlist = new UserWishlist({
        CustomerID: customerID,
        wishlist: [],
      });
    }

 // Kiểm tra sản phẩm đã tồn tại trong wishlist chưa
    const existingProduct = wishlist.wishlist.find((item) => item.sku === sku);

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm đã có trong danh sách yêu thích",
      });
    }

 // Thêm sản phẩm vào wishlist
    wishlist.wishlist.push({
      sku,
      product_name,
      time: new Date(),
    });

    await wishlist.save();

    // Tăng liked count cho sản phẩm
    try {
      await Product.findOneAndUpdate(
        { sku },
        { $inc: { liked: 1 } },
        { new: true }
      );
    } catch (productError) {
      console.error(`⚠️ [Wishlist] Không thể tăng liked cho SKU ${sku}:`, productError.message);
      // Không fail request nếu chỉ lỗi cập nhật liked
    }

    res.json({
      success: true,
      message: "Đã thêm vào danh sách yêu thích",
      data: wishlist,
    });
  } catch (error) {
 console.error("Lỗi thêm vào wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi thêm vào wishlist",
      error: error.message,
    });
  }
});

// Xóa sản phẩm khỏi wishlist
router.delete("/:customerID/remove/:sku", async (req, res) => {
  try {
    const { customerID, sku } = req.params;

    const wishlist = await UserWishlist.findOne({ CustomerID: customerID });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy wishlist của user",
      });
    }

 // Lọc bỏ sản phẩm khỏi mảng wishlist
    const initialLength = wishlist.wishlist.length;
    wishlist.wishlist = wishlist.wishlist.filter((item) => item.sku !== sku);

    if (wishlist.wishlist.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm trong danh sách yêu thích",
      });
    }

    await wishlist.save();

    // Giảm liked count cho sản phẩm (đảm bảo không âm)
    try {
      const product = await Product.findOne({ sku });
      if (product && product.liked > 0) {
        await Product.findOneAndUpdate(
          { sku },
          { $inc: { liked: -1 } },
          { new: true }
        );
      }
    } catch (productError) {
      console.error(`⚠️ [Wishlist] Không thể giảm liked cho SKU ${sku}:`, productError.message);
      // Không fail request nếu chỉ lỗi cập nhật liked
    }

    res.json({
      success: true,
      message: "Đã xóa khỏi danh sách yêu thích",
      data: wishlist,
    });
  } catch (error) {
 console.error("Lỗi xóa khỏi wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa khỏi wishlist",
      error: error.message,
    });
  }
});

// Kiểm tra sản phẩm có trong wishlist không
router.get("/:customerID/check/:sku", async (req, res) => {
  try {
    const { customerID, sku } = req.params;

    const wishlist = await UserWishlist.findOne({ CustomerID: customerID });

    if (!wishlist) {
      return res.json({
        success: true,
        data: {
          isInWishlist: false,
        },
      });
    }

    const isInWishlist = wishlist.wishlist.some((item) => item.sku === sku);

    res.json({
      success: true,
      data: {
        isInWishlist,
      },
    });
  } catch (error) {
    console.error("Lỗi kiểm tra wishlist:", error);
    // Trả về false thay vì lỗi 500 để tránh spam console
    // Frontend sẽ xử lý như sản phẩm không có trong wishlist
    res.json({
      success: true,
      data: {
        isInWishlist: false,
      },
    });
  }
});

// Xóa toàn bộ wishlist
router.delete("/:customerID/clear", async (req, res) => {
  try {
    const { customerID } = req.params;

    const wishlist = await UserWishlist.findOne({ CustomerID: customerID });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy wishlist của user",
      });
    }

    // Lưu danh sách SKU trước khi xóa để giảm liked
    const skusToRemove = wishlist.wishlist.map(item => item.sku);
    
    wishlist.wishlist = [];
    await wishlist.save();

    // Giảm liked count cho tất cả sản phẩm trong wishlist
    try {
      for (const sku of skusToRemove) {
        const product = await Product.findOne({ sku });
        if (product && product.liked > 0) {
          await Product.findOneAndUpdate(
            { sku },
            { $inc: { liked: -1 } },
            { new: true }
          );
        }
      }
    } catch (productError) {
      console.error(`⚠️ [Wishlist] Không thể giảm liked khi xóa wishlist:`, productError.message);
      // Không fail request nếu chỉ lỗi cập nhật liked
    }

    res.json({
      success: true,
      message: "Đã xóa toàn bộ danh sách yêu thích",
      data: wishlist,
    });
  } catch (error) {
 console.error("Lỗi xóa wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa wishlist",
      error: error.message,
    });
  }
});

module.exports = router;
