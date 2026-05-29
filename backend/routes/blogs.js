const express = require("express");
const router = express.Router();
const { Blog, Product } = require("../db");

// ============================================================================
// KEYWORD EXTRACTION AND RELATED PRODUCTS (Must be before /:id route)
// ============================================================================

/**
 * Extract keywords from blog content and title
 * Returns array of relevant keywords for hashtag generation
 * CHỈ TRÍCH XUẤT TÊN CÁC LOẠI NÔNG SẢN
 */
function extractKeywordsFromBlog(title, content, categoryTag) {
  // Danh sách các loại nông sản phổ biến (tên sản phẩm, loại rau củ quả)
  const agriculturalProducts = [
    // Trái cây
    "cam",
    "quýt",
    "bưởi",
    "chanh",
    "táo",
    "lê",
    "nho",
    "dâu",
    "kiwi",
    "đu đủ",
    "ổi",
    "mít",
    "sầu riêng",
    "măng cụt",
    "chôm chôm",
    "nhãn",
    "vải",
    "xoài",
    "chuối",
    "dưa hấu",
    "dưa lưới",
    "thanh long",
    "mãng cầu",
    "cóc",
    "cà na",
    "me",
    "khế",
    "dứa",
    "thơm",
    "dưa gang",
    "dưa leo",
    "dưa chuột",
    "trái cây",
    "trái cây nhiệt đới",
    "trái cây ôn đới",
    "hoa quả",

    // Rau củ
    "rau",
    "củ",
    "quả",
    "cà chua",
    "cà rốt",
    "khoai tây",
    "khoai lang",
    "khoai môn",
    "khoai sọ",
    "cải",
    "bắp cải",
    "súp lơ",
    "bông cải",
    "cải thảo",
    "cải xanh",
    "cải ngọt",
    "rau muống",
    "rau dền",
    "rau mồng tơi",
    "rau lang",
    "rau đay",
    "rau ngót",
    "rau cải",
    "rau xà lách",
    "rau diếp",
    "rau mầm",
    "rau cần",
    "rau húng",
    "rau lá",
    "rau gia vị",
    "hành",
    "hành tây",
    "hành lá",
    "tỏi",
    "gừng",
    "nghệ",
    "ớt",
    "tiêu",
    "đậu",
    "đỗ",
    "đậu xanh",
    "đậu đỏ",
    "đậu đen",
    "đậu nành",
    "đậu phộng",
    "lạc",
    "vừng",
    "bí",
    "bí đỏ",
    "bí xanh",
    "bầu",
    "mướp",
    "khổ qua",
    "mướp đắng",
    "cà tím",
    "cà pháo",
    "ớt chuông",
    "ớt hiểm",
    "ngô",
    "bắp",
    "ngô nếp",
    "ngô tẻ",
    "củ cải",
    "củ dền",
    "củ đậu",
    "củ sắn",
    "măng",
    "giá đỗ",

    // Nấm
    "nấm",
    "nấm hương",
    "nấm rơm",
    "nấm kim châm",
    "nấm đông cô",
    "nấm mèo",

    // Lương thực, ngũ cốc
    "gạo",
    "gạo nếp",
    "gạo tẻ",
    "gạo lứt",
    "gạo thơm",
    "nếp",
    "bột",
    "bột mì",
    "bột gạo",
    "bột nếp",
    "bột năng",
    "ngũ cốc",
    "cereals",
    "yến mạch",
    "lúa mì",
    "lúa mạch",
    "bánh canh",
    "bún tươi",
    "hủ tiếu",
    "miến",

    // Thực phẩm khô
    "hạt",
    "hạt điều",
    "hạt dẻ",
    "hạt óc chó",
    "hạt hạnh nhân",
    "hạt macca",
    "mè",
    "vừng",
    "đậu phộng",
    "lạc",

    // Trà & Thảo mộc
    "trà",
    "chè",
    "trà xanh",
    "trà đen",
    "trà oolong",
    "trà thảo mộc",
    "trà khác",
    "thảo mộc",
    "húng quế",
    "rau thơm",
    "tía tô",
    "kinh giới",
    "rong",
    "tảo biển",

    // Cà phê, Cacao
    "cà phê",
    "cacao",
    "ca cao",
    "cà phê đen",
    "cà phê sữa",

    // Hoa ăn được
    "hoa ăn được",

    // Gia vị và chất tạo ngọt
    "muối",
    "đường",
    "mắm",
    "nước mắm",
    "tương",
    "xì dầu",
    "mật ong",
    "đường phèn",
    "đường thốt nốt",

    // Sản phẩm khác
    "nước yến",
    "tinh bột nghệ",
  ];

  // Combine title, content, and categoryTag
  // Title is more important, so we'll count it twice
  const combinedText = `${title} ${title} ${content} ${
    categoryTag || ""
  }`.toLowerCase();

  // Remove HTML tags
  const textWithoutHtml = combinedText.replace(/<[^>]*>/g, " ");

  // Extract words (Vietnamese and English)
  const words = textWithoutHtml
    .replace(
      /[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi,
      " "
    )
    .split(/\s+/)
    .filter((word) => word.length > 1); // Filter out single characters

  // Tìm các từ khóa là tên nông sản trong text
  const foundProducts = new Map(); // Map để lưu tần suất xuất hiện

  // Kiểm tra từng từ trong text có phải là tên nông sản không
  words.forEach((word) => {
    const lowerWord = word.toLowerCase().trim();
    if (lowerWord.length > 1) {
      // Kiểm tra từ đơn
      agriculturalProducts.forEach((product) => {
        const productLower = product.toLowerCase();
        // Nếu từ khớp chính xác hoặc chứa tên nông sản
        if (
          lowerWord === productLower ||
          lowerWord.includes(productLower) ||
          productLower.includes(lowerWord)
        ) {
          foundProducts.set(product, (foundProducts.get(product) || 0) + 1);
        }
      });
    }
  });

  // Kiểm tra các cụm từ 2-3 từ
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`.toLowerCase().trim();
    agriculturalProducts.forEach((product) => {
      const productLower = product.toLowerCase();
      if (
        twoWord === productLower ||
        twoWord.includes(productLower) ||
        productLower.includes(twoWord)
      ) {
        foundProducts.set(product, (foundProducts.get(product) || 0) + 1);
      }
    });

    if (i < words.length - 2) {
      const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
        .toLowerCase()
        .trim();
      agriculturalProducts.forEach((product) => {
        const productLower = product.toLowerCase();
        if (
          threeWord === productLower ||
          threeWord.includes(productLower) ||
          productLower.includes(threeWord)
        ) {
          foundProducts.set(product, (foundProducts.get(product) || 0) + 1);
        }
      });
    }
  }

  // Chuyển Map thành Array và sắp xếp theo tần suất
  const productKeywords = Array.from(foundProducts.entries())
    .map(([product, frequency]) => ({ text: product, frequency }))
    .sort((a, b) => b.frequency - a.frequency) // Sắp xếp theo tần suất giảm dần
    .map((item) => item.text)
    .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates

  return productKeywords;
}

/**
 * Generate hashtags from keywords
 * CHỈ TẠO HASHTAG TỪ TÊN CÁC LOẠI NÔNG SẢN
 */
function generateHashtags(keywords, categoryTag) {
  const hashtags = new Set();

  // Add category tag as hashtag (nếu category tag là tên nông sản hoặc liên quan)
  if (categoryTag) {
    const categoryHashtag = categoryTag
      .replace(/\s+/g, "")
      .replace(
        /[^\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi,
        ""
      )
      .toLowerCase();
    if (categoryHashtag.length > 1) {
      hashtags.add(`#${categoryHashtag}`);
    }
  }

  // Chỉ thêm hashtag từ keywords (đã là tên nông sản)
  keywords.forEach((keyword) => {
    // Remove spaces and special characters for hashtag
    const hashtag = keyword
      .replace(/\s+/g, "")
      .replace(
        /[^\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi,
        ""
      )
      .toLowerCase();

    // Only add if hashtag is meaningful (length > 1 and not just numbers)
    if (hashtag.length > 1 && !/^\d+$/.test(hashtag)) {
      hashtags.add(`#${hashtag}`);
    }
  });

  // Limit to 10 hashtags
  const hashtagsArray = Array.from(hashtags);

  // Sort by length (longer hashtags are usually more specific)
  hashtagsArray.sort((a, b) => {
    // Remove # for comparison
    const aText = a.replace("#", "");
    const bText = b.replace("#", "");
    return bText.length - aText.length;
  });

  return hashtagsArray.slice(0, 10); // Limit to 10 hashtags
}

