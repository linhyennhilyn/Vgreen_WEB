import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProductService } from '../services/product.service';
import { WishlistService } from '../services/wishlist.service';
import { CartService } from '../services/cart.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthPopupService } from '../services/auth-popup.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit, OnDestroy, AfterViewInit {
  private heroSlider?: HeroSlider;
  private categoriesCarousel?: CategoriesCarousel;
  private hotDealsCarousel?: ProductCarousel;
  private newProductsCarousel?: ProductCarousel;
  private testimonialsCarousel?: TestimonialsCarousel;

  blogData: BlogPost[] = [];
  featuredPost?: BlogPost;

  // Products data
  hotDealsProducts: any[] = [];
  newProducts: any[] = [];

  // Wishlist tracking
  wishlistMap: Map<string, boolean> = new Map();

  // Scroll to top button
  showScrollButton: boolean = false;
  private scrollThreshold: number = 300;

  // Mapping category slugs from home.html to product-list slugs
  private categorySlugMap: { [key: string]: string } = {
    'rau-cu': 'rau-cu',
    'trai-cay': 'trai-cay',
    'luong-thuc': 'luong-thuc-ngu-coc',
    'thuc-pham-kho': 'thuc-pham-kho',
    tra: 'tra-thao-moc',
    'ca-phe': 'ca-phe-cacao',
    'bo-bo': 'thuc-pham-boi-bo',
    'rong-bien': 'rong-bien',
  };

  private apiUrl = '/api'; // Use proxy configuration

  constructor(
    private router: Router,
    private productService: ProductService,
    public wishlistService: WishlistService,
    public cartService: CartService,
    private http: HttpClient,
    private authPopupService: AuthPopupService
  ) {}

  ngOnInit(): void {
    // Component initialized
    this.reloadBlogData();
    this.loadProducts();
    this.initScrollListener();

    // Listen for router navigation events
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Reload blog data when navigating to home
        if (event.url === '/' || event.url === '') {
          this.reloadBlogData();
        }
      });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
    // Cleanup carousels (chỉ những class có destroy method)
    if (this.heroSlider) {
      this.heroSlider.destroy();
    }
    // CategoriesCarousel và ProductCarousel không có destroy method
    // if (this.categoriesCarousel) {
    //   this.categoriesCarousel.destroy();
    // }
    // if (this.hotDealsCarousel) {
    //   this.hotDealsCarousel.destroy();
    // }
    // if (this.newProductsCarousel) {
    //   this.newProductsCarousel.destroy();
    // }
    if (this.testimonialsCarousel) {
      this.testimonialsCarousel.destroy();
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

  // Load products từ MongoDB
  private loadProducts(): void {
    // Load products, promotions, and targets in parallel
    forkJoin({
      products: this.productService.getAllProducts(),
      promotions: this.http.get<any>(`${this.apiUrl}/promotions`), // Lấy TẤT CẢ promotions
      targets: this.http.get<any>(`${this.apiUrl}/promotion-targets`),
    }).subscribe({
      next: ({ products, promotions, targets }) => {
        console.log(' [Home] Loaded data:', {
          products: products.length,
          promotions: promotions.data?.length || 0,
          targets: targets?.data?.length || 0,
        });

        // Filter active promotions (trong khoảng thời gian hiện tại)
        const now = new Date();
        const activePromotions = (promotions.data || []).filter((p: any) => {
          const startDate = new Date(p.start_date);
          const endDate = new Date(p.end_date);
          return p.status === 'Active' && now >= startDate && now <= endDate;
        });

        console.log(' [Home] Active promotions:', activePromotions.length);

        // Apply promotions to products
        const productsWithPromotions = this.applyPromotionsToProducts(
          products,
          activePromotions,
          targets?.data || []
        );

        // Filter ra sản phẩm CÓ promotion cho "KHUYẾN MÃI HOT"
        this.hotDealsProducts = productsWithPromotions
          .filter((p) => p.hasPromotion) // Chỉ lấy sản phẩm có khuyến mãi
          .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)) // Sắp xếp theo % giảm giá
          .slice(0, 30);

        // Filter ra 30 sản phẩm mới (sắp xếp theo post_date) - sử dụng productsWithPromotions để có thông tin promotion
        this.newProducts = productsWithPromotions
          .sort((a, b) => {
            const dateA = a.post_date ? new Date(a.post_date).getTime() : 0;
            const dateB = b.post_date ? new Date(b.post_date).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 30);

        console.log(' [Home] Loaded hot deals with promotions:', this.hotDealsProducts.length);
        console.log(' [Home] Loaded new products:', this.newProducts.length);

        // Load wishlist status for all products
        this.loadWishlistStatus();

        // Reinitialize carousels sau khi có data và view đã render
        setTimeout(() => {
          this.reinitializeCarousels();
        }, 300);
      },
      error: (error) => {
        console.error(' [Home] Error loading products:', error);
        // Fallback: load products without promotions
        this.loadProductsWithoutPromotions();
      },
    });
  }

  private loadProductsWithoutPromotions(): void {
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.hotDealsProducts = products
          .sort((a, b) => (b.purchase_count || 0) - (a.purchase_count || 0))
          .slice(0, 30);

        this.newProducts = products
          .sort((a, b) => {
            const dateA = a.post_date ? new Date(a.post_date).getTime() : 0;
            const dateB = b.post_date ? new Date(b.post_date).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 30);

        this.loadWishlistStatus();
        setTimeout(() => this.reinitializeCarousels(), 300);
      },
    });
  }

  private applyPromotionsToProducts(products: any[], promotions: any[], targets: any[]): any[] {
    console.log(` [Home] Applying promotions to ${products.length} products...`);
    console.log(`   Available promotions: ${promotions.map((p: any) => p.code).join(', ')}`);
    console.log(`   Available targets: ${targets.length}`);

    let matchedCount = 0;

    const result = products.map((product) => {
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

      matchedCount++;

      // Chọn promotion đầu tiên để hiển thị tên (ưu tiên buy1get1)
      const displayPromotion =
        applicablePromotions.find((p) => p.discount_type === 'buy1get1') || applicablePromotions[0];

      return {
        ...product,
        hasPromotion: true,
        originalPrice: product.price,
        discountedPrice: discountedPrice,
        discountAmount: discountAmount,
        discountPercent: discountPercent,
        promotionName: displayPromotion.name,
        promotionCode: displayPromotion.code,
        promotionType: promotionType,
      };
    });

    console.log(` [Home] Matched ${matchedCount} products with promotions`);
    return result;
  }

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

  // Reinitialize carousels sau khi load products
  private reinitializeCarousels(): void {
    try {
      // Destroy old carousels nếu có
      if (this.hotDealsCarousel) {
        this.hotDealsCarousel = undefined;
      }
      if (this.newProductsCarousel) {
        this.newProductsCarousel = undefined;
      }

      // Khởi tạo lại với số lượng products mới
      this.hotDealsCarousel = new ProductCarousel('.hot-deals-section');
      this.newProductsCarousel = new ProductCarousel('.new-products-section');

      console.log(' [Home] Carousels reinitialized successfully');
    } catch (error) {
      console.error(' [Home] Error reinitializing carousels:', error);
    }
  }

  // Load wishlist status
  private loadWishlistStatus(): void {
    const customerID = this.getCustomerID();
    if (customerID === 'guest') {
      return; // Guest không có wishlist
    }

    // Load wishlist cho tất cả sản phẩm
    const allProducts = [...this.hotDealsProducts, ...this.newProducts];
    allProducts.forEach((product) => {
      const sku = product.sku || product._id;
      this.wishlistService.isInWishlist(customerID, sku).subscribe({
        next: (isInWishlist) => {
          this.wishlistMap.set(sku, isInWishlist);
        },
      });
    });
  }

  // Get customerID từ localStorage
  private getCustomerID(): string {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return 'guest';
    }
    try {
      const userData = JSON.parse(userStr);
      return userData.CustomerID || userData._id || 'guest';
    } catch (error) {
      return 'guest';
    }
  }

  ngAfterViewInit(): void {
    // Khởi tạo hero slider sau khi view được render hoàn toàn
    setTimeout(() => {
      try {
        this.heroSlider = new HeroSlider();
        this.categoriesCarousel = new CategoriesCarousel();
        // Product carousels sẽ được khởi tạo sau khi load products xong
        // this.hotDealsCarousel = new ProductCarousel('.hot-deals-section');
        // this.newProductsCarousel = new ProductCarousel('.new-products-section');
        this.testimonialsCarousel = new TestimonialsCarousel();

        // console.log('VGreen Home Page initialized successfully');
      } catch (error) {
        console.error('Error initializing components:', error);
      }
    }, 100);

    // Fallback: Thử khởi tạo lại testimonials sau 500ms nếu cần
    setTimeout(() => {
      if (this.testimonialsCarousel) {
        this.testimonialsCarousel.reinitialize();
      }
    }, 500);
  }

  // Handle category card click - navigate to product list with category filter
  onCategoryClick(categorySlug: string): void {
    // Convert home.html category slug to product-list category slug
    const productListSlug = this.categorySlugMap[categorySlug] || categorySlug;

    // Navigate to product list with category parameter
    this.router.navigate(['/products'], {
      queryParams: { category: productListSlug },
    });
  }

  // Helper methods cho products
  onProductClick(product: any): void {
    this.router.navigate(['/product-detail', product.sku || product._id]);
  }

  async addToCart(product: any, event: Event): Promise<void> {
    // Ngăn event bubble lên card để không trigger onProductClick
    event.stopPropagation();

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }
    const hasPromotion = product.hasPromotion || false;
    // Only set originalPrice when there is a promotion AND originalPrice is valid (greater than discountedPrice)
    // Trong home, originalPrice đã được set = product.price (giá gốc), discountedPrice là giá sau giảm
    const originalPrice =
      hasPromotion && product.originalPrice && product.discountedPrice
        ? product.originalPrice > product.discountedPrice
          ? product.originalPrice
          : undefined
        : undefined;

    const cartItem = {
      id: product.sku || parseInt(product._id.replace(/\D/g, '')) || Date.now(),
      sku: product.sku || product._id,
      name: product.product_name,
      productName: product.product_name,
      price: product.hasPromotion ? product.discountedPrice : product.price,
      image: this.getProductImage(product),
      category: product.category,
      subcategory: product.subcategory,
      unit: product.unit,
      selected: true,
      originalPrice: originalPrice,
      hasPromotion: hasPromotion,
      stock: product.stock ?? product.Stock, // Thêm stock vào cartItem để kiểm tra
    };

    // Kiểm tra tồn kho trước khi thêm vào giỏ
    const canAdd = await this.cartService.checkStockBeforeAdd(
      cartItem,
      1,
      product.stock ?? product.Stock,
      false // Không phải "Mua ngay"
    );

    if (!canAdd) {
      return; // Không thêm vào giỏ nếu không đủ tồn kho
    }

    this.cartService.addToCart(cartItem);
  }

  toggleWishlist(product: any, event: Event): void {
    event.stopPropagation();

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    const customerID = this.getCustomerID();
    const sku = product.sku || product._id;

    if (customerID === 'guest') {
      // Mở popup đăng nhập nếu là guest
      this.authPopupService.openPopup('login');
      return;
    }

    // Toggle local state immediately for better UX
    const currentState = this.wishlistMap.get(sku) || false;
    this.wishlistMap.set(sku, !currentState);

    // Call API
    const productName = product.product_name || product.ProductName;
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

  isInWishlist(product: any): boolean {
    const sku = product.sku || product._id;
    return this.wishlistMap.get(sku) || false;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }

  getProductImage(product: any): string {
    if (product.image && Array.isArray(product.image) && product.image.length > 0) {
      return product.image[0];
    }
    return '/asset/image/placeholder.png';
  }

  getRating(product: any): number {
    return product.rating || 0;
  }

  // Format rating to always show 1 decimal place (e.g., 3.0, 4.5, 5.0)
  formatRating(rating: number | undefined | null): string {
    if (!rating || rating === 0) {
      return '0.0';
    }
    return rating.toFixed(1);
  }

  getStarArray(rating: number): boolean[] {
    return Array(5)
      .fill(false)
      .map((_, i) => i < Math.floor(rating));
  }

  /**
   * Kiểm tra xem sản phẩm có khuyến mãi Mua 1 tặng 1 không
   */
  hasBuy1Get1Promotion(product: any): boolean {
    if (!product.hasPromotion || !product.promotionType) {
      return false;
    }
    if (Array.isArray(product.promotionType)) {
      return product.promotionType.includes('buy1get1');
    }
    return product.promotionType === 'buy1get1';
  }

  /**
   * Kiểm tra xem sản phẩm có discount hợp lệ không
   * Chỉ trả về true khi:
   * - Có hasPromotion = true
   * - Có originalPrice và > 0
   * - Có discountPercent và > 0
   * - originalPrice > discountedPrice
   */
  hasDiscount(product: any): boolean {
    if (!product || !product.hasPromotion) {
      return false;
    }

    // Phải có originalPrice và > 0
    if (!product.originalPrice || product.originalPrice <= 0) {
      return false;
    }

    // Phải có discountPercent và > 0
    if (!product.discountPercent || product.discountPercent <= 0) {
      return false;
    }

    // originalPrice phải lớn hơn discountedPrice
    if (!product.discountedPrice || product.originalPrice <= product.discountedPrice) {
      return false;
    }

    return true;
  }

  // Reload blog data khi component được khởi tạo
  reloadBlogData(): void {
    // Force reload blog data với cache busting
    this.forceReloadBlogData();
  }

  // Force reload blog data từ backend API
  private async forceReloadBlogData(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3000/api/blogs');
      if (!response.ok) {
        throw new Error('Không thể tải dữ liệu blog từ backend');
      }
      const result = await response.json();

      if (result.success && result.data) {
        // console.log(' [Home] Reloaded blogs from MongoDB:', result.count);
        const data = result.data;

        // Update global blogData variable
        if (typeof blogData !== 'undefined') {
          blogData.length = 0;
          blogData.push(...data);
        }

        // Gọi initBlog để hiển thị dữ liệu mới
        if (typeof initBlog === 'function') {
          initBlog();
        }
      }
    } catch (error) {
      console.error(' [Home] Error reloading blogs from backend:', error);
      // Fallback: gọi loadBlogData gốc
      if (typeof loadBlogData === 'function') {
        loadBlogData();
      }
    }
  }
}

