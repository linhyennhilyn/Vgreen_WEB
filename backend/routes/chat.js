const express = require("express");
const router = express.Router();
const { ChatConversation, Product } = require("../db");
const axios = require("axios");

/**
 * POST /api/chat/message - Gửi tin nhắn và nhận phản hồi từ AI
 */
router.post("/message", async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tin nhắn không được để trống",
      });
    }

    // Tạo hoặc lấy conversation
    const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let conversation = await ChatConversation.findOne({ sessionId: session });
    
    if (!conversation) {
      conversation = new ChatConversation({
        sessionId: session,
        userId: userId || null,
        messages: [],
      });
    }

    // Thêm tin nhắn người dùng vào conversation
    conversation.messages.push({
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    });

    // Lấy conversation history (giới hạn 10 tin nhắn gần nhất để giữ context)
    const recentMessages = conversation.messages.slice(-10);
    
    // Kiểm tra xem có phải câu hỏi về gợi ý sản phẩm không
    const lowerMessage = message.toLowerCase().trim();
    
    // Mở rộng pattern để nhận diện nhiều cách hỏi hơn, bao gồm "muốn mua", "tìm", "gợi ý"
    const productRequestPatterns = [
      /gợi\s*ý|đề\s*xuất|tìm\s+sản\s+phẩm|sản\s+phẩm\s+về|sản\s+phẩm\s+để|mua\s+sản\s+phẩm|sản\s+phẩm\s+nào|cho\s+tôi\s+xem|cho\s+tôi|hiển\s+thị\s+sản\s+phẩm|danh\s+sách\s+sản\s+phẩm|sản\s+phẩm\s+cho|sản\s+phẩm\s+nấu|nấu\s+ăn/i,
      /(?:tôi\s+)?muốn\s+mua|(?:tôi\s+)?cần\s+mua|(?:tôi\s+)?muốn\s+tìm|(?:tôi\s+)?cần\s+tìm/i, // "tôi muốn mua cà"
      /(?:cho\s+tôi|gợi\s*ý|đề\s*xuất)\s+(?:một\s+số|vài|và)?\s*sản\s+phẩm/i, // "gợi ý cho tôi một số sản phẩm về"
    ];
    
    const isProductRecommendationRequest = 
      productRequestPatterns.some(pattern => pattern.test(lowerMessage)) ||
      (lowerMessage.includes('sản phẩm') && (lowerMessage.includes('gợi') || lowerMessage.includes('đề xuất') || lowerMessage.includes('tìm') || lowerMessage.includes('cho') || lowerMessage.includes('nấu') || lowerMessage.includes('mua'))) ||
      (lowerMessage.includes('mua') && !lowerMessage.includes('đơn hàng') && !lowerMessage.includes('hóa đơn')); // "muốn mua cà"
    
    console.log(" [Chat] Checking product recommendation request:");
    console.log(" [Chat] Message:", lowerMessage);
    console.log(" [Chat] Is product request:", !!isProductRecommendationRequest);
    
    // Nếu là câu hỏi về gợi ý sản phẩm, tìm kiếm sản phẩm
    let suggestedProducts = [];
    if (isProductRecommendationRequest) {
      try {
        // Trích xuất từ khóa từ câu hỏi
        const keywords = extractProductKeywords(lowerMessage);
        console.log(" [Chat] Product recommendation request detected. Keywords:", keywords);
        
        // Tìm kiếm sản phẩm
        // Thử tìm với status "Active" trước, nếu không có thì tìm không có điều kiện status
        let searchQuery = {};
        
        // Thêm điều kiện status nếu có field status trong schema
        // Nhưng không bắt buộc vì có thể schema không có field này
        const hasStatusField = await Product.findOne().select('status').lean().then(p => p && 'status' in p).catch(() => false);
        if (hasStatusField) {
          searchQuery.status = "Active";
        }
        
        if (keywords.length > 0) {
          // Tìm theo tên sản phẩm, category, subcategory
          const orConditions = [];
          keywords.forEach(keyword => {
            orConditions.push(
              { product_name: { $regex: keyword, $options: "i" } },
              { productName: { $regex: keyword, $options: "i" } },
              { ProductName: { $regex: keyword, $options: "i" } }, // Thêm ProductName với P hoa
              { category: { $regex: keyword, $options: "i" } },
              { Category: { $regex: keyword, $options: "i" } }, // Thêm Category với C hoa
              { subcategory: { $regex: keyword, $options: "i" } },
              { Subcategory: { $regex: keyword, $options: "i" } }, // Thêm Subcategory với S hoa
              { brand: { $regex: keyword, $options: "i" } },
              { Brand: { $regex: keyword, $options: "i" } } // Thêm Brand với B hoa
            );
          });
          searchQuery.$or = orConditions;
        }
        
        console.log(" [Chat] Search query:", JSON.stringify(searchQuery, null, 2));
        
        // Thử tìm với query có status
        suggestedProducts = await Product.find(searchQuery)
          .limit(12)
          .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
          .lean();
        
        console.log(` [Chat] Found ${suggestedProducts.length} products with query (with status)`);
        
        // Nếu không tìm thấy và có điều kiện status, thử tìm không có status
        if (suggestedProducts.length === 0 && hasStatusField && searchQuery.status) {
          console.log(" [Chat] No products found with status, trying without status filter");
          const queryWithoutStatus = { ...searchQuery };
          delete queryWithoutStatus.status;
          suggestedProducts = await Product.find(queryWithoutStatus)
            .limit(12)
            .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
            .lean();
          console.log(` [Chat] Found ${suggestedProducts.length} products without status filter`);
        }
        
        // Nếu vẫn không tìm thấy, lấy tất cả sản phẩm (fallback cuối cùng)
        if (suggestedProducts.length === 0) {
          console.log(" [Chat] No products found, fetching all products as final fallback");
          suggestedProducts = await Product.find({})
            .limit(12)
            .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
            .lean();
          console.log(` [Chat] Found ${suggestedProducts.length} products in final fallback`);
        }
      } catch (productError) {
        console.error(" [Chat] Error searching products:", productError);
        // Thử lấy tất cả sản phẩm nếu có lỗi
        try {
          suggestedProducts = await Product.find({ status: "Active" })
            .limit(12)
            .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
            .lean();
          console.log(` [Chat] Fetched ${suggestedProducts.length} products after error`);
        } catch (fallbackError) {
          console.error(" [Chat] Error fetching fallback products:", fallbackError);
        }
      }
    }
    
    // Tạo system prompt với context về VGreen
    const systemPrompt = `Bạn là Veebot, trợ lý ảo thân thiện và chuyên nghiệp của VGreen - một cửa hàng thực phẩm sạch và hữu cơ tại Việt Nam.

Thông tin về VGreen:
- VGreen cung cấp các sản phẩm thực phẩm sạch, hữu cơ, rau củ quả tươi, trái cây, thực phẩm khô, trà và cà phê
- Hotline: 0125 456 789
- Email: vgreenhotro@gmail.com
- VGreen có chính sách giao hàng toàn quốc, thời gian giao hàng 1-3 ngày
- Chính sách đổi trả trong vòng 7 ngày nếu sản phẩm không đúng chất lượng
- Miễn phí giao hàng cho đơn từ 200.000₫

Nhiệm vụ của bạn:
1. Trả lời các câu hỏi về sản phẩm, đơn hàng, giao hàng, đổi trả, và các dịch vụ của VGreen
2. Hỗ trợ khách hàng một cách thân thiện, nhiệt tình và chuyên nghiệp
3. Sử dụng ngôn ngữ tiếng Việt tự nhiên, dễ hiểu
4. Nếu không biết câu trả lời, hãy hướng dẫn khách hàng liên hệ hotline hoặc email
5. Giữ cuộc hội thoại ngắn gọn, súc tích nhưng đầy đủ thông tin
6. **QUAN TRỌNG**: Khi khách hàng hỏi về gợi ý sản phẩm (ví dụ: "gợi ý sản phẩm", "tìm sản phẩm", "sản phẩm để nấu"), hãy trả lời ngắn gọn và tự nhiên, ví dụ: 
   - "Tôi đã tìm thấy một số sản phẩm phù hợp cho bạn:"
   - "Dưới đây là các sản phẩm gợi ý:"
   - "Đây là một số sản phẩm bạn có thể tham khảo:"
   Không cần liệt kê chi tiết từng sản phẩm trong text, vì danh sách sản phẩm sẽ được hiển thị riêng.

Hãy trả lời câu hỏi của khách hàng một cách tự nhiên và hữu ích.`;

    // Chuẩn bị messages cho AI API
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Gọi AI API (sử dụng OpenAI, Google Gemini, hoặc Hugging Face - FREE)
    let aiResponse = "";
    
    try {
      // Option 1: Sử dụng OpenAI API
      if (process.env.OPENAI_API_KEY) {
        const openaiResponse = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
            messages: messagesForAI,
            temperature: 0.7,
            max_tokens: 500,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );
        
        aiResponse = openaiResponse.data.choices[0].message.content;
      }
      // Option 2: Sử dụng Google Gemini API (FREE tier - KHÔNG CẦN BILLING)
      else if (process.env.GEMINI_API_KEY) {
        console.log(" [Chat] Using Google Gemini API (FREE tier - no billing required)");
        console.log(" [Chat] User message:", message);
        
        // Format messages cho Gemini API
        // Gemini sử dụng format khác: system instruction trong phần đầu, sau đó là user/assistant messages
        const systemMessage = messagesForAI.find((msg) => msg.role === "system");
        const conversationMessages = messagesForAI.filter((msg) => msg.role !== "system");
        
        // Convert messages sang format Gemini
        // Gemini yêu cầu format: user message đầu tiên phải có system instruction
        const geminiContents = [];
        
        conversationMessages.forEach((msg, index) => {
          if (msg.role === "assistant") {
            geminiContents.push({
              role: "model",
              parts: [{ text: msg.content }],
            });
          } else {
            // Thêm system prompt vào user message đầu tiên
            if (index === 0 && systemMessage) {
              geminiContents.push({
                role: "user",
                parts: [{ text: `${systemMessage.content}\n\n${msg.content}` }],
              });
            } else {
              geminiContents.push({
                role: "user",
                parts: [{ text: msg.content }],
              });
            }
          }
        });

        // Sử dụng Gemini model (free tier)
        // Google Gemini API models (2024):
        // - v1: gemini-pro (stable, recommended for free tier)
        // - v1beta: gemini-1.5-flash, gemini-1.5-pro (newer, but may require specific format)
        // Thử sử dụng v1 với gemini-pro trước (ổn định nhất)
        let geminiModel = process.env.GEMINI_MODEL || "gemini-pro";
        
        // Nếu model trong env là gemini-1.5-flash, chuyển sang gemini-pro (ổn định hơn)
        if (geminiModel.includes('1.5') || geminiModel.includes('flash')) {
          console.log(` [Chat] ⚠️ Model ${geminiModel} may not be available, using gemini-pro instead`);
          geminiModel = "gemini-pro";
        }
        
        // Sử dụng v1 API (ổn định nhất)
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const useV1Beta = false;
        
        console.log(` [Chat] Calling Gemini API with model: ${geminiModel}`);
        console.log(` [Chat] Using API version: v1 (stable)`);
        console.log(` [Chat] User message: "${message}"`);
        console.log(` [Chat] Conversation history length: ${conversationMessages.length}`);
        
        try {
          const geminiResponse = await axios.post(
            apiUrl,
            {
              contents: geminiContents,
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 30000, // 30 seconds timeout
            }
          );
          
          if (geminiResponse.data && geminiResponse.data.candidates && geminiResponse.data.candidates[0]) {
            aiResponse = geminiResponse.data.candidates[0].content.parts[0].text;
            console.log(" [Chat] ✅ Gemini API response received successfully");
            console.log(` [Chat] Response length: ${aiResponse.length} characters`);
          } else {
            console.error(" [Chat] ❌ Gemini API returned no candidates");
            console.error(" [Chat] Response data:", JSON.stringify(geminiResponse.data, null, 2));
            throw new Error("No response from Gemini API");
          }
        } catch (geminiError) {
          // Nếu lỗi API, fallback về improved response (không thử các model khác nữa vì có thể API key không hợp lệ)
          console.error(" [Chat] ❌ Gemini API error:", geminiError.response?.data || geminiError.message);
          console.error(" [Chat] Error status:", geminiError.response?.status);
          console.error(" [Chat] Error details:", geminiError.response?.statusText);
          console.log(" [Chat] Falling back to improved keyword-based response");
          // Throw để fallback về improved response
          throw geminiError;
        }
      }
      // Option 3: Sử dụng Improved Fallback Response (FREE - không cần API key)
      // Fallback response đã được cải thiện để trả lời tự nhiên hơn
      else {
        console.log(" [Chat] Using improved fallback response (no AI API key configured)");
        aiResponse = generateFallbackResponse(message, recentMessages);
      }
    } catch (aiError) {
      console.error(" [Chat] Error calling AI API:", aiError.response?.data || aiError.message);
      console.log(" [Chat] Falling back to improved keyword-based response");
      console.log(" [Chat] User message:", message);
      // Fallback to improved keyword-based response
      aiResponse = generateFallbackResponse(message, recentMessages);
      console.log(" [Chat] Fallback response generated, length:", aiResponse.length);
    }

    // Thêm phản hồi AI vào conversation
    conversation.messages.push({
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
    });

    // Lưu conversation
    conversation.updatedAt = new Date();
    await conversation.save();

    // Trả về phản hồi (có thể kèm danh sách sản phẩm nếu có)
    const responseData = {
      message: aiResponse,
      sessionId: conversation.sessionId,
    };
    
    // Nếu là request về sản phẩm, LUÔN trả về sản phẩm (kể cả khi không tìm thấy với keyword)
    if (isProductRecommendationRequest) {
      // Nếu chưa có sản phẩm nào, lấy tất cả sản phẩm (fallback cuối cùng)
      if (suggestedProducts.length === 0) {
        console.log(" [Chat] No products found, fetching all products as final fallback");
        try {
          // Thử tìm với status Active trước
          suggestedProducts = await Product.find({ status: "Active" })
            .limit(12)
            .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
            .lean();
          
          // Nếu không có, tìm tất cả
          if (suggestedProducts.length === 0) {
            suggestedProducts = await Product.find({})
              .limit(12)
              .select("_id sku product_name productName ProductName category Category subcategory Subcategory price Price image Image brand Brand")
              .lean();
          }
          
          console.log(` [Chat] Fetched ${suggestedProducts.length} products as final fallback`);
        } catch (fallbackError) {
          console.error(" [Chat] Error fetching fallback products:", fallbackError);
        }
      }
      
      // Thêm sản phẩm vào response
      if (suggestedProducts.length > 0) {
        responseData.products = suggestedProducts.map(p => {
          // Hỗ trợ cả lowercase và uppercase field names
          const productName = p.product_name || p.productName || p.ProductName || p.sku || 'Sản phẩm';
          const category = p.category || p.Category || '';
          const subcategory = p.subcategory || p.Subcategory || '';
          const price = p.price || p.Price || 0;
          const image = p.image || p.Image;
          const brand = p.brand || p.Brand || '';
          
          // Xử lý image: có thể là array hoặc string
          let imageUrl = '';
          if (Array.isArray(image) && image.length > 0) {
            imageUrl = image[0];
          } else if (typeof image === 'string' && image.trim() !== '') {
            imageUrl = image;
          }
          
          return {
            _id: p._id.toString(),
            sku: p.sku || '',
            name: productName,
            category: category,
            subcategory: subcategory,
            price: price,
            image: imageUrl,
            brand: brand,
          };
        });
        console.log(` [Chat] ✅ Including ${responseData.products.length} products in response`);
      } else {
        console.log(" [Chat] ⚠️ No products available in database");
      }
    }
    
    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xử lý tin nhắn",
      error: error.message,
    });
  }
});

