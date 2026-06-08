const express = require("express");
const { supabase } = require("../../supabase");

const createTableRouter = (tableName, keyField = "id") => {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      let query = supabase.from(tableName).select("*");

      const { limit, offset, orderBy, sort } = req.query;
      const filters = Object.fromEntries(
        Object.entries(req.query).filter(
          ([key]) => !["limit", "offset", "orderBy", "sort"].includes(key)
        )
      );

      Object.entries(filters).forEach(([key, value]) => {
        if (value === "null") {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      });

      if (orderBy) {
        query = query.order(orderBy, { ascending: sort !== "desc" });
      }
      if (limit) {
        query = query.limit(Number(limit));
      }
      if (offset) {
        query = query.range(Number(offset), Number(offset) + Number(limit || 100) - 1);
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

  router.get("/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq(keyField, key)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Không tìm thấy" });
        }
        return res.status(500).json({ success: false, error: error.message });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const payload = req.body;
      const { data, error } = await supabase.from(tableName).insert(payload);
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch("/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const payload = req.body;
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq(keyField, key);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete("/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { data, error } = await supabase
        .from(tableName)
        .delete()
        .eq(keyField, key);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};

module.exports = { createTableRouter };