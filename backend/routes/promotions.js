const express = require("express");
const router = express.Router();
const { Promotion, PromotionUsage, PromotionTarget, User } = require("../db");
const promotionService = require("../services/promotion.service");
const mongoose = require("mongoose");

/**
 * Helper function: Create promotion notification for all users
 */
async function createPromotionNotificationForAllUsers(promotion) {
  try {
    // Get notifications collection from mongoose connection
    const db = mongoose.connection.db;
    if (!db) {
      // console.warn("⚠️ [Notifications] MongoDB connection not available");
      return;
    }

    const notificationsCollection = db.collection("notifications");
    const usersCollection = db.collection("users");

    if (!notificationsCollection || !usersCollection) {
      // console.warn("⚠️ [Notifications] Collections not available");
      return;
    }

    // Get all users (only CustomerID is needed)
    const users = await usersCollection
      .find({}, { projection: { CustomerID: 1 } })
      .toArray();

    if (users.length === 0) {
      // console.log(
      //   "⚠️ [Notifications] No users found, skipping promotion notification"
      // );
      return;
    }

    // console.log(
    //   `📢 [Notifications] Creating promotion notification for ${users.length} users...`
    // );

    // Format promotion details for message
    const discountText =
      promotion.discount_type === "percent"
        ? `${promotion.discount_value}%`
        : `${promotion.discount_value.toLocaleString("vi-VN")}₫`;

    const minOrderText =
      promotion.min_order_value > 0
        ? ` (Áp dụng cho đơn hàng từ ${promotion.min_order_value.toLocaleString(
            "vi-VN"
          )}₫)`
        : "";

    const endDateText = promotion.end_date
      ? new Date(promotion.end_date).toLocaleDateString("vi-VN")
      : "";

    const title = "🎉 Khuyến mãi mới từ VGreen!";
    const message = `Mã khuyến mãi "${promotion.code}" - ${
      promotion.name
    }: Giảm ${discountText}${minOrderText}${
      endDateText ? `. Hết hạn: ${endDateText}` : ""
    }. Nhanh tay sử dụng ngay! Mã: ${promotion.code}`;

    // Create notifications for all users
    const notifications = users.map((user) => ({
      type: "promotion",
      customerId: user.CustomerID,
      promotionId: promotion.promotion_id || promotion._id?.toString() || "",
      promotionCode: promotion.code || "",
      title: title,
      message: message,
      status: "active",
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert all notifications in batch
    if (notifications.length > 0) {
      await notificationsCollection.insertMany(notifications);
      // console.log(
      //   `✅ [Notifications] Created promotion notification for ${notifications.length} users`
      // );
      // console.log(
      //   `📢 [Notifications] Promotion: ${promotion.code} - ${promotion.name}`
      // );
    }
  } catch (error) {
    console.error(
      "❌ [Notifications] Error creating promotion notifications for all users:",
      error
    );
    // Don't throw error, just log it so promotion creation doesn't fail
  }
}

// GET /api/promotions - Lấy tất cả promotions (không filter)
router.get("/", async (req, res) => {
  try {
    const allPromotions = await Promotion.find({}).lean();
    // console.log(
    //   `📋 [Promotions] GET /api/promotions - Total promotions in DB: ${allPromotions.length}`
    // );

    const promotionsData = allPromotions.map((p) => ({
      promotion_id: p.promotion_id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      type: p.type,
      scope: p.scope,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      max_discount_value: p.max_discount_value || 0,
      min_order_value: p.min_order_value || 0,
      usage_limit: p.usage_limit || 0,
      user_limit: p.user_limit || 1,
      is_first_order_only: p.is_first_order_only || false,
      start_date: p.start_date
        ? p.start_date instanceof Date
          ? p.start_date.toISOString()
          : p.start_date
        : new Date().toISOString(),
      end_date: p.end_date
        ? p.end_date instanceof Date
          ? p.end_date.toISOString()
          : p.end_date
        : new Date().toISOString(),
      status: p.status,
      created_by: p.created_by || "system",
      created_at: p.created_at
        ? p.created_at instanceof Date
          ? p.created_at.toISOString()
          : p.created_at
        : new Date().toISOString(),
      updated_at: p.updated_at
        ? p.updated_at instanceof Date
          ? p.updated_at.toISOString()
          : p.updated_at
        : new Date().toISOString(),
    }));

    // console.log(
    //   `📋 [Promotions] All promotion codes:`,
    //   promotionsData.map((p) => p.code)
    // );

    res.json({
      success: true,
      data: promotionsData,
      count: promotionsData.length,
    });
  } catch (error) {
    console.error("❌ [Promotions] Error fetching promotions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khuyến mãi",
      error: error.message,
    });
  }
});

// GET /api/promotions/active/stats - Thống kê số lượng promotions có hiệu lực
// PHẢI ĐẶT TRƯỚC /active để tránh conflict
router.get("/active/stats", async (req, res) => {
  try {
    const currentDate = new Date();

    // Hỗ trợ cả status "Active" và "đang diễn ra"
    const statusFilter = {
      $or: [{ status: "Active" }, { status: "đang diễn ra" }],
    };

    // Đếm tổng số promotions có hiệu lực
    const totalActive = await Promotion.countDocuments({
      ...statusFilter,
      type: { $ne: "Admin" },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      usage_limit: { $gt: 0 },
    });

    // Đếm promotions sắp hết hạn (trong 7 ngày)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(currentDate.getDate() + 7);
    const expiringSoon = await Promotion.countDocuments({
      ...statusFilter,
      type: { $ne: "Admin" },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate, $lte: sevenDaysFromNow },
      usage_limit: { $gt: 0 },
    });

    // Đếm promotions trong 2 tuần (cho frontend)
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(currentDate.getDate() + 14);
    const withinTwoWeeks = await Promotion.countDocuments({
      ...statusFilter,
      type: { $ne: "Admin" },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate, $lte: twoWeeksFromNow },
      usage_limit: { $gt: 0 },
    });

    // Lấy danh sách chi tiết
    const promotions = await Promotion.find({
      ...statusFilter,
      type: { $ne: "Admin" },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      usage_limit: { $gt: 0 },
    })
      .select(
        "code name end_date usage_limit scope discount_type discount_value"
      )
      .sort({ end_date: 1 });

    res.json({
      success: true,
      stats: {
        totalActive,
        expiringSoon,
        withinTwoWeeks,
      },
      promotions: promotions.map((p) => ({
        code: p.code,
        name: p.name,
        endDate: p.end_date,
        usageLimit: p.usage_limit,
        scope: p.scope,
        discountType: p.discount_type,
        discountValue: p.discount_value,
      })),
    });
  } catch (error) {
    console.error(
      " [Promotions] Error fetching active promotions stats:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Lỗi khi thống kê khuyến mãi",
      error: error.message,
    });
  }
});

