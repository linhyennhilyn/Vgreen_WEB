/**
 * Service tổng hợp để đồng bộ tất cả collections từ MongoDB về JSON files
 * Gộp code từ sync-users.service.js, sync-products.service.js, sync-blogs.service.js
 */

const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// SYNC USERS
// ============================================================================

/**
 * Đồng bộ users từ MongoDB về JSON file (async)
 * @param {Object} usersCollection - MongoDB collection của users
 */
async function syncUsersToJsonAsync(usersCollection) {
  try {
    // Chạy sync trong background, không chờ kết quả
    syncUsersToJson(usersCollection).catch(error => {
      console.error('[Sync Users] Error in async sync:', error);
    });
  } catch (error) {
    console.error('[Sync Users] Error syncing users:', error);
  }
}

/**
 * Đồng bộ users từ MongoDB về JSON file
 * @param {Object} usersCollection - MongoDB collection của users
 * @returns {Promise<Object>} - Kết quả sync
 */
async function syncUsersToJson(usersCollection) {
  try {
    console.log('\n🔄 [Sync Users] ============================================');
    console.log('[Sync Users] Bắt đầu đồng bộ users từ MongoDB về JSON...');
    
    // Lấy tất cả users từ MongoDB
    const users = await usersCollection.find({}).toArray();
    const count = users.length;
    
    console.log(`[Sync Users] Đã lấy ${count} users từ MongoDB`);
    
    if (count === 0) {
      console.log('[Sync Users] ⚠️  Không có users nào trong MongoDB');
      return {
        success: true,
        count: 0,
        message: 'No users to sync'
      };
    }
    
    // Đường dẫn đến file JSON
    const jsonFilePath = path.join(__dirname, '../../data/users.json');
    console.log(`[Sync Users] Đường dẫn file JSON: ${jsonFilePath}`);
    
    // Chuyển đổi users từ MongoDB format sang JSON format
    console.log('[Sync Users] Đang chuyển đổi dữ liệu...');
    const usersForJson = users.map((user, index) => {
      const userCopy = { ...user };
      
      // Đảm bảo _id là string
      if (userCopy._id && typeof userCopy._id !== 'string') {
        userCopy._id = userCopy._id.toString();
      }
      
      // Xử lý RegisterDate: chuyển Date object sang MongoDB date format nếu cần
      if (userCopy.RegisterDate) {
        if (userCopy.RegisterDate instanceof Date) {
          userCopy.RegisterDate = {
            $date: userCopy.RegisterDate.toISOString()
          };
        } else if (typeof userCopy.RegisterDate === 'string') {
          try {
            const date = new Date(userCopy.RegisterDate);
            if (!isNaN(date.getTime())) {
              userCopy.RegisterDate = {
                $date: date.toISOString()
              };
            }
          } catch (e) {
            // Giữ nguyên nếu không parse được
          }
        }
      }
      
      // Xử lý BirthDay
      if (userCopy.BirthDay) {
        if (userCopy.BirthDay instanceof Date) {
          userCopy.BirthDay = {
            $date: userCopy.BirthDay.toISOString()
          };
        }
      }
      
      // Log một vài users đầu tiên để debug
      if (index < 3) {
        console.log(`[Sync Users] Sample user ${index + 1}: ${userCopy.CustomerID || userCopy.customer_id} - ${userCopy.FullName || userCopy.full_name || 'N/A'}`);
      }
      
      return userCopy;
    });
    
    // Ghi vào file JSON
    console.log('[Sync Users] Đang ghi vào file JSON...');
    const jsonContent = JSON.stringify(usersForJson, null, '\t');
    
    // Ghi file với flag 'w' để đảm bảo ghi đè
    await fs.writeFile(jsonFilePath, jsonContent, { encoding: 'utf8', flag: 'w' });
    
    // Đợi một chút để đảm bảo file được ghi hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Xác minh file đã được ghi
    const stats = await fs.stat(jsonFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`[Sync Users] ✅ File đã được ghi: ${fileSizeKB} KB`);
    
    // Đọc lại file để xác minh
    const verifyContent = await fs.readFile(jsonFilePath, 'utf8');
    const verifyData = JSON.parse(verifyContent);
    console.log(`[Sync Users] ✅ Xác minh: File chứa ${verifyData.length} users`);
    
    console.log(`[Sync Users] ✅ Đã đồng bộ ${count} users từ MongoDB về JSON`);
    console.log('[Sync Users] ============================================\n');
    
    return {
      success: true,
      count: count,
      message: `Đã đồng bộ ${count} users`
    };
  } catch (error) {
    console.error('\n❌ [Sync Users] Error syncing users:');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('============================================\n');
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
}

// ============================================================================
// SYNC PRODUCTS
// ============================================================================

/**
 * Đồng bộ products từ MongoDB về JSON file (async)
 * @param {Object} productsCollection - MongoDB collection của products
 */
async function syncProductsToJsonAsync(productsCollection) {
  try {
    // Chạy sync trong background, không chờ kết quả
    syncProductsToJson(productsCollection).catch(error => {
      console.error('[Sync Products] Error in async sync:', error);
    });
  } catch (error) {
    console.error('[Sync Products] Error syncing products:', error);
  }
}

/**
 * Đồng bộ products từ MongoDB về JSON file
 * @param {Object} productsCollection - MongoDB collection của products
 * @returns {Promise<Object>} - Kết quả sync
 */
async function syncProductsToJson(productsCollection) {
  try {
    console.log('\n🔄 [Sync Products] ============================================');
    console.log('[Sync Products] Bắt đầu đồng bộ products từ MongoDB về JSON...');
    
    // Lấy tất cả products từ MongoDB
    const products = await productsCollection.find({}).toArray();
    const count = products.length;
    
    console.log(`[Sync Products] Đã lấy ${count} products từ MongoDB`);
    
    if (count === 0) {
      console.log('[Sync Products] ⚠️  Không có products nào trong MongoDB');
      return {
        success: true,
        count: 0,
        message: 'No products to sync'
      };
    }
    
    // Đường dẫn đến file JSON
    const jsonFilePath = path.join(__dirname, '../../data/products.json');
    console.log(`[Sync Products] Đường dẫn file JSON: ${jsonFilePath}`);
    
    // Kiểm tra file có tồn tại không
    const fsSync = require('fs');
    const fileExists = fsSync.existsSync(jsonFilePath);
    console.log(`[Sync Products] File JSON ${fileExists ? 'tồn tại' : 'KHÔNG tồn tại'}`);
    
    // Chuyển đổi products từ MongoDB format sang JSON format
    console.log('[Sync Products] Đang chuyển đổi dữ liệu...');
    const productsForJson = products.map((product, index) => {
      const productCopy = { ...product };
      
      // Đảm bảo _id là string
      if (productCopy._id && typeof productCopy._id !== 'string') {
        productCopy._id = productCopy._id.toString();
      }
      
      // Xử lý post_date: chuyển Date object sang MongoDB date format nếu cần
      if (productCopy.post_date) {
        if (productCopy.post_date instanceof Date) {
          productCopy.post_date = {
            $date: productCopy.post_date.toISOString()
          };
        } else if (typeof productCopy.post_date === 'string') {
          try {
            const date = new Date(productCopy.post_date);
            if (!isNaN(date.getTime())) {
              productCopy.post_date = {
                $date: date.toISOString()
              };
            }
          } catch (e) {
            // Giữ nguyên nếu không parse được
          }
        }
      }
      
      // Đảm bảo image là array
      if (productCopy.image && !Array.isArray(productCopy.image)) {
        productCopy.image = [productCopy.image];
      }
      
      // Đảm bảo các trường số là number
      if (productCopy.price !== undefined) {
        productCopy.price = Number(productCopy.price) || 0;
      }
      if (productCopy.base_price !== undefined) {
        productCopy.base_price = Number(productCopy.base_price) || 0;
      }
      if (productCopy.stock !== undefined) {
        productCopy.stock = Number(productCopy.stock) || 0;
      }
      if (productCopy.rating !== undefined) {
        productCopy.rating = Number(productCopy.rating) || 0;
      }
      if (productCopy.purchase_count !== undefined) {
        productCopy.purchase_count = Number(productCopy.purchase_count) || 0;
      }
      if (productCopy.liked !== undefined) {
        productCopy.liked = Number(productCopy.liked) || 0;
      }
      
      // Log một vài sản phẩm đầu tiên để debug
      if (index < 3) {
        console.log(`[Sync Products] Sample product ${index + 1}: ${productCopy.product_name || productCopy.productName} (stock: ${productCopy.stock}, price: ${productCopy.price})`);
      }
      
      return productCopy;
    });
    
    // Ghi vào file JSON
    console.log('[Sync Products] Đang ghi vào file JSON...');
    const jsonContent = JSON.stringify(productsForJson, null, '\t');
    
    // Ghi file với flag 'w' để đảm bảo ghi đè
    await fs.writeFile(jsonFilePath, jsonContent, { encoding: 'utf8', flag: 'w' });
    
    // Đợi một chút để đảm bảo file được ghi hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Xác minh file đã được ghi
    const stats = await fs.stat(jsonFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`[Sync Products] ✅ File đã được ghi: ${fileSizeKB} KB`);
    
    // Đọc lại file để xác minh
    const verifyContent = await fs.readFile(jsonFilePath, 'utf8');
    const verifyData = JSON.parse(verifyContent);
    console.log(`[Sync Products] ✅ Xác minh: File chứa ${verifyData.length} products`);
    
    console.log(`[Sync Products] ✅ Đã đồng bộ ${count} products từ MongoDB về JSON`);
    console.log('[Sync Products] ============================================\n');
    
    return {
      success: true,
      count: count,
      message: `Đã đồng bộ ${count} products`
    };
  } catch (error) {
    console.error('\n❌ [Sync Products] Error syncing products:');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('============================================\n');
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
}

// ============================================================================
// SYNC BLOGS
// ============================================================================

/**
 * Đồng bộ blogs từ MongoDB về JSON file (async - không chờ kết quả)
 * @param {Object} blogsCollection - MongoDB collection của blogs
 */
async function syncBlogsToJsonAsync(blogsCollection) {
  try {
    // Chạy sync trong background, không chờ kết quả
    syncBlogsToJson(blogsCollection).catch(error => {
      console.error('[Sync Blogs] Error in async sync:', error);
    });
  } catch (error) {
    console.error('[Sync Blogs] Error syncing blogs:', error);
  }
}

/**
 * Đồng bộ blogs từ MongoDB về JSON file
 * @param {Object} blogsCollection - MongoDB collection của blogs
 * @returns {Promise<Object>} - Kết quả sync
 */
async function syncBlogsToJson(blogsCollection) {
  try {
    console.log('\n🔄 [Sync Blogs] ============================================');
    console.log('[Sync Blogs] Bắt đầu đồng bộ blogs từ MongoDB về JSON...');
    
    // Lấy tất cả blogs từ MongoDB (chỉ lấy blogs có status Active hoặc không có status)
    // Sort theo pubDate: -1 (mới nhất trước) để đồng nhất với API response
    const blogs = await blogsCollection.find({
      $or: [
        { status: 'Active' },
        { status: { $exists: false } },
        { status: null }
      ]
    }).sort({ pubDate: -1 }).toArray();
    const count = blogs.length;
    
    console.log(`[Sync Blogs] Đã lấy ${count} blogs từ MongoDB`);
    
    if (count === 0) {
      console.log('[Sync Blogs] ⚠️  Không có blogs nào trong MongoDB');
      return {
        success: true,
        count: 0,
        message: 'No blogs to sync'
      };
    }
    
    // Đường dẫn đến file JSON - sync vào data/blogs.json để đồng nhất với frontend
    const jsonFilePath = path.join(__dirname, '../../data/blogs.json');
    console.log(`[Sync Blogs] Đường dẫn file JSON: ${jsonFilePath}`);
    
    // Tạo thư mục nếu chưa tồn tại
    const dir = path.dirname(jsonFilePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Thư mục đã tồn tại, bỏ qua
    }
    
    // Chuyển đổi blogs từ MongoDB format sang JSON format
    console.log('[Sync Blogs] Đang chuyển đổi dữ liệu...');
    const blogsForJson = blogs.map((blog, index) => {
      const blogCopy = { ...blog };
      
      // Đảm bảo _id là string
      if (blogCopy._id && typeof blogCopy._id !== 'string') {
        blogCopy._id = blogCopy._id.toString();
      }
      
      // Xử lý pubDate: chuyển Date object sang MongoDB date format nếu cần
      if (blogCopy.pubDate) {
        if (blogCopy.pubDate instanceof Date) {
          blogCopy.pubDate = {
            $date: blogCopy.pubDate.toISOString()
          };
        } else if (typeof blogCopy.pubDate === 'string') {
          try {
            const date = new Date(blogCopy.pubDate);
            if (!isNaN(date.getTime())) {
              blogCopy.pubDate = {
                $date: date.toISOString()
              };
            }
          } catch (e) {
            // Giữ nguyên nếu không parse được
          }
        }
      }
      
      // Xử lý createdAt và updatedAt
      if (blogCopy.createdAt) {
        if (blogCopy.createdAt instanceof Date) {
          blogCopy.createdAt = {
            $date: blogCopy.createdAt.toISOString()
          };
        }
      }
      
      if (blogCopy.updatedAt) {
        if (blogCopy.updatedAt instanceof Date) {
          blogCopy.updatedAt = {
            $date: blogCopy.updatedAt.toISOString()
          };
        }
      }
      
      // Đảm bảo các trường số là number
      if (blogCopy.views !== undefined) {
        blogCopy.views = Number(blogCopy.views) || 0;
      }
      
      // Log một vài blogs đầu tiên để debug
      if (index < 3) {
        console.log(`[Sync Blogs] Sample blog ${index + 1}: ${blogCopy.title} (id: ${blogCopy.id}, status: ${blogCopy.status || 'N/A'})`);
      }
      
      return blogCopy;
    });
    
    // Ghi vào file JSON
    console.log('[Sync Blogs] Đang ghi vào file JSON...');
    const jsonContent = JSON.stringify(blogsForJson, null, '\t');
    
    // Ghi file với flag 'w' để đảm bảo ghi đè
    await fs.writeFile(jsonFilePath, jsonContent, { encoding: 'utf8', flag: 'w' });
    
    // Đợi một chút để đảm bảo file được ghi hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Xác minh file đã được ghi
    const stats = await fs.stat(jsonFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`[Sync Blogs] ✅ File đã được ghi: ${fileSizeKB} KB`);
    
    // Đọc lại file để xác minh
    const verifyContent = await fs.readFile(jsonFilePath, 'utf8');
    const verifyData = JSON.parse(verifyContent);
    console.log(`[Sync Blogs] ✅ Xác minh: File chứa ${verifyData.length} blogs`);
    
    console.log(`[Sync Blogs] ✅ Đã đồng bộ ${count} blogs từ MongoDB về JSON`);
    console.log('[Sync Blogs] ============================================\n');
    
    return {
      success: true,
      count: count,
      message: `Đã đồng bộ ${count} blogs`
    };
  } catch (error) {
    console.error('\n❌ [Sync Blogs] Error syncing blogs:');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('============================================\n');
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
}

// ============================================================================
// SYNC ALL COLLECTIONS
// ============================================================================

/**
 * Đồng bộ tất cả collections từ MongoDB về JSON files (async)
 * @param {Object} db - MongoDB database instance
 * @param {Object} collections - Object chứa các collections (usersCollection, productsCollection, blogsCollection)
 */
async function syncAllCollectionsToJsonAsync(db, collections = {}) {
  try {
    // Chạy sync tất cả collections trong background
    syncAllCollectionsToJson(db, collections).catch(error => {
      console.error('[Sync All Collections] Error in async sync:', error);
    });
  } catch (error) {
    console.error('[Sync All Collections] Error syncing collections:', error);
  }
}

/**
 * Đồng bộ tất cả collections từ MongoDB về JSON files
 * @param {Object} db - MongoDB database instance
 * @param {Object} collections - Object chứa các collections (usersCollection, productsCollection, blogsCollection)
 * @returns {Promise<Object>} - Kết quả sync
 */
async function syncAllCollectionsToJson(db, collections = {}) {
  try {
    console.log('\n🔄 [Sync All Collections] ============================================');
    console.log('[Sync All Collections] Bắt đầu đồng bộ tất cả collections...');
    
    const results = {};
    
    // Sync users nếu có collection
    if (collections.usersCollection) {
      console.log('[Sync All Collections] Đang đồng bộ users...');
      results.users = await syncUsersToJson(collections.usersCollection);
    }
    
    // Sync products nếu có collection
    if (collections.productsCollection) {
      console.log('[Sync All Collections] Đang đồng bộ products...');
      results.products = await syncProductsToJson(collections.productsCollection);
    }
    
    // Sync blogs nếu có collection
    if (collections.blogsCollection) {
      console.log('[Sync All Collections] Đang đồng bộ blogs...');
      results.blogs = await syncBlogsToJson(collections.blogsCollection);
    }
    
    console.log('[Sync All Collections] ✅ Hoàn tất đồng bộ tất cả collections');
    console.log('[Sync All Collections] ============================================\n');
    
    return {
      success: true,
      results: results,
      message: 'Đã đồng bộ tất cả collections'
    };
  } catch (error) {
    console.error('\n❌ [Sync All Collections] Error syncing collections:');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('============================================\n');
    return {
      success: false,
      error: error.message,
      results: {}
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Users sync
  syncUsersToJsonAsync,
  syncUsersToJson,
  // Products sync
  syncProductsToJsonAsync,
  syncProductsToJson,
  // Blogs sync
  syncBlogsToJsonAsync,
  syncBlogsToJson,
  // All collections sync
  syncAllCollectionsToJsonAsync,
  syncAllCollectionsToJson
};