/**
 * GET /api/blogs/:id/related-products - Get related products based on blog content
 * Must be placed BEFORE /:id route to avoid conflicts
 */
router.get("/:id/related-products", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id.trim().replace(/,$/, "").trim();

    // Find blog
    const blog = await Blog.findOne({
      $or: [
        { id: normalizedId },
        { id: normalizedId + "," },
        {
          id: {
            $regex: new RegExp(
              `^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},?$`
            ),
          },
        },
      ],
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    // Extract keywords from blog
    const keywords = extractKeywordsFromBlog(
      blog.title || "",
      blog.content || "",
      blog.categoryTag || ""
    );

    // console.log(
    //   `📝 [Blogs] Extracted keywords for blog "${blog.title}":`,
    //   keywords
    // );

    // Build search query for products
    const searchQuery = {
      status: "Active",
      $or: [
        // Search in product name
        { product_name: { $regex: keywords.join("|"), $options: "i" } },
        { productName: { $regex: keywords.join("|"), $options: "i" } },
        // Search in category
        { category: { $regex: keywords.join("|"), $options: "i" } },
        { Category: { $regex: keywords.join("|"), $options: "i" } },
        // Search in subcategory
        { subcategory: { $regex: keywords.join("|"), $options: "i" } },
        { Subcategory: { $regex: keywords.join("|"), $options: "i" } },
        // Search in brand
        { brand: { $regex: keywords.join("|"), $options: "i" } },
        { Brand: { $regex: keywords.join("|"), $options: "i" } },
      ],
    };

    // If categoryTag exists, also search by it
    if (blog.categoryTag) {
      searchQuery.$or.push(
        { category: { $regex: blog.categoryTag, $options: "i" } },
        { Category: { $regex: blog.categoryTag, $options: "i" } },
        { subcategory: { $regex: blog.categoryTag, $options: "i" } },
        { Subcategory: { $regex: blog.categoryTag, $options: "i" } }
      );
    }

    // Find products
    const products = await Product.find(searchQuery)
      .limit(12) // Limit to 12 products
      .select(
        "_id sku product_name productName category subcategory brand price image status unit purchase_count"
      );

    // console.log(
    //   `✅ [Blogs] Found ${products.length} related products for blog "${blog.title}"`
    // );

    res.json({
      success: true,
      data: products,
      keywords: keywords,
      count: products.length,
    });
  } catch (error) {
    console.error("❌ [Blogs] Error fetching related products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy sản phẩm liên quan",
      error: error.message,
    });
  }
});

