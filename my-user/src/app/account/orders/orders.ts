import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { ReviewFormComponent, ReviewProduct } from '../review-form/review-form';
import { ReviewSyncService } from '../../services/review-sync.service';
import { ReviewBadgeService } from '../../services/review-badge.service';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { ToastService } from '../../services/toast.service';
import { CartService } from '../../services/cart.service';
import { AddressService } from '../../services/address.service';
import { OrderDetailModal } from '../order-detail-modal/order-detail-modal.js';
import { OrderDetailModalService } from '../../services/order-detail-modal.service';
interface ShippingAddress {
  detail?: string;
  ward?: string;
  district?: string;
  city?: string;
}

interface ShippingInfo {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: ShippingAddress;
  [key: string]: any;
}

interface Order {
  id: string;
  orderNumber: string;
  OrderID?: string; // OrderID từ backend (để reviews component sử dụng)
  CustomerID?: string; // CustomerID từ backend (để reviews component sử dụng)
  shippingInfo?: ShippingInfo;
  status: string;
  totalAmount: number;
  orderDate: string;
  deliveryDate?: string;
  products: Product[];
  cancelReason?: string; // Lý do hủy/trả hàng
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  totalPrice: number;
  image: string;
  category: string;
  sku?: string; // SKU để tìm product _id
  hasBuy1Get1?: boolean; // Có khuyến mãi buy1get1 không (deprecated, dùng itemType)
  originalPrice?: number; // Giá gốc trước khuyến mãi
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, ReviewFormComponent, OrderDetailModal],
  templateUrl: './orders.html',
  styleUrls: ['./orders.css'],
})
export class OrdersComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInput?: ElementRef;
  @ViewChild('tabList') tabList?: ElementRef;

  searchQuery: string = '';
  activeTab: string = 'all';
  canScrollLeft: boolean = false;
  canScrollRight: boolean = false;

  // Orders data loaded from JSON
  orders: Order[] = [];

  // Cache for reviewed order IDs (order IDs that have been fully reviewed)
  private reviewedOrderIds: Set<string> = new Set();

  // Router subscription để reload khi vào lại trang
  private routerSubscription?: Subscription;

  // Track which orders are expanded to show all products
  expandedOrders: Set<string> = new Set();

  // Modal properties
  showReturnModal: boolean = false;
  selectedOrder: Order | null = null;
  selectedReason: string = '';
  detailedDescription: string = '';
  isModalExpanded: boolean = false;
  showSuccessModal: boolean = false;
  showCancelModal: boolean = false;
  cancelReturnItem: any = null;

  // Custom dropdown for return reason
  showReasonDropdown: boolean = false;
  reasonDropdownPosition: { top: number; left: number; width: number } = {
    top: 0,
    left: 0,
    width: 0,
  };
  @ViewChild('reasonDropdownButton', { static: false }) reasonDropdownButtonRef?: ElementRef;

  // Return reason options
  returnReasonOptions = [
    { value: 'defective', label: 'Sản phẩm lỗi' },
    { value: 'wrong-description', label: 'Không đúng mô tả' },
    { value: 'wrong-delivery', label: 'Giao nhầm' },
    { value: 'other', label: 'Khác' },
  ];
  showCancelOrderModal: boolean = false;
  orderToCancel: Order | null = null;
  cancelReason: string = ''; // Lý do hủy đơn hàng

  // Review modal properties
  showReviewModal: boolean = false;
  reviewProducts: ReviewProduct[] = [];

  // Confirm received order modal properties
  showConfirmReceivedModal: boolean = false;
  orderToConfirmReceived: Order | null = null;

  // Promotions data for buy1get1
  promotions: any[] = [];
  promotionTargets: any[] = [];

  tabs = [
    { id: 'all', label: 'Tất cả', count: 0 },
    { id: 'pending', label: 'Chờ xác nhận', count: 0 },
    { id: 'shipping', label: 'Chờ giao hàng', count: 0 },
    { id: 'completed', label: 'Đã giao hàng', count: 0 },
    { id: 'cancelled', label: 'Đã hủy', count: 0 },
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private reviewSyncService: ReviewSyncService,
    private reviewBadgeService: ReviewBadgeService,
    private orderService: OrderService,
    private productService: ProductService,
    private toastService: ToastService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private addressService: AddressService,
    private orderDetailModalService: OrderDetailModalService
  ) {}

  ngOnInit(): void {
    // Scroll to top when entering the page
    window.scrollTo(0, 0);

    // Check query params for tab selection
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });

    this.loadOrders();
    this.loadPromotionsAndTargets();

    // Không tạo test return data nữa

    // Listen for navigation events - reload orders khi vào lại trang này
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Chỉ reload nếu đang ở trang orders
        if (event.urlAfterRedirects.includes('/account/orders')) {
          console.log(' Reloading orders khi vào lại trang orders...');
          this.loadOrders();
        }
      });

    // Listen for changes in return management data (from other tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'returnManagementData' || e.key === 'returnManagementDataChanged') {
        this.updateTabCounts();
        // Force change detection to update filtered orders when return data changes
        console.log(' Return management data changed, updating orders display...');
        this.cdr.detectChanges();
      }
      // Listen for reviewedItems changes to update badge and reload reviewed orders
      if (e.key === 'reviewedItems') {
        this.updateReviewBadge();
        this.loadReviewedOrders();
      }
      // Listen for new order created - reload orders
      if (e.key === 'newOrderCreated' || e.key === 'ordersDataChanged') {
        console.log(' New order detected, reloading orders...');
        this.loadOrders();
      }
    });

    // Listen for custom events in the same window (for same-tab updates)
    const handleReturnDataChange = () => {
      console.log(
        ' Return management data changed (same window), reloading orders from backend...'
      );
      this.loadOrders();
    };

    window.addEventListener('returnManagementDataChanged', handleReturnDataChange);

    // Store handler for cleanup
    (window as any).__returnManagementDataChangedHandler = handleReturnDataChange;
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

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown') && !target.closest('.custom-dropdown-list-portal')) {
      this.showReasonDropdown = false;
    }
  }

  loadOrders(): void {
    // First, try to load from backend
    const customerID = this.orderService.getCustomerID();
    console.log('📦 [Orders] Loading orders for CustomerID:', customerID);

    if (customerID && customerID !== 'guest') {
      console.log('📦 [Orders] Calling API to fetch orders...');
      this.orderService.getOrdersByCustomer(customerID).subscribe({
        next: (response) => {
          console.log('📦 [Orders] API Response:', response);
          if (response.success && response.data && Array.isArray(response.data)) {
            console.log('✅ [Orders] Loaded orders from backend:', response.data.length);
            console.log('📦 [Orders] Sample order:', response.data[0]);

            // Map backend orders to frontend format
            this.orders = response.data.map((order) => this.mapBackendOrderToFrontendOrder(order));
            console.log('✅ [Orders] Mapped orders:', this.orders.length);

            // Log status distribution for debugging
            const statusCounts: { [key: string]: number } = {};
            this.orders.forEach((order) => {
              statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
            });
            console.log('📊 [Orders] Status distribution:', statusCounts);

            // Verify cancelled orders are preserved
            const cancelledOrders = this.orders.filter((o) => o.status === 'cancelled');
            if (cancelledOrders.length > 0) {
              console.log(
                `✅ [Orders] Found ${cancelledOrders.length} cancelled orders:`,
                cancelledOrders.map((o) => o.id)
              );
            }

            // Save to localStorage
            localStorage.setItem('ordersData', JSON.stringify(this.orders));

            this.updateTabCounts();
            this.updateReviewBadge();
            this.loadReviewedOrders();
            this.reviewSyncService.notifyOrdersChanged();

            // Force change detection
            this.cdr.detectChanges();
          } else {
            console.log('⚠️ [Orders] No orders found in backend response:', response);
            this.loadFromLocalStorage();
          }
        },
        error: (error) => {
          console.error('❌ [Orders] Error loading orders from backend:', error);
          console.error('❌ [Orders] Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error,
          });
          this.loadFromLocalStorage();
        },
      });
    } else {
      console.log('⚠️ [Orders] No customer ID or guest user, loading from localStorage...');
      this.loadFromLocalStorage();
    }
  }

  loadFromLocalStorage(): void {
    const savedOrders = localStorage.getItem('ordersData');
    if (savedOrders) {
      this.orders = JSON.parse(savedOrders);
      console.log('Loaded saved orders from localStorage:', this.orders.length);

      this.updateTabCounts();
      this.updateReviewBadge();
      this.loadReviewedOrders();
      this.reviewSyncService.notifyOrdersChanged();
    } else {
      console.log('No saved orders found');
      // Không tạo sample orders nữa - chỉ load từ backend
      this.orders = [];
      this.updateTabCounts();
    }
  }

  mapBackendOrderToFrontendOrder(backendOrder: any): Order {
    // Keep status as-is from backend (delivered vs completed are now separate statuses)
    let status = backendOrder.status;

    // Map products from items - giữ nguyên itemType từ backend
    const products = backendOrder.items.map((item: any) => ({
      id: item.sku || item.productName, // Use SKU as ID if available
      name: item.productName,
      price: item.price,
      unit: item.unit || '',
      quantity: item.quantity,
      totalPrice: item.price * item.quantity,
      image: item.image || '',
      category: item.category || '',
      sku: item.sku || item.id, // Add SKU for navigation
      originalPrice: item.originalPrice || item.price, // Giá gốc
      itemType: item.itemType || 'purchased', // Loại item: mua hoặc tặng kèm
      hasBuy1Get1: item.itemType === 'gifted' || this.checkBuy1Get1PromotionBySku(item.sku), // Deprecated, dùng itemType
    }));

    return {
      id: backendOrder.OrderID || backendOrder._id,
      orderNumber: backendOrder.OrderID || backendOrder.orderNumber,
      OrderID: backendOrder.OrderID || backendOrder.orderNumber, // Giữ lại OrderID từ backend
      CustomerID: backendOrder.CustomerID || '', // Giữ lại CustomerID từ backend
      shippingInfo: backendOrder.shippingInfo || {}, // Giữ lại shippingInfo từ backend
      status: status,
      totalAmount: backendOrder.totalAmount,
      orderDate: this.formatBackendDate(backendOrder.createdAt),
      deliveryDate:
        status === 'completed' || status === 'delivered'
          ? this.formatBackendDate(backendOrder.updatedAt)
          : undefined,
      products: products,
      cancelReason: backendOrder.cancelReason || '', // Lý do hủy/trả hàng
    };
  }

  formatBackendDate(date: any): string {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  notifyReturnManagement(): void {
    // Trigger storage event to notify return management
    localStorage.setItem('ordersDataChanged', Date.now().toString());
    localStorage.removeItem('ordersDataChanged');

    // Notify reviews component in real-time (same tab)
    this.reviewSyncService.notifyOrdersChanged();

    // Update review badge immediately (không cần vào trang Reviews)
    this.updateReviewBadge();
  }

  updateReviewBadge(): void {
    // Count completed orders that haven't been reviewed
    const completedOrders = this.orders.filter((order) => order.status === 'completed');
    const reviewedItems = localStorage.getItem('reviewedItems');
    const reviewed = reviewedItems ? JSON.parse(reviewedItems) : [];

    // Get reviewed order IDs
    const reviewedOrderIds = reviewed.map((item: any) => {
      if (item.id.includes('_')) {
        return item.id.split('_')[0];
      }
      return item.orderId;
    });

    // Count unreviewed completed orders
    const unreviewedCount = completedOrders.filter((order) => {
      return !reviewedOrderIds.some((reviewedOrderId: string) => reviewedOrderId === order.id);
    }).length;

    // Update badge service
    this.reviewBadgeService.setUnreviewedCount(unreviewedCount);
    console.log('Updated review badge from Orders component:', unreviewedCount);
  }

  updateTabCounts(): void {
    this.tabs.forEach((tab) => {
      if (tab.id === 'all') {
        tab.count = this.orders.length;
      } else if (tab.id === 'completed') {
        // For completed tab, count delivered, received, and completed orders
        tab.count = this.orders.filter(
          (order) =>
            order.status === 'completed' ||
            order.status === 'delivered' ||
            order.status === 'received'
        ).length;
      } else if (tab.id === 'shipping') {
        // For shipping tab, count both confirmed and shipping orders (both show as "Đang giao")
        tab.count = this.orders.filter(
          (order) => order.status === 'confirmed' || order.status === 'shipping'
        ).length;
      } else {
        tab.count = this.orders.filter((order) => order.status === tab.id).length;
      }
    });
  }

  onTabClick(tabId: string): void {
    this.activeTab = tabId;
  }

  clearSearch(): void {
    this.searchQuery = '';
    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  performSearch(): void {
    // Search is performed automatically when getFilteredOrders() is called
    // This method can be used for additional actions if needed
    console.log('Searching for:', this.searchQuery);
  }

  getFilteredOrders(): Order[] {
    // First filter by active tab
    let filteredOrders: Order[] = [];
    if (this.activeTab === 'all') {
      // For "Tất cả" tab, show all orders except those with return statuses
      filteredOrders = this.orders.filter(
        (order) =>
          order.status !== 'processing_return' &&
          order.status !== 'returning' &&
          order.status !== 'returned'
      );
    } else if (this.activeTab === 'completed') {
      // For "Đã giao hàng" tab, show delivered, received, and completed orders
      filteredOrders = this.orders.filter(
        (order) =>
          order.status === 'completed' ||
          order.status === 'delivered' ||
          order.status === 'received'
      );
    } else if (this.activeTab === 'shipping') {
      // For "Chờ giao hàng" tab, show both confirmed and shipping orders (both show as "Đang giao")
      filteredOrders = this.orders.filter(
        (order) => order.status === 'confirmed' || order.status === 'shipping'
      );
    } else {
      // For other tabs, show orders with matching status
      filteredOrders = this.orders.filter((order) => order.status === this.activeTab);
    }

    // Then filter by search query (product name or order number)
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filteredOrders = filteredOrders.filter((order) => {
        // Check if order number matches the search query
        const orderNumber = (order.orderNumber || order.OrderID || '').toLowerCase();
        const matchesOrderNumber = orderNumber.includes(query);

        // Check if any product in the order matches the search query
        const matchesProduct = order.products.some((product) => {
          const productName = (product.name || '').toLowerCase();
          return productName.includes(query);
        });

        return matchesOrderNumber || matchesProduct;
      });
    }

    return filteredOrders;
  }

  getReturnOrders(): Order[] {
    // Get orders with pending or returned status
    const returnOrders = this.orders.filter(
      (order) => order.status === 'pending' || order.status === 'returned'
    );

    console.log('Return orders found:', returnOrders.length);
    return returnOrders;
  }

  getDisplayProducts(order: Order): Product[] {
    // Chỉ hiển thị purchased products (không hiển thị gifted products)
    const purchasedProducts = order.products.filter((p) => p.itemType !== 'gifted');

    if (this.expandedOrders.has(order.id)) {
      return purchasedProducts;
    }
    return purchasedProducts.slice(0, 1);
  }

  // Lấy danh sách purchased products (chỉ hiển thị purchased items trong danh sách chính)
  getPurchasedProducts(products: Product[]): Product[] {
    return products.filter((item) => item.itemType !== 'gifted');
  }

  // Tìm gifted product tương ứng với purchased product (cùng SKU)
  getGiftedProduct(purchasedProduct: Product, order: Order): Product | null {
    if (!purchasedProduct.sku) return null;

    const giftedProduct = order.products.find(
      (item) => item.sku === purchasedProduct.sku && item.itemType === 'gifted'
    );

    return giftedProduct || null;
  }

  // Kiểm tra xem purchased product có gifted product tương ứng không
  hasGiftedProduct(product: Product, order: Order): boolean {
    return this.getGiftedProduct(product, order) !== null;
  }

  hasMoreProducts(order: Order): boolean {
    return order.products.length > 1;
  }

  isOrderExpanded(order: Order): boolean {
    return this.expandedOrders.has(order.id);
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'Chờ xác nhận', // pending hiển thị "Chờ xác nhận"
      confirmed: 'Đã xác nhận', // confirmed hiển thị "Đã xác nhận"
      // processing: 'Đang xử lý',
      shipping: 'Đang giao hàng', // shipping hiển thị "Đang giao hàng"
      delivered: 'Đã giao hàng', // delivered hiển thị "Đã giao hàng"
      received: 'Đã nhận hàng', // received hiển thị "Đã nhận hàng"
      completed: 'Hoàn thành', // completed hiển thị "Hoàn thành"
      cancelled: 'Đã hủy',
      returned: 'Trả hàng',
      processing_return: 'Xử lý trả hàng/hoàn tiền',
      returning: 'Xử lý trả hàng/hoàn tiền',
    };
    return statusMap[status] || status;
  }

  getDisplayStatusLabel(order: Order): string {
    // pending → hiển thị "Chờ xác nhận" (ở tab "Chờ xác nhận")
    if (order.status === 'pending') {
      return 'Chờ xác nhận';
    }

    // confirmed → hiển thị "Đã xác nhận" và ở tab "Chờ giao hàng"
    if (order.status === 'confirmed') {
      return 'Đã xác nhận';
    }

    // shipping → hiển thị "Đang giao hàng" và ở tab "Chờ giao hàng"
    if (order.status === 'shipping') {
      return 'Đang giao hàng';
    }

    // delivered → hiển thị "Đã giao hàng" và ở tab "Đã giao hàng"
    if (order.status === 'delivered') {
      return 'Đã giao hàng';
    }

    // received → hiển thị "Đã nhận hàng" và ở tab "Đã giao hàng"
    if (order.status === 'received') {
      return 'Đã nhận hàng';
    }

    // completed → hiển thị "Hoàn thành" và ở tab "Đã giao hàng"
    if (order.status === 'completed') {
      return 'Hoàn thành';
    }

    // If order status is 'refunded' or 'returned', show "Đã trả hàng"
    if (order.status === 'refunded' || order.status === 'returned') {
      return 'Đã trả hàng';
    }

    // If order status is 'processing_return' or 'returning', show "Xử lý trả hàng/hoàn tiền"
    if (order.status === 'processing_return' || order.status === 'returning') {
      return 'Xử lý trả hàng/hoàn tiền';
    }

    // For other cases, use the existing logic
    if (this.activeTab === 'returned') {
      return this.getReturnStatusLabel(order);
    }

    return this.getStatusLabel(order.status);
  }

  getDisplayStatusClass(order: Order): string {
    // pending → hiển thị "Đã xác nhận" nhưng dùng class pending (vẫn ở tab "Chờ xác nhận")
    if (order.status === 'pending') {
      return 'status-pending';
    }

    // confirmed → hiển thị "Đã xác nhận" và dùng class shipping (ở tab "Chờ giao hàng")
    if (order.status === 'confirmed') {
      return 'status-shipping';
    }

    // shipping → hiển thị "Đang giao hàng" và dùng class shipping (ở tab "Chờ giao hàng")
    if (order.status === 'shipping') {
      return 'status-shipping';
    }

    // delivered → hiển thị "Đã giao hàng" và dùng class completed (ở tab "Đã giao hàng")
    if (order.status === 'delivered') {
      return 'status-completed';
    }

    // received → hiển thị "Đã nhận hàng" và dùng class completed (ở tab "Đã giao hàng")
    if (order.status === 'received' || order.status === 'completed') {
      return 'status-completed';
    }

    // For other cases, use the existing logic
    if (this.activeTab === 'returned') {
      return this.getReturnStatusClass(order);
    }

    return 'status-' + order.status;
  }

  getReturnStatusLabel(order: Order): string {
    // Map order status directly from backend
    const statusMap: { [key: string]: string } = {
      processing_return: 'Xử lý trả hàng/hoàn tiền',
      returning: 'Xử lý trả hàng/hoàn tiền',
      returned: 'Đã trả hàng/hoàn tiền',
    };

    return statusMap[order.status] || 'Hoàn thành';
  }

  getReturnStatusClass(order: Order): string {
    return `status-${order.status}`;
  }

  // Get return request status for an order (used to determine if cancel button should show)
  getReturnRequestStatus(order: Order): string | null {
    // Return order status if it's a return status
    if (
      order.status === 'processing_return' ||
      order.status === 'returning' ||
      order.status === 'returned'
    ) {
      return order.status;
    }
    return null;
  }

  // Check if order has ever been returned (checking backend status)
  hasOrderBeenReturned(order: Order): boolean {
    // Check if order has any return-related status
    return (
      order.status === 'processing_return' ||
      order.status === 'returning' ||
      order.status === 'returned'
    );
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  onViewMore(order: Order): void {
    if (this.expandedOrders.has(order.id)) {
      this.expandedOrders.delete(order.id);
    } else {
      this.expandedOrders.add(order.id);
    }
  }

  onReturnRefund(order: Order): void {
    this.selectedOrder = order;
    // Close order detail modal if open
    this.orderDetailModalService.closeModal();
    this.showReturnModal = true;
    this.resetModalForm();
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
    this.selectedOrder = null;
    this.resetModalForm();
  }

  resetModalForm(): void {
    this.selectedReason = '';
    this.detailedDescription = '';
    this.isModalExpanded = false;
    this.showReasonDropdown = false;
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  getModalDisplayProducts(): Product[] {
    if (!this.selectedOrder?.products) return [];

    // Chỉ hiển thị purchased products (không hiển thị gifted products)
    const purchasedProducts = this.getPurchasedProducts(this.selectedOrder.products);

    if (this.isModalExpanded) {
      return purchasedProducts;
    }
    return purchasedProducts.slice(0, 2);
  }

  hasMoreModalProducts(): boolean {
    return (this.selectedOrder?.products?.length ?? 0) > 2;
  }

  toggleModalProducts(): void {
    this.isModalExpanded = !this.isModalExpanded;
  }

  onReasonChange(): void {
    if (this.selectedReason !== 'other') {
      this.detailedDescription = '';
    }
  }

  // Custom dropdown methods for return reason
  toggleReasonDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showReasonDropdown = !this.showReasonDropdown;
    if (this.showReasonDropdown && this.reasonDropdownButtonRef) {
      // Calculate position relative to viewport
      setTimeout(() => {
        const element = this.reasonDropdownButtonRef?.nativeElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          this.reasonDropdownPosition = {
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width,
          };
        }
      }, 0);
    }
  }

  closeReasonDropdown(): void {
    this.showReasonDropdown = false;
  }

  selectReason(value: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedReason = value;
    this.onReasonChange();
    this.closeReasonDropdown();
  }

  getReasonLabel(value: string): string {
    const option = this.returnReasonOptions.find((opt) => opt.value === value);
    return option ? option.label : '';
  }

  canSubmit(): boolean {
    if (this.selectedReason === 'other') {
      return this.detailedDescription.trim() !== '';
    }
    return this.selectedReason !== '';
  }

  submitReturnRequest(): void {
    if (this.canSubmit() && this.selectedOrder) {
      console.log('Submitting return request:', {
        order: this.selectedOrder,
        reason: this.selectedReason,
        description: this.detailedDescription,
      });

      // Build reason string from selectedReason and detailedDescription
      let reasonText = '';
      const reasonLabels: { [key: string]: string } = {
        defective: 'Sản phẩm lỗi',
        'wrong-description': 'Không đúng mô tả',
        'wrong-delivery': 'Giao nhầm',
        other: 'Khác',
      };

      if (this.selectedReason === 'other') {
        reasonText = this.detailedDescription.trim();
      } else {
        reasonText = reasonLabels[this.selectedReason] || this.selectedReason;
        if (this.detailedDescription.trim()) {
          reasonText += ': ' + this.detailedDescription.trim();
        }
      }

      // Update order status to processing_return via API with reason
      this.updateOrderStatusViaAPI(
        this.selectedOrder.orderNumber,
        'processing_return',
        'processing_return',
        reasonText
      );

      // Close return modal
      this.closeReturnModal();

      // Show success toast notification
      this.toastService.show('Yêu cầu trả hàng đã được gửi thành công!', 'success');

      // Trigger event to notify return management page to reload
      window.dispatchEvent(new Event('returnManagementDataChanged'));
      localStorage.setItem('returnManagementDataChanged', Date.now().toString());
      localStorage.removeItem('returnManagementDataChanged');

      // Navigate to return management page after a short delay to allow backend to update
      setTimeout(() => {
        this.router.navigate(['/account/return-management']).then(() => {
          // Force reload after navigation to ensure data is fresh
          setTimeout(() => {
            window.dispatchEvent(new Event('returnManagementDataChanged'));
          }, 500);
        });
      }, 300);
    }
  }

  createReturnItem(): void {
    if (!this.selectedOrder) return;

    // Get existing return data or create new array
    const existingReturns = JSON.parse(localStorage.getItem('returnManagementData') || '[]');

    // Create 1 return item for the entire order (not per product)
    const allProducts = this.selectedOrder.products.map((product) => ({
      product: {
        _id: product.id,
        ProductName: product.name,
        Category: product.category,
        Subcategory: '',
        Price: product.price,
        Unit: product.unit,
        Image: product.image,
        Brand: '',
      },
      quantity: product.quantity,
      totalValue: product.totalPrice,
    }));

    const returnItem = {
      id: `return_${Date.now()}_${this.selectedOrder.id}`,
      status: 'processing_return',
      date: new Date().toISOString().split('T')[0],
      product: {
        _id: this.selectedOrder.products[0].id,
        ProductName: this.selectedOrder.products[0].name,
        Category: this.selectedOrder.products[0].category,
        Subcategory: '',
        Price: this.selectedOrder.products[0].price,
        Unit: this.selectedOrder.products[0].unit,
        Image: this.selectedOrder.products[0].image,
        Brand: '',
      },
      quantity: this.selectedOrder.products[0].quantity,
      totalValue: this.selectedOrder.products[0].totalPrice,
      totalAmount: this.selectedOrder.totalAmount,
      allProducts: allProducts,
      reason: this.selectedReason,
      description: this.detailedDescription,
      orderId: this.selectedOrder.id, // Local order ID for reference
      orderNumber: this.selectedOrder.orderNumber, // Order number for display (ORD...)
    };

    // Add new return item to existing data
    const updatedReturns = [...existingReturns, returnItem];

    // Save to localStorage
    localStorage.setItem('returnManagementData', JSON.stringify(updatedReturns));

    // Trigger storage event to notify return management (for other tabs)
    localStorage.setItem('returnManagementDataChanged', Date.now().toString());
    localStorage.removeItem('returnManagementDataChanged');

    // Trigger custom event for same window
    window.dispatchEvent(new Event('returnManagementDataChanged'));

    // Update tab counts
    this.updateTabCounts();

    // Force change detection to update filtered orders immediately
    this.cdr.detectChanges();

    // Notify return management to sync
    this.notifyReturnManagement();

    console.log('Return request created and synced:', returnItem.id);
    console.log('Order đã được thêm vào quản lý đổi trả');
  }

  updateOrderStatus(orderId: string, newStatus: string): void {
    // Update the order status in the orders array
    const orderIndex = this.orders.findIndex(
      (order) => order.id === orderId || order.OrderID === orderId
    );
    if (orderIndex !== -1) {
      const oldStatus = this.orders[orderIndex].status;
      this.orders[orderIndex].status = newStatus;
      console.log(
        '✅ [Orders] Order status updated locally:',
        orderId,
        'from',
        oldStatus,
        'to',
        newStatus
      );

      // Save updated orders to localStorage to preserve changes
      localStorage.setItem('ordersData', JSON.stringify(this.orders));
      console.log('💾 [Orders] Orders data saved to localStorage');

      // Notify other components about the change
      this.notifyReturnManagement();

      // Update tab counts after status change
      this.updateTabCounts();

      // Force change detection to update UI
      this.cdr.detectChanges();
    } else {
      console.warn('⚠️ [Orders] Order not found for status update:', orderId);
      console.warn(
        '⚠️ [Orders] Available order IDs:',
        this.orders.map((o) => o.id || o.OrderID)
      );
    }
  }

  // Handle double click on status text to cycle through order statuses (for testing)
  onStatusDoubleClick(order: Order): void {
    // console.log(' [Orders] Double click on status for order:', order.id, 'Current status:', order.status);

    // Map backend status to frontend status
    const statusFlow: { [key: string]: string } = {
      pending: 'confirmed',
      confirmed: 'processing',
      processing: 'shipping',
      shipping: 'delivered',
      delivered: 'pending', // Cycle back to pending for testing
      completed: 'pending', // If status is completed, cycle back to pending
    };

    // Get current status (handle both frontend and backend statuses)
    let currentStatus = order.status;

    // If status is 'completed' (frontend), map to 'delivered' (backend) for flow
    if (currentStatus === 'completed') {
      currentStatus = 'delivered';
    }

    // Get next status
    const nextStatus = statusFlow[currentStatus] || 'pending';

    // Map back to frontend status for display
    let frontendStatus = nextStatus;
    if (nextStatus === 'delivered') {
      frontendStatus = 'completed';
    }

    console.log(
      // ' [Orders] Changing status from',
      currentStatus,
      'to',
      nextStatus,
      '(frontend:',
      frontendStatus,
      ')'
    );

    // Update status via API (use backend status)
    this.updateOrderStatusViaAPI(order.id, nextStatus, frontendStatus);
  }

  // Update order status via API
  updateOrderStatusViaAPI(
    orderId: string,
    backendStatus: string,
    frontendStatus: string,
    reason?: string
  ): void {
    console.log('📦 [Orders] Calling API to update order status:', orderId, '->', backendStatus);
    if (reason) {
      console.log('📦 [Orders] Cancel reason:', reason);
    }

    // Prepare request body
    const requestBody: any = { status: backendStatus };
    if (reason) {
      requestBody.reason = reason;
    }

    // Call backend API to update order status
    this.http.put(`/api/orders/${orderId}/status`, requestBody).subscribe({
      next: (response: any) => {
        console.log('✅ [Orders] API Response:', response);

        // Check if response indicates success
        // Backend returns { success: true, data: { ...order } }
        const hasSuccessFlag = response.success === true;
        const orderData = response.data;

        if (hasSuccessFlag && orderData) {
          // Verify the status was actually updated in the response
          const updatedStatus = orderData.status || orderData.Status;
          console.log('✅ [Orders] Order status in response:', updatedStatus);
          console.log('✅ [Orders] Expected backend status:', backendStatus);

          // Backend converts 'delivered' to 'completed' automatically
          // So we should accept 'completed' when we sent 'delivered'
          const isStatusValid =
            updatedStatus === backendStatus ||
            updatedStatus === 'cancelled' ||
            (backendStatus === 'delivered' && updatedStatus === 'completed');

          if (!isStatusValid) {
            console.error(
              '❌ [Orders] Status mismatch! Expected:',
              backendStatus,
              'Got:',
              updatedStatus
            );
            // Don't show error for delivered->completed conversion (this is expected)
            if (!(backendStatus === 'delivered' && updatedStatus === 'completed')) {
              this.toastService.show(
                'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng. Vui lòng thử lại!',
                'error'
              );
              return;
            }
          }

          console.log('✅ [Orders] Status update validated successfully');

          // If order is completed, notify sidebar to reload user profile (TotalSpent and CustomerTiering will be updated)
          if (backendStatus === 'completed' || updatedStatus === 'completed') {
            // Backend automatically updates TotalSpent when order becomes completed
            setTimeout(() => {
              console.log(
                '🔄 [Orders] Notifying sidebar to reload user profile after order completed'
              );
              window.dispatchEvent(new Event('userInfoUpdated'));
              localStorage.setItem('userDataRefreshed', Date.now().toString());
              localStorage.removeItem('userDataRefreshed');
            }, 1000); // Wait 1 second for backend to update TotalSpent
          }

          // For cancelled orders, update UI immediately and reload
          if (backendStatus === 'cancelled') {
            // Update local status immediately for instant UI feedback
            this.updateOrderStatus(orderId, frontendStatus);

            // Show success toast
            this.toastService.show('Đã hủy đơn hàng thành công!', 'success');

            // Switch to cancelled tab
            this.activeTab = 'cancelled';

            // Reload orders from backend to get latest data (with increased delay for backend processing)
            // Use longer delay to ensure backend has fully committed the transaction
            setTimeout(() => {
              console.log('🔄 [Orders] Reloading orders after cancellation...');
              console.log('🔄 [Orders] Expected status: cancelled');
              this.loadOrders();

              // After reload, verify the status is still cancelled
              setTimeout(() => {
                const order = this.orders.find((o) => o.id === orderId || o.OrderID === orderId);
                if (order) {
                  console.log('🔍 [Orders] Order status after reload:', order.status);
                  if (order.status !== 'cancelled' && order.status !== frontendStatus) {
                    console.error(
                      '❌ [Orders] Status reverted! Expected: cancelled, Got:',
                      order.status
                    );
                    // Status was reverted - update it again
                    this.updateOrderStatus(orderId, 'cancelled');
                    this.toastService.show('Đã khôi phục trạng thái hủy đơn hàng', 'success');
                  } else {
                    console.log('✅ [Orders] Status verified: cancelled');
                  }
                }
              }, 500);
            }, 1500); // Increased delay to ensure backend has processed the update
          } else {
            // For other status updates (including delivered)
            // Get the actual updated status from response (backend converts delivered to completed)
            const orderData = response.data;
            const actualUpdatedStatus = orderData?.status || orderData?.Status;

            // If backendStatus is 'delivered', backend converts it to 'completed'
            // So we should update frontend status to 'completed' as well
            const actualFrontendStatus =
              backendStatus === 'delivered' ? 'completed' : frontendStatus;
            this.updateOrderStatus(orderId, actualFrontendStatus);

            // If order is delivered (backend converts to completed), refresh user data and show success toast
            if (backendStatus === 'delivered') {
              this.refreshUserData();
              // Show success toast notification (góc phải trên, giống các thông báo khác)
              this.toastService.show('Đã xác nhận nhận hàng thành công!', 'success');

              console.log('✅ [Orders] Success toast displayed for order received');
              console.log('✅ [Orders] Order status updated to:', actualUpdatedStatus);
            }

            // Reload orders to get updated data from backend
            setTimeout(() => {
              this.loadOrders();
            }, 500);
          }
        } else {
          // Response doesn't indicate success - check if it's a real error
          console.error('❌ [Orders] Order status update response indicates failure:', response);

          // Only show error if response explicitly indicates failure
          // Don't show error if response is missing success flag but has data
          if (response.success === false || (!response.success && !response.data)) {
            if (backendStatus === 'cancelled') {
              this.toastService.show('Hủy đơn hàng thất bại. Vui lòng thử lại!', 'error');
            } else if (backendStatus === 'delivered') {
              this.toastService.show(
                'Có lỗi xảy ra khi xác nhận nhận hàng. Vui lòng thử lại!',
                'error'
              );
            } else {
              this.toastService.show(
                'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng. Vui lòng thử lại!',
                'error'
              );
            }
          } else {
            // Response has data but no explicit success flag - treat as success
            console.log(
              '⚠️ [Orders] Response missing success flag but has data, treating as success'
            );
            const orderData = response.data || response;
            const actualUpdatedStatus = orderData?.status || orderData?.Status;

            if (actualUpdatedStatus) {
              const actualFrontendStatus =
                backendStatus === 'delivered' ? 'completed' : frontendStatus;
              this.updateOrderStatus(orderId, actualFrontendStatus);

              if (backendStatus === 'delivered') {
                this.refreshUserData();
                this.toastService.show('Đã xác nhận nhận hàng thành công!', 'success');
                console.log('✅ [Orders] Success toast displayed (fallback case)');
              }

              setTimeout(() => {
                this.loadOrders();
              }, 500);
            }
          }
        }
      },
      error: (error) => {
        console.error('❌ [Orders] Error updating order status:', error);
        console.error('❌ [Orders] Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
        });

        // Show error toast - log full error object to see what backend returned
        const errorResponse = error.error || {};
        const errorMessage = errorResponse.message || error.message || 'Có lỗi xảy ra';
        console.error(
          '❌ [Orders] Full error response from backend:',
          JSON.stringify(errorResponse, null, 2)
        );
        console.error('❌ [Orders] Error message from backend:', errorMessage);

        if (backendStatus === 'cancelled') {
          this.toastService.show('Hủy đơn hàng thất bại. Vui lòng thử lại!', 'error');
        } else if (backendStatus === 'received' || backendStatus === 'delivered') {
          this.toastService.show(
            errorMessage || 'Có lỗi xảy ra khi xác nhận nhận hàng. Vui lòng thử lại!',
            'error'
          );
        } else {
          this.toastService.show(
            'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng. Vui lòng thử lại!',
            'error'
          );
        }

        // Don't update local status on error - let user try again
      },
    });
  }

  // Refresh user data from backend to get updated TotalSpent and CustomerTiering
  refreshUserData(): void {
    // console.log(' [Orders] Refreshing user data from backend...');

    // Get CustomerID from localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.warn(' [Orders] No user data in localStorage');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const customerID = user.CustomerID;

      if (!customerID) {
        // console.warn(' [Orders] No CustomerID found in user data');
        return;
      }

      // Call API to get updated user info by CustomerID
      this.http.get(`/api/auth/user/${customerID}`).subscribe({
        next: (response: any) => {
          if (response.success && response.user) {
            // console.log(' [Orders] Updated user data received:', response.user);

            // Update localStorage with new user data
            const updatedUser = {
              ...user, // Keep existing fields
              ...response.user, // Override with updated data (TotalSpent, CustomerTiering)
            };

            localStorage.setItem('user', JSON.stringify(updatedUser));
            // console.log(' [Orders] Updated localStorage with new user data');

            // Dispatch event to notify sidebar to reload user profile
            window.dispatchEvent(new CustomEvent('userInfoUpdated'));

            // Also trigger storage event for cross-tab sync
            localStorage.setItem('userDataRefreshed', Date.now().toString());
            localStorage.removeItem('userDataRefreshed');
          }
        },
        error: (error) => {
          console.error(' [Orders] Error fetching updated user data:', error);
        },
      });
    } catch (error) {
      console.error(' [Orders] Error parsing user data:', error);
    }
  }

  // Handle cancel order (for pending orders)
  onCancelOrder(order: Order): void {
    // console.log(' [Orders] Cancel order requested:', order.id);
    this.orderToCancel = order;
    this.showCancelOrderModal = true;
  }

  // Close cancel order modal
  closeCancelOrderModal(): void {
    this.showCancelOrderModal = false;
    this.orderToCancel = null;
    this.cancelReason = '';
  }

  // Confirm cancel order
  confirmCancelOrder(): void {
    if (!this.orderToCancel) {
      return;
    }

    console.log('📦 [Orders] Confirming cancel order:', this.orderToCancel.id);
    console.log('📦 [Orders] Cancel reason:', this.cancelReason);

    // Update order status to cancelled via API with reason
    this.updateOrderStatusViaAPI(
      this.orderToCancel.id,
      'cancelled',
      'cancelled',
      this.cancelReason
    );

    // Close modal immediately for better UX
    this.closeCancelOrderModal();

    // Note: Tab switch and order reload will happen in updateOrderStatusViaAPI callback
  }

  onRate(order: Order): void {
    // Convert Order products to ReviewProduct format
    this.reviewProducts = order.products.map((product) => ({
      id: product.id,
      productName: product.name,
      productImage: product.image,
      category: product.category,
      rating: null,
      reviewText: null,
      images: [null, null, null, null, null],
    }));

    this.selectedOrder = order;
    this.showReviewModal = true;
  }

  onRepurchaseOrder(order: Order): void {
    // console.log(' [Orders] Repurchase order requested:', order.id);

    // Deselect all existing items in cart first
    this.cartService.deselectAllItems();

    // Add all products from the order to cart with exact quantity
    order.products.forEach((product) => {
      const cartItem = {
        id: product.id,
        sku: product.sku || product.id,
        name: product.name,
        quantity: product.quantity,
        price: product.price,
        image: product.image,
        unit: product.unit,
        category: product.category,
        subcategory: '', // Default value if not available
      };
      this.cartService.addOrUpdateItemWithQuantity(cartItem, product.quantity, false);
    });

    // Show toast notification
    this.toastService.show('Đã thêm sản phẩm vào giỏ hàng!', 'success');
    // Open cart
    this.cartService.openCart();
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.reviewProducts = [];
    this.selectedOrder = null;
  }

  submitReview(reviews: ReviewProduct[]): void {
    console.log('=== Submitting reviews from Orders ===');

    if (!this.selectedOrder) {
      console.error('No order selected');
      this.toastService.show('Không tìm thấy thông tin đơn hàng. Vui lòng thử lại.', 'error');
      return;
    }

    // Lưu selectedOrder vào biến local ngay đầu hàm để tránh bị null khi async
    const currentOrder = this.selectedOrder;

    // Lấy thông tin từ order
    const customerID = currentOrder.CustomerID || '';
    const orderID = currentOrder.OrderID || currentOrder.orderNumber || currentOrder.id;
    const fullname = currentOrder.shippingInfo?.fullName || '';

    if (!customerID) {
      console.error('Không tìm thấy CustomerID trong order, không thể submit review');
      this.toastService.show('Không tìm thấy thông tin khách hàng. Vui lòng thử lại.', 'error');
      return;
    }

    if (!fullname) {
      console.error('Không tìm thấy fullName trong shippingInfo, không thể submit review');
      this.toastService.show('Không tìm thấy tên khách hàng. Vui lòng thử lại.', 'error');
      return;
    }

    // Submit từng review lên API
    const reviewPromises = reviews.map((product) => {
      const sku = product.sku || product.id;

      // Chuẩn bị dữ liệu review
      const reviewData = {
        fullname: String(fullname || '').trim(),
        customer_id: String(customerID || '').trim(),
        content: String(product.reviewText || '').trim(),
        rating: Number(product.rating) || 5,
        images: (product.images || []).filter(
          (img): img is string => img !== null && img !== undefined && typeof img === 'string'
        ),
        time: new Date().toISOString(),
        order_id: String(orderID || '').trim(),
      };

      // Validate trước khi gửi
      if (
        !reviewData.fullname ||
        !reviewData.customer_id ||
        !reviewData.order_id ||
        !reviewData.rating
      ) {
        console.error(` [Orders] Missing required fields for SKU ${sku}:`, {
          has_fullname: !!reviewData.fullname,
          has_customer_id: !!reviewData.customer_id,
          has_rating: !!reviewData.rating,
          has_order_id: !!reviewData.order_id,
        });
      }

      // console.log(` [Orders] Submitting review for SKU: ${sku}`);

      // Gọi API để lưu review
      return this.http
        .post(`http://localhost:3000/api/reviews/${sku}`, reviewData)
        .toPromise()
        .then((response: any) => {
          // console.log(` Review submitted successfully for SKU: ${sku}`, response);
          return { success: true, product, response };
        })
        .catch((error) => {
          console.error(` Error submitting review for SKU: ${sku}`, error);
          if (error.error) {
            console.error(`Error details:`, error.error);
          }
          return { success: false, product, error };
        });
    });

    // Chờ tất cả reviews được submit
    Promise.all(reviewPromises)
      .then((results) => {
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        // currentOrder đã được lưu ở đầu hàm submitReview(), không cần kiểm tra lại
        if (!currentOrder) {
          console.error(' Selected order is null (should not happen)');
          this.showReviewModal = false;
          this.toastService.show('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
          return;
        }

        if (successCount > 0) {
          console.log(` Submitted ${successCount} reviews successfully`);

          // Chuyển order status sang completed sau khi submit review thành công
          // Chỉ chuyển nếu status hiện tại là 'received' (nút "Đánh giá" chỉ hiện ở status này)
          const orderIdForUpdate =
            currentOrder.OrderID || currentOrder.orderNumber || currentOrder.id;
          if (orderIdForUpdate && currentOrder.status === 'received') {
            console.log(
              `📝 [Orders] Updating order status to completed after review submission: ${orderIdForUpdate}`
            );
            this.updateOrderStatusViaAPI(orderIdForUpdate, 'completed', 'completed');

            // Notify sidebar to reload user profile (TotalSpent and CustomerTiering will be updated)
            // Backend automatically updates TotalSpent when order becomes completed
            setTimeout(() => {
              console.log(
                '🔄 [Orders] Notifying sidebar to reload user profile after order completed'
              );
              window.dispatchEvent(new Event('userInfoUpdated'));
              localStorage.setItem('userDataRefreshed', Date.now().toString());
              localStorage.removeItem('userDataRefreshed');
            }, 1000); // Wait 1 second for backend to update TotalSpent
          }

          // Lưu vào reviewed items cho UI
          reviews.forEach((product, index) => {
            const reviewResult = results[index];
            let reviewImages: string[] = [];
            if (reviewResult.success && 'response' in reviewResult) {
              const imagesFromResponse =
                reviewResult.response?.data?.reviews?.[
                  reviewResult.response?.data?.reviews?.length - 1
                ]?.images;
              reviewImages =
                imagesFromResponse && Array.isArray(imagesFromResponse)
                  ? imagesFromResponse.filter(
                      (img): img is string =>
                        img !== null && img !== undefined && typeof img === 'string'
                    )
                  : (product.images || []).filter(
                      (img): img is string =>
                        img !== null && img !== undefined && typeof img === 'string'
                    );
            } else {
              reviewImages = (product.images || []).filter(
                (img): img is string => img !== null && img !== undefined && typeof img === 'string'
              );
            }

            // Lấy thông tin sản phẩm từ order (sử dụng biến local)
            const productData = currentOrder.products.find((p) => p.id === product.id);

            const reviewedItem: any = {
              id: `${currentOrder.id}_${product.id}`,
              productName: product.productName,
              productImage: product.productImage,
              category: product.category,
              reviewerName: fullname,
              rating: product.rating,
              reviewText: product.reviewText,
              reviewDate: this.getCurrentDate(),
              orderId: currentOrder.id,
              orderNumber: currentOrder.orderNumber || currentOrder.OrderID || currentOrder.id,
              images: reviewImages && reviewImages.length > 0 ? reviewImages : undefined,
              price: productData?.price ? String(productData.price) : undefined,
              unit: productData?.unit,
              sku: product.sku || product.id,
              productId: product.id,
              OrderID: orderID,
              CustomerID: customerID,
              shippingInfo: currentOrder.shippingInfo,
              products: currentOrder.products,
            };

            // Lưu vào localStorage
            const existingReviews = JSON.parse(localStorage.getItem('reviewedItems') || '[]');
            const existingIndex = existingReviews.findIndex(
              (item: any) => item.id === reviewedItem.id
            );
            if (existingIndex >= 0) {
              existingReviews[existingIndex] = reviewedItem;
            } else {
              existingReviews.push(reviewedItem);
            }
            localStorage.setItem('reviewedItems', JSON.stringify(existingReviews));
          });

          // Thông báo reviews page để reload
          this.reviewSyncService.notifyOrdersChanged();

          // Update badge count - tính lại số lượng đơn chưa đánh giá
          const savedOrders = localStorage.getItem('ordersData');
          if (savedOrders) {
            try {
              const orders = JSON.parse(savedOrders);
              const completedOrders = orders.filter((order: any) => {
                const status = (order.status || '').toLowerCase().trim();
                return (
                  status === 'completed' ||
                  status === 'delivered' ||
                  status === 'đã giao hàng' ||
                  status.includes('delivered') ||
                  status.includes('completed') ||
                  status.includes('đã giao')
                );
              });

              const reviewedItems = JSON.parse(localStorage.getItem('reviewedItems') || '[]');
              const reviewedOrderIds = new Set(reviewedItems.map((item: any) => item.orderId));
              const unreviewedOrders = completedOrders.filter(
                (order: any) => !reviewedOrderIds.has(order.id)
              );
              this.reviewBadgeService.setUnreviewedCount(unreviewedOrders.length);
            } catch (error) {
              console.error('Error updating badge count:', error);
            }
          }

          // Cập nhật trạng thái order ngay lập tức trong this.orders (sử dụng currentOrder)
          const orderIndex = this.orders.findIndex((o) => o.id === currentOrder.id);
          if (orderIndex >= 0) {
            // Đánh dấu products đã được review
            this.orders[orderIndex].products = this.orders[orderIndex].products.map((product) => {
              const reviewed = reviews.find((r) => r.id === product.id);
              if (reviewed) {
                return { ...product, reviewed: true, hasReview: true };
              }
              return product;
            });

            // Lưu lại orders đã cập nhật
            localStorage.setItem('ordersData', JSON.stringify(this.orders));
          }

          // Cập nhật reviewedOrderIds ngay lập tức (sử dụng currentOrder)
          const finalOrderID = currentOrder.OrderID || currentOrder.orderNumber || currentOrder.id;
          // Kiểm tra xem tất cả products đã được review chưa
          const allProductsReviewed = currentOrder.products.every((product) => {
            return reviews.some((r) => r.id === product.id);
          });

          if (allProductsReviewed && finalOrderID) {
            this.reviewedOrderIds.add(finalOrderID);
          }

          // Đóng modal trước
          this.showReviewModal = false;
          this.reviewProducts = [];
          this.selectedOrder = null;

          // Cập nhật tab counts
          this.updateTabCounts();

          // Trigger change detection để UI cập nhật ngay
          this.cdr.detectChanges();

          // Reload reviewed orders từ backend (async, không chờ)
          this.loadReviewedOrders();

          // Hiển thị toast sau khi modal đã đóng hoàn toàn và UI đã được cập nhật
          // Sử dụng requestAnimationFrame để đảm bảo DOM đã được cập nhật
          requestAnimationFrame(() => {
            setTimeout(() => {
              // console.log(' [Orders] Showing success toast');
              if (failCount > 0) {
                this.toastService.show(
                  `Đã gửi ${successCount} đánh giá thành công. ${
                    failCount > 0 ? `${failCount} đánh giá gặp lỗi.` : ''
                  }`,
                  'error',
                  100000 // Z-index cao hơn modal
                );
              } else {
                this.toastService.show(
                  'Đánh giá đã được gửi thành công!',
                  'success',
                  100000 // Z-index cao hơn modal
                );
              }
            }, 200);
          });
        } else {
          console.error(' All reviews failed to submit');
          // Đóng modal ngay cả khi fail
          this.showReviewModal = false;
          this.reviewProducts = [];
          this.selectedOrder = null;
          this.cdr.detectChanges();
          requestAnimationFrame(() => {
            setTimeout(() => {
              // console.log(' [Orders] Showing error toast');
              this.toastService.show(
                'Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.',
                'error',
                100000 // Z-index cao hơn modal
              );
            }, 200);
          });
        }
      })
      .catch((error) => {
        console.error(' [Orders] Error in Promise.all:', error);
        // Đóng modal ngay cả khi có lỗi
        this.showReviewModal = false;
        this.reviewProducts = [];
        this.selectedOrder = null;
        this.cdr.detectChanges();
        requestAnimationFrame(() => {
          setTimeout(() => {
            // console.log(' [Orders] Showing error toast from catch');
            this.toastService.show(
              'Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.',
              'error',
              100000 // Z-index cao hơn modal
            );
          }, 200);
        });
      });
  }

  getCurrentDate(): string {
    const now = new Date();
    return (
      now.toLocaleDateString('vi-VN') +
      ' ' +
      now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getTotalQuantity(order: Order): number {
    return order.products.reduce((total, product) => total + product.quantity, 0);
  }

  onDeleteOrder(order: Order): void {
    if (confirm('Bạn có chắc chắn muốn xóa đơn hàng này khỏi mục trả hàng?')) {
      // Remove return requests for this order
      const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');
      const updatedData = returnData.filter((item: any) => {
        // Remove return requests
        if (item.id.startsWith('return_') && item.id.split('_')[2] === order.id) {
          return false;
        }
        // Remove delivered items with pending/returned status
        if (
          item.id.startsWith('delivered_') &&
          item.id.split('_')[1] === order.id &&
          (item.status === 'pending' || item.status === 'returned')
        ) {
          return false;
        }
        return true;
      });

      // Save updated data
      localStorage.setItem('returnManagementData', JSON.stringify(updatedData));

      // Update order status back to 'completed'
      this.updateOrderStatus(order.id, 'completed');

      // Trigger storage event to notify return management
      localStorage.setItem('returnManagementDataChanged', Date.now().toString());
      localStorage.removeItem('returnManagementDataChanged');

      // Update tab counts
      this.updateTabCounts();

      console.log('Order deleted from return management:', order.id);
    }
  }

  cleanupInvalidReturnData(): void {
    const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');
    const validOrderIds = this.orders.map((order) => order.id);

    // Only clean up if there are orders loaded
    if (validOrderIds.length === 0) {
      return;
    }

    // Filter out invalid return items
    const cleanedData = returnData.filter((item: any) => {
      // Check if return request has valid order ID
      if (item.id.startsWith('return_')) {
        const parts = item.id.split('_');
        if (parts.length >= 3) {
          const orderId = parts[2];
          return validOrderIds.includes(orderId);
        }
        return false;
      }

      // Check if delivered item has valid order ID
      if (item.id.startsWith('delivered_')) {
        const parts = item.id.split('_');
        if (parts.length >= 2) {
          const orderId = parts[1];
          return validOrderIds.includes(orderId);
        }
        return false;
      }

      return false; // Remove items that don't match expected format
    });

    // If data was cleaned, save it back
    if (cleanedData.length !== returnData.length) {
      console.log(
        'Cleaned up invalid return data:',
        returnData.length - cleanedData.length,
        'items removed'
      );
      localStorage.setItem('returnManagementData', JSON.stringify(cleanedData));

      // Update tab counts
      this.updateTabCounts();
    }
  }

  clearAllReturnData(): void {
    console.log('Clearing all return data...');
    localStorage.removeItem('returnManagementData');
    this.updateTabCounts();
    console.log('All return data cleared');
  }

  removeAutoGeneratedPendingItems(): void {
    const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');

    // Find and remove items with "pending" status that are auto-generated
    const filteredData = returnData.filter((item: any) => {
      // Remove items with pending status (these are auto-generated)
      if (item.status === 'pending') {
        console.log('Removing auto-generated pending item:', item.id);
        return false;
      }
      return true;
    });

    // If we removed any items, save the updated data
    if (filteredData.length !== returnData.length) {
      console.log('Removed auto-generated pending items:', returnData.length - filteredData.length);
      localStorage.setItem('returnManagementData', JSON.stringify(filteredData));
      this.updateTabCounts();
    }
  }

  clearAllData(): void {
    console.log('Clearing all data to show empty state...');

    // Clear all localStorage data
    localStorage.removeItem('ordersData');
    localStorage.removeItem('returnManagementData');
    localStorage.removeItem('returnManagementDataChanged');
    localStorage.removeItem('ordersDataChanged');
    localStorage.removeItem('reviewedItems');

    // Clear orders array (but keep the structure)
    this.orders = [];

    // Update tab counts to show 0
    this.updateTabCounts();

    console.log('All data cleared - showing empty state');
    console.log('Reload trang để tạo lại sample data!');
  }

  getReturnButtonText(order: Order): string {
    const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');
    console.log('getReturnButtonText - order.id:', order.id);
    console.log('getReturnButtonText - order.status:', order.status);
    console.log('getReturnButtonText - returnData:', returnData);

    // For orders with 'pending' status, show "Hủy yêu cầu"
    if (order.status === 'pending') {
      console.log('getReturnButtonText - order is pending, returning "Hủy yêu cầu"');
      return 'Hủy yêu cầu';
    }

    // For orders with 'returned' status, show "Đã trả hàng/hoàn tiền"
    if (order.status === 'returned') {
      console.log('getReturnButtonText - order is returned, returning "Đã trả hàng/hoàn tiền"');
      return 'Đã trả hàng/hoàn tiền';
    }

    console.log('getReturnButtonText - no matching status, returning empty string');
    return '';
  }

  getReturnButtonClass(order: Order): string {
    console.log('getReturnButtonClass - order.id:', order.id);
    console.log('getReturnButtonClass - order.status:', order.status);

    // For orders with 'pending' status, show cancel button
    if (order.status === 'pending') {
      console.log('getReturnButtonClass - order is pending, returning "cancel-btn"');
      return 'cancel-btn';
    }

    // For orders with 'returned' status, show completed button
    if (order.status === 'returned') {
      console.log('getReturnButtonClass - order is returned, returning "completed-btn"');
      return 'completed-btn';
    }

    console.log('getReturnButtonClass - no matching status, returning "return-btn"');
    return 'return-btn';
  }

  getReturnButtonDisabled(order: Order): boolean {
    console.log('getReturnButtonDisabled - order.id:', order.id);
    console.log('getReturnButtonDisabled - order.status:', order.status);

    // Disable if status is 'returned' (completed)
    if (order.status === 'returned') {
      console.log('getReturnButtonDisabled - order is returned, returning true (disabled)');
      return true;
    }

    // Enable for 'pending' status
    if (order.status === 'pending') {
      console.log('getReturnButtonDisabled - order is pending, returning false (enabled)');
      return false;
    }

    console.log('getReturnButtonDisabled - no matching status, returning false (enabled)');
    return false;
  }

  onReturnAction(order: Order): void {
    console.log('� onReturnAction CALLED!');
    console.log('Order ID:', order.id);
    console.log('Order Status:', order.status);

    // If order status is 'pending', show cancel confirmation modal
    if (order.status === 'pending') {
      console.log(' Order status is pending, proceeding with cancel modal');

      // Find the return request for this order
      const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');
      console.log('Return data from localStorage:', returnData);

      // Look for return request by checking all possible formats
      let returnItem = returnData.find((item: any) => {
        // Format 1: return_{timestamp}_{orderId}
        if (item.id.startsWith('return_')) {
          const parts = item.id.split('_');
          if (parts.length >= 3 && parts[2] === order.id) {
            // console.log('Found return item (format 1):', item.id);
            return true;
          }
        }

        // Format 2: return_{orderId} or delivered_{orderId}
        if (item.id === `return_${order.id}` || item.id === `delivered_${order.id}`) {
          // console.log('Found return item (format 2):', item.id);
          return true;
        }

        // Format 3: Check orderId field directly
        if ((item as any).orderId === order.id && item.status === 'pending') {
          // console.log('Found return item (via orderId field):', item.id);
          return true;
        }

        return false;
      });

      if (returnItem) {
        // console.log(' Return item found:', returnItem);
        // console.log('Setting cancelReturnItem and showing modal');
        this.cancelReturnItem = returnItem;
        this.showCancelModal = true;
        // console.log('showCancelModal set to:', this.showCancelModal);
      } else {
        // console.warn(' No return item found for order:', order.id);
        // console.warn('Creating temporary return item for modal display');

        // Create a temporary return item to allow cancellation
        // (This happens when return item exists but has different format)
        this.cancelReturnItem = {
          id: `return_temp_${order.id}`,
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          product: {
            _id: order.products[0].id,
            ProductName: order.products[0].name,
            Category: order.products[0].category,
            Subcategory: '',
            Price: order.products[0].price,
            Unit: order.products[0].unit,
            Image: order.products[0].image,
            Brand: '',
          },
          quantity: order.products[0].quantity,
          totalValue: order.products[0].totalPrice,
          totalAmount: order.totalAmount,
          allProducts: order.products.map((p) => ({
            product: {
              _id: p.id,
              ProductName: p.name,
              Category: p.category,
              Subcategory: '',
              Price: p.price,
              Unit: p.unit,
              Image: p.image,
              Brand: '',
            },
            quantity: p.quantity,
            totalValue: p.totalPrice,
          })),
        } as any;

        this.showCancelModal = true;
        // console.log(' Temporary return item created and modal shown');
      }
    }
    // else {
    // console.log(' Order status is not pending:', order.status);
    // }
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelReturnItem = null;
  }

  confirmCancelRequest(): void {
    if (this.cancelReturnItem) {
      console.log('Confirming cancel request for:', this.cancelReturnItem);

      const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');

      // Extract order ID from return item
      let orderId: string = '';

      if ((this.cancelReturnItem as any).orderId) {
        orderId = (this.cancelReturnItem as any).orderId;
        // console.log('Using orderId field:', orderId);
      } else if (this.cancelReturnItem.id.startsWith('return_temp_')) {
        // Temporary return item format: return_temp_{orderId}
        orderId = this.cancelReturnItem.id.replace('return_temp_', '');
        // console.log('Extracted orderId from temp item:', orderId);
      } else if (this.cancelReturnItem.id.startsWith('return_')) {
        // Parse from id format: return_{timestamp}_{orderId}
        const parts = this.cancelReturnItem.id.split('_');
        orderId = parts.length >= 3 ? parts[2] : parts[1];
        // console.log('Parsed orderId from return id:', orderId);
      } else if (this.cancelReturnItem.id.startsWith('delivered_')) {
        // Parse from delivered item format: delivered_{orderId}
        orderId = this.cancelReturnItem.id.replace('delivered_', '');
        // console.log('Extracted orderId from delivered item:', orderId);
      }

      if (!orderId) {
        // console.error('Could not extract orderId from return item:', this.cancelReturnItem);
        alert('Lỗi: Không thể xác định mã đơn hàng');
        this.closeCancelModal();
        return;
      }

      // Remove ALL return requests related to this order (regardless of status)
      const updatedData = returnData.filter((item: any) => {
        // Check if this item belongs to the order we're cancelling
        const itemOrderId =
          (item as any).orderId ||
          (item.id.startsWith('return_') ? item.id.split('_')[2] || item.id.split('_')[1] : '') ||
          (item.id.startsWith('delivered_') ? item.id.replace('delivered_', '') : '');

        // Remove all return items for this order (not just pending)
        return itemOrderId !== orderId;
      });

      localStorage.setItem('returnManagementData', JSON.stringify(updatedData));
      // console.log('Removed return requests for order:', orderId);

      // Find the order to get its orderNumber
      const order = this.orders.find((o) => o.id === orderId);
      if (order) {
        // Update order status back to 'completed' via API
        this.updateOrderStatusViaAPI(order.orderNumber, 'completed', 'completed');
        console.log('Order status updated to completed via API:', order.orderNumber);
      } else {
        // Fallback: update local status only
        this.updateOrderStatus(orderId, 'completed');
        console.log('Order status updated to completed (local only):', orderId);
      }

      // Trigger storage event to notify return management
      localStorage.setItem('returnManagementDataChanged', Date.now().toString());
      localStorage.removeItem('returnManagementDataChanged');

      // Update tab counts
      this.updateTabCounts();

      // Close modal
      this.closeCancelModal();

      // console.log(' Cancel confirmation completed successfully');
    }
  }

  debugLocalStorageData(): void {
    const returnData = JSON.parse(localStorage.getItem('returnManagementData') || '[]');
    console.log('=== DEBUG LOCALSTORAGE DATA ===');
    console.log('Total return items:', returnData.length);

    returnData.forEach((item: any, index: number) => {
      console.log(`Item ${index}:`, {
        id: item.id,
        status: item.status,
        idStartsWithReturn: item.id.startsWith('return_'),
        idStartsWithDelivered: item.id.startsWith('delivered_'),
        idParts: item.id.split('_'),
        shouldInclude:
          item.id.startsWith('return_') ||
          (item.id.startsWith('delivered_') &&
            (item.status === 'pending' || item.status === 'returned')),
      });
    });
    console.log('=== END DEBUG ===');
  }

  // Navigate to product detail from order product
  goToProductDetail(product: Product): void {
    // Try to find product by SKU to get _id
    if (product.sku) {
      this.productService.getProductBySku(product.sku).subscribe({
        next: (prod) => {
          if (prod && prod._id) {
            this.router.navigate(['/product-detail', prod._id]);
          } else {
            console.warn('Product not found for SKU:', product.sku);
          }
        },
        error: (error) => {
          console.error('Error fetching product by SKU:', error);
        },
      });
    } else {
      console.warn('Product has no SKU:', product);
    }
  }

  // Navigate to product detail from modal (close modal first)

  loadReviewedOrders(): void {
    // Load tất cả reviews từ backend để check order nào đã được review đầy đủ
    this.http.get<any>('http://localhost:3000/api/reviews/').subscribe({
      next: (response) => {
        if (response.success && response.data && Array.isArray(response.data)) {
          this.reviewedOrderIds.clear();

          // Với mỗi order, check xem tất cả products đã được review chưa
          this.orders.forEach((order) => {
            const orderId = order.OrderID || order.orderNumber || order.id;
            if (!orderId || (order.status !== 'completed' && order.status !== 'delivered')) {
              return; // Chỉ check completed/delivered orders
            }

            // Lấy tất cả SKUs trong order
            const orderSKUs = order.products.map((p) => p.sku || p.id).filter(Boolean);

            // Đếm số lượng reviews có order_id trùng với order này
            let reviewedProductCount = 0;
            response.data.forEach((reviewDoc: any) => {
              if (reviewDoc.reviews && Array.isArray(reviewDoc.reviews)) {
                reviewDoc.reviews.forEach((review: any) => {
                  if (review.order_id === orderId && orderSKUs.includes(reviewDoc.sku)) {
                    reviewedProductCount++;
                  }
                });
              }
            });

            // Nếu số lượng reviews bằng số lượng products, order đã được review đầy đủ
            if (reviewedProductCount >= orderSKUs.length && orderSKUs.length > 0) {
              this.reviewedOrderIds.add(orderId);
            }
          });

          // console.log(' Loaded reviewed orders:', Array.from(this.reviewedOrderIds));
        }
      },
      error: (error) => {
        console.error('Error loading reviewed orders:', error);
      },
    });
  }

  hasOrderBeenReviewed(order: Order): boolean {
    const orderId = order.OrderID || order.orderNumber || order.id;
    return orderId ? this.reviewedOrderIds.has(orderId) : false;
  }

  // View order details
  viewOrderDetails(order: Order): void {
    this.orderDetailModalService.openModal(order.orderNumber || order.OrderID || '');
  }

  // Confirm received order
  confirmReceivedOrder(order: Order): void {
    this.orderToConfirmReceived = order;
    this.showConfirmReceivedModal = true;
  }

  // Close confirm received modal
  closeConfirmReceivedModal(): void {
    this.showConfirmReceivedModal = false;
    this.orderToConfirmReceived = null;
  }

  // Execute confirm received order
  executeConfirmReceivedOrder(): void {
    if (!this.orderToConfirmReceived) {
      return;
    }

    const order = this.orderToConfirmReceived;

    // Close modals first
    this.closeConfirmReceivedModal();
    this.orderDetailModalService.closeModal();

    // Update status to received (sau khi nhấn "Đã nhận hàng" từ delivered)
    // Backend status và frontend status đều là 'received'
    this.updateOrderStatusViaAPI(order.id, 'received', 'received');
  }

  // Check if order is in shipping status (can confirm received)
  isOrderShipping(order: Order): boolean {
    return order.status === 'shipping' || order.status === 'confirmed';
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

        // Cập nhật buy1get1 status cho tất cả orders
        this.updateAllOrdersBuy1Get1Status();
      },
      error: (error) => {
        console.error('❌ [Orders] Error loading promotions:', error);
      },
    });
  }

  // Cập nhật trạng thái buy1get1 cho tất cả orders
  private updateAllOrdersBuy1Get1Status(): void {
    this.orders.forEach((order) => {
      order.products.forEach((product) => {
        product.hasBuy1Get1 = this.checkBuy1Get1Promotion(product);
      });
    });
  }

  // Kiểm tra xem sản phẩm có khuyến mãi buy1get1 không
  checkBuy1Get1Promotion(product: Product): boolean {
    if (!product.sku) return false;

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
    if (!target || !product.sku) return false;

    const targetType = target.target_type;
    const targetRefs = target.target_ref || [];

    switch (targetType) {
      case 'Product':
        // Match theo SKU
        return targetRefs.some((ref: string) => {
          const refSku = ref.trim();
          return refSku === product.sku || refSku === product.name;
        });

      case 'Category':
        // Match theo category
        return targetRefs.some((ref: string) => {
          const refCategory = ref.trim().toLowerCase();
          return refCategory === product.category?.toLowerCase();
        });

      case 'Brand':
        // Match theo brand (nếu có)
        return false; // Tạm thời return false vì Product không có brand

      default:
        return false;
    }
  }

  // Lấy số lượng sản phẩm tặng kèm (bằng số lượng mua thực tế)
  getFreeItemQuantity(product: Product, order: Order): number {
    const giftedProduct = this.getGiftedProduct(product, order);
    if (giftedProduct) {
      return giftedProduct.quantity;
    }
    return 0;
  }

  // Helper method để check buy1get1 promotion by SKU (deprecated, dùng itemType)
  private checkBuy1Get1PromotionBySku(sku?: string): boolean {
    if (!sku) return false;
    // Tạm thời return false vì đã dùng itemType từ backend
    return false;
  }

  // Helper methods for shipping info display
}
