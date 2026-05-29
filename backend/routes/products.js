const express = require("express");
const router = express.Router();
const { Product, Order, Cart, Review } = require("../db");
const { ObjectId } = require("mongodb");
const { calculateProductRating } = require("../services/rating.service");

// GET all products
router.get("/", async (req, res) => {
  try {
    const { group } = req.query; // Filter by group if provided

    // Build query - Only show Active and OutOfStock products
    let query = {
      status: { $in: ["Active", "OutOfStock"] },
    };
    if (group && group !== "all") {
      query.groups = group; // Filter by group name
    }

    // console.log(" [Products API] Fetching all products...");
    const products = await Product.find(query);
    // console.log(` [Products API] Found ${products.length} products`);

    // Thêm reviewCount và đảm bảo purchase_count >= liked cho mỗi sản phẩm
    const productsWithReviewCount = await Promise.all(
      products.map(async (product) => {
        // Đảm bảo purchase_count >= liked
        if (product.liked > product.purchase_count) {
          product.liked = Math.max(0, product.purchase_count);
          await product.save();
        }

        // Tính reviewCount từ reviews
        let reviewCount = 0;
        try {
          const { reviewCount: count } = await calculateProductRating(
            product.sku
          );
          reviewCount = count;
        } catch (error) {
          // Nếu lỗi, reviewCount = 0
          reviewCount = 0;
        }

        // Trả về product với reviewCount
        return {
          ...product.toObject(),
          reviewCount: reviewCount,
        };
      })
    );

    res.json({
      success: true,
      data: productsWithReviewCount,
      count: productsWithReviewCount.length,
    });
  } catch (error) {
    // console.error(" [Products API] Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách sản phẩm",
      error: error.message,
    });
  }
});

// ============================================================================
// METADATA ROUTES - Must be placed BEFORE /:id route to avoid conflicts
// ============================================================================

// GET /api/products/metadata/categories - Lấy danh sách categories
router.get("/metadata/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category", { status: "Active" });
    res.json({
      success: true,
      data: categories.filter((c) => c && c.trim() !== ""),
      count: categories.length,
    });
  } catch (error) {
    console.error(" [Products API] Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách categories",
      error: error.message,
    });
  }
});

// GET /api/products/metadata/subcategories - Lấy danh sách subcategories
router.get("/metadata/subcategories", async (req, res) => {
  try {
    const subcategories = await Product.distinct("subcategory", {
      status: "Active",
    });
    res.json({
      success: true,
      data: subcategories.filter((s) => s && s.trim() !== ""),
      count: subcategories.length,
    });
  } catch (error) {
    console.error(" [Products API] Error fetching subcategories:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách subcategories",
      error: error.message,
    });
  }
});

// GET /api/products/metadata/brands - Lấy danh sách brands
router.get("/metadata/brands", async (req, res) => {
  try {
    const brands = await Product.distinct("brand", { status: "Active" });
    res.json({
      success: true,
      data: brands.filter((b) => b && b.trim() !== ""),
      count: brands.length,
    });
  } catch (error) {
    console.error(" [Products API] Error fetching brands:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách brands",
      error: error.message,
    });
  }
});

// GET /api/products/metadata/groups - Lấy danh sách tất cả product groups
router.get("/metadata/groups", async (req, res) => {
  try {
    // Get all unique group names from products
    const products = await Product.find({ status: "Active" }).select("groups");
    const groupsSet = new Set();

    products.forEach((product) => {
      if (product.groups && Array.isArray(product.groups)) {
        product.groups.forEach((group) => {
          if (group && group.trim() !== "") {
            groupsSet.add(group.trim());
          }
        });
      }
    });

    const groups = Array.from(groupsSet).sort();

    res.json({
      success: true,
      data: groups,
      count: groups.length,
    });
  } catch (error) {
    console.error(" [Products API] Error fetching groups:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách groups",
      error: error.message,
    });
  }
});

// GET /api/products/metadata/products - Lấy danh sách products (SKU và tên)
router.get("/metadata/products", async (req, res) => {
  try {
    const products = await Product.find({ status: "Active" })
      .select("sku product_name productName")
      .limit(1000); // Limit để tránh quá nhiều data

    const productList = products.map((p) => ({
      sku: p.sku,
      name: p.product_name || p.productName || p.sku,
    }));

    res.json({
      success: true,
      data: productList,
      count: productList.length,
    });
  } catch (error) {
    console.error(" [Products API] Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách products",
      error: error.message,
    });
  }
});