/**
 * Hero Slider Class
 * Quản lý carousel cho hero section (chỉ ảnh, không text)
 */
class HeroSlider {
  private currentSlide: number = 0;
  private totalSlides: number = 3;
  private autoPlayInterval: number = 5000;
  private autoPlayTimer?: number;
  private container: HTMLElement;
  private slidesContainer: HTMLElement;
  private dots: NodeListOf<HTMLElement>;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private isDragging: boolean = false;
  private startPos: number = 0;
  private currentTranslate: number = 0;
  private prevTranslate: number = 0;
  private isAutoPlaying: boolean = false;

  constructor() {
    this.container = document.querySelector('.hero-slider')!;
    this.slidesContainer = document.querySelector('.slides-container')!;
    this.dots = document.querySelectorAll('.dot');
    this.prevBtn = document.querySelector('.prev-btn')!;
    this.nextBtn = document.querySelector('.next-btn')!;

    // Đảm bảo tất cả elements đã được tìm thấy
    if (
      this.container &&
      this.slidesContainer &&
      this.dots.length > 0 &&
      this.prevBtn &&
      this.nextBtn
    ) {
      this.init();
    } else {
      console.error('HeroSlider: Không tìm thấy các elements cần thiết');
    }
  }

  /**
   * Khởi tạo slider và các event listeners
   */
  private init(): void {
    // Button events
    this.prevBtn.addEventListener('click', () => this.prevSlide());
    this.nextBtn.addEventListener('click', () => this.nextSlide());

    // Dot events
    // console.log('Dots found:', this.dots.length);
    this.dots.forEach((dot, index) => {
      // console.log(`Adding click listener to dot ${index}`);
      dot.addEventListener('click', () => {
        // console.log(`Dot ${index} clicked`);
        this.goToSlide(index);
      });
    });

    // Fallback: Event delegation cho dots
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('dot')) {
        const slideIndex = parseInt(target.getAttribute('data-slide') || '0');
        // console.log(`Dot clicked via delegation, slide: ${slideIndex}`);
        this.goToSlide(slideIndex);
      }
    });

    // Auto-play
    this.startAutoPlay();

    // Pause on hover
    this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
    this.container.addEventListener('mouseleave', () => this.startAutoPlay());

    // Keyboard navigation
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') this.prevSlide();
      if (e.key === 'ArrowRight') this.nextSlide();
    });

    // Touch/Drag events
    this.initTouchEvents();
  }

  /**
   * Khởi tạo touch/drag events cho mobile
   */
  private initTouchEvents(): void {
    // Mouse events
    this.slidesContainer.addEventListener('mousedown', (e) => this.touchStart(e));
    this.slidesContainer.addEventListener('mousemove', (e) => this.touchMove(e));
    this.slidesContainer.addEventListener('mouseup', () => this.touchEnd());
    this.slidesContainer.addEventListener('mouseleave', () => this.touchEnd());

    // Touch events
    this.slidesContainer.addEventListener('touchstart', (e) => this.touchStart(e));
    this.slidesContainer.addEventListener('touchmove', (e) => this.touchMove(e));
    this.slidesContainer.addEventListener('touchend', () => this.touchEnd());
  }

  /**
   * Bắt đầu kéo/vuốt
   */
  private touchStart(e: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    this.startPos = this.getPositionX(e);
    this.slidesContainer.style.transition = 'none';
    this.stopAutoPlay();
  }

  /**
   * Đang kéo/vuốt
   */
  private touchMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;

    const currentPosition = this.getPositionX(e);
    this.currentTranslate = this.prevTranslate + currentPosition - this.startPos;
  }

  /**
   * Kết thúc kéo/vuốt
   */
  private touchEnd(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    const movedBy = this.currentTranslate - this.prevTranslate;

    // Nếu kéo quá 50px thì chuyển slide (infinite loop)
    if (movedBy < -50) {
      this.nextSlide();
    } else if (movedBy > 50) {
      this.prevSlide();
    } else {
      this.updateSlider();
    }

    this.startAutoPlay();
  }

  /**
   * Lấy vị trí X từ event
   */
  private getPositionX(e: MouseEvent | TouchEvent): number {
    return e instanceof MouseEvent ? e.pageX : e.touches[0].clientX;
  }

  /**
   * Cập nhật hiển thị slider
   */
  private updateSlider(): void {
    const offset = -this.currentSlide * 100;
    this.slidesContainer.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    this.slidesContainer.style.transform = `translateX(${offset}%)`;

    this.prevTranslate = -this.currentSlide * this.container.offsetWidth;

    // Update dots
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentSlide);
    });
  }

  /**
   * Chuyển sang slide tiếp theo
   */
  public nextSlide(): void {
    // console.log('Next slide called, current:', this.currentSlide);
    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
    // console.log('New slide:', this.currentSlide);
    this.updateSlider();
  }

  /**
   * Chuyển về slide trước
   */
  public prevSlide(): void {
    this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
    this.updateSlider();
    // Chỉ restart autoplay nếu không phải từ autoplay
    if (!this.isAutoPlaying) {
      // console.log('Restarting autoplay after user interaction');
      this.startAutoPlay();
    }
  }

  /**
   * Nhảy đến slide cụ thể
   */
  public goToSlide(index: number): void {
    this.currentSlide = index;
    this.updateSlider();
    // Chỉ restart autoplay nếu không phải từ autoplay
    if (!this.isAutoPlaying) {
      // console.log('Restarting autoplay after user interaction');
      this.startAutoPlay();
    }
  }

  /**
   * Bắt đầu auto-play
   */
  private startAutoPlay(): void {
    this.stopAutoPlay(); // Clear existing timer
    // console.log('Starting autoplay with interval:', this.autoPlayInterval + 'ms');
    this.autoPlayTimer = window.setInterval(() => {
      // console.log('Autoplay: Moving to next slide');
      this.isAutoPlaying = true;
      this.nextSlide();
      this.isAutoPlaying = false;
    }, this.autoPlayInterval);
  }

  /**
   * Dừng auto-play
   */
  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      // console.log('Stopping autoplay');
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = undefined;
    }
  }

  /**
   * Cleanup khi destroy component
   */
  public destroy(): void {
    this.stopAutoPlay();
  }
}

