const express = require("express");
const router = express.Router();
const { Cart, Product } = require("../db");

/** 
 * @route GET /api/cart/:customerID 
 * @desc Lấy giỏ hàng của customer 
 */ 
router.get("/:customerID", async (req, res) => {
  try {
    const { customerID } = req.params;

 // console.log(" [GET Cart] CustomerID:", customerID); 

 // KHÔNG lưu cart của guest vào MongoDB 
    if (customerID === "guest") {
 // console.log( 
 // " [GET Cart] Guest user - return empty cart without saving to DB" 
 // ); 
      return res.json({
        success: true,
        message: "Guest cart (not saved to DB)",
        data: {
          CustomerID: "guest",
          items: [],
          itemCount: 0,
          totalQuantity: 0,
        },
      });
    }

    let cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
 // Nếu chưa có giỏ hàng, tạo mới 
      cart = new Cart({
        CustomerID: customerID,
        items: [],
        itemCount: 0,
        totalQuantity: 0,
      });
      await cart.save();

      return res.json({
        success: true,
        message: "Giỏ hàng mới được tạo",
        data: cart,
      });
    }

    // Tự động xóa sản phẩm inactive khỏi giỏ hàng khi load
    if (cart.items && cart.items.length > 0) {
      // Lấy tất cả SKUs từ giỏ hàng
      const skus = cart.items.map(item => item.sku).filter(Boolean);
      
      if (skus.length > 0) {
        // Query tất cả sản phẩm active cùng lúc để tối ưu performance
        const activeProducts = await Product.find({ 
          sku: { $in: skus }, 
          status: 'Active' 
        }).select('sku');
        
        // Tạo Set các SKU active để lookup nhanh
        const activeSkus = new Set(activeProducts.map(p => p.sku));
        
        // Lọc items: chỉ giữ lại sản phẩm active
        const activeItems = cart.items.filter(item => {
          const isActive = activeSkus.has(item.sku);
          if (!isActive) {
            console.log(`🗑️ [Cart] Removing inactive product ${item.sku} (${item.productName}) from cart ${customerID}`);
          }
          return isActive;
        });
        
        // Nếu có thay đổi, cập nhật giỏ hàng
        if (activeItems.length !== cart.items.length) {
          const removedCount = cart.items.length - activeItems.length;
          cart.items = activeItems;
          cart.itemCount = activeItems.length;
          cart.totalQuantity = activeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
          cart.updatedAt = new Date();
          await cart.save();
          console.log(`✅ [Cart] Updated cart ${customerID}: removed ${removedCount} inactive products. New itemCount: ${cart.itemCount}`);
        }
      }
    }

    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
 // console.error(" [GET Cart] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy giỏ hàng",
      error: error.message,
    });
  }
});

/** 
 * @route POST /api/cart/:customerID/add 
 * @desc Thêm sản phẩm vào giỏ hàng 
 * @body { sku, quantity, price, productName, image, unit } 
 */ 
router.post("/:customerID/add", async (req, res) => {
  try {
    const { customerID } = req.params;
    const {
      sku,
      quantity,
      price,
      productName,
      image,
      unit,
      category,
      subcategory,
      originalPrice,
      hasPromotion,
    } = req.body;

 // console.log(" [Add to Cart] CustomerID:", customerID, "SKU:", sku); 

 // KHÔNG cho phép guest thêm vào giỏ (bắt buộc đăng nhập) 
 // if (customerID === 'guest') { 
 // console.log(' [Add to Cart] Guest user blocked - login required'); 
 // return res.status(401).json({ 
 // success: false, 
 // message: "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng", 
 // requireLogin: true, 
 // }); 
 // } 

 // Validate input 
    if (!sku || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin sản phẩm (sku, quantity, price)",
      });
    }

 // Tìm giỏ hàng của customer 
    let cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
 // Tạo giỏ hàng mới nếu chưa có 
      cart = new Cart({
        CustomerID: customerID,
        items: [],
        itemCount: 0,
        totalQuantity: 0,
      });
    }

 // Kiểm tra sản phẩm đã có trong giỏ chưa 
    const existingItemIndex = cart.items.findIndex((item) => item.sku === sku);

    if (existingItemIndex > -1) {
 // Sản phẩm đã có Cập nhật số lượng 
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].updatedAt = new Date();
 // Cập nhật originalPrice và hasPromotion nếu có 
      if (originalPrice !== undefined) {
        cart.items[existingItemIndex].originalPrice = originalPrice;
      }
      if (hasPromotion !== undefined) {
        cart.items[existingItemIndex].hasPromotion = hasPromotion;
      }
    } else {
 // Sản phẩm mới Thêm vào giỏ 
      cart.items.push({
        sku,
        productName,
        quantity,
        price,
        image,
        unit,
        category,
        subcategory,
        originalPrice,
        hasPromotion: hasPromotion || false,
        addedAt: new Date(),
        updatedAt: new Date(),
      });
    }

 // Tính lại itemCount và totalQuantity 
    cart.itemCount = cart.items.length;
    cart.totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    cart.updatedAt = new Date();

    await cart.save();

    res.json({
      success: true,
      message: "Đã thêm sản phẩm vào giỏ hàng",
      data: cart,
    });
  } catch (error) {
 // console.error(" [Add to Cart] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm sản phẩm vào giỏ",
      error: error.message,
    });
  }
});

