import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter, interval } from 'rxjs';
import { forkJoin } from 'rxjs';
import { ReturnBadgeService } from '../../services/return-badge.service';
import { ToastService } from '../../services/toast.service';
import { OrderService } from '../../services/order.service';
import { OrderDetailModalService } from '../../services/order-detail-modal.service';
import { OrderDetailModal } from '../order-detail-modal/order-detail-modal.js';

interface ReturnItem {
  id: string;
  status: string;
  date: string;
  product: Product;
  quantity: number;
  totalValue: number;
  totalAmount: number;
  allProducts?: any[]; // Tất cả sản phẩm trong đơn hàng
  orderId?: string; // Local order ID
  orderNumber?: string; // Order number for display (ORD...)
}

interface Product {
  _id: string;
  ProductName: string;
  Category: string;
  Subcategory: string;
  Price: number;
  Unit: string;
  Image: string;
  Brand: string;
  hasBuy1Get1?: boolean; // Có khuyến mãi buy1get1 không (deprecated, dùng itemType)
  originalPrice?: number; // Giá gốc trước khuyến mãi
  sku?: string; // SKU để match với promotion targets
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
}

@Component({
  selector: 'app-return-management',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, OrderDetailModal],
  templateUrl: './return-management.html',
  styleUrls: ['./return-management.css'],
})
export class ReturnManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInput?: ElementRef;
  @ViewChild('tabList') tabList?: ElementRef;

  searchQuery: string = '';
  activeTab: string = 'processing_return';
  canScrollLeft: boolean = false;
  canScrollRight: boolean = false;

  // Returns data
  returns: ReturnItem[] = [];

  // Cached filtered returns for template (updated via getter)
  filteredReturns: ReturnItem[] = [];

  // Track which returns are expanded to show all products
  expandedReturns: Set<string> = new Set();

  // Modal properties
  showReturnModal: boolean = false;
  selectedReturnItem: ReturnItem | null = null;
  selectedReason: string = '';
  detailedDescription: string = '';
  isModalExpanded: boolean = false;
  showSuccessModal: boolean = false;
  showCancelModal: boolean = false;
  cancelReturnItem: ReturnItem | null = null;

  // Router subscription
  private routerSubscription?: Subscription;

  // Polling subscription for auto-refresh
  private pollingSubscription?: Subscription;
  private readonly POLLING_INTERVAL = 60000; // 60 seconds (tăng lên để giảm tải backend)

  // Cache filtered returns to avoid multiple calls
  private _filteredReturns: ReturnItem[] = [];
  private _lastFilterUpdate: number = 0;

  // Flag to prevent multiple simultaneous API calls
  private isLoading: boolean = false;

  // Promotions data for buy1get1
  promotions: any[] = [];
  promotionTargets: any[] = [];

  // Event handler references for proper cleanup
  private storageHandler?: (e: StorageEvent) => void;
  private customEventHandler?: () => void;
  private focusHandler?: () => void;
  private visibilityHandler?: () => void;

  tabs = [
    { id: 'processing_return', label: 'Đang chờ xử lý', count: 0 },
    { id: 'returning', label: 'Đang trả hàng', count: 0 },
    { id: 'returned', label: 'Đã trả hàng/ hoàn tiền', count: 0 },
    { id: 'refund_rejected', label: 'Từ chối trả hàng', count: 0 },
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
    private returnBadgeService: ReturnBadgeService,
    private toastService: ToastService,
    private orderService: OrderService,
    private orderDetailModalService: OrderDetailModalService
  ) {}

  ngOnInit(): void {
    // Load returns to sync with orders (don't clear data to preserve changes)
    this.loadReturns();
    this.loadPromotionsAndTargets();

    // Listen for router navigation events to reload data when navigating to this page
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Reload data when navigating to return-management page
        if (event.url && event.url.includes('/account/return-management')) {
          console.log('[Return Management] Navigation detected, reloading returns...');
          this.loadReturns();
          // Start polling when on this page (với interval dài hơn)
          this.startPolling();
        } else {
          // Stop polling when navigating away
          this.stopPolling();
        }
      });

    // Không tự động start polling khi component init - chỉ start khi user thực sự ở trang này
    // Polling sẽ được start khi navigate đến trang này

    // Store event handler references for proper cleanup
    this.storageHandler = (e: StorageEvent) => {
      if (e.key === 'ordersDataChanged' || e.key === 'returnManagementDataChanged') {
        // Debounce: chỉ reload nếu không đang load
        if (!this.isLoading) {
          this.syncWithCompletedOrders();
        }
      }
    };

    this.customEventHandler = () => {
      // Debounce: chỉ reload nếu không đang load và đang ở trang này
      // VÀ chỉ reload nếu không phải từ polling (tránh loop)
      if (
        !this.isLoading &&
        this.router.url.includes('/account/return-management') &&
        (!this.pollingSubscription || this.pollingSubscription.closed)
      ) {
        console.log('[Return Management] Custom event detected, reloading returns...');
        this.loadReturns();
      }
    };

    this.focusHandler = () => {
      // TẮT auto-reload khi focus để giảm tải backend
      // User có thể dùng refresh button để reload manually
      console.log(
        '[Return Management] Window focus detected - auto-reload disabled to reduce backend load'
      );
      // this.loadReturns(); // Disabled
    };

    this.visibilityHandler = () => {
      // TẮT auto-reload khi visibility change để giảm tải backend
      // User có thể dùng refresh button để reload manually
      console.log(
        '[Return Management] Page visibility changed - auto-reload disabled to reduce backend load'
      );
      // this.loadReturns(); // Disabled
    };

    // Add event listeners với references đã lưu
    window.addEventListener('storage', this.storageHandler);
    window.addEventListener('returnManagementDataChanged', this.customEventHandler);
    window.addEventListener('focus', this.focusHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy(): void {
    // Stop polling
    this.stopPolling();

    // Unsubscribe from router events
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    // Remove event listeners với đúng references
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
    }
    if (this.customEventHandler) {
      window.removeEventListener('returnManagementDataChanged', this.customEventHandler);
    }
    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * Start polling for return orders updates
   * TẮT polling để tránh backend chạy liên tục
   * User có thể dùng refresh button để reload manually
   */
  private startPolling(): void {
    // Stop existing polling if any
    this.stopPolling();

    // TẮT polling để giảm tải backend
    console.log(
      '[Return Management] Polling is DISABLED to reduce backend load. Use refresh button to reload manually.'
    );
    return;

    // Code below is disabled - uncomment if polling is really needed (with longer interval)
    /*
    console.log('[Return Management] Starting polling for return orders updates (interval: 60s)...');
    
    // Poll every POLLING_INTERVAL milliseconds (60 seconds)
    // Chỉ poll khi page visible và không đang load
    this.pollingSubscription = interval(this.POLLING_INTERVAL).subscribe(() => {
      // Only poll if page is visible (not hidden in background) and not already loading
      if (!document.hidden && !this.isLoading && this.router.url.includes('/account/return-management')) {
        console.log('[Return Management] Polling: Reloading returns...');
        this.loadReturns();
      }
    });
    */
  }

  /**
   * Stop polling for return orders updates
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      console.log('[Return Management] Stopping polling...');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  ngAfterViewInit(): void {
    this.checkScrollButtons();
    // Thêm listener cho scroll và resize
    if (this.tabList?.nativeElement) {
      this.tabList.nativeElement.addEventListener('scroll', () => this.checkScrollButtons());
    }
    window.addEventListener('resize', () => this.checkScrollButtons());
  }

  scrollTabs(direction: number): void {
    if (this.tabList?.nativeElement) {
      this.tabList.nativeElement.scrollBy({
        left: direction,
        behavior: 'smooth',
      });
      // Kiểm tra lại sau khi scroll
      setTimeout(() => this.checkScrollButtons(), 300);
    }
  }

  checkScrollButtons(): void {
    if (!this.tabList?.nativeElement) {
      return;
    }
    const element = this.tabList.nativeElement;
    this.canScrollLeft = element.scrollLeft > 0;
    this.canScrollRight = element.scrollLeft < element.scrollWidth - element.clientWidth - 1;
  }

  loadReturns(): void {
    // Prevent multiple simultaneous API calls
    if (this.isLoading) {
      console.log('[Return Management] Already loading, skipping duplicate request...');
      return;
    }

    // Load return orders from backend
    const customerID = this.orderService.getCustomerID();
    console.log('[Return Management] Loading return orders for CustomerID:', customerID);

    if (customerID && customerID !== 'guest') {
      this.isLoading = true;
      this.orderService.getOrdersByCustomer(customerID).subscribe({
        next: (response) => {
          console.log('[Return Management] API Response:', response);

          // Handle both response formats: { success: true, data: [...] } or direct array
          let ordersData: any[] = [];
          if (response && response.success && response.data) {
            ordersData = Array.isArray(response.data) ? response.data : [];
          } else if (Array.isArray(response)) {
            ordersData = response;
          }

          console.log('[Return Management] Loaded orders from backend:', ordersData.length);

          // Filter orders with return statuses (including refund rejected)
          const returnOrders = ordersData.filter(
            (order: any) =>
              order.status === 'processing_return' ||
              order.status === 'returning' ||
              order.status === 'returned' ||
              (order.status === 'completed' &&
                order.returnReason &&
                order.returnReason.trim() !== '')
          );

          console.log('[Return Management] Filtered return orders:', returnOrders.length);
          console.log('[Return Management] Return orders by status:', {
            processing_return: returnOrders.filter((o: any) => o.status === 'processing_return')
              .length,
            returning: returnOrders.filter((o: any) => o.status === 'returning').length,
            returned: returnOrders.filter((o: any) => o.status === 'returned').length,
          });

          // Log all order statuses for debugging
          const allStatuses = ordersData.map((o: any) => ({
            OrderID: o.OrderID,
            status: o.status,
          }));
          console.log('[Return Management] All order statuses in response:', allStatuses);
          console.log(
            '[Return Management] Orders with returned status:',
            ordersData
              .filter((o: any) => o.status === 'returned')
              .map((o: any) => ({
                OrderID: o.OrderID,
                status: o.status,
                updatedAt: o.updatedAt,
                createdAt: o.createdAt,
              }))
          );

          // Convert backend orders to ReturnItem format
          this.returns = returnOrders.map((order: any) => this.mapOrderToReturnItem(order));

          console.log('[Return Management] Converted to return items:', this.returns.length);

          // Update tab counts
          this.updateTabCounts();

          // Update filtered returns cache
          this.updateFilteredReturnsCache();

          // Trigger event to update sidebar badges and notify orders component
          // Chỉ trigger localStorage event (cross-tab), không dispatch custom event để tránh loop
          // Custom event sẽ được dispatch từ nơi khác khi cần (ví dụ: khi user thực hiện action)
          localStorage.setItem('returnManagementDataChanged', Date.now().toString());
          setTimeout(() => {
            localStorage.removeItem('returnManagementDataChanged');
          }, 100);

          // KHÔNG dispatch custom event trong loadReturns() để tránh infinite loop
          // Custom event chỉ nên được dispatch từ user actions (submit return, cancel return, etc.)

          this.isLoading = false;
        },
        error: (error) => {
          console.error('[Return Management] Error loading return orders from backend:', error);
          this.returns = [];
          this.updateTabCounts();
          this.updateFilteredReturnsCache();
          this.isLoading = false;
        },
      });
    } else {
      console.log('[Return Management] No customer ID or guest user');
      this.returns = [];
      this.updateTabCounts();
      this.updateFilteredReturnsCache();
      this.isLoading = false;
    }
  }

  /**
   * Update filtered returns cache
   */
  private updateFilteredReturnsCache(): void {
    // Update the public filteredReturns property by calling internal filter method
    this.filteredReturns = this.getFilteredReturnsInternal();
  }

  mapOrderToReturnItem(backendOrder: any): ReturnItem {
    // Map items to allProducts format
    const allProducts = (backendOrder.items || []).map((item: any) => {
      // Handle image which can be array or string
      let imageUrl = '';
      if (Array.isArray(item.image)) {
        imageUrl = item.image[0] || '';
      } else if (item.image) {
        imageUrl = item.image;
      }

      const product: Product = {
        _id: item.sku || item.id || '',
        ProductName: item.productName || item.name || '',
        Category: item.category || '',
        Subcategory: item.subcategory || '',
        Price: item.price || 0,
        Unit: item.unit || '',
        Image: imageUrl,
        Brand: '',
        sku: item.sku || item.id || '',
        originalPrice: item.originalPrice || item.price || 0,
        itemType: item.itemType || 'purchased', // Loại item: mua hoặc tặng kèm
        hasBuy1Get1: item.itemType === 'gifted' || this.checkBuy1Get1PromotionBySku(item.sku), // Deprecated, dùng itemType
      };

      // Giữ nguyên quantity từ backend (không chia đôi nữa vì đã có itemType)
      return {
        product: product,
        quantity: item.quantity || 0,
        totalValue: (item.price || 0) * (item.quantity || 0),
      };
    });

    // Use updatedAt for date if available (for returned orders, use updatedAt to show when it was returned)
    // Otherwise use createdAt
    // Store ISO date string for proper sorting, format only when displaying
    const orderDate = backendOrder.updatedAt || backendOrder.createdAt || new Date().toISOString();
    // Ensure it's a valid ISO date string
    const isoDate =
      orderDate instanceof Date
        ? orderDate.toISOString()
        : typeof orderDate === 'string'
        ? orderDate
        : new Date().toISOString();

    // Ensure status is correctly mapped - normalize status values
    let normalizedStatus = backendOrder.status || 'processing_return';

    // Map completed orders with returnReason to refund_rejected
    if (
      normalizedStatus === 'completed' &&
      backendOrder.returnReason &&
      backendOrder.returnReason.trim() !== ''
    ) {
      normalizedStatus = 'refund_rejected';
    }

    // Log for debugging
    console.log(
      `[Return Management] Mapping order ${backendOrder.OrderID}: status=${normalizedStatus}`
    );

    return {
      id: `return_${backendOrder.OrderID}`,
      status: normalizedStatus, // Use normalized status
      date: isoDate, // Store ISO date string, not formatted date
      product: allProducts[0]?.product || {
        _id: '',
        ProductName: '',
        Category: '',
        Subcategory: '',
        Price: 0,
        Unit: '',
        Image: '',
        Brand: '',
      },
      quantity: allProducts[0]?.quantity || 0,
      totalValue: allProducts[0]?.totalValue || 0,
      totalAmount: backendOrder.totalAmount || 0,
      allProducts: allProducts,
      orderId: backendOrder.OrderID,
      orderNumber: backendOrder.OrderID,
    };
  }

  syncWithCompletedOrders(): void {
    // This method is no longer used - kept for backward compatibility
    this.loadReturns();
  }

  hasMoreProducts(returnItem: ReturnItem): boolean {
    // Kiểm tra số lượng sản phẩm khác nhau trong đơn hàng
    return (returnItem.allProducts?.length ?? 0) > 1;
  }

  updateTabCounts(): void {
    this.tabs.forEach((tab) => {
      const count = this.returns.filter((returnItem) => returnItem.status === tab.id).length;
      tab.count = count;
      console.log(`[Return Management] Tab "${tab.label}" (${tab.id}): ${count} items`);
    });

    // Log detailed breakdown
    console.log('[Return Management] Detailed status breakdown:');
    const statusBreakdown = this.returns.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as any);
    console.log('[Return Management] Status breakdown:', statusBreakdown);

    // Lưu tab counts vào localStorage để sidebar có thể đọc
    const tabCounts = this.tabs.reduce((acc, tab) => {
      acc[tab.id] = tab.count;
      return acc;
    }, {} as any);
    localStorage.setItem('returnTabCounts', JSON.stringify(tabCounts));

    // Cập nhật service để badge cập nhật ngay lập tức trong cùng tab
    const pendingCount = this.tabs.find((tab) => tab.id === 'pending')?.count || 0;
    this.returnBadgeService.setPendingCount(pendingCount);
  }

  onTabClick(tabId: string): void {
    this.activeTab = tabId;
    // Update filtered returns cache when tab changes
    this.updateFilteredReturnsCache();
  }

  clearSearch(): void {
    this.searchQuery = '';
    // Update filtered returns cache when search is cleared
    this.updateFilteredReturnsCache();
    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  performSearch(): void {
    // Update filtered returns cache when search changes
    this.updateFilteredReturnsCache();
    console.log('Searching for:', this.searchQuery);
  }

  /**
   * Reload returns manually (called by refresh button)
   */
  reloadReturns(): void {
    console.log('[Return Management] Manual reload triggered');
    this.loadReturns();
    // Show a brief toast notification (using success type since info is not supported)
    this.toastService.show('Đang tải lại dữ liệu...', 'success');
  }

  /**
   * Internal method to get filtered returns (used for caching)
   */
  private getFilteredReturnsInternal(): ReturnItem[] {
    // First filter by active tab
    let filteredReturns: ReturnItem[] = [];

    if (this.activeTab === 'all') {
      filteredReturns = [...this.returns];
    } else {
      filteredReturns = this.returns.filter((returnItem) => {
        return returnItem.status === this.activeTab;
      });
    }

    // Then filter by search query (product name) if exists
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filteredReturns = filteredReturns.filter((returnItem) => {
        // Check if order number/return ID matches the search query
        const returnId = this.getReturnId(returnItem).toLowerCase();
        const orderNumber = (returnItem.orderNumber || '').toLowerCase();
        const matchesOrderNumber = returnId.includes(query) || orderNumber.includes(query);

        // Check if product name matches the search query
        const productName = (returnItem.product?.ProductName || '').toLowerCase();
        const matchesProduct = productName.includes(query);

        // Also check in allProducts if available
        const hasMatchingProductInAll = returnItem.allProducts?.some((productItem: any) => {
          const allProductName = (productItem.product?.ProductName || '').toLowerCase();
          return allProductName.includes(query);
        });

        return matchesOrderNumber || matchesProduct || hasMatchingProductInAll || false;
      });
    }

    // Sort by date (most recent first) for all tabs
    const sortedReturns = filteredReturns.sort((a, b) => {
      // Convert ISO date strings to Date objects for comparison
      try {
        // Handle both ISO strings and already formatted dates (backward compatibility)
        const dateAStr = typeof a.date === 'string' ? a.date : '';
        const dateBStr = typeof b.date === 'string' ? b.date : '';

        // If date is in DD/MM/YYYY format, try to parse it
        let dateA: Date, dateB: Date;

        if (dateAStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Already formatted, parse DD/MM/YYYY
          const [day, month, year] = dateAStr.split('/');
          dateA = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          dateA = new Date(dateAStr);
        }

        if (dateBStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Already formatted, parse DD/MM/YYYY
          const [day, month, year] = dateBStr.split('/');
          dateB = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          dateB = new Date(dateBStr);
        }

        // Most recent first
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.warn('[Return Management] Error sorting dates:', error, a.date, b.date);
        return 0;
      }
    });

    // Return sorted results
    return sortedReturns;
  }

  /**
   * Public method to get filtered returns (for template)
   * Returns the cached filteredReturns property
   */
  getFilteredReturns(): ReturnItem[] {
    // Always return the cached version (updated via updateFilteredReturnsCache)
    return this.filteredReturns;
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      delivered: 'Sản phẩm đã giao',
      processing_return: 'Đang chờ xử lý',
      returning: 'Đang trả hàng',
      returned: 'Đã trả hàng',
      refunded: 'Đã trả hàng',
      refund_rejected: 'Từ chối trả hàng',
    };
    return statusMap[status] || status;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  formatDate(dateString: string | Date): string {
    if (!dateString) return '';
    try {
      const date = dateString instanceof Date ? dateString : new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('[Return Management] Invalid date:', dateString);
        return '';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('[Return Management] Error formatting date:', error, dateString);
      return '';
    }
  }

  onViewMore(returnItem: ReturnItem): void {
    if (this.expandedReturns.has(returnItem.id)) {
      this.expandedReturns.delete(returnItem.id);
    } else {
      this.expandedReturns.add(returnItem.id);
    }
  }

  getDisplayProducts(returnItem: ReturnItem): any[] {
    // Chỉ hiển thị purchased products (không hiển thị gifted products)
    const purchasedProducts = (returnItem.allProducts || []).filter(
      (p: any) => p.product?.itemType !== 'gifted'
    );

    if (this.expandedReturns.has(returnItem.id)) {
      return purchasedProducts;
    }
    return purchasedProducts.length > 0 ? [purchasedProducts[0]] : [];
  }

  // Tìm gifted product tương ứng với purchased product (cùng SKU)
  getGiftedProduct(productItem: any, returnItem: ReturnItem): any | null {
    if (!productItem.product?.sku) return null;

    const giftedProduct = returnItem.allProducts?.find(
      (item: any) =>
        item.product?.sku === productItem.product.sku && item.product?.itemType === 'gifted'
    );

    return giftedProduct || null;
  }

  // Kiểm tra xem purchased product có gifted product tương ứng không
  hasGiftedProduct(productItem: any, returnItem: ReturnItem): boolean {
    return this.getGiftedProduct(productItem, returnItem) !== null;
  }

  isReturnExpanded(returnItem: ReturnItem): boolean {
    return this.expandedReturns.has(returnItem.id);
  }

  getButtonText(status: string): string {
    const buttonTextMap: { [key: string]: string } = {
      delivered: 'Yêu cầu trả hàng/ hoàn tiền',
      processing_return: 'Đang chờ xử lý',
      returning: 'Đang trả hàng',
      returned: 'Đã trả hàng/ hoàn tiền',
    };
    return buttonTextMap[status] || 'Yêu cầu trả hàng/ hoàn tiền';
  }

  onRequestReturn(returnItem: ReturnItem): void {
    if (returnItem.status === 'delivered') {
      this.selectedReturnItem = returnItem;
      this.showReturnModal = true;
      this.resetModalForm();
    }
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
    this.selectedReturnItem = null;
    this.resetModalForm();
  }

  resetModalForm(): void {
    this.selectedReason = '';
    this.detailedDescription = '';
    this.isModalExpanded = false;
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  openCancelModal(returnItem: ReturnItem): void {
    this.cancelReturnItem = returnItem;
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelReturnItem = null;
  }

  confirmCancelRequest(): void {
    if (this.cancelReturnItem) {
      console.log(' [Return Management] Cancelling return request:', this.cancelReturnItem);

      // Get orderNumber for API call
      const orderNumber = this.cancelReturnItem.orderNumber;
      if (!orderNumber) {
        console.error(' [Return Management] No orderNumber found for cancel request');
        this.toastService.show('Lỗi: Không tìm thấy mã đơn hàng', 'error');
        this.closeCancelModal();
        return;
      }

      // Update order status back to 'completed' via API (từ processing_return về completed)
      // Logic: Khi hủy trả hàng/hoàn tiền, chuyển về completed
      this.orderService.updateOrderStatus(orderNumber, 'completed').subscribe({
        next: (response) => {
          if (response.success) {
            console.log(' [Return Management] Backend status reverted to completed');

            // Reload returns from backend
            this.loadReturns();

            // Close modal
            this.closeCancelModal();

            // Show success toast notification
            this.toastService.show('Đã hủy yêu cầu trả hàng thành công!', 'success');

            // Navigate to reviews page after a short delay to allow backend to update
            setTimeout(() => {
              this.router.navigate(['/account/reviews']);
            }, 100);

            console.log(' [Return Management] Return request cancelled and navigated to reviews');
          }
        },
        error: (error) => {
          console.error(' [Return Management] Error reverting status:', error);
          this.toastService.show('Lỗi khi hủy yêu cầu trả hàng', 'error');
        },
      });
    }
  }

  // Load promotions and targets for buy1get1
  private loadPromotionsAndTargets(): void {
    const apiUrl = 'http://localhost:3000/api';
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

        this.promotions = activePromotions;
        this.promotionTargets = targets?.data || [];

        // Cập nhật buy1get1 status cho tất cả returns
        this.updateAllReturnsBuy1Get1Status();
      },
      error: (error) => {
        console.error('❌ [Return Management] Error loading promotions:', error);
      },
    });
  }

  // Cập nhật trạng thái buy1get1 cho tất cả returns
  private updateAllReturnsBuy1Get1Status(): void {
    this.returns.forEach((returnItem) => {
      if (returnItem.allProducts) {
        returnItem.allProducts.forEach((productItem: any) => {
          if (productItem.product) {
            productItem.product.hasBuy1Get1 = this.checkBuy1Get1Promotion(productItem.product);
          }
        });
      }
      // Cập nhật cho product chính
      if (returnItem.product) {
        returnItem.product.hasBuy1Get1 = this.checkBuy1Get1Promotion(returnItem.product);
      }
    });
  }

  // Kiểm tra xem sản phẩm có khuyến mãi buy1get1 không
  checkBuy1Get1Promotion(product: Product): boolean {
    if (!product.sku && !product._id) return false;

    // Tìm promotion targets áp dụng cho sản phẩm này
    const applicableTargets = this.promotionTargets.filter((target) => {
      return this.isProductMatchTarget(product, target);
    });

    if (applicableTargets.length === 0) return false;

    // Tìm promotions tương ứng
    const applicablePromotions = applicableTargets
      .map((target) => this.promotions.find((p) => p.promotion_id === target.promotion_id))
      .filter((p): p is any => p !== undefined);

    // Kiểm tra xem có promotion nào có discount_type là buy1get1 không
    return applicablePromotions.some((p) => p.discount_type === 'buy1get1');
  }

  // Kiểm tra xem sản phẩm có match với promotion target không
  private isProductMatchTarget(product: Product, target: any): boolean {
    if (!target || (!product.sku && !product._id)) return false;

    const targetType = target.target_type;
    const targetRefs = target.target_ref || [];
    const productSku = product.sku || product._id;

    switch (targetType) {
      case 'Product':
        // Match theo SKU
        return targetRefs.some((ref: string) => {
          const refSku = ref.trim();
          return refSku === productSku || refSku === product.ProductName;
        });

      case 'Category':
        // Match theo category
        return targetRefs.some((ref: string) => {
          const refCategory = ref.trim().toLowerCase();
          return refCategory === product.Category?.toLowerCase();
        });

      case 'Brand':
        // Match theo brand
        return targetRefs.some((ref: string) => {
          const refBrand = ref.trim().toLowerCase();
          return refBrand === product.Brand?.toLowerCase();
        });

      default:
        return false;
    }
  }

  // Lấy số lượng sản phẩm tặng kèm (bằng số lượng mua)
  getFreeItemQuantity(productItem: any, returnItem: ReturnItem): number {
    const giftedProduct = this.getGiftedProduct(productItem, returnItem);
    if (giftedProduct) {
      return giftedProduct.quantity || 0;
    }
    return 0;
  }

  // Helper method để check buy1get1 promotion by SKU (deprecated, dùng itemType)
  private checkBuy1Get1PromotionBySku(sku?: string): boolean {
    if (!sku) return false;
    // Tạm thời return false vì đã dùng itemType từ backend
    return false;
  }

  /**
   * Confirm that user has received the returned items
   * Updates order status from 'returning' to 'returned'
   */
  confirmReceivedReturn(returnItem: ReturnItem): void {
    if (!returnItem) {
      console.error('[Return Management] No return item provided');
      return;
    }

    console.log('[Return Management] Confirming received return:', returnItem);

    // Get orderNumber for API call
    const orderNumber = returnItem.orderNumber;
    if (!orderNumber) {
      console.error('[Return Management] No orderNumber found for return item');
      this.toastService.show('Lỗi: Không tìm thấy mã đơn hàng', 'error');
      return;
    }

    // Update order status to 'returned' via API
    this.orderService.updateOrderStatus(orderNumber, 'returned').subscribe({
      next: (response) => {
        if (response.success) {
          console.log('[Return Management] Backend status updated to returned');

          // Reload returns from backend
          this.loadReturns();

          // Show success toast notification
          this.toastService.show('Đã xác nhận nhận được hàng trả lại!', 'success');
        } else {
          console.error('[Return Management] Backend returned error:', response);
          this.toastService.show('Lỗi khi cập nhật trạng thái', 'error');
        }
      },
      error: (error) => {
        console.error('[Return Management] Error updating status:', error);
        this.toastService.show('Lỗi khi cập nhật trạng thái đơn hàng', 'error');
      },
    });
  }

  getModalDisplayProducts(): any[] {
    if (!this.selectedReturnItem?.allProducts) return [];

    if (this.isModalExpanded) {
      return this.selectedReturnItem!.allProducts;
    }
    return this.selectedReturnItem!.allProducts.slice(0, 2);
  }

  hasMoreModalProducts(): boolean {
    return (this.selectedReturnItem?.allProducts?.length ?? 0) > 2;
  }

  toggleModalProducts(): void {
    this.isModalExpanded = !this.isModalExpanded;
  }

  onReasonChange(): void {
    if (this.selectedReason !== 'other') {
      this.detailedDescription = '';
    }
  }

  canSubmit(): boolean {
    if (this.selectedReason === 'other') {
      return this.detailedDescription.trim() !== '';
    }
    return this.selectedReason !== '';
  }

  submitReturnRequest(): void {
    if (this.canSubmit() && this.selectedReturnItem) {
      console.log('Submitting return request:', {
        returnItem: this.selectedReturnItem,
        reason: this.selectedReason,
        description: this.detailedDescription,
      });

      // Create a new return request instead of just changing status
      const newReturnRequest = {
        id: `return_${Date.now()}_${this.selectedReturnItem.id.split('_')[1]}`,
        status: 'processing_return',
        date: new Date().toISOString().split('T')[0],
        product: this.selectedReturnItem.product,
        quantity: this.selectedReturnItem.quantity,
        totalValue: this.selectedReturnItem.totalValue,
        totalAmount: this.selectedReturnItem.totalAmount,
        allProducts: this.selectedReturnItem.allProducts,
        reason: this.selectedReason,
        description: this.detailedDescription,
        orderId: this.selectedReturnItem.id.split('_')[1], // Add order ID for reference
      };

      // Add new return request to the returns array
      this.returns.push(newReturnRequest);

      // Save updated data to localStorage
      localStorage.setItem('returnManagementData', JSON.stringify(this.returns));

      // Trigger storage event to notify orders component
      localStorage.setItem('returnManagementDataChanged', Date.now().toString());
      localStorage.removeItem('returnManagementDataChanged');

      // Update tab counts
      this.updateTabCounts();

      // Close return modal and show success modal
      this.closeReturnModal();
      this.showSuccessModal = true;

      console.log('Return request submitted successfully');
    }
  }

  // Method để reset dữ liệu (có thể gọi từ console nếu cần)
  resetReturnData(): void {
    localStorage.removeItem('returnManagementData');
    this.returns = [];
    this.loadReturns();
  }

  clearAllReturnData(): void {
    console.log('Clearing all return management data...');

    // Clear all localStorage data
    localStorage.removeItem('returnManagementData');
    localStorage.removeItem('returnManagementDataChanged');
    localStorage.removeItem('ordersDataChanged');

    // Clear returns array
    this.returns = [];

    // Update tab counts to show 0
    this.updateTabCounts();

    console.log('All return management data cleared');
  }

  // Method để xóa đơn có sản phẩm cụ thể (có thể gọi từ console)
  removeReturnItemByProductName(productName: string): void {
    console.log(`Removing return items containing product: ${productName}`);

    const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');

    // Filter out items that contain the specified product
    const updatedData = returnData.filter((item: any) => {
      // Check single product (old format)
      if (item.product?.ProductName && item.product.ProductName.includes(productName)) {
        console.log('Removed item with single product:', item.id);
        return false;
      }

      // Check allProducts array (new format)
      if (item.allProducts) {
        const hasProduct = item.allProducts.some(
          (p: any) => p.product?.ProductName && p.product.ProductName.includes(productName)
        );
        if (hasProduct) {
          console.log('Removed item with allProducts:', item.id);
          return false;
        }
      }

      return true;
    });

    // Save updated data
    localStorage.setItem('returnManagementData', JSON.stringify(updatedData));

    // Reload returns
    this.returns = updatedData;
    this.updateTabCounts();

    // Trigger storage event
    localStorage.setItem('returnManagementDataChanged', Date.now().toString());
    localStorage.removeItem('returnManagementDataChanged');

    console.log(
      `Removed items containing "${productName}". Remaining items: ${updatedData.length}`
    );
  }

  // Get total quantity for return item
  getTotalQuantity(returnItem: ReturnItem): number {
    if (!returnItem.allProducts) {
      return returnItem.quantity;
    }
    return returnItem.allProducts.reduce((total: number, productItem: any) => {
      return total + productItem.quantity;
    }, 0);
  }

  // Get return ID for display (use orderNumber if available, otherwise extract from ID)
  // View order details
  viewOrderDetails(returnItem: ReturnItem): void {
    const orderNumber =
      returnItem.orderNumber || returnItem.orderId || this.getReturnId(returnItem);
    if (orderNumber) {
      this.orderDetailModalService.openModal(orderNumber);
    }
  }

  getReturnId(returnItem: ReturnItem): string {
    // If orderNumber is available, use it
    if (returnItem.orderNumber) {
      return returnItem.orderNumber;
    }

    // Fallback: Format: return_timestamp_orderId or delivered_orderId
    if (returnItem.id.startsWith('return_')) {
      const parts = returnItem.id.split('_');
      if (parts.length >= 3) {
        return 'RET' + parts[1].slice(-6); // Last 6 digits of timestamp
      }
    }
    return returnItem.id;
  }

  // Handle double click on status text to cycle through return statuses (for testing)
  onStatusDoubleClick(returnItem: ReturnItem): void {
    console.log(
      ' [Return Management] Double click on status for return:',
      returnItem.id,
      'Current status:',
      returnItem.status
    );

    // Status flow: processing_return -> returning -> returned
    const statusFlow: { [key: string]: string } = {
      processing_return: 'returning',
      returning: 'returned',
      returned: 'processing_return', // Cycle back for testing
    };

    const nextStatus = statusFlow[returnItem.status] || 'processing_return';

    console.log(' [Return Management] Changing status from', returnItem.status, 'to', nextStatus);

    // Use orderNumber if available, otherwise extract from id
    const orderId =
      returnItem.orderNumber || returnItem.id.split('_')[2] || returnItem.id.split('_')[1];

    // Update status in backend
    this.orderService.updateOrderStatus(orderId, nextStatus as any).subscribe({
      next: (response) => {
        if (response.success) {
          console.log(' [Return Management] Backend status updated successfully');

          // Reload returns from backend
          this.loadReturns();
        }
      },
      error: (error) => {
        console.error(' [Return Management] Error updating status:', error);
        this.toastService.show('Lỗi cập nhật trạng thái đơn hàng', 'error');
      },
    });
  }

  goToProductDetail(product: Product): void {
    // Lấy _id hoặc sku từ product để navigate
    const productId = product._id || (product as any).sku;
    if (productId) {
      this.router.navigate(['/product-detail', productId]);
    } else {
      console.warn('No product ID found for navigation');
    }
  }

  onRepurchase(returnItem: ReturnItem): void {
    // Điều hướng đến trang chi tiết sản phẩm đầu tiên trong đơn hàng
    if (returnItem.allProducts && returnItem.allProducts.length > 0) {
      const firstProduct = returnItem.allProducts[0].product;
      if (firstProduct) {
        this.goToProductDetail(firstProduct);
      } else {
        console.warn('No product found in return item for repurchase');
      }
    } else if (returnItem.product) {
      // Fallback: sử dụng product chính nếu không có allProducts
      this.goToProductDetail(returnItem.product);
    } else {
      console.warn('No product found in return item for repurchase');
    }
  }
}