/**
 * Categories Carousel Class
 * Quản lý carousel cho danh mục sản phẩm
 */
class CategoriesCarousel {
  private currentIndex: number = 0;
  private totalItems: number = 8;
  private itemsPerView: number = 6;
  private track: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;

  constructor() {
    this.track = document.querySelector('.categories-track')!;
    this.prevBtn = document.querySelector('.prev-category-btn')!;
    this.nextBtn = document.querySelector('.next-category-btn')!;

    // Debug logs
    // console.log('CategoriesCarousel elements found:');
    // console.log('Track:', this.track);
    // console.log('Prev button:', this.prevBtn);
    // console.log('Next button:', this.nextBtn);

    // Đảm bảo tất cả elements đã được tìm thấy
    if (this.track && this.prevBtn && this.nextBtn) {
      this.init();
    } else {
      console.error('CategoriesCarousel: Không tìm thấy các elements cần thiết');
    }
  }

  private init(): void {
    // console.log('CategoriesCarousel: Initializing...');
    this.prevBtn.addEventListener('click', () => this.prevSlide());
    this.nextBtn.addEventListener('click', () => this.nextSlide());
    this.updateButtons();

    // Thêm wheel scroll cho carousel
    this.initWheelScroll();

    // console.log('CategoriesCarousel: Initialized successfully');
  }

