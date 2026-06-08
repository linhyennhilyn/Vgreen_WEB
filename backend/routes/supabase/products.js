const express = require("express");
const { supabase } = require("../../supabase");
const router = express.Router();

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [value];
};

const getActiveProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("status", ["Active", "OutOfStock"]);

  if (error) {
    throw error;
  }
  return data || [];
};

router.get("/", async (req, res) => {
  try {
    const { group } = req.query;
    let products = await getActiveProducts();

    if (group && group !== "all") {
      products = products.filter((product) => {
        const groups = normalizeArray(product.groups);
        return groups.some((item) => String(item).trim() === String(group).trim());
      });
    }

    res.json({ success: true, data: products, count: products.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách sản phẩm", error: error.message });
  }
});

router.get("/metadata/categories", async (req, res) => {
  try {
    const products = await getActiveProducts();
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    res.json({ success: true, data: categories, count: categories.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách categories", error: error.message });
  }
});

router.get("/metadata/subcategories", async (req, res) => {
  try {
    const products = await getActiveProducts();
    const subcategories = Array.from(new Set(products.map((p) => p.subcategory).filter(Boolean)));
    res.json({ success: true, data: subcategories, count: subcategories.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách subcategories", error: error.message });
  }
});

router.get("/metadata/brands", async (req, res) => {
  try {
    const products = await getActiveProducts();
    const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
    res.json({ success: true, data: brands, count: brands.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách brands", error: error.message });
  }
});

router.get("/metadata/groups", async (req, res) => {
  try {
    const products = await getActiveProducts();
    const groupSet = new Set();
    products.forEach((product) => {
      const groups = normalizeArray(product.groups);
      groups.forEach((group) => {
        if (group && String(group).trim() !== "") {
          groupSet.add(String(group).trim());
        }
      });
    });
    const groups = Array.from(groupSet).sort();
    res.json({ success: true, data: groups, count: groups.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách groups", error: error.message });
  }
});

router.get("/metadata/products", async (req, res) => {
  try {
    const { data } = await supabase
      .from("products")
      .select("sku, product_name, productName")
      .limit(1000);

    const productList = (data || []).map((p) => ({
      sku: p.sku,
      name: p.product_name || p.productName || p.sku,
    }));

    res.json({ success: true, data: productList, count: productList.length });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách products", error: error.message });
  }
});

router.get("/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("sku", sku).limit(1);
    if (error) {
      return res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin sản phẩm", error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Sản phẩm không tồn tại" });
    }
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin sản phẩm", error: error.message });
  }
});

module.exports = router;