// ============================================================================
// PRODUCT GROUPS ROUTES - Must be placed BEFORE /:id route to avoid conflicts
// ============================================================================

// POST /api/products/groups - Tạo nhóm và gán cho nhiều sản phẩm
router.post("/groups", async (req, res) => {
  try {
    const { groupName, skus } = req.body;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên nhóm không được để trống",
      });
    }

    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách SKU không được để trống",
      });
    }

    const trimmedGroupName = groupName.trim();

    console.log(
      `📦 [Products API] Creating group "${trimmedGroupName}" for ${skus.length} products`
    );

    // Update all products to add this group
    const updateResult = await Product.updateMany(
      { sku: { $in: skus } },
      { $addToSet: { groups: trimmedGroupName } } // $addToSet ensures no duplicates
    );

    console.log(
      `✅ [Products API] Added group "${trimmedGroupName}" to ${updateResult.modifiedCount} products`
    );

    // Get updated products
    const updatedProducts = await Product.find({ sku: { $in: skus } });

    res.json({
      success: true,
      message: `Đã tạo nhóm "${trimmedGroupName}" và gán cho ${updateResult.modifiedCount} sản phẩm`,
      data: {
        groupName: trimmedGroupName,
        productCount: updateResult.modifiedCount,
        products: updatedProducts,
      },
    });
  } catch (error) {
    console.error("❌ [Products API] Error creating group:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo nhóm sản phẩm",
      error: error.message,
    });
  }
});

// PUT /api/products/groups/product/:sku - Thêm/xóa groups từ một sản phẩm
router.put("/groups/product/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const { action, groupName } = req.body; // action: 'add' or 'remove'

    if (!action || !["add", "remove"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action phải là 'add' hoặc 'remove'",
      });
    }

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên nhóm không được để trống",
      });
    }

    const trimmedGroupName = groupName.trim();
    const product = await Product.findOne({ sku });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    let updateOperator;
    if (action === "add") {
      updateOperator = { $addToSet: { groups: trimmedGroupName } };
      console.log(
        `📦 [Products API] Adding group "${trimmedGroupName}" to product ${sku}`
      );
    } else {
      updateOperator = { $pull: { groups: trimmedGroupName } };
      console.log(
        `📦 [Products API] Removing group "${trimmedGroupName}" from product ${sku}`
      );
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { sku },
      updateOperator,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Không thể cập nhật sản phẩm",
      });
    }

    console.log(
      `✅ [Products API] Product ${sku} groups updated:`,
      updatedProduct.groups
    );

    res.json({
      success: true,
      message:
        action === "add"
          ? `Đã thêm sản phẩm vào nhóm "${trimmedGroupName}"`
          : `Đã xóa sản phẩm khỏi nhóm "${trimmedGroupName}"`,
      data: updatedProduct,
    });
  } catch (error) {
    console.error("❌ [Products API] Error updating product groups:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật nhóm sản phẩm",
      error: error.message,
    });
  }
});

// DELETE /api/products/groups/:groupName - Xóa nhóm khỏi tất cả sản phẩm
router.delete("/groups/:groupName", async (req, res) => {
  try {
    const { groupName } = req.params;

    console.log(
      `📦 [Products API] Removing group "${groupName}" from all products`
    );

    // Remove group from all products
    const updateResult = await Product.updateMany(
      { groups: groupName },
      { $pull: { groups: groupName } }
    );

    console.log(
      `✅ [Products API] Removed group "${groupName}" from ${updateResult.modifiedCount} products`
    );

    res.json({
      success: true,
      message: `Đã xóa nhóm "${groupName}" khỏi ${updateResult.modifiedCount} sản phẩm`,
      data: {
        groupName,
        productCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("❌ [Products API] Error deleting group:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhóm sản phẩm",
      error: error.message,
    });
  }
});

// ============================================================================
// PRODUCT ROUTES
// ============================================================================

// GET product by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // console.log(` [Products API] Fetching product with ID/SKU: ${id}`);

    // Tìm product theo SKU hoặc _id
    let product = await Product.findOne({ sku: id });

    // Nếu không tìm thấy bằng SKU, thử tìm bằng _id
    if (!product) {
      product = await Product.findOne({ _id: id });
    }

    if (!product) {
      // console.log(` [Products API] Product not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Đảm bảo purchase_count >= liked
    if (product.liked > product.purchase_count) {
      product.liked = Math.max(0, product.purchase_count);
      await product.save();
    }

    // Tính reviewCount từ reviews
    let reviewCount = 0;
    try {
      const { reviewCount: count } = await calculateProductRating(product.sku);
      reviewCount = count;
    } catch (error) {
      // Nếu lỗi, reviewCount = 0
      reviewCount = 0;
    }

    // console.log(` [Products API] Found product: ${product.product_name}`);
    res.json({
      success: true,
      data: {
        ...product.toObject(),
        reviewCount: reviewCount,
      },
    });
  } catch (error) {
    // console.error(" [Products API] Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin sản phẩm",
      error: error.message,
    });
  }
});

