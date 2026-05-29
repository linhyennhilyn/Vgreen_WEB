import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-orderdetail',
  imports: [CommonModule, FormsModule],
  templateUrl: './orderdetail.html',
  styleUrl: './orderdetail.css',
  standalone: true,
})
export class OrderDetail implements OnInit, OnDestroy {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown') && !target.closest('.custom-dropdown-list-portal')) {
      this.showRejectReasonDropdown = false;
    }
  }
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);

  orderId: string = '';
  order: any = null;
  user: any = null;
  products: any[] = [];
  productsMap: Map<string, any> = new Map(); // Map để lưu products từ product.json
  promotionsMap: Map<number, any> = new Map(); // Map để lưu promotions từ promotions.json
  activePromotions: any[] = []; // List of active promotions for dropdown
  selectedPromotionId: number | null = null; // Selected promotion ID
  returnUrl: string = ''; // URL to return to when going back
  backButtonText: string = 'Quay lại trang đơn hàng'; // Dynamic back button text
  breadcrumbText: string = 'Quản lý đơn hàng'; // Dynamic breadcrumb text
  isNewOrder: boolean = false; // Flag to check if this is a new order
  isEditMode: boolean = false; // Flag to check if this is edit mode
  users: any[] = []; // List of users for customer selection
  customerIDSearch: string = ''; // Customer ID search input

  // Product selection modal
  showProductModal: boolean = false;
  allProducts: any[] = []; // All products for selection
  filteredProducts: any[] = []; // Products filtered by category
  categories: string[] = []; // All categories
  selectedCategory: string = ''; // Selected category filter
  searchQuery: string = ''; // Search query for products

  // Popup state
  showPopup: boolean = false;
  popupMessage: string = '';
  popupType: 'success' | 'error' | 'info' = 'success';

  // Reject refund popup state
  showRejectRefundPopup: boolean = false;
  selectedRejectReason: string = '';
  showRejectReasonDropdown: boolean = false;
  dropdownPosition: { top: number; left: number; width: number } = { top: 0, left: 0, width: 0 };
  @ViewChild('rejectReasonDropdown', { static: false }) rejectReasonDropdownRef?: ElementRef;

  // Reject reason options
  rejectReasonOptions = [
    {
      value: 'invalid_reason',
      label: 'Lý do không hợp lệ (không thích/không hợp khẩu vị)',
    },
    {
      value: 'customer_damage',
      label: 'Hư hỏng do bảo quản sai từ phía khách hàng',
    },
    {
      value: 'no_proof',
      label: 'Không chứng minh được lỗi từ nhà bán hoặc vận chuyển',
    },
    {
      value: 'non_returnable',
      label: 'Sản phẩm thuộc nhóm không hỗ trợ trả hàng',
    },
  ];

  // Address data for delivery info
  provinces: any[] = [];
  districts: any[] = [];
  wards: any[] = [];
  selectedProvince: string = '';
  selectedDistrict: string = '';
  selectedWard: string = '';

  // Auto-reload interval for order status updates
  private statusCheckInterval: any = null;
  // Countdown interval for shipping status
  private shippingCountdownInterval: any = null;

  // Order data
  orderData = {
    id: '',
    date: '',
    customer: '',
    customerID: '', // Store CustomerID for saving order
    status: 'pending',
    delivery: 'pending',
    payment: 'unpaid',
    refund: 'none',
    items: [] as any[],
    subtotal: 0,
    discount: 0,
    shippingFee: 30000, // Default shipping fee
    shippingDiscount: 0, // Shipping discount from promotion
    shipping: 0, // Final shipping fee after discount
    total: 0,
    promotion: {
      name: '',
      code: '',
      description: '',
      value: 0,
      type: '',
    },
    customerInfo: {
      name: '',
      phone: '',
      email: '',
      address: '',
      totalOrders: 0,
      totalSpent: 0,
      debt: 0,
    },
    deliveryInfo: {
      name: '',
      phone: '',
      email: '',
      address: '',
      province: '',
      district: '',
      ward: '',
      streetAddress: '',
    },
    note: '',
    paymentMethod: 'COD',
  };

  ngOnInit(): void {
    // Check if we have a returnUrl from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || window.history.state;

    if (state?.['returnUrl']) {
      this.returnUrl = state['returnUrl'];
      console.log('Return URL set to:', this.returnUrl);

      // Set back button text and breadcrumb based on where we came from
      if (state?.['fromCustomerDetail']) {
        this.backButtonText = 'Quay lại hồ sơ khách hàng';
        this.breadcrumbText = 'Quản lý khách hàng';
      }
    }

    // Check if we are in edit mode
    if (state?.['editMode']) {
      this.isEditMode = true;
      console.log('Edit mode enabled');
    }

    this.route.params.subscribe((params) => {
      this.orderId = params['id'];
      this.isNewOrder = this.orderId === 'new';

      if (this.isNewOrder) {
        // Initialize empty order data for new order
        this.initNewOrder();
        this.loadProducts();
        this.loadUsers();
        this.loadAddressData();
        this.loadPromotions();
      } else {
        // Load existing order
        this.loadProducts();
        // If in edit mode, also load address data and users for editing
        if (this.isEditMode) {
          this.loadUsers();
          this.loadAddressData();
          this.loadPromotions();
        }
      }
    });
  }

  /**
   * Load products from MongoDB via API
   */
  loadProducts(): void {
    console.log('Loading products from MongoDB...');
    // Try MongoDB first
    this.apiService.getProducts().subscribe({
      next: (products) => {
        console.log(`✅ Loaded ${products.length} products from MongoDB`);
        // Create a map of products by _id for quick lookup
        products.forEach((product) => {
          this.productsMap.set(product._id, product);
        });
        console.log(`📦 Products map has ${this.productsMap.size} items`);

        // Now load promotions
        this.loadPromotions();
      },
      error: (error) => {
        console.error('❌ Error loading products from MongoDB:', error);
        console.log('⚠️ Falling back to JSON file...');
        // Fallback to JSON
        this.loadProductsFromJSON();
      },
    });
  }

  /**
   * Fallback: Load products from JSON file
   */
  private loadProductsFromJSON(): void {
    this.http.get<any[]>('data/product.json').subscribe({
      next: (products) => {
        console.log(`✅ Loaded ${products.length} products from JSON (fallback)`);
        products.forEach((product) => {
          this.productsMap.set(product._id, product);
        });
        this.loadPromotions();
      },
      error: (error) => {
        console.error('❌ Error loading products from JSON:', error);
        this.loadPromotions();
      },
    });
  }

  /**
   * Load promotions from promotions.json
   */
  loadPromotions(): void {
    this.apiService.getPromotions().subscribe({
      next: (promotions) => {
        // Create a map of promotions by promotion_id for quick lookup
        promotions.forEach((promo) => {
          this.promotionsMap.set(promo.promotion_id, promo);
        });

        // Filter active promotions that are currently running
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

        this.activePromotions = promotions.filter((promo) => {
          // Check status (case-insensitive, can be 'active' or 'Active')
          const status = (promo.promotion_status || promo.status || '').toLowerCase();
          if (status !== 'active') return false;

          // Check if promotion is within valid date range
          // Support both naming conventions: promotion_start_date/start_date
          const startDateStr = promo.promotion_start_date || promo.start_date;
          const endDateStr = promo.promotion_end_date || promo.end_date;

          if (startDateStr) {
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            if (today < startDate) return false; // Not started yet
          }

          if (endDateStr) {
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999); // End of day
            if (today > endDate) return false; // Already expired
          }

          return true;
        });

        console.log(
          `Loaded ${promotions.length} promotions, ${this.activePromotions.length} currently active`
        );

        // Now load order details
        this.loadOrderDetail();
      },
      error: (error) => {
        console.error('Error loading promotions from API:', error);
        // Fallback to JSON
        this.http.get<any[]>('data/promotion/promotions.json').subscribe({
          next: (promotions) => {
            promotions.forEach((promo) => {
              this.promotionsMap.set(promo.promotion_id, promo);
            });

            // Filter active promotions that are currently running
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day

            this.activePromotions = promotions.filter((promo) => {
              // Check status (case-insensitive)
              const status = (promo.promotion_status || promo.status || '').toLowerCase();
              if (status !== 'active') return false;

              // Check date range
              const startDateStr = promo.promotion_start_date || promo.start_date;
              const endDateStr = promo.promotion_end_date || promo.end_date;

              if (startDateStr) {
                const startDate = new Date(startDateStr);
                startDate.setHours(0, 0, 0, 0);
                if (today < startDate) return false;
              }

              if (endDateStr) {
                const endDate = new Date(endDateStr);
                endDate.setHours(23, 59, 59, 999);
                if (today > endDate) return false;
              }

              return true;
            });

            console.log(
              `Loaded ${promotions.length} promotions from JSON, ${this.activePromotions.length} currently active`
            );

            this.loadOrderDetail();
          },
          error: (err) => {
            console.error('Error loading promotions from JSON:', err);
            this.loadOrderDetail();
          },
        });
      },
    });
  }

  /**
   * Initialize new order
   */
  initNewOrder(): void {
    // Set current date
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // Initialize empty order data
    this.orderData = {
      id: 'VGNEW',
      date: formattedDate,
      customer: '',
      customerID: '',
      status: 'pending',
      delivery: 'pending',
      payment: 'unpaid',
      refund: 'none',
      items: [],
      subtotal: 0,
      discount: 0,
      shippingFee: 30000, // Default shipping fee
      shippingDiscount: 0, // Shipping discount from promotion
      shipping: 30000, // Final shipping fee after discount
      total: 0,
      promotion: {
        name: '',
        code: '',
        description: '',
        value: 0,
        type: '',
      },
      customerInfo: {
        name: '',
        phone: '',
        email: '',
        address: '',
        totalOrders: 0,
        totalSpent: 0,
        debt: 0,
      },
      deliveryInfo: {
        name: '',
        phone: '',
        email: '',
        address: '',
        province: '',
        district: '',
        ward: '',
        streetAddress: '',
      },
      note: '',
      paymentMethod: 'COD',
    };

    // Reset customer search
    this.customerIDSearch = '';

    this.backButtonText = 'Quay lại trang đơn hàng';
    this.breadcrumbText = 'Quản lý đơn hàng';
    console.log('✅ Initialized new order');
  }

  /**
   * Handle customer selection change
   */
  onCustomerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const customerName = select.value;

    if (customerName) {
      // Find user by name (support both formats)
      const user = this.users.find((u) => {
        const fullName = u.FullName || u.full_name || u.name || '';
        return fullName === customerName;
      });
      if (user) {
        this.selectCustomer(user);
      }
    } else {
      // Reset customer info
      this.orderData.customer = '';
      this.orderData.customerID = '';
      this.customerIDSearch = '';
      this.orderData.customerInfo = {
        name: '',
        phone: '',
        email: '',
        address: '',
        totalOrders: 0,
        totalSpent: 0,
        debt: 0,
      };
    }
  }

  /**
   * Load users for customer selection
   */
  loadUsers(): void {
    this.apiService.getUsers().subscribe({
      next: (users) => {
        console.log(`✅ Loaded ${users.length} users from MongoDB`);
        this.users = users;
      },
      error: (error) => {
        console.error('❌ Error loading users from MongoDB:', error);
        // Fallback to JSON
        this.http.get<any[]>('data/users.json').subscribe({
          next: (users) => {
            console.log(`✅ Loaded ${users.length} users from JSON (fallback)`);
            this.users = users;
          },
          error: (err) => {
            console.error('❌ Error loading users from JSON:', err);
          },
        });
      },
    });
  }

  /**
   * Load order detail from MongoDB
   */
  loadOrderDetail(): void {
    // Skip loading if this is a new order
    if (this.isNewOrder) {
      return;
    }

    console.log('🔄 Loading order detail from MongoDB...');
    console.log('Order ID:', this.orderId);

    // Try MongoDB API first
    this.apiService.getOrders().subscribe({
      next: (orders) => {
        console.log(`✅ Loaded ${orders.length} orders from MongoDB`);

        // Find order by OrderID or _id
        // Support both formats: VG123456 or ORD123456 or just the ID
        const orderIdClean = this.orderId.replace('VG', '').replace('ORD', '');
        this.order = orders.find((o: any) => {
          // Check OrderID field
          if (o.OrderID && o.OrderID.includes(orderIdClean)) {
            return true;
          }
          // Check _id field
          if (
            o._id &&
            (o._id.toString().includes(orderIdClean) || o._id.$oid?.includes(orderIdClean))
          ) {
            return true;
          }
          // Check order_id field (old format)
          if (o.order_id && o.order_id.toString() === orderIdClean) {
            return true;
          }
          return false;
        });

        if (this.order) {
          console.log('✅ Found order:', this.order);
          // If in edit mode, load address data first, then load users
          if (this.isEditMode) {
            // Load address data first, then load users
            this.loadAddressData();
            // Use setTimeout to wait for address data to be loaded
            setTimeout(() => {
              this.loadUsersForOrder();
            }, 500);
          } else {
            // Load users to get customer info
            this.loadUsersForOrder();
          }
        } else {
          console.warn('⚠️ Order not found in MongoDB, trying fallback...');
          this.loadFromOrdersJsonFallback();
        }
      },
      error: (error) => {
        console.error('❌ Error loading orders from MongoDB:', error);
        console.log('⚠️ Falling back to JSON file...');
        this.loadFromOrdersJsonFallback();
      },
    });
  }

  /**
   * Load users for order to get customer info and calculate statistics
   */
  private loadUsersForOrder(): void {
    this.apiService.getUsers().subscribe({
      next: (users) => {
        console.log(`✅ Loaded ${users.length} users from MongoDB`);
        this.users = users;

        // Calculate customer statistics from all orders, then transform
        this.calculateCustomerStatistics();
      },
      error: (error) => {
        console.error('❌ Error loading users from MongoDB:', error);
        // Still transform order even without users
        this.transformOrderDataFromMongoDB();
      },
    });
  }

  /**
   * Calculate customer statistics (total products, total spent from paid orders, debt from unpaid/delivering orders)
   */
  private calculateCustomerStatistics(): void {
    if (!this.order || !this.order.CustomerID) {
      // Transform without stats if no CustomerID
      this.transformOrderDataFromMongoDB();
      return;
    }

    // Load all orders to calculate statistics
    this.apiService.getOrders().subscribe({
      next: (allOrders) => {
        const customerId = this.order.CustomerID;

        // Filter orders for this customer
        const customerOrders = allOrders.filter((o: any) => o.CustomerID === customerId);

        console.log(
          `📊 Calculating stats for customer ${customerId}, found ${customerOrders.length} orders`
        );

        // Calculate total orders (number of orders, not products)
        const totalOrders = customerOrders.length;

        console.log(`📦 Total orders: ${totalOrders}`);

        // Calculate total spent from paid orders only
        // An order is considered PAID if:
        // - status = 'completed' hoặc 'delivered' → always paid (both are considered final completed status)
        // - status = 'shipping'/'processing'/'confirmed' → paid if NOT cod (non-COD already paid)
        const totalSpent = customerOrders.reduce((sum: number, o: any) => {
          const orderStatus = (o.status || '').toLowerCase();
          const paymentMethod = (o.paymentMethod || '').toLowerCase();
          const totalAmount = o.totalAmount || 0;

          // Skip cancelled and returned/refunded orders
          if (orderStatus === 'cancelled' || orderStatus === 'returned') {
            return sum;
          }

          // Check if order is paid
          let isPaid = false;

          if (orderStatus === 'completed' || orderStatus === 'delivered') {
            // Completed/delivered orders are always paid (both are considered final completed status)
            isPaid = true;
          } else if (
            orderStatus === 'shipping' ||
            orderStatus === 'processing' ||
            orderStatus === 'confirmed'
          ) {
            // These statuses: paid if NOT COD (non-COD paid before shipping)
            isPaid = paymentMethod !== 'cod' && paymentMethod !== '';
          }
          // pending, cancelled, returned orders are never paid

          if (isPaid) {
            console.log(
              `✅ Paid order: ${o.OrderID}, status: ${orderStatus}, paymentMethod: ${paymentMethod}, amount: ${totalAmount}`
            );
            return sum + totalAmount;
          }
          return sum;
        }, 0);

        console.log(`💰 Total spent (paid orders): ${totalSpent}`);

        // Calculate debt from unpaid orders
        // Debt includes orders that are:
        // - status = 'pending' (not confirmed yet) OR
        // - status = 'shipping'/'processing' AND paymentMethod = 'cod' (delivering COD, not paid yet) OR
        // - status = 'confirmed' AND paymentMethod = 'cod' (COD confirmed but not delivered/paid yet)
        // Note: Exclude cancelled/returned orders from debt calculation
        // Note: delivered orders are considered paid (goods delivered, payment received)
        const debt = customerOrders.reduce((sum: number, o: any) => {
          const orderStatus = (o.status || '').toLowerCase();
          const paymentMethod = (o.paymentMethod || '').toLowerCase();
          const totalAmount = o.totalAmount || 0;

          // Skip cancelled and returned/refunded orders
          if (orderStatus === 'cancelled' || orderStatus === 'returned') {
            return sum;
          }

          // Skip completed and delivered orders (these are paid)
          if (orderStatus === 'completed' || orderStatus === 'delivered') {
            return sum;
          }

          // Check if order is delivering (and COD unpaid)
          const isDelivering =
            (orderStatus === 'shipping' || orderStatus === 'processing') && paymentMethod === 'cod';

          // Check if order is unpaid
          const isUnpaid =
            orderStatus === 'pending' || (orderStatus === 'confirmed' && paymentMethod === 'cod');

          if (isDelivering || isUnpaid) {
            console.log(
              `❌ Unpaid/Delivering order: ${o.OrderID}, status: ${orderStatus}, paymentMethod: ${paymentMethod}, amount: ${totalAmount}`
            );
            return sum + totalAmount;
          }
          return sum;
        }, 0);

        console.log(`💳 Total debt (unpaid/delivering): ${debt}`);

        // Update user info if found
        const user = this.users.find((u: any) => u.CustomerID === customerId);
        if (user) {
          user.totalOrders = totalOrders; // Store total orders
          user.totalSpent = totalSpent;
          user.debt = debt;
        }

        // Store in orderData for display
        this.order.customerStats = {
          totalOrders: totalOrders, // Total number of orders
          totalSpent: totalSpent,
          debt: debt,
        };

        console.log(
          `✅ Final customer stats: ${totalOrders} orders, ${totalSpent} spent (paid), ${debt} debt`
        );

        // Transform after stats are calculated
        this.transformOrderDataFromMongoDB();
      },
      error: (error) => {
        console.error('❌ Error loading orders for statistics:', error);
        // Transform even if stats failed
        this.transformOrderDataFromMongoDB();
      },
    });
  }

  /**
   * Fallback: Load from temp folder JSON if MongoDB not available
   */
  private loadFromOrdersJsonFallback(): void {
    console.log('🔄 Loading from temp folder JSON...');
    this.http.get<any[]>('data/temp/orders.json').subscribe({
      next: (orders) => {
        console.log(`✅ Loaded ${orders.length} orders from temp JSON`);

        const orderIdClean = this.orderId.replace('VG', '').replace('ORD', '');
        this.order = orders.find((o: any) => {
          if (o.OrderID && o.OrderID.includes(orderIdClean)) {
            return true;
          }
          if (
            o._id &&
            (o._id.toString().includes(orderIdClean) || o._id.$oid?.includes(orderIdClean))
          ) {
            return true;
          }
          return false;
        });

        if (this.order) {
          console.log('✅ Found order in temp JSON:', this.order);
          // Load users from temp folder
          this.http.get<any[]>('data/temp/users.json').subscribe({
            next: (users) => {
              console.log(`✅ Loaded ${users.length} users from temp JSON`);
              this.users = users;
              this.transformOrderDataFromMongoDB();
            },
            error: (error) => {
              console.error('❌ Error loading users from temp JSON:', error);
              this.transformOrderDataFromMongoDB();
            },
          });
        } else {
          console.error('❌ Order not found in temp JSON');
        }
      },
      error: (error) => {
        console.error('❌ Error loading orders from temp JSON:', error);
      },
    });
  }

  /**
   * Transform order data from MongoDB format for display
   */
  transformOrderDataFromMongoDB(): void {
    if (!this.order) {
      console.error('No order data to transform');
      return;
    }

    console.log('🔄 Transforming order data from MongoDB format:', this.order);
    console.log('📝 Order cancelReason:', this.order.cancelReason);
    console.log('📝 Order returnReason:', this.order.returnReason);

    // Extract OrderID
    const orderId =
      this.order.OrderID || this.order._id?.$oid || this.order.order_id || this.orderId;
    this.orderData.id = orderId;

    // Format date from createdAt
    let formattedDate = '';
    if (this.order.createdAt) {
      const dateStr = this.order.createdAt.$date || this.order.createdAt;
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      }
    }
    if (!formattedDate && this.order.order_date) {
      const dateParts = this.order.order_date.split('-');
      formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    }
    this.orderData.date = formattedDate || 'N/A';

    // Map status from MongoDB format
    let status = 'pending';
    let delivery = 'pending';
    let payment = 'unpaid';
    let refund = 'none';

    const orderStatus = (this.order.status || '').toLowerCase();

    if (orderStatus === 'delivered') {
      // Status delivered: đơn hàng đã được giao
      status = 'confirmed';
      delivery = 'delivered';
      payment =
        this.order.paymentMethod === 'cod' ? 'paid' : this.order.paymentMethod ? 'paid' : 'unpaid';
      refund = 'none';
    } else if (orderStatus === 'completed') {
      // Status completed: đơn hàng đã hoàn thành (tương tự delivered)
      status = 'confirmed';
      delivery = 'delivered';
      payment =
        this.order.paymentMethod === 'cod' ? 'paid' : this.order.paymentMethod ? 'paid' : 'unpaid';
      refund = 'none';
    } else if (orderStatus === 'pending') {
      status = 'pending';
      delivery = 'pending';
      payment = 'unpaid';
      refund = 'none';
    } else if (orderStatus === 'cancelled') {
      status = 'cancelled';
      delivery = 'none';
      payment = 'unpaid';
      refund = 'none';
    } else if (orderStatus === 'processing_return' || orderStatus === 'returning') {
      // Đang xử lý hoàn trả / đang hoàn trả
      status = 'refund-requested';
      delivery = 'delivering';
      payment = this.order.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'requested';
    } else if (orderStatus === 'returned') {
      status = 'refunded';
      delivery = 'none';
      payment = 'unpaid';
      refund = 'refunded';
    } else if (orderStatus === 'processing') {
      status = 'confirmed';
      delivery = 'delivering';
      payment = this.order.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    } else if (orderStatus === 'shipping') {
      // Status shipping: đơn hàng đang được giao
      status = 'confirmed';
      delivery = 'delivering';
      payment = this.order.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    } else if (orderStatus === 'confirmed') {
      // Status confirmed: đơn hàng đã được xác nhận, chờ chuyển sang shipping (sau 1 phút)
      status = 'confirmed';
      delivery = 'pending'; // Chưa bắt đầu giao hàng, đang chờ chuyển sang shipping
      payment = this.order.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    }

    // Start/stop auto-reload interval based on order status
    this.setupStatusAutoReload(orderStatus);

    // Map items/products from MongoDB format
    let items: any[] = [];

    if (this.order.items && this.order.items.length > 0) {
      items = this.order.items.map((item: any) => {
        // Try to find product in productsMap by SKU or _id
        let productInfo = null;
        if (item.sku) {
          // Find by SKU
          for (const [key, product] of this.productsMap.entries()) {
            if (product.sku === item.sku || product.SKU === item.sku) {
              productInfo = product;
              break;
            }
          }
        }

        // Fallback: find by _id if available
        if (!productInfo && item._id) {
          productInfo = this.productsMap.get(item._id.$oid || item._id);
        }

        return {
          name: item.productName || item.product_name || item.name || 'Sản phẩm',
          sku: item.sku || 'N/A',
          image:
            item.image || productInfo?.image || productInfo?.Image?.[0] || '/asset/icons/image.png',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
          unit: item.unit || productInfo?.unit || '',
          category: item.category || productInfo?.category || '',
          subcategory: item.subcategory || productInfo?.subcategory || '',
          itemType: item.itemType || 'purchased', // Loại item: mua hoặc tặng kèm
        };
      });

      console.log('✅ Mapped products:', items.length, 'items');
    } else {
      console.warn('⚠️ No items found in order');
    }

    // Calculate subtotal from items
    const subtotal = this.order.subtotal || items.reduce((sum, item) => sum + item.total, 0);

    // Get promotion info and check scope
    let discount = this.order.discount || 0;
    let shippingDiscount = this.order.shippingDiscount || 0;
    let promotionInfo = {
      name: this.order.promotionName || '',
      code: this.order.code || '',
      description: '',
      value: discount || shippingDiscount,
      type: 'percentage',
    };

    // Check if promotion code exists and get promotion details to determine scope
    let promotionScope = null;
    if (this.order.code) {
      // Try to find promotion from promotionsMap by code
      for (const [key, promo] of this.promotionsMap.entries()) {
        const promoCode = promo.code || promo.promotion_code || '';
        if (promoCode.toLowerCase() === this.order.code.toLowerCase()) {
          promotionScope = (promo.scope || '').toLowerCase();
          promotionInfo = {
            name: promo.name || promo.promotion_name || this.order.promotionName || '',
            code: promoCode || this.order.code || '',
            description: promo.description || promo.promotion_description || '',
            value: promo.discount_value || promo.discountValue || promo.promotion_value || 0,
            type: promo.discount_type || promo.discountType || promo.promotion_type || '',
          };
          // If in edit mode, set selected promotion ID
          if (this.isEditMode) {
            this.selectedPromotionId = promo.promotion_id || key;
          }
          break;
        }
      }
    }

    // Apply logic: if scope = "shipping" → only shippingDiscount, no discount
    //              if scope = "order" or no promotion → only discount, no shippingDiscount
    if (promotionScope === 'shipping') {
      // Free ship voucher: only apply shippingDiscount, remove discount
      discount = 0;
      // shippingDiscount already set from order data
    } else {
      // Normal discount voucher or no promotion: only apply discount, remove shippingDiscount
      shippingDiscount = 0;
      // discount already set from order data
    }

    // Calculate shipping
    const shippingFee = this.order.shippingFee || 30000; // Default shipping fee
    const shipping = shippingFee - shippingDiscount;

    // Calculate total: Thành tiền = Tổng tiền hàng - Giảm giá + Phí vận chuyển (30000) - Giảm giá phí vận chuyển
    const vatAmount = this.order.vatAmount || 0;
    const total =
      this.order.totalAmount || subtotal - discount + shippingFee - shippingDiscount + vatAmount;

    // Get customer info from shippingInfo or users
    let customerName = '';
    let customerInfo = {
      name: '',
      phone: '',
      email: '',
      address: '',
      totalOrders: 0,
      totalSpent: 0,
      debt: 0,
    };

    // Try to find customer from users array - first by shippingInfo (more accurate), then by CustomerID
    let customerUser = null;
    let correctCustomerID = this.order.CustomerID;

    // If we have shippingInfo, try to find customer by name + phone for accuracy
    if (this.order.shippingInfo && this.users.length > 0) {
      const shippingName = (this.order.shippingInfo.fullName || '').trim();
      const shippingPhone = (this.order.shippingInfo.phone || '').trim();
      const shippingEmail = (this.order.shippingInfo.email || '').trim();

      // Priority 1: Find by name + phone (most accurate)
      if (shippingName && shippingPhone) {
        customerUser = this.users.find((u: any) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const phone = (u.Phone || u.phone || '').trim();
          return fullName === shippingName && phone === shippingPhone;
        });
      }

      // Priority 2: Find by name + email
      if (!customerUser && shippingName && shippingEmail) {
        customerUser = this.users.find((u: any) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const email = (u.Email || u.email || '').trim();
          return fullName === shippingName && email === shippingEmail;
        });
      }

      // Priority 3: Find by phone only
      if (!customerUser && shippingPhone) {
        customerUser = this.users.find((u: any) => {
          const phone = (u.Phone || u.phone || '').trim();
          return phone === shippingPhone;
        });
      }

      // Priority 4: Find by name only
      if (!customerUser && shippingName) {
        customerUser = this.users.find((u: any) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          return fullName === shippingName;
        });
      }

      // If found customer but CustomerID is different, update it
      if (customerUser && customerUser.CustomerID) {
        if (customerUser.CustomerID !== this.order.CustomerID) {
          console.log(`⚠️ Order ${this.order.OrderID}: CustomerID không khớp!`);
          console.log(`   Current: ${this.order.CustomerID}, Correct: ${customerUser.CustomerID}`);
          console.log(`   Customer: ${shippingName} (${shippingPhone})`);
          correctCustomerID = customerUser.CustomerID;
          // Update order in MongoDB with correct CustomerID (async, don't wait)
          this.updateOrderCustomerID(this.order.OrderID, correctCustomerID);
        }
      }
    }

    // If not found by shippingInfo, try by CustomerID
    if (!customerUser && this.order.CustomerID && this.users.length > 0) {
      customerUser = this.users.find((u: any) => u.CustomerID === this.order.CustomerID);
    }

    if (customerUser) {
      customerName = customerUser.FullName || customerUser.Email || correctCustomerID;
      customerInfo.name = customerUser.FullName || '';
      customerInfo.phone = customerUser.Phone || '';
      customerInfo.email = customerUser.Email || '';
      customerInfo.address = customerUser.Address || '';
      customerInfo.totalSpent = customerUser.TotalSpent || 0;

      // Update orderData.customerID with correct value
      this.orderData.customerID = correctCustomerID;
      this.order.CustomerID = correctCustomerID; // Update in-memory order object
    }

    // Override with shippingInfo if available (shippingInfo takes priority for display)
    if (this.order.shippingInfo) {
      customerInfo.name = this.order.shippingInfo.fullName || customerInfo.name;
      customerInfo.phone = this.order.shippingInfo.phone || customerInfo.phone;
      customerInfo.email = this.order.shippingInfo.email || customerInfo.email;

      // Build address from shippingInfo.address
      if (this.order.shippingInfo.address) {
        const addr = this.order.shippingInfo.address;
        const addressParts = [addr.detail, addr.ward, addr.district, addr.city].filter(Boolean);
        customerInfo.address = addressParts.join(', ');
      }

      if (!customerName) {
        customerName = customerInfo.name;
      }
    }

    if (!customerName) {
      customerName = 'Khách hàng #' + (correctCustomerID || 'N/A');
    }

    // Use calculated statistics if available, otherwise use user data
    if (this.order.customerStats) {
      customerInfo.totalOrders = this.order.customerStats.totalOrders || 0;
      customerInfo.totalSpent = this.order.customerStats.totalSpent || customerInfo.totalSpent;
      customerInfo.debt = this.order.customerStats.debt || 0;
    } else if (customerUser) {
      customerInfo.totalOrders = customerUser.totalOrders || 0;
      customerInfo.totalSpent = customerInfo.totalSpent || customerUser.TotalSpent || 0;
      // Calculate debt from current order if COD and unpaid
      if (
        this.order.paymentMethod === 'cod' &&
        this.order.status !== 'completed' &&
        this.order.status !== 'delivered' &&
        this.order.status !== 'paid'
      ) {
        customerInfo.debt = this.order.totalAmount || 0;
      }
    }

    // Get delivery info from shippingInfo
    const provinceName = this.order.shippingInfo?.address?.city || '';
    const districtName = this.order.shippingInfo?.address?.district || '';
    const wardName = this.order.shippingInfo?.address?.ward || '';

    const deliveryInfo = {
      name: this.order.shippingInfo?.fullName || customerInfo.name,
      phone: this.order.shippingInfo?.phone || customerInfo.phone,
      email: this.order.shippingInfo?.email || customerInfo.email,
      address: customerInfo.address,
      province: provinceName,
      district: districtName,
      ward: wardName,
      streetAddress: this.order.shippingInfo?.address?.detail || '',
    };

    // If in edit mode, set selected address values after address data is loaded
    // This will be called from setSelectedAddressValues() after address data loads

    // Set customerIDSearch to display CustomerID in the input field
    const finalCustomerID = correctCustomerID || this.order.CustomerID || '';
    if (finalCustomerID) {
      this.customerIDSearch = finalCustomerID;
      console.log(`✅ Set customerIDSearch to: ${finalCustomerID}`);
    }

    // Update orderData
    this.orderData = {
      id: orderId,
      date: formattedDate,
      customer: customerName,
      customerID: finalCustomerID,
      status: status,
      delivery: delivery,
      payment: payment,
      refund: refund,
      items: items,
      subtotal: subtotal,
      discount: discount,
      shippingFee: shippingFee,
      shippingDiscount: shippingDiscount,
      shipping: shipping,
      total: total,
      promotion: promotionInfo,
      customerInfo: customerInfo,
      deliveryInfo: deliveryInfo,
      note: this.order.shippingInfo?.notes || '',
      paymentMethod: this.order.paymentMethod || 'COD',
    };

    // Ensure returnReason and cancelReason are preserved in order object for display
    // Check multiple possible field names
    if (!this.order.returnReason) {
      this.order.returnReason = this.order.return_reason || this.order.returnReason || '';
    }
    if (!this.order.cancelReason) {
      this.order.cancelReason = this.order.cancel_reason || this.order.cancelReason || '';
    }

    console.log('📝 After transform - returnReason:', this.order.returnReason);
    console.log('📝 After transform - cancelReason:', this.order.cancelReason);

    console.log('✅ Order data transformed:', this.orderData);

    // If in edit mode, set selected promotion ID
    if (this.isEditMode && this.orderData.promotion.code) {
      // Find promotion by code
      for (const [key, promo] of this.promotionsMap.entries()) {
        const promoCode = promo.code || promo.promotion_code || '';
        if (promoCode.toLowerCase() === this.orderData.promotion.code.toLowerCase()) {
          this.selectedPromotionId = promo.promotion_id || key;
          break;
        }
      }
    }
  }

  /**
   * Transform order data for display (old format - kept for compatibility)
   */
  transformOrderData(): void {
    // Format date from YYYY-MM-DD to DD/MM/YYYY
    const dateParts = this.order.order_date.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    // Map status based on new structure
    let status = 'pending';
    let delivery = 'pending';
    let payment = 'unpaid';
    let refund = 'none';

    // Map status
    if (this.order.status === 'Delivered' || this.order.status === 'Completed') {
      // Both Delivered and Completed are considered the same final status
      status = 'confirmed';
      delivery = 'delivered';
      payment = 'paid';
    } else if (this.order.status === 'Pending') {
      status = 'pending';
      delivery = 'pending';
      payment = 'unpaid';
    } else if (
      this.order.status === 'Cancel Requested' ||
      this.order.status === 'Return Requested'
    ) {
      status = 'refund-requested';
      delivery = 'delivering';
      payment = this.order.order_total > 0 ? 'paid' : 'unpaid';
      refund = 'requested';
    } else if (this.order.status === 'Refunded') {
      status = 'refunded';
      delivery = 'none';
      payment = 'unpaid';
      refund = 'refunded';
    } else if (this.order.status === 'Cancelled by User') {
      status = 'cancelled';
      delivery = 'none';
      payment = 'unpaid';
      refund = 'none';
    } else if (this.order.status === 'Return Approved') {
      status = 'confirmed';
      delivery = 'delivered';
      payment = 'paid';
      refund = 'requested';
    } else if (this.order.status === 'Rejected') {
      status = 'confirmed';
      delivery = 'delivering';
      payment = 'paid';
      refund = 'none';
    }

    // Map products from order
    let items: any[] = [];

    if (this.order.products && this.order.products.length > 0) {
      // Use products from orderdetail.json and map with product.json for images
      items = this.order.products.map((product: any) => {
        // Try to find product in productsMap by product_id (which is _id in product.json)
        const productInfo = this.productsMap.get(product.product_id);

        return {
          name: product.product_name,
          sku: productInfo?.SKU ? 'SKU-' + productInfo.SKU : 'SKU-' + product.product_id,
          image: productInfo?.Image || '/asset/icons/image.png', // Use real image or fallback
          quantity: product.quantity,
          price: product.price,
          total: product.subtotal,
        };
      });

      console.log('Mapped products with images:', items);
    } else {
      // Fallback to sample data
      items = [
        {
          name: 'Tên sản phẩm',
          sku: 'SKU',
          image: '/asset/icons/image.png',
          quantity: 1,
          price: this.order.total_amount || this.order.order_total || 0,
          total: this.order.total_amount || this.order.order_total || 0,
        },
      ];
    }

    // Calculate subtotal from products
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    // Get promotion info and calculate discount
    let discount = 0;
    let shippingDiscount = 0;
    let promotionInfo = {
      name: '',
      code: '',
      description: '',
      value: 0,
      type: '',
    };

    if (this.order.promotion_id) {
      const promotion = this.promotionsMap.get(this.order.promotion_id);
      if (promotion) {
        promotionInfo = {
          name: promotion.promotion_name,
          code: promotion.promotion_name,
          description: promotion.description || '',
          value: promotion.promotion_value,
          type: promotion.promotion_type,
        };

        // Check promotion scope
        const promotionScope = (promotion.scope || '').toLowerCase();

        // Calculate discount based on promotion type and scope
        if (promotionScope === 'shipping') {
          // Free shipping voucher: only apply shippingDiscount
          shippingDiscount = Math.min(30000, promotion.promotion_value || 0);
          discount = 0;
        } else if (promotion.promotion_type === 'Discount') {
          // Discount is percentage
          discount = Math.floor((subtotal * promotion.promotion_value) / 100);
          shippingDiscount = 0;
        } else if (promotion.promotion_type === 'Shipping') {
          // Free shipping - will be handled in shipping calculation
          shippingDiscount = Math.min(30000, promotion.promotion_value || 0);
          discount = 0;
        } else {
          discount = 0;
          shippingDiscount = 0;
        }

        console.log(
          'Applied promotion:',
          promotionInfo,
          'Discount:',
          discount,
          'ShippingDiscount:',
          shippingDiscount
        );
      }
    }

    const shippingFee = 30000; // Default shipping fee
    const shipping = shippingFee - shippingDiscount;
    // Calculate total: Thành tiền = Tổng tiền hàng - Giảm giá + Phí vận chuyển (30000) - Giảm giá phí vận chuyển
    const total = subtotal - discount + shippingFee - shippingDiscount;

    // Set customerIDSearch to display CustomerID in the input field
    const finalCustomerID = this.order.CustomerID || this.order.user_id?.toString() || '';
    if (finalCustomerID) {
      this.customerIDSearch = finalCustomerID;
      console.log(`✅ Set customerIDSearch to: ${finalCustomerID}`);
    }

    this.orderData = {
      id: 'VG' + this.order.order_id,
      date: formattedDate,
      customer: this.order.full_name || 'Khách hàng #' + this.order.user_id,
      customerID: finalCustomerID,
      status: status,
      delivery: delivery,
      payment: payment,
      refund: refund,
      items: items,
      subtotal: subtotal,
      discount: discount,
      shippingFee: shippingFee,
      shippingDiscount: shippingDiscount,
      shipping: shipping,
      total: total,
      promotion: promotionInfo,
      customerInfo: {
        name: this.order.full_name || '',
        phone: this.order.phone || '',
        email: '',
        address: this.order.address || '',
        totalOrders: 0,
        totalSpent: 0,
        debt: 0,
      },
      deliveryInfo: {
        name: this.order.full_name || '',
        phone: this.order.phone || '',
        email: '',
        address: this.order.address || '',
        province: '',
        district: '',
        ward: '',
        streetAddress: '',
      },
      note: this.order.notes || '',
      paymentMethod: 'COD',
    };
  }

  /**
   * Go back to orders list
   */
  /**
   * Navigate to orders list page
   */
  navigateToOrders(): void {
    this.router.navigate(['/orders']);
  }

  goBack(): void {
    // If we have a returnUrl (from customer detail page), go back there
    // Otherwise, go back to orders list
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.router.navigate(['/orders']);
    }
  }

  /**
   * Print order
   */
  printOrder(): void {
    // Set print time
    const now = new Date();
    const printTime = now.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Set print time in footer
    const printTimeElement = document.getElementById('print-time-value');
    if (printTimeElement) {
      printTimeElement.textContent = printTime;
    }

    window.print();
  }

  /**
   * Get OrderID from order object or orderData
   */
  private getOrderID(): string {
    // Priority 1: Get from order.OrderID (MongoDB format: ORD123456789)
    if (this.order?.OrderID) {
      return this.order.OrderID;
    }

    // Priority 2: Get from orderData.id (format: VG123456 or ORD123456)
    if (this.orderData.id) {
      // Remove VG prefix if exists, keep ORD prefix
      return this.orderData.id.replace('VG', '');
    }

    // Priority 3: Get from route orderId (format: VG123456 or ORD123456 or just the ID)
    if (this.orderId && this.orderId !== 'new') {
      // Remove VG prefix if exists, keep ORD prefix
      return this.orderId.replace('VG', '');
    }

    return '';
  }

  /**
   * Confirm order
   */
  confirmOrder(): void {
    console.log('📦 Confirm order:', this.orderId);

    // Get OrderID from order object
    const orderID = this.getOrderID();

    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    console.log('📦 Updating order status to confirmed:', orderID);
    console.log('⏰ [Frontend] Order sẽ tự động chuyển sang "shipping" sau 1 phút');

    const startTime = new Date();
    const targetTime = new Date(startTime.getTime() + 1 * 60 * 1000);
    console.log(`   📅 Thời gian bắt đầu: ${startTime.toLocaleString('vi-VN')}`);
    console.log(
      `   🎯 Thời gian dự kiến chuyển sang shipping: ${targetTime.toLocaleString('vi-VN')}`
    );

    // Call API to update order status
    this.apiService.updateOrderStatus(orderID, 'confirmed').subscribe({
      next: (response) => {
        console.log('✅ Order status updated successfully:', response);

        // Start countdown in frontend console
        this.startShippingCountdown(orderID, targetTime);

        // Reload order data to get latest status from MongoDB
        this.loadOrderDetail();
        // Set flag to navigate after popup closes
        this.shouldNavigateAfterPopup = true;
        this.displayPopup('Đơn hàng đã được xác nhận!', 'success');
      },
      error: (error) => {
        console.error('❌ Error updating order status:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Confirm delivered - Xác nhận đã giao hàng
   * Chuyển từ shipping -> delivered
   */
  confirmDelivered(): void {
    console.log('📦 Confirm delivered:', this.orderId);

    // Get OrderID from order object
    const orderID = this.getOrderID();

    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    console.log('📦 Updating order status from shipping to delivered:', orderID);

    // Call API to update order status to delivered
    this.apiService.updateOrderStatus(orderID, 'delivered').subscribe({
      next: (response) => {
        console.log('✅ Order status updated to delivered successfully:', response);
        // Reload order data to get latest status from MongoDB
        this.loadOrderDetail();
        // Set flag to navigate after popup closes
        this.shouldNavigateAfterPopup = true;
        this.displayPopup('Đã xác nhận đơn hàng đã giao thành công!', 'success');
      },
      error: (error) => {
        console.error('❌ Error updating order status to delivered:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Confirm refund - Chấp nhận yêu cầu trả hàng (bước 1)
   * Chuyển từ processing_return -> returning
   */
  confirmRefund(): void {
    console.log('💰 Confirm refund (step 1):', this.orderId);

    // Get OrderID from order object
    const orderID = this.getOrderID();

    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    // Chuyển từ đang chờ xử lý -> đang trả hàng
    const nextStatus = 'returning';

    console.log(`💰 Updating order status to ${nextStatus}:`, orderID);

    // Call API to update order status
    this.apiService.updateOrderStatus(orderID, nextStatus as any).subscribe({
      next: (response) => {
        console.log(`✅ Order status updated to ${nextStatus}:`, response);
        // Reload order data to get latest status from MongoDB
        this.loadOrderDetail();
        // Set flag to navigate after popup closes
        this.shouldNavigateAfterPopup = true;
        this.displayPopup(
          'Đã chấp nhận yêu cầu trả hàng. Đơn hàng đang trong quá trình trả hàng.',
          'success'
        );
      },
      error: (error) => {
        console.error('❌ Error updating refund status:', error);
        const errorMessage =
          error.error?.message ||
          error.message ||
          'Có lỗi xảy ra khi cập nhật trạng thái hoàn tiền';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Complete return - Hoàn tất trả hàng/hoàn tiền (bước 2)
   * Chuyển từ returning -> returned
   */
  completeReturn(): void {
    console.log('✅ Complete return (step 2):', this.orderId);

    // Get OrderID from order object
    const orderID = this.getOrderID();

    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    // Chuyển từ đang trả hàng -> đã trả hàng/hoàn tiền
    const nextStatus = 'returned';

    console.log(`✅ Completing return, updating order status to ${nextStatus}:`, orderID);

    // Call API to update order status
    this.apiService.updateOrderStatus(orderID, nextStatus as any).subscribe({
      next: (response) => {
        console.log(`✅ Order status updated to ${nextStatus}:`, response);
        // Reload order data to get latest status from MongoDB
        this.loadOrderDetail();
        // Set flag to navigate after popup closes
        this.shouldNavigateAfterPopup = true;
        this.displayPopup(
          'Đã hoàn tất trả hàng/hoàn tiền! Đơn hàng đã được xử lý xong.',
          'success'
        );
      },
      error: (error) => {
        console.error('❌ Error completing return:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi hoàn tất trả hàng';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Reject refund - Từ chối yêu cầu trả hàng
   * Mở popup để chọn lý do từ chối
   */
  rejectRefund(): void {
    console.log('❌ Reject refund - Opening popup:', this.orderId);
    this.selectedRejectReason = '';
    this.showRejectRefundPopup = true;
  }

  /**
   * Close reject refund popup
   */
  closeRejectRefundPopup(): void {
    this.showRejectRefundPopup = false;
    this.selectedRejectReason = '';
    this.showRejectReasonDropdown = false;
  }

  /**
   * Toggle reject reason dropdown
   */
  toggleRejectReasonDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showRejectReasonDropdown = !this.showRejectReasonDropdown;

    if (this.showRejectReasonDropdown && this.rejectReasonDropdownRef) {
      // Calculate position relative to viewport
      setTimeout(() => {
        const element = this.rejectReasonDropdownRef?.nativeElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          this.dropdownPosition = {
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width,
          };
        }
      }, 0);
    }
  }

  /**
   * Select reject reason
   */
  selectRejectReason(value: string): void {
    this.selectedRejectReason = value;
    this.showRejectReasonDropdown = false;
  }

  /**
   * Get reject reason label by value
   */
  getRejectReasonLabel(value: string): string {
    const option = this.rejectReasonOptions.find((opt) => opt.value === value);
    return option ? option.label : '';
  }

  /**
   * Confirm reject refund - Thực sự từ chối yêu cầu trả hàng
   * Chuyển về trạng thái completed (đơn hàng đã hoàn thành)
   */
  confirmRejectRefund(): void {
    if (!this.selectedRejectReason || this.selectedRejectReason === '') {
      this.displayPopup('Vui lòng chọn lý do từ chối!', 'error');
      return;
    }

    console.log('❌ Confirm reject refund:', this.orderId, 'Reason:', this.selectedRejectReason);

    // Get OrderID from order object
    const orderID = this.getOrderID();

    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    // Khi từ chối yêu cầu trả hàng, chuyển về trạng thái completed
    // (đơn hàng vẫn được giữ, không hoàn trả)
    const nextStatus = 'completed';

    console.log(`❌ Rejecting refund, updating order status to ${nextStatus}:`, orderID);

    // Call API to update order status back to completed
    // TODO: Có thể cần thêm rejectReason vào API call nếu backend hỗ trợ
    this.apiService.updateOrderStatus(orderID, nextStatus).subscribe({
      next: (response) => {
        console.log(`✅ Order status updated to ${nextStatus} (refund rejected):`, response);
        // Close reject popup
        this.closeRejectRefundPopup();
        // Reload order data to get latest status from MongoDB
        this.loadOrderDetail();
        // Set flag to navigate after popup closes
        this.shouldNavigateAfterPopup = true;
        this.displayPopup('Đã từ chối yêu cầu trả hàng/hoàn tiền!', 'success');
      },
      error: (error) => {
        console.error('❌ Error rejecting refund:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi từ chối yêu cầu hoàn tiền';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Get status label
   */
  getStatusLabel(status: string): string {
    const labels: any = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      'refund-requested': 'Yêu cầu trả hàng/hoàn tiền',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
    };
    return labels[status] || status;
  }

  /**
   * Get delivery label
   */
  getDeliveryLabel(delivery: string): string {
    const labels: any = {
      pending: 'Chờ giao',
      delivering: 'Đang giao',
      delivered: 'Hoàn thành',
      none: '',
    };
    return labels[delivery] || delivery;
  }

  /**
   * Get payment label
   */
  getPaymentLabel(payment: string): string {
    const labels: any = {
      paid: 'Đã thanh toán',
      unpaid: 'Chưa thanh toán',
    };
    return labels[payment] || payment;
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
  }

  /**
   * Add product to order - Opens product selection modal
   */
  addProductToOrder(): void {
    console.log('Opening product selection modal');
    this.showProductModal = true;
    this.loadProductsForSelection();
  }

  /**
   * Load products for selection modal
   */
  loadProductsForSelection(): void {
    this.apiService.getProducts().subscribe({
      next: (products) => {
        console.log(`✅ Loaded ${products.length} products for selection`);
        this.allProducts = products;
        this.filterProducts();
        // After products are loaded, load categories (will use products as fallback if API fails)
        this.loadCategories();
      },
      error: (error) => {
        console.error('❌ Error loading products for selection:', error);
        // Fallback to productsMap if available
        this.allProducts = Array.from(this.productsMap.values());
        this.filterProducts();
        // Load categories with products available for fallback
        this.loadCategories();
      },
    });
  }

  /**
   * Load categories for filter
   */
  loadCategories(): void {
    this.apiService.getCategories().subscribe({
      next: (categories) => {
        console.log(`✅ Loaded ${categories.length} categories`);
        this.categories = categories;
      },
      error: (error) => {
        console.error('❌ Error loading categories:', error);
        // Extract categories from products
        const categorySet = new Set<string>();
        if (this.allProducts && this.allProducts.length > 0) {
          this.allProducts.forEach((product) => {
            if (product.category) {
              categorySet.add(product.category);
            }
          });
          this.categories = Array.from(categorySet).sort();
        }
      },
    });
  }

  /**
   * Filter products by category and search query
   */
  filterProducts(): void {
    if (!this.allProducts || this.allProducts.length === 0) {
      this.filteredProducts = [];
      return;
    }

    let filtered = [...this.allProducts];

    // Filter by category
    if (this.selectedCategory) {
      filtered = filtered.filter((p) => p.category === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const productName = (p.product_name || p.productName || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return productName.includes(query) || sku.includes(query);
      });
    }

    this.filteredProducts = filtered;
  }

  /**
   * Handle category filter change
   */
  onCategoryFilterChange(): void {
    this.filterProducts();
  }

  /**
   * Handle search query change
   */
  onSearchQueryChange(): void {
    this.filterProducts();
  }

  /**
   * Select product and add to order
   */
  selectProduct(product: any): void {
    console.log('Selected product:', product);

    // Map product data to order item format
    const productImage = product.Image?.[0] || product.image || '/asset/icons/shop.png';
    const productName = product.product_name || product.productName || 'Sản phẩm';
    const productSku = product.sku || 'SKU';
    const productPrice = product.price || product.ProductPrice || 0;

    // Store product reference in productsMap if not already there
    if (product._id && !this.productsMap.has(product._id)) {
      this.productsMap.set(product._id, product);
    }

    const orderItem = {
      name: productName,
      sku: productSku,
      image: productImage,
      quantity: 1,
      price: productPrice,
      total: productPrice,
      productId: product._id || null, // Store product ID for reference
      category: product.category || '',
      subcategory: product.subcategory || '',
    };

    // Add to order items
    this.orderData.items.push(orderItem);
    this.updateOrderSummary();

    // Close modal
    this.closeProductModal();
  }

  /**
   * Close product selection modal
   */
  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedCategory = '';
    this.searchQuery = '';
    this.filteredProducts = [];
  }

  /**
   * Remove product from order
   */
  removeProductFromOrder(index: number): void {
    this.orderData.items.splice(index, 1);
    this.updateOrderSummary();
  }

  /**
   * Update product quantity
   */
  updateProductQuantity(index: number, quantity: number): void {
    if (quantity < 1) return;
    this.orderData.items[index].quantity = quantity;
    this.orderData.items[index].total = this.orderData.items[index].price * quantity;
    this.updateOrderSummary();
  }

  /**
   * Update product price
   */
  updateProductPrice(index: number, price: number): void {
    if (price < 0) return;
    this.orderData.items[index].price = price;
    this.orderData.items[index].total = this.orderData.items[index].quantity * price;
    this.updateOrderSummary();
  }

  /**
   * Update order summary with promotion logic
   * - If promotion scope = "Shipping" → only apply shippingDiscount, no discount
   * - If promotion scope = "Order" → only apply discount, no shippingDiscount
   * Formula: Thành tiền = Tổng tiền hàng - Giảm giá + Phí vận chuyển (30000) - Giảm giá phí vận chuyển
   */
  updateOrderSummary(): void {
    // Calculate subtotal from items
    this.orderData.subtotal = this.orderData.items.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );

    // Get shipping fee (default 30000)
    const shippingFee = this.orderData.shippingFee || 30000;

    // Calculate discount and shipping discount based on promotion
    let discount = 0;
    let shippingDiscount = 0;

    if (this.selectedPromotionId && this.orderData.subtotal > 0) {
      const promotion = this.promotionsMap.get(this.selectedPromotionId);
      if (promotion) {
        const promotionScope = (promotion.scope || '').toLowerCase();
        const promoType = (promotion.promotion_type || promotion.discount_type || '').toLowerCase();
        const discountValue = promotion.promotion_value || promotion.discount_value || 0;

        this.orderData.promotion = {
          name: promotion.promotion_name || promotion.name || '',
          code: promotion.promotion_code || promotion.code || '',
          description: promotion.promotion_description || promotion.description || '',
          value: discountValue,
          type: promoType,
        };

        // Apply logic based on promotion scope
        if (promotionScope === 'shipping') {
          // Free ship voucher: only apply shippingDiscount, no discount
          shippingDiscount = Math.min(shippingFee, discountValue); // Cap at shipping fee
          discount = 0;

          console.log(
            `✅ Applied free ship voucher: ${
              promotion.code || promotion.promotion_code
            }, shippingDiscount: ${shippingDiscount}`
          );
        } else if (promotionScope === 'order') {
          // Normal discount voucher: only apply discount, no shippingDiscount
          if (promoType === 'percent' || promoType === 'percentage') {
            // Discount is percentage
            discount = Math.floor((this.orderData.subtotal * discountValue) / 100);

            // Apply max discount limit if exists
            if (
              promotion.max_discount_value !== undefined &&
              promotion.max_discount_value !== null
            ) {
              const maxDiscount = promotion.max_discount_value || 0;
              discount = Math.min(discount, maxDiscount);
            }
          } else if (promoType === 'fixed') {
            // Fixed discount amount
            discount = discountValue;
          }

          shippingDiscount = 0;

          console.log(
            `✅ Applied normal discount voucher: ${
              promotion.code || promotion.promotion_code
            }, discount: ${discount}`
          );
        } else {
          // Unknown scope or no scope: default behavior (apply as discount)
          if (promoType === 'percent' || promoType === 'percentage') {
            discount = Math.floor((this.orderData.subtotal * discountValue) / 100);
            if (
              promotion.max_discount_value !== undefined &&
              promotion.max_discount_value !== null
            ) {
              const maxDiscount = promotion.max_discount_value || 0;
              discount = Math.min(discount, maxDiscount);
            }
          } else if (promoType === 'fixed') {
            discount = discountValue;
          }
          shippingDiscount = 0;
        }
      } else {
        discount = 0;
        shippingDiscount = 0;
      }
    } else if (!this.selectedPromotionId) {
      // No promotion selected
      this.orderData.promotion = {
        name: '',
        code: '',
        description: '',
        value: 0,
        type: '',
      };
      discount = 0;
      shippingDiscount = 0;
    }

    // Update orderData
    this.orderData.discount = discount;
    this.orderData.shippingFee = shippingFee;
    this.orderData.shippingDiscount = shippingDiscount;

    // Calculate final shipping (shippingFee - shippingDiscount)
    const finalShipping = shippingFee - shippingDiscount;
    this.orderData.shipping = finalShipping;

    // Calculate total: Thành tiền = Tổng tiền hàng - Giảm giá + Phí vận chuyển (30000) - Giảm giá phí vận chuyển
    this.orderData.total = this.orderData.subtotal - discount + shippingFee - shippingDiscount;
  }

  /**
   * Handle promotion selection change
   */
  onPromotionChange(): void {
    if (this.selectedPromotionId) {
      // Promotion selected, calculate discount
      this.updateOrderSummary();
    } else {
      // No promotion selected
      this.orderData.promotion = {
        name: '',
        code: '',
        description: '',
        value: 0,
        type: '',
      };
      this.orderData.discount = 0;
      this.updateOrderSummary();
    }
  }

  /**
   * Get promotion display value for dropdown
   */
  getPromotionDisplayValue(promo: any): string {
    const promoType = (promo.promotion_type || promo.discount_type || '').toLowerCase();
    const discountValue = promo.promotion_value || promo.discount_value || 0;

    if (promoType === 'discount' || promoType === 'percent' || promoType === 'percentage') {
      return discountValue + '%';
    } else if (promoType === 'fixed') {
      return this.formatCurrency(discountValue);
    } else {
      // Default to percentage if type unknown
      return discountValue + '%';
    }
  }

  /**
   * Search customer by ID
   */
  searchCustomerById(): void {
    if (!this.customerIDSearch || !this.customerIDSearch.trim()) {
      return;
    }

    const searchId = this.customerIDSearch.trim();
    console.log('🔍 Searching for customer with ID:', searchId);

    // Try to find customer by CustomerID, user_id, or _id
    const user = this.users.find((u: any) => {
      // Match by CustomerID
      if (u.CustomerID && u.CustomerID.toString().toUpperCase() === searchId.toUpperCase()) {
        return true;
      }
      // Match by user_id
      if (u.user_id && u.user_id.toString() === searchId) {
        return true;
      }
      // Match by _id (MongoDB ObjectId)
      if (u._id) {
        const idStr = typeof u._id === 'object' && u._id.$oid ? u._id.$oid : u._id.toString();
        if (idStr === searchId || idStr.includes(searchId)) {
          return true;
        }
      }
      return false;
    });

    if (user) {
      console.log('✅ Found customer:', user);
      this.selectCustomer(user);
      // Update search field with the found CustomerID
      const customerID = user.CustomerID || '';
      if (customerID) {
        this.customerIDSearch = customerID;
      }
      this.displayPopup('Đã tìm thấy khách hàng!', 'success');
    } else {
      console.log('❌ Customer not found with ID:', searchId);
      this.displayPopup('Không tìm thấy khách hàng với ID này!', 'error');
    }
  }

  /**
   * Select customer
   */
  selectCustomer(user: any): void {
    // Get CustomerID
    let customerID = user.CustomerID;
    if (!customerID) {
      // Generate CustomerID from user_id if not available
      if (user.user_id) {
        customerID = 'CUS' + String(user.user_id).padStart(6, '0');
      } else if (user._id) {
        const idStr =
          typeof user._id === 'object' && user._id.$oid ? user._id.$oid : user._id.toString();
        customerID = 'CUS' + idStr.substring(0, 6).padStart(6, '0');
      }
    }

    this.orderData.customer =
      user.FullName || user.full_name || user.name || 'Khách hàng #' + (user.user_id || customerID);
    this.orderData.customerID = customerID || '';
    // Update customerIDSearch to show the current CustomerID
    if (customerID) {
      this.customerIDSearch = customerID;
    }
    this.orderData.customerInfo = {
      name: user.FullName || user.full_name || user.name || '',
      phone: user.Phone || user.phone || '',
      email: user.Email || user.email || '',
      address: user.Address || user.address || '',
      totalOrders: user.totalOrders || user.TotalSpent ? 1 : 0,
      totalSpent: user.TotalSpent || user.totalSpent || 0,
      debt: user.debt || 0,
    };
    // Copy to delivery info if empty
    if (!this.orderData.deliveryInfo.name) {
      this.orderData.deliveryInfo = {
        name: this.orderData.customerInfo.name,
        phone: this.orderData.customerInfo.phone,
        email: this.orderData.customerInfo.email,
        address: this.orderData.customerInfo.address,
        province: '',
        district: '',
        ward: '',
        streetAddress: '',
      };
    }
  }

  /**
   * Load Vietnam address data from JSON files ONLY (no MongoDB)
   */
  loadAddressData(): void {
    console.log('🔄 Loading address data from MongoDB tree_complete collection (63 tỉnh thành)...');

    // Load tree data from MongoDB API - giống address-form.ts
    this.http.get<any>('http://localhost:3000/api/tree_complete').subscribe({
      next: (treeData: any) => {
        console.log('✅ Loaded tree_complete from MongoDB API');

        // tree_complete từ MongoDB là array chứa một object với province codes làm keys
        // Lấy phần tử đầu tiên của array (object chứa tất cả provinces)
        const provincesObject = Array.isArray(treeData) ? treeData[0] : treeData;

        // Convert object structure to array structure for provinces (giống address-form.ts)
        // Filter out null/undefined provinces
        this.provinces = Object.values(provincesObject)
          .map((province: any) => {
            const districts: any[] = [];

            // Convert districts object to array
            if (province['quan-huyen']) {
              Object.values(province['quan-huyen']).forEach((district: any) => {
                const wards: any[] = [];

                // Convert wards object to array
                if (district['xa-phuong']) {
                  Object.values(district['xa-phuong']).forEach((ward: any) => {
                    // Only add ward if it has a valid name
                    if (ward && ward.name && ward.name.trim() !== '') {
                      wards.push({
                        id: ward.slug || ward.code || '',
                        code: ward.code || '',
                        name: ward.name || '',
                        fullName: ward.name_with_type || ward.name || '',
                        slug: ward.slug || '',
                      });
                    }
                  });
                }

                // Only add district if it has a valid name
                if (district && district.name && district.name.trim() !== '') {
                  districts.push({
                    id: district.slug || district.code || '',
                    code: district.code || '',
                    name: district.name || '',
                    fullName: district.name_with_type || district.name || '',
                    slug: district.slug || '',
                    type: district.type || '',
                    wards: wards.filter((w: any) => w && w.name && w.name.trim() !== ''), // Filter out empty wards
                  });
                }
              });
            }

            // Only return province if it has a valid name
            if (province && province.name && province.name.trim() !== '') {
              return {
                id: province.slug || province.code || '',
                code: province.code || '',
                name: province.name || '',
                fullName: province.name_with_type || province.name || '',
                slug: province.slug || '',
                type: province.type || 'province',
                districts: districts.filter((d: any) => d && d.name && d.name.trim() !== ''), // Filter out empty districts
              };
            }
            return null;
          })
          .filter((province: any) => province !== null); // Remove null provinces

        console.log(
          `✅ Mapped ${this.provinces.length} provinces with districts and wards from MongoDB tree_complete collection`
        );

        // Filter out provinces with empty or invalid names
        this.provinces = this.provinces.filter(
          (province) => province && province.name && province.name.trim() !== ''
        );

        // Sort provinces alphabetically
        this.provinces.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

        // Log summary
        const provincesWithDistricts = this.provinces.filter(
          (p: any) => p.districts && p.districts.length > 0
        ).length;
        const totalDistricts = this.provinces.reduce(
          (sum, p: any) => sum + (p.districts?.length || 0),
          0
        );
        const totalWards = this.provinces.reduce(
          (sum, p: any) =>
            sum +
            (p.districts?.reduce((dSum: number, d: any) => dSum + (d.wards?.length || 0), 0) || 0),
          0
        );

        console.log(
          `📊 Built ${provincesWithDistricts}/${this.provinces.length} provinces, ${totalDistricts} districts, ${totalWards} wards`
        );

        // Kiểm tra số lượng provinces - phải có 63 tỉnh thành
        if (this.provinces.length < 63) {
          console.warn(
            `⚠️ Chỉ có ${this.provinces.length} tỉnh thành được load, mong đợi 63 tỉnh thành!`
          );
        } else if (this.provinces.length === 63) {
          console.log('✅ Đã load đủ 63 tỉnh thành từ MongoDB tree_complete collection!');
        } else {
          console.log(`ℹ️ Đã load ${this.provinces.length} tỉnh thành (có thể nhiều hơn 63)`);
        }

        // If in edit mode and order is already loaded, set selected address values
        if (this.isEditMode && this.order && this.orderData.id) {
          setTimeout(() => {
            this.setSelectedAddressValues();
          }, 100);
        }
      },
      error: (error) => {
        console.error('❌ Error loading tree_complete from MongoDB:', error);
        // Fallback: try JSON file
        this.loadAddressDataFromJSON();
      },
    });
  }

  /**
   * Set selected address values for dropdowns in edit mode
   */
  setSelectedAddressValues(): void {
    if (!this.isEditMode || !this.orderData.deliveryInfo) {
      return;
    }

    const provinceName = this.orderData.deliveryInfo.province || '';
    const districtName = this.orderData.deliveryInfo.district || '';
    const wardName = this.orderData.deliveryInfo.ward || '';

    // Set selected province - tìm theo name, slug, code, hoặc id
    if (provinceName && this.provinces.length > 0) {
      const province = this.provinces.find(
        (p) =>
          p.name === provinceName ||
          p.fullName === provinceName ||
          p.slug === provinceName ||
          p.code === provinceName ||
          p.id === provinceName ||
          p.name.includes(provinceName) ||
          provinceName.includes(p.name)
      );

      if (province) {
        // Use slug as id for consistency with MongoDB (giống address-form.ts)
        this.selectedProvince = province.slug || province.id || province.code;
        this.onProvinceChange();

        // Set selected district
        if (districtName && this.districts.length > 0) {
          setTimeout(() => {
            const district = this.districts.find(
              (d) =>
                d.name === districtName ||
                d.fullName?.includes(districtName) ||
                d.slug === districtName ||
                d.code === districtName ||
                d.id === districtName ||
                districtName.includes(d.name)
            );

            if (district) {
              // Use slug as id for consistency with MongoDB (giống address-form.ts)
              this.selectedDistrict = district.slug || district.id || district.code;
              this.onDistrictChange();

              // Set selected ward
              if (wardName && this.wards.length > 0) {
                setTimeout(() => {
                  const ward = this.wards.find(
                    (w) =>
                      w.name === wardName ||
                      w.slug === wardName ||
                      w.code === wardName ||
                      w.id === wardName ||
                      (w.code && w.code === wardName) ||
                      wardName.includes(w.name)
                  );

                  if (ward) {
                    // Use slug as id for consistency with MongoDB (giống address-form.ts)
                    this.selectedWard = ward.slug || ward.id || ward.code || ward.name;
                  }
                }, 100);
              }
            }
          }, 100);
        }
      }
    }
  }

  /**
   * Fallback: Load address data from JSON files (more complete than MongoDB)
   */
  loadAddressDataFromJSON(): void {
    console.log('🔄 Loading address data from JSON files...');

    // Load provinces from JSON file
    this.http.get<any[]>('data/address/provinces.json').subscribe({
      next: (provincesData) => {
        console.log(`✅ Loaded ${provincesData.length} provinces from JSON file`);

        // Map provinces data
        this.provinces = provincesData
          .filter((p: any) => p && p.code && p.name)
          .map((p: any) => ({
            code: p.code,
            name: p.name,
            fullName: p.fullName || p.name,
            type: p.type || 'province',
            districts: [],
          }));

        console.log(`✅ Mapped ${this.provinces.length} valid provinces from JSON`);

        // Load wards from JSON file
        this.http.get<any[]>('data/address/wards.json').subscribe({
          next: (wardsData) => {
            console.log(`✅ Loaded ${wardsData.length} wards from JSON file`);
            this.buildDistrictsFromWardsOnly(wardsData);

            // Log summary
            const provincesWithDistricts = this.provinces.filter(
              (p: any) => p.districts && p.districts.length > 0
            ).length;
            console.log(
              `✅ Built ${this.provinces.length} provinces, ${provincesWithDistricts} with districts from JSON files`
            );
          },
          error: (error) => {
            console.error('❌ Error loading wards from JSON:', error);
            // Even if wards fail, we still have provinces
            console.log(`⚠️ Continuing with ${this.provinces.length} provinces without districts`);
          },
        });
      },
      error: (error) => {
        console.error('❌ Error loading provinces from JSON:', error);
        // Final fallback: Try tree collection
        this.loadAddressDataFromTree();
      },
    });
  }

  /**
   * Load wards from JSON file (when MongoDB wards fail)
   */
  loadWardsFromJSON(): void {
    console.log('🔄 Loading wards from JSON file...');

    this.http.get<any[]>('data/address/wards.json').subscribe({
      next: (wardsData) => {
        console.log(`✅ Loaded ${wardsData.length} wards from JSON file`);
        this.buildDistrictsFromWardsOnly(wardsData);

        // Log summary
        const provincesWithDistricts = this.provinces.filter(
          (p: any) => p.districts && p.districts.length > 0
        ).length;
        console.log(
          `✅ Built districts for ${provincesWithDistricts}/${this.provinces.length} provinces from JSON wards`
        );
      },
      error: (error) => {
        console.error('❌ Error loading wards from JSON:', error);
        console.log(`⚠️ Continuing with ${this.provinces.length} provinces without districts`);
      },
    });
  }

  /**
   * Fallback: Load address data from tree collection
   */
  loadAddressDataFromTree(): void {
    console.log('🔄 Trying to load from tree collection...');

    this.apiService.getTree().subscribe({
      next: (treeData) => {
        console.log(
          `✅ Loaded ${treeData ? treeData.length : 0} provinces from MongoDB tree collection`
        );

        if (!treeData || !Array.isArray(treeData) || treeData.length === 0) {
          console.warn('⚠️ Tree collection is empty or invalid, falling back to sample data');
          this.loadSampleAddressData();
          return;
        }

        // Process tree data to build provinces with districts and wards
        this.provinces = treeData
          .filter((p) => p && p.code && p.name) // Filter invalid provinces
          .map((province) => {
            const districts: any[] = [];

            // If province has districts directly
            if (
              province.districts &&
              Array.isArray(province.districts) &&
              province.districts.length > 0
            ) {
              province.districts.forEach((district: any) => {
                districts.push({
                  code: district.code || `${province.code}-${district.name?.replace(/\s+/g, '-')}`,
                  name: district.name,
                  fullName: district.fullName || `${district.name}, ${province.name}`,
                  wards: (district.wards || []).map((w: any) => ({
                    code: w.code || '',
                    name: w.name || w,
                    fullName: w.fullName || w,
                  })),
                });
              });
            } else if (
              province.wards &&
              Array.isArray(province.wards) &&
              province.wards.length > 0
            ) {
              // Province has wards directly - extract/create districts from wards
              this.buildDistrictsFromProvinceWards(province, districts);
            }

            return {
              code: province.code,
              name: province.name,
              fullName: province.fullName || province.name,
              type: province.type || 'province',
              districts: districts,
            };
          });

        if (this.provinces.length === 0) {
          console.warn('⚠️ No valid provinces found in tree data, falling back to sample data');
          this.loadSampleAddressData();
          return;
        }

        console.log(
          `✅ Built ${this.provinces.length} provinces with districts and wards from MongoDB tree`
        );

        // Log sample provinces
        if (this.provinces.length > 0) {
          console.log(
            '📋 Sample provinces from tree:',
            this.provinces.slice(0, 5).map((p) => `${p.code}: ${p.name}`)
          );
        }
      },
      error: (error) => {
        console.error('❌ Error loading tree from MongoDB:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        // Final fallback: Sample data
        console.log('⚠️ Falling back to sample address data');
        this.loadSampleAddressData();
      },
    });
  }

  /**
   * Build districts from wards for a specific province
   */
  buildDistrictsFromWardsForProvince(province: any, provinceWards: any[], districts: any[]): void {
    // Group wards by extracting district name from fullName
    const wardGroups = new Map<string, any[]>();

    provinceWards.forEach((ward) => {
      const fullNameParts = ward.fullName?.split(',') || [];
      let districtKey = province.name; // Default: use province as district

      // If fullName has 3 parts: "Phường X, Quận Y, Province"
      if (fullNameParts.length >= 3) {
        const districtPart = fullNameParts[fullNameParts.length - 2].trim();
        // Extract district name, remove "Quận", "Huyện", "Thị xã" prefix
        districtKey = districtPart.replace(/^(Quận|Huyện|Thị xã|Thị trấn)\s*/i, '').trim();
      }

      if (!wardGroups.has(districtKey)) {
        wardGroups.set(districtKey, []);
      }

      wardGroups.get(districtKey)!.push({
        code: ward.code || '',
        name: ward.name || ward,
        fullName: ward.fullName || ward,
      });
    });

    // Create districts from grouped wards
    wardGroups.forEach((wards, districtName) => {
      districts.push({
        code: `${province.code}-${districtName.replace(/\s+/g, '-').toLowerCase()}`,
        name: districtName,
        fullName:
          districtName === province.name ? province.fullName : `${districtName}, ${province.name}`,
        wards: wards,
      });
    });
  }

  /**
   * Build districts from province.wards directly
   */
  buildDistrictsFromProvinceWards(province: any, districts: any[]): void {
    const wardGroups = new Map<string, any[]>();

    province.wards.forEach((ward: any) => {
      if (!ward || !ward.fullName) {
        return;
      }

      const fullNameParts = ward.fullName.split(',').map((p: string) => p.trim());
      let districtName = '';

      if (fullNameParts.length >= 3) {
        // Has district: "Phường X, Quận/Huyện Y, Province"
        districtName = fullNameParts[fullNameParts.length - 2];

        // Check if this is actually a district
        if (/^(Quận|Huyện|Thị xã|Thị trấn)\s+/i.test(districtName)) {
          districtName = districtName.replace(/^(Quận|Huyện|Thị xã|Thị trấn)\s*/i, '').trim();
        } else if (districtName === province.name || districtName === province.fullName) {
          // No district info
          districtName = 'Không xác định';
        }
      } else if (fullNameParts.length === 2) {
        // No district in fullName
        districtName = 'Không xác định';
      } else {
        // Invalid format
        return;
      }

      // Validate district name
      if (!districtName || districtName === province.name) {
        districtName = 'Không xác định';
      }

      if (!wardGroups.has(districtName)) {
        wardGroups.set(districtName, []);
      }

      wardGroups.get(districtName)!.push({
        code: ward.code || '',
        name: ward.name || ward,
        fullName: ward.fullName || ward,
      });
    });

    wardGroups.forEach((wards, districtName) => {
      // Skip if district name is province name (invalid)
      if (districtName === province.name) {
        return;
      }

      districts.push({
        code: `${province.code}-${districtName.replace(/\s+/g, '-').toLowerCase()}`,
        name: districtName,
        fullName:
          districtName === province.name ? province.fullName : `${districtName}, ${province.name}`,
        wards: wards,
      });
    });
  }

  /**
   * Build districts from wards data
   * Use tree.json structure or extract from wards.json
   */
  buildDistrictsFromWards(wardsData: any[]): void {
    // Use tree.json which has the full hierarchical structure (provinces -> wards)
    this.http.get<any[]>('data/address/tree.json').subscribe({
      next: (treeData) => {
        // Process tree data: provinces contain wards, need to extract/create districts
        this.provinces = treeData.map((province) => {
          const districts: any[] = [];

          // If province has districts directly in tree.json
          if (
            province.districts &&
            Array.isArray(province.districts) &&
            province.districts.length > 0
          ) {
            province.districts.forEach((district: any) => {
              districts.push({
                code: district.code || `${province.code}-${district.name?.replace(/\s+/g, '-')}`,
                name: district.name,
                fullName: district.fullName || `${district.name}, ${province.name}`,
                wards: (district.wards || []).map((w: any) => ({
                  code: w.code || '',
                  name: w.name || w,
                  fullName: w.fullName || w,
                })),
              });
            });
          } else if (province.wards && Array.isArray(province.wards) && province.wards.length > 0) {
            // Province has wards directly - need to extract/create districts
            // Group wards to create districts (since districts are not in the data)
            // For now, create one default district per province, or extract from fullName if possible
            const districtWardsMap = new Map<string, any[]>();

            province.wards.forEach((ward: any) => {
              // Try to extract district from fullName format: "Phường X, Quận Y, Province" or "Phường X, Province"
              const fullNameParts = ward.fullName?.split(',') || [];
              let districtKey = province.name; // Default: use province as district

              // If fullName has 3 parts: "Phường X, Quận Y, Province"
              if (fullNameParts.length >= 3) {
                const districtPart = fullNameParts[fullNameParts.length - 2].trim();
                // Extract district name, remove "Quận", "Huyện", "Thị xã" prefix
                districtKey = districtPart.replace(/^(Quận|Huyện|Thị xã|Thị trấn)\s*/i, '').trim();
              }

              if (!districtWardsMap.has(districtKey)) {
                districtWardsMap.set(districtKey, []);
              }

              districtWardsMap.get(districtKey)!.push({
                code: ward.code || '',
                name: ward.name || ward,
                fullName: ward.fullName || ward,
              });
            });

            // Create districts from grouped wards
            districtWardsMap.forEach((wards, districtName) => {
              districts.push({
                code: `${province.code}-${districtName.replace(/\s+/g, '-').toLowerCase()}`,
                name: districtName,
                fullName:
                  districtName === province.name
                    ? province.fullName
                    : `${districtName}, ${province.name}`,
                wards: wards,
              });
            });
          }

          return {
            code: province.code,
            name: province.name,
            fullName: province.fullName,
            type: province.type,
            districts: districts.length > 0 ? districts : [],
          };
        });

        console.log(
          `✅ Built ${this.provinces.length} provinces with districts and wards from tree.json`
        );
      },
      error: (error) => {
        console.error('❌ Error loading tree.json:', error);
        // Fallback: Build districts and wards from wards.json directly
        this.buildDistrictsFromWardsOnly(wardsData);
      },
    });
  }

  /**
   * Fallback: Build districts from wards only (when tree.json unavailable)
   */
  buildDistrictsFromWardsOnly(wardsData: any[]): void {
    if (!wardsData || wardsData.length === 0) {
      console.warn('⚠️ No wards data provided to buildDistrictsFromWardsOnly');
      return;
    }

    console.log(
      `🔄 Building districts from ${wardsData.length} wards for ${this.provinces.length} provinces...`
    );

    let totalDistricts = 0;
    let totalWards = 0;

    // Group wards by province
    this.provinces.forEach((province) => {
      // Find wards for this province
      // Try both provinceCode (string) and code (could be number)
      const provinceWards = wardsData.filter((w) => {
        if (!w) return false;
        return (
          w.provinceCode === province.code ||
          w.provinceCode === String(province.code) ||
          w.code?.startsWith(province.code)
        );
      });

      if (provinceWards.length === 0) {
        console.log(`⚠️ No wards found for province ${province.code} (${province.name})`);
        province.districts = [];
        return;
      }

      console.log(
        `📍 Province ${province.name} (${province.code}): found ${provinceWards.length} wards`
      );

      // Group wards by extracting district name from fullName
      const wardGroups = new Map<string, any[]>();

      provinceWards.forEach((ward) => {
        if (!ward || !ward.fullName) {
          // Skip invalid wards
          return;
        }

        const fullNameParts = ward.fullName.split(',').map((p: string) => p.trim());
        let districtName = '';

        if (fullNameParts.length >= 3) {
          // Has district: "Phường X, Quận/Huyện Y, Province"
          // District is the middle part (second from last)
          districtName = fullNameParts[fullNameParts.length - 2];

          // Check if this is actually a district (has "Quận", "Huyện", "Thị xã", "Thị trấn")
          if (/^(Quận|Huyện|Thị xã|Thị trấn)\s+/i.test(districtName)) {
            // Remove "Quận", "Huyện", "Thị xã", "Thị trấn" prefix
            districtName = districtName.replace(/^(Quận|Huyện|Thị xã|Thị trấn)\s*/i, '').trim();
          } else {
            // If middle part doesn't look like a district, check if it's a province name
            // If it matches province name, then there's no district info
            if (districtName === province.name || districtName === province.fullName) {
              // No district in fullName format - create a default district
              districtName = 'Không xác định';
            }
          }
        } else if (fullNameParts.length === 2) {
          // Format: "Phường X, Province" - no district info
          // For provinces without district structure, use province name as district
          // This will create a single district containing all wards
          districtName = province.fullName;
        } else {
          // Invalid format, skip
          console.warn(`⚠️ Invalid ward fullName format: ${ward.fullName}`);
          return;
        }

        // Skip if district name is empty or matches province name (invalid)
        if (!districtName) {
          districtName = province.fullName;
        }

        if (!wardGroups.has(districtName)) {
          wardGroups.set(districtName, []);
        }

        wardGroups.get(districtName)!.push({
          code: ward.code || '',
          name: ward.name || '',
          fullName: ward.fullName || '',
        });
      });

      // Create districts
      const districts: any[] = [];
      wardGroups.forEach((wards, districtName) => {
        // Skip if district name is empty
        if (!districtName || districtName.trim() === '') {
          console.warn(`⚠️ Skipping empty district for province ${province.name}`);
          return;
        }

        // If district name is province fullName, this is a single district for all wards (no sub-districts)
        // Use a generic name like "Tất cả" (All) for display
        const displayName =
          districtName === province.fullName || districtName === province.name
            ? 'Tất cả'
            : districtName;

        districts.push({
          code: `${province.code}-${districtName.replace(/\s+/g, '-').toLowerCase()}`,
          name: displayName,
          fullName: `${districtName}, ${province.name}`,
          wards: wards,
        });
        totalWards += wards.length;
      });

      province.districts = districts;
      totalDistricts += districts.length;

      // Log districts created for this province (first 5 provinces only to avoid spam)
      if (totalDistricts <= 5) {
        console.log(
          `  ✅ Created ${districts.length} district(s) for ${province.name}:`,
          districts.map((d: any) => `${d.name} (${d.wards.length} wards)`).join(', ')
        );
      }
    });

    console.log(`✅ Built ${totalDistricts} districts with ${totalWards} wards from wards data`);

    // Log summary per province
    const provincesWithDistricts = this.provinces.filter(
      (p) => p.districts && p.districts.length > 0
    );
    console.log(
      `📊 ${provincesWithDistricts.length}/${this.provinces.length} provinces have districts`
    );

    if (provincesWithDistricts.length < this.provinces.length) {
      const provincesWithoutDistricts = this.provinces.filter(
        (p) => !p.districts || p.districts.length === 0
      );
      console.log(
        `⚠️ Provinces without districts: ${provincesWithoutDistricts.map((p) => p.name).join(', ')}`
      );
    }
  }

  /**
   * Fallback: Load sample address data
   */
  loadSampleAddressData(): void {
    // Sample data for major cities and provinces in Vietnam
    this.provinces = [
      {
        code: '01',
        name: 'Hà Nội',
        fullName: 'Thành phố Hà Nội',
        districts: [
          {
            code: '01-001',
            name: 'Ba Đình',
            wards: [
              { code: '00013', name: 'Hà Đông', fullName: 'Phường Hà Đông' },
              { code: '00044', name: 'Tương Mai', fullName: 'Phường Tương Mai' },
            ],
          },
        ],
      },
    ];
  }

  /**
   * Handle province selection change
   */
  onProvinceChange(): void {
    console.log('🔄 Province changed:', this.selectedProvince);
    this.orderData.deliveryInfo.province = this.selectedProvince;
    // Find province by code, slug, or id - giống address-form.ts
    const province = this.provinces.find(
      (p) =>
        p.code === this.selectedProvince ||
        p.slug === this.selectedProvince ||
        p.id === this.selectedProvince
    );

    console.log(
      '📍 Selected province:',
      province ? { code: province.code, slug: province.slug, name: province.name } : 'Not found'
    );

    if (province && province.districts && province.districts.length > 0) {
      console.log(`📊 Province ${province.name} has ${province.districts.length} districts`);

      // Use all districts (no filtering needed as they are now properly created)
      this.districts = province.districts.filter((d: any) => d && d.name && d.name.trim() !== '');
      // Sort districts alphabetically
      this.districts.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

      console.log(`✅ Loaded ${this.districts.length} districts`);
      console.log(
        '📍 Districts:',
        this.districts.map((d: any) => d.name)
      );
    } else {
      console.warn(
        '⚠️ Province has no districts:',
        province
          ? {
              code: province.code,
              slug: province.slug,
              name: province.name,
              hasDistricts: province.districts?.length || 0,
            }
          : 'Province not found'
      );
      this.districts = [];
    }

    this.wards = [];
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.orderData.deliveryInfo.district = '';
    this.orderData.deliveryInfo.ward = '';
    this.orderData.deliveryInfo.province = province ? province.name : '';
  }

  /**
   * Handle district selection change
   */
  onDistrictChange(): void {
    console.log('🔄 District changed:', this.selectedDistrict);
    this.orderData.deliveryInfo.district = this.selectedDistrict;
    // Find district by code, slug, or id - giống address-form.ts
    const district = this.districts.find(
      (d) =>
        d.code === this.selectedDistrict ||
        d.slug === this.selectedDistrict ||
        d.id === this.selectedDistrict
    );

    console.log(
      '📍 Found district:',
      district
        ? {
            code: district.code,
            slug: district.slug,
            name: district.name,
            wardsCount: district.wards?.length || 0,
          }
        : 'Not found'
    );

    if (district && district.wards) {
      // Wards can be array of strings or array of objects
      this.wards = district.wards
        .map((ward: any) => {
          if (typeof ward === 'string') {
            return { code: '', name: ward, fullName: ward, id: ward, slug: '' };
          }
          return ward;
        })
        .filter((ward: any) => ward && ward.name && ward.name.trim() !== ''); // Filter out empty wards
      // Sort wards alphabetically
      this.wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      console.log(`✅ Loaded ${this.wards.length} wards for district ${district.name}`);
    } else {
      this.wards = [];
      console.warn('⚠️ No wards found for district');
    }
    this.selectedWard = '';
    this.orderData.deliveryInfo.ward = '';
  }

  /**
   * Handle ward selection change
   */
  onWardChange(): void {
    this.orderData.deliveryInfo.ward = this.selectedWard;
    // Find ward by code, slug, id, or name - giống address-form.ts
    const ward = this.wards.find(
      (w) =>
        w.code === this.selectedWard ||
        w.slug === this.selectedWard ||
        w.id === this.selectedWard ||
        w.name === this.selectedWard
    );
    if (ward) {
      this.orderData.deliveryInfo.ward = ward.name || ward;
    }
  }

  // Flag to determine if we should navigate after popup closes
  shouldNavigateAfterPopup: boolean = false;

  /**
   * Display popup notification
   */
  displayPopup(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  /**
   * Save new order
   */
  saveNewOrder(): void {
    // Validate required fields
    if (!this.orderData.customerInfo.name) {
      this.displayPopup('Vui lòng chọn khách hàng', 'error');
      return;
    }

    if (this.orderData.items.length === 0) {
      this.displayPopup('Vui lòng thêm ít nhất một sản phẩm vào đơn hàng', 'error');
      return;
    }

    // Validate delivery info
    if (!this.orderData.deliveryInfo.name || !this.orderData.deliveryInfo.phone) {
      this.displayPopup('Vui lòng nhập đầy đủ thông tin người nhận', 'error');
      return;
    }

    if (
      !this.orderData.deliveryInfo.province ||
      !this.orderData.deliveryInfo.district ||
      !this.orderData.deliveryInfo.ward ||
      !this.orderData.deliveryInfo.streetAddress
    ) {
      this.displayPopup('Vui lòng nhập đầy đủ địa chỉ giao hàng', 'error');
      return;
    }

    // Get CustomerID - first try from orderData.customerID (set when selecting customer)
    let customerID = this.orderData.customerID;

    if (!customerID) {
      // Find customer by multiple criteria for better accuracy
      // Priority: 1. Name + Phone, 2. Name + Email, 3. Name only, 4. Phone only, 5. Email only
      const customerName = this.orderData.customerInfo.name || '';
      const customerPhone = this.orderData.customerInfo.phone || '';
      const customerEmail = this.orderData.customerInfo.email || '';

      let customer = null;

      // Try to find by name + phone first (most accurate)
      if (customerName && customerPhone) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const phone = (u.Phone || u.phone || '').trim();
          return fullName === customerName && phone === customerPhone;
        });
      }

      // If not found, try name + email
      if (!customer && customerName && customerEmail) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const email = (u.Email || u.email || '').trim();
          return fullName === customerName && email === customerEmail;
        });
      }

      // If not found, try phone only
      if (!customer && customerPhone) {
        customer = this.users.find((u) => {
          const phone = (u.Phone || u.phone || '').trim();
          return phone === customerPhone;
        });
      }

      // If not found, try email only
      if (!customer && customerEmail) {
        customer = this.users.find((u) => {
          const email = (u.Email || u.email || '').trim();
          return email === customerEmail;
        });
      }

      // If still not found, try name only (last resort)
      if (!customer && customerName) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          return fullName === customerName;
        });
      }

      if (!customer) {
        this.displayPopup(
          'Không tìm thấy khách hàng với thông tin đã nhập. Vui lòng chọn lại khách hàng từ danh sách.',
          'error'
        );
        return;
      }

      // Get CustomerID from customer
      customerID = customer.CustomerID;
      if (!customerID) {
        // Generate CustomerID from user_id if not available
        if (customer.user_id) {
          customerID = 'CUS' + String(customer.user_id).padStart(6, '0');
        } else if (customer._id) {
          const idStr = customer._id.toString();
          customerID = 'CUS' + idStr.substring(0, 6).padStart(6, '0');
        } else {
          this.displayPopup('Không thể xác định ID khách hàng', 'error');
          return;
        }
      }

      // Update orderData.customerID for future use
      this.orderData.customerID = customerID;
      console.log(`✅ Found customer: ${customerName} -> CustomerID: ${customerID}`);
    }

    // Transform orderData to MongoDB format
    // Ensure all address fields are strings (not empty)
    const city = String(this.orderData.deliveryInfo.province || '').trim();
    const district = String(this.orderData.deliveryInfo.district || '').trim();
    const ward = String(this.orderData.deliveryInfo.ward || '').trim();
    const detail = String(this.orderData.deliveryInfo.streetAddress || '').trim();

    if (!city || !district || !ward || !detail) {
      this.displayPopup('Địa chỉ giao hàng không hợp lệ! Vui lòng kiểm tra lại.', 'error');
      return;
    }

    const orderPayload = {
      CustomerID: customerID,
      shippingInfo: {
        fullName: String(this.orderData.deliveryInfo.name || '').trim(),
        phone: String(this.orderData.deliveryInfo.phone || '').trim(),
        email: String(this.orderData.deliveryInfo.email || '').trim(),
        address: {
          city: city,
          district: district,
          ward: ward,
          detail: detail,
        },
        deliveryMethod: 'standard',
        warehouseAddress: '',
        notes: String(this.orderData.note || '').trim(),
      },
      items: this.orderData.items.map((item: any) => {
        // Use category and subcategory from item if available, otherwise try to find from productsMap
        let category = item.category || '';
        let subcategory = item.subcategory || '';

        if ((!category || !subcategory) && item.sku) {
          // Find product by SKU
          for (const [key, product] of this.productsMap.entries()) {
            if (product.sku === item.sku || product.SKU === item.sku) {
              category = category || product.category || '';
              subcategory = subcategory || product.subcategory || '';
              break;
            }
          }
        }

        // Handle image field - convert array to string if needed
        let imageValue = '';
        if (item.image) {
          if (Array.isArray(item.image)) {
            // If image is array, take first element
            imageValue = item.image[0] || '';
          } else {
            imageValue = String(item.image);
          }
        }

        return {
          sku: item.sku || '',
          productName: item.name || '',
          quantity: item.quantity || 1,
          price: item.price || 0,
          image: imageValue,
          unit: '',
          category: category,
          subcategory: subcategory,
        };
      }),
      paymentMethod:
        this.orderData.paymentMethod === 'COD'
          ? 'cod'
          : this.orderData.paymentMethod === 'bank'
          ? 'banking'
          : this.orderData.paymentMethod === 'cash'
          ? 'cod'
          : 'cod',
      subtotal: this.orderData.subtotal || 0,
      shippingFee: this.orderData.shippingFee || 30000,
      shippingDiscount: this.orderData.shippingDiscount || 0,
      discount: this.orderData.discount || 0,
      vatRate: 0,
      vatAmount: 0,
      totalAmount: this.orderData.total || 0,
      code: this.orderData.promotion.code || '',
      promotionName: this.orderData.promotion.name || '',
      wantInvoice: false,
      invoiceInfo: {},
      consultantCode: '',
    };

    console.log('💾 Saving new order to MongoDB:', orderPayload);

    // Call API to save order
    this.apiService.createOrder(orderPayload).subscribe({
      next: (response) => {
        console.log('✅ Order saved successfully:', response);
        this.shouldNavigateAfterPopup = true;
        this.displayPopup('Đơn hàng đã được lưu thành công!', 'success');
      },
      error: (error) => {
        console.error('❌ Error saving order:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi lưu đơn hàng';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Close popup and navigate if needed
   */
  closePopup(): void {
    const needsNavigation = this.shouldNavigateAfterPopup;
    this.showPopup = false;
    this.popupMessage = '';
    this.shouldNavigateAfterPopup = false;

    if (needsNavigation) {
      // Small delay to allow popup animation to complete
      setTimeout(() => {
        this.router.navigate(['/orders']);
      }, 200);
    }
  }

  /**
   * Cancel order (new or edit)
   */
  cancelOrder(): void {
    if (this.isNewOrder || this.isEditMode) {
      if (this.returnUrl) {
        this.router.navigateByUrl(this.returnUrl);
      } else {
        this.router.navigate(['/orders']);
      }
    }
  }

  cancelNewOrder(): void {
    this.cancelOrder();
  }

  /**
   * Enter edit mode - enable editing for existing order
   */
  enterEditMode(): void {
    this.isEditMode = true;
    // Load necessary data for editing (users, address data, promotions)
    if (!this.users || this.users.length === 0) {
      this.loadUsers();
    }
    if (this.provinces.length === 0) {
      this.loadAddressData();
    }
    if (this.activePromotions.length === 0) {
      this.loadPromotions();
    }
    console.log('✅ Entered edit mode');
  }

  /**
   * Cancel edit mode - exit edit mode and reload order data
   */
  cancelEdit(): void {
    this.isEditMode = false;
    // Reload order data to restore original values
    this.loadOrderDetail();
  }

  /**
   * Save order (new or update)
   */
  saveOrder(): void {
    if (this.isNewOrder) {
      this.saveNewOrder();
    } else if (this.isEditMode) {
      this.updateOrder();
    }
  }

  /**
   * Update existing order
   */
  updateOrder(): void {
    // Validate required fields
    if (!this.orderData.customerInfo.name && !this.orderData.customerID) {
      this.displayPopup('Vui lòng chọn khách hàng', 'error');
      return;
    }

    if (this.orderData.items.length === 0) {
      this.displayPopup('Vui lòng thêm ít nhất một sản phẩm vào đơn hàng', 'error');
      return;
    }

    // Validate items have required fields
    for (let i = 0; i < this.orderData.items.length; i++) {
      const item = this.orderData.items[i];
      if (
        !item.name ||
        !item.sku ||
        !item.quantity ||
        item.quantity < 1 ||
        item.price === undefined ||
        item.price < 0
      ) {
        this.displayPopup(
          `Sản phẩm thứ ${i + 1} thiếu thông tin hoặc không hợp lệ. Vui lòng kiểm tra lại.`,
          'error'
        );
        return;
      }
    }

    // Validate delivery info
    if (!this.orderData.deliveryInfo.name || !this.orderData.deliveryInfo.phone) {
      this.displayPopup('Vui lòng nhập đầy đủ thông tin người nhận', 'error');
      return;
    }

    if (
      !this.orderData.deliveryInfo.province ||
      !this.orderData.deliveryInfo.district ||
      !this.orderData.deliveryInfo.ward ||
      !this.orderData.deliveryInfo.streetAddress
    ) {
      this.displayPopup('Vui lòng nhập đầy đủ địa chỉ giao hàng', 'error');
      return;
    }

    // Validate totals are calculated correctly
    if (this.orderData.subtotal < 0 || this.orderData.total < 0) {
      this.displayPopup('Tổng tiền không hợp lệ. Vui lòng kiểm tra lại.', 'error');
      return;
    }

    // Get OrderID
    const orderID = this.getOrderID();
    if (!orderID) {
      this.displayPopup('Không tìm thấy mã đơn hàng!', 'error');
      return;
    }

    // Get CustomerID - first try from orderData.customerID (set when selecting customer)
    let customerID = this.orderData.customerID;

    if (!customerID) {
      // Find customer by multiple criteria for better accuracy
      // Priority: 1. Name + Phone, 2. Name + Email, 3. Name only, 4. Phone only, 5. Email only
      const customerName = this.orderData.customerInfo.name || '';
      const customerPhone = this.orderData.customerInfo.phone || '';
      const customerEmail = this.orderData.customerInfo.email || '';

      let customer = null;

      // Try to find by name + phone first (most accurate)
      if (customerName && customerPhone) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const phone = (u.Phone || u.phone || '').trim();
          return fullName === customerName && phone === customerPhone;
        });
      }

      // If not found, try name + email
      if (!customer && customerName && customerEmail) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          const email = (u.Email || u.email || '').trim();
          return fullName === customerName && email === customerEmail;
        });
      }

      // If not found, try phone only
      if (!customer && customerPhone) {
        customer = this.users.find((u) => {
          const phone = (u.Phone || u.phone || '').trim();
          return phone === customerPhone;
        });
      }

      // If not found, try email only
      if (!customer && customerEmail) {
        customer = this.users.find((u) => {
          const email = (u.Email || u.email || '').trim();
          return email === customerEmail;
        });
      }

      // If still not found, try name only (last resort)
      if (!customer && customerName) {
        customer = this.users.find((u) => {
          const fullName = (u.FullName || u.full_name || u.name || '').trim();
          return fullName === customerName;
        });
      }

      if (customer) {
        customerID = customer.CustomerID;
        if (!customerID) {
          if (customer.user_id) {
            customerID = 'CUS' + String(customer.user_id).padStart(6, '0');
          } else if (customer._id) {
            const idStr = customer._id.toString();
            customerID = 'CUS' + idStr.substring(0, 6).padStart(6, '0');
          }
        }
        // Update orderData.customerID for future use
        this.orderData.customerID = customerID;
        console.log(`✅ Found customer: ${customerName} -> CustomerID: ${customerID}`);
      }
    }

    if (!customerID) {
      this.displayPopup(
        'Không tìm thấy ID khách hàng. Vui lòng chọn lại khách hàng từ danh sách.',
        'error'
      );
      return;
    }

    // Transform orderData to MongoDB format
    const city = String(this.orderData.deliveryInfo.province || '').trim();
    const district = String(this.orderData.deliveryInfo.district || '').trim();
    const ward = String(this.orderData.deliveryInfo.ward || '').trim();
    const detail = String(this.orderData.deliveryInfo.streetAddress || '').trim();

    if (!city || !district || !ward || !detail) {
      this.displayPopup('Địa chỉ giao hàng không hợp lệ! Vui lòng kiểm tra lại.', 'error');
      return;
    }

    // Map status to backend status
    let backendStatus = this.orderData.status;
    if (backendStatus === 'confirmed' && this.orderData.delivery === 'delivering') {
      backendStatus = 'shipping';
    } else if (backendStatus === 'confirmed') {
      backendStatus = 'confirmed';
    }

    const orderPayload = {
      CustomerID: customerID,
      shippingInfo: {
        fullName: String(this.orderData.deliveryInfo.name || '').trim(),
        phone: String(this.orderData.deliveryInfo.phone || '').trim(),
        email: String(this.orderData.deliveryInfo.email || '').trim(),
        address: {
          city: city,
          district: district,
          ward: ward,
          detail: detail,
        },
        deliveryMethod: 'standard',
        warehouseAddress: '',
        notes: String(this.orderData.note || '').trim(),
      },
      items: this.orderData.items.map((item: any) => {
        let category = item.category || '';
        let subcategory = item.subcategory || '';

        if ((!category || !subcategory) && item.sku) {
          for (const [key, product] of this.productsMap.entries()) {
            if (product.sku === item.sku || product.SKU === item.sku) {
              category = category || product.category || '';
              subcategory = subcategory || product.subcategory || '';
              break;
            }
          }
        }

        let imageValue = '';
        if (item.image) {
          if (Array.isArray(item.image)) {
            imageValue = item.image[0] || '';
          } else {
            imageValue = String(item.image);
          }
        }

        return {
          sku: item.sku || '',
          name: item.name || '', // Backend expects 'name', not 'productName'
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          image: imageValue,
          unit: item.unit || '',
          category: category,
          subcategory: subcategory,
        };
      }),
      paymentMethod: (this.orderData.paymentMethod || 'COD').toLowerCase(),
      subtotal: Number(this.orderData.subtotal) || 0,
      shippingFee: Number(this.orderData.shippingFee) || 30000,
      shippingDiscount: Number(this.orderData.shippingDiscount) || 0,
      discount: Number(this.orderData.discount) || 0,
      vatRate: 0,
      vatAmount: 0,
      totalAmount: Number(this.orderData.total) || 0,
      code: this.orderData.promotion.code || '',
      promotionName: this.orderData.promotion.name || '',
      wantInvoice: false,
      invoiceInfo: {},
      consultantCode: '',
      status: backendStatus,
    };

    console.log('📦 Updating order:', orderID);
    console.log('📦 Order payload:', orderPayload);

    // Call API to update order
    this.apiService.updateOrder(orderID, orderPayload).subscribe({
      next: (response) => {
        console.log('✅ Order updated successfully:', response);
        this.displayPopup('Đơn hàng đã được cập nhật thành công!', 'success');
        // Exit edit mode and reload order data
        this.isEditMode = false;
        // Reload order data to reflect changes
        this.loadOrderDetail();
        // Navigate back after a delay
        setTimeout(() => {
          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
          } else {
            this.router.navigate(['/orders']);
          }
        }, 1500);
      },
      error: (error) => {
        console.error('❌ Error updating order:', error);
        const errorMessage =
          error.error?.message || error.message || 'Có lỗi xảy ra khi cập nhật đơn hàng';
        this.displayPopup(errorMessage, 'error');
      },
    });
  }

  /**
   * Update order CustomerID in MongoDB (background fix)
   */
  private updateOrderCustomerID(orderID: string, correctCustomerID: string): void {
    // Call API to update CustomerID only
    this.apiService.updateOrder(orderID, { CustomerID: correctCustomerID }).subscribe({
      next: (response) => {
        console.log(`✅ Updated order ${orderID} CustomerID to ${correctCustomerID}`);
      },
      error: (error) => {
        console.error(`❌ Error updating order ${orderID} CustomerID:`, error);
        // Don't show error to user as this is a background fix
      },
    });
  }

  /**
   * Navigate to product detail page
   */
  goToProductDetail(item: any): void {
    const sku = item.sku || item.SKU;
    if (sku) {
      // Navigate to products page with search query for the SKU
      this.router.navigate(['/products'], { queryParams: { search: sku } });
    } else {
      // If no SKU, just navigate to products page
      this.router.navigate(['/products']);
    }
  }

  /**
   * Setup auto-reload interval for order status updates
   * Auto-reload every 30 seconds when order status is 'confirmed' or 'shipping'
   */
  private setupStatusAutoReload(orderStatus: string): void {
    // Clear existing interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Only auto-reload for 'confirmed' or 'shipping' status
    // 'confirmed' - waiting for auto-transition to 'shipping' (after 3 minutes)
    // 'shipping' - waiting for admin to click "Xác nhận đã giao"
    if (orderStatus === 'confirmed' || orderStatus === 'shipping') {
      console.log(
        `🔄 Starting auto-reload interval for order status: ${orderStatus} (reload every 30 seconds)`
      );
      this.statusCheckInterval = setInterval(() => {
        if (!this.isNewOrder && !this.isEditMode) {
          console.log(`🔄 Auto-reloading order detail (status: ${orderStatus})...`);
          this.loadOrderDetail();
        }
      }, 30 * 1000); // Reload every 30 seconds
    } else {
      console.log(`⏸️ Stopping auto-reload (order status: ${orderStatus})`);
    }
  }

  /**
   * Start countdown timer for shipping status transition
   */
  private startShippingCountdown(orderID: string, targetTime: Date): void {
    // Clear existing countdown
    if (this.shippingCountdownInterval) {
      clearInterval(this.shippingCountdownInterval);
      this.shippingCountdownInterval = null;
    }

    // Log countdown every 30 seconds
    this.shippingCountdownInterval = setInterval(() => {
      const now = new Date();
      const remaining = targetTime.getTime() - now.getTime();

      if (remaining <= 0) {
        clearInterval(this.shippingCountdownInterval);
        this.shippingCountdownInterval = null;
        console.log(`✅ [Countdown] Order ${orderID} đã đến thời gian chuyển sang shipping!`);
        return;
      }

      const remainingMinutes = Math.floor(remaining / 60000);
      const remainingSeconds = Math.floor((remaining % 60000) / 1000);

      console.log(
        `⏳ [Countdown] Order ${orderID}: Còn ${remainingMinutes} phút ${remainingSeconds} giây để tự động chuyển sang shipping...`
      );
    }, 30 * 1000); // Log every 30 seconds

    // Log immediately
    const now = new Date();
    const remaining = targetTime.getTime() - now.getTime();
    const remainingMinutes = Math.floor(remaining / 60000);
    const remainingSeconds = Math.floor((remaining % 60000) / 1000);
    console.log(
      `⏳ [Countdown] Order ${orderID}: Bắt đầu đếm ngược - Còn ${remainingMinutes} phút ${remainingSeconds} giây...`
    );
  }

  ngOnDestroy(): void {
    // Clear interval when component is destroyed
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      console.log('🛑 Stopped auto-reload interval for order status');
    }
    if (this.shippingCountdownInterval) {
      clearInterval(this.shippingCountdownInterval);
      this.shippingCountdownInterval = null;
      console.log('🛑 Stopped shipping countdown interval');
    }
  }
}