/** 
 * @route PUT /api/cart/:customerID/update/:sku 
 * @desc Cập nhật số lượng sản phẩm trong giỏ 
 * @body { quantity } 
 */ 
router.put("/:customerID/update/:sku", async (req, res) => {
  try {
    const { customerID, sku } = req.params;
    const { quantity } = req.body;

 // console.log( 
 // " [Update Cart Item] CustomerID:", 
 // customerID, 
 // "SKU:", 
 // sku, 
 // "Quantity:", 
 // quantity 
 // ); 

 // KHÔNG cho phép guest cập nhật giỏ 
    if (customerID === "guest") {
 // console.log(" [Update Cart] Guest user blocked - login required"); 
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để cập nhật giỏ hàng",
        requireLogin: true,
      });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Số lượng không hợp lệ",
      });
    }

    const cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giỏ hàng",
      });
    }

    const itemIndex = cart.items.findIndex((item) => item.sku === sku);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm trong giỏ hàng",
      });
    }

    if (quantity === 0) {
 // Remove item if quantity is 0 
      cart.items.splice(itemIndex, 1);
    } else {
 // Update quantity 
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].updatedAt = new Date();
    }

 // Tính lại itemCount và totalQuantity 
    cart.itemCount = cart.items.length;
    cart.totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    cart.updatedAt = new Date();

    await cart.save();

    res.json({
      success: true,
      message: "Đã cập nhật số lượng sản phẩm",
      data: cart,
    });
  } catch (error) {
 // console.error(" [Update Cart Item] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật giỏ hàng",
      error: error.message,
    });
  }
});

/** 
 * @route DELETE /api/cart/:customerID/remove/:sku 
 * @desc Xóa sản phẩm khỏi giỏ hàng 
 */ 
router.delete("/:customerID/remove/:sku", async (req, res) => {
  try {
    const { customerID, sku } = req.params;

 // console.log(" [Remove from Cart] CustomerID:", customerID, "SKU:", sku); 

 // KHÔNG cho phép guest xóa sản phẩm 
    if (customerID === "guest") {
 // console.log(" [Remove from Cart] Guest user blocked - login required"); 
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để quản lý giỏ hàng",
        requireLogin: true,
      });
    }

    const cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giỏ hàng",
      });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.sku !== sku);

    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm trong giỏ hàng",
      });
    }

 // Nếu sau khi xóa không còn item nào, xóa luôn cart document 
    if (cart.items.length === 0) {
      await Cart.deleteOne({ CustomerID: customerID });
 // console.log( 
 // " [Remove from Cart] Cart is now empty, deleted cart document" 
 // ); 
      return res.json({
        success: true,
        message:
          "Đã xóa sản phẩm khỏi giỏ hàng. Giỏ hàng đã được xóa vì không còn sản phẩm.",
        data: {
          CustomerID: customerID,
          items: [],
          itemCount: 0,
          totalQuantity: 0,
        },
      });
    }

 // Tính lại itemCount và totalQuantity 
    cart.itemCount = cart.items.length;
    cart.totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    cart.updatedAt = new Date();

    await cart.save();

    res.json({
      success: true,
      message: "Đã xóa sản phẩm khỏi giỏ hàng",
      data: cart,
    });
  } catch (error) {
 // console.error(" [Remove from Cart] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa sản phẩm",
      error: error.message,
    });
  }
});

/** 
 * @route DELETE /api/cart/:customerID/clear 
 * @desc Xóa toàn bộ giỏ hàng 
 */ 
router.delete("/:customerID/clear", async (req, res) => {
  try {
    const { customerID } = req.params;

 // console.log(" [Clear Cart] CustomerID:", customerID); 

 // KHÔNG cho phép guest clear giỏ 
    if (customerID === "guest") {
 // console.log(" [Clear Cart] Guest user blocked - login required"); 
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để quản lý giỏ hàng",
        requireLogin: true,
      });
    }

    const cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giỏ hàng",
      });
    }

 // Xóa luôn cart document thay vì chỉ clear items 
    await Cart.deleteOne({ CustomerID: customerID });
 // console.log(" [Clear Cart] Cart document deleted completely"); 

    res.json({
      success: true,
      message: "Đã xóa toàn bộ giỏ hàng",
      data: {
        CustomerID: customerID,
        items: [],
        itemCount: 0,
        totalQuantity: 0,
      },
    });
  } catch (error) {
 // console.error(" [Clear Cart] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa giỏ hàng",
      error: error.message,
    });
  }
});