  private initWheelScroll(): void {
    const carousel = document.querySelector('.categories-carousel') as HTMLElement;
    if (!carousel) return;

    carousel.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY;

        if (delta > 0) {
          this.nextSlide();
        } else {
          this.prevSlide();
        }
      },
      { passive: false }
    );
  }

  private prevSlide(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateSlider();
      this.updateButtons();
    }
  }

  private nextSlide(): void {
    const maxIndex = this.totalItems - this.itemsPerView;
    if (this.currentIndex < maxIndex) {
      this.currentIndex++;
      this.updateSlider();
      this.updateButtons();
    }
  }

  private updateSlider(): void {
    const itemWidth = this.track.children[0]?.clientWidth || 200;
    const gap = 20;
    const translateX = -(this.currentIndex * (itemWidth + gap));
    this.track.style.transform = `translateX(${translateX}px)`;
  }

  private updateButtons(): void {
    this.prevBtn.disabled = this.currentIndex === 0;
    this.nextBtn.disabled = this.currentIndex >= this.totalItems - this.itemsPerView;
  }
}

/**
 * Interface cho Product (placeholder - sẽ mở rộng sau)
 */
interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  image: string;
  rating?: number;
  unit?: string;
  badges?: string[]; // ['hot', 'new', 'freeship']
}

