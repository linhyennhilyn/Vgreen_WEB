const express = require("express");
const router = express.Router();
const { Instruction } = require("../db");

// GET /api/instructions - Lấy tất cả instructions (có thể filter theo ingredient)
router.get("/", async (req, res) => {
  try {
    const { ingredient } = req.query;

    let query = {
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
    };

    // Nếu có ingredient, filter theo ingredient (case-insensitive)
    if (ingredient) {
      const ingredientLower = ingredient.toLowerCase().trim();
      query.Ingredient = { $regex: ingredientLower, $options: "i" };
    }

    const instructions = await Instruction.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: instructions,
      count: instructions.length,
    });
  } catch (error) {
    console.error(" [Instructions] Error fetching instructions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách instructions",
      error: error.message,
    });
  }
});

// GET /api/instructions/search - Tìm instructions theo product name
router.get("/search", async (req, res) => {
  try {
    const { productName } = req.query;

    if (!productName || productName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "productName không được để trống",
      });
    }

    const productNameLower = productName.toLowerCase().trim();

    // Lấy tất cả active instructions và filter trong JavaScript
    // (vì MongoDB query phức tạp hơn, filter trong JS đơn giản hơn)
    const allInstructions = await Instruction.find({
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
    });

    // Filter: ingredient có trong productName (case-insensitive)
    const matchedInstructions = allInstructions.filter((instruction) => {
      const ingredientLower = (instruction.Ingredient || "")
        .toLowerCase()
        .trim();
      return ingredientLower && productNameLower.includes(ingredientLower);
    });

    res.json({
      success: true,
      data: matchedInstructions,
      count: matchedInstructions.length,
    });
  } catch (error) {
    console.error(" [Instructions] Error searching instructions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm instructions",
      error: error.message,
    });
  }
});

// GET /api/instructions/match-product - Tìm instructions khớp với product name
// PHẢI ĐẶT TRƯỚC /:id để tránh conflict
router.get("/match-product", async (req, res) => {
  try {
    const { productName } = req.query;

    if (!productName || productName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "productName không được để trống",
      });
    }

    const productNameLower = productName.toLowerCase().trim();

    // Lấy tất cả active instructions
    const allInstructions = await Instruction.find({
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
    });

    // Filter: ingredient có trong productName (case-insensitive)
    const matchedInstructions = allInstructions.filter((instruction) => {
      const ingredientLower = (instruction.Ingredient || "")
        .toLowerCase()
        .trim();
      return ingredientLower && productNameLower.includes(ingredientLower);
    });

    console.log(
      ` [Instructions] Found ${matchedInstructions.length} matching instructions for product "${productName}"`
    );

    res.json({
      success: true,
      data: matchedInstructions,
      count: matchedInstructions.length,
    });
  } catch (error) {
    console.error(" [Instructions] Error matching instructions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm instructions khớp với product",
      error: error.message,
    });
  }
});

// GET /api/instructions/by-ingredient/:ingredient - Lấy instructions theo ingredient
router.get("/by-ingredient/:ingredient", async (req, res) => {
  try {
    const { ingredient } = req.params;
    const ingredientLower = ingredient.toLowerCase().trim();

    const instructions = await Instruction.find({
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
      Ingredient: { $regex: ingredientLower, $options: "i" },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: instructions,
      count: instructions.length,
    });
  } catch (error) {
    console.error(
      " [Instructions] Error fetching instructions by ingredient:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy instructions theo ingredient",
      error: error.message,
    });
  }
});

// GET /api/instructions/:id - Lấy instruction theo ID
// PHẢI ĐẶT CUỐI CÙNG để tránh conflict với các route cụ thể
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const instruction = await Instruction.findOne({
      ID: id,
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
    });

    if (!instruction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy instruction",
      });
    }

    res.json({
      success: true,
      data: instruction,
    });
  } catch (error) {
    console.error(" [Instructions] Error fetching instruction:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy instruction",
      error: error.message,
    });
  }
});

module.exports = router;