// GET /api/promotions/active - Lấy các promotions có thể sử dụng (bao gồm cả "sắp diễn ra")
router.get("/active", async (req, res) => {
  try {
    const currentDate = new Date(); // Dùng thời gian hiện tại chính xác (bao gồm giờ, phút, giây)
    // console.log(
    //   `🔄 [Promotions] Fetching available promotions at ${currentDate.toISOString()}`
    // );

    // Lấy tất cả promotions từ MongoDB (không filter status)
    // Sau đó filter ở application level để lấy:
    // - Type: không phải Admin
    // - Chưa hết hạn (end_date >= currentDate)
    // - Status: không phải "Expired", "Inactive", "đã kết thúc"
    const allPromotions = await Promotion.find({
      type: { $ne: "Admin" }, // Loại bỏ promotions có type là Admin
    }).lean(); // Use lean() for better performance

    // console.log(
    //   `📋 [Promotions] Total promotions (non-Admin): ${allPromotions.length}`
    // );
    if (allPromotions.length > 0) {
      // console.log(
      //   `📋 [Promotions] All promotion codes (non-Admin):`,
      //   allPromotions.map((p) => ({
      //     code: p.code,
      //     name: p.name,
      //     status: p.status,
      //     type: p.type,
      //     end_date: p.end_date,
      //     start_date: p.start_date,
      //   }))
      // );
    }

    // Filter ở application level để xử lý dates chính xác hơn
    // Chỉ lấy promotions:
    // - Đã bắt đầu (start_date <= currentDate) - BẮT BUỘC phải có start_date hợp lệ
    // - Chưa hết hạn (end_date >= currentDate)
    // Tính currentTimestamp một lần để dùng lại
    const currentTimestamp = currentDate.getTime();

    const promotions = allPromotions.filter((p) => {
      // Kiểm tra start_date - BẮT BUỘC phải có start_date hợp lệ và đã bắt đầu
      const startDate = p.start_date ? new Date(p.start_date) : null;
      if (!startDate || isNaN(startDate.getTime())) {
        // console.log(
        //   `⏭️ [Promotions] Filtering out ${p.code} (invalid or missing start_date):`,
        //   {
        //     start_date: p.start_date,
        //   }
        // );
        return false; // Không có start_date hợp lệ thì loại bỏ
      }

      // So sánh timestamp để tránh vấn đề timezone
      // start_date từ MongoDB có thể là UTC (2026-01-01T00:00:00.000Z)
      // currentDate là local time, cần so sánh chính xác
      const startTimestamp = startDate.getTime();
      const hasStarted = startTimestamp <= currentTimestamp;

      if (!hasStarted) {
        // console.log(
        //   `⏭️ [Promotions] Filtering out ${p.code} (not started yet):`,
        //   {
        //     start_date: startDate.toISOString(),
        //     start_timestamp: startTimestamp,
        //     current_date: currentDate.toISOString(),
        //     current_timestamp: currentTimestamp,
        //     code: p.code,
        //     difference_ms: startTimestamp - currentTimestamp,
        //   }
        // );
        return false;
      }

      // Kiểm tra chưa hết hạn
      const endDate = p.end_date ? new Date(p.end_date) : null;
      if (!endDate || isNaN(endDate.getTime())) {
        console.warn(
          `⚠️ [Promotions] Promotion ${p.code} has invalid end_date:`,
          p.end_date
        );
        // Nếu không có end_date hợp lệ, vẫn giữ lại để người dùng thấy
        return true;
      }

      // So sánh timestamp để tránh vấn đề timezone
      const endTimestamp = endDate.getTime();
      const isNotExpired = endTimestamp >= currentTimestamp;

      // Chỉ loại bỏ nếu đã hết hạn hoàn toàn
      if (!isNotExpired) {
        // console.log(`⚠️ [Promotions] Filtering out ${p.code} (expired):`, {
        //   status: p.status,
        //   end_date: endDate.toISOString(),
        //   end_timestamp: endTimestamp,
        //   current_date: currentDate.toISOString(),
        //   current_timestamp: currentTimestamp,
        //   difference_ms: endTimestamp - currentTimestamp,
        // });
      }

      return isNotExpired;
    });

    // Sort theo ngày hết hạn (gần hết hạn lên đầu)
    promotions.sort((a, b) => {
      const endDateA = new Date(a.end_date);
      const endDateB = new Date(b.end_date);
      return endDateA.getTime() - endDateB.getTime();
    });

    // console.log(
    //   `✅ [Promotions] Found ${promotions.length} available promotions after filtering`
    // );
    // console.log(
    //   `📊 [Promotions] Filtered promotion codes:`,
    //   promotions.map((p) => p.code)
    // );

    if (promotions.length > 0) {
      // console.log(
      //   `📊 [Promotions] All promotions found:`,
      //   promotions.map((p) => ({
      //     id: p.promotion_id,
      //     code: p.code,
      //     name: p.name,
      //     status: p.status,
      //     start_date: p.start_date,
      //     end_date: p.end_date,
      //     usage_limit: p.usage_limit,
      //     type: p.type,
      //     min_order_value: p.min_order_value,
      //     isNotExpired: p.end_date && new Date(p.end_date) >= currentDate,
      //   }))
      // );
    } else {
      // Nếu không tìm thấy, kiểm tra xem có promotions nào trong database không
      const totalCount = await Promotion.countDocuments({});
      const nonAdminCount = await Promotion.countDocuments({
        type: { $ne: "Admin" },
      });
      // console.log(
      //   `⚠️ [Promotions] No available promotions found after filtering.`
      // );
      // console.log(`   - Total promotions in DB: ${totalCount}`);
      // console.log(`   - Non-Admin promotions: ${nonAdminCount}`);

      if (totalCount > 0) {
        // Lấy tất cả promotions để debug
        const allPromotionsDebug = await Promotion.find({}).lean();
        if (allPromotionsDebug.length > 0) {
          console.log(
            `📋 [Promotions] All promotions in DB (for debugging):`,
            allPromotionsDebug.map((p) => {
              const startDate = p.start_date ? new Date(p.start_date) : null;
              const endDate = p.end_date ? new Date(p.end_date) : null;
              const normalizedEndDate = endDate ? new Date(endDate) : null;
              if (normalizedEndDate) {
                normalizedEndDate.setHours(23, 59, 59, 999);
              }
              const isNotExpired =
                normalizedEndDate && normalizedEndDate >= currentDate;
              const isStarted = startDate && startDate <= currentDate;
              const invalidStatuses = [
                "Expired",
                "expired",
                "Inactive",
                "inactive",
                "đã kết thúc",
              ];
              const hasValidStatus = !invalidStatuses.includes(p.status);
              const isNotAdmin = p.type !== "Admin";
              const shouldBeIncluded =
                isNotExpired && hasValidStatus && isNotAdmin;

              return {
                id: p.promotion_id,
                code: p.code,
                name: p.name,
                status: p.status,
                type: p.type,
                start_date: p.start_date,
                end_date: p.end_date,
                usage_limit: p.usage_limit,
                isNotExpired: isNotExpired,
                isStarted: isStarted,
                isNotAdmin: isNotAdmin,
                hasValidStatus: hasValidStatus,
                shouldBeIncluded: shouldBeIncluded,
                reason: !isNotAdmin
                  ? "Admin type"
                  : !hasValidStatus
                  ? `Invalid status: ${p.status}`
                  : !isNotExpired
                  ? "Expired"
                  : "Should be included",
              };
            })
          );
        }
      } else {
        console.log(
          `⚠️ [Promotions] No promotions found in database. Please import promotions first.`
        );
      }
    }

    // Convert Mongoose documents to plain objects
    // Ensure dates are properly formatted as ISO strings for frontend
    const promotionsData = promotions.map((p) => ({
      promotion_id: p.promotion_id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      type: p.type,
      scope: p.scope,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      max_discount_value: p.max_discount_value || 0,
      min_order_value: p.min_order_value || 0,
      usage_limit: p.usage_limit || 0,
      user_limit: p.user_limit || 1,
      is_first_order_only: p.is_first_order_only || false,
      start_date: p.start_date
        ? p.start_date instanceof Date
          ? p.start_date.toISOString()
          : p.start_date
        : new Date().toISOString(),
      end_date: p.end_date
        ? p.end_date instanceof Date
          ? p.end_date.toISOString()
          : p.end_date
        : new Date().toISOString(),
      status: p.status,
      created_by: p.created_by || "system",
      created_at: p.created_at
        ? p.created_at instanceof Date
          ? p.created_at.toISOString()
          : p.created_at
        : new Date().toISOString(),
      updated_at: p.updated_at
        ? p.updated_at instanceof Date
          ? p.updated_at.toISOString()
          : p.updated_at
        : new Date().toISOString(),
    }));

    console.log(
      `📤 [Promotions] Sending ${promotionsData.length} promotions to frontend`
    );
    if (promotionsData.length > 0) {
      console.log(
        `📋 [Promotions] All promotions being sent:`,
        promotionsData.map((p) => ({
          code: p.code,
          name: p.name,
          status: p.status,
          start_date: p.start_date,
          end_date: p.end_date,
          usage_limit: p.usage_limit,
          min_order_value: p.min_order_value,
        }))
      );
    }

    res.json({
      success: true,
      data: promotionsData,
      count: promotionsData.length,
    });
  } catch (error) {
    console.error("❌ [Promotions] Error fetching active promotions:", error);
    console.error("❌ [Promotions] Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khuyến mãi đang hoạt động",
      error: error.message,
    });
  }
});