/**
 * Product Carousel Class
 * Quản lý carousel cho các section sản phẩm
 */
class ProductCarousel {
  private currentIndex: number = 0;
  private totalItems: number;
  private itemsPerView: number = 4;
  private track: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private cardWidth: number = 0;
  private gap: number = 20;
  private sectionElement: HTMLElement;

  /**
   * Constructor
   * @param sectionSelector - CSS selector của section (vd: '.hot-deals-section')
   */
  constructor(sectionSelector: string) {
    this.sectionElement = document.querySelector(sectionSelector)!;
    this.track = this.sectionElement.querySelector('.product-track')!;
    this.prevBtn = this.sectionElement.querySelector('.prev-btn')!;
    this.nextBtn = this.sectionElement.querySelector('.next-btn')!;
    this.totalItems = this.track.querySelectorAll('.product-card').length;

    this.init();
  }

  /**
   * Khởi tạo carousel
   */
  private init(): void {
    this.calculateDimensions();
    this.updateButtons();

    // Event listeners
    this.prevBtn.addEventListener('click', () => this.scrollPrev());
    this.nextBtn.addEventListener('click', () => this.scrollNext());

    // Thêm wheel scroll cho carousel
    this.initWheelScroll();

    // Responsive
    let resizeTimer: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.calculateDimensions();
        this.currentIndex = 0;
        this.updateCarousel();
        this.updateButtons();
      }, 250);
    });
  }

  /**
   * Khởi tạo wheel scroll cho carousel
   */
  private initWheelScroll(): void {
    const carousel = this.sectionElement.querySelector('.product-carousel') as HTMLElement;
    if (!carousel) return;

    carousel.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY;

        if (delta > 0) {
          this.scrollNext();
        } else {
          this.scrollPrev();
        }
      },
      { passive: false }
    );
  }

  /**
   * Tính toán kích thước
   */
  private calculateDimensions(): void {
    const card = this.track.querySelector('.product-card') as HTMLElement;
    if (card) {
      this.cardWidth = card.offsetWidth;
    }

    // Update items per view based on screen size
    const width = window.innerWidth;
    if (width <= 480) {
      this.itemsPerView = 1;
    } else if (width <= 768) {
      this.itemsPerView = 2;
    } else if (width <= 1200) {
      this.itemsPerView = 3;
    } else {
      this.itemsPerView = 4;
    }
  }

  /**
   * Scroll sang phải
   */
  public scrollNext(): void {
    const maxScroll = Math.ceil(this.totalItems - this.itemsPerView);
    if (this.currentIndex < maxScroll) {
      this.currentIndex++;
      this.updateCarousel();
      this.updateButtons();
    }
  }

  /**
   * Scroll sang trái
   */
  public scrollPrev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCarousel();
      this.updateButtons();
    }
  }

  /**
   * Cập nhật vị trí carousel
   */
  private updateCarousel(): void {
    const offset = this.currentIndex * (this.cardWidth + this.gap);
    this.track.style.transform = `translateX(-${offset}px)`;
  }

  /**
   * Cập nhật trạng thái buttons
   */
  private updateButtons(): void {
    const maxScroll = Math.ceil(this.totalItems - this.itemsPerView);
    this.prevBtn.disabled = this.currentIndex === 0;
    this.nextBtn.disabled = this.currentIndex >= maxScroll;
  }

  /**
   * Thêm sản phẩm động (sử dụng sau này)
   */
  public addProducts(products: Product[]): void {
    // Implementation sẽ làm sau khi có thiết kế product card
    // console.log('Adding products:', products);
  }
}

// Carousel initialization is handled in Home component ngAfterViewInit

/**
 * Interface cho Testimonial
 */
interface Testimonial {
  id: string;
  text: string;
  rating: number; // 1-5
  authorName: string;
  authorRole: string;
  avatar?: string; // Optional avatar image
}

