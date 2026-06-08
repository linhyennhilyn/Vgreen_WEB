const express = require("express");
const { supabase } = require("../../supabase");
const router = express.Router();

const generateOrderID = () => {
  const timestamp = Date.now();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `DH${timestamp}${suffix}`;
};

router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.CustomerID || !payload.items || payload.items.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu CustomerID hoặc items" });
    }

    const order = {
      ...payload,
      OrderID: payload.OrderID || generateOrderID(),
      status: payload.status || "pending",
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("orders").insert(order);
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { customerID, orderID } = req.query;
    let query = supabase.from("orders").select("*");

    if (customerID) {
      query = query.eq("CustomerID", customerID);
    }
    if (orderID) {
      query = query.eq("OrderID", orderID);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data, count: data?.length ?? 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:orderID", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { data, error } = await supabase.from("orders").select("*").eq("OrderID", orderID).limit(1);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
