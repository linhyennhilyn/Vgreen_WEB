import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { WishlistService } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { AuthPopupService } from '../../services/auth-popup.service';

// Interfaces - Khớp với MongoDB schema
interface BlogPost {
  id: string; // MongoDB: id
  img: string; // MongoDB: img
  title: string; // MongoDB: title
  excerpt: string; // MongoDB: excerpt
  pubDate: string | Date; // MongoDB: pubDate (Date)
  author: string; // MongoDB: author
  categoryTag: string; // MongoDB: categoryTag
  content: string; // MongoDB: content
  hashtags?: string[]; // MongoDB: hashtags (array of hashtag strings)
  status?: string; // MongoDB: status (Active/Draft/Archived)
  views?: number; // MongoDB: views
  createdAt?: Date; // MongoDB: createdAt
  updatedAt?: Date; // MongoDB: updatedAt
}

interface Product {
  id: string;
  _id?: string;
  sku?: string;
  name: string;
  productName?: string;
  price: number; // Giá hiển thị (có thể là giá khuyến mãi)
  originalPrice?: number; // Giá gốc trước khuyến mãi (chỉ có khi có khuyến mãi)
  discountPercent?: number; // Phần trăm giảm giá
  image: string;
  images?: string[];
  unit: string;
  category?: string;
  subcategory?: string;
  rating?: number;
  purchase_count?: number;
  ReviewCount?: number;
  hasPromotion?: boolean;
  promotionType?: 'normal' | 'buy1get1' | ('normal' | 'buy1get1')[];
}

@Component({
  selector: 'app-blog-detail',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './blog-detail.html',
  styleUrls: ['./blog-detail.css'],
})
export class BlogDetail implements OnInit, OnDestroy, AfterViewInit {
  // Data properties
  currentPost: BlogPost | null = null;
  relatedProducts: Product[] = [];
  prevPost: BlogPost | null = null;
  nextPost: BlogPost | null = null;

  // State properties
  isLoading = true;
  error = '';
  postId = '';

  // Newsletter
  newsletterEmail = '';

  // Wishlist
  wishlistMap: Map<string, boolean> = new Map();

  // Scroll to top button
  showScrollButton: boolean = false;
  private scrollThreshold: number = 300;

  // View references
  @ViewChild('productsContainer') productsContainer!: ElementRef;

