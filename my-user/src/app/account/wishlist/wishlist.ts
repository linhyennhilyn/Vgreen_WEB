import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WishlistService, WishlistItem } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { AuthPopupService } from '../../services/auth-popup.service';

// Interface for product with full details
interface WishlistProduct {
  _id: string;
  sku: string;
  ProductName: string;
  Category: string;
  Subcategory: string;
  Brand: string;
  Price: number;
  OriginalPrice?: number;
  Image: string;
  Unit: string;
  Weight: string;
  isFavorite: boolean;
  hasPromotion?: boolean;
}

@Component({
  selector: 'app-wishlist',
  imports: [CommonModule, FormsModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit, OnDestroy {
  // Wishlist products from service
  wishlistProducts: WishlistProduct[] = [];

  // Subscription for wishlist updates
  private wishlistSubscription: Subscription = new Subscription();

  // Filter states
  showPromotionOnly = false;
  priceSort = 'default';
  dateSort = 'default';
  lastSortAction: 'price' | 'date' | null = null;

  // Filter options
  priceSortOptions = [
    { value: 'default', label: 'Mặc định' },
    { value: 'high-to-low', label: 'Giá cao đến thấp' },
    { value: 'low-to-high', label: 'Giá thấp đến cao' },
  ];

  dateSortOptions = [
    { value: 'default', label: 'Mặc định' },
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  private apiUrl = '/api'; // Use proxy configuration

  constructor(
    private wishlistService: WishlistService,
    private cartService: CartService,
    private authService: AuthService,
    private http: HttpClient,
    private productService: ProductService,
    private router: Router,
    private authPopupService: AuthPopupService
  ) {}

  ngOnInit(): void {
    // Load wishlist from server first
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Lấy CustomerID
      const customerID = (currentUser as any).CustomerID || '';
      if (customerID) {
        this.wishlistService.getWishlist(customerID).subscribe();
      }
    }

    // Subscribe to wishlist changes
    this.wishlistSubscription = this.wishlistService.wishlist$.subscribe((wishlistItems) => {
      // Fetch full product details for each item
      this.loadProductDetails(wishlistItems);
    });
  }

  ngOnDestroy(): void {
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
  }

  // Load full product details from product API
  private loadProductDetails(wishlistItems: WishlistItem[]): void {
    if (wishlistItems.length === 0) {
      this.wishlistProducts = [];
      return;
    }

    // Sort by time: newest first (giảm dần)
    const sortedItems = [...wishlistItems].sort((a, b) => {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeB - timeA; // Mới nhất trước
    });

    // Fetch all products with promotions
    forkJoin({
      products: this.productService.getAllProducts(),
      promotions: this.http.get<any>(`${this.apiUrl}/promotions`),
      targets: this.http.get<any>(`${this.apiUrl}/promotion-targets`),
    }).subscribe({
      next: ({ products, promotions, targets }) => {
        console.log(' [Wishlist] Loaded:', {
          products: products.length,
          promotions: promotions.data?.length || 0,
          targets: targets?.data?.length || 0,
        });

        // Filter active promotions
        const now = new Date();
        const activePromotions = (promotions.data || []).filter((p: any) => {
          const startDate = new Date(p.start_date);
          const endDate = new Date(p.end_date);
          return p.status === 'Active' && now >= startDate && now <= endDate;
        });

        console.log(' [Wishlist] Active promotions:', activePromotions.length);

        // Apply promotions to products
        const productsWithPromotions = this.applyPromotionsToProducts(
          products,
          activePromotions,
          targets?.data || []
        );

        // Map wishlist items to products with promotions
        this.wishlistProducts = sortedItems
          .map((item) => {
            // console.log(` [Wishlist] Looking for SKU: ${item.sku}`);
            const product = productsWithPromotions.find((p) => p.sku === item.sku);

            if (product) {
              // console.log(' [Wishlist] Found product:', product);
              return {
                _id: product._id,
                sku: product.sku,
                ProductName: product.product_name || product.ProductName,
                Category: product.category || product.Category,
                Subcategory: product.subcategory || product.Subcategory,
                Brand: product.brand || product.Brand,
                Price: product.hasPromotion ? product.discountedPrice : product.price,
                OriginalPrice: product.hasPromotion ? product.originalPrice : product.base_price,
                Image: Array.isArray(product.image)
                  ? product.image[0]
                  : product.image || product.Image,
                Unit: product.unit || product.Unit,
                Weight: product.weight || product.Weight,
                isFavorite: true,
                hasPromotion: product.hasPromotion || false,
              } as WishlistProduct;
            }
            // console.warn(' [Wishlist] Product not found for SKU:', item.sku);
            return null;
          })
          .filter((p): p is WishlistProduct => p !== null);

        // console.log(' [Wishlist] Final products:', this.wishlistProducts);
      },
      error: (error) => {
        console.error('Lỗi khi tải thông tin sản phẩm:', error);
        this.wishlistProducts = [];
      },
    });
  }

  get filteredProducts(): WishlistProduct[] {
    let filtered = [...this.wishlistProducts];

    // Filter by promotion
    if (this.showPromotionOnly) {
      filtered = filtered.filter(
        (product) => product.OriginalPrice && product.OriginalPrice > product.Price
      );
    }

    // Apply sorts based on last action - last action has highest priority
    if (this.lastSortAction === 'price') {
      // Price was clicked last
      // First apply date sort
      if (this.dateSort === 'newest') {
        filtered.sort((a, b) => {
          if (a._id < b._id) return 1;
          if (a._id > b._id) return -1;
          return 0;
        });
      } else if (this.dateSort === 'oldest') {
        filtered.sort((a, b) => {
          if (a._id < b._id) return -1;
          if (a._id > b._id) return 1;
          return 0;
        });
      }
      // Then apply price sort (higher priority)
      if (this.priceSort === 'high-to-low') {
        filtered.sort((a, b) => b.Price - a.Price);
      } else if (this.priceSort === 'low-to-high') {
        filtered.sort((a, b) => a.Price - b.Price);
      }
    } else if (this.lastSortAction === 'date') {
      // Date was clicked last
      // First apply price sort
      if (this.priceSort === 'high-to-low') {
        filtered.sort((a, b) => b.Price - a.Price);
      } else if (this.priceSort === 'low-to-high') {
        filtered.sort((a, b) => a.Price - b.Price);
      }
      // Then apply date sort (higher priority)
      if (this.dateSort === 'newest') {
        filtered.sort((a, b) => {
          if (a._id < b._id) return 1;
          if (a._id > b._id) return -1;
          return 0;
        });
      } else if (this.dateSort === 'oldest') {
        filtered.sort((a, b) => {
          if (a._id < b._id) return -1;
          if (a._id > b._id) return 1;
          return 0;
        });
      }
    } else {
      // No last action - fallback to default behavior
      if (this.priceSort !== 'default') {
        if (this.priceSort === 'high-to-low') {
          filtered.sort((a, b) => b.Price - a.Price);
        } else if (this.priceSort === 'low-to-high') {
          filtered.sort((a, b) => a.Price - b.Price);
        }
      } else if (this.dateSort !== 'default') {
        if (this.dateSort === 'newest') {
          filtered.sort((a, b) => {
            if (a._id < b._id) return 1;
            if (a._id > b._id) return -1;
            return 0;
          });
        } else if (this.dateSort === 'oldest') {
          filtered.sort((a, b) => {
            if (a._id < b._id) return -1;
            if (a._id > b._id) return 1;
            return 0;
          });
        }
      }
    }

    return filtered;
  }

  get hasProducts(): boolean {
    return this.wishlistProducts.length > 0;
  }

  // Toggle favorite status (remove from wishlist)
  toggleFavorite(product: WishlistProduct): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      // console.warn('User chưa đăng nhập');
      return;
    }

    // Lấy CustomerID
    const customerID = (currentUser as any).CustomerID || '';
    if (!customerID) {
      // console.error('Không tìm thấy CustomerID');
      return;
    }

    // Remove from wishlist since we're on wishlist page
    this.wishlistService.removeFromWishlist(customerID, product.sku).subscribe({
      next: (success) => {
        if (success) {
          console.log('Đã xóa khỏi wishlist:', product.ProductName);
        }
      },
      error: (error) => {
        console.error('Lỗi khi xóa khỏi wishlist:', error);
      },
    });
  }

  // Add to cart
  async addToCart(product: WishlistProduct): Promise<void> {
    // Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    if (!token) {
      // Mở popup đăng nhập nếu chưa đăng nhập
      this.authPopupService.openPopup('login');
      return;
    }

    // Convert WishlistProduct to CartItem format
    const hasPromotion = product.hasPromotion || false;
    // Only set originalPrice when there is a promotion AND OriginalPrice is valid (greater than Price)
    const originalPrice =
      hasPromotion && product.OriginalPrice && product.OriginalPrice > product.Price
        ? product.OriginalPrice
        : undefined;

    const cartItem = {
      id: parseInt(product.sku) || this.parseProductId(product._id),
      sku: product.sku || product._id,
      name: product.ProductName,
      productName: product.ProductName,
      price: product.Price,
      quantity: 1,
      image: product.Image,
      category: product.Category,
      subcategory: product.Subcategory,
      unit: product.Unit,
      selected: true, // Auto-select when adding to cart
      originalPrice: originalPrice,
      hasPromotion: hasPromotion,
      Stock: (product as any).Stock ?? (product as any).stock, // Thêm stock vào cartItem để kiểm tra
    };

    // Kiểm tra tồn kho trước khi thêm vào giỏ
    const canAdd = await this.cartService.checkStockBeforeAdd(
      cartItem,
      1,
      (product as any).Stock ?? (product as any).stock,
      false // Không phải "Mua ngay"
    );

    if (!canAdd) {
      return; // Không thêm vào giỏ nếu không đủ tồn kho
    }

    // Add to cart using CartService
    this.cartService.addToCart(cartItem);
  }

  // Parse product ID to number (convert string ID to number if needed)
  private parseProductId(id: string): number {
    // Try to parse as number, if fails, use hash code
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      return numId;
    }

    // If ID is not a number, generate a consistent number from string
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Format price
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }

  // Check if product has promotion
  hasPromotion(product: WishlistProduct): boolean {
    return !!product.hasPromotion;
  }

  // Calculate discount percentage
  getDiscountPercentage(product: WishlistProduct): number {
    if (!this.hasPromotion(product)) return 0;
    return Math.round(((product.OriginalPrice! - product.Price) / product.OriginalPrice!) * 100);
  }

  // Get price sort text
  getPriceSortText(): string {
    if (this.priceSort === 'high-to-low') return 'Giá cao đến thấp';
    if (this.priceSort === 'low-to-high') return 'Giá thấp đến cao';
    return 'Giá cao đến thấp'; // Default state
  }

  // Toggle price sort
  togglePriceSort(): void {
    this.lastSortAction = 'price'; // Track last action

    if (this.priceSort === 'default' || this.priceSort === 'high-to-low') {
      this.priceSort = 'low-to-high';
    } else {
      this.priceSort = 'high-to-low';
    }
  }

  // Get date sort text
  getDateSortText(): string {
    if (this.dateSort === 'newest') return 'Mới nhất';
    if (this.dateSort === 'oldest') return 'Cũ nhất';
    return 'Mới nhất'; // Default state
  }

  // Toggle date sort
  toggleDateSort(): void {
    this.lastSortAction = 'date'; // Track last action

    if (this.dateSort === 'default' || this.dateSort === 'newest') {
      this.dateSort = 'oldest';
    } else {
      this.dateSort = 'newest';
    }
  }

  // Apply promotions to products (same logic as home.ts)
  private applyPromotionsToProducts(products: any[], promotions: any[], targets: any[]): any[] {
    console.log(` [Wishlist] Applying promotions to ${products.length} products...`);
    console.log(` Available promotions: ${promotions.map((p: any) => p.code).join(', ')}`);
    console.log(` Available targets: ${targets.length}`);

    let matchedCount = 0;

    const result = products.map((product) => {
      // Tìm promotion target áp dụng cho product này
      const applicableTarget = targets.find((target) => {
        return this.isProductMatchTarget(product, target);
      });

      if (!applicableTarget) {
        return { ...product, hasPromotion: false };
      }

      // Tìm promotion tương ứng
      const promotion = promotions.find((p) => p.promotion_id === applicableTarget.promotion_id);

      if (!promotion) {
        return { ...product, hasPromotion: false };
      }

      // Tính giá sau khuyến mãi
      const discountedPrice = this.calculateDiscountedPrice(product.price, promotion);
      const discountAmount = product.price - discountedPrice;
      const discountPercent = Math.round((discountAmount / product.price) * 100);

      matchedCount++;

      return {
        ...product,
        hasPromotion: true,
        originalPrice: product.price,
        OriginalPrice: product.price, // Lưu OriginalPrice để dùng trong addToCart
        Price: discountedPrice, // Giá sau giảm
        discountedPrice: discountedPrice,
        discountAmount: discountAmount,
        discountPercent: discountPercent,
        promotionName: promotion.name,
        promotionCode: promotion.code,
      };
    });

    console.log(` [Wishlist] Matched ${matchedCount} products with promotions`);
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
        return target_ref.includes(product.sku) || target_ref.includes(product._id);
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

  // Navigate to product detail from wishlist
  goToProductList(): void {
    this.router.navigate(['/product-list']);
  }

  goToProductDetail(product: WishlistProduct): void {
    if (product._id) {
      this.router.navigate(['/product-detail', product._id]);
    } else {
      console.warn('Product has no _id:', product);
    }
  }
}