/**
 * Testimonials Carousel Class
 * Quản lý carousel cho testimonials section
 */
class TestimonialsCarousel {
  private currentIndex: number = 0;
  private totalItems: number;
  private itemsPerView: number = 3;
  private track: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private dots: NodeListOf<HTMLElement>;
  private cardWidth: number = 0;
  private gap: number = 30;
  private autoPlayInterval: number = 6000;
  private autoPlayTimer?: number;
  private sectionElement: HTMLElement;

  constructor() {
    this.sectionElement = document.querySelector('.testimonials-section')!;
    this.track = this.sectionElement?.querySelector('.testimonials-track')!;
    this.prevBtn = this.sectionElement?.querySelector('.prev-testimonial-btn')!;
    this.nextBtn = this.sectionElement?.querySelector('.next-testimonial-btn')!;
    this.dots =
      this.sectionElement?.querySelectorAll('.testimonial-dot') ||
      document.querySelectorAll('.testimonial-dot');
    this.totalItems = this.track?.querySelectorAll('.testimonial-card').length || 0;

    // Debug logs
    // console.log('TestimonialsCarousel elements found:');
    // console.log('Section:', this.sectionElement);
    // console.log('Track:', this.track);
    // console.log('Prev button:', this.prevBtn);
    // console.log('Next button:', this.nextBtn);
    // console.log('Dots:', this.dots.length);
    // console.log('Total items:', this.totalItems);

    // Đảm bảo tất cả elements đã được tìm thấy
    if (this.sectionElement && this.track && this.prevBtn && this.nextBtn && this.dots.length > 0) {
      this.init();
    } else {
      console.error('TestimonialsCarousel: Không tìm thấy các elements cần thiết');
      console.error('Missing elements:', {
        section: !!this.sectionElement,
        track: !!this.track,
        prevBtn: !!this.prevBtn,
        nextBtn: !!this.nextBtn,
        dots: this.dots.length,
      });
    }
  }

  /**
   * Khởi tạo carousel
   */
  private init(): void {
    // console.log('TestimonialsCarousel: Initializing...');
    this.calculateDimensions();
    this.updateButtons();
    this.updateDots();

    // Event listeners
    this.prevBtn.addEventListener('click', () => {
      // console.log('TestimonialsCarousel: Prev button clicked');
      this.scrollPrev();
    });
    this.nextBtn.addEventListener('click', () => {
      // console.log('TestimonialsCarousel: Next button clicked');
      this.scrollNext();
    });

    // Dots events
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        // console.log(`TestimonialsCarousel: Dot ${index} clicked`);
        this.goToSlide(index);
      });
    });

    // Auto-play
    this.startAutoPlay();

    // Pause on hover
    this.sectionElement.addEventListener('mouseenter', () => this.stopAutoPlay());
    this.sectionElement.addEventListener('mouseleave', () => this.startAutoPlay());

    // console.log('TestimonialsCarousel: Initialized successfully');

    // Responsive
    let resizeTimer: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.calculateDimensions();
        this.currentIndex = 0;
        this.updateCarousel();
        this.updateButtons();
        this.updateDots();
      }, 250);
    });
  }

  /**
   * Tính toán kích thước
   */
  private calculateDimensions(): void {
    const card = this.track.querySelector('.testimonial-card') as HTMLElement;
    if (card) {
      this.cardWidth = card.offsetWidth;
    }

    // Update items per view based on screen size
    const width = window.innerWidth;
    if (width <= 768) {
      this.itemsPerView = 1;
    } else if (width <= 1200) {
      this.itemsPerView = 2;
    } else {
      this.itemsPerView = 3;
    }
  }

  /**
   * Scroll sang phải
   */
  public scrollNext(): void {
    const maxIndex = this.totalItems - 1;
    if (this.currentIndex < maxIndex) {
      this.currentIndex++;
      this.updateCarousel();
      this.updateButtons();
      this.updateDots();
    }
  }

  /**
   * Scroll sang trái
   */
  public scrollPrev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCarousel();
      this.updateButtons();
      this.updateDots();
    }
  }

  /**
   * Nhảy đến slide cụ thể
   */
  public goToSlide(index: number): void {
    this.currentIndex = index;
    this.updateCarousel();
    this.updateButtons();
    this.updateDots();
  }

  /**
   * Cập nhật vị trí carousel
   */
  private updateCarousel(): void {
    const offset = this.currentIndex * (this.cardWidth + this.gap);
    this.track.style.transform = `translateX(-${offset}px)`;
  }

  /**
   * Cập nhật trạng thái buttons
   */
  private updateButtons(): void {
    const maxIndex = this.totalItems - 1;
    this.prevBtn.disabled = this.currentIndex === 0;
    this.nextBtn.disabled = this.currentIndex >= maxIndex;
  }

  /**
   * Cập nhật dots indicator
   */
  private updateDots(): void {
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentIndex);
    });
  }

  /**
   * Bắt đầu auto-play
   */
  private startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayTimer = window.setInterval(() => {
      if (this.currentIndex >= this.totalItems - 1) {
        this.goToSlide(0); // Loop về đầu
      } else {
        this.scrollNext();
      }
    }, this.autoPlayInterval);
  }

  /**
   * Dừng auto-play
   */
  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = undefined;
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopAutoPlay();
  }

  /**
   * Reinitialize carousel (fallback method)
   */
  public reinitialize(): void {
    // console.log('TestimonialsCarousel: Reinitializing...');
    this.sectionElement = document.querySelector('.testimonials-section')!;
    this.track = this.sectionElement?.querySelector('.testimonials-track')!;
    this.prevBtn = this.sectionElement?.querySelector('.prev-testimonial-btn')!;
    this.nextBtn = this.sectionElement?.querySelector('.next-testimonial-btn')!;
    this.dots =
      this.sectionElement?.querySelectorAll('.testimonial-dot') ||
      document.querySelectorAll('.testimonial-dot');
    this.totalItems = this.track?.querySelectorAll('.testimonial-card').length || 0;

    if (this.sectionElement && this.track && this.prevBtn && this.nextBtn && this.dots.length > 0) {
      this.init();
    }
  }
}