/**
 * POST /api/blogs/:id/extract-keywords - Extract keywords and generate hashtags
 * Must be placed BEFORE /:id route to avoid conflicts
 */
router.post("/:id/extract-keywords", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id.trim().replace(/,$/, "").trim();

    // Find blog
    const blog = await Blog.findOne({
      $or: [
        { id: normalizedId },
        { id: normalizedId + "," },
        {
          id: {
            $regex: new RegExp(
              `^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},?$`
            ),
          },
        },
      ],
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    // Extract keywords
    const keywords = extractKeywordsFromBlog(
      blog.title || "",
      blog.content || "",
      blog.categoryTag || ""
    );

    // Generate hashtags
    const hashtags = generateHashtags(keywords, blog.categoryTag);

    // Update blog with hashtags
    blog.hashtags = hashtags;
    await blog.save();

    // console.log(
    //   `✅ [Blogs] Generated hashtags for blog "${blog.title}":`,
    //   hashtags
    // );

    res.json({
      success: true,
      data: {
        keywords: keywords,
        hashtags: hashtags,
      },
    });
  } catch (error) {
    console.error("❌ [Blogs] Error extracting keywords:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi extract keywords",
      error: error.message,
    });
  }
});

// ============================================================================
// BLOG ROUTES
// ============================================================================