// GET products by category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    // console.log(` [Products API] Fetching products in category: ${category}`);

    const products = await Product.find({
      category: category,
      status: "Active",
    });

    // console.log(
    // ` [Products API] Found ${products.length} products in ${category}`
    // );
    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    // console.error(
    // " [Products API] Error fetching products by category:",
    // error
    // );
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy sản phẩm theo danh mục",
      error: error.message,
    });
  }
});

// GET products by subcategory
router.get("/category/:category/:subcategory", async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    // console.log(
    // ` [Products API] Fetching products in ${category}/${subcategory}`
    // );

    const products = await Product.find({
      category: category,
      subcategory: subcategory,
      status: "Active",
    });

    // console.log(` [Products API] Found ${products.length} products`);
    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    // console.error(
    // " [Products API] Error fetching products by subcategory:",
    // error
    // );
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy sản phẩm theo danh mục phụ",
      error: error.message,
    });
  }
});

// PUT /api/products/:id - Cập nhật sản phẩm
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(` [Products API] Updating product with ID: ${id}`);

    // Tìm product theo _id trước (vì frontend gửi _id từ MongoDB)
    let product = await Product.findOne({ _id: id });

    // Nếu không tìm thấy bằng _id, thử tìm bằng SKU
    if (!product) {
      console.log(` [Products API] Not found by _id, trying SKU...`);
      product = await Product.findOne({ sku: id });
    }

    if (!product) {
      console.log(` [Products API] Product not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    console.log(
      ` [Products API] Found product: ${product.product_name} (${product._id})`
    );

    // Cập nhật post_date với thời gian hiện tại khi lưu
    const updateData = {
      ...req.body,
      post_date: new Date(), // Cập nhật ngày cập nhật mới nhất
    };

    // Đảm bảo _id không bị thay đổi
    if (updateData._id && updateData._id !== product._id) {
      // Nếu _id trong body khác với _id hiện tại, giữ nguyên _id cũ
      delete updateData._id;
    }

    // Đảm bảo purchase_count >= liked
    const purchaseCount =
      updateData.purchase_count !== undefined
        ? updateData.purchase_count
        : product.purchase_count;
    const liked =
      updateData.liked !== undefined ? updateData.liked : product.liked;
    if (liked > purchaseCount) {
      updateData.liked = Math.max(0, purchaseCount);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: product._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Không thể cập nhật sản phẩm",
      });
    }

    // Tự động cập nhật status dựa trên stock nếu stock được cập nhật
    if (updateData.stock !== undefined && updatedProduct.sku) {
      const { updateProductStatusByStock } = require("../db");
      await updateProductStatusByStock(
        updatedProduct.sku,
        updatedProduct.stock
      );
    }

    console.log(
      ` [Products API] Product updated successfully: ${updatedProduct.product_name}`
    );
    res.json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: updatedProduct,
    });
  } catch (error) {
    console.error(" [Products API] Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật sản phẩm",
      error: error.message,
    });
  }
});

// POST /api/products - Tạo sản phẩm mới
router.post("/", async (req, res) => {
  try {
    const newProduct = new Product({
      ...req.body,
      post_date: new Date(), // Set ngày tạo mới
    });
    await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Tạo sản phẩm thành công",
      data: newProduct,
    });
  } catch (error) {
    // console.error(" [Products API] Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo sản phẩm",
      error: error.message,
    });
  }
});

// DELETE /api/products/:id - Xóa sản phẩm
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`\n🗑️ === DELETE PRODUCT ===`);
    console.log(`📦 Product ID/SKU: ${id}`);

    // Strategy 1: Try to find by SKU first (most common case from frontend)
    let product = await Product.findOne({ sku: id });

    // Strategy 2: If not found by SKU, try to find by _id as ObjectId
    if (!product) {
      try {
        // Check if the id is a valid MongoDB ObjectId
        if (ObjectId.isValid(id)) {
          product = await Product.findOne({ _id: new ObjectId(id) });
          if (product) {
            console.log(
              `📦 [Products API] Found product by _id (ObjectId): ${
                product.product_name || product.productName
              }`
            );
          }
        }
      } catch (e) {
        // Invalid ObjectId format, continue
        console.log(`📦 [Products API] Invalid ObjectId format: ${id}`);
      }
    } else {
      console.log(
        `📦 [Products API] Found product by SKU: ${
          product.product_name || product.productName
        }`
      );
    }

    // Strategy 3: If still not found, try to find by _id as string (fallback)
    if (!product) {
      try {
        product = await Product.findOne({ _id: id });
        if (product) {
          console.log(
            `📦 [Products API] Found product by _id (string): ${
              product.product_name || product.productName
            }`
          );
        }
      } catch (e) {
        // Ignore errors
        console.log(`📦 [Products API] Error finding by _id string: ${id}`);
      }
    }

    if (!product) {
      console.log(`❌ [Products API] Product not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
        error: `Product with ID/SKU "${id}" not found`,
      });
    }

    console.log(
      `✅ [Products API] Found product: ${
        product.product_name || product.productName
      } (${product._id})`
    );

    const productSku = product.sku;
    const confirmDelete = req.query.confirm === "true";

    // Kiểm tra đơn hàng "pending" hoặc "processing" (đang xử lý) chứa sản phẩm này
    // CHỈ xử lý đơn hàng pending/processing, không ảnh hưởng đến đơn hàng đã giao/đã thanh toán/đang giao
    const pendingOrders = await Order.find({
      status: { $in: ["pending", "processing"] },
      "items.sku": productSku,
    }).select(
      "OrderID CustomerID items totalAmount subtotal shippingFee discount vatRate createdAt"
    );

    // Nếu có đơn hàng pending và chưa xác nhận xóa, trả về thông tin đơn hàng
    // Trả về status 200 với requiresConfirmation để frontend xử lý
    if (pendingOrders.length > 0 && !confirmDelete) {
      const orderInfo = pendingOrders.map((order) => ({
        OrderID: order.OrderID,
        CustomerID: order.CustomerID,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      }));

      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        message: `Sản phẩm này đang có trong ${pendingOrders.length} đơn hàng đang xử lý. Xóa sản phẩm sẽ xóa sản phẩm khỏi các đơn hàng này và giảm tổng tiền tương ứng.`,
        affectedOrders: orderInfo,
        orderCount: pendingOrders.length,
      });
    }

    // Tiến hành xóa sản phẩm
    // 1. Xóa sản phẩm khỏi các đơn hàng pending/processing và cập nhật tổng tiền (chỉ khi confirm)
    if (pendingOrders.length > 0 && confirmDelete) {
      // Lấy db connection từ mongoose
      const mongoose = require("mongoose");
      const db = mongoose.connection.db;
      const notificationsCollection = db
        ? db.collection("notifications")
        : null;

      for (const order of pendingOrders) {
        // Tìm item có SKU trùng với sản phẩm cần xóa
        const itemToRemove = order.items.find(
          (item) => item.sku === productSku || item.sku === product.sku
        );

        if (itemToRemove) {
          // Tính số tiền cần giảm từ subtotal
          const itemTotal =
            (itemToRemove.price || 0) * (itemToRemove.quantity || 0);

          // Tính lại subtotal (tổng tiền hàng)
          const newSubtotal = Math.max(0, (order.subtotal || 0) - itemTotal);

          // Tính lại totalAmount (tổng cộng sau khi trừ item)
          // totalAmount = subtotal + shippingFee - shippingDiscount - discount + vatAmount
          const shippingFee = order.shippingFee || 0;
          const shippingDiscount = order.shippingDiscount || 0;
          const discount = order.discount || 0;
          const vatRate = order.vatRate || 0;
          const vatAmount = Math.round((newSubtotal * vatRate) / 100);
          const newTotalAmount = Math.max(
            0,
            newSubtotal + shippingFee - shippingDiscount - discount + vatAmount
          );

          // Sử dụng $pull để xóa item khỏi mảng items
          const updatedOrder = await Order.findOneAndUpdate(
            { OrderID: order.OrderID },
            {
              $pull: { items: { sku: productSku } },
              $set: {
                subtotal: newSubtotal,
                totalAmount: newTotalAmount,
                vatAmount: vatAmount,
                updatedAt: new Date(),
              },
            },
            { new: true }
          );

          if (updatedOrder) {
            // Tạo thông báo cho user về việc sản phẩm bị xóa khỏi đơn hàng
            try {
              if (notificationsCollection) {
                await notificationsCollection.insertOne({
                  type: "order",
                  customerId: order.CustomerID,
                  orderId: order.OrderID,
                  orderTotal: newTotalAmount,
                  title: "Sản phẩm đã được xóa khỏi đơn hàng",
                  message: `Sản phẩm "${
                    itemToRemove.productName ||
                    itemToRemove.product_name ||
                    itemToRemove.name ||
                    "N/A"
                  }" đã được xóa khỏi đơn hàng #${
                    order.OrderID
                  } do hết hàng. Tổng tiền đơn hàng đã được cập nhật từ ${order.totalAmount.toLocaleString(
                    "vi-VN"
                  )}₫ xuống ${newTotalAmount.toLocaleString("vi-VN")}₫.`,
                  status: "active",
                  read: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                // console.log(`✅ [Notifications] Created product removal notification for order ${order.OrderID}`);
              }
            } catch (notifError) {
              console.error(
                `❌ [Notifications] Error creating product removal notification for order ${order.OrderID}:`,
                notifError
              );
            }

            // console.log(`✅ [Orders] Removed product ${productSku} from order ${order.OrderID}. Old total: ${order.totalAmount}, New total: ${newTotalAmount} (reduced by ${itemTotal})`);
          } else {
            console.error(
              `❌ [Orders] Failed to update order ${order.OrderID} after removing product ${productSku}`
            );
          }
        } else {
          console.warn(
            `⚠️ [Orders] Product ${productSku} not found in order ${order.OrderID} items`
          );
        }
      }
    }

    // 2. Xóa sản phẩm khỏi tất cả giỏ hàng và cập nhật itemCount, totalQuantity
    // Logic này LUÔN chạy khi xóa sản phẩm, không phụ thuộc vào đơn hàng pending
    try {
      // Tìm tất cả giỏ hàng chứa sản phẩm này
      const cartsWithProduct = await Cart.find({ "items.sku": productSku });

      if (cartsWithProduct.length > 0) {
        console.log(
          `📦 [Cart] Found ${cartsWithProduct.length} carts containing product ${productSku}`
        );

        for (const cart of cartsWithProduct) {
          // Tìm item cần xóa để lấy quantity
          const itemToRemove = cart.items.find(
            (item) => item.sku === productSku
          );

          if (itemToRemove) {
            // Xóa item khỏi mảng
            cart.items = cart.items.filter((item) => item.sku !== productSku);

            // Tính lại itemCount và totalQuantity
            cart.itemCount = cart.items.length;
            cart.totalQuantity = cart.items.reduce(
              (sum, item) => sum + (item.quantity || 0),
              0
            );
            cart.updatedAt = new Date();

            // Lưu lại
            await cart.save();

            console.log(
              `✅ [Cart] Removed product ${productSku} from cart ${cart.CustomerID}. New itemCount: ${cart.itemCount}, totalQuantity: ${cart.totalQuantity}`
            );
          }
        }

        console.log(
          `✅ [Cart] Removed product ${productSku} from ${cartsWithProduct.length} carts`
        );
      } else {
        console.log(
          `ℹ️ [Cart] No carts found containing product ${productSku}`
        );
      }
    } catch (cartError) {
      console.error(`❌ [Cart] Error removing product from carts:`, cartError);
    }

    // 3. Đánh dấu sản phẩm là inactive
    const deletedProduct = await Product.findOneAndUpdate(
      { _id: product._id },
      { status: "Inactive", updatedAt: new Date() },
      { new: true }
    );

    if (!deletedProduct) {
      console.log(`❌ [Products API] Failed to delete product: ${id}`);
      return res.status(500).json({
        success: false,
        message: "Không thể xóa sản phẩm",
        error: "Failed to update product status",
      });
    }

    console.log(
      `✅ [Products API] Product deleted successfully: ${
        product.product_name || product.productName
      }`
    );

    const successMessage =
      pendingOrders.length > 0
        ? `Đã xóa sản phẩm khỏi ${pendingOrders.length} đơn hàng đang xử lý và cập nhật tổng tiền tương ứng.`
        : "Đã xóa sản phẩm thành công";

    res.json({
      success: true,
      message: successMessage,
      data: deletedProduct,
      deletedProduct: {
        _id: deletedProduct._id,
        product_name: deletedProduct.product_name || deletedProduct.productName,
        sku: deletedProduct.sku,
      },
      affectedOrders:
        pendingOrders.length > 0
          ? pendingOrders.map((o) => ({
              OrderID: o.OrderID,
              action: "removed_product",
            }))
          : [],
    });
  } catch (error) {
    console.error("❌ [Products API] Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa sản phẩm",
      error: error.message,
    });
  }
});

module.exports = router;