/**
 * Trích xuất từ khóa sản phẩm từ câu hỏi
 */
function extractProductKeywords(message) {
  const keywords = [];
  const lowerMessage = message.toLowerCase().trim();
  
  // Danh sách stop words (từ không có ý nghĩa trong tìm kiếm)
  const stopWords = new Set([
    'tôi', 'bạn', 'cho', 'một', 'số', 'vài', 'về', 'và', 'của', 'với', 'có', 'là', 'để', 'trong', 'trên', 'dưới',
    'gợi', 'ý', 'đề', 'xuất', 'tìm', 'mua', 'sản', 'phẩm', 'cần', 'muốn', 'xem', 'hiển', 'thị', 'danh', 'sách',
    'nào', 'gì', 'đâu', 'bao', 'nhiêu', 'thế', 'nào', 'làm', 'sao', 'khi', 'nếu', 'thì', 'mà', 'nhưng', 'hoặc'
  ]);
  
  // Danh sách từ khóa sản phẩm phổ biến (ưu tiên tìm từ dài trước)
  const commonKeywords = [
    'rau củ quả', 'rau củ', 'rau', 'củ', 
    'trái cây', 'hoa quả', 'quả',
    'thực phẩm khô', 'thực phẩm', 'khô',
    'cà phê', 'cà', 'cacao', 'ca cao',
    'trà', 'đồ uống',
    'hữu cơ', 'organic',
    'tươi sống', 'tươi',
    'sạch', 'an toàn',
    'nấu ăn', 'nấu', 'món ăn', 'món',
    'thịt', 'cá', 'tôm', 'gà',
    'gia vị', 'nước mắm', 'dầu ăn',
  ];
  
  // 1. Tìm các từ khóa phổ biến trong câu hỏi (ưu tiên từ dài)
  const sortedKeywords = commonKeywords.sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeywords) {
    if (lowerMessage.includes(keyword)) {
      keywords.push(keyword);
      // Loại bỏ từ khóa đã tìm thấy khỏi message để tránh trùng lặp
      break; // Chỉ lấy từ khóa dài nhất phù hợp
    }
  }
  
  // 2. Nếu không tìm thấy từ khóa phổ biến, trích xuất từ sau các từ khóa chỉ định
  if (keywords.length === 0) {
    // Pattern: lấy phần sau "về", "mua", "tìm", "gợi ý"
    const extractPatterns = [
      /(?:về|mua|tìm|gợi\s*ý|đề\s*xuất|cho)\s+(?:tôi\s+)?(?:một\s+số\s+)?(?:sản\s+phẩm\s+)?(?:về\s+)?(.+?)(?:\?|\.|$)/i,
      /sản\s+phẩm\s+(?:về|cho|để)\s+(.+?)(?:\?|\.|$)/i,
      /(?:muốn|cần)\s+(?:mua|tìm)\s+(.+?)(?:\?|\.|$)/i, // "muốn mua cà"
    ];
    
    for (const pattern of extractPatterns) {
      const match = lowerMessage.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim();
        
        // Loại bỏ stop words và các từ không cần thiết
        const words = extracted.split(/\s+/).filter(word => {
          const cleanWord = word.replace(/[.,!?]/g, '');
          return cleanWord.length > 1 && !stopWords.has(cleanWord);
        });
        
        if (words.length > 0) {
          // Lấy từ khóa (có thể là 1-3 từ)
          const keyword = words.slice(0, 3).join(' ');
          if (keyword.length > 1) {
            keywords.push(keyword);
            break;
          }
        }
      }
    }
  }
  
  // 3. Xử lý các trường hợp đặc biệt
  // "tôi muốn mua cà" -> "cà phê" (vì "cà" thường ám chỉ cà phê trong context mua sắm)
  if (keywords.length === 0 || (keywords.length === 1 && keywords[0] === 'cà')) {
    if (lowerMessage.includes('mua cà') || lowerMessage.includes('tìm cà') || lowerMessage.match(/\bcà\s*$/)) {
      // Nếu chỉ có "cà" mà không có "cà phê" rõ ràng, mặc định là "cà phê"
      if (!lowerMessage.includes('cà phê') && !lowerMessage.includes('cacao') && !lowerMessage.includes('ca cao')) {
        // Thay thế "cà" bằng "cà phê" để tìm kiếm chính xác hơn
        const index = keywords.indexOf('cà');
        if (index !== -1) {
          keywords[index] = 'cà phê';
        } else {
          keywords.push('cà phê');
        }
        console.log(" [Chat] Expanded 'cà' to 'cà phê' for better search results");
      }
    }
    
    // "sản phẩm về rau" -> "rau"
    if (lowerMessage.match(/về\s+(rau|củ|trái\s*cây|hoa\s*quả)/i)) {
      const match = lowerMessage.match(/về\s+(rau|củ|trái\s*cây|hoa\s*quả)/i);
      if (match && match[1]) {
        const extractedKeyword = match[1].trim();
        // Chỉ thêm nếu chưa có
        if (!keywords.includes(extractedKeyword)) {
          keywords.push(extractedKeyword);
        }
      }
    }
  }
  
  // 4. Mở rộng từ khóa ngắn thành từ khóa đầy đủ hơn (sau khi xử lý đặc biệt)
  // "cà" -> "cà phê", "rau" -> "rau củ"
  const keywordExpansions = {
    'cà': 'cà phê',
    'rau': 'rau củ',
  };
  
  const expandedKeywords = keywords.map(k => {
    const lowerK = k.toLowerCase().trim();
    // Nếu từ khóa đã được mở rộng ở bước 3 (cà -> cà phê), không mở rộng lại
    if (lowerK === 'cà phê' || lowerK === 'rau củ') {
      return k.trim();
    }
    return keywordExpansions[lowerK] || k.trim();
  });
  
  // 5. Loại bỏ các từ khóa trùng lặp và làm sạch
  const uniqueKeywords = [...new Set(expandedKeywords.map(k => k.toLowerCase().trim()))]
    .filter(k => k.length > 1 && !stopWords.has(k));
  
  console.log(" [Chat] Extracted keywords:", uniqueKeywords);
  
  return uniqueKeywords;
}