// GET /api/promotions/code/:code - Tìm promotion theo code
router.get("/code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const currentDate = new Date();

    // Hỗ trợ cả status "Active" và "đang diễn ra"
    const promotion = await Promotion.findOne({
      code: { $regex: new RegExp(`^${code}$`, "i") }, // Case-insensitive
      $or: [{ status: "Active" }, { status: "đang diễn ra" }],
      type: { $ne: "Admin" },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      usage_limit: { $gt: 0 },
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mã khuyến mãi hoặc mã đã hết hạn",
      });
    }

    res.json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    console.error(" [Promotions] Error finding promotion by code:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm mã khuyến mãi",
      error: error.message,
    });
  }
});

// GET /api/promotions/usage - Lấy số lượt sử dụng của tất cả promotions
// PHẢI ĐẶT TRƯỚC /:id để tránh conflict
router.get("/usage", async (req, res) => {
  try {
    // console.log("📊 [Promotions] GET /api/promotions/usage - Request received");

    // Lấy tất cả promotions
    const promotions = await Promotion.find({}).lean();
    // console.log(`📊 [Promotions] Found ${promotions.length} promotions`);

    // Lấy usage count cho mỗi promotion
    const usageMap = {};

    for (const promo of promotions) {
      // Try promotion_id first, then _id
      const promotionId =
        promo.promotion_id || (promo._id ? promo._id.toString() : null);
      if (promotionId) {
        // Count documents in promotion_usage where promotion_id matches
        const usageCount = await PromotionUsage.countDocuments({
          promotion_id: promotionId,
        });
        usageMap[promotionId] = usageCount;

        // Also map by _id if different from promotion_id
        if (promo._id && promo._id.toString() !== promotionId) {
          usageMap[promo._id.toString()] = usageCount;
        }
      }
    }

    // console.log(
    //   `✅ [Promotions] Usage map created with ${
    //     Object.keys(usageMap).length
    //   } entries`
    // );

    res.json({
      success: true,
      data: usageMap,
    });
  } catch (error) {
    console.error("❌ [Promotions] Error fetching all promotion usage:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy số lượt sử dụng khuyến mãi",
      error: error.message,
    });
  }
});

