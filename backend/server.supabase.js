require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createTableRouter } = require("./routes/supabase/table-router");
const authRoutes = require("./routes/supabase/auth");
const productsRoutes = require("./routes/supabase/products");
const ordersRoutes = require("./routes/supabase/orders");
const { supabase } = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:4201',
    'vgreen-web.vercel.app',
    'vgreen-web-admin.vercel.app',
  ],
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ success: true, message: "VGreen Supabase backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/orders", ordersRoutes);

app.use("/api/users", createTableRouter("users", "CustomerID"));
app.use("/api/promotions", createTableRouter("promotions", "id"));
app.use("/api/promotion-targets", createTableRouter("promotion_target", "id"));
app.use("/api/blogs", createTableRouter("blogs", "id"));
app.use("/api/reviews", createTableRouter("reviews", "id"));
app.use("/api/dishes", createTableRouter("dishes", "id"));
app.use("/api/instructions", createTableRouter("instructions", "id"));
app.use("/api/chat", createTableRouter("chat_conversations", "id"));
app.use("/api/consultations", createTableRouter("consultations", "id"));
app.use("/api/contact", createTableRouter("contact", "id"));
app.use("/api/addresses", createTableRouter("addresses", "id"));

// Special endpoint: reconstruct tree_complete as the legacy nested object
app.get("/api/tree_complete", async (req, res) => {
  try {
    const { data, error } = await supabase.from("tree_complete").select("*");
    if (error) {
      console.error('Error fetching tree_complete from Supabase:', error);
      return res.status(500).json([]);
    }

    // Build object keyed by province code to match original structure
    const treeObj = {};
    for (const row of data || []) {
      const code = row.code || String(row.code || '').trim();
      if (!code) continue;
      treeObj[code] = {
        code: row.code,
        name: row.name,
        slug: row.slug,
        type: row.type,
        name_with_type: row.name_with_type,
        parent_code: row.parent_code,
        'quan-huyen': row['quan-huyen'] || null,
        'xa-phuong': row['xa-phuong'] || null,
      };
    }

    // Return as array of one object to mimic previous MongoDB response
    res.json([treeObj]);
  } catch (err) {
    console.error('Unexpected error in /api/tree_complete:', err);
    res.status(500).json([]);
  }
});

    // Fallback generic router for tree_complete (keep for other methods)
    app.use("/api/tree_complete", createTableRouter("tree_complete", "id"));

    app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ VGreen Supabase backend running on http://localhost:${PORT}`);
});