/** 
 * @route POST /api/cart/:customerID/remove-multiple 
 * @desc Xóa nhiều sản phẩm khỏi giỏ hàng (dùng sau khi đặt hàng) 
 * @body { skus: string[] } 
 */ 
router.post("/:customerID/remove-multiple", async (req, res) => {
  try {
    const { customerID } = req.params;
    const { skus } = req.body;

 // console.log( 
 // " [Remove Multiple Items] CustomerID:", 
 // customerID, 
 // "SKUs:", 
 // skus 
 // ); 

 // Validation 
    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách SKU không hợp lệ",
      });
    }

 // KHÔNG cho phép guest xóa nhiều items 
    if (customerID === "guest") {
 // console.log( 
 // " [Remove Multiple Items] Guest user blocked - login required" 
 // ); 
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để quản lý giỏ hàng",
        requireLogin: true,
      });
    }

    const cart = await Cart.findOne({ CustomerID: customerID });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giỏ hàng",
      });
    }

 // Lọc bỏ các items có SKU trong danh sách 
    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => !skus.includes(item.sku));
    const removedCount = initialLength - cart.items.length;

 // Nếu sau khi xóa không còn item nào, xóa luôn cart document 
    if (cart.items.length === 0) {
      await Cart.deleteOne({ CustomerID: customerID });
 // console.log( 
 // ` [Remove Multiple Items] Removed ${removedCount}/${skus.length} items. Cart is now empty, deleted cart document` 
 // ); 
      return res.json({
        success: true,
        message: `Đã xóa ${removedCount} sản phẩm khỏi giỏ hàng. Giỏ hàng đã được xóa vì không còn sản phẩm.`,
        data: {
          CustomerID: customerID,
          items: [],
          itemCount: 0,
          totalQuantity: 0,
        },
        removedCount,
      });
    }

 // Cập nhật itemCount và totalQuantity 
    cart.itemCount = cart.items.length;
    cart.totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    cart.updatedAt = new Date();

    await cart.save();

 // console.log( 
 // ` [Remove Multiple Items] Removed ${removedCount}/${skus.length} items. Remaining: ${cart.items.length}` 
 // ); 

    res.json({
      success: true,
      message: `Đã xóa ${removedCount} sản phẩm khỏi giỏ hàng`,
      data: cart,
      removedCount,
    });
  } catch (error) {
 // console.error(" [Remove Multiple Items] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa sản phẩm khỏi giỏ hàng",
      error: error.message,
    });
  }
});

/** 
 * @route POST /api/cart/:customerID/sync 
 * @desc Đồng bộ giỏ hàng (từ localStorage lên server) 
 * @body { items: [...] } 
 */ 
router.post("/:customerID/sync", async (req, res) => {
  try {
    const { customerID } = req.params;
    const { items } = req.body;

 // console.log( 
 // " [Sync Cart] CustomerID:", 
 // customerID, 
 // "Items count:", 
 // items?.length || 0 
 // ); 

 // KHÔNG cho phép guest sync giỏ 
    if (customerID === "guest") {
 // console.log(" [Sync Cart] Guest user blocked - login required"); 
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để đồng bộ giỏ hàng",
        requireLogin: true,
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Items phải là mảng",
      });
    }

 // Format items với timestamp 
    const formattedItems = items.map((item) => ({
      sku: item.sku,
      productName: item.productName || item.name,
      quantity: item.quantity || 1,
      price: item.price,
      image: item.image,
      unit: item.unit,
      category: item.category,
      subcategory: item.subcategory,
      addedAt: item.addedAt || new Date(),
      updatedAt: new Date(),
    }));

 // Tính itemCount và totalQuantity 
    const itemCount = formattedItems.length;
    const totalQuantity = formattedItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

 // Tìm hoặc tạo cart 
    let cart = await Cart.findOne({ CustomerID: customerID });

    if (cart) {
      cart.items = formattedItems;
      cart.itemCount = itemCount;
      cart.totalQuantity = totalQuantity;
      cart.updatedAt = new Date();
    } else {
      cart = new Cart({
        CustomerID: customerID,
        items: formattedItems,
        itemCount: itemCount,
        totalQuantity: totalQuantity,
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: "Đã đồng bộ giỏ hàng",
      data: cart,
    });
  } catch (error) {
 // console.error(" [Sync Cart] Error:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi đồng bộ giỏ hàng",
      error: error.message,
    });
  }
});

module.exports = router;