  // Route params subscription
  private routeParamsSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService,
    private wishlistService: WishlistService,
    private cartService: CartService,
    private toastService: ToastService,
    private authPopupService: AuthPopupService
  ) {}

  ngOnInit(): void {
    this.loadBlogData();
    this.initScrollListener();

    // Subscribe to route params changes để reload khi navigate
    this.routeParamsSubscription = this.route.params.subscribe((params) => {
      const newPostId = params['id'] || '';
      // Normalize newPostId
      const normalizedNewPostId = newPostId ? newPostId.trim().replace(/,$/, '').trim() : newPostId;
      const normalizedCurrentPostId = this.postId
        ? this.postId.trim().replace(/,$/, '').trim()
        : this.postId;

      if (normalizedNewPostId && normalizedNewPostId !== normalizedCurrentPostId) {
        console.log(' [BlogDetail] Route params changed, reloading blog:', normalizedNewPostId);
        this.postId = normalizedNewPostId;
        this.loadBlogPost(normalizedNewPostId);
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize any view-dependent functionality
    this.applyArticleStyles();
  }

  private applyArticleStyles() {
    console.log('Applying article styles...');
    setTimeout(() => {
      const articleContent = document.querySelector('.article-content');
      console.log('Article content found:', articleContent);
      if (articleContent) {
        const h2Elements = articleContent.querySelectorAll('h2');
        const h3Elements = articleContent.querySelectorAll('h3');

        console.log('Found h2 elements:', h2Elements.length);
        console.log('Found h3 elements:', h3Elements.length);

        h2Elements.forEach((h2) => {
          (h2 as HTMLElement).style.fontFamily =
            "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          (h2 as HTMLElement).style.fontSize = '30px';
          (h2 as HTMLElement).style.fontWeight = '700';
          (h2 as HTMLElement).style.color = 'black';
          (h2 as HTMLElement).style.margin = '32px 0 16px 0';
          (h2 as HTMLElement).style.lineHeight = '1.3';
        });

        h3Elements.forEach((h3) => {
          (h3 as HTMLElement).style.fontFamily =
            "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          (h3 as HTMLElement).style.fontSize = '24px';
          (h3 as HTMLElement).style.fontWeight = '700';
          (h3 as HTMLElement).style.color = 'black';
          (h3 as HTMLElement).style.margin = '24px 0 12px 0';
          (h3 as HTMLElement).style.lineHeight = '1.4';
        });
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }

    // Unsubscribe from route params
    if (this.routeParamsSubscription) {
      this.routeParamsSubscription.unsubscribe();
    }
  }

  private initScrollListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.handleScroll.bind(this));
    }
  }

  private handleScroll = (): void => {
    if (typeof window !== 'undefined') {
      const scrollY = window.scrollY || window.pageYOffset;
      this.showScrollButton = scrollY > this.scrollThreshold && scrollY > 0;
    }
  };

  scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }

  // Load blog data
  async loadBlogData(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = '';

      // Get post ID from route params - sử dụng snapshot để lấy ngay lập tức
      this.postId =
        this.route.snapshot.params['id'] || this.route.snapshot.paramMap.get('id') || '';

      // Normalize postId
      if (this.postId) {
        this.postId = this.postId.trim().replace(/,$/, '').trim();
      }

      if (this.postId) {
        console.log(' [BlogDetail] Loading post with ID:', this.postId);
        await this.loadBlogPost(this.postId);
      } else {
        this.error = 'Không tìm thấy ID bài viết';
        this.isLoading = false;
      }
    } catch (err) {
      this.error = 'Không thể tải dữ liệu bài viết';
      console.error('Error loading blog data:', err);
      this.isLoading = false;
    }
  }

  // Load specific blog post
  async loadBlogPost(postId: string): Promise<void> {
    if (!postId) {
      console.error(' [BlogDetail] No postId provided');
      this.error = 'Không tìm thấy ID bài viết';
      this.isLoading = false;
      return;
    }

    // Normalize postId: trim và loại bỏ dấu phẩy thừa
    const normalizedPostId = postId.trim().replace(/,$/, '').trim();

    try {
      console.log(
        ' [BlogDetail] Fetching blog post from API:',
        `/api/blogs/${normalizedPostId}`
      );

      // Load blog post từ backend API
      const response = await this.http
        .get<{ success: boolean; data: BlogPost }>(
          `/api/blogs/${normalizedPostId}`
        )
        .toPromise();

      console.log(' [BlogDetail] API Response:', response);

      if (response && response.success && response.data) {
        console.log(' [BlogDetail] Loaded from MongoDB:', response.data.id);

        // Normalize blog ID từ response
        const normalizedBlog = {
          ...response.data,
          id: response.data.id
            ? response.data.id.trim().replace(/,$/, '').trim()
            : response.data.id,
        };

        this.currentPost = normalizedBlog;

        // Load all blogs để tìm prev/next posts
        try {
          const allBlogsResponse = await this.http
            .get<{ success: boolean; data: BlogPost[] }>('/api/blogs')
            .toPromise();

          if (allBlogsResponse && allBlogsResponse.success && allBlogsResponse.data) {
            // Normalize tất cả blog IDs từ response
            const normalizedBlogs = allBlogsResponse.data.map((blog) => ({
              ...blog,
              id: blog.id ? blog.id.trim().replace(/,$/, '').trim() : blog.id,
            }));
            await this.loadRelatedData(normalizedBlogs);
          }
        } catch (relatedErr) {
          console.warn(' [BlogDetail] Error loading related posts:', relatedErr);
          // Không block việc hiển thị bài viết chính nếu lỗi load related posts
        }

        this.loadRelatedProducts();

        // Set page title
        document.title = `${this.currentPost.title} - VGreen Blog`;

        this.isLoading = false;
        this.error = '';

        // Apply styles to article content after data is loaded
        setTimeout(() => this.applyArticleStyles(), 200);
      } else {
        console.error(' [BlogDetail] Invalid response format:', response);
        this.error = 'Không tìm thấy bài viết';
        this.isLoading = false;
      }
    } catch (err: any) {
      console.error(' [BlogDetail] Error loading from backend:', err);
      console.error(' [BlogDetail] Error details:', {
        message: err?.message,
        status: err?.status,
        statusText: err?.statusText,
        url: err?.url,
      });

      // Fallback: thử load từ JSON nếu backend lỗi
      try {
        const fallbackResponse = await this.http
          .get<BlogPost[]>('../../data/blog.json')
          .toPromise();
        if (fallbackResponse) {
          console.log(' [BlogDetail] Using fallback JSON data');
          this.currentPost = fallbackResponse.find((post) => post.id === postId) || null;

          if (!this.currentPost) {
            this.error = 'Không tìm thấy bài viết';
            this.isLoading = false;
            return;
          }

          await this.loadRelatedData(fallbackResponse);
          this.loadRelatedProducts();
          document.title = `${this.currentPost.title} - VGreen Blog`;
          this.isLoading = false;
          setTimeout(() => this.applyArticleStyles(), 200);
          this.error = '';
        }
      } catch (fallbackErr) {
        this.error = 'Không thể tải bài viết';
        console.error(' [BlogDetail] Fallback also failed:', fallbackErr);
        this.isLoading = false;
      }
    }
  }

  // Load related data
  async loadRelatedData(allPosts: BlogPost[]): Promise<void> {
    if (!this.currentPost) return;

    // Normalize current post ID để so sánh
    const normalizeId = (id: string | undefined): string => {
      if (!id) return '';
      return id.trim().replace(/,$/, '').trim();
    };

    const currentPostId = normalizeId(this.currentPost.id);
    console.log(' [BlogDetail] Finding prev/next posts for ID:', currentPostId);

    // Normalize tất cả post IDs và filter out current post
    const normalizedPosts = allPosts.map((post) => ({
      ...post,
      normalizedId: normalizeId(post.id),
    }));

    // Find prev/next posts - sort theo pubDate (mới nhất lên đầu)
    const sortedPosts = normalizedPosts.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // Tìm index của current post bằng normalized ID
    const currentIndex = sortedPosts.findIndex((post) => post.normalizedId === currentPostId);

    console.log(' [BlogDetail] Current post index:', currentIndex, 'of', sortedPosts.length);

    // Reset prev/next posts
    this.prevPost = null;
    this.nextPost = null;

    if (currentIndex >= 0) {
      // Next post = bài mới hơn (index thấp hơn trong mảng đã sort giảm dần)
      if (currentIndex > 0) {
        this.nextPost = sortedPosts[currentIndex - 1];
        console.log(' [BlogDetail] Next post:', this.nextPost?.title, 'ID:', this.nextPost?.id);
      }

      // Prev post = bài cũ hơn (index cao hơn trong mảng đã sort giảm dần)
      if (currentIndex < sortedPosts.length - 1) {
        this.prevPost = sortedPosts[currentIndex + 1];
        console.log(' [BlogDetail] Prev post:', this.prevPost?.title, 'ID:', this.prevPost?.id);
      }
    } else {
      console.warn(' [BlogDetail] Current post not found in sorted posts list');
    }
  }

  // Load related products based on blog content keywords
  loadRelatedProducts(): void {
    if (!this.currentPost || !this.currentPost.id) {
      this.relatedProducts = [];
      return;
    }

    const normalizedPostId = this.currentPost.id.trim().replace(/,$/, '').trim();
    const apiUrl = '/api';

    // Call new API endpoint to get related products based on blog content keywords
    this.http
      .get<{ success: boolean; data: any[]; keywords?: string[] }>(
        `${apiUrl}/blogs/${normalizedPostId}/related-products`
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.length > 0) {
            console.log(
              `📝 [BlogDetail] Loaded ${response.data.length} related products based on keywords:`,
              response.keywords
            );

            // Load promotions and targets to apply to products
            forkJoin({
              promotions: this.http.get<any>(`${apiUrl}/promotions`),
              targets: this.http.get<any>(`${apiUrl}/promotion-targets`),
            }).subscribe({
              next: ({ promotions, targets }) => {
                // Filter active promotions
                const now = new Date();
                const activePromotions = (promotions.data || []).filter((p: any) => {
                  const startDate = new Date(p.start_date);
                  const endDate = new Date(p.end_date);
                  return p.status === 'Active' && now >= startDate && now <= endDate;
                });

                // Convert API products to ProductService format
                const apiProducts = response.data.map((p: any) => {
                  console.log(`📦 [BlogDetail] Sample API product:`, {
                    sku: p.sku,
                    unit: p.unit,
                    Unit: p.Unit,
                    purchase_count: p.purchase_count,
                    purchaseCount: p.purchaseCount,
                  });
                  return {
                    _id: p._id,
                    sku: p.sku,
                    product_name: p.product_name || p.productName || '',
                    category: p.category || '',
                    subcategory: p.subcategory || '',
                    brand: p.brand || '',
                    price: p.price || 0,
                    image: p.image || '',
                    status: p.status || 'Active',
                    rating: 0,
                    unit: p.unit || p.Unit || '',
                    purchase_count: p.purchase_count ?? p.purchaseCount ?? 0,
                  };
                });

                // Apply promotions to products
                const productsWithPromotions = this.applyPromotionsToProducts(
                  apiProducts,
                  activePromotions,
                  targets?.data || []
                );

                // Map to blog-detail format
                this.relatedProducts = productsWithPromotions
                  .map((product) => {
                    const imageArray = Array.isArray(product.image)
                      ? product.image
                      : [product.image || ''];

                    return {
                      id: product._id || '',
                      _id: product._id,
                      sku: product.sku || product._id,
                      name: product.product_name || '',
                      productName: product.product_name,
                      price: product.hasPromotion ? product.discountedPrice : product.price || 0,
                      originalPrice: product.hasPromotion ? product.originalPrice : undefined,
                      discountPercent: product.hasPromotion ? product.discountPercent : undefined,
                      image: imageArray[0] || '',
                      images: imageArray,
                      unit: product.unit || '',
                      category: product.category || '',
                      subcategory: product.subcategory || '',
                      rating: product.rating ?? 0,
                      purchase_count: product.purchase_count ?? 0,
                      ReviewCount: 0, // Sẽ được load từ reviews
                      hasPromotion: product.hasPromotion || false,
                      promotionType: product.promotionType || undefined,
                    };
                  })
                  .slice(0, 12); // Limit to 12 products

                console.log(
                  `✅ [BlogDetail] Loaded ${this.relatedProducts.length} related products with promotions`
                );

                // Load wishlist status for related products
                this.loadWishlistStatus();

                // Load review counts for related products
                this.loadReviewCounts();
              },
              error: (promoError) => {
                console.error('❌ [BlogDetail] Error loading promotions:', promoError);
                // Use products without promotions
                this.mapProductsToDetailFormat(response.data);
              },
            });
          } else {
            console.log('⚠️ [BlogDetail] No related products found, using fallback');
            // Fallback to old method
            this.loadRelatedProductsFallback();
          }
        },
        error: (error) => {
          console.error('❌ [BlogDetail] Error loading related products from API:', error);
          // Fallback to old method
          this.loadRelatedProductsFallback();
        },
      });
  }

  // Fallback: Load products using old method (category tag only)
  private loadRelatedProductsFallback(): void {
    if (!this.currentPost || !this.currentPost.categoryTag) {
      this.relatedProducts = [];
      return;
    }

    const categoryTag = this.currentPost.categoryTag.toLowerCase().trim();
    const apiUrl = '/api';

    // Load products, promotions, and targets in parallel
    forkJoin({
      products: this.productService.getAllProducts(),
      promotions: this.http.get<any>(`${apiUrl}/promotions`),
      targets: this.http.get<any>(`${apiUrl}/promotion-targets`),
    }).subscribe({
      next: ({ products, promotions, targets }) => {
        // Filter active promotions
        const now = new Date();
        const activePromotions = (promotions.data || []).filter((p: any) => {
          const startDate = new Date(p.start_date);
          const endDate = new Date(p.end_date);
          return p.status === 'Active' && now >= startDate && now <= endDate;
        });

        // Apply promotions to products
        const productsWithPromotions = this.applyPromotionsToProducts(
          products,
          activePromotions,
          targets?.data || []
        );

        // Filter products based on category tag
        this.relatedProducts = productsWithPromotions
          .filter((product) => {
            const productCategory = (product.category || '').toLowerCase().trim();
            const productSubcategory = (product.subcategory || '').toLowerCase().trim();
            const productName = (product.product_name || '').toLowerCase().trim();

            return (
              productCategory.includes(categoryTag) ||
              categoryTag.includes(productCategory) ||
              productSubcategory.includes(categoryTag) ||
              categoryTag.includes(productSubcategory) ||
              productName.includes(categoryTag)
            );
          })
          .map((product) => {
            const imageArray = Array.isArray(product.image) ? product.image : [product.image || ''];

            return {
              id: product._id || '',
              _id: product._id,
              sku: product.sku || product._id,
              name: product.product_name || '',
              productName: product.product_name,
              price: product.hasPromotion ? product.discountedPrice : product.price || 0,
              originalPrice: product.hasPromotion ? product.originalPrice : undefined,
              discountPercent: product.hasPromotion ? product.discountPercent : undefined,
              image: imageArray[0] || '',
              images: imageArray,
              unit: product.unit || '',
              category: product.category || '',
              subcategory: product.subcategory || '',
              rating: product.rating ?? 0,
              purchase_count: product.purchase_count ?? 0,
              ReviewCount: 0,
              hasPromotion: product.hasPromotion || false,
              promotionType: product.promotionType || undefined,
            };
          })
          .slice(0, 6);

        console.log(
          `✅ [BlogDetail] Fallback: Loaded ${this.relatedProducts.length} related products for category tag: "${categoryTag}"`
        );

        // Load wishlist status and review counts
        this.loadWishlistStatus();
        this.loadReviewCounts();
      },
      error: (error) => {
        console.error('❌ [BlogDetail] Error in fallback method:', error);
        this.relatedProducts = [];
      },
    });
  }

  // Helper: Map API products to detail format (without promotions)
  private mapProductsToDetailFormat(apiProducts: any[]): void {
    this.relatedProducts = apiProducts
      .map((p: any) => {
        const imageArray = Array.isArray(p.image) ? p.image : [p.image || ''];

        return {
          id: p._id || '',
          _id: p._id,
          sku: p.sku || p._id,
          name: p.product_name || p.productName || '',
          productName: p.product_name || p.productName,
          price: p.price || 0,
          originalPrice: undefined,
          discountPercent: undefined,
          image: imageArray[0] || '',
          images: imageArray,
          unit: p.unit || p.Unit || '',
          category: p.category || '',
          subcategory: p.subcategory || '',
          rating: 0,
          purchase_count: p.purchase_count ?? p.purchaseCount ?? 0,
          ReviewCount: 0,
          hasPromotion: false,
          promotionType: undefined,
        };
      })
      .slice(0, 12);

    this.loadWishlistStatus();
    this.loadReviewCounts();
  }

  // Old method - kept for reference but not used
  private loadRelatedProductsWithoutPromotions(categoryTag: string): void {
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.relatedProducts = products
          .filter((product) => {
            const productCategory = (product.category || '').toLowerCase().trim();
            const productSubcategory = (product.subcategory || '').toLowerCase().trim();
            const productName = (product.product_name || '').toLowerCase().trim();

            return (
              productCategory.includes(categoryTag) ||
              categoryTag.includes(productCategory) ||
              productSubcategory.includes(categoryTag) ||
              categoryTag.includes(productSubcategory) ||
              productName.includes(categoryTag)
            );
          })
          .map((product) => {
            const imageArray = Array.isArray(product.image) ? product.image : [product.image || ''];

            return {
              id: product._id || '',
              _id: product._id,
              sku: product.sku || product._id,
              name: product.product_name || '',
              productName: product.product_name,
              price: product.price || 0,
              originalPrice: undefined,
              discountPercent: undefined,
              image: imageArray[0] || '',
              images: imageArray,
              unit: product.unit || '',
              category: product.category || '',
              subcategory: product.subcategory || '',
              rating: product.rating ?? 0,
              purchase_count: product.purchase_count ?? 0,
              ReviewCount: 0,
              hasPromotion: false,
              promotionType: undefined,
            };
          })
          .slice(0, 10);

        this.loadWishlistStatus();
        this.loadReviewCounts();
      },
      error: (error) => {
        console.error(' Error loading products:', error);
        this.relatedProducts = [];
      },
    });
  }

  // Apply promotions to products
  private applyPromotionsToProducts(products: any[], promotions: any[], targets: any[]): any[] {
    return products.map((product) => {
      // Tìm tất cả promotion targets áp dụng cho product này
      const applicableTargets = targets.filter((target) => {
        return this.isProductMatchTarget(product, target);
      });

      if (applicableTargets.length === 0) {
        return { ...product, hasPromotion: false };
      }

      // Tìm tất cả promotions tương ứng
      const applicablePromotions = applicableTargets
        .map((target) => promotions.find((p) => p.promotion_id === target.promotion_id))
        .filter((p): p is any => p !== undefined);

      if (applicablePromotions.length === 0) {
        return { ...product, hasPromotion: false };
      }

      // Xác định các loại promotion (có thể có cả normal và buy1get1)
      const promotionTypes: ('normal' | 'buy1get1')[] = [];
      let normalPromotion: any = null;

      applicablePromotions.forEach((p) => {
        if (p.discount_type === 'buy1get1') {
          promotionTypes.push('buy1get1');
        } else {
          promotionTypes.push('normal');
          // Ưu tiên lưu promotion normal đầu tiên để tính giá
          if (!normalPromotion) {
            normalPromotion = p;
          }
        }
      });

      // Nếu chỉ có 1 loại, trả về string, nếu có nhiều loại trả về array
      const promotionType: 'normal' | 'buy1get1' | ('normal' | 'buy1get1')[] =
        promotionTypes.length === 1 ? promotionTypes[0] : promotionTypes;

      // Tính giá sau khuyến mãi (chỉ tính cho normal promotion, buy1get1 không giảm giá)
      let discountedPrice = product.price;
      let discountAmount = 0;
      let discountPercent = 0;

      if (normalPromotion) {
        discountedPrice = this.calculateDiscountedPrice(product.price, normalPromotion);
        discountAmount = product.price - discountedPrice;
        discountPercent = Math.round((discountAmount / product.price) * 100);
      }

      // Chọn promotion đầu tiên để hiển thị tên (ưu tiên buy1get1)
      const displayPromotion =
        applicablePromotions.find((p) => p.discount_type === 'buy1get1') || applicablePromotions[0];

      return {
        ...product,
        hasPromotion: true,
        originalPrice: product.price, // Giá gốc = price ban đầu
        discountedPrice: discountedPrice,
        discountAmount: discountAmount,
        discountPercent: discountPercent,
        promotionName: displayPromotion.name,
        promotionCode: displayPromotion.code,
        promotionType: promotionType,
      };
    });
  }

  // Check if product matches promotion target
  private isProductMatchTarget(product: any, target: any): boolean {
    const { target_type, target_ref } = target;

    switch (target_type) {
      case 'Category':
        return target_ref.includes(product.category);
      case 'Subcategory':
        return target_ref.includes(product.subcategory);
      case 'Brand':
        return target_ref.includes(product.brand);
      case 'Product':
        return target_ref.includes(product.sku);
      default:
        return false;
    }
  }

  // Calculate discounted price
  private calculateDiscountedPrice(originalPrice: number, promotion: any): number {
    if (promotion.discount_type === 'percent') {
      const discountAmount = (originalPrice * promotion.discount_value) / 100;
      const maxDiscount = promotion.max_discount_value || Infinity;
      const actualDiscount = Math.min(discountAmount, maxDiscount);
      return originalPrice - actualDiscount;
    } else if (promotion.discount_type === 'fixed') {
      return Math.max(0, originalPrice - promotion.discount_value);
    }
    return originalPrice;
  }

  // Check if there are related products to show
  hasRelatedProducts(): boolean {
    return this.relatedProducts.length > 0;
  }

  // Helper method to check if hashtags exist and have items
  hasHashtags(): boolean {
    return !!(
      this.currentPost?.hashtags &&
      Array.isArray(this.currentPost.hashtags) &&
      this.currentPost.hashtags.length > 0
    );
  }

  // Helper method to get hashtags safely
  getHashtags(): string[] {
    return this.currentPost?.hashtags && Array.isArray(this.currentPost.hashtags)
      ? this.currentPost.hashtags
      : [];
  }

  // Helper method to check if should show category tag (when no hashtags)
  shouldShowCategoryTag(): boolean {
    return !!(
      this.currentPost?.categoryTag &&
      (!this.currentPost?.hashtags ||
        !Array.isArray(this.currentPost.hashtags) ||
        this.currentPost.hashtags.length === 0)
    );
  }

  // Navigate to product detail
  goToProductDetail(product: Product): void {
    const productId = product._id || product.id;
    if (productId) {
      this.router.navigate(['/product-detail', productId]);
    }
  }

  // Add product to cart
  async addToCart(product: Product, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation(); // Ngăn event bubble lên card click
    }

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    // Chuyển đổi Product sang CartItem format
    // Tạo id giống product-list để đảm bảo so sánh chính xác
    const createId = (): number => {
      // Ưu tiên: sku > parseInt(_id) > parseInt(id) > Date.now()
      if (product.sku) {
        // Nếu sku là số thì dùng trực tiếp, nếu không thì parseInt
        const skuNum = parseInt(product.sku.toString().replace(/\D/g, ''));
        if (!isNaN(skuNum) && skuNum > 0) {
          return skuNum;
        }
      }
      if (product._id) {
        const parsedId = parseInt(product._id.replace(/\D/g, ''));
        if (!isNaN(parsedId) && parsedId > 0) {
          return parsedId;
        }
      }
      if (product.id) {
        const parsedId = parseInt(product.id.toString().replace(/\D/g, ''));
        if (!isNaN(parsedId) && parsedId > 0) {
          return parsedId;
        }
      }
      return Date.now();
    };

    const hasPromotion = product.hasPromotion || false;
    // Only set originalPrice when there is a promotion AND originalPrice is valid (greater than price)
    // Trong blog-detail, price đã là giá sau giảm nếu có promotion (từ map ở line 314)
    const originalPrice =
      hasPromotion && product.originalPrice && product.originalPrice > product.price
        ? product.originalPrice
        : undefined;

    const cartItem = {
      id: createId(),
      sku: product.sku || product._id || product.id,
      name: product.name || product.productName || '',
      productName: product.productName || product.name || '',
      price: product.price, // Đã là giá sau giảm nếu có promotion (từ map ở line 314)
      image: product.image || (product.images && product.images[0]) || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      unit: product.unit || '',
      selected: true,
      originalPrice: originalPrice,
      hasPromotion: hasPromotion,
      stock: (product as any).stock ?? (product as any).Stock, // Thêm stock vào cartItem để kiểm tra
    };

    // Kiểm tra tồn kho trước khi thêm vào giỏ
    const canAdd = await this.cartService.checkStockBeforeAdd(
      cartItem,
      1,
      (product as any).stock ?? (product as any).Stock,
      false // Không phải "Mua ngay"
    );

    if (!canAdd) {
      return; // Không thêm vào giỏ nếu không đủ tồn kho
    }

    // Thêm vào giỏ hàng thông qua CartService
    // Toast sẽ được hiển thị tự động từ CartService
    this.cartService.addToCart(cartItem);
    console.log(' Added to cart:', cartItem.name);
  }

  // Expose Math for template
  Math = Math;

  // Get customerID from localStorage
  private getCustomerID(): string {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return 'guest';
    }
    try {
      const userData = JSON.parse(userStr);
      return userData.CustomerID || userData._id || 'guest';
    } catch (error) {
      console.error('Error parsing user data:', error);
      return 'guest';
    }
  }

  // Load wishlist status for related products
  loadWishlistStatus(): void {
    const customerID = this.getCustomerID();
    if (customerID === 'guest') {
      return; // Guest không có wishlist
    }

    this.relatedProducts.forEach((product) => {
      const sku = product.sku || product._id || product.id;
      if (!sku) return;

      this.wishlistService.isInWishlist(customerID, sku).subscribe({
        next: (isInWishlist) => {
          this.wishlistMap.set(sku, isInWishlist);
        },
      });
    });
  }

  // Load review counts for related products
  loadReviewCounts(): void {
    this.relatedProducts.forEach((product) => {
      const sku = product.sku || product._id || product.id;
      if (!sku) return;

      // Load reviews count from API
      this.http.get<any>(`/api/reviews/${sku}`).subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.reviews) {
            product.ReviewCount = response.data.reviews.length;
            // Update rating if reviews exist
            if (response.data.reviews.length > 0) {
              const totalRating = response.data.reviews.reduce(
                (sum: number, review: any) => sum + (review.rating || 0),
                0
              );
              product.rating = Math.round((totalRating / response.data.reviews.length) * 10) / 10;
            }
          } else {
            product.ReviewCount = 0;
          }
        },
        error: () => {
          product.ReviewCount = 0;
        },
      });
    });
  }

  // Toggle wishlist
  toggleWishlist(product: Product, event: Event): void {
    event.stopPropagation();

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    const customerID = this.getCustomerID();
    const sku = product.sku || product._id || product.id;

    if (customerID === 'guest') {
      // Mở popup đăng nhập nếu là guest
      this.authPopupService.openPopup('login');
      return;
    }

    if (!sku) {
      console.error('No SKU found for product:', product);
      return;
    }

    // Toggle local state immediately for better UX
    const currentState = this.wishlistMap.get(sku) || false;
    this.wishlistMap.set(sku, !currentState);

    // Call API
    const productName = product.productName || product.name;
    if (currentState) {
      // Remove from wishlist
      this.wishlistService.removeFromWishlist(customerID, sku).subscribe({
        error: () => {
          // Rollback on error
          this.wishlistMap.set(sku, currentState);
        },
      });
    } else {
      // Add to wishlist
      this.wishlistService.addToWishlist(customerID, sku, productName).subscribe({
        error: () => {
          // Rollback on error
          this.wishlistMap.set(sku, currentState);
        },
      });
    }
  }

  // Check if product is in wishlist
  isInWishlist(product: Product): boolean {
    const sku = product.sku || product._id || product.id;
    if (!sku) return false;
    return this.wishlistMap.get(sku) || false;
  }

  // Format rating to 1 decimal place
  formatRating(rating: number | undefined | null): string {
    if (!rating || rating === 0) {
      return '0.0';
    }
    return rating.toFixed(1);
  }

  // Check if product has reviews
  hasReviews(product: Product): boolean {
    const rating = product.rating ?? 0;
    const reviewCount = product.ReviewCount ?? 0;
    // Có reviews nếu có rating > 0 hoặc reviewCount > 0
    return rating > 0 || reviewCount > 0;
  }

  // Get purchase count formatted
  getPurchaseCount(product: Product): string {
    const purchaseCount = product.purchase_count ?? 0;
    return purchaseCount.toLocaleString('vi-VN');
  }

  /**
   * Kiểm tra xem sản phẩm có khuyến mãi Mua 1 tặng 1 không
   */
  hasBuy1Get1Promotion(product: Product): boolean {
    if (!product.hasPromotion || !product.promotionType) {
      return false;
    }
    if (Array.isArray(product.promotionType)) {
      return product.promotionType.includes('buy1get1');
    }
    return product.promotionType === 'buy1get1';
  }

  // Format date - Xử lý cả Date object và string
  formatDate(dateInput: string | Date | undefined): string {
    if (!dateInput) return '';

    let date: Date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      return '';
    }

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Format price
  formatPrice(price: number): string {
    return (
      price.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) + '₫'
    );
  }

  // Navigate to post
  navigateToPost(postId: string): void {
    // Normalize postId trước khi navigate
    const normalizedPostId = postId ? postId.trim().replace(/,$/, '').trim() : postId;
    console.log(' [BlogDetail] Navigating to post:', normalizedPostId);

    // Reset state trước khi navigate
    this.currentPost = null;
    this.prevPost = null;
    this.nextPost = null;
    this.isLoading = true;

    // Navigate và reload sẽ được trigger bởi route params subscription
    this.router.navigate(['/blog', normalizedPostId]);
  }

  // Subscribe to newsletter
  subscribeNewsletter(): void {
    if (!this.newsletterEmail) {
      alert('Vui lòng nhập email');
      return;
    }

    // In real app, this would be an API call
    console.log('Newsletter subscription:', this.newsletterEmail);
    alert('Đăng ký nhận tin thành công!');
    this.newsletterEmail = '';
  }

  // Share post
  sharePost(platform: string): void {
    if (!this.currentPost) return;

    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(this.currentPost.title);
    const text = encodeURIComponent(this.currentPost.excerpt);

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }

  // Copy link
  copyLink(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.toastService.show('Đã sao chép link thành công!');
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.toastService.show('Đã sao chép link thành công!');
    }
  }

  // Scroll products carousel
  scrollProducts(direction: 'prev' | 'next'): void {
    if (!this.productsContainer) return;

    const container = this.productsContainer.nativeElement;
    const scrollAmount = 245; // Width of one product card (220px) + gap (25px)

    if (direction === 'prev') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  // Image loading handlers
  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.opacity = '1';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial, Helvetica, sans-serif" font-size="16">No Image</text></svg>`
      );
  }

  // Back to blog
  backToBlog(): void {
    this.router.navigate(['/blog']);
  }
}
