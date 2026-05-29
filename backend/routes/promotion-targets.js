const express = require("express");
const router = express.Router();
const { PromotionTarget } = require("../db");

// GET /api/promotion-targets - Lấy tất cả promotion targets 
router.get("/", async (req, res) => {
  try {
    const targets = await PromotionTarget.find({});
    res.json({
      success: true,
      data: targets,
      count: targets.length,
    });
  } catch (error) {
    console.error(" [PromotionTargets] Error fetching targets:", error); 
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách promotion targets",
      error: error.message,
    });
  }
});

// GET /api/promotion-targets/:promotionId - Lấy target của một promotion
router.get("/:promotionId", async (req, res) => {
  try {
    const { promotionId } = req.params;
    const target = await PromotionTarget.findOne({ promotion_id: promotionId });
    
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy promotion target",
      });
    }

    res.json({
      success: true,
      data: target,
    });
  } catch (error) {
    console.error(" [PromotionTargets] Error fetching target:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy promotion target",
      error: error.message,
    });
  }
});

// POST /api/promotion-targets - Tạo promotion target mới
router.post("/", async (req, res) => {
  try {
    const { promotion_id, target_type, target_ref } = req.body;

    // Validate required fields
    if (!promotion_id || !target_type || !target_ref || !Array.isArray(target_ref)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc: promotion_id, target_type, target_ref",
      });
    }

    // Check if target already exists for this promotion
    const existingTarget = await PromotionTarget.findOne({ promotion_id });
    if (existingTarget) {
      // Update existing target
      existingTarget.target_type = target_type;
      existingTarget.target_ref = target_ref;
      await existingTarget.save();

      return res.json({
        success: true,
        message: "Cập nhật promotion target thành công",
        data: existingTarget,
      });
    }

    // Create new target
    const newTarget = new PromotionTarget({
      promotion_id,
      target_type,
      target_ref,
    });

    await newTarget.save();

    console.log(`✅ Promotion target created: ${promotion_id} - ${target_type}`);

    res.status(201).json({
      success: true,
      message: "Tạo promotion target thành công",
      data: newTarget,
    });
  } catch (error) {
    console.error(" [PromotionTargets] Error creating target:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo promotion target",
      error: error.message,
    });
  }
});

// PUT /api/promotion-targets/:promotionId - Cập nhật promotion target
router.put("/:promotionId", async (req, res) => {
  try {
    const { promotionId } = req.params;
    const { target_type, target_ref } = req.body;

    const updatedTarget = await PromotionTarget.findOneAndUpdate(
      { promotion_id: promotionId },
      { target_type, target_ref },
      { new: true }
    );

    if (!updatedTarget) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy promotion target",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật promotion target thành công",
      data: updatedTarget,
    });
  } catch (error) {
    console.error(" [PromotionTargets] Error updating target:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật promotion target",
      error: error.message,
    });
  }
});

// DELETE /api/promotion-targets/:promotionId - Xóa promotion target
router.delete("/:promotionId", async (req, res) => {
  try {
    const { promotionId } = req.params;
    const deletedTarget = await PromotionTarget.findOneAndDelete({ promotion_id: promotionId });

    if (!deletedTarget) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy promotion target",
      });
    }

    res.json({
      success: true,
      message: "Xóa promotion target thành công",
      data: deletedTarget,
    });
  } catch (error) {
    console.error(" [PromotionTargets] Error deleting target:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa promotion target",
      error: error.message,
    });
  }
});

module.exports = router;
