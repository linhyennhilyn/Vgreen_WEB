const express = require("express");
const router = express.Router();
const { Review, Product, Order } = require("../db");
const {
  updateProductRating,
  updateAllProductRatings,
} = require("../services/rating.service");

// GET all reviews (phải đặt trước route /:sku)
router.get("/", async (req, res) => {
  try {
    // console.log(" [Reviews API] Fetching all reviews...");
    const allReviews = await Review.find();
    // console.log(` [Reviews API] Found ${allReviews.length} review documents`);

    res.json({
      success: true,
      data: allReviews,
      count: allReviews.length,
    });
  } catch (error) {
    // console.error(" [Reviews API] Error fetching all reviews:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách đánh giá",
      error: error.message,
    });
  }
});

// PUT - Cập nhật tất cả ratings cho tất cả sản phẩm (phải đặt trước route /:sku)
router.put("/update-all-ratings", async (req, res) => {
  try {
    // console.log(
    // " [Reviews API] Bắt đầu cập nhật rating cho tất cả sản phẩm..."
    // );

    const result = await updateAllProductRatings();

    res.json({
      success: true,
      message: "Đã cập nhật rating cho tất cả sản phẩm",
      data: result,
    });
  } catch (error) {
    // console.error(" [Reviews API] Error updating all ratings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật ratings",
      error: error.message,
    });
  }
});

// GET reviews by SKU
router.get("/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    // console.log(` [Reviews API] Fetching reviews for SKU: ${sku}`);

    // Get product to check purchase_count
    const product = await Product.findOne({ sku });
    const purchaseCount = product ? product.purchase_count || 0 : 0;

    // If product has no purchases, return empty reviews
    if (purchaseCount === 0) {
      return res.json({
        success: true,
        data: { sku, reviews: [] },
        count: 0,
      });
    }

    const reviewData = await Review.findOne({ sku });

    if (!reviewData || !reviewData.reviews || reviewData.reviews.length === 0) {
      // console.log(`ℹ [Reviews API] No reviews found for SKU: ${sku}`);
      return res.json({
        success: true,
        data: { sku, reviews: [] },
        count: 0,
      });
    }

    // Limit reviews to purchase_count (ensure review count <= purchase count)
    let validReviews = reviewData.reviews;
    if (validReviews.length > purchaseCount) {
      // Sort by time (newest first) and keep only the first purchaseCount reviews
      validReviews = validReviews
        .sort((a, b) => {
          const timeA = a.time ? new Date(a.time).getTime() : 0;
          const timeB = b.time ? new Date(b.time).getTime() : 0;
          return timeB - timeA; // Newest first
        })
        .slice(0, purchaseCount);

      console.log(
        `⚠️  [Reviews API] SKU ${sku}: Found ${reviewData.reviews.length} reviews but purchase_count = ${purchaseCount}, returning only ${purchaseCount} newest reviews`
      );
    }

    // console
    // .log
    // ` [Reviews API] Found ${validReviews.length} valid reviews for SKU: ${sku}`
    // ();

    res.json({
      success: true,
      data: {
        sku: reviewData.sku,
        reviews: validReviews,
      },
      count: validReviews.length,
    });
  } catch (error) {
    // console.error(" [Reviews API] Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy đánh giá",
      error: error.message,
    });
  }
});