// GET /api/promotions/usage/:promotionId - Lấy số lượt sử dụng của một promotion
router.get("/usage/:promotionId", async (req, res) => {
  try {
    const { promotionId } = req.params;

    // Đếm số lượng records trong promotion_usage có promotion_id này
    const usageCount = await PromotionUsage.countDocuments({
      promotion_id: promotionId,
    });

    res.json({
      success: true,
      count: usageCount,
      promotion_id: promotionId,
    });
  } catch (error) {
    console.error("❌ [Promotions] Error fetching promotion usage:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy số lượt sử dụng khuyến mãi",
      error: error.message,
    });
  }
});

// GET /api/promotions/:id - Lấy promotion theo ID
// PHẢI ĐẶT SAU các route cụ thể như /usage
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const promotion = await Promotion.findOne({ promotion_id: id });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khuyến mãi",
      });
    }

    res.json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    console.error(" [Promotions] Error fetching promotion:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin khuyến mãi",
      error: error.message,
    });
  }
});

// POST /api/promotions - Tạo promotion mới (cho admin)
router.post("/", async (req, res) => {
  try {
    const promotionData = req.body;

    // Validate required fields
    if (
      !promotionData.code ||
      !promotionData.name ||
      !promotionData.discount_value
    ) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc: code, name, discount_value",
      });
    }

    // Check if code already exists
    const existingPromotion = await Promotion.findOne({
      code: promotionData.code,
    });
    if (existingPromotion) {
      return res.status(400).json({
        success: false,
        message: `Mã khuyến mãi "${promotionData.code}" đã tồn tại`,
      });
    }

    // Generate promotion_id if not provided (format: PROMOxxx, ví dụ: PROMO001, PROMO010)
    if (!promotionData.promotion_id) {
      // Find all promotions with format PROMOxxx
      const existingPromotions = await Promotion.find({
        promotion_id: { $regex: /^PROMO\d+$/ },
      });

      let maxNumber = 0;
      existingPromotions.forEach((promo) => {
        const match = promo.promotion_id.match(/^PROMO(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      // Next number is maxNumber + 1
      const nextNumber = maxNumber + 1;

      // Format: PROMO001, PROMO002, ..., PROMO009, PROMO010, etc. (luôn 3 chữ số)
      promotionData.promotion_id = `PROMO${nextNumber
        .toString()
        .padStart(3, "0")}`;
      console.log(
        `📝 Generated promotion_id: ${promotionData.promotion_id} (from ${existingPromotions.length} existing promotions, max was ${maxNumber})`
      );
    }

    // Ensure dates are Date objects
    if (
      promotionData.start_date &&
      typeof promotionData.start_date === "string"
    ) {
      promotionData.start_date = new Date(promotionData.start_date);
    }
    if (promotionData.end_date && typeof promotionData.end_date === "string") {
      promotionData.end_date = new Date(promotionData.end_date);
    }

    // Set default values
    promotionData.created_at = promotionData.created_at || new Date();
    promotionData.updated_at = promotionData.updated_at || new Date();
    promotionData.status = promotionData.status || "Active";

    console.log("📝 Creating new promotion:", promotionData.code);

    const newPromotion = new Promotion(promotionData);
    await newPromotion.save();

    console.log(
      "✅ Promotion created successfully:",
      newPromotion.promotion_id
    );
    console.log(
      "📋 Promotion details - status:",
      newPromotion.status,
      "type:",
      newPromotion.type
    );

    // Create notification for all users about the new promotion
    // Only notify if promotion is Active and type is User (not Admin)
    const isActive =
      newPromotion.status === "Active" || newPromotion.status === "active";
    const isUserType =
      newPromotion.type !== "Admin" && newPromotion.type !== "admin";

    // console.log("🔔 [Notifications] Checking notification conditions:", {
    //   isActive,
    //   isUserType,
    //   status: newPromotion.status,
    //   type: newPromotion.type,
    // });

    if (isActive && isUserType) {
      try {
        // console.log(
        //   "📢 [Notifications] Creating promotion notifications for all users..."
        // );
        await createPromotionNotificationForAllUsers(newPromotion);
        // console.log(
        //   "✅ [Notifications] Promotion notifications created successfully"
        // );
      } catch (notifError) {
        console.error(
          "❌ [Notifications] Error creating promotion notifications:",
          notifError
        );
        // Don't fail the promotion creation if notification fails
      }
    } else {
      console.log("⚠️ [Notifications] Skipping notification creation:", {
        reason: !isActive
          ? "Promotion is not Active"
          : "Promotion type is Admin",
        status: newPromotion.status,
        type: newPromotion.type,
      });
    }

    res.status(201).json({
      success: true,
      message: "Tạo khuyến mãi thành công",
      data: newPromotion,
    });
  } catch (error) {
    console.error(" [Promotions] Error creating promotion:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Mã khuyến mãi hoặc promotion_id đã tồn tại",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo khuyến mãi",
      error: error.message,
    });
  }
});

