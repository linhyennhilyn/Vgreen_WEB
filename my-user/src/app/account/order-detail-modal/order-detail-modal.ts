import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService } from '../../services/order.service';
import { OrderDetailModalService } from '../../services/order-detail-modal.service';
import { AddressService } from '../../services/address.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { ReviewSyncService } from '../../services/review-sync.service';

interface Order {
  id: string;
  orderNumber: string;
  OrderID?: string;
  CustomerID?: string;
  shippingInfo?: {
    fullName?: string;
    phone?: string;
    email?: string;
    address?: {
      city?: string;
      district?: string;
      ward?: string;
      detail?: string;
    };
    [key: string]: any;
  };
  status: string;
  totalAmount: number;
  orderDate: string;
  deliveryDate?: string;
  products: Product[];
  subtotal?: number;
  shippingFee?: number;
  shippingDiscount?: number; // Giảm phí vận chuyển (miễn phí = 30000)
  discount?: number;
  vatAmount?: number;
  paymentMethod?: string;
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
  sku?: string;
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
  originalPrice?: number; // Giá gốc trước khuyến mãi
  hasBuy1Get1?: boolean; // Deprecated, dùng itemType
}

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-detail-modal.html',
  styleUrls: ['./order-detail-modal.css'],
})
export class OrderDetailModal implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  searchQuery: string = '';
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  showDetailModal: boolean = false;
  private subscriptions: Subscription[] = [];

  // Track reviewed order IDs
  private reviewedOrderIds: Set<string> = new Set();
  showCancelOrderModal: boolean = false;
  showConfirmReceivedModal: boolean = false;
  orderToConfirmReceived: Order | null = null;

  constructor(
    private orderService: OrderService,
    private orderDetailModalService: OrderDetailModalService,
    private addressService: AddressService,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private toastService: ToastService,
    private reviewSyncService: ReviewSyncService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Load orders and reviews initially
    this.loadOrders();
    this.loadReviewedOrders();

    // Subscribe to modal service - handle modal open/close
    const isOpenSubscription = this.orderDetailModalService.isOpen$.subscribe((isOpen) => {
      this.showDetailModal = isOpen;
      this.cdr.detectChanges(); // Force change detection
      if (isOpen) {
        // CRITICAL: Reload orders every time modal opens to get latest data
        // This ensures newly created orders are available immediately
        console.log('[OrderDetailModal] Modal opened - reloading orders from backend');
        const orderNumber = this.orderDetailModalService.getOrderNumber();
        this.loadOrdersWithCallback(() => {
          // After orders are loaded, check if we need to open a specific order
          if (orderNumber) {
            console.log('[OrderDetailModal] Opening order after reload:', orderNumber);
            this.openOrderDetailByNumber(orderNumber);
          } else if (this.orders.length > 0 && !this.selectedOrder) {
            // If no orderNumber, select first order
            this.selectedOrder = this.orders[0];
            this.filterOrders();
          }
          this.cdr.detectChanges(); // Force change detection after loading
        });
      } else {
        // Reset when modal closes
        this.selectedOrder = null;
        this.searchQuery = '';
        this.filterOrders();
        this.cdr.detectChanges(); // Force change detection after closing
      }
    });

    // Subscribe to order number changes - handle order selection when modal is already open
    const orderNumberSubscription = this.orderDetailModalService.orderNumber$.subscribe(
      (orderNumber) => {
        if (orderNumber && this.showDetailModal) {
          console.log('[OrderDetailModal] Order number changed while modal is open:', orderNumber);
          // Modal is already open, just switch to the new order
          this.openOrderDetailByNumber(orderNumber);
        }
      }
    );

    // Listen for reviewed items changes
    window.addEventListener('storage', (e) => {
      if (e.key === 'reviewedItems') {
        this.loadReviewedOrders();
      }
    });

    this.subscriptions.push(isOpenSubscription, orderNumberSubscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  loadOrders(): void {
    this.loadOrdersWithCallback();
  }

  loadOrdersWithCallback(callback?: () => void): void {
    const customerID = this.orderService.getCustomerID();
    console.log('[OrderDetailModal] Loading orders for customerID:', customerID);

    if (customerID && customerID !== 'guest') {
      this.orderService.getOrdersByCustomer(customerID).subscribe({
        next: (response) => {
          console.log('[OrderDetailModal] Orders loaded from backend:', response);
          if (response.success && response.data) {
            // Filter out orders with "processing" status
            const validOrders = response.data.filter((order: any) => order.status !== 'processing');
            this.orders = validOrders.map((order: any) =>
              this.mapBackendOrderToFrontendOrder(order)
            );
            console.log('[OrderDetailModal] Total orders after mapping:', this.orders.length);
            this.filterOrders();

            // Execute callback if provided (after orders are loaded)
            if (callback) {
              callback();
            } else {
              // Default behavior: If modal is open and no order selected, select first order
              if (this.showDetailModal && !this.selectedOrder && this.orders.length > 0) {
                const orderNumber = this.orderDetailModalService.getOrderNumber();
                if (orderNumber) {
                  this.openOrderDetailByNumber(orderNumber);
                } else {
                  this.selectedOrder = this.orders[0];
                }
              }
            }
          } else {
            console.warn('[OrderDetailModal] No data from backend, loading from localStorage');
            this.loadFromLocalStorage(callback);
          }
        },
        error: (error) => {
          console.error('[OrderDetailModal] Error loading orders:', error);
          this.loadFromLocalStorage(callback);
        },
      });
    } else {
      console.warn('[OrderDetailModal] No valid customerID, loading from localStorage');
      this.loadFromLocalStorage(callback);
    }
  }

  loadFromLocalStorage(callback?: () => void): void {
    const savedOrders = localStorage.getItem('ordersData');
    if (savedOrders) {
      try {
        const parsedOrders = JSON.parse(savedOrders);
        // Filter out orders with "processing" status
        this.orders = parsedOrders.filter((order: Order) => order.status !== 'processing');
        this.filterOrders();
        console.log('[OrderDetailModal] Loaded orders from localStorage:', this.orders.length);

        // Execute callback if provided
        if (callback) {
          callback();
        } else {
          // Default behavior: If modal is open and no order selected, select first order
          if (this.showDetailModal && !this.selectedOrder && this.orders.length > 0) {
            const orderNumber = this.orderDetailModalService.getOrderNumber();
            if (orderNumber) {
              this.openOrderDetailByNumber(orderNumber);
            } else {
              this.selectedOrder = this.orders[0];
            }
          }
        }
      } catch (error) {
        console.error('[OrderDetailModal] Error parsing orders from localStorage:', error);
        this.orders = [];
        if (callback) {
          callback();
        }
      }
    } else {
      console.warn('[OrderDetailModal] No orders in localStorage');
      this.orders = [];
      if (callback) {
        callback();
      }
    }
  }

  mapBackendOrderToFrontendOrder(backendOrder: any): Order {
    const products = backendOrder.items
      ? backendOrder.items.map((item: any) => ({
          id: item.sku || item.productName,
          name: item.productName,
          price: item.price,
          unit: item.unit || '',
          quantity: item.quantity,
          totalPrice: item.price * item.quantity,
          image: item.image || '',
          category: item.category || '',
          sku: item.sku || item.id,
          itemType: item.itemType || 'purchased', // Loại item: mua hoặc tặng kèm
          originalPrice: item.originalPrice || item.price, // Giá gốc
          hasBuy1Get1: item.itemType === 'gifted', // Deprecated, dùng itemType
        }))
      : backendOrder.products || [];

    // Lưu datetime gốc (ISO string) để có thể hiển thị cả giờ và ngày
    const orderDateTime = backendOrder.createdAt || backendOrder.orderDate;
    const orderDateValue = orderDateTime
      ? typeof orderDateTime === 'string'
        ? orderDateTime
        : new Date(orderDateTime).toISOString()
      : new Date().toISOString();

    // Map completed orders with returnReason to refund_rejected
    let normalizedStatus = backendOrder.status || 'pending';
    if (
      normalizedStatus === 'completed' &&
      backendOrder.returnReason &&
      backendOrder.returnReason.trim() !== ''
    ) {
      normalizedStatus = 'refund_rejected';
    }

    return {
      id: backendOrder.OrderID || backendOrder._id || backendOrder.id,
      orderNumber: backendOrder.OrderID || backendOrder.orderNumber,
      OrderID: backendOrder.OrderID || backendOrder.orderNumber,
      CustomerID: backendOrder.CustomerID || '',
      shippingInfo: backendOrder.shippingInfo || {},
      status: normalizedStatus,
      totalAmount: backendOrder.totalAmount || 0,
      orderDate: orderDateValue, // Lưu datetime gốc (ISO string) thay vì chỉ date
      deliveryDate: backendOrder.deliveryDate
        ? this.formatDate(backendOrder.deliveryDate)
        : undefined,
      products: products,
      subtotal: backendOrder.subtotal || 0,
      shippingFee: backendOrder.shippingFee || 0,
      shippingDiscount: backendOrder.shippingDiscount || 0, // Map shippingDiscount từ backend
      discount: backendOrder.discount || 0,
      vatAmount: backendOrder.vatAmount || 0,
      paymentMethod: backendOrder.paymentMethod || 'cod',
    };
  }

  formatDate(date: any): string {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  filterOrders(): void {
    // Filter out orders with "processing" status
    let filtered = this.orders.filter((order) => order.status !== 'processing');

    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredOrders = filtered;
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredOrders = filtered.filter((order) => {
      // Search by order number
      if (order.orderNumber?.toLowerCase().includes(query)) {
        return true;
      }
      // Search by product name
      return order.products.some((product) => {
        const productName = (product.name || '').toLowerCase();
        return productName.includes(query);
      });
    });
  }

  onSearchChange(): void {
    this.filterOrders();
  }

  focusSearchInput(): void {
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterOrders();
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 0);
  }

  openOrderDetail(order: Order): void {
    this.selectedOrder = order;
  }

  openOrderDetailByNumber(orderNumber: string): void {
    console.log('[OrderDetailModal] Searching for order:', orderNumber);
    console.log(
      '[OrderDetailModal] Available orders:',
      this.orders.map((o) => o.orderNumber)
    );

    const order = this.orders.find(
      (o) => o.orderNumber === orderNumber || o.OrderID === orderNumber
    );

    if (order) {
      console.log('[OrderDetailModal] Found order in list:', order.orderNumber);
      this.openOrderDetail(order);
    } else {
      console.warn(
        '[OrderDetailModal] Order not found in list, fetching from backend:',
        orderNumber
      );
      // Order not found in loaded list, fetch it separately from backend
      // This handles the case where order was just created and not yet in the list
      this.fetchOrderFromBackend(orderNumber);
    }
  }

  fetchOrderFromBackend(orderNumber: string): void {
    console.log('[OrderDetailModal] Fetching order from backend:', orderNumber);
    this.orderService.getOrderById(orderNumber).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          console.log('[OrderDetailModal] Fetched order from backend:', response.data);
          const mappedOrder = this.mapBackendOrderToFrontendOrder(response.data);

          // Check if order already exists in list
          const existingOrderIndex = this.orders.findIndex(
            (o) => o.orderNumber === mappedOrder.orderNumber || o.OrderID === mappedOrder.OrderID
          );

          if (existingOrderIndex >= 0) {
            // Update existing order
            this.orders[existingOrderIndex] = mappedOrder;
            console.log('[OrderDetailModal] Updated existing order in list');
          } else {
            // Add new order to the beginning of the list (most recent first)
            this.orders.unshift(mappedOrder);
            console.log('[OrderDetailModal] Added new order to list');
          }

          // Update filtered orders
          this.filterOrders();

          // Open the order detail
          this.openOrderDetail(mappedOrder);
        } else {
          console.error('[OrderDetailModal] Failed to fetch order from backend:', response);
          // Show error message to user
          this.toastService.show('Không tìm thấy đơn hàng', 'error');
        }
      },
      error: (error) => {
        console.error('[OrderDetailModal] Error fetching order from backend:', error);
        // Show error message to user
        this.toastService.show('Không thể tải đơn hàng. Vui lòng thử lại.', 'error');
      },
    });
  }

  closeDetailModal(): void {
    this.orderDetailModalService.closeModal();
  }

  @HostListener('document:keydown', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.showDetailModal) {
      this.closeDetailModal();
    }
  }

  getStatusLabel(status: string): string {
    // Filter out "processing" status - don't display it
    if (status === 'processing') {
      return 'Chờ xác nhận'; // Fallback to pending
    }
    const statusMap: { [key: string]: string } = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao',
      received: 'Đã nhận hàng',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
      processing_return: 'Đang xử lý trả hàng',
      returning: 'Đang trả hàng',
      returned: 'Đã trả hàng',
      refund_rejected: 'Từ chối trả hàng',
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const statusClassMap: { [key: string]: string } = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      shipping: 'status-shipping',
      delivered: 'status-delivered',
      received: 'status-completed',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      processing_return: 'status-returning',
      returning: 'status-returning',
      returned: 'status-returned',
      refund_rejected: 'status-refund_rejected',
    };
    return statusClassMap[status] || 'status-pending';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  formatDateDisplay(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatDateTimeDisplay(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    // Kiểm tra xem date có hợp lệ không
    if (isNaN(d.getTime())) return '';

    // Format giờ:phút
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // Format ngày tháng năm
    const dateString = d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Trả về: "HH:mm - ngày tháng năm"
    return `${timeString} - ${dateString}`;
  }

  getTotalQuantity(order: Order): number {
    return order.products.reduce((total, product) => total + product.quantity, 0);
  }

  getPaymentMethodLabel(method: string): string {
    const methodMap: { [key: string]: string } = {
      cod: 'Thanh toán khi nhận hàng',
      vnpay: 'VNPay',
      momo: 'MoMo',
      card: 'Thẻ tín dụng',
      banking: 'Chuyển khoản ngân hàng',
    };
    return methodMap[method] || method;
  }

  getSubtotalWithVAT(): number {
    if (!this.selectedOrder) return 0;

    // Tổng tiền hàng (Đã gồm VAT) - giá sản phẩm đã bao gồm VAT rồi, không cần cộng thêm
    // Nếu có subtotal, sử dụng trực tiếp (subtotal đã là tổng tiền hàng bao gồm VAT)
    if (this.selectedOrder.subtotal) {
      return this.selectedOrder.subtotal;
    }

    // Nếu không có subtotal, tính từ products (chỉ tính purchased products, không tính gifted)
    if (this.selectedOrder.products && this.selectedOrder.products.length > 0) {
      return this.getPurchasedProducts(this.selectedOrder.products).reduce(
        (sum, product) => sum + product.totalPrice,
        0
      );
    }

    // Fallback: nếu có totalAmount và shippingFee, tính ngược lại
    // totalAmount = subtotal + shippingFee - discount - shippingDiscount
    // subtotal ≈ totalAmount - shippingFee + discount (nếu có)
    if (this.selectedOrder.totalAmount) {
      const shippingFee = this.selectedOrder.shippingFee || 0;
      const discount = this.selectedOrder.discount || 0;
      // Ước tính subtotal (có thể không chính xác 100% nếu có shipping discount)
      return Math.max(0, this.selectedOrder.totalAmount - shippingFee + discount);
    }

    return 0;
  }

  /**
   * Kiểm tra xem đơn hàng có được miễn phí vận chuyển không
   * Free shipping khi: shippingDiscount >= shippingFee (thường là 30000)
   * Hoặc subtotal >= 200000
   */
  isFreeShipping(): boolean {
    if (!this.selectedOrder) return false;

    // Kiểm tra shippingDiscount trước (chính xác nhất)
    const shippingFee = this.selectedOrder.shippingFee || 0;
    const shippingDiscount = this.selectedOrder.shippingDiscount || 0;

    // Nếu shippingDiscount >= shippingFee thì là free shipping
    if (shippingDiscount >= shippingFee && shippingFee > 0) {
      return true;
    }

    // Fallback: kiểm tra subtotal >= 200000
    const subtotal = this.getSubtotalWithVAT();
    return subtotal >= 200000;
  }

  /**
   * Lấy phí vận chuyển gốc (30000 VND) - để hiển thị discount khi free shipping
   */
  getBaseShippingFee(): number {
    return 30000;
  }

  // Lấy danh sách purchased products (chỉ hiển thị purchased items trong danh sách chính)
  getPurchasedProducts(products: Product[]): Product[] {
    return products.filter((item) => item.itemType !== 'gifted');
  }

  // Tìm gifted product tương ứng với purchased product (cùng SKU)
  getGiftedProduct(purchasedProduct: Product, order: Order): Product | null {
    if (!purchasedProduct.sku || !order) return null;

    const giftedProduct = order.products.find(
      (item) => item.sku === purchasedProduct.sku && item.itemType === 'gifted'
    );

    return giftedProduct || null;
  }

  // Kiểm tra xem purchased product có gifted product tương ứng không
  hasGiftedProduct(product: Product, order: Order): boolean {
    if (!order) return false;
    return this.getGiftedProduct(product, order) !== null;
  }

  getFullAddress(address: any): string {
    if (!address) return '';

    const parts: string[] = [];

    // Add detail address (street number, building, etc.)
    if (address.detail) {
      parts.push(address.detail);
    }

    // Convert ward ID/code to full ward name
    const wardName = this.addressService.getWardNameFromId(
      address.ward,
      address.city,
      address.district
    );
    if (wardName) {
      parts.push(wardName);
    }

    // Convert district ID/code to full district name
    const districtName = this.addressService.getDistrictNameFromId(address.district, address.city);
    if (districtName) {
      parts.push(districtName);
    }

    // Convert city ID/code to full city name
    const cityName = this.addressService.getCityNameFromId(address.city);
    if (cityName) {
      parts.push(cityName);
    }

    return parts.join(', ');
  }

  goToProductDetail(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent event bubbling
    }

    // Close modal first
    this.orderDetailModalService.closeModal();

    // Try to find product by SKU to get _id
    if (product.sku) {
      this.productService.getProductBySku(product.sku).subscribe({
        next: (prod) => {
          if (prod && prod._id) {
            // Navigate to product detail page with _id
            this.router.navigate(['/product-detail', prod._id]).then(() => {
              // Scroll to top after navigation
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          } else {
            console.warn('Product not found for SKU:', product.sku);
            // Fallback: try to navigate with sku directly
            this.router.navigate(['/product-detail', product.sku]).then(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }
        },
        error: (error) => {
          console.error('Error fetching product by SKU:', error);
          // Fallback: try to navigate with sku or id directly
          const productId = product.sku || product.id;
          if (productId) {
            this.router.navigate(['/product-detail', productId]).then(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }
        },
      });
    } else if (product.id) {
      // If no sku, try to navigate with id directly
      this.router.navigate(['/product-detail', product.id]).then(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      console.warn('No product ID or SKU found for navigation');
    }
  }

  // Load reviewed orders from localStorage
  loadReviewedOrders(): void {
    const reviewedItems = localStorage.getItem('reviewedItems');
    if (reviewedItems) {
      try {
        const items = JSON.parse(reviewedItems);
        this.reviewedOrderIds = new Set(
          items.map((item: any) => item.orderId || item.order_id || item.OrderID).filter(Boolean)
        );
      } catch (error) {
        console.error('Error parsing reviewedItems:', error);
      }
    }
  }

  // Check if order has been reviewed
  hasOrderBeenReviewed(order: Order): boolean {
    const orderId = order.OrderID || order.orderNumber || order.id;
    return orderId ? this.reviewedOrderIds.has(orderId) : false;
  }

  // Check if order has been returned
  hasOrderBeenReturned(order: Order): boolean {
    return (
      order.status === 'processing_return' ||
      order.status === 'returning' ||
      order.status === 'returned'
    );
  }

  // Cancel order
  onCancelOrder(): void {
    if (!this.selectedOrder) return;
    this.showCancelOrderModal = true;
  }

  closeCancelOrderModal(): void {
    this.showCancelOrderModal = false;
  }

  confirmCancelOrder(): void {
    if (!this.selectedOrder) return;

    // Update order status to cancelled via API
    const orderId = this.selectedOrder.id || this.selectedOrder.orderNumber;
    if (orderId) {
      this.orderService.updateOrderStatus(orderId, 'cancelled').subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.show('Đã hủy đơn hàng thành công!', 'success');
            this.orderDetailModalService.closeModal();
            // Reload orders
            this.loadOrders();
            // Navigate to orders page
            this.router.navigate(['/account/orders'], { queryParams: { tab: 'cancelled' } });
          } else {
            this.toastService.show('Lỗi khi hủy đơn hàng', 'error');
          }
        },
        error: (error) => {
          console.error('Error cancelling order:', error);
          this.toastService.show('Lỗi khi hủy đơn hàng', 'error');
        },
      });
    }

    this.closeCancelOrderModal();
  }

  // Rate order - navigate to reviews page
  onRate(): void {
    if (!this.selectedOrder) return;
    this.orderDetailModalService.closeModal();
    // Navigate to reviews page
    this.router.navigate(['/account/reviews']);
  }

  // Return/Refund order - navigate to return-management page
  onReturnRefund(): void {
    if (!this.selectedOrder) return;
    this.orderDetailModalService.closeModal();
    // Navigate to return-management page
    this.router.navigate(['/account/return-management']);
  }

  // Repurchase order - add to cart
  onRepurchaseOrder(): void {
    if (!this.selectedOrder) return;

    // Deselect all existing items in cart first
    this.cartService.deselectAllItems();

    // Add all products from the order to cart with exact quantity
    this.selectedOrder.products.forEach((product) => {
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
    // Close modal
    this.orderDetailModalService.closeModal();
    // Open cart
    this.cartService.openCart();
  }

  // Confirm received order - show modal
  confirmReceivedOrder(): void {
    if (!this.selectedOrder) return;
    this.orderToConfirmReceived = this.selectedOrder;
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
    const orderId = order.OrderID || order.orderNumber || order.id;

    // Close modals first
    this.closeConfirmReceivedModal();
    this.orderDetailModalService.closeModal();

    // Update status to received via API
    this.orderService.updateOrderStatus(orderId, 'received').subscribe({
      next: (response) => {
        console.log('✅ [OrderDetailModal] Order status updated to received:', response);
        this.toastService.show('Đã xác nhận nhận hàng thành công!', 'success');
        // Reload orders to reflect the change
        this.loadOrders();
      },
      error: (error) => {
        console.error('❌ [OrderDetailModal] Error updating order status:', error);
        this.toastService.show('Có lỗi xảy ra khi xác nhận nhận hàng. Vui lòng thử lại!', 'error');
      },
    });
  }
}