// POST - Thêm review mới và tự động cập nhật rating
router.post("/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const { fullname, customer_id, content, rating, images, time, order_id } =
      req.body;

    // console.log(` [Reviews API] Adding review for SKU: ${sku}`);
    // console.log(
    // ` [Reviews API] Full request body (raw):`,
    // JSON.stringify(req.body)
    // );
    // console.log(` [Reviews API] Extracted fields:`, {
    // fullname: fullname
    // ? `"${fullname}" (type: ${typeof fullname})`
    // : "MISSING",
    // customer_id: customer_id
    // ? `"${customer_id}" (type: ${typeof customer_id})`
    // : "MISSING",
    // content:
    // content !== undefined
    // ? content
    // ? `"${content.substring(0, 50)}..." (type: ${typeof content})`
    // : '"" (empty string)'
    // : "UNDEFINED",
    // rating:
    // rating !== undefined ? `${rating} (type: ${typeof rating})` : "MISSING",
    // images_count: images ? images.length : 0,
    // time,
    // order_id: order_id
    // ? `"${order_id}" (type: ${typeof order_id})`
    // : "MISSING",
    // });

    // Validate input - content không bắt buộc
    // Đảm bảo các giá trị được trim và kiểm tra đúng kiểu
    const trimmedFullname = fullname ? String(fullname).trim() : "";
    const trimmedCustomerId = customer_id ? String(customer_id).trim() : "";
    const trimmedOrderId = order_id ? String(order_id).trim() : "";
    const numRating =
      rating !== undefined && rating !== null ? Number(rating) : null;
    const isValidRating =
      numRating !== null &&
      !isNaN(numRating) &&
      numRating >= 1 &&
      numRating <= 5;

    if (!trimmedFullname || !trimmedCustomerId || !isValidRating) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (fullname, customer_id, rating)",
        missing_fields: {
          fullname: !trimmedFullname,
          customer_id: !trimmedCustomerId,
          rating: !isValidRating,
        },
      });
    }

    // Content có thể là empty string, không bắt buộc
    const reviewContent = content ? String(content).trim() : "";

    // order_id không bắt buộc (có thể để trống cho các reviews từ nguồn khác)
    // Nếu không có order_id, dùng empty string
    const finalOrderId = trimmedOrderId || "";

    // Thêm review mới
    const newReview = {
      fullname: trimmedFullname,
      customer_id: trimmedCustomerId,
      content: reviewContent,
      rating: numRating,
      images: Array.isArray(images)
        ? images.filter((img) => img !== null && img !== undefined)
        : [], // Array of image URLs or base64 strings
      time: time ? new Date(time) : new Date(),
      order_id: finalOrderId, // Có thể là empty string nếu không có order_id
    };

    // console.log(` [Reviews API] New review object:`, {
    // fullname: newReview.fullname,
    // customer_id: newReview.customer_id,
    // rating: newReview.rating,
    // order_id: newReview.order_id || "MISSING!",
    // order_id_type: typeof newReview.order_id,
    // order_id_length: newReview.order_id ? newReview.order_id.length : 0,
    // });

    // Thêm review mới bằng $push
    // Sử dụng findOneAndUpdate với runValidators: false để tránh validate các reviews cũ
    // (Review mới đã được validate ở trên: trimmedOrderId, trimmedFullname, trimmedCustomerId, isValidRating)
    // Lưu ý: Các reviews cũ không có order_id vẫn còn trong database nhưng không ảnh hưởng đến việc thêm review mới
    const reviewData = await Review.findOneAndUpdate(
      { sku },
      {
        $push: { reviews: newReview },
      },
      {
        upsert: true,
        new: true,
        runValidators: false, // Tắt validation để tránh lỗi với reviews cũ (review mới đã được validate ở trên)
      }
    );

    // console.log(` [Reviews API] Saved review to database for SKU: ${sku}`);

    // Tự động cập nhật rating trong products
    try {
      await updateProductRating(sku);
      // console.log(` [Reviews API] Updated product rating for SKU: ${sku}`);
    } catch (ratingError) {
      // console.error(
      // ` [Reviews API] Không thể cập nhật rating cho ${sku}:`,
      // ratingError.message
      // );
      // Không fail request nếu chỉ lỗi cập nhật rating
    }

    // console.log(` [Reviews API] Added review for SKU: ${sku}`);

    // Sau khi review thành công, kiểm tra xem tất cả sản phẩm trong order đã được review chưa
    // Nếu có, chuyển order status sang completed (chỉ khi có order_id)
    if (finalOrderId && finalOrderId.trim() !== "") {
      try {
        await checkAndCompleteOrder(finalOrderId);
      } catch (orderError) {
        // console.error(
        // ` [Reviews API] Không thể kiểm tra order completion:`,
        // orderError.message
        // );
        // Không fail request nếu chỉ lỗi check order
      }
    }

    res.json({
      success: true,
      message: "Đã thêm đánh giá thành công",
      data: reviewData,
      count: reviewData.reviews.length,
    });
  } catch (error) {
    // console.error(" [Reviews API] Error adding review:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm đánh giá",
      error: error.message,
    });
  }
});

