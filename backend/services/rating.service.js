const { Product, Review } = require("../db");

/**
 * Tính toán rating trung bình từ reviews của một sản phẩm
 * Rating được tính từ trung bình tất cả reviews trong collection reviews theo SKU
 * Nếu sản phẩm chưa có reviews thì rating = 0
 * @param {string} sku - SKU của sản phẩm
 * @returns {Promise<{averageRating: number, reviewCount: number}>}
 */
async function calculateProductRating(sku) {
  try {
    // Tìm reviews theo SKU trong collection reviews
    const reviewData = await Review.findOne({ sku });

    // Nếu không có review document hoặc không có reviews array hoặc reviews rỗng
    if (
      !reviewData ||
      !reviewData.reviews ||
      !Array.isArray(reviewData.reviews) ||
      reviewData.reviews.length === 0
    ) {
      // console.log(
      //   `📊 [Rating Service] SKU ${sku}: Không có reviews, rating = 0`
      // );
      return {
        averageRating: 0,
        reviewCount: 0,
      };
    }

    // Lọc các reviews hợp lệ (có rating và rating trong khoảng 1-5)
    const validReviews = reviewData.reviews.filter((review) => {
      const rating = review.rating;
      // Chỉ tính reviews có rating hợp lệ (1-5)
      return (
        rating !== null &&
        rating !== undefined &&
        !isNaN(rating) &&
        rating >= 1 &&
        rating <= 5
      );
    });

    // Nếu không có reviews hợp lệ, trả về rating = 0
    if (validReviews.length === 0) {
      // console.log(
      //   `📊 [Rating Service] SKU ${sku}: Không có reviews hợp lệ (rating 1-5), rating = 0`
      // );
      return {
        averageRating: 0,
        reviewCount: 0,
      };
    }

    // Tính tổng rating từ tất cả reviews hợp lệ
    const totalRating = validReviews.reduce((sum, review) => {
      const rating = Number(review.rating) || 0;
      return sum + rating;
    }, 0);

    // Tính trung bình rating
    const averageRating = totalRating / validReviews.length;

    // Làm tròn đến 1 chữ số thập phân
    const roundedRating = Math.round(averageRating * 10) / 10;

    // console.log(
    //   `✅ [Rating Service] SKU ${sku}: Rating = ${roundedRating} (từ ${validReviews.length} reviews, tổng ${totalRating}/${validReviews.length})`
    // );

    return {
      averageRating: roundedRating,
      reviewCount: validReviews.length,
    };
  } catch (error) {
    console.error(`❌ [Rating Service] Lỗi tính rating cho SKU ${sku}:`, error);
    // Trả về rating = 0 nếu có lỗi
    return {
      averageRating: 0,
      reviewCount: 0,
    };
  }
}

/**
 * Cập nhật rating cho một sản phẩm
 * Rating được tính từ trung bình reviews trong collection reviews theo SKU
 * Nếu sản phẩm chưa có reviews thì rating = 0
 * @param {string} sku - SKU của sản phẩm
 * @returns {Promise<boolean>}
 */
async function updateProductRating(sku) {
  try {
    const product = await Product.findOne({ sku });
    if (!product) {
      // console.log(
      //   `⚠️  [Rating Service] Không tìm thấy product với SKU: ${sku}`
      // );
      return false;
    }

    // Tính rating từ reviews collection (không phụ thuộc vào purchase_count)
    const { averageRating, reviewCount } = await calculateProductRating(sku);

    // Cập nhật rating trong product
    product.rating = averageRating;

    await product.save();

    // console.log(
    //   `✅ [Rating Service] Đã cập nhật rating cho SKU ${sku}: ${averageRating} (từ ${reviewCount} reviews)`
    // );

    return true;
  } catch (error) {
    console.error(
      `❌ [Rating Service] Lỗi cập nhật rating cho SKU ${sku}:`,
      error
    );
    // Nếu có lỗi, vẫn cố gắng set rating = 0
    try {
      const product = await Product.findOne({ sku });
      if (product) {
        product.rating = 0;
        await product.save();
      }
    } catch (saveError) {
      console.error(
        `❌ [Rating Service] Không thể set rating = 0 cho SKU ${sku}:`,
        saveError
      );
    }
    throw error;
  }
}

/**
 * Cập nhật rating cho tất cả sản phẩm
 * @returns {Promise<{success: number, failed: number}>}
 */
async function updateAllProductRatings() {
  try {
    // console.log(
    //   "[Rating Service] Bắt đầu cập nhật rating cho tất cả sản phẩm..."
    // );

    const products = await Product.find({ status: "Active" });
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const updated = await updateProductRating(product.sku);
        if (updated) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(
          `[Rating Service] Lỗi khi cập nhật rating cho ${product.sku}:`,
          error.message
        );
        failed++;
      }
    }

    // console.log(
    //   `[Rating Service] Hoàn tất! Đã cập nhật ${success} sản phẩm, ${failed} thất bại`
    // );

    return {
      success,
      failed,
      total: products.length,
    };
  } catch (error) {
    console.error("[Rating Service] Lỗi khi cập nhật tất cả ratings:", error);
    throw error;
  }
}

module.exports = {
  calculateProductRating,
  updateProductRating,
  updateAllProductRatings,
};
