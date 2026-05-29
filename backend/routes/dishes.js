const express = require("express");
const router = express.Router();
const { Dish } = require("../db");

// GET /api/dishes - Lấy tất cả dishes
router.get("/", async (req, res) => {
  try {
    const dishes = await Dish.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: dishes,
      count: dishes.length,
    });
  } catch (error) {
    console.error(" [Dishes] Error fetching dishes:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dishes",
      error: error.message,
    });
  }
});

// GET /api/dishes/:id - Lấy dish theo ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dish = await Dish.findOne({ ID: id });

    if (!dish) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dish",
      });
    }

    res.json({
      success: true,
      data: dish,
    });
  } catch (error) {
    console.error(" [Dishes] Error fetching dish:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dish",
      error: error.message,
    });
  }
});

// GET /api/dishes/batch - Lấy nhiều dishes theo danh sách IDs
router.post("/batch", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "ids phải là một mảng",
      });
    }

    const dishes = await Dish.find({ ID: { $in: ids } });

    res.json({
      success: true,
      data: dishes,
      count: dishes.length,
    });
  } catch (error) {
    console.error(" [Dishes] Error fetching batch dishes:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy batch dishes",
      error: error.message,
    });
  }
});

module.exports = router;