/**
 * GET /api/chat/history/:sessionId - Lấy lịch sử hội thoại
 */
router.get("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const conversation = await ChatConversation.findOne({ sessionId });

    if (!conversation) {
      return res.json({
        success: true,
        data: {
          sessionId,
          messages: [],
        },
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: conversation.sessionId,
        messages: conversation.messages,
      },
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử hội thoại",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/chat/history/:sessionId - Xóa lịch sử hội thoại
 */
router.delete("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await ChatConversation.findOneAndDelete({ sessionId });

    res.json({
      success: true,
      message: "Đã xóa lịch sử hội thoại",
    });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa lịch sử hội thoại",
      error: error.message,
    });
  }
});

/**
 * Fallback response generator - Sử dụng khi không có AI API
 * Cải thiện để nhận diện tốt hơn và trả lời tự nhiên hơn
 */
function generateFallbackResponse(message, conversationHistory) {
  const lowerMessage = message.toLowerCase().trim();
  console.log(" [Chat] generateFallbackResponse - Processing message:", lowerMessage);
  
  // Kiểm tra context từ conversation history
  const hasAskedAboutProducts = conversationHistory.some(
    (msg) => msg.role === "user" && (msg.content.toLowerCase().includes("sản phẩm") || msg.content.toLowerCase().includes("product"))
  );
  
  const hasAskedAboutOrders = conversationHistory.some(
    (msg) => msg.role === "user" && (msg.content.toLowerCase().includes("đơn hàng") || msg.content.toLowerCase().includes("order"))
  );

  const hasAskedAboutDelivery = conversationHistory.some(
    (msg) => msg.role === "user" && (msg.content.toLowerCase().includes("giao hàng") || msg.content.toLowerCase().includes("delivery") || msg.content.toLowerCase().includes("ship"))
  );

  // Nhận diện câu hỏi có pattern "cho tôi biết", "thông tin về" - ưu tiên cao nhất
  // Pattern matching cải thiện để nhận diện nhiều cách hỏi hơn
  const hasRequestPattern = lowerMessage.match(/cho\s+tôi\s+biết|hãy\s+cho|tôi\s+muốn\s+biết|giải\s+thích|nói\s+cho\s+tôi|thông\s+tin\s+về|muốn\s+biết\s+về|cho\s+biết|hãy\s+nói|bạn\s+có\s+thể\s+cho|bạn\s+có\s+thể\s+nói/);
  
  // Nhận diện câu hỏi về phí (ưu tiên cao nhất vì phổ biến)
  // Pattern matching cải thiện để nhận diện "thông tin về phí", "cho tôi biết về phí", v.v.
  const isAboutFee = lowerMessage.includes("phí") || lowerMessage.includes("fee") || lowerMessage.includes("cost") || 
      lowerMessage.includes("giá") || lowerMessage.includes("price") || 
      lowerMessage.includes("bao nhiêu") || lowerMessage.includes("chi phí") ||
      lowerMessage.match(/phí\s+giao\s+hàng|phí\s+vận\s+chuyển|phí\s+ship|thông\s+tin\s+về\s+phí|biết\s+về\s+phí|biết\s+thông\s+tin\s+về\s+phí/);
  
  // Nếu có pattern request + về phí -> trả lời ngay (ưu tiên cao nhất)
  if (hasRequestPattern && isAboutFee) {
    console.log(" [Chat] Matched: Request pattern + About fee");
    if (lowerMessage.includes("giao hàng") || lowerMessage.includes("ship") || lowerMessage.includes("vận chuyển") || hasAskedAboutDelivery) {
      console.log(" [Chat] Responding about delivery fee");
      return "VGreen miễn phí giao hàng cho đơn hàng từ 200.000₫. Đối với đơn hàng dưới 200.000₫, phí giao hàng sẽ được tính theo khu vực:\n\n• Khu vực nội thành: 20.000₫ - 30.000₫\n• Khu vực ngoại thành: 30.000₫ - 50.000₫\n• Khu vực tỉnh thành khác: 50.000₫ - 100.000₫\n\nBạn có thể xem chi tiết phí giao hàng khi đặt hàng. Nếu cần thêm thông tin, vui lòng liên hệ hotline 0125 456 789!";
    }
    
    if (lowerMessage.includes("sản phẩm") || hasAskedAboutProducts) {
      console.log(" [Chat] Responding about product price");
      return "Giá sản phẩm được hiển thị rõ ràng trên từng trang sản phẩm. VGreen cam kết mang đến giá cả hợp lý và chất lượng tốt nhất. Bạn có thể:\n\n• Xem giá chi tiết trên trang sản phẩm\n• Liên hệ hotline 0125 456 789 để được tư vấn về giá\n• Theo dõi các chương trình khuyến mãi trên website\n\nBạn muốn tìm hiểu về sản phẩm nào cụ thể không?";
    }
    
    // Trả lời chung về phí khi có pattern request
    console.log(" [Chat] Responding about general fee (with request pattern)");
    return "Tôi sẽ giải thích về phí của VGreen:\n\n📦 **Phí giao hàng:**\n• Miễn phí cho đơn từ 200.000₫\n• 20.000₫ - 100.000₫ tùy khu vực (đơn dưới 200.000₫)\n\n💰 **Giá sản phẩm:**\n• Được hiển thị rõ ràng trên từng trang sản phẩm\n• Cam kết giá cả hợp lý, chất lượng tốt\n\nBạn muốn biết thêm chi tiết về phí nào? Tôi có thể giúp bạn!";
  }
  
  // Nhận diện câu hỏi về phí (không có pattern request)
  if (isAboutFee) {
    console.log(" [Chat] Matched: About fee (without request pattern)");
    if (lowerMessage.includes("giao hàng") || lowerMessage.includes("ship") || lowerMessage.includes("vận chuyển") || hasAskedAboutDelivery) {
      console.log(" [Chat] Responding about delivery fee");
      return "VGreen miễn phí giao hàng cho đơn hàng từ 200.000₫. Đối với đơn hàng dưới 200.000₫, phí giao hàng sẽ được tính theo khu vực:\n\n• Khu vực nội thành: 20.000₫ - 30.000₫\n• Khu vực ngoại thành: 30.000₫ - 50.000₫\n• Khu vực tỉnh thành khác: 50.000₫ - 100.000₫\n\nBạn có thể xem chi tiết phí giao hàng khi đặt hàng. Nếu cần thêm thông tin, vui lòng liên hệ hotline 0125 456 789!";
    }
    
    if (lowerMessage.includes("sản phẩm") || hasAskedAboutProducts) {
      console.log(" [Chat] Responding about product price");
      return "Giá sản phẩm được hiển thị rõ ràng trên từng trang sản phẩm. VGreen cam kết mang đến giá cả hợp lý và chất lượng tốt nhất. Bạn có thể:\n\n• Xem giá chi tiết trên trang sản phẩm\n• Liên hệ hotline 0125 456 789 để được tư vấn về giá\n• Theo dõi các chương trình khuyến mãi trên website\n\nBạn muốn tìm hiểu về sản phẩm nào cụ thể không?";
    }
    
    // Trả lời chung về phí
    console.log(" [Chat] Responding about general fee");
    return "VGreen có nhiều loại phí khác nhau tùy theo dịch vụ:\n\n📦 **Phí giao hàng:**\n• Miễn phí cho đơn từ 200.000₫\n• 20.000₫ - 100.000₫ tùy khu vực (đơn dưới 200.000₫)\n\n💰 **Giá sản phẩm:**\n• Hiển thị trên từng trang sản phẩm\n• Cam kết giá cả hợp lý, chất lượng tốt\n\nBạn muốn biết về phí nào cụ thể? Tôi có thể giúp bạn!";
  }

  // Xử lý các câu hỏi phổ biến với context
  if (lowerMessage.includes("sản phẩm") || lowerMessage.includes("product") || hasAskedAboutProducts) {
    if (lowerMessage.includes("danh mục") || lowerMessage.includes("category")) {
      return "VGreen có các danh mục sản phẩm chính:\n\n🥬 Rau củ hữu cơ\n🍎 Trái cây tươi\n🥜 Thực phẩm khô\n🍵 Trà và Cà phê\n\nBạn có thể tìm kiếm sản phẩm theo danh mục trên trang chủ hoặc sử dụng thanh tìm kiếm. Bạn quan tâm đến danh mục nào?";
    }
    return "VGreen cung cấp nhiều sản phẩm chất lượng cao như rau củ hữu cơ, trái cây tươi, thực phẩm khô, trà và cà phê. Bạn có thể:\n\n• Xem danh sách sản phẩm tại trang chủ\n• Tìm kiếm sản phẩm cụ thể\n• Lọc theo danh mục, giá, hoặc đánh giá\n\nBạn muốn tìm sản phẩm nào? Tôi có thể giúp bạn!";
  }

  if (lowerMessage.includes("đơn hàng") || lowerMessage.includes("order") || hasAskedAboutOrders) {
    if (lowerMessage.includes("theo dõi") || lowerMessage.includes("track")) {
      return "Để theo dõi đơn hàng, bạn có thể:\n\n1. Đăng nhập vào tài khoản\n2. Truy cập phần 'Quản lý đơn hàng'\n3. Xem trạng thái và thông tin chi tiết đơn hàng\n\nBạn sẽ thấy các trạng thái: Đang xử lý, Đã xác nhận, Đang giao hàng, Đã giao hàng. Nếu cần hỗ trợ, vui lòng liên hệ hotline 0125 456 789!";
    }
    if (lowerMessage.includes("hủy") || lowerMessage.includes("cancel")) {
      return "Để hủy đơn hàng, bạn có thể:\n\n• Liên hệ hotline: 0125 456 789\n• Email: vgreenhotro@gmail.com\n\n⚠️ **Lưu ý:**\n• Chỉ có thể hủy đơn hàng khi đơn hàng chưa được xác nhận\n• Nếu đơn hàng đã được xác nhận, vui lòng liên hệ để được hỗ trợ\n\nChúng tôi sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất!";
    }
    return "Để kiểm tra đơn hàng, vui lòng:\n\n1. Đăng nhập vào tài khoản của bạn\n2. Truy cập phần 'Quản lý đơn hàng'\n3. Xem chi tiết đơn hàng\n\nNếu bạn chưa có tài khoản, hãy đăng ký để:\n• Theo dõi đơn hàng dễ dàng\n• Xem lịch sử mua hàng\n• Nhận các ưu đãi đặc biệt\n\nBạn cần hỗ trợ gì thêm không?";
  }

  if (lowerMessage.includes("giao hàng") || lowerMessage.includes("delivery") || lowerMessage.includes("ship")) {
    if (lowerMessage.includes("thời gian") || lowerMessage.includes("time") || lowerMessage.includes("bao lâu")) {
      return "Thời gian giao hàng của VGreen:\n\n🚚 **Khu vực nội thành:**\n• 1-2 ngày làm việc\n\n🚚 **Khu vực ngoại thành:**\n• 2-3 ngày làm việc\n\n🚚 **Khu vực tỉnh thành khác:**\n• 3-5 ngày làm việc\n\n⏰ Thời gian giao hàng được tính từ khi đơn hàng được xác nhận. Bạn sẽ nhận được thông báo khi đơn hàng được giao. Nếu có thắc mắc, vui lòng liên hệ hotline 0125 456 789!";
    }
    return "VGreen giao hàng toàn quốc với các chính sách:\n\n📦 **Phí giao hàng:**\n• Miễn phí cho đơn từ 200.000₫\n• 20.000₫ - 100.000₫ tùy khu vực (đơn dưới 200.000₫)\n\n⏰ **Thời gian:**\n• 1-3 ngày tùy khu vực\n\n📍 **Khu vực giao hàng:**\n• Toàn quốc\n\nBạn có thể xem chi tiết tại trang 'Chính sách giao hàng' hoặc liên hệ hotline 0125 456 789 để được tư vấn!";
  }

  if (lowerMessage.includes("đổi trả") || lowerMessage.includes("return") || lowerMessage.includes("refund")) {
    return "VGreen có chính sách đổi trả linh hoạt:\n\n✅ **Điều kiện đổi trả:**\n• Trong vòng 7 ngày kể từ ngày nhận hàng\n• Sản phẩm không đúng chất lượng\n• Sản phẩm bị hỏng, thiếu\n• Sản phẩm không đúng với mô tả\n\n📞 **Cách thức:**\n• Liên hệ hotline: 0125 456 789\n• Email: vgreenhotro@gmail.com\n\nChúng tôi sẽ xử lý yêu cầu đổi trả của bạn trong thời gian sớm nhất. Chi tiết xem tại trang 'Chính sách đổi trả'!";
  }

  if (lowerMessage.includes("hỗ trợ") || lowerMessage.includes("support") || lowerMessage.includes("help")) {
    return "Bạn có thể liên hệ với VGreen qua:\n\n📞 **Hotline:** 0125 456 789\n📧 **Email:** vgreenhotro@gmail.com\n🌐 **Website:** Truy cập trang 'Hỗ trợ' để xem các câu hỏi thường gặp\n\n⏰ **Thời gian hỗ trợ:**\n• 24/7 - Luôn sẵn sàng hỗ trợ bạn\n\nChúng tôi sẽ phản hồi trong thời gian sớm nhất. Bạn cần hỗ trợ về vấn đề gì?";
  }

  if (lowerMessage.includes("cảm ơn") || lowerMessage.includes("thank") || lowerMessage.includes("thanks")) {
    return "Không có gì! Rất vui được hỗ trợ bạn. 🌱\n\nNếu có thêm câu hỏi nào về sản phẩm, đơn hàng, giao hàng, hoặc bất kỳ thắc mắc nào về VGreen, đừng ngại hỏi tôi nhé!\n\nChúc bạn một ngày tốt lành và mua sắm vui vẻ tại VGreen!";
  }

  if (lowerMessage.includes("xin chào") || lowerMessage.includes("hello") || lowerMessage.includes("hi") || 
      lowerMessage.includes("chào") || lowerMessage.includes("chào bạn") || lowerMessage.match(/^chào\s+/)) {
    return "Xin chào! 👋 Tôi là Veebot, trợ lý ảo của VGreen. Rất vui được gặp bạn!\n\nTôi có thể giúp bạn:\n\n🛒 Về sản phẩm và giá cả\n📦 Về đơn hàng và giao hàng\n💰 Về phí giao hàng và thanh toán\n🔄 Về chính sách đổi trả\n❓ Các câu hỏi thường gặp\n\nBạn muốn hỏi gì? Tôi sẵn sàng giúp bạn!";
  }

  // Nhận diện câu hỏi có từ khóa "cho tôi biết", "hãy cho", "tôi muốn biết" (đã xử lý phí ở trên)
  if (hasRequestPattern) {
    // Trích xuất chủ đề từ câu hỏi (trừ phí đã xử lý)
    if (lowerMessage.includes("giao hàng") || lowerMessage.includes("ship") || lowerMessage.includes("delivery")) {
      return "VGreen giao hàng toàn quốc:\n\n📦 **Phí giao hàng:**\n• Miễn phí cho đơn từ 200.000₫\n• 20.000₫ - 100.000₫ tùy khu vực\n\n⏰ **Thời gian:**\n• 1-3 ngày tùy khu vực\n\n📍 **Khu vực:**\n• Toàn quốc\n\nBạn muốn biết thêm thông tin gì về giao hàng?";
    }
    if (lowerMessage.includes("sản phẩm") || lowerMessage.includes("product")) {
      return "VGreen cung cấp nhiều sản phẩm chất lượng cao:\n\n🥬 Rau củ hữu cơ\n🍎 Trái cây tươi\n🥜 Thực phẩm khô\n🍵 Trà và Cà phê\n\nBạn có thể xem danh sách sản phẩm tại trang chủ hoặc tìm kiếm sản phẩm cụ thể. Bạn muốn tìm sản phẩm nào?";
    }
    if (lowerMessage.includes("đơn hàng") || lowerMessage.includes("order")) {
      return "Để kiểm tra đơn hàng, bạn có thể:\n\n1. Đăng nhập vào tài khoản\n2. Truy cập phần 'Quản lý đơn hàng'\n3. Xem trạng thái và thông tin chi tiết\n\nBạn sẽ thấy các trạng thái: Đang xử lý, Đã xác nhận, Đang giao hàng, Đã giao hàng. Bạn cần hỗ trợ gì về đơn hàng?";
    }
  }

  // Default response với context và trả lời tự nhiên hơn
  const contextHint = hasAskedAboutProducts 
    ? "Về sản phẩm của VGreen, " 
    : hasAskedAboutOrders 
    ? "Về đơn hàng của bạn, " 
    : hasAskedAboutDelivery
    ? "Về giao hàng, "
    : "";

  // Phân tích câu hỏi để đưa ra gợi ý phù hợp
  let suggestions = [];
  if (lowerMessage.match(/phí|fee|cost|giá|price|bao nhiêu/)) {
    suggestions.push("• Phí giao hàng: Miễn phí cho đơn từ 200.000₫");
  }
  if (lowerMessage.match(/sản phẩm|product|mua|món/)) {
    suggestions.push("• Sản phẩm: Rau củ hữu cơ, trái cây, thực phẩm khô, trà và cà phê");
  }
  if (lowerMessage.match(/đơn hàng|order|mua hàng/)) {
    suggestions.push("• Đơn hàng: Đăng nhập để theo dõi đơn hàng");
  }

  const suggestionText = suggestions.length > 0 
    ? `\n\n💡 **Gợi ý:**\n${suggestions.join('\n')}\n`
    : '';

  return `${contextHint}Cảm ơn bạn đã liên hệ! Tôi hiểu bạn đang hỏi về: "${message}".${suggestionText}\n📞 **Để được hỗ trợ tốt hơn, bạn có thể:**\n• Gọi hotline: 0125 456 789\n• Email: vgreenhotro@gmail.com\n• Truy cập trang "Hỗ trợ" để xem các câu hỏi thường gặp\n\nNếu bạn có câu hỏi cụ thể về sản phẩm, đơn hàng, giao hàng, phí, hoặc đổi trả, tôi sẽ cố gắng trả lời chi tiết hơn!`;
}

module.exports = router;