// GET /api/blogs - Lấy tất cả blogs (đã publish)
router.get("/", async (req, res) => {
  try {
    // Query: lấy blogs có status "Active" hoặc không có status (fallback cho dữ liệu cũ)
    const blogs = await Blog.find({
      $or: [
        { status: "Active" },
        { status: { $exists: false } },
        { status: null },
        { status: "" },
      ],
    })
      .sort({ pubDate: -1 }) // Mới nhất lên đầu
      .select(
        "id img title excerpt pubDate author categoryTag content status views createdAt updatedAt"
      );

    // Normalize blog IDs: trim và loại bỏ dấu phẩy thừa
    const normalizedBlogs = blogs.map((blog) => {
      const blogObj = blog.toObject();
      // Normalize ID: trim và loại bỏ dấu phẩy ở cuối
      if (blogObj.id && typeof blogObj.id === "string") {
        blogObj.id = blogObj.id.trim().replace(/,$/, "").trim();
      }
      return blogObj;
    });

    // Log để debug
    // console.log(` [Blogs] Found ${normalizedBlogs.length} active blogs`);

    res.json({
      success: true,
      data: normalizedBlogs, // Trả về blogs với ID đã normalize
      count: normalizedBlogs.length,
    });
  } catch (error) {
    console.error(" [Blogs] Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách blog",
      error: error.message,
    });
  }
});

// GET /api/blogs/:id - Lấy blog theo ID
router.get("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    // Trim ID để loại bỏ khoảng trắng và dấu phẩy thừa
    id = id.trim().replace(/,$/, "").trim();
    // console.log(` [Blogs] Fetching blog with ID: "${id}"`);

    // Tạo regex để tìm ID với hoặc không có dấu phẩy ở cuối
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idRegex = new RegExp(`^${escapedId},?$`);

    // Tìm blog với ID đã trim, và cả với các biến thể có dấu phẩy/khoảng trắng
    // Thử tìm với điều kiện status "Active" hoặc không có status trước
    let blog = await Blog.findOne({
      $and: [
        {
          $or: [
            { id: id }, // Exact match với ID đã trim
            { id: id + "," }, // ID với dấu phẩy ở cuối
            { id: { $regex: idRegex } }, // Regex match (id hoặc id,)
          ],
        },
        {
          $or: [
            { status: "Active" },
            { status: { $exists: false } },
            { status: null },
            { status: "" },
          ],
        },
      ],
    });

    // Nếu không tìm thấy với điều kiện status, thử tìm không có điều kiện status
    if (!blog) {
      blog = await Blog.findOne({
        $or: [{ id: id }, { id: id + "," }, { id: { $regex: idRegex } }],
      });
    }

    if (!blog) {
      console.log(` [Blogs] Blog with ID "${id}" not found`);
      // Debug: Liệt kê tất cả IDs có trong database
      const allBlogs = await Blog.find({}).select("id title status").limit(10);
      console.log(
        ` [Blogs] Sample blog IDs in database:`,
        allBlogs.map((b) => ({
          id: `"${b.id}"`,
          title: b.title,
          status: b.status,
        }))
      );
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    console.log(
      ` [Blogs] Found blog: ${blog.title} (id: "${blog.id}", status: ${
        blog.status || "undefined"
      })`
    );

    // Normalize blog ID: trim và loại bỏ dấu phẩy thừa (nếu có)
    // Nhưng không lưu vào database ngay, chỉ trả về ID đã normalize
    const normalizedBlog = blog.toObject();
    normalizedBlog.id = normalizedBlog.id.trim().replace(/,$/, "").trim();

    // Tăng views
    blog.views = (blog.views || 0) + 1;
    await blog.save();

    res.json({
      success: true,
      data: normalizedBlog, // Trả về blog với ID đã normalize
    });
  } catch (error) {
    console.error(" [Blogs] Error fetching blog:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy bài viết",
      error: error.message,
    });
  }
});

// GET /api/blogs/featured - Lấy bài viết nổi bật (mới nhất)
router.get("/featured/latest", async (req, res) => {
  try {
    const blog = await Blog.findOne({ status: "Active" })
      .sort({ pubDate: -1 })
      .select("id img title excerpt pubDate author categoryTag content");

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết nổi bật",
      });
    }

    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    // console.error(" [Blogs] Error fetching featured blog:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy bài viết nổi bật",
      error: error.message,
    });
  }
});

// GET /api/blogs/category/:category - Lấy blogs theo category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const blogs = await Blog.find({
      categoryTag: category,
      status: "Active",
    })
      .sort({ pubDate: -1 })
      .select("id img title excerpt pubDate author categoryTag content");

    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
    });
  } catch (error) {
    console.error("  Error fetching blogs by category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách blog theo category",
      error: error.message,
    });
  }
});

