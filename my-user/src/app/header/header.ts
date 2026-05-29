import { Component, OnInit, OnDestroy, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../services/cart.service';
import { AuthPopupService } from '../services/auth-popup.service';
import { ProductService, Product } from '../services/product.service';
import { Logout } from '../auth/logout/logout';
import { ToastService } from '../services/toast.service';
import { NotificationService } from '../services/notification.service';
import { Subscription } from 'rxjs';

interface Category {
  name: string;
  subcategories: string[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Logout],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Sticky header state
  isSticky: boolean = false;

  // Logo state
  logoSrc: string = '/asset/favicon/logo_title_g.png';

  // Dropdown button text state
  dropdownButtonText: string = 'Danh Mục Sản Phẩm';
  showDropdownIcon: boolean = false; // Show icon instead of text when < 480px
  isDropdownIconHovered: boolean = false; // Track hover state for icon

  // Product dropdown state
  isProductDropdownOpen: boolean = false;
  selectedCategoryIndex: number = 0;

  // Search state
  isSearchFocused: boolean = false;
  isSearchDropdownOpen: boolean = false;
  searchQuery: string = '';
  searchHistory: string[] = [];
  searchSuggestions: string[] = [];

  // Product search
  allProducts: Product[] = [];
  searchResults: Product[] = [];
  isLoadingProducts: boolean = false;

  // Popup states
  isNotificationPopupOpen: boolean = false;
  isCartPopupOpen: boolean = false;
  isUserPopupOpen: boolean = false;
  isLogoutPopupOpen: boolean = false;
  isClearHistoryPopupOpen: boolean = false;

  // Hover timers
  private notificationTimer: any;
  private cartTimer: any;
  private userTimer: any;
  private dropdownCloseTimer: any;

  // Counters
  notificationCount: number = 0;
  cartCount: number = 0;
  private notificationSubscription: Subscription = new Subscription();

  // Notifications data
  notifications: any[] = [];

  // Data
  categories: Category[] = [];

  // Mapping category names to slugs (for navigation)
  private categorySlugMap: { [key: string]: string } = {
    'Rau củ': 'rau-cu',
    'Trái cây': 'trai-cay',
    'Lương thực': 'luong-thuc-ngu-coc',
    'Thực phẩm khô': 'thuc-pham-kho',
    'Trà Thảo mộc': 'tra-thao-moc',
    'Cà phê Cacao': 'ca-phe-cacao',
    'Thực phẩm bồi bổ': 'thuc-pham-boi-bo',
    'Rong biển': 'rong-bien',
  };

  popularKeywords: string[] = [
    'Rau củ hữu cơ',
    'Rau xanh tươi',
    'Rau muống',
    'Rau cải',
    'Rau bina',
    'Trái cây nhập khẩu',
    'Gạo ST25',
    'Trà xanh',
    'Cà phê Arabica',
    'Hạt quinoa',
  ];

  // Danh sách từ khóa phổ biến đã được lọc (chỉ giữ lại những từ khóa có kết quả)
  filteredPopularKeywords: string[] = [];

  constructor(
    private router: Router,
    private http: HttpClient,
    private cartService: CartService,
    private authPopupService: AuthPopupService,
    private productService: ProductService,
    private toastService: ToastService,
    private notificationService: NotificationService
  ) {
    // Subscribe to cartCount changes from CartService
    effect(() => {
      this.cartCount = this.cartService.getTotalCount()();
    });
  }

  ngOnInit(): void {
    // Update logo and dropdown text based on initial screen size
    this.updateLogo();
    this.updateDropdownText();
    this.updateDropdownDisplay();

    this.loadSearchHistory();
    // Initialize cartCount from CartService
    this.cartCount = this.cartService.getTotalCount()();
    // Load categories and subcategories from MongoDB
    this.loadCategoriesFromMongoDB();
    // Load all products for search
    this.loadAllProducts();

    // Load customerId and set it in notification service
    this.loadCustomerId();

    // Subscribe to notification count
    const countSub = this.notificationService.unreadCount$.subscribe((count) => {
      this.notificationCount = count;
    });
    this.notificationSubscription.add(countSub);

    // Subscribe to notifications
    const notifSub = this.notificationService.notifications$.subscribe((notifications) => {
      // Get latest 3 unread notifications
      this.notifications = notifications.filter((n) => !n.read && !n.isRead).slice(0, 3);
    });
    this.notificationSubscription.add(notifSub);

    // Load initial count
    this.notificationService.loadUnreadCount();

    // Load notifications
    this.notificationService.loadNotifications();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isSticky = window.scrollY > 50;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateLogo();
    this.updateDropdownText();
    this.updateDropdownDisplay();
  }

  private updateLogo(): void {
    if (window.innerWidth < 600) {
      this.logoSrc = '/asset/favicon/logo_g.png';
    } else {
      this.logoSrc = '/asset/favicon/logo_title_g.png';
    }
  }

  private updateDropdownText(): void {
    if (window.innerWidth < 600) {
      this.dropdownButtonText = 'Danh Mục';
    } else {
      this.dropdownButtonText = 'Danh Mục Sản Phẩm';
    }
  }

  private updateDropdownDisplay(): void {
    if (window.innerWidth < 480) {
      this.showDropdownIcon = true;
    } else {
      this.showDropdownIcon = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Don't close if clicking on search dropdown items
    if (target.closest('.search-dropdown')) {
      return;
    }

    // Close dropdowns if clicking outside
    if (
      !target.closest('.dropdown-section') &&
      !target.closest('.search-section') &&
      !target.closest('.user-actions')
    ) {
      this.closeAllDropdowns();
    }
  }

  // Product dropdown methods
  toggleProductDropdown(): void {
    // Khi click vào nút dropdown, điều hướng đến trang danh sách sản phẩm
    // Đã comment tính năng này - không điều hướng khi click vào nút dropdown
    // this.router.navigate(['/product-list']);
    // this.closeAllDropdowns();
  }

  // Navigate to product list page
  navigateToProductList(): void {
    this.router.navigate(['/product-list']);
  }

  // Hover vào button - mở dropdown
  onButtonHover(): void {
    // Clear any pending close timer
    if (this.dropdownCloseTimer) {
      clearTimeout(this.dropdownCloseTimer);
      this.dropdownCloseTimer = null;
    }
    this.isProductDropdownOpen = true;
    this.closeOtherPopups();
    // Update icon hover state if showing icon
    if (this.showDropdownIcon) {
      this.isDropdownIconHovered = true;
    }
  }

  // Rời khỏi button - delay đóng để có thể di chuột sang dropdown
  onButtonLeave(): void {
    // Update icon hover state if showing icon
    if (this.showDropdownIcon) {
      this.isDropdownIconHovered = false;
    }
    // Delay đóng để cho phép di chuột từ button sang dropdown
    this.dropdownCloseTimer = setTimeout(() => {
      // Chỉ đóng nếu không đang hover vào dropdown
      this.isProductDropdownOpen = false;
      this.dropdownCloseTimer = null;
    }, 100); // Delay 100ms
  }

  // Hover vào dropdown - giữ mở và cancel close timer
  onDropdownHover(): void {
    // Clear close timer nếu có
    if (this.dropdownCloseTimer) {
      clearTimeout(this.dropdownCloseTimer);
      this.dropdownCloseTimer = null;
    }
    this.isProductDropdownOpen = true;
    // Keep icon hover state if showing icon
    if (this.showDropdownIcon) {
      this.isDropdownIconHovered = true;
    }
  }

  // Rời khỏi dropdown - đóng ngay lập tức
  onDropdownLeave(): void {
    if (this.dropdownCloseTimer) {
      clearTimeout(this.dropdownCloseTimer);
      this.dropdownCloseTimer = null;
    }
    this.isProductDropdownOpen = false;
    // Reset icon hover state if showing icon
    if (this.showDropdownIcon) {
      this.isDropdownIconHovered = false;
    }
  }

  // Hover method for category
  onCategoryHover(index: number): void {
    this.selectedCategoryIndex = index;
  }

  selectCategory(index: number): void {
    this.selectedCategoryIndex = index;
    // Navigate to product list with category filter
    const categoryName = this.categories[index]?.name || '';
    const categorySlug =
      this.categorySlugMap[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '-');

    // Navigate với query params - đảm bảo hoạt động từ mọi route
    // Sử dụng navigateByUrl để đảm bảo navigation hoạt động từ mọi route
    this.router
      .navigateByUrl(`/products?category=${encodeURIComponent(categorySlug)}`)
      .catch((error) => {
        console.error('Navigation error:', error);
        // Fallback: thử navigate bằng cách khác
        this.router.navigate(['/products'], {
          queryParams: { category: categorySlug },
        });
      });

    // Đóng dropdown sau khi navigate
    this.closeAllDropdowns();
  }

  getSelectedCategoryName(): string {
    return this.categories[this.selectedCategoryIndex]?.name || '';
  }

  getSelectedSubcategories(): string[] {
    return this.categories[this.selectedCategoryIndex]?.subcategories || [];
  }

  selectSubcategory(subcategory: string): void {
    console.log('Selected subcategory:', subcategory);

    if (subcategory === 'Tất cả sản phẩm') {
      // Navigate to product list without any filters (show all products)
      // Sử dụng navigateByUrl để đảm bảo navigation hoạt động từ mọi route
      this.router.navigateByUrl('/products').catch((error) => {
        console.error('Navigation error:', error);
        // Fallback: thử navigate bằng cách khác
        this.router.navigate(['/products']);
      });
    } else {
      // Navigate to product list with specific subcategory filter
      const categoryName = this.getSelectedCategoryName();
      const categorySlug = this.createSlug(categoryName);
      const subcategorySlug = this.createSlug(subcategory);

      // Sử dụng navigateByUrl để đảm bảo navigation hoạt động từ mọi route
      const url = `/products?category=${encodeURIComponent(
        categorySlug
      )}&subcategory=${encodeURIComponent(subcategorySlug)}`;
      this.router.navigateByUrl(url).catch((error) => {
        console.error('Navigation error:', error);
        // Fallback: thử navigate bằng cách khác
        this.router.navigate(['/products'], {
          queryParams: {
            category: categorySlug,
            subcategory: subcategorySlug,
          },
        });
      });
    }

    // Đóng dropdown sau khi navigate
    this.closeAllDropdowns();
  }

  /**
   * Create URL-friendly slug from Vietnamese text
   * Removes accents and special characters, converts to lowercase, replaces spaces with hyphens
   */
  private createSlug(text: string): string {
    return this.removeVietnameseAccents(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Remove Vietnamese accents/diacritics
   */
  private removeVietnameseAccents(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  loadCategoriesFromMongoDB(): void {
    console.log(' [Header] Loading categories from MongoDB...');
    this.productService.getCategoriesWithSubcategories().subscribe({
      next: (categories) => {
        this.categories = categories;

        // Đặt selectedCategoryIndex mặc định nếu có categories
        if (this.categories.length > 0) {
          if (
            this.selectedCategoryIndex < 0 ||
            this.selectedCategoryIndex >= this.categories.length
          ) {
            this.selectedCategoryIndex = 0;
          }
        }

        console.log(' [Header] Loaded categories from MongoDB:', this.categories);
      },
      error: (error) => {
        console.error(' [Header] Error loading categories from MongoDB:', error);
        this.categories = [];
      },
    });
  }

  // Search methods
  onCameraSearch(): void {
    // Hiển thị toast thông báo tính năng đang được phát triển
    this.toastService.show('Tính năng đang được phát triển', 'error', undefined, 3000);
    // TODO: Implement image search functionality
    // This could open a camera/modal to capture or upload an image
  }

  onSearchFocus(): void {
    // console.log('Search focused, opening dropdown');
    this.isSearchFocused = true;
    this.isSearchDropdownOpen = true;
    this.closeOtherPopups();
    // console.log('isSearchDropdownOpen set to:', this.isSearchDropdownOpen);
  }

  onSearchClick(): void {
    // console.log('Search clicked, opening dropdown');
    this.openSearchDropdown();
  }

  onSearchContainerClick(event: Event): void {
    // Mở dropdown khi click vào container (bao gồm input và các nút)
    // Chỉ mở nếu click vào input hoặc vùng trống, không phải các button
    const target = event.target as HTMLElement;
    if (
      target.classList.contains('search-input') ||
      target.classList.contains('search-container')
    ) {
      this.openSearchDropdown();
    }
  }

  openSearchDropdown(): void {
    this.isSearchDropdownOpen = true;
    this.isSearchFocused = true;
    this.closeOtherPopups();
  }

  toggleSearchDropdown(): void {
    // console.log('Toggling search dropdown:', this.isSearchDropdownOpen);
    this.isSearchDropdownOpen = !this.isSearchDropdownOpen;
  }

  onSearchBlur(): void {
    this.isSearchFocused = false;
    // Delay closing to allow clicking on dropdown items
    setTimeout(() => {
      this.isSearchDropdownOpen = false;
    }, 200);
  }

  onSearchInput(): void {
    // console.log('Search input changed:', this.searchQuery);
    // Always show dropdown when typing
    this.isSearchDropdownOpen = true;
    // Tìm kiếm sản phẩm theo tên khi user nhập
    this.searchProducts();
  }

  // Filter methods
  getFilteredSearchHistory(): string[] {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      return this.searchHistory;
    }
    return this.searchHistory.filter((item) =>
      item.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  getFilteredPopularKeywords(): string[] {
    // Sử dụng danh sách đã được lọc (chỉ những từ khóa có kết quả)
    const keywordsToFilter =
      this.filteredPopularKeywords.length > 0 ? this.filteredPopularKeywords : this.popularKeywords; // Fallback nếu chưa load xong

    if (!this.searchQuery || this.searchQuery.trim() === '') {
      return keywordsToFilter;
    }
    return keywordsToFilter.filter((keyword) =>
      keyword.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  generateSearchSuggestions(): void {
    // console.log('Generating suggestions for:', this.searchQuery);
    // Simple suggestion logic - in real app, this would be an API call
    const allKeywords = [...this.popularKeywords, ...this.searchHistory];
    this.searchSuggestions = allKeywords
      .filter((keyword) => keyword.toLowerCase().includes(this.searchQuery.toLowerCase()))
      .slice(0, 5);
    // console.log('Generated suggestions:', this.searchSuggestions);
  }

  performSearch(): void {
    if (this.searchQuery.trim()) {
      this.addToSearchHistory(this.searchQuery.trim());
      // Navigate to product-list với search query
      this.router.navigate(['/product-list'], {
        queryParams: { search: this.searchQuery.trim() },
      });
      // Clear search query after search
      this.searchQuery = '';
      this.searchResults = [];
      this.closeAllDropdowns();
    }
  }

  selectKeyword(keyword: string): void {
    this.searchQuery = keyword;
    // Tự động thực hiện tìm kiếm khi chọn từ khóa
    this.performSearch();
  }

  selectSuggestion(suggestion: string): void {
    this.searchQuery = suggestion;
    // Tự động thực hiện tìm kiếm khi chọn gợi ý
    this.performSearch();
  }

  // Search history methods
  loadSearchHistory(): void {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      this.searchHistory = JSON.parse(history);
      // Giới hạn chỉ 10 mục đầu tiên
      this.searchHistory = this.searchHistory.slice(0, 10);
      // Lưu lại vào localStorage nếu đã cắt bớt
      if (this.searchHistory.length < JSON.parse(history).length) {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
      }
    }
  }

  addToSearchHistory(query: string): void {
    // Remove if already exists
    this.searchHistory = this.searchHistory.filter((item) => item !== query);
    // Add to beginning
    this.searchHistory.unshift(query);
    // Keep only last 10 items
    this.searchHistory = this.searchHistory.slice(0, 10);
    // Save to localStorage
    localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
  }

  removeSearchHistory(index: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.searchHistory.splice(index, 1);
    localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    // Keep dropdown open
    this.isSearchDropdownOpen = true;
  }

  clearSearchHistory(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // Mở popup xác nhận thay vì xóa trực tiếp
    this.isClearHistoryPopupOpen = true;
    // Keep dropdown open
    this.isSearchDropdownOpen = true;
  }

  confirmClearHistory(): void {
    // Xóa lịch sử sau khi xác nhận
    this.searchHistory = [];
    localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    // Đóng popup
    this.isClearHistoryPopupOpen = false;
    // Keep dropdown open
    this.isSearchDropdownOpen = true;
  }

  cancelClearHistory(): void {
    // Đóng popup mà không xóa
    this.isClearHistoryPopupOpen = false;
    // Keep dropdown open
    this.isSearchDropdownOpen = true;
  }

  selectSearchHistory(item: string, event: Event): void {
    // Only select if not clicking on the delete button
    if ((event.target as HTMLElement).classList.contains('icon-img')) {
      return;
    }
    this.searchQuery = item;
    // Tự động thực hiện tìm kiếm khi chọn từ lịch sử
    this.performSearch();
  }

  // Popup methods
  toggleNotificationPopup(): void {
    this.isNotificationPopupOpen = !this.isNotificationPopupOpen;
    if (this.isNotificationPopupOpen) {
      this.closeOtherPopups();
    }
  }

  toggleCartPopup(): void {
    this.isCartPopupOpen = !this.isCartPopupOpen;
    if (this.isCartPopupOpen) {
      this.closeOtherPopups();
    }
  }

  toggleUserPopup(): void {
    this.isUserPopupOpen = !this.isUserPopupOpen;
    if (this.isUserPopupOpen) {
      this.closeOtherPopups();
    }
  }

  // Hover methods for popups
  showNotificationPopup(): void {
    // console.log('Showing notification popup');
    // Clear any existing timer
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }
    this.closeOtherPopups();
    this.isNotificationPopupOpen = true;
  }

  hideNotificationPopup(): void {
    // console.log('Hiding notification popup');
    // Add delay before hiding
    this.notificationTimer = setTimeout(() => {
      this.isNotificationPopupOpen = false;
    }, 300);
  }

  showCartPopup(): void {
    // console.log('Showing cart popup');
    // Clear any existing timer
    if (this.cartTimer) {
      clearTimeout(this.cartTimer);
    }
    this.closeOtherPopups();
    this.isCartPopupOpen = true;
  }

  hideCartPopup(): void {
    // console.log('Hiding cart popup');
    // Add delay before hiding
    this.cartTimer = setTimeout(() => {
      this.isCartPopupOpen = false;
    }, 300);
  }

  showUserPopup(): void {
    // console.log('Showing user popup');
    // Clear any existing timer
    if (this.userTimer) {
      clearTimeout(this.userTimer);
    }
    this.closeOtherPopups();
    this.isUserPopupOpen = true;
  }

  hideUserPopup(): void {
    // console.log('Hiding user popup');
    // Add delay before hiding
    this.userTimer = setTimeout(() => {
      this.isUserPopupOpen = false;
    }, 300);
  }

  // Cancel hide timers when hovering over popups
  cancelNotificationHide(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }
  }

  cancelCartHide(): void {
    if (this.cartTimer) {
      clearTimeout(this.cartTimer);
    }
  }

  cancelUserHide(): void {
    if (this.userTimer) {
      clearTimeout(this.userTimer);
    }
  }

  closeOtherPopups(): void {
    this.isNotificationPopupOpen = false;
    this.isCartPopupOpen = false;
    this.isUserPopupOpen = false;
    // Không đóng search dropdown trong closeOtherPopups để tránh xung đột
    // search dropdown sẽ được quản lý riêng bởi onSearchClick/onSearchBlur
  }

  closeAllDropdowns(): void {
    this.isProductDropdownOpen = false;
    this.isNotificationPopupOpen = false;
    this.isCartPopupOpen = false;
    this.isUserPopupOpen = false;
    this.isSearchDropdownOpen = false;
  }

  // User actions
  onViewAllNotifications(): void {
    // console.log('View all notifications');
    this.router.navigate(['/account/notifications']);
    this.closeAllDropdowns();
  }

  onNotificationIconClick(): void {
    // console.log('Notification icon clicked');
    // Đã comment tính năng điều hướng - không navigate khi click vào icon thông báo
    // Nếu đã đăng nhập thì navigate đến trang notifications
    // if (this.isLoggedIn()) {
    //   this.router.navigate(['/account/notifications']);
    //   this.closeAllDropdowns();
    // }
    // Nếu chưa đăng nhập thì chỉ toggle popup (đã có sẵn trong template)
  }

  ngOnDestroy(): void {
    this.notificationSubscription.unsubscribe();
  }

  private loadCustomerId(): void {
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        const customerId = user.CustomerID;
        if (customerId) {
          this.notificationService.setCustomerId(customerId);
          // Reload notifications when customerId is set
          this.notificationService.loadNotifications();
          this.notificationService.loadUnreadCount();
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    }
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'order':
        return '/asset/icons/order_dark.png';
      case 'promotion':
        return '/asset/icons/flash_sale.png';
      case 'other':
        return '/asset/icons/info_blue.png';
      default:
        return '/asset/icons/info_blue.png';
    }
  }

  formatNotificationTime(date: Date | string | undefined): string {
    if (!date) {
      return '';
    }
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) {
        return 'Vừa xong';
      } else if (minutes < 60) {
        return `${minutes} phút trước`;
      } else if (hours < 24) {
        return `${hours} giờ trước`;
      } else if (days < 7) {
        return `${days} ngày trước`;
      } else {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
      }
    } catch (error) {
      return '';
    }
  }

  onViewCart(): void {
    // console.log('View cart');
    this.cartService.openCart();
    this.closeAllDropdowns();
  }

  getRecentCartItems() {
    const allItems = this.cartService.getCartItems()();
    // Lấy 3 sản phẩm mới nhất (items ở đầu mảng vì đã thêm mới lên đầu)
    return allItems.slice(0, 3);
  }

  // Code điều hướng đến chi tiết sản phẩm từ cart popup (đã comment)
  // Khi nhấn vào cart item trong hover, chỉ mở giỏ hàng, không điều hướng đến chi tiết sản phẩm
  /*
  goToProductDetailFromCart(item: any): void {
 // Close cart popup first
    this.closeAllDropdowns();
    
 // Try to find product by SKU to get _id
    if (item.sku) {
      this.productService.getProductBySku(item.sku).subscribe({
        next: (product) => {
          if (product && product._id) {
            this.router.navigate(['/product-detail', product._id]);
          } else {
 console.warn('Product not found for SKU:', item.sku);
          }
        },
        error: (error) => {
 console.error('Error fetching product by SKU:', error);
        },
      });
    } else {
 console.warn('Cart item has no SKU:', item);
    }
  }
 */

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + '₫';
  }

  isLoggedIn(): boolean {
    // Kiểm tra xem user đã đăng nhập chưa
    // Kiểm tra token và user từ localStorage (được lưu khi đăng nhập trong login.ts)
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    // console.log('� isLoggedIn() check:');
    // console.log(' - token:', token ? 'EXISTS' : 'NULL');
    // console.log(' - user:', user ? 'EXISTS' : 'NULL');
    // console.log(' - result:', token !== null && user !== null);

    return token !== null && user !== null;
  }

  onLogout(): void {
    // Mở popup xác nhận đăng xuất
    console.log('� Opening logout confirmation popup');
    this.isLogoutPopupOpen = true;
    this.closeAllDropdowns(); // Đóng tất cả dropdowns
  }

  confirmLogout(): void {
    // Xóa thông tin đăng nhập (token và user được lưu từ login.ts)
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear(); // Clear all session data

    console.log(' User confirmed logout - clearing session');

    // Đóng popup và reload về home
    this.isLogoutPopupOpen = false;
    window.location.href = '/';
  }

  cancelLogout(): void {
    // Đóng popup xác nhận
    console.log(' User cancelled logout');
    this.isLogoutPopupOpen = false;
  }

  onLoginRegister(event?: Event): void {
    // Ngăn chặn mọi navigation mặc định
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Chỉ mở popup đăng nhập, không navigate đến account-layout
    this.authPopupService.openPopup('login');
    this.closeAllDropdowns();
  }

  onUserIconClick(): void {
    // Đã comment tính năng điều hướng - không navigate khi click vào icon user
    // Nếu chưa đăng nhập mở popup đăng nhập
    // if (!this.isLoggedIn()) {
    //   this.authPopupService.openPopup('login');
    //   this.closeAllDropdowns();
    // } else {
    //   // Nếu đã đăng nhập navigate đến trang Tài khoản cá nhân
    //   this.router.navigate(['/account/profile']);
    //   this.closeAllDropdowns();
    // }
  }

  onMyAccount(): void {
    // console.log('My account');
    this.closeAllDropdowns();
  }

  onManageOrders(): void {
    // console.log('Manage orders');
    this.closeAllDropdowns();
  }

  // Load all products for search functionality
  loadAllProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.isLoadingProducts = false;
        console.log(' [Header] Loaded products for search:', this.allProducts.length);
        // Lọc từ khóa phổ biến sau khi load sản phẩm
        this.filterPopularKeywords();
      },
      error: (error) => {
        console.error(' [Header] Error loading products for search:', error);
        this.isLoadingProducts = false;
        this.allProducts = [];
        // Nếu lỗi, vẫn hiển thị tất cả từ khóa
        this.filteredPopularKeywords = [...this.popularKeywords];
      },
    });
  }

  // Lọc từ khóa phổ biến: chỉ giữ lại những từ khóa có kết quả tìm kiếm
  filterPopularKeywords(): void {
    if (this.allProducts.length === 0) {
      console.log(' [Header] No products loaded yet, clearing filtered keywords');
      this.filteredPopularKeywords = [];
      return;
    }

    console.log(
      ` [Header] Filtering ${this.popularKeywords.length} keywords against ${this.allProducts.length} products`
    );

    this.filteredPopularKeywords = this.popularKeywords.filter((keyword) => {
      const query = keyword.toLowerCase().trim();

      if (!query || query.length === 0) {
        return false;
      }

      // Kiểm tra chính xác như product-list: tên sản phẩm phải chứa toàn bộ query string
      const matchingProducts = this.allProducts.filter((product) => {
        const productName = (product.product_name || '').toLowerCase();
        // Chỉ kiểm tra xem tên sản phẩm có chứa toàn bộ từ khóa không (giống logic product-list)
        return productName.includes(query);
      });

      const hasResults = matchingProducts.length > 0;

      // Debug log cho từng từ khóa
      if (!hasResults) {
        console.log(` [Header] ❌ Keyword "${keyword}" has NO results (0 products found)`);
      } else {
        console.log(` [Header] ✅ Keyword "${keyword}" has ${matchingProducts.length} result(s)`);
      }

      return hasResults;
    });

    const keywordsWithoutResults = this.popularKeywords.filter(
      (k) => !this.filteredPopularKeywords.includes(k)
    );
    console.log(` [Header] ==========================================`);
    console.log(
      ` [Header] Filtered popular keywords: ${this.filteredPopularKeywords.length}/${this.popularKeywords.length} have results`
    );
    console.log(` [Header] ✅ Keywords WITH results:`, this.filteredPopularKeywords);
    console.log(` [Header] ❌ Keywords WITHOUT results:`, keywordsWithoutResults);
    console.log(` [Header] ==========================================`);
  }

  // Search products by name
  searchProducts(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.searchResults = [];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();

    // Filter products by name (case-insensitive, partial match)
    this.searchResults = this.allProducts
      .filter((product) => {
        const productName = (product.product_name || '').toLowerCase();
        return productName.includes(query);
      })
      .slice(0, 5); // Chỉ hiển thị tối đa 5 kết quả trong dropdown

    console.log(` [Header] Found ${this.searchResults.length} products matching "${query}"`);
  }

  // Get product image
  getProductImage(product: Product): string {
    if (product.image && Array.isArray(product.image) && product.image.length > 0) {
      return product.image[0];
    }
    return '/asset/image/placeholder.png';
  }

  // Select product from search results
  selectProduct(product: Product): void {
    // Navigate to product detail
    if (product._id) {
      this.router.navigate(['/product-detail', product._id]);
      // Add to search history
      if (product.product_name) {
        this.addToSearchHistory(product.product_name);
      }
      // Close dropdown and clear search
      this.searchQuery = '';
      this.searchResults = [];
      this.closeAllDropdowns();
    }
  }

  // Format notification count: hiển thị "99+" nếu > 99
  getFormattedNotificationCount(): string {
    if (this.notificationCount > 99) {
      return '99+';
    }
    return this.notificationCount.toString();
  }
}
