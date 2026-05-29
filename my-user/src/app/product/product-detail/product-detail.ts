import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { CookbookDetail } from '../cookbook-detail/cookbook-detail';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { AuthPopupService } from '../../services/auth-popup.service';
import { ToastService } from '../../services/toast.service';

interface Product {
  _id: string;
  Category: string;
  Subcategory: string;
  ProductName: string;
  Brand: string;
  Unit: string;
  Price: number;
  Image: string[]; // Đổi từ string sang string[] (array of images)
  sku: string; // lowercase để match với product.json
  Origin: string;
  Weight: string;
  Ingredients: string;
  Usage: string;
  Storage: string;
  ManufactureDate: string;
  ExpiryDate: string;
  Producer: string;
  SafetyWarning: string;
  ResponsibleOrg: string;
  Color: any;
  Rating?: number;
  OriginalPrice?: number;
  Discount?: number;
  Description?: string;
  ReviewCount?: number;
  Reviews?: any[];
  PurchaseCount?: number; // Thêm trường purchase_count
  Liked?: number; // Thêm trường liked (số lượt thích)
  hasPromotion?: boolean;
  promotionType?: 'normal' | 'buy1get1' | ('normal' | 'buy1get1')[];
  Stock?: number; // Số lượng tồn kho
}

interface Reply {
  fullname: string;
  customer_id: string;
  content: string;
  time: Date | string;
  likes: string[]; // Array of customer_id who liked this reply
  _id?: string;
}

interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  time: string | Date;
  images?: string[]; // Hình ảnh từ review
  likes?: string[]; // Array of customer_id who liked this review
  replies?: Reply[]; // Array of replies to this review
  customer_id?: string; // Customer ID của người viết review
  reviewIndex?: number; // Index trong mảng reviews từ backend (để dùng cho API)
}