// PUT /api/promotions/:id - Cập nhật promotion (có thể tìm bằng promotion_id hoặc code)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by promotion_id first, then by code
    let updatedPromotion = await Promotion.findOneAndUpdate(
      { promotion_id: id },
      { ...req.body, updated_at: new Date() },
      { new: true }
    );

    // If not found by promotion_id, try to find by code
    if (!updatedPromotion) {
      updatedPromotion = await Promotion.findOneAndUpdate(
        { code: id },
        { ...req.body, updated_at: new Date() },
        { new: true }
      );
    }

    if (!updatedPromotion) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khuyến mãi",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật khuyến mãi thành công",
      data: updatedPromotion,
    });
  } catch (error) {
    console.error(" [Promotions] Error updating promotion:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật khuyến mãi",
      error: error.message,
    });
  }
});

// DELETE /api/promotions/:id - Xóa promotion
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPromotion = await Promotion.findOneAndDelete({
      promotion_id: id,
    });

    if (!deletedPromotion) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khuyến mãi",
      });
    }

    // Also delete promotion_target if exists
    try {
      await PromotionTarget.findOneAndDelete({ promotion_id: id });
      // console.log(
      //   `✅ [Promotions] Deleted promotion_target for promotion_id: ${id}`
      // );
    } catch (targetError) {
      // 404 is okay - target might not exist
      //   console.log(
      //     `ℹ️ [Promotions] No promotion_target found for promotion_id: ${id}`
      //   );
    }

    res.json({
      success: true,
      message: "Xóa khuyến mãi thành công",
      data: deletedPromotion,
    });
  } catch (error) {
    console.error("❌ [Promotions] Error deleting promotion:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa khuyến mãi",
      error: error.message,
    });
  }
});