// Helper function: Kiểm tra và chuyển order sang completed nếu tất cả sản phẩm đã được review
async function checkAndCompleteOrder(orderId) {
  try {
    // Tìm order
    const order = await Order.findOne({ OrderID: orderId });
    if (!order) {
      // console.log(` [Reviews API] Order ${orderId} not found`);
      return;
    }

    // Chỉ xử lý các order có status delivered hoặc completed
    if (order.status === "completed" || order.status === "cancelled") {
      return; // Đã completed hoặc cancelled rồi
    }

    if (order.status !== "delivered") {
      // console.log(
      // ` [Reviews API] Order ${orderId} is not delivered yet (status: ${order.status})`
      // );
      return; // Chỉ xử lý delivered orders
    }

    // Lấy danh sách SKU trong order
    const orderSKUs = order.items.map((item) => item.sku);

    // Đếm số lượng review cho order này
    let reviewedCount = 0;
    for (const sku of orderSKUs) {
      const productReviews = await Review.findOne({ sku });
      if (productReviews && productReviews.reviews) {
        const hasReviewForOrder = productReviews.reviews.some(
          (review) => review.order_id === orderId
        );
        if (hasReviewForOrder) {
          reviewedCount++;
        }
      }
    }

    // console.log(
    // ` [Reviews API] Order ${orderId}: ${reviewedCount}/${orderSKUs.length} products reviewed`
    // );

    // Nếu tất cả sản phẩm đã được review, chuyển order sang completed
    if (reviewedCount === orderSKUs.length && orderSKUs.length > 0) {
      // console.log(
      // ` [Reviews API] All products reviewed for order ${orderId}, updating to completed`
      // );

      // Initialize routes if it doesn't exist
      const routes = order.routes || new Map();
      routes.set("completed", new Date());

      const updatedOrder = await Order.findOneAndUpdate(
        { OrderID: orderId },
        { status: "completed", routes, updatedAt: new Date() },
        { new: true }
      );

      if (updatedOrder) {
        // Tăng purchase_count cho tất cả sản phẩm trong order
        await incrementProductPurchaseCount(order.items);
        // console.log(
        // ` [Reviews API] Order ${orderId} updated to completed and purchase_count incremented`
        // );
      }
    }
  } catch (error) {
    // console.error(
    // ` [Reviews API] Error checking order completion:`,
    // error.message
    // );
    throw error;
  }
}

// Helper function: Tăng purchase_count cho các sản phẩm trong order (1 lượt per order, not per quantity)
async function incrementProductPurchaseCount(items) {
  try {
    // Group items by SKU to ensure each product only gets +1 per order
    const uniqueSKUs = new Set();
    for (const item of items) {
      if (item.sku && !uniqueSKUs.has(item.sku)) {
        uniqueSKUs.add(item.sku);
        await Product.findOneAndUpdate(
          { sku: item.sku },
          { $inc: { purchase_count: 1 } },
          { new: true }
        );
        // console.log(
        // ` [Reviews API] Incremented purchase_count for SKU: ${item.sku} by 1`
        // );
      }
    }
  } catch (error) {
    // console.error(
    // ` [Reviews API] Error incrementing purchase_count:`,
    // error.message
    // );
    throw error;
  }
}

// PUT - Like/Unlike a review
router.put("/:sku/like/:reviewIndex", async (req, res) => {
  try {
    const { sku, reviewIndex } = req.params;
    const { customer_id, action } = req.body; // action: 'like' or 'unlike'

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu customer_id",
      });
    }

    // Kiểm tra review có tồn tại không
    const reviewData = await Review.findOne({ sku });
    if (
      !reviewData ||
      !reviewData.reviews ||
      !reviewData.reviews[reviewIndex]
    ) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    const review = reviewData.reviews[reviewIndex];
    const likes = review.likes || [];
    const customerIdStr = String(customer_id).trim();

    // Tính toán likes mới
    let newLikes = [...likes];
    if (action === "like") {
      // Thêm like nếu chưa có
      if (!newLikes.includes(customerIdStr)) {
        newLikes.push(customerIdStr);
      }
    } else if (action === "unlike") {
      // Xóa like nếu có
      newLikes = newLikes.filter((id) => id !== customerIdStr);
    } else {
      return res.status(400).json({
        success: false,
        message: "Action phải là 'like' hoặc 'unlike'",
      });
    }

    // Cập nhật review - sử dụng updateOne với bypassDocumentValidation để tránh validate lại
    // Update chỉ field likes của review cụ thể
    const updatePath = `reviews.${reviewIndex}.likes`;

    // Sử dụng collection.updateOne trực tiếp để bypass validation
    const ReviewCollection = Review.collection;
    const updateResult = await ReviewCollection.updateOne(
      {
        sku: sku,
        [`reviews.${reviewIndex}`]: { $exists: true },
      },
      {
        $set: { [updatePath]: newLikes },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    res.json({
      success: true,
      message: action === "like" ? "Đã thích review" : "Đã bỏ thích review",
      data: {
        reviewIndex: parseInt(reviewIndex),
        likes: newLikes,
        likesCount: newLikes.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật like",
      error: error.message,
    });
  }
});

// POST - Reply to a review
router.post("/:sku/reply/:reviewIndex", async (req, res) => {
  try {
    const { sku, reviewIndex } = req.params;
    const { fullname, customer_id, content } = req.body;

    if (!fullname || !customer_id || !content) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (fullname, customer_id, content)",
      });
    }

    // Kiểm tra review có tồn tại không
    const reviewData = await Review.findOne({ sku });
    if (
      !reviewData ||
      !reviewData.reviews ||
      !reviewData.reviews[reviewIndex]
    ) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    const newReply = {
      fullname: String(fullname).trim(),
      customer_id: String(customer_id).trim(),
      content: String(content).trim(),
      time: new Date(),
      likes: [],
    };

    // Thêm reply vào review - sử dụng collection.updateOne trực tiếp để bypass validation
    const updatePath = `reviews.${reviewIndex}.replies`;
    const ReviewCollection = Review.collection;
    const updateResult = await ReviewCollection.updateOne(
      {
        sku: sku,
        [`reviews.${reviewIndex}`]: { $exists: true },
      },
      {
        $push: { [updatePath]: newReply },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    // Lấy lại review data để lấy số lượng replies
    const updatedReviewData = await Review.findOne({ sku });
    const updatedReview = updatedReviewData?.reviews?.[reviewIndex];
    const repliesCount = updatedReview?.replies
      ? updatedReview.replies.length
      : 1;

    res.json({
      success: true,
      message: "Đã thêm trả lời thành công",
      data: {
        reviewIndex: parseInt(reviewIndex),
        reply: newReply,
        repliesCount: repliesCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm trả lời",
      error: error.message,
    });
  }
});

// PUT - Like/Unlike a reply
router.put("/:sku/reply/:reviewIndex/:replyIndex/like", async (req, res) => {
  try {
    const { sku, reviewIndex, replyIndex } = req.params;
    const { customer_id, action } = req.body; // action: 'like' or 'unlike'

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu customer_id",
      });
    }

    // Kiểm tra reply có tồn tại không
    const reviewData = await Review.findOne({ sku });
    if (
      !reviewData ||
      !reviewData.reviews ||
      !reviewData.reviews[reviewIndex] ||
      !reviewData.reviews[reviewIndex].replies ||
      !reviewData.reviews[reviewIndex].replies[replyIndex]
    ) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy reply",
      });
    }

    const reply = reviewData.reviews[reviewIndex].replies[replyIndex];
    const likes = reply.likes || [];
    const customerIdStr = String(customer_id).trim();

    // Tính toán likes mới
    let newLikes = [...likes];
    if (action === "like") {
      if (!newLikes.includes(customerIdStr)) {
        newLikes.push(customerIdStr);
      }
    } else if (action === "unlike") {
      newLikes = newLikes.filter((id) => id !== customerIdStr);
    } else {
      return res.status(400).json({
        success: false,
        message: "Action phải là 'like' hoặc 'unlike'",
      });
    }

    // Cập nhật likes của reply - sử dụng collection.updateOne trực tiếp để bypass validation
    const updatePath = `reviews.${reviewIndex}.replies.${replyIndex}.likes`;
    const ReviewCollection = Review.collection;
    const updateResult = await ReviewCollection.updateOne(
      {
        sku: sku,
        [`reviews.${reviewIndex}`]: { $exists: true },
        [`reviews.${reviewIndex}.replies.${replyIndex}`]: { $exists: true },
      },
      {
        $set: { [updatePath]: newLikes },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy reply",
      });
    }

    res.json({
      success: true,
      message: action === "like" ? "Đã thích reply" : "Đã bỏ thích reply",
      data: {
        reviewIndex: parseInt(reviewIndex),
        replyIndex: parseInt(replyIndex),
        likes: newLikes,
        likesCount: newLikes.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật like cho reply",
      error: error.message,
    });
  }
});

module.exports = router;