// Khởi tạo được thực hiện trong Angular component ngAfterViewInit

/**
 * Sample testimonials data
 */
const testimonialsData: Testimonial[] = [
  {
    id: 'test-1',
    text: 'Đặt buổi sáng, chiều có rồi, nhanh thật! Đỗ tươi mà còn được bonus ít rau thêm, dễ thương ghê.',
    rating: 5,
    authorName: 'Minh Quân',
    authorRole: 'Nhân viên Marketing',
  },
  {
    id: 'test-2',
    text: 'Mua mấy lần rồi mà chất lượng vẫn y như cũ, rau củ tươi rói, đóng gói gọn gàng.',
    rating: 5,
    authorName: 'Yến Ngọc',
    authorRole: 'Sinh viên',
  },
  {
    id: 'test-3',
    text: 'Gạo sạch, nấu thơm dẻo, ăn yên tâm vì biết rõ nguồn gốc.',
    rating: 5,
    authorName: 'Lan Anh',
    authorRole: 'Nội trợ',
  },
  {
    id: 'test-4',
    text: 'Dịch vụ giao hàng nhanh, đóng gói cẩn thận. Rau củ tươi ngon, giá cả hợp lý.',
    rating: 5,
    authorName: 'Thành Đạt',
    authorRole: 'Kỹ sư',
  },
  {
    id: 'test-5',
    text: 'Mua trái cây ở đây luôn tươi ngon, không lo về chất lượng. Giao hàng đúng giờ.',
    rating: 5,
    authorName: 'Mai Linh',
    authorRole: 'Giáo viên',
  },
  {
    id: 'test-6',
    text: 'Sản phẩm organic chất lượng cao, đáng tin cậy. Gia đình tôi rất hài lòng.',
    rating: 5,
    authorName: 'Văn Hùng',
    authorRole: 'Bác sĩ',
  },
];

// Interface cho Blog Post - Khớp với MongoDB schema
interface BlogPost {
  id: string; // MongoDB: id
  img: string; // MongoDB: img
  title: string; // MongoDB: title
  excerpt: string; // MongoDB: excerpt
  pubDate: string | Date; // MongoDB: pubDate (Date)
  author: string; // MongoDB: author
  categoryTag: string; // MongoDB: categoryTag
  content: string; // MongoDB: content
  status?: string; // MongoDB: status (Active/Draft/Archived)
  views?: number; // MongoDB: views
  createdAt?: Date; // MongoDB: createdAt
  updatedAt?: Date; // MongoDB: updatedAt
}

let blogData: BlogPost[] = [];

// Load data từ backend API
async function loadBlogData(): Promise<void> {
  try {
    const response = await fetch('http://localhost:3000/api/blogs');
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu blog từ backend');
    }
    const result = await response.json();

    if (result.success && result.data) {
      // console.log(' [Home] Loaded blogs from MongoDB:', result.count);
      blogData = result.data;
      initBlog();
    } else {
      throw new Error('Dữ liệu blog không hợp lệ');
    }
  } catch (error) {
    console.error(' [Home] Error loading blogs from backend:', error);

    // Fallback: thử load từ JSON nếu backend lỗi
    try {
      const fallbackResponse = await fetch('data/blog.json');
      if (fallbackResponse.ok) {
        // console.log(' [Home] Using fallback JSON data');
        blogData = await fallbackResponse.json();
        initBlog();
      }
    } catch (fallbackError) {
      console.error(' [Home] Fallback also failed:', fallbackError);
      blogData = [];
    }
  }
}