// GET /api/blogs/search?q=keyword - Tìm kiếm blogs
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Từ khóa tìm kiếm không được để trống",
      });
    }

    const searchRegex = new RegExp(q.trim(), "i");
    const blogs = await Blog.find({
      status: "Active",
      $or: [
        { title: searchRegex },
        { excerpt: searchRegex },
        { author: searchRegex },
        { content: searchRegex },
      ],
    })
      .sort({ pubDate: -1 })
      .select("id img title excerpt pubDate author categoryTag content");

    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
    });
  } catch (error) {
    // console.error(" [Blogs] Error searching blogs:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm blog",
      error: error.message,
    });
  }
});

// POST /api/blogs - Tạo blog mới (cho admin)
router.post("/", async (req, res) => {
  try {
    // Không xử lý hashtags nữa
    // Loại bỏ hashtags khỏi request body nếu có
    if (req.body.hashtags !== undefined) {
      delete req.body.hashtags;
    }

    const newBlog = new Blog(req.body);
    await newBlog.save();

    res.status(201).json({
      success: true,
      message: "Tạo bài viết thành công",
      data: newBlog,
    });
  } catch (error) {
    console.error("❌ [Blogs] Error creating blog:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo bài viết",
      error: error.message,
    });
  }
});

// PUT /api/blogs/:id - Cập nhật blog
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id.trim().replace(/,$/, "").trim();

    console.log(`\n✏️ === UPDATE BLOG ===`);
    console.log(`📋 Blog ID: ${normalizedId}`);
    console.log("📋 Update data fields:", Object.keys(req.body));

    // Find blog by id field (NS002, NS016, etc.) or _id (MongoDB ObjectId)
    // Try to find by id field first (preferred)
    let blog = await Blog.findOne({ id: normalizedId });

    // If not found by id field, try to find by _id (MongoDB ObjectId)
    // This handles cases where frontend might send MongoDB ObjectId by mistake
    if (!blog) {
      try {
        // Check if normalizedId looks like a MongoDB ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(normalizedId)) {
          const mongoose = require("mongoose");
          if (mongoose.Types.ObjectId.isValid(normalizedId)) {
            blog = await Blog.findById(normalizedId);
            if (blog) {
              console.log(
                `⚠️ Found blog by _id (ObjectId) instead of id field: ${normalizedId}`
              );
            }
          }
        }
      } catch (error) {
        // Ignore error, continue with id field search
      }
    }

    if (!blog) {
      console.log(`❌ Blog not found with id or _id: ${normalizedId}`);
      // Debug: Log available blog IDs for troubleshooting
      const sampleBlogs = await Blog.find({}).select("id _id title").limit(5);
      console.log(
        `📋 Sample blog IDs in database:`,
        sampleBlogs.map((b) => ({
          id: b.id,
          _id: b._id?.toString(),
          title: b.title?.substring(0, 30),
        }))
      );
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    // Không xử lý hashtags nữa
    // Loại bỏ hashtags khỏi request body nếu có
    if (req.body.hashtags !== undefined) {
      delete req.body.hashtags;
    }

    // Prepare update data with updatedAt timestamp
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    // Ensure updatedAt is set as Date object
    if (typeof updateData.updatedAt === "string") {
      updateData.updatedAt = new Date(updateData.updatedAt);
    }

    console.log("📋 Updating blog in MongoDB...");

    // Update blog in MongoDB
    const updatedBlog = await Blog.findOneAndUpdate(
      { id: normalizedId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedBlog) {
      console.log(`❌ Blog update failed: ${normalizedId}`);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    console.log(`✅ Blog updated successfully in MongoDB: ${normalizedId}`);
    console.log(`   - Title: ${updatedBlog.title}`);
    console.log(`   - Updated At: ${updatedBlog.updatedAt}`);
    console.log(
      `   - Content length: ${updatedBlog.content?.length || 0} characters`
    );
    console.log(`📋 Data source: MongoDB (blogs collection)\n`);

    res.json({
      success: true,
      message: "Cập nhật bài viết thành công",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("❌ [Blogs] Error updating blog:", error);
    console.error("❌ Error details:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật bài viết",
      error: error.message,
    });
  }
});

// DELETE /api/blogs/:id - Xóa blog
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBlog = await Blog.findOneAndDelete({ id: id });

    if (!deletedBlog) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    res.json({
      success: true,
      message: "Xóa bài viết thành công",
      data: deletedBlog,
    });
  } catch (error) {
    // console.error(" [Blogs] Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa bài viết",
      error: error.message,
    });
  }
});