// ============================================
// PROMOTION TARGETING APIs
// ============================================

// POST /api/promotions/check-applicability
// Kiểm tra promotion có áp dụng cho giỏ hàng không
router.post("/check-applicability", async (req, res) => {
  try {
    const { promotionId, cartItems } = req.body;

    if (!promotionId || !cartItems || !Array.isArray(cartItems)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: promotionId, cartItems",
      });
    }

    const result = await promotionService.checkPromotionApplicability(
      promotionId,
      cartItems
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(" [Promotions] Error checking applicability:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra khuyến mãi",
      error: error.message,
    });
  }
});

// POST /api/promotions/get-applicable
// Lấy tất cả promotion có thể áp dụng cho giỏ hàng
router.post("/get-applicable", async (req, res) => {
  try {
    const { cartItems, cartAmount } = req.body;

    if (!cartItems || !Array.isArray(cartItems)) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: cartItems",
      });
    }

    const promotions = await promotionService.getApplicablePromotions(
      cartItems,
      cartAmount || 0
    );

    res.json({
      success: true,
      data: promotions,
      count: promotions.length,
    });
  } catch (error) {
    console.error(" [Promotions] Error getting applicable promotions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khuyến mãi",
      error: error.message,
    });
  }
});

// POST /api/promotions/validate-code
// Validate promotion code với giỏ hàng
router.post("/validate-code", async (req, res) => {
  try {
    const { code, cartItems, cartAmount } = req.body;

    if (!code || !cartItems || !Array.isArray(cartItems)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: code, cartItems",
      });
    }

    const result = await promotionService.validatePromotionCode(
      code,
      cartItems,
      cartAmount || 0
    );

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: result.promotion,
      message: result.message,
    });
  } catch (error) {
    console.error(" [Promotions] Error validating code:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra mã khuyến mãi",
      error: error.message,
    });
  }
});

module.exports = router;