interface RatingBreakdown {
  stars: number;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, CookbookDetail],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.css'],
})
export class ProductDetailComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('productInfoCard', { read: ElementRef }) productInfoCard?: ElementRef;
  private lastCalculatedHeight: number = 0;
  private resizeListener?: () => void;
  private cookbookContainerElement?: HTMLElement;

  product: Product | null = null;
  productId: string = '';
  quantity: number = 1;
  currentImageIndex: number = 0;
  productImages: string[] = [];
  activeTab: string = 'details'; // Default to details tab

  // Dropdown state
  isSortDropdownOpen: boolean = false;
  selectedSortOption: string = 'Mới nhất';

  // Reviews sorting
  sortedReviews: any[] = [];

  // Reviews pagination
  displayedReviews: any[] = [];
  reviewsPerPage: number = 3;
  currentPage: number = 1;
  hasMoreReviews: boolean = true;
  isReviewsExpanded: boolean = false; // Track xem đã mở rộng reviews chưa

  // Scroll to top button
  showScrollButton: boolean = false;
  private scrollThreshold: number = 300;
  relatedProducts: Product[] = [];
  displayedRelatedProducts: Product[] = [];
  relatedProductsPerPage: number = 10; // 2 hàng x 5 cột
  hasMoreRelatedProducts: boolean = false;
  favoriteProducts: Set<string> = new Set(); // Track favorite products by ID

  // Consultation section
  newQuestion: string = '';
  questions: any[] = [];
  isLoadingConsultations: boolean = false;
  isSubmittingQuestion: boolean = false;

  // Cookbook recipes
  allCookbookRecipes: any[] = []; // Tất cả recipes phù hợp
  cookbookRecipes: any[] = []; // Recipes hiển thị trên trang hiện tại
  currentRecipePage: number = 1; // Trang hiện tại (bắt đầu từ 1)
  recipesPerPage: number = 5; // Số recipes mỗi trang (cố định)
  selectedRecipe: any = null; // Recipe được chọn để hiển thị popup
  isRecipePopupOpen: boolean = false; // Trạng thái hiển thị popup
  canPrevPage: boolean = false; // Cached value để tránh ExpressionChangedAfterItHasBeenCheckedError
  canNextPage: boolean = false; // Cached value để tránh ExpressionChangedAfterItHasBeenCheckedError

  // Reviews data
  reviews: Review[] = [
    {
      id: '1',
      name: 'Ngọc Hân',
      rating: 5,
      text: 'Cà chua tươi, mọng nước, vị ngọt thanh cực kỳ dễ ăn luôn! Mua về ăn liền không cần nấu cũng ngon',
      time: 'Khoảng 2 giờ trước',
    },
    {
      id: '2',
      name: 'Minh Thiện',
      rating: 4,
      text: 'Hàng giao nhanh, đóng gói cẩn thận. Tuy có vài quả hơi dập nhẹ nhưng nhìn chung chất lượng ổn, giá hợp lý.',
      time: '1 ngày trước',
    },
    {
      id: '3',
      name: 'Khánh Linh',
      rating: 5,
      text: 'Mình đặt 2kg, ăn thử thấy ngon, sạch. Sẽ đặt thêm để làm món mỳ Ý sốt cà chua luôn!',
      time: '3 ngày trước',
    },
  ];

  ratingBreakdown: RatingBreakdown[] = [];

  // Review interactions
  showReplyForm: { [key: string]: boolean } = {}; // Track which review has reply form open
  replyTexts: { [key: string]: string } = {}; // Store reply text for each review
  likingReviews: Set<string> = new Set(); // Track reviews being liked (to prevent double-click)
  replyingReviews: Set<string> = new Set(); // Track reviews being replied to

  private apiUrl = '/api';
  private activePromotions: any[] = [];
  private promotionTargets: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private authService: AuthService,
    private productService: ProductService,
    private authPopupService: AuthPopupService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Reset dropdown to default when component initializes
    this.selectedSortOption = 'Mới nhất';
    this.isSortDropdownOpen = false;

    // Load favorite products from WishlistService
    this.loadFavoriteProducts();

    this.route.params.subscribe((params) => {
      this.productId = params['id'];
      // Reset dropdown when switching to different product
      this.selectedSortOption = 'Mới nhất';
      this.isSortDropdownOpen = false;

      if (this.productId) {
        this.loadProduct();
        //  KHÔNG gọi loadCookbookRecipes() ở đây vì this.product chưa có dữ liệu
        //  Sẽ gọi bên trong loadProduct() sau khi product data đã được load
      } else {
        console.error('No product ID provided');
        this.router.navigate(['/product-list']);
      }
    });

    // Lắng nghe sự kiện resize để tính toán lại
    this.resizeListener = () => {
      this.calculateRecipesPerPage();
      this.syncCookbookHeight();
    };
    window.addEventListener('resize', this.resizeListener);

    // Initialize scroll listener for scroll-to-top button
    this.initScrollListener();
  }

  ngAfterViewInit(): void {
    // Tìm cookbook-container element sau khi view init
    setTimeout(() => {
      const cookbookElement = document.querySelector('.cookbook-container') as HTMLElement;
      if (cookbookElement) {
        this.cookbookContainerElement = cookbookElement;
        this.syncCookbookHeight();
      } else {
        // Nếu chưa có, thử lại sau một chút (có thể recipes chưa load xong)
        setTimeout(() => {
          const cookbookElementRetry = document.querySelector('.cookbook-container') as HTMLElement;
          if (cookbookElementRetry) {
            this.cookbookContainerElement = cookbookElementRetry;
            this.syncCookbookHeight();
          }
        }, 500);
      }
    }, 100);
  }

  // Load favorite products from WishlistService
  loadFavoriteProducts(): void {
    const wishlist = this.wishlistService.getCurrentWishlist();
    this.favoriteProducts = new Set(wishlist.map((item) => item.sku));
  }

  ngAfterViewChecked(): void {
    // Tính toán lại mỗi khi view có thay đổi (tab switching, content changes)
    this.calculateRecipesPerPage();
    this.syncCookbookHeight();
  }

  ngOnDestroy(): void {
    // Cleanup resize listener
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    // Cleanup scroll listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
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

  /**
   * Tính toán số recipes có thể hiển thị dựa trên chiều cao của product-info-card
   */
  /**
   * Đồng bộ chiều cao của cookbook-container với product-info-card
   */
  syncCookbookHeight(): void {
    if (!this.productInfoCard || !this.cookbookContainerElement) {
      return;
    }

    const productInfoHeight = this.productInfoCard.nativeElement.offsetHeight;
    const cookbookHeight = this.cookbookContainerElement.offsetHeight;

    // Chỉ sync nếu chiều cao khác nhau đáng kể (> 5px)
    if (Math.abs(productInfoHeight - cookbookHeight) > 5) {
      this.cookbookContainerElement.style.height = `${productInfoHeight}px`;
    }
  }

  calculateRecipesPerPage(): void {
    if (!this.productInfoCard || this.allCookbookRecipes.length === 0) {
      return;
    }

    const currentHeight = this.productInfoCard.nativeElement.offsetHeight;

    // Chỉ tính toán lại nếu chiều cao thay đổi đáng kể (> 10px để tránh loop vô hạn)
    if (Math.abs(currentHeight - this.lastCalculatedHeight) < 10) {
      return;
    }

    this.lastCalculatedHeight = currentHeight;

    // Đồng bộ chiều cao cookbook-container
    this.syncCookbookHeight();

    const cookbookHeaderHeight = 56; // Chiều cao của cookbook header
    const recipeItemHeight = 104; // Chiều cao thực tế: padding (16*2=32) + content (~72px) = ~104px
    const recipeGap = 10; // Gap giữa các recipe items (theo CSS: gap: 10px)
    const padding = 32; // Padding của recipe-list (16 top + 16 bottom)

    // Chiều cao khả dụng cho recipes
    const availableHeight = currentHeight - cookbookHeaderHeight - padding;

    // Tính số recipes có thể fit với logic cải thiện
    // Nếu có đủ không gian cho hơn 0.5 recipe nữa thì làm tròn lên để tận dụng không gian
    const exactRecipes = availableHeight / (recipeItemHeight + recipeGap);
    // Làm tròn lên nếu có đủ không gian cho > 0.5 recipe (tức là >= 0.5 recipe nữa)
    const calculatedRecipes =
      exactRecipes - Math.floor(exactRecipes) >= 0.5
        ? Math.ceil(exactRecipes)
        : Math.floor(exactRecipes);

    // Tối thiểu là 3, tối đa là 10
    const newRecipesPerPage = Math.max(3, Math.min(10, calculatedRecipes));

    // Chỉ cập nhật nếu có sự thay đổi
    if (newRecipesPerPage !== this.recipesPerPage) {
      console.log(
        `📏 Calculated recipesPerPage: ${newRecipesPerPage} (product-info height: ${currentHeight}px)`
      );
      this.recipesPerPage = newRecipesPerPage;

      // Reset về trang 1 và cập nhật displayed recipes
      this.currentRecipePage = 1;
      // Sử dụng setTimeout để tránh ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.updateDisplayedRecipes();
        // Đồng bộ chiều cao sau khi update
        this.syncCookbookHeight();
      }, 0);
    }
  }

  loadProduct(): void {
    console.log(` Loading product with ID: ${this.productId}`);

    // Reset quantity về 1 khi chuyển sang sản phẩm mới
    this.quantity = 1;

    // Reset current image index về 0
    this.currentImageIndex = 0;

    // Reset active tab về "Chi tiết" khi chuyển sang sản phẩm mới
    this.activeTab = 'details';

    // Reset dropdown state
    this.selectedSortOption = 'Mới nhất';
    this.isSortDropdownOpen = false;

    // Reset cookbook recipes ngay khi bắt đầu load sản phẩm mới để tránh hiển thị dữ liệu cũ
    this.allCookbookRecipes = [];
    this.cookbookRecipes = [];
    this.currentRecipePage = 1;
    this.updatePaginationState();

    // Load product, promotions, and targets in parallel
    forkJoin({
      product: this.productService.getProductById(this.productId),
      promotions: this.http.get<any>(`${this.apiUrl}/promotions`),
      targets: this.http.get<any>(`${this.apiUrl}/promotion-targets`),
    }).subscribe({
      next: ({ product: data, promotions, targets }) => {
        if (!data) {
          console.error(' Product not found with ID:', this.productId);
          this.product = null;
          return;
        }

        // Filter active promotions
        const now = new Date();
        const allPromotions = promotions.data || [];
        const activePromotions = allPromotions.filter((p: any) => {
          const startDate = new Date(p.start_date);
          const endDate = new Date(p.end_date);
          return p.status === 'Active' && now >= startDate && now <= endDate;
        });

        // Cache promotions and targets for use in related products
        this.activePromotions = activePromotions;
        this.promotionTargets = targets?.data || [];

        // Apply promotion to product
        const productWithPromotion = this.applyPromotionToProduct(
          data,
          activePromotions,
          targets?.data || []
        );

        // Chuẩn hóa data: MongoDB trả về snake_case, frontend dùng PascalCase
        this.product = {
          _id: productWithPromotion._id,
          ProductName: productWithPromotion.product_name ?? '',
          Category: productWithPromotion.category ?? '',
          Subcategory: productWithPromotion.subcategory ?? '',
          Brand: productWithPromotion.brand ?? '',
          Unit: productWithPromotion.unit ?? '',
          Price: productWithPromotion.hasPromotion
            ? productWithPromotion.discountedPrice
            : productWithPromotion.price ?? 0,
          Image: Array.isArray(productWithPromotion.image)
            ? productWithPromotion.image
            : [productWithPromotion.image || ''],
          sku: productWithPromotion.sku ?? '',
          Origin: productWithPromotion.origin ?? '',
          Weight: productWithPromotion.weight ?? '',
          Ingredients: productWithPromotion.ingredients ?? '',
          Usage: productWithPromotion.usage ?? '',
          Storage: productWithPromotion.storage ?? '',
          ManufactureDate: productWithPromotion.manufacture_date ?? '',
          ExpiryDate: productWithPromotion.expiry_date ?? '',
          Producer: productWithPromotion.producer ?? '',
          SafetyWarning: productWithPromotion.safety_warning ?? '',
          ResponsibleOrg: '',
          Color: productWithPromotion.color,
          Rating: productWithPromotion.rating ?? 0,
          OriginalPrice: productWithPromotion.hasPromotion
            ? productWithPromotion.originalPrice
            : undefined,
          Discount: productWithPromotion.hasPromotion
            ? productWithPromotion.discountPercent
            : undefined,
          Description: '',
          ReviewCount: 0,
          Reviews: [],
          PurchaseCount: productWithPromotion.purchase_count ?? 0,
          Liked: productWithPromotion.liked ?? 0,
          hasPromotion: productWithPromotion.hasPromotion || false,
          promotionType: productWithPromotion.promotionType || undefined,
          Stock: productWithPromotion.stock ?? 0, // Số lượng tồn kho
        };

        console.log(' Product loaded successfully:', this.product.ProductName);
        console.log(' Has promotion:', !!productWithPromotion.hasPromotion);

        // Set page title
        document.title = `${this.product.ProductName} - VGreen`;
        if (productWithPromotion.hasPromotion) {
          console.log(
            ' Promotion:',
            productWithPromotion.promotionName,
            '-',
            productWithPromotion.discountPercent + '%'
          );
        }

        this.setupProductImages();
        this.loadRelatedProducts();

        // Load reviews from backend
        this.loadReviews();

        // Load consultations from backend
        this.loadConsultations();

        //  Load cookbook recipes SAU KHI product data đã sẵn sàng
        this.loadCookbookRecipes();
      },
      error: (error) => {
        console.error(' Error loading product:', error);
        this.product = null;
      },
    });
  }

  setupProductImages(): void {
    if (this.product) {
      // Image bây giờ là array, lấy tất cả ảnh có sẵn (không lặp lại)
      const images =
        this.product.Image && this.product.Image.length > 0 ? this.product.Image : [''];

      // Sử dụng tất cả ảnh có sẵn, không giới hạn số lượng
      this.productImages = images;

      // Reset to first image when setting up new product
      this.currentImageIndex = 0;
    }
  }

  // Kiểm tra có nhiều hơn 1 ảnh không (để hiển thị nút navigation)
  hasMultipleImages(): boolean {
    return this.productImages && this.productImages.length > 1;
  }

  loadRelatedProducts(): void {
    console.log(' Loading related products from MongoDB API');
    this.productService.getAllProducts().subscribe({
      next: (data) => {
        if (this.product) {
          // Apply promotions to all products first
          const productsWithPromotions = data.map((p) => {
            const productWithPromotion = this.applyPromotionToProduct(
              p,
              this.activePromotions,
              this.promotionTargets
            );
            return productWithPromotion;
          });

          // Chuẩn hóa data: MongoDB trả về snake_case, frontend dùng PascalCase
          const normalizedData = productsWithPromotions.map((p) => ({
            _id: p._id,
            ProductName: p.product_name ?? '',
            Category: p.category ?? '',
            Subcategory: p.subcategory ?? '',
            Brand: p.brand ?? '',
            Unit: p.unit ?? '',
            Price: p.hasPromotion ? p.discountedPrice : p.price ?? 0,
            Image: Array.isArray(p.image) ? p.image : [p.image || ''],
            sku: p.sku ?? '',
            Origin: p.origin ?? '',
            Weight: p.weight ?? '',
            Ingredients: p.ingredients ?? '',
            Usage: p.usage ?? '',
            Storage: p.storage ?? '',
            ManufactureDate: p.manufacture_date ?? '',
            ExpiryDate: p.expiry_date ?? '',
            Producer: p.producer ?? '',
            SafetyWarning: p.safety_warning ?? '',
            ResponsibleOrg: '',
            Color: p.color,
            Rating: p.rating ?? 0,
            OriginalPrice: p.hasPromotion ? p.originalPrice : undefined,
            Discount: p.hasPromotion ? p.discountPercent : undefined,
            Description: '',
            ReviewCount: 0,
            Reviews: [],
            PurchaseCount: p.purchase_count ?? 0,
            Liked: p.liked ?? 0,
            hasPromotion: p.hasPromotion || false,
            promotionType: p.promotionType || undefined,
          }));

          // Lọc sản phẩm liên quan: ưu tiên cùng subcategory, sau đó cùng category
          const currentProduct = this.product;
          const currentSubcategory = currentProduct.Subcategory?.trim() || '';
          const currentCategory = currentProduct.Category?.trim() || '';
          const currentProductId = currentProduct._id;

          // Bước 1: Lọc sản phẩm cùng subcategory (ưu tiên cao nhất)
          const sameSubcategoryProducts = normalizedData.filter((p) => {
            const pSubcategory = p.Subcategory?.trim() || '';
            return (
              pSubcategory === currentSubcategory &&
              currentSubcategory !== '' &&
              p._id !== currentProductId
            );
          });

          // Bước 2: Nếu không đủ sản phẩm, bổ sung thêm sản phẩm cùng category
          let relatedProductsList: Product[] = [...sameSubcategoryProducts];

          if (relatedProductsList.length < 20 && currentCategory !== '') {
            // Lấy thêm sản phẩm cùng category nhưng khác subcategory
            const sameCategoryProducts = normalizedData.filter((p) => {
              const pCategory = p.Category?.trim() || '';
              const pSubcategory = p.Subcategory?.trim() || '';
              return (
                pCategory === currentCategory &&
                pSubcategory !== currentSubcategory &&
                p._id !== currentProductId &&
                !relatedProductsList.some((rp) => rp._id === p._id)
              ); // Tránh trùng lặp
            });

            // Bổ sung cho đủ 20 sản phẩm (hoặc tất cả nếu ít hơn 20)
            const remainingSlots = 20 - relatedProductsList.length;
            relatedProductsList = [
              ...relatedProductsList,
              ...sameCategoryProducts.slice(0, remainingSlots),
            ];
          }

          this.relatedProducts = relatedProductsList;
          console.log(
            ` Found ${this.relatedProducts.length} related products (${
              sameSubcategoryProducts.length
            } same subcategory, ${
              this.relatedProducts.length - sameSubcategoryProducts.length
            } same category)`
          );

          // Initialize displayed products first
          this.displayedRelatedProducts = this.relatedProducts.slice(
            0,
            this.relatedProductsPerPage
          );
          this.hasMoreRelatedProducts = this.relatedProducts.length > this.relatedProductsPerPage;

          // Load reviews for related products to calculate ratings (async, will update displayed products)
          this.loadReviewsForRelatedProducts();
        }
      },
      error: (error) => {
        console.error(' Error loading related products:', error);
      },
    });
  }

  // Load reviews for related products to calculate ratings
  loadReviewsForRelatedProducts(): void {
    if (this.relatedProducts.length === 0) return;

    // Load reviews for all related products in parallel
    const reviewRequests = this.relatedProducts.map((product) =>
      this.http.get<any>(`http://localhost:3000/api/reviews/${product.sku}`)
    );

    forkJoin(reviewRequests).subscribe({
      next: (responses) => {
        responses.forEach((response, index) => {
          const product = this.relatedProducts[index];
          if (response.success && response.data && response.data.reviews) {
            const reviews = response.data.reviews;
            // Calculate rating from reviews
            const totalRating = reviews.reduce(
              (sum: number, review: any) => sum + review.rating,
              0
            );
            const calculatedRating =
              reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;

            // Update product rating and review count
            product.Rating = calculatedRating;
            product.ReviewCount = reviews.length;
          } else {
            // No reviews found
            product.Rating = 0;
            product.ReviewCount = 0;
          }
        });

        // Update displayed products with new ratings (only if they haven't changed)
        const currentDisplayCount = this.displayedRelatedProducts.length;
        if (currentDisplayCount <= this.relatedProductsPerPage) {
          this.displayedRelatedProducts = this.relatedProducts.slice(
            0,
            this.relatedProductsPerPage
          );
        }
      },
      error: (error) => {
        console.error('Error loading reviews for related products:', error);
        // Set default values on error
        this.relatedProducts.forEach((product) => {
          if (!product.Rating) product.Rating = 0;
          if (!product.ReviewCount) product.ReviewCount = 0;
        });
      },
    });
  }

  // Load more related products
  loadMoreRelatedProducts(): void {
    const currentCount = this.displayedRelatedProducts.length;
    const nextProducts = this.relatedProducts.slice(
      currentCount,
      currentCount + this.relatedProductsPerPage
    );
    this.displayedRelatedProducts = [...this.displayedRelatedProducts, ...nextProducts];
    this.hasMoreRelatedProducts =
      this.displayedRelatedProducts.length < this.relatedProducts.length;
  }

  // Image gallery methods
  selectImage(index: number): void {
    this.currentImageIndex = index;
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  nextImage(): void {
    if (this.currentImageIndex < this.productImages.length - 1) {
      this.currentImageIndex++;
    }
  }

  // Quantity methods
  increaseQuantity(): void {
    if (!this.product) return;

    // Tính số lượng cần thiết (với buy1get1 thì nhân đôi)
    const hasBuy1Get1 = this.hasBuy1Get1Promotion(this.product);
    const requiredStock = hasBuy1Get1 ? (this.quantity + 1) * 2 : this.quantity + 1;

    // Kiểm tra tồn kho
    const availableStock = this.product.Stock ?? 0;
    if (requiredStock > availableStock) {
      this.toastService.show('Số lượng vượt quá tồn kho', 'error');
      return;
    }

    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  // Navigation methods
  goToProduct(productId: string): void {
    this.router.navigate(['/product-detail', productId]);
  }

  goBack(): void {
    this.router.navigate(['/product-list']);
  }

  getReviewCount(): number {
    // Mặc định trả về 0 vì không có dữ liệu thực tế về số lượt đánh giá
    return 0;
  }

  getPurchaseCount(product?: Product): string {
    if (!product) {
      return '0';
    }

    // Trả về giá trị PurchaseCount từ dữ liệu thực tế, không tính giả
    // Đồng nhất với logic trong product-list
    const count = product.PurchaseCount || 0;
    return count.toLocaleString('vi-VN');
  }

  // Kiểm tra sản phẩm có đánh giá hay không
  // Chỉ cần Rating > 0 là đủ, không cần ReviewCount vì ReviewCount có thể chưa được load
  hasReviews(product?: Product): boolean {
    if (!product) return false;
    return (product.Rating ?? 0) > 0;
  }

  formatPrice(price: number | undefined): string {
    if (!price) return '0₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }

  // Parse ingredients from dishes.json format
  parseIngredients(ingredientsString: string): string[] {
    if (!ingredientsString) return [];

    return ingredientsString
      .split(';')
      .map((ingredient) => ingredient.trim())
      .filter((ingredient) => ingredient.length > 0);
  }

  // Get main ingredient from product name
  getMainIngredient(): string {
    if (!this.product) return '';

    const productName = this.product.ProductName.toLowerCase();

    // Common ingredient keywords (excluding generic words like "nước")
    const ingredients = [
      'sả',
      'giá',
      'cà chua',
      'tôm',
      'gà',
      'cá',
      'bí đỏ',
      'nấm',
      'đậu hũ',
      'rau muống',
      'cải',
      'bắp cải',
      'cà tím',
      'khoai',
      'bầu',
      'mướp',
      'đậu bắp',
      'su hào',
      'cà rốt',
      'hành tây',
      'tỏi',
      'gừng',
      'chanh',
      'thịt bò',
      'thịt heo',
      'thịt gà',
      'cá hồi',
      'cá basa',
      'cá lóc',
      'yến',
      'dừa',
      'cam',
      'táo',
      'chuối',
      'dưa hấu',
      'dưa leo',
      'cà rốt',
      'khoai lang',
      'khoai tây',
      'khoai môn',
      'khoai sọ',
      'bắp',
      'ngô',
    ];

    // Words to ignore when extracting ingredient
    const ignoreWords = ['nước', 'sốt', 'xốt', 'chiên', 'nướng', 'hấp', 'luộc', 'kho', 'xào'];

    // Find matching ingredient (excluding ignore words)
    for (const ingredient of ingredients) {
      if (productName.includes(ingredient)) {
        return ingredient;
      }
    }

    // If no specific ingredient found, try to extract meaningful word
    const words = productName.split(' ');
    for (const word of words) {
      if (!ignoreWords.includes(word) && word.length > 2) {
        return word;
      }
    }

    // Fallback to first meaningful word
    return words.find((word: string) => !ignoreWords.includes(word) && word.length > 1) || words[0];
  }

  // Toggle favorite status for main product
  toggleFavorite(): void {
    if (!this.product) return;

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      // Mở popup đăng nhập nếu không tìm thấy user
      this.authPopupService.openPopup('login');
      return;
    }

    // Lấy CustomerID từ localStorage
    const userDataStr = localStorage.getItem('user');
    let customerID: string = '';

    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        customerID = userData.CustomerID || '';
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Fallback: thử lấy từ currentUser
    if (!customerID && currentUser) {
      customerID = (currentUser as any).CustomerID || '';
    }

    if (!customerID) {
      console.error('Không tìm thấy CustomerID hợp lệ');
      alert('Vui lòng đăng nhập lại để sử dụng tính năng này');
      return;
    }

    const sku = this.product.sku;
    const productName = this.product.ProductName;

    // Toggle wishlist using WishlistService
    this.wishlistService.toggleWishlist(customerID, sku, productName).subscribe({
      next: (isAdded) => {
        // Update local Set for UI
        if (isAdded) {
          this.favoriteProducts.add(sku);
          // Tăng liked count
          if (this.product!.Liked !== undefined) {
            this.product!.Liked++;
          } else {
            this.product!.Liked = 1;
          }
        } else {
          this.favoriteProducts.delete(sku);
          // Giảm liked count
          if (this.product!.Liked && this.product!.Liked > 0) {
            this.product!.Liked--;
          }
        }
      },
      error: (error) => {
        console.error('Lỗi khi toggle wishlist:', error);
      },
    });
  }

  // Check if current product is favorited
  isProductFavorited(): boolean {
    if (this.product) {
      const wishlist = this.wishlistService.getCurrentWishlist();
      return wishlist.some((item) => item.sku === this.product!.sku);
    }
    return false;
  }

  // Toggle favorite status for related products
  toggleRelatedFavorite(product: Product): void {
    if (!product) return;

    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      // Mở popup đăng nhập nếu không tìm thấy user
      this.authPopupService.openPopup('login');
      return;
    }

    // Lấy CustomerID
    const customerID = (currentUser as any).CustomerID || '';
    if (!customerID) {
      console.error('Không tìm thấy CustomerID');
      return;
    }

    const sku = product.sku;
    const productName = product.ProductName;

    // Toggle wishlist using WishlistService
    this.wishlistService.toggleWishlist(customerID, sku, productName).subscribe({
      next: (isAdded) => {
        // Update local Set for UI
        if (isAdded) {
          this.favoriteProducts.add(sku);
        } else {
          this.favoriteProducts.delete(sku);
        }
      },
      error: (error) => {
        console.error('Lỗi khi toggle wishlist:', error);
      },
    });
  }

  isFavorite(product: Product): boolean {
    if (product) {
      const wishlist = this.wishlistService.getCurrentWishlist();
      return wishlist.some((item) => item.sku === product.sku);
    }
    return false;
  }

  // Get favorite count from product data (if available)
  getFavoriteCount(): number {
    // Trả về số lượt thích từ product data
    return this.product?.Liked || 0;
  }

  // Get stars array for display
  getStars(rating: number): boolean[] {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating);
    }
    return stars;
  }

  // Format time for display
  formatTime(time: string): string {
    if (!time) return '';

    try {
      const reviewDate = new Date(time);
      const now = new Date();
      const diffMs = now.getTime() - reviewDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 30) return `${diffDays} ngày trước`;
      if (diffMonths < 12) return `${diffMonths} tháng trước`;
      return `${diffYears} năm trước`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  }

  // Load reviews from backend
  loadReviews(): void {
    if (!this.product) {
      console.log(' No product loaded yet, skipping reviews load');
      return;
    }

    console.log(` Loading reviews for SKU: ${this.product.sku}`);

    this.http.get<any>(`http://localhost:3000/api/reviews/${this.product.sku}`).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.reviews) {
          // Map backend reviews to frontend format với likes và replies
          this.product!.Reviews = response.data.reviews.map((review: any, index: number) => ({
            id: review._id || `${Date.now()}-${Math.random()}-${index}`,
            name: review.fullname,
            rating: review.rating,
            text: review.content || '',
            time: review.time,
            images:
              review.images && Array.isArray(review.images) && review.images.length > 0
                ? review.images
                : undefined,
            likes: review.likes || [], // Array of customer_id who liked
            replies: (review.replies || []).map((reply: any) => ({
              fullname: reply.fullname,
              customer_id: reply.customer_id,
              content: reply.content,
              time: reply.time,
              likes: reply.likes || [],
              _id: reply._id,
            })), // Array of replies
            customer_id: review.customer_id,
            reviewIndex: index, // Store index for API calls
          }));

          // Update product ReviewCount
          this.product!.ReviewCount = this.product!.Reviews!.length;

          // Update product Rating from actual reviews (đồng bộ rating từ reviews thực tế)
          // Tính toán lại rating sau khi đã load reviews
          const totalRating = this.product!.Reviews!.reduce(
            (sum: number, review: any) => sum + review.rating,
            0
          );
          const calculatedRating =
            this.product!.Reviews!.length > 0
              ? Math.round((totalRating / this.product!.Reviews!.length) * 10) / 10
              : 0;

          // Cập nhật rating vào product object để đồng bộ
          this.product!.Rating = calculatedRating;

          console.log(` Loaded ${this.product!.Reviews!.length} reviews`);
          console.log(`⭐ Calculated rating: ${calculatedRating}`);

          // Calculate rating breakdown and initialize displayed reviews
          this.calculateRatingBreakdown();
          this.selectedSortOption = 'Mới nhất';
          this.sortReviews('Mới nhất'); // Sort với time đúng cách
        } else {
          console.log('No reviews found for this product');
          // Initialize empty reviews
          this.product!.Reviews = [];
          this.product!.ReviewCount = 0;
          this.calculateRatingBreakdown();
          this.selectedSortOption = 'Mới nhất';
          this.sortedReviews = [];
          this.initializeDisplayedReviews();
        }
      },
      error: (error) => {
        console.error(' Error loading reviews:', error);
        // Initialize empty reviews on error
        this.product!.Reviews = [];
        this.product!.ReviewCount = 0;
        this.calculateRatingBreakdown();
        this.selectedSortOption = 'Mới nhất';
        this.sortedReviews = [];
        this.initializeDisplayedReviews();
      },
    });
  }

  // Calculate rating breakdown from product reviews
  calculateRatingBreakdown(): void {
    if (!this.product || !this.product.Reviews) {
      this.ratingBreakdown = [
        { stars: 5, count: 0, percentage: 0 },
        { stars: 4, count: 0, percentage: 0 },
        { stars: 3, count: 0, percentage: 0 },
        { stars: 2, count: 0, percentage: 0 },
        { stars: 1, count: 0, percentage: 0 },
      ];
      return;
    }

    const reviews = this.product.Reviews;
    const totalReviews = reviews.length;

    // Count reviews by star rating
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review: any) => {
      const rating = Math.round(review.rating);
      if (rating >= 1 && rating <= 5) {
        ratingCounts[rating as keyof typeof ratingCounts]++;
      }
    });

    // Calculate percentages and create breakdown
    this.ratingBreakdown = [
      {
        stars: 5,
        count: ratingCounts[5],
        percentage: totalReviews > 0 ? Math.round((ratingCounts[5] / totalReviews) * 100) : 0,
      },
      {
        stars: 4,
        count: ratingCounts[4],
        percentage: totalReviews > 0 ? Math.round((ratingCounts[4] / totalReviews) * 100) : 0,
      },
      {
        stars: 3,
        count: ratingCounts[3],
        percentage: totalReviews > 0 ? Math.round((ratingCounts[3] / totalReviews) * 100) : 0,
      },
      {
        stars: 2,
        count: ratingCounts[2],
        percentage: totalReviews > 0 ? Math.round((ratingCounts[2] / totalReviews) * 100) : 0,
      },
      {
        stars: 1,
        count: ratingCounts[1],
        percentage: totalReviews > 0 ? Math.round((ratingCounts[1] / totalReviews) * 100) : 0,
      },
    ];
  }

  // Navigate to product detail page
  goToProductDetail(productId: string): void {
    this.router.navigate(['/product-detail', productId]).then(() => {
      // Scroll to top of page after navigation
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  // Calculate overall rating from reviews
  getOverallRating(): number {
    if (!this.product || !this.product.Reviews || this.product.Reviews.length === 0) {
      return 0;
    }

    const reviews = this.product.Reviews;
    const totalRating = reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Round to 1 decimal place
    return Math.round(averageRating * 10) / 10;
  }

  // Get display rating (formatted with 1 decimal)
  getDisplayRating(): string {
    const rating = this.getOverallRating() || this.product?.Rating || 0;
    return rating > 0 ? rating.toFixed(1) : '0.0';
  }

  // Format rating to always show 1 decimal place (for related products, etc.)
  formatRating(rating: number | undefined | null): string {
    if (!rating || rating === 0) {
      return '0.0';
    }
    return rating.toFixed(1);
  }

  // Dropdown methods
  toggleSortDropdown(): void {
    this.isSortDropdownOpen = !this.isSortDropdownOpen;
  }

  selectSortOption(option: string): void {
    this.selectedSortOption = option;
    this.isSortDropdownOpen = false;
    this.sortReviews(option);
  }

  sortReviews(sortOption: string): void {
    if (!this.product?.Reviews) return;

    const reviews = [...this.product.Reviews];

    switch (sortOption) {
      case 'Mới nhất':
        // Sắp xếp theo thời gian gần nhất (mới nhất trước)
        this.sortedReviews = reviews.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeB - timeA; // Mới nhất trước
        });
        break;

      case 'Cũ nhất':
        // Sắp xếp theo thời gian xa nhất (cũ nhất trước)
        this.sortedReviews = reviews.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeA - timeB; // Cũ nhất trước
        });
        break;

      case 'Đánh giá cao nhất':
        // Sắp xếp theo rating từ cao đến thấp
        this.sortedReviews = reviews.sort((a, b) => b.rating - a.rating);
        break;

      case 'Đánh giá thấp nhất':
        // Sắp xếp theo rating từ thấp đến cao
        this.sortedReviews = reviews.sort((a, b) => a.rating - b.rating);
        break;

      default:
        // Default: mới nhất
        this.sortedReviews = reviews.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeB - timeA;
        });
    }

    // Recalculate rating breakdown after sorting
    this.calculateRatingBreakdown();
    // Reset pagination when sorting changes
    this.resetPagination();
  }

  // Reviews pagination methods
  initializeDisplayedReviews(): void {
    this.currentPage = 1;
    this.displayedReviews = this.sortedReviews.slice(0, this.reviewsPerPage);
    this.isReviewsExpanded = false;
    this.updateHasMoreReviews();
  }

  resetPagination(): void {
    this.currentPage = 1;
    this.displayedReviews = this.sortedReviews.slice(0, this.reviewsPerPage);
    this.isReviewsExpanded = false;
    this.updateHasMoreReviews();
  }

  loadMoreReviews(): void {
    if (!this.hasMoreReviews) return;

    this.currentPage++;
    const startIndex = (this.currentPage - 1) * this.reviewsPerPage;
    const endIndex = startIndex + this.reviewsPerPage;
    const newReviews = this.sortedReviews.slice(startIndex, endIndex);

    this.displayedReviews = [...this.displayedReviews, ...newReviews];
    this.isReviewsExpanded = true; // Đánh dấu đã mở rộng
    this.updateHasMoreReviews();

    // Reset chiều cao đã tính để force tính toán lại sau khi expand
    this.lastCalculatedHeight = 0;

    // Trigger change detection và tính toán lại sau khi DOM cập nhật
    this.cdr.detectChanges();
    setTimeout(() => {
      this.calculateRecipesPerPage();
      this.syncCookbookHeight();
    }, 100);
  }

  collapseReviews(): void {
    // Rút gọn về số lượng ban đầu
    this.displayedReviews = this.sortedReviews.slice(0, this.reviewsPerPage);
    this.currentPage = 1;
    this.isReviewsExpanded = false;
    this.updateHasMoreReviews();

    // Reset chiều cao đã tính để force tính toán lại sau khi collapse
    this.lastCalculatedHeight = 0;

    // Trigger change detection và tính toán lại sau khi DOM cập nhật
    this.cdr.detectChanges();
    setTimeout(() => {
      this.calculateRecipesPerPage();
      this.syncCookbookHeight();
      // Force update lại một lần nữa để đảm bảo chiều cao được cập nhật
      setTimeout(() => {
        this.lastCalculatedHeight = 0;
        this.calculateRecipesPerPage();
        this.syncCookbookHeight();
      }, 50);
    }, 100);
  }

  updateHasMoreReviews(): void {
    const totalDisplayed = this.displayedReviews.length;
    const totalAvailable = this.sortedReviews.length;
    this.hasMoreReviews = totalDisplayed < totalAvailable;
  }

  // Helper method to get CustomerID from localStorage
  private getCustomerID(): string | null {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      return null;
    }

    try {
      const user = JSON.parse(userJson);
      return user?.CustomerID || user?.customerID || null;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }

  // Helper method to get user fullName from localStorage
  private getUserFullName(): string {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      return 'Người dùng';
    }

    try {
      const user = JSON.parse(userJson);
      return user?.fullName || user?.FullName || 'Người dùng';
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return 'Người dùng';
    }
  }

  // Like/Unlike a review
  likeReview(review: Review): void {
    const customerId = this.getCustomerID();
    if (!customerId) {
      this.toastService.show('Vui lòng đăng nhập để thích bình luận', 'error');
      return;
    }

    if (!this.product || review.reviewIndex === undefined) {
      return;
    }

    const reviewId = review.id;
    if (this.likingReviews.has(reviewId)) {
      return; // Prevent double-click
    }

    this.likingReviews.add(reviewId);

    const isLiked = review.likes?.includes(customerId) || false;
    const action = isLiked ? 'unlike' : 'like';

    this.http
      .put<any>(
        `http://localhost:3000/api/reviews/${this.product.sku}/like/${review.reviewIndex}`,
        {
          customer_id: customerId,
          action: action,
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Reload reviews từ backend để đảm bảo data được sync
            this.loadReviews();
            this.toastService.show(
              action === 'like' ? 'Đã thích bình luận' : 'Đã bỏ thích bình luận',
              'success'
            );
          }
          this.likingReviews.delete(reviewId);
        },
        error: (error) => {
          console.error('Error liking review:', error);
          const errorMessage =
            error.error?.message || error.message || 'Có lỗi xảy ra khi thích bình luận';
          this.toastService.show(errorMessage, 'error');
          this.likingReviews.delete(reviewId);
        },
      });
  }

  // Check if current user liked a review
  isReviewLiked(review: Review): boolean {
    const customerId = this.getCustomerID();
    if (!customerId || !review.likes) {
      return false;
    }
    return review.likes.includes(customerId);
  }

  // Get like count for a review
  getLikeCount(review: Review): number {
    return review.likes?.length || 0;
  }

  // Toggle reply form for a review
  toggleReplyForm(review: Review): void {
    const reviewId = review.id;
    this.showReplyForm[reviewId] = !this.showReplyForm[reviewId];
    if (!this.showReplyForm[reviewId]) {
      // Clear reply text when closing
      this.replyTexts[reviewId] = '';
    }
  }

  // Submit reply to a review
  submitReply(review: Review): void {
    const customerId = this.getCustomerID();
    if (!customerId) {
      this.toastService.show('Vui lòng đăng nhập để trả lời bình luận', 'error');
      return;
    }

    if (!this.product || review.reviewIndex === undefined) {
      return;
    }

    const reviewId = review.id;
    const replyText = (this.replyTexts[reviewId] || '').trim();

    if (!replyText) {
      this.toastService.show('Vui lòng nhập nội dung trả lời', 'error');
      return;
    }

    if (this.replyingReviews.has(reviewId)) {
      return; // Prevent double-submit
    }

    this.replyingReviews.add(reviewId);

    const fullname = this.getUserFullName();

    this.http
      .post<any>(
        `http://localhost:3000/api/reviews/${this.product.sku}/reply/${review.reviewIndex}`,
        {
          fullname: fullname,
          customer_id: customerId,
          content: replyText,
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Reload reviews to get updated data including the new reply
            this.loadReviews();
            this.toastService.show('Đã thêm trả lời thành công', 'success');
            this.replyTexts[reviewId] = '';
            this.showReplyForm[reviewId] = false;
          }
          this.replyingReviews.delete(reviewId);
        },
        error: (error) => {
          console.error('Error submitting reply:', error);
          this.toastService.show('Có lỗi xảy ra khi trả lời bình luận', 'error');
          this.replyingReviews.delete(reviewId);
        },
      });
  }

  // Like/Unlike a reply
  likeReply(review: Review, replyIndex: number): void {
    const customerId = this.getCustomerID();
    if (!customerId) {
      this.toastService.show('Vui lòng đăng nhập để thích trả lời', 'error');
      return;
    }

    if (!this.product || review.reviewIndex === undefined || !review.replies) {
      return;
    }

    const reply = review.replies[replyIndex];
    if (!reply) {
      return;
    }

    const isLiked = reply.likes?.includes(customerId) || false;
    const action = isLiked ? 'unlike' : 'like';

    this.http
      .put<any>(
        `http://localhost:3000/api/reviews/${this.product.sku}/reply/${review.reviewIndex}/${replyIndex}/like`,
        {
          customer_id: customerId,
          action: action,
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Reload reviews từ backend để đảm bảo data được sync
            this.loadReviews();
            this.toastService.show(
              action === 'like' ? 'Đã thích trả lời' : 'Đã bỏ thích trả lời',
              'success'
            );
          }
        },
        error: (error) => {
          console.error('Error liking reply:', error);
          const errorMessage =
            error.error?.message || error.message || 'Có lỗi xảy ra khi thích trả lời';
          this.toastService.show(errorMessage, 'error');
        },
      });
  }

  // Check if current user liked a reply
  isReplyLiked(reply: Reply): boolean {
    const customerId = this.getCustomerID();
    if (!customerId || !reply.likes) {
      return false;
    }
    return reply.likes.includes(customerId);
  }

  // Get like count for a reply
  getReplyLikeCount(reply: Reply): number {
    return reply.likes?.length || 0;
  }

  // Format time for reply
  formatReplyTime(time: Date | string): string {
    return this.formatTime(time as string);
  }

  // -----------------------------
  // 🎯 Product Discount Methods
  // -----------------------------
  hasDiscount(product: Product): boolean {
    // Check if product has valid discount data
    if (!product) return false;

    // Must have OriginalPrice
    if (!product.OriginalPrice || product.OriginalPrice <= 0) return false;

    // Must have Discount
    if (!product.Discount || product.Discount <= 0) return false;

    // OriginalPrice must be greater than current Price
    if (product.OriginalPrice <= product.Price) return false;

    return true;
  }

  getOriginalPrice(product: Product): number {
    return product.OriginalPrice || 0;
  }

  getDiscountPercent(product: Product): number {
    // Only return discount if product actually has discount data
    return product.Discount ? product.Discount : 0;
  }

  // Consultation methods
  loadConsultations(): void {
    if (!this.product || !this.product.sku) {
      this.questions = [];
      return;
    }

    this.isLoadingConsultations = true;
    this.http.get<any>(`http://localhost:3000/api/consultations/${this.product.sku}`).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.questions) {
          // Map backend questions to frontend format
          this.questions = response.data.questions.map((q: any) => ({
            _id: q._id,
            question: q.question,
            customerId: q.customerId,
            customerName: q.customerName,
            answer: q.answer || '',
            answeredBy: q.answeredBy || '',
            answeredAt: q.answeredAt || null,
            status: q.status || 'pending',
            createdAt: q.createdAt,
            updatedAt: q.updatedAt,
          }));
        } else {
          this.questions = [];
        }
        this.isLoadingConsultations = false;
      },
      error: (error) => {
        console.error('❌ Error loading consultations:', error);
        this.questions = [];
        this.isLoadingConsultations = false;
      },
    });
  }

  submitQuestion(): void {
    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    if (!this.newQuestion.trim()) {
      this.toastService.show('Vui lòng nhập câu hỏi', 'error');
      return;
    }

    if (!this.product || !this.product.sku) {
      this.toastService.show('Không tìm thấy thông tin sản phẩm', 'error');
      return;
    }

    // Get user info
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      this.authPopupService.openPopup('login');
      return;
    }

    let customerId = '';
    let customerName = 'Người dùng';
    try {
      const user = JSON.parse(userJson);
      customerId = user?.CustomerID || user?.customerID || '';
      customerName = user?.fullName || user?.FullName || 'Người dùng';
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      this.toastService.show('Lỗi xác thực người dùng', 'error');
      return;
    }

    if (!customerId) {
      this.authPopupService.openPopup('login');
      return;
    }

    this.isSubmittingQuestion = true;

    this.http
      .post<any>(`http://localhost:3000/api/consultations/${this.product.sku}/question`, {
        question: this.newQuestion.trim(),
        customerId: customerId,
        customerName: customerName,
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.show('Đã gửi câu hỏi thành công', 'success');
            this.newQuestion = '';
            // Reload consultations to show the new question
            this.loadConsultations();
          } else {
            this.toastService.show(response.message || 'Có lỗi xảy ra khi gửi câu hỏi', 'error');
          }
          this.isSubmittingQuestion = false;
        },
        error: (error) => {
          console.error('❌ Error submitting question:', error);
          const errorMessage = error.error?.message || 'Có lỗi xảy ra khi gửi câu hỏi';
          this.toastService.show(errorMessage, 'error');
          this.isSubmittingQuestion = false;
        },
      });
  }

  // Tab switching method - trigger recalculation when tab changes
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    // Trigger recalculation after tab content renders
    setTimeout(() => {
      this.lastCalculatedHeight = 0; // Reset để force recalculation
      this.calculateRecipesPerPage();
      this.syncCookbookHeight();
    }, 100);
  }

  // Load cookbook recipes from instructions.json - Lọc theo sản phẩm hiện tại
  loadCookbookRecipes(): void {
    console.log('========== START loadCookbookRecipes() ==========');
    console.log('this.product exists?', !!this.product);
    console.log('this.product:', this.product);

    // RESET ngay đầu hàm để tránh hiển thị dữ liệu cũ khi chuyển sản phẩm
    this.allCookbookRecipes = [];
    this.cookbookRecipes = [];
    this.currentRecipePage = 1;

    // Kiểm tra xem có product không
    if (!this.product || !this.product.ProductName) {
      console.error('No product available, skipping cookbook recipes');
      console.error('this.product:', this.product);
      return;
    }

    // Sau khi check null, TypeScript biết this.product không thể null
    const product = this.product; // Type guard

    // Đơn giản: Chỉ lowercase tên sản phẩm
    const productNameLower = product.ProductName.toLowerCase();

    console.log('Product name found:', product.ProductName);
    console.log('Product name (lowercase):', productNameLower);

    // Load từ backend API thay vì JSON files
    // 1. Load instructions khớp với product name
    this.http
      .get<{ success: boolean; data: any[]; count: number }>(
        `http://localhost:3000/api/instructions/match-product?productName=${encodeURIComponent(
          product.ProductName
        )}`
      )
      .subscribe({
        next: (instructionsResponse) => {
          if (!instructionsResponse.success || !instructionsResponse.data) {
            console.error('Error loading instructions from backend');
            this.allCookbookRecipes = [];
            this.cookbookRecipes = [];
            this.currentRecipePage = 1;
            this.updatePaginationState();
            return;
          }

          const filteredInstructions = instructionsResponse.data;
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(
            `Found ${filteredInstructions.length} matching recipes for product "${productNameLower}"`
          );

          // Nếu không có recipes nào khớp, reset và return
          if (filteredInstructions.length === 0) {
            this.allCookbookRecipes = [];
            this.cookbookRecipes = [];
            this.currentRecipePage = 1;
            this.updatePaginationState();
            console.log('No matching recipes found');
            return;
          }

          // 2. Lấy danh sách IDs để load dishes
          const instructionIds = filteredInstructions.map((inst) => inst.ID);

          // 3. Load dishes theo batch
          this.http
            .post<{ success: boolean; data: any[]; count: number }>(
              'http://localhost:3000/api/dishes/batch',
              { ids: instructionIds }
            )
            .subscribe({
              next: (dishesResponse) => {
                if (!dishesResponse.success || !dishesResponse.data) {
                  console.error(' Error loading dishes from backend');
                  // Fallback: chỉ dùng instructions nếu không load được dishes
                  const recipesWithoutDishes = filteredInstructions.map((instruction) => ({
                    ...instruction,
                    Video: null,
                    Ingredients: instruction.Ingredient || '',
                    UnitNote: '',
                    Preparation: '',
                    Cooking: '',
                    Serving: '',
                    Usage: 'Dùng nóng.',
                    Tips: '',
                    DecorationTip: '',
                  }));

                  const shuffled = recipesWithoutDishes.sort(() => 0.5 - Math.random());
                  this.allCookbookRecipes = shuffled;
                  this.currentRecipePage = 1;

                  setTimeout(() => {
                    this.updateDisplayedRecipes();
                    this.cdr.detectChanges();
                  }, 0);

                  setTimeout(() => {
                    this.calculateRecipesPerPage();
                    this.syncCookbookHeight();
                  }, 150);
                  return;
                }

                const dishes = dishesResponse.data;

                // 4. Merge dữ liệu từ dishes vào instructions theo ID
                const mergedRecipes = filteredInstructions.map((instruction) => {
                  const dish = dishes.find((d) => d.ID === instruction.ID);
                  return {
                    ...instruction,
                    // Thêm các trường từ dish
                    Video: dish?.Video || null,
                    Description: dish?.Description || instruction.Description || '',
                    Ingredients: dish?.Ingredients || instruction.Ingredient || '',
                    UnitNote: dish?.UnitNote || '',
                    Preparation: dish?.Preparation || '',
                    Cooking: dish?.Cooking || '',
                    Serving: dish?.Serving || '',
                    Usage: dish?.Usage || dish?.Serving || 'Dùng nóng.',
                    Tips: dish?.Tips || '',
                    DecorationTip: dish?.DecorationTip || '',
                  };
                });

                // 5. Lưu TẤT CẢ recipes phù hợp (không giới hạn số lượng)
                const shuffled = mergedRecipes.sort(() => 0.5 - Math.random());
                this.allCookbookRecipes = shuffled; // Lưu toàn bộ
                this.currentRecipePage = 1; // Reset về trang 1

                // Sử dụng setTimeout để tránh ExpressionChangedAfterItHasBeenCheckedError
                setTimeout(() => {
                  this.updateDisplayedRecipes(); // Hiển thị trang đầu tiên
                  this.cdr.detectChanges(); // Manually trigger change detection
                }, 0);

                console.log(' ========== FINAL RESULTS ==========');
                console.log(' Total matching recipes:', this.allCookbookRecipes.length);
                console.log(' Recipes per page:', this.recipesPerPage);
                console.log(' Total pages:', this.getTotalRecipePages());
                console.log(' Current page:', this.currentRecipePage);
                console.log('Recipes on page 1:', this.cookbookRecipes.length);
                if (this.cookbookRecipes.length > 0) {
                  console.log(' Recipes on current page:');
                  this.cookbookRecipes.forEach((recipe, idx) => {
                    console.log(
                      `  ${idx + 1}. ${recipe.DishName} (Ingredient: ${recipe.Ingredient})`
                    );
                  });
                } else {
                  console.warn(' No recipes to display - Cookbook section will be HIDDEN');
                }
                console.log(' ========== END loadCookbookRecipes() ==========');

                // Đồng bộ chiều cao sau khi recipes đã được load và hiển thị
                setTimeout(() => {
                  this.calculateRecipesPerPage();
                  this.syncCookbookHeight();
                }, 150);
              },
              error: (error) => {
                console.error(' Error loading dishes from backend:', error);
                // Fallback: chỉ dùng instructions nếu không load được dishes
                const recipesWithoutDishes = filteredInstructions.map((instruction) => ({
                  ...instruction,
                  Video: null,
                  Ingredients: instruction.Ingredient || '',
                  UnitNote: '',
                  Preparation: '',
                  Cooking: '',
                  Serving: '',
                  Usage: 'Dùng nóng.',
                  Tips: '',
                  DecorationTip: '',
                }));

                const shuffled = recipesWithoutDishes.sort(() => 0.5 - Math.random());
                this.allCookbookRecipes = shuffled;
                this.currentRecipePage = 1;

                setTimeout(() => {
                  this.updateDisplayedRecipes();
                  this.cdr.detectChanges();
                }, 0);

                setTimeout(() => {
                  this.calculateRecipesPerPage();
                  this.syncCookbookHeight();
                }, 150);
              },
            });
        },
        error: (error) => {
          console.error(' Error loading instructions from backend:', error);
          // Fallback: thử load từ JSON nếu backend lỗi
          console.log(' Falling back to JSON files...');
          this.http.get<any[]>('data/cookbook/instructions.json').subscribe({
            next: (instructions) => {
              this.http.get<any[]>('data/cookbook/dishes.json').subscribe({
                next: (dishes) => {
                  // Kiểm tra product có tồn tại không (trong fallback context)
                  if (!this.product || !this.product.ProductName) {
                    console.error(' No product available in fallback');
                    this.allCookbookRecipes = [];
                    this.cookbookRecipes = [];
                    this.currentRecipePage = 1;
                    this.updatePaginationState();
                    return;
                  }

                  // Sử dụng biến local để TypeScript hiểu type
                  const productName = this.product.ProductName;
                  const productNameLower = productName.toLowerCase();
                  const filteredInstructions = instructions.filter((instruction) => {
                    const ingredientLower = (instruction.Ingredient || '').toLowerCase().trim();
                    return ingredientLower && productNameLower.includes(ingredientLower);
                  });

                  if (filteredInstructions.length === 0) {
                    this.allCookbookRecipes = [];
                    this.cookbookRecipes = [];
                    this.currentRecipePage = 1;
                    this.updatePaginationState();
                    return;
                  }

                  const mergedRecipes = filteredInstructions.map((instruction) => {
                    const dish = dishes.find((d) => d.ID === instruction.ID);
                    return {
                      ...instruction,
                      Video: dish?.Video || null,
                      Description: dish?.Description || instruction.Description || '',
                      Ingredients: dish?.Ingredients || instruction.Ingredient || '',
                      UnitNote: dish?.UnitNote || '',
                      Preparation: dish?.Preparation || '',
                      Cooking: dish?.Cooking || '',
                      Serving: dish?.Serving || '',
                      Usage: dish?.Usage || dish?.Serving || 'Dùng nóng.',
                      Tips: dish?.Tips || '',
                      DecorationTip: dish?.DecorationTip || '',
                    };
                  });

                  const shuffled = mergedRecipes.sort(() => 0.5 - Math.random());
                  this.allCookbookRecipes = shuffled;
                  this.currentRecipePage = 1;

                  setTimeout(() => {
                    this.updateDisplayedRecipes();
                    this.cdr.detectChanges();
                  }, 0);

                  setTimeout(() => {
                    this.calculateRecipesPerPage();
                    this.syncCookbookHeight();
                  }, 150);
                },
                error: (dishError) => {
                  console.error(' Error loading dishes.json fallback:', dishError);
                  this.allCookbookRecipes = [];
                  this.cookbookRecipes = [];
                  this.currentRecipePage = 1;
                  this.updatePaginationState();
                  this.syncCookbookHeight();
                },
              });
            },
            error: (instructionError) => {
              console.error(' Error loading instructions.json fallback:', instructionError);
              this.allCookbookRecipes = [];
              this.cookbookRecipes = [];
              this.currentRecipePage = 1;
              this.updatePaginationState();
              this.syncCookbookHeight();
            },
          });
        },
      });
  }

  // Handle recipe click - Mở popup cookbook detail
  onRecipeClick(recipe: any): void {
    console.log(' Recipe clicked:', recipe);
    this.selectedRecipe = recipe;
    this.isRecipePopupOpen = true;
  }

  // Đóng popup cookbook detail
  closeRecipePopup(): void {
    console.log(' Closing recipe popup');
    this.isRecipePopupOpen = false;
    this.selectedRecipe = null;
  }

  // ========== COOKBOOK PAGINATION METHODS ==========

  // Cập nhật recipes hiển thị theo trang hiện tại
  updateDisplayedRecipes(): void {
    const startIndex = (this.currentRecipePage - 1) * this.recipesPerPage;
    const endIndex = startIndex + this.recipesPerPage;
    this.cookbookRecipes = this.allCookbookRecipes.slice(startIndex, endIndex);

    // Update pagination buttons state
    this.updatePaginationState();

    console.log(
      `📖 Displaying recipes ${startIndex + 1}-${Math.min(
        endIndex,
        this.allCookbookRecipes.length
      )} of ${this.allCookbookRecipes.length}`
    );
  }

  // Update pagination button states (cached để tránh ExpressionChangedAfterItHasBeenCheckedError)
  private updatePaginationState(): void {
    this.canPrevPage = this.currentRecipePage > 1;
    this.canNextPage = this.currentRecipePage < this.getTotalRecipePages();
  }

  // Tính tổng số trang
  getTotalRecipePages(): number {
    return Math.ceil(this.allCookbookRecipes.length / this.recipesPerPage);
  }

  // Chuyển sang trang tiếp theo
  nextRecipePage(): void {
    if (this.currentRecipePage < this.getTotalRecipePages()) {
      this.currentRecipePage++;
      this.updateDisplayedRecipes();
      console.log(` Next page: ${this.currentRecipePage}/${this.getTotalRecipePages()}`);
    }
  }

  // Quay về trang trước
  prevRecipePage(): void {
    if (this.currentRecipePage > 1) {
      this.currentRecipePage--;
      this.updateDisplayedRecipes();
      console.log(` Previous page: ${this.currentRecipePage}/${this.getTotalRecipePages()}`);
    }
  }

  // Kiểm tra có thể next không (sử dụng cached value)
  canNextRecipePage(): boolean {
    return this.canNextPage;
  }

  // Kiểm tra có thể prev không (sử dụng cached value)
  canPrevRecipePage(): boolean {
    return this.canPrevPage;
  }

  // ========== END COOKBOOK PAGINATION METHODS ==========

  // Get first image from product images array
  getProductImage(product: Product): string {
    // Lấy ảnh đầu tiên từ array, hoặc empty string nếu không có
    return product.Image && product.Image.length > 0 ? product.Image[0] : '';
  }

  // Format text with line breaks after periods
  formatTextWithLineBreaks(text: string | undefined): string {
    if (!text) return '';
    // Thay thế dấu chấm + khoảng trắng bằng dấu chấm + <br> + khoảng trắng
    // Chỉ thay thế khi sau dấu chấm có khoảng trắng (không phải số thập phân)
    return text.replace(/\.\s+/g, '.<br>');
  }

  // Format text với dấu chấm đầu dòng màu xanh
  formatTextWithBullets(text: string | undefined): string {
    if (!text) return '';

    // 1️⃣ Xuống dòng trước dấu " - " nếu sau đó là chữ viết hoa (có từ 2 ký tự trở lên)
    let processedText = text.replace(/\s[-–]\s(?=[A-ZÀ-Ỹ][A-Za-zÀ-ỹ]{2,})/g, '\n- ');

    // 2️⃣ Xuống dòng sau dấu chấm nếu sau đó là chữ viết hoa (và cụm đó có ≥2 ký tự)
    processedText = processedText.replace(/\.\s*(?=[A-ZÀ-Ỹ][A-Za-zÀ-ỹ]{2,})/g, '.\n');

    // Tách các dòng/câu
    const lines = processedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Tạo HTML với bullet points (sử dụng dấu chấm to • màu #349409)
    const listItems = lines
      .map((line) => {
        // Loại bỏ dấu "-" ở đầu nếu có (vì đã có bullet point)
        const cleanLine = line.replace(/^[-–]\s*/, '');
        // Thêm dấu chấm cuối nếu chưa có
        const finalLine = cleanLine.endsWith('.') ? cleanLine : cleanLine + '.';

        return `<div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
            <span style="color: #349409 !important; font-size: 25px !important; line-height: 1 !important; margin-top: 2px; flex-shrink: 0;">•</span>
            <span style="color: #666; font-family: 'Lexend', sans-serif; line-height: 1.6; flex: 1;">${finalLine}</span>
          </div>`;
      })
      .join('');

    return listItems;
  }

  // Apply promotions to product
  private applyPromotionToProduct(product: any, promotions: any[], targets: any[]): any {
    // Tìm promotion target áp dụng cho product này
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
      originalPrice: product.price,
      discountedPrice: discountedPrice,
      discountAmount: discountAmount,
      discountPercent: discountPercent,
      promotionName: displayPromotion.name,
      promotionCode: displayPromotion.code,
      promotionType: promotionType,
    };
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

  // Add to cart method
  async addToCart(product?: Product): Promise<void> {
    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    const productToAdd = product || this.product;
    if (!productToAdd) {
      console.error('No product to add to cart');
      return;
    }

    // Chuyển đổi Product sang CartItem format
    // Nếu có promotion: price là giá sau giảm, originalPrice là giá gốc
    // Nếu không có promotion: price là giá bình thường, originalPrice là undefined
    const hasPromotion = productToAdd.hasPromotion || false;
    // Chỉ set originalPrice khi có promotion VÀ có OriginalPrice hợp lệ (lớn hơn price)
    const originalPrice =
      hasPromotion && productToAdd.OriginalPrice && productToAdd.OriginalPrice > productToAdd.Price
        ? productToAdd.OriginalPrice
        : undefined;

    // Kiểm tra xem sản phẩm có khuyến mãi "Mua 1 tặng 1" không
    const hasBuy1Get1 = this.hasBuy1Get1Promotion(productToAdd);

    const cartItem = {
      id: productToAdd.sku || parseInt(productToAdd._id.replace(/\D/g, '')) || Date.now(),
      sku: productToAdd.sku || productToAdd._id, //  Thêm SKU cho backend
      name: productToAdd.ProductName,
      productName: productToAdd.ProductName, //  Thêm productName cho backend
      price: productToAdd.Price, // Giá hiện tại (có thể là giá sau giảm nếu có promotion)
      image: this.getProductImage(productToAdd),
      category: productToAdd.Category,
      subcategory: productToAdd.Subcategory,
      unit: productToAdd.Unit,
      selected: true,
      originalPrice: originalPrice,
      hasPromotion: hasPromotion,
      hasBuy1Get1: hasBuy1Get1,
      Stock: productToAdd.Stock, // Thêm stock vào cartItem để kiểm tra
    };

    // Nếu là sản phẩm chính (có quantity input), thêm theo số lượng đã chọn
    // Nếu là related product, chỉ thêm 1
    const quantityToAdd = product ? 1 : this.quantity || 1;

    // Kiểm tra tồn kho trước khi thêm vào giỏ
    const canAdd = await this.cartService.checkStockBeforeAdd(
      cartItem,
      quantityToAdd,
      productToAdd.Stock,
      false // Không phải "Mua ngay"
    );

    if (!canAdd) {
      return; // Không thêm vào giỏ nếu không đủ tồn kho
    }

    // Thêm vào giỏ hàng nhiều lần theo số lượng
    // Chỉ hiển thị toast ở lần cuối cùng để tránh spam
    for (let i = 0; i < quantityToAdd; i++) {
      const isLastItem = i === quantityToAdd - 1;
      this.cartService.addToCart(cartItem, isLastItem);
    }

    console.log('Added to cart:', productToAdd.ProductName, 'x', quantityToAdd);
  }

  // Buy now method - bỏ chọn tất cả sản phẩm khác, chỉ chọn sản phẩm vừa thêm
  async buyNow(): Promise<void> {
    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    if (!this.product) {
      console.error('No product to buy');
      return;
    }

    // Chuyển đổi Product sang CartItem format
    const hasPromotion = this.product.hasPromotion || false;
    const originalPrice =
      hasPromotion && this.product.OriginalPrice && this.product.OriginalPrice > this.product.Price
        ? this.product.OriginalPrice
        : undefined;

    // Kiểm tra xem sản phẩm có khuyến mãi "Mua 1 tặng 1" không
    const hasBuy1Get1 = this.hasBuy1Get1Promotion(this.product);

    const cartItem = {
      id: this.product.sku || parseInt(this.product._id.replace(/\D/g, '')) || Date.now(),
      sku: this.product.sku || this.product._id,
      name: this.product.ProductName,
      productName: this.product.ProductName,
      price: this.product.Price,
      image: this.getProductImage(this.product),
      category: this.product.Category,
      subcategory: this.product.Subcategory,
      unit: this.product.Unit,
      selected: true,
      originalPrice: originalPrice,
      hasPromotion: hasPromotion,
      hasBuy1Get1: hasBuy1Get1, // Đảm bảo hasBuy1Get1 được set đúng
      Stock: this.product.Stock, // Thêm stock vào cartItem để kiểm tra
    };

    // Lấy số lượng muốn mua
    const quantityToAdd = this.quantity || 1;

    // Kiểm tra tồn kho trước khi mua ngay
    const canBuy = await this.cartService.checkStockBeforeAdd(
      cartItem,
      quantityToAdd,
      this.product.Stock,
      true // Là "Mua ngay"
    );

    if (!canBuy) {
      return; // Không mua nếu không đủ tồn kho
    }

    // Bỏ chọn tất cả sản phẩm hiện có trong giỏ hàng
    // Để chỉ sản phẩm vừa thêm được chọn và đưa vào hóa đơn
    this.cartService.deselectAllItems();

    // Thêm sản phẩm với số lượng 1 trước (để expandBuy1Get1Items tạo purchased và gifted items)
    this.cartService.addToCart(cartItem, false); // Không hiển thị toast

    // Nếu số lượng > 1, cập nhật số lượng cho cả purchased và gifted items
    if (quantityToAdd > 1) {
      // Đợi một chút để đảm bảo items đã được thêm vào cart và expand
      setTimeout(() => {
        const cartItems = this.cartService.getCartItems();
        const purchasedItem = cartItems().find(
          (item) => item.sku === cartItem.sku && item.itemType !== 'gifted'
        );

        if (purchasedItem) {
          // Cập nhật số lượng cho purchased item (gifted item sẽ được cập nhật tự động trong CartService)
          this.cartService.addOrUpdateItemWithQuantity(purchasedItem, quantityToAdd, false);
        }
      }, 100);
    }

    // Chuyển đến trang order sau khi thêm vào giỏ
    setTimeout(() => {
      this.router.navigate(['/order']);
    }, 300);
  }

  // Navigation methods
  navigateToProductList(): void {
    console.log('Navigating to product list...');
    this.router.navigate(['/product-list']);
  }
}