// Format ngày tháng - Xử lý cả Date object và string
function formatDate(dateInput: string | Date): string {
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = new Date();
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Hiển thị bài viết nổi bật
function displayFeaturedPost(post: BlogPost): void {
  const featuredImg = document.getElementById('featured-img') as HTMLImageElement;
  const featuredAuthor = document.getElementById('featured-author') as HTMLElement;
  const featuredDate = document.getElementById('featured-date') as HTMLElement;
  const featuredTitle = document.getElementById('featured-title') as HTMLElement;
  const featuredExcerpt = document.getElementById('featured-excerpt') as HTMLElement;

  if (featuredImg && featuredAuthor && featuredDate && featuredTitle && featuredExcerpt) {
    featuredImg.src = post.img;
    featuredImg.alt = post.title;
    featuredAuthor.textContent = post.author;
    featuredDate.textContent = formatDate(post.pubDate);
    featuredTitle.textContent = post.title;
    featuredExcerpt.textContent = post.excerpt;
  }
}

// Hiển thị danh sách bài viết
function displayPostsList(): void {
  const postsContainer = document.getElementById('posts-container') as HTMLElement;
  if (!postsContainer) return;

  postsContainer.innerHTML = '';

  blogData.forEach((post) => {
    // Normalize post ID: trim và loại bỏ dấu phẩy thừa
    const normalizedPostId = post.id ? post.id.trim().replace(/,$/, '').trim() : post.id;
    const postItem = document.createElement('div');
    postItem.className = 'post-item';
    postItem.setAttribute('data-post-id', normalizedPostId);
    postItem.onclick = () => navigateToBlogDetail(normalizedPostId);

    // Thêm inline style để đảm bảo style được áp dụng
    postItem.style.cssText = `
          padding: 16px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e0e0e0;
          margin-bottom: 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
          cursor: pointer;
          transition: all 0.3s ease;
      `;

    postItem.innerHTML = `
          <div class="post-item-content">
              <div class="post-item-meta">
                  <span class="post-item-author">${post.author}</span>
                  <span class="separator">|</span>
                  <span class="post-item-date">${formatDate(post.pubDate)}</span>
              </div>
              <h4 class="post-item-title">${post.title}</h4>
          </div>
      `;

    // Thêm style cho title
    const title = postItem.querySelector('.post-item-title') as HTMLElement;
    if (title) {
      title.style.cssText = `
              font-family: "SF Pro";
              padding: 10px 0;
              font-size: 20px;
              font-weight: 700;
              line-height: 1.4;
              color: black;
              margin-bottom: 0;
              transition: color 0.3s ease;
          `;
    }

    // Thêm style cho meta information
    const meta = postItem.querySelector('.post-item-meta') as HTMLElement;
    if (meta) {
      meta.style.cssText = `
              display: flex;
              align-items: center;
              gap: 5px;
              margin-bottom: 5px;
              font-size: 12px;
              color: #666;
          `;
    }

    // Style cho author
    const author = postItem.querySelector('.post-item-author') as HTMLElement;
    if (author) {
      author.style.cssText = `
              color: #349409;
              font-weight: 500;
          `;
    }

    // Style cho date
    const date = postItem.querySelector('.post-item-date') as HTMLElement;
    if (date) {
      date.style.cssText = `
              color: #999;
          `;
    }

    // Thêm hover effect bằng JavaScript
    postItem.addEventListener('mouseenter', () => {
      postItem.style.background = '#f8f9fa';
      postItem.style.transform = 'translateY(-2px)';
      postItem.style.borderColor = '#349409';
      postItem.style.boxShadow = '0 4px 16px rgba(52, 148, 9, 0.15)';

      // Thay đổi màu title khi hover
      const title = postItem.querySelector('.post-item-title') as HTMLElement;
      if (title) {
        title.style.color = '#349409';
      }
    });

    postItem.addEventListener('mouseleave', () => {
      postItem.style.background = 'white';
      postItem.style.transform = 'translateY(0)';
      postItem.style.borderColor = '#e0e0e0';
      postItem.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.05)';

      // Trở về màu title ban đầu
      const title = postItem.querySelector('.post-item-title') as HTMLElement;
      if (title) {
        title.style.color = 'black';
      }
    });

    postsContainer.appendChild(postItem);
  });
}

// Biến global để lưu featured post hiện tại
let currentFeaturedPost: BlogPost | null = null;

// Điều hướng đến trang blog detail
function navigateToBlogDetail(postId: string): void {
  // Normalize postId: trim và loại bỏ dấu phẩy thừa
  const normalizedPostId = postId.trim().replace(/,$/, '').trim();
  window.location.href = `/blog/${normalizedPostId}`;
}

// Cập nhật bài viết nổi bật khi click vào bài viết bên phải
function updateFeaturedPost(post: BlogPost): void {
  // Lưu featured post hiện tại
  currentFeaturedPost = post;

  // Hiển thị bài viết nổi bật bên trái
  displayFeaturedPost(post);

  // Reset style cho tất cả bài viết bên phải
  const allPostItems = document.querySelectorAll('.post-item');
  allPostItems.forEach((item) => {
    const postElement = item as HTMLElement;
    postElement.style.borderColor = '#e0e0e0';
    postElement.style.borderWidth = '1px';
    postElement.style.boxShadow = '0 1px 6px rgba(0, 0, 0, 0.05)';
  });

  // Làm nổi bật bài viết đang được hiển thị
  const currentPostItem = document.querySelector(`[data-post-id="${post.id}"]`) as HTMLElement;
  if (currentPostItem) {
    currentPostItem.style.borderColor = '#349409'; // màu xanh lá thương hiệu
    currentPostItem.style.borderWidth = '2px';
    currentPostItem.style.boxShadow = '0 2px 12px rgba(52, 148, 9, 0.2)';
  }
}

// Khởi tạo blog
function initBlog(): void {
  if (blogData.length === 0) return;

  // Set featured post đầu tiên
  currentFeaturedPost = blogData[0];

  // Hiển thị bài viết đầu tiên làm featured post
  displayFeaturedPost(blogData[0]);

  // Hiển thị danh sách bài viết
  displayPostsList();

  // Xử lý nút "Đọc thêm" - chuyển đến blog detail
  const readMoreBtn = document.querySelector('.read-more-btn') as HTMLElement;
  if (readMoreBtn) {
    readMoreBtn.onclick = () => {
      // Lấy ID của featured post hiện tại
      if (currentFeaturedPost && currentFeaturedPost.id) {
        navigateToBlogDetail(currentFeaturedPost.id);
      }
    };
  }
}

// Load dữ liệu khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
  loadBlogData();
});
