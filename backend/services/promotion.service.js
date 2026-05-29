const { Promotion, PromotionTarget, Product } = require("../db");

/** 
 * Kiểm tra xem một product có match với promotion target hay không 
 * @param {Object} product - Product object từ MongoDB hoặc cart item 
 * @param {Object} promotionTarget - PromotionTarget object 
 * @returns {boolean} - true nếu product match với target 
 */ 
function isProductMatchTarget(product, promotionTarget) {
  const { target_type, target_ref } = promotionTarget;

 console.log(` [PromotionTarget] Checking match:`, { 
    target_type,
    target_ref,
    product_category: product.category,
    product_subcategory: product.subcategory,
    product_brand: product.brand,
    product_sku: product.sku,
  });

  switch (target_type) {
    case "Category":
 // So sánh với category của product 
      const categoryMatch = target_ref.includes(product.category);
 console.log(` Category match:`, categoryMatch); 
      return categoryMatch;

    case "Subcategory":
 // So sánh với subcategory của product 
      const subcategoryMatch = target_ref.includes(product.subcategory);
 console.log(` Subcategory match:`, subcategoryMatch); 
      return subcategoryMatch;

    case "Brand":
 // So sánh với brand của product 
      const brandMatch = target_ref.includes(product.brand);
 console.log(` Brand match:`, brandMatch); 
      return brandMatch;

    case "Product":
 // So sánh với SKU của product 
      const productMatch = target_ref.includes(product.sku);
 console.log(` Product (SKU) match:`, productMatch); 
      return productMatch;

    default:
 console.log(` Unknown target type`); 
      return false;
  }
}

/** 
 * Kiểm tra xem promotion có áp dụng được cho danh sách sản phẩm trong giỏ hàng hay không 
 * @param {string} promotionId - ID của promotion (code hoặc _id) 
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng [{sku, category, subcategory, brand, ...}] 
 * @returns {Promise<Object>} - { isApplicable: boolean, matchedProducts: [], message: string } 
 */ 
async function checkPromotionApplicability(promotionId, cartItems) {
  try {
 // Tìm promotion theo code hoặc promotion_id 
    const promotion = await Promotion.findOne({
      $or: [{ code: promotionId }, { promotion_id: promotionId }],
    });

    if (!promotion) {
      return {
        isApplicable: false,
        matchedProducts: [],
        message: "Promotion not found",
      };
    }

 // Kiểm tra xem promotion có target không (dùng promotion_id để match với target) 
    const promotionTarget = await PromotionTarget.findOne({
      promotion_id: promotion.promotion_id,
    });

 // Nếu không có target, áp dụng cho tất cả sản phẩm 
    if (!promotionTarget) {
      return {
        isApplicable: true,
        matchedProducts: cartItems.map((item) => item.sku),
        message: "Promotion applies to all products",
        targetType: "All",
      };
    }

 // Kiểm tra từng sản phẩm trong giỏ hàng 
    const matchedProducts = [];
 console.log(`\n [Promotion] Checking ${cartItems.length} items in cart`); 

    for (const cartItem of cartItems) {
 console.log(`\n Checking item:`, cartItem); 

 // Nếu cartItem chưa có đầy đủ thông tin, query từ database 
      let product = cartItem;
      if (!cartItem.category || !cartItem.subcategory) {
 console.log( 
          `    ⚠️ Missing category/subcategory, querying DB for SKU: ${cartItem.sku}`
        );
        product = await Product.findOne({ sku: cartItem.sku });
        if (!product) {
 // console.log(` Product not found in DB, skipping`); 
          continue;
        }
 console.log(` Found in DB:`, product); 
      } else {
 console.log(` Cart item has complete info, using it directly`); 
      }

 // Kiểm tra xem product có match với target không 
      const isMatch = isProductMatchTarget(product, promotionTarget);
 console.log(` ${isMatch ? "" : ""} Match result:`, isMatch); 

      if (isMatch) {
        matchedProducts.push(product.sku);
      }
    }

    return {
      isApplicable: matchedProducts.length > 0,
      matchedProducts,
      message:
        matchedProducts.length > 0
          ? `Promotion applies to ${matchedProducts.length} products`
          : "No products match this promotion",
      targetType: promotionTarget.target_type,
      targetRef: promotionTarget.target_ref,
    };
  } catch (error) {
 console.error(" [PromotionService] Error checking applicability:", error); 
    return {
      isApplicable: false,
      matchedProducts: [],
      message: "Error checking promotion: " + error.message,
    };
  }
}

