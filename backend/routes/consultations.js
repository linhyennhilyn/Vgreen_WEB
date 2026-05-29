const express = require("express");
const router = express.Router();
const { Consultation, Product } = require("../db");
const mongoose = require("mongoose");

// Helper function: Create admin notification for new consultation question
async function createConsultationNotification(sku, productName, questionId, customerId, customerName, question) {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection("notifications");

    await notificationsCollection.insertOne({
      type: "consultation",
      sku: sku,
      productName: productName,
      questionId: questionId,
      customerId: customerId,
      customerName: customerName,
      title: "Câu hỏi tư vấn mới",
      message: `Khách hàng ${customerName} đã đặt câu hỏi về sản phẩm "${productName}"`,
      status: "active",
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ [Consultations] Created notification for new question on product ${sku}`);
  } catch (error) {
    console.error("❌ [Consultations] Error creating notification:", error);
    // Don't throw - notification failure shouldn't break the API
  }
}

// GET all consultations (for admin) or by SKU (for user)
router.get("/", async (req, res) => {
  try {
    const { sku, status } = req.query;

    let query = {};
    if (sku) {
      query.sku = sku;
    }

    const consultations = await Consultation.find(query).sort({ updatedAt: -1 });

    // Filter questions by status if provided
    let result = consultations;
    if (status) {
      result = consultations.map((consultation) => {
        const filteredQuestions = consultation.questions.filter(
          (q) => q.status === status
        );
        return {
          ...consultation.toObject(),
          questions: filteredQuestions,
        };
      });
    }

    res.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error("❌ [Consultations] Error fetching consultations:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách tư vấn",
      error: error.message,
    });
  }
});

// GET consultation by SKU (for product detail page)
router.get("/:sku", async (req, res) => {
  try {
    const { sku } = req.params;

    const consultation = await Consultation.findOne({ sku });

    if (!consultation) {
      return res.json({
        success: true,
        data: {
          sku,
          productName: "",
          questions: [],
        },
        count: 0,
      });
    }

    res.json({
      success: true,
      data: consultation,
      count: consultation.questions.length,
    });
  } catch (error) {
    console.error("❌ [Consultations] Error fetching consultation:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin tư vấn",
      error: error.message,
    });
  }
});

// POST - Add new question
router.post("/:sku/question", async (req, res) => {
  try {
    const { sku } = req.params;
    const { question, customerId, customerName } = req.body;

    // Validate input
    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Câu hỏi không được để trống",
      });
    }

    if (!customerId || !customerName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin khách hàng",
      });
    }

    // Get product info
    const product = await Product.findOne({ sku });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    const productName = product.product_name || product.ProductName || "";

    // Find or create consultation document
    let consultation = await Consultation.findOne({ sku });

    if (!consultation) {
      consultation = new Consultation({
        sku,
        productName,
        questions: [],
      });
    }

    // Add new question
    const newQuestion = {
      question: question.trim(),
      customerId,
      customerName,
      answer: "",
      answeredBy: "",
      answeredAt: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    consultation.questions.push(newQuestion);
    await consultation.save();

    // Get the question ID (MongoDB _id of the question)
    const savedQuestion = consultation.questions[consultation.questions.length - 1];
    const questionId = savedQuestion._id.toString();

    // Create notification for admin
    await createConsultationNotification(
      sku,
      productName,
      questionId,
      customerId,
      customerName,
      question.trim()
    );

    console.log(`✅ [Consultations] Added new question for product ${sku}`);

    res.status(201).json({
      success: true,
      message: "Đã gửi câu hỏi thành công",
      data: {
        questionId,
        question: newQuestion,
      },
    });
  } catch (error) {
    console.error("❌ [Consultations] Error adding question:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi gửi câu hỏi",
      error: error.message,
    });
  }
});

// POST - Add answer to a question
router.post("/:sku/answer/:questionId", async (req, res) => {
  try {
    const { sku, questionId } = req.params;
    const { answer, answeredBy } = req.body;

    // Validate input
    if (!answer || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message: "Câu trả lời không được để trống",
      });
    }

    if (!answeredBy) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin người trả lời",
      });
    }

    // Find consultation
    const consultation = await Consultation.findOne({ sku });
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tư vấn cho sản phẩm này",
      });
    }

    // Find question
    const question = consultation.questions.id(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu hỏi",
      });
    }

    // Update question with answer
    question.answer = answer.trim();
    question.answeredBy = answeredBy;
    question.answeredAt = new Date();
    question.status = "answered";
    question.updatedAt = new Date();

    await consultation.save();

    console.log(`✅ [Consultations] Answered question ${questionId} for product ${sku}`);

    res.json({
      success: true,
      message: "Đã trả lời câu hỏi thành công",
      data: {
        question: question,
      },
    });
  } catch (error) {
    console.error("❌ [Consultations] Error answering question:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi trả lời câu hỏi",
      error: error.message,
    });
  }
});

// DELETE - Delete a question (admin only)
router.delete("/:sku/question/:questionId", async (req, res) => {
  try {
    const { sku, questionId } = req.params;

    const consultation = await Consultation.findOne({ sku });
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tư vấn cho sản phẩm này",
      });
    }

    consultation.questions.id(questionId).remove();
    await consultation.save();

    console.log(`✅ [Consultations] Deleted question ${questionId} for product ${sku}`);

    res.json({
      success: true,
      message: "Đã xóa câu hỏi thành công",
    });
  } catch (error) {
    console.error("❌ [Consultations] Error deleting question:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa câu hỏi",
      error: error.message,
    });
  }
});

module.exports = router;