/** 
 * Lấy tất cả promotion có thể áp dụng cho giỏ hàng 
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng 
 * @param {number} cartAmount - Tổng giá trị giỏ hàng (để check min_order_value) 
 * @returns {Promise<Array>} - Danh sách promotions có thể áp dụng 
 */ 
async function getApplicablePromotions(cartItems, cartAmount = 0) {
  try {
 // Lấy tất cả promotion đang active 
    const now = new Date();
    const activePromotions = await Promotion.find({
      start_date: { $lte: now },
      end_date: { $gte: now },
      is_active: true,
    });

    const applicablePromotions = [];

    for (const promotion of activePromotions) {
 // Kiểm tra min_order_value 
      if (promotion.min_order_value && cartAmount < promotion.min_order_value) {
        continue;
      }

 // Kiểm tra applicability với cart items 
      const applicability = await checkPromotionApplicability(
        promotion.code,
        cartItems
      );

      if (applicability.isApplicable) {
        applicablePromotions.push({
          ...promotion.toObject(),
          matchedProducts: applicability.matchedProducts,
          targetType: applicability.targetType,
        });
      }
    }

    return applicablePromotions;
  } catch (error) {
 console.error( 
      "❌ [PromotionService] Error getting applicable promotions:",
      error
    );
    return [];
  }
}

/** 
 * Validate promotion code với giỏ hàng 
 * @param {string} code - Mã promotion 
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng 
 * @param {number} cartAmount - Tổng giá trị giỏ hàng 
 * @returns {Promise<Object>} - { isValid: boolean, promotion: Object, message: string } 
 */ 
async function validatePromotionCode(code, cartItems, cartAmount) {
  try {
    const promotion = await Promotion.findOne({ code: code.trim() });

    if (!promotion) {
      return { isValid: false, message: "Mã khuyến mãi không tồn tại" };
    }

 // Kiểm tra thời gian 
    const now = new Date();
    if (now < promotion.start_date) {
      return { isValid: false, message: "Mã khuyến mãi chưa có hiệu lực" };
    }
    if (now > promotion.end_date) {
      return { isValid: false, message: "Mã khuyến mãi đã hết hạn" };
    }

 // Kiểm tra is_active 
    if (!promotion.is_active) {
      return { isValid: false, message: "Mã khuyến mãi không còn hoạt động" };
    }

 // Kiểm tra min_order_value 
    if (promotion.min_order_value && cartAmount < promotion.min_order_value) {
      return {
        isValid: false,
        message: `Đơn hàng tối thiểu ${promotion.min_order_value.toLocaleString(
          "vi-VN"
        )}₫`,
      };
    }

 // Kiểm tra applicability 
    const applicability = await checkPromotionApplicability(code, cartItems);

    if (!applicability.isApplicable) {
      return {
        isValid: false,
        message: "Mã khuyến mãi không áp dụng cho sản phẩm trong giỏ hàng",
      };
    }

    return {
      isValid: true,
      promotion: {
        ...promotion.toObject(),
        matchedProducts: applicability.matchedProducts,
        targetType: applicability.targetType,
      },
      message: "Mã khuyến mãi hợp lệ",
    };
  } catch (error) {
 console.error(" [PromotionService] Error validating code:", error); 
    return { isValid: false, message: "Lỗi kiểm tra mã khuyến mãi" };
  }
}

module.exports = {
  isProductMatchTarget,
  checkPromotionApplicability,
  getApplicablePromotions,
  validatePromotionCode,
};
