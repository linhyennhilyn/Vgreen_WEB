import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-ordersmanage',
  imports: [CommonModule, FormsModule],
  templateUrl: './ordersmanage.html',
  styleUrl: './ordersmanage.css',
  standalone: true,
})
export class OrdersManage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private routerSubscription?: Subscription;

  // Statistics
  statistics = {
    total: 0,
    pending: 0,
    delivering: 0,
    unpaid: 0,
    refundRequested: 0,
    refunded: 0,
  };

  // Orders data
  orders: any[] = [];
  allOrders: any[] = []; // Keep original data for search/filter
  loadError: string = '';
  users: any[] = [];

  selectedCount = 0;
  selectAll = false;

  // Filter state
  currentFilter: string = 'all'; // all, pending, delivering, delivered, unpaid, refund-requested, refunded, cancelled
  showFilterDropdown: boolean = false;

  // Sort state
  currentSortBy: 'date' | 'price' = 'date'; // date, price
  currentSortOrder: 'asc' | 'desc' = 'desc'; // asc: ascending, desc: descending
  showSortDropdown: boolean = false;

  // Popup state
  showPopup: boolean = false;
  popupMessage: string = '';
  popupType: 'success' | 'error' | 'info' = 'success';

  // Confirmation dialog state
  showConfirmDialog: boolean = false;
  confirmMessage: string = '';
  confirmCallback: (() => void) | null = null;

  constructor() {}

  private previousUrl: string = '';

  ngOnInit(): void {
    // Check for filter query parameter
    this.route.queryParams.subscribe((params) => {
      if (params['filter'] && params['filter'] !== this.currentFilter) {
        const filterType = params['filter'];
        // Validate filter type
        const validFilters = [
          'all',
          'pending',
          'delivering',
          'delivered',
          'unpaid',
          'refund-requested',
          'refunded',
          'cancelled',
          'confirmed',
          'paid',
        ];
        if (validFilters.includes(filterType)) {
          console.log(`🔍 [OrdersManage] Applying filter from query param: ${filterType}`);
          // Delay to ensure data is loaded
          setTimeout(() => {
            this.filterByStatus(filterType);
          }, 300);
        }
      }
    });

    this.loadData();

    // Track previous URL and reload orders when navigating back from order detail
    this.previousUrl = this.router.url;

    // Reload orders when navigating back from order detail page
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const currentUrl = event.url;

        // Reload orders when navigating to orders page from order detail page
        if (
          (currentUrl === '/orders' || currentUrl.startsWith('/orders')) &&
          this.previousUrl?.includes('/orders/') &&
          !this.previousUrl.includes('/orders/new')
        ) {
          // Reload orders to get updated status
          console.log('🔄 Reloading orders after navigation from order detail...');
          setTimeout(() => {
            this.loadOrders();
          }, 100);
        }

        // Check for filter query parameter on navigation
        const urlTree = this.router.parseUrl(currentUrl);
        const filterParam = urlTree.queryParams['filter'];
        if (filterParam && filterParam !== this.currentFilter) {
          const validFilters = [
            'all',
            'pending',
            'delivering',
            'delivered',
            'unpaid',
            'refund-requested',
            'refunded',
            'cancelled',
            'confirmed',
            'paid',
          ];
          if (validFilters.includes(filterParam)) {
            console.log(`🔍 [OrdersManage] Applying filter from URL on navigation: ${filterParam}`);
            setTimeout(() => {
              this.filterByStatus(filterParam);
            }, 300);
          }
        }

        this.previousUrl = currentUrl;
      });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.closeFilterDropdown();
      this.closeSortDropdown();
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  /**
   * Load orders and users data
   */
  loadData(): void {
    this.loadOrders();
  }

  /**
   * Load orders data from MongoDB via API
   */
  loadOrders(): void {
    console.log('🔄 Loading orders from MongoDB...');
    // Try MongoDB first
    this.apiService.getOrders().subscribe({
      next: (ordersData) => {
        console.log('📦 [OrdersManage] Raw orders data:', ordersData);

        // Đảm bảo ordersData là array
        if (!Array.isArray(ordersData)) {
          console.error('❌ [OrdersManage] ordersData is not an array:', ordersData);
          this.allOrders = [];
          this.orders = [];
          this.updateStatistics();
          this.loadError = 'Dữ liệu đơn hàng không hợp lệ';
          return;
        }

        console.log(`✅ Loaded ${ordersData.length} orders from MongoDB`);

        // Load users to map CustomerID to customer name
        this.apiService.getUsers().subscribe({
          next: (usersData) => {
            console.log(`✅ Loaded ${usersData.length} users from MongoDB`);
            this.users = Array.isArray(usersData) ? usersData : [];

            // Transform orders with user mapping - use transformOrderFromTemp for MongoDB format
            this.allOrders = ordersData.map((order) => this.transformOrderFromTemp(order));

            // Sort by date - newest first (default)
            this.sortOrdersByDate();

            this.orders = [...this.allOrders];
            this.updateStatistics();
            this.loadError = '';
          },
          error: (error) => {
            console.error('❌ Error loading users from MongoDB:', error);
            // Still transform orders without user mapping
            this.allOrders = ordersData.map((order) => this.transformOrderFromTemp(order));
            this.sortOrdersByDate();
            this.orders = [...this.allOrders];
            this.updateStatistics();
            this.loadError = '';
          },
        });
      },
      error: (error) => {
        console.error('❌ Error loading orders from MongoDB:', error);
        this.loadError = '❌ Không thể tải dữ liệu từ MongoDB';
        // Don't fallback to JSON - only use MongoDB data
        this.allOrders = [];
        this.orders = [];
        this.updateStatistics();
      },
    });
  }

  /**
   * REMOVED: No longer using JSON fallback - MongoDB only!
   * Fallback: Load orders from JSON file (deprecated - should not be called)
   */
  private loadOrdersFromJSON(): void {
    // This method is kept for reference but should not be called
    // All data should come from MongoDB only
    console.warn('⚠️ loadOrdersFromJSON() is deprecated. Use MongoDB only.');
    return; // Early return to prevent execution

    // Load orders from temp folder (deprecated)
    this.http.get<any[]>('data/temp/orders.json').subscribe({
      next: (ordersData) => {
        console.log(`✅ Loaded ${ordersData.length} orders from temp folder JSON`);

        // Load users to map CustomerID to customer name (deprecated)
        this.http.get<any[]>('data/temp/users.json').subscribe({
          next: (usersData) => {
            console.log(`✅ Loaded ${usersData.length} users from temp folder`);
            this.users = usersData;

            // Transform orders with user mapping
            this.allOrders = ordersData.map((order) => this.transformOrderFromTemp(order));

            // Sort by date - newest first (default)
            this.sortOrdersByDate();

            this.orders = [...this.allOrders];
            this.updateStatistics();
          },
          error: (error) => {
            console.error('❌ Error loading users from temp JSON:', error);
            // Still transform orders without user mapping
            this.allOrders = ordersData.map((order) => this.transformOrderFromTemp(order));
            this.sortOrdersByDate();
            this.orders = [...this.allOrders];
            this.updateStatistics();
          },
        });
      },
      error: (error) => {
        console.error('❌ Error loading orders from temp JSON:', error);
      },
    });
  }

  /**
   * Transform order data from JSON to component format
   */
  transformOrder(orderData: any): any {
    // Use CustomerID for listing column instead of customer name
    const customerCode =
      orderData.user_id || orderData.CustomerID || orderData.customer_id || 'N/A';

    // Map status based on new structure
    let status = 'pending';
    let delivery = 'pending';
    let payment = 'unpaid';
    let refund = 'none';

    // Map status
    if (orderData.status === 'Delivered') {
      status = 'confirmed';
      delivery = 'delivered';
      payment = 'paid';
    } else if (orderData.status === 'Pending') {
      status = 'pending';
      delivery = 'pending';
      payment = 'unpaid';
    } else if (orderData.status === 'Cancel Requested' || orderData.status === 'Return Requested') {
      status = 'refund-requested';
      delivery = 'delivering';
      payment = orderData.total_amount > 0 ? 'paid' : 'unpaid';
      refund = 'requested';
    } else if (orderData.status === 'Refunded') {
      status = 'refunded';
      delivery = 'none'; // Không hiển thị status giao hàng
      payment = 'unpaid';
      refund = 'refunded';
    } else if (orderData.status === 'Cancelled by User') {
      status = 'cancelled';
      delivery = 'none'; // Không hiển thị status giao hàng
      payment = 'unpaid';
      refund = 'none';
    } else if (orderData.status === 'Return Approved') {
      status = 'confirmed';
      delivery = 'delivered';
      payment = 'paid';
      refund = 'requested';
    } else if (orderData.status === 'Rejected') {
      status = 'confirmed';
      delivery = 'delivering';
      payment = 'paid';
      refund = 'none';
    }

    // Format date from YYYY-MM-DD to DD/MM/YYYY
    const dateParts = orderData.order_date.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    // Format amount
    const formattedAmount = this.formatCurrency(orderData.total_amount);

    return {
      id: 'VG' + orderData.order_id,
      date: formattedDate,
      customer: customerCode,
      status: status,
      payment: payment,
      delivery: delivery,
      refund: refund,
      total: formattedAmount,
      selected: false,
      cancelReason: orderData.cancel_reason || orderData.cancelReason || '', // Lý do hủy/trả hàng
      rawData: orderData, // Keep raw data for detail page
    };
  }

  /**
   * Transform order data from temp folder JSON format to component format
   */
  transformOrderFromTemp(orderData: any): any {
    // For list view: show CustomerID instead of name
    const customerCode =
      orderData.CustomerID || orderData.customer_id || orderData.user_id || 'N/A';

    // Map status from temp JSON format
    let status = 'pending';
    let delivery = 'pending';
    let payment = 'unpaid';
    let refund = 'none';

    // Map status from temp JSON format (completed, cancelled, delivered, returned, etc.)
    // Logic này phải giống hệt với transformOrderDataFromMongoDB() trong orderdetail.ts
    const orderStatus = orderData.status?.toLowerCase() || 'pending';

    if (orderStatus === 'completed' || orderStatus === 'delivered') {
      // Both completed and delivered are considered the same final status
      status = 'confirmed';
      delivery = 'delivered';
      payment =
        orderData.paymentMethod === 'cod' ? 'paid' : orderData.paymentMethod ? 'paid' : 'unpaid';
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
    } else if (orderStatus === 'processing_return') {
      // Đang xử lý hoàn trả
      status = 'processing_return';
      delivery = 'delivered'; // Luôn hiển thị "Đã giao hàng" khi đang xử lý trả hàng
      payment = 'paid'; // Luôn hiển thị "Đã thanh toán" khi đang xử lý trả hàng
      refund = 'requested';
    } else if (orderStatus === 'returning') {
      // Đang trả hàng
      status = 'returning'; // Giữ nguyên status để hiển thị "Đang trả hàng"
      delivery = 'delivered'; // Luôn hiển thị "Đã giao hàng" khi đang trả hàng
      payment = 'paid'; // Luôn hiển thị "Đã thanh toán" khi đang trả hàng
      refund = 'requested';
    } else if (orderStatus === 'returned') {
      status = 'refunded';
      delivery = 'delivered'; // Luôn hiển thị "Đã giao hàng" khi đã trả hàng
      payment = 'paid'; // Luôn hiển thị "Đã thanh toán" khi đã trả hàng
      refund = 'refunded';
    } else if (orderStatus === 'processing') {
      status = 'confirmed';
      delivery = 'delivering';
      payment = orderData.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    } else if (orderStatus === 'shipping') {
      // Status shipping: đơn hàng đang được giao
      status = 'confirmed';
      delivery = 'delivering'; // Đang giao
      payment = orderData.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    } else if (orderStatus === 'confirmed') {
      // Status confirmed: đơn hàng đã được xác nhận, chờ chuyển sang shipping (sau 1 phút)
      status = 'confirmed';
      delivery = 'pending'; // Chờ giao (chưa bắt đầu giao hàng)
      payment = orderData.paymentMethod === 'cod' ? 'unpaid' : 'paid';
      refund = 'none';
    }

    // Format date from ISO string to DD/MM/YYYY
    let formattedDate = '';
    if (orderData.createdAt) {
      const dateStr = orderData.createdAt.$date || orderData.createdAt;
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      }
    }

    if (!formattedDate) {
      formattedDate = 'N/A';
    }

    // Format amount
    const totalAmount = orderData.totalAmount || 0;
    const formattedAmount = this.formatCurrency(totalAmount);

    // Use OrderID as order ID
    const orderId = orderData.OrderID || orderData._id?.$oid || 'N/A';

    return {
      id: orderId,
      date: formattedDate,
      customer: customerCode,
      status: status,
      payment: payment,
      delivery: delivery,
      refund: refund,
      total: formattedAmount,
      selected: false,
      cancelReason: orderData.cancelReason || '', // Lý do hủy/trả hàng
      rawData: orderData, // Keep raw data for detail page
    };
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
  }

  /**
   * Update statistics
   */
  updateStatistics(): void {
    this.statistics.total = this.allOrders.length;
    this.statistics.pending = this.allOrders.filter((o) => o.status === 'pending').length;
    this.statistics.delivering = this.allOrders.filter((o) => o.delivery === 'delivering').length;
    this.statistics.unpaid = this.allOrders.filter((o) => o.payment === 'unpaid').length;
    // Đếm cả refund-requested, processing_return, returning, và refund === 'requested'
    this.statistics.refundRequested = this.allOrders.filter(
      (o) =>
        o.status === 'refund-requested' ||
        o.status === 'processing_return' ||
        o.status === 'returning' ||
        o.refund === 'requested'
    ).length;
    // Đếm cả 'cancelled', 'refunded', và 'returned' cho ô "TRẢ HÀNG/HOÀN TIỀN"
    this.statistics.refunded = this.allOrders.filter(
      (o) => o.status === 'cancelled' || o.status === 'refunded' || o.status === 'returned'
    ).length;
  }

  /**
   * Sort orders by date
   */
  private sortOrdersByDate(order: 'asc' | 'desc' = 'desc'): void {
    this.allOrders.sort((a, b) => {
      // Support both old format (order_date) and new temp format (createdAt)
      let dateA = a.rawData?.order_date || '';
      let dateB = b.rawData?.order_date || '';

      // If no order_date, try createdAt from temp format
      if (!dateA && a.rawData?.createdAt) {
        const dateStr = a.rawData.createdAt.$date || a.rawData.createdAt;
        dateA = new Date(dateStr).toISOString();
      }
      if (!dateB && b.rawData?.createdAt) {
        const dateStr = b.rawData.createdAt.$date || b.rawData.createdAt;
        dateB = new Date(dateStr).toISOString();
      }

      // Fallback to default date if still empty
      dateA = dateA || '2000-01-01';
      dateB = dateB || '2000-01-01';

      if (order === 'desc') {
        // Descending (newest first)
        return dateB.localeCompare(dateA);
      } else {
        // Ascending (oldest first)
        return dateA.localeCompare(dateB);
      }
    });

    console.log(`✅ Orders sorted by date (${order === 'desc' ? 'newest' : 'oldest'} first)`);
  }

  /**
   * Sort orders by price/total amount
   */
  private sortOrdersByPrice(order: 'asc' | 'desc' = 'desc'): void {
    this.allOrders.sort((a, b) => {
      // Support both old format (total_amount) and new temp format (totalAmount)
      const priceA = a.rawData?.totalAmount || a.rawData?.total_amount || 0;
      const priceB = b.rawData?.totalAmount || b.rawData?.total_amount || 0;

      if (order === 'desc') {
        // Descending (highest first)
        return priceB - priceA;
      } else {
        // Ascending (lowest first)
        return priceA - priceB;
      }
    });

    console.log(`✅ Orders sorted by price (${order === 'desc' ? 'highest' : 'lowest'} first)`);
  }

  /**
   * Apply sort based on current sort state
   */
  applySort(): void {
    if (this.currentSortBy === 'date') {
      this.sortOrdersByDate(this.currentSortOrder);
    } else if (this.currentSortBy === 'price') {
      this.sortOrdersByPrice(this.currentSortOrder);
    }

    // Update displayed orders
    this.orders = [...this.allOrders];

    // Reapply current filter if any
    if (this.currentFilter !== 'all') {
      this.filterByStatus(this.currentFilter);
    }
  }

  /**
   * Toggle sort order (asc/desc)
   */
  toggleSortOrder(): void {
    this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
    this.applySort();
  }

  /**
   * Sort by date
   */
  sortByDate(order: 'asc' | 'desc' = 'desc'): void {
    this.currentSortBy = 'date';
    this.currentSortOrder = order;
    this.applySort();
    this.showSortDropdown = false;
  }

  /**
   * Sort by price
   */
  sortByPrice(order: 'asc' | 'desc' = 'desc'): void {
    this.currentSortBy = 'price';
    this.currentSortOrder = order;
    this.applySort();
    this.showSortDropdown = false;
  }

  /**
   * Toggle select all orders
   */
  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    this.orders.forEach((order) => (order.selected = this.selectAll));
    this.updateSelectedCount();
  }

  /**
   * Toggle individual order selection
   */
  toggleOrder(order: any): void {
    order.selected = !order.selected;
    this.updateSelectedCount();
    this.selectAll = this.orders.every((o) => o.selected);
  }

  /**
   * Update selected count
   */
  updateSelectedCount(): void {
    this.selectedCount = this.orders.filter((o) => o.selected).length;
  }

  /**
   * Add new order
   */
  addOrder(): void {
    console.log('Add new order - navigating to order detail page');
    // Navigate to order detail page with 'new' as order ID
    this.router.navigate(['/orders', 'new']);
  }

  /**
   * Open sort menu
   */
  openSort(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    // Close filter dropdown when opening sort dropdown
    if (!this.showSortDropdown) {
      this.showFilterDropdown = false;
    }
    this.showSortDropdown = !this.showSortDropdown;
    console.log('Sort menu toggled:', this.showSortDropdown);
  }

  /**
   * Close sort dropdown
   */
  closeSortDropdown(): void {
    this.showSortDropdown = false;
  }

  /**
   * Print orders
   */
  printOrders(): void {
    const selected = this.orders.filter((o) => o.selected);
    console.log('Print orders:', selected);
    // TODO: Implement print logic
  }

  /**
   * Edit selected orders
   */
  editOrders(): void {
    const selected = this.orders.filter((o) => o.selected);

    if (selected.length === 0) {
      this.displayPopup('Vui lòng chọn đơn hàng cần chỉnh sửa', 'error');
      return;
    }

    if (selected.length > 1) {
      this.displayPopup('Chỉ có thể chỉnh sửa một đơn hàng tại một thời điểm', 'error');
      return;
    }

    // Navigate to order detail page with edit mode
    const order = selected[0];
    console.log('Edit order:', order);

    // Extract OrderID from order.id (remove VG prefix if exists)
    const orderId = order.id.replace('VG', '');

    // Navigate with state indicating edit mode
    this.router.navigate(['/orders', orderId], {
      state: {
        editMode: true,
        returnUrl: '/orders',
      },
    });
  }

  /**
   * Delete selected orders
   */
  deleteOrders(): void {
    const selected = this.orders.filter((o) => o.selected);
    if (selected.length === 0) {
      this.displayPopup('Vui lòng chọn đơn hàng cần xóa', 'error');
      return;
    }

    // Show confirmation dialog
    this.showConfirmation(`Bạn có chắc chắn muốn xóa ${selected.length} đơn hàng?`, () => {
      // Get selected IDs - use the full OrderID as stored in database
      // Remove only "VG" prefix if exists (frontend display format), but keep "ORD" prefix
      const selectedIds = selected.map((o) => {
        let orderId = o.id;
        // Remove "VG" prefix if it exists (this is just for display)
        if (orderId.startsWith('VG')) {
          orderId = orderId.substring(2); // Remove "VG" prefix
        }
        // Keep "ORD" prefix as that's the actual OrderID format in MongoDB
        return orderId;
      });

      console.log('🗑️ Deleting orders with IDs:', selectedIds);

      // Delete orders via API
      const deletePromises = selectedIds.map((orderId) => {
        if (!orderId) {
          console.warn('⚠️ Order missing ID');
          return Promise.resolve(null);
        }
        return this.apiService.deleteOrder(orderId).toPromise();
      });

      Promise.all(deletePromises)
        .then((results) => {
          const successCount = results.filter((r) => r !== null).length;
          console.log(`✅ Deleted ${successCount} orders successfully`);

          // Reload orders from MongoDB to get updated list
          this.loadOrders();

          this.selectedCount = 0;
          this.selectAll = false;
          this.displayPopup(`Đã xóa ${successCount} đơn hàng thành công`, 'success');
        })
        .catch((error) => {
          console.error('❌ Error deleting orders:', error);
          this.displayPopup(
            'Lỗi khi xóa đơn hàng: ' + (error.error?.message || error.message),
            'error'
          );
          // Still reload to sync with server
          this.loadOrders();
        });
    });
  }

  /**
   * Display popup notification
   */
  displayPopup(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  /**
   * Close popup
   */
  closePopup(): void {
    this.showPopup = false;
    this.popupMessage = '';
  }

  /**
   * Show confirmation dialog
   */
  showConfirmation(message: string, callback: () => void): void {
    this.confirmMessage = message;
    this.confirmCallback = callback;
    this.showConfirmDialog = true;
  }

  /**
   * Confirm action
   */
  confirmAction(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.showConfirmDialog = false;
    this.confirmMessage = '';
  }

  /**
   * Cancel confirmation
   */
  cancelConfirmation(): void {
    this.showConfirmDialog = false;
    this.confirmMessage = '';
    this.confirmCallback = null;
  }

  /**
   * Toggle filter dropdown
   */
  toggleFilterDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    // Close sort dropdown when opening filter dropdown
    if (!this.showFilterDropdown) {
      this.showSortDropdown = false;
    }
    this.showFilterDropdown = !this.showFilterDropdown;
  }

  /**
   * Close filter dropdown
   */
  closeFilterDropdown(): void {
    this.showFilterDropdown = false;
  }

  /**
   * Apply filter and close dropdown
   */
  applyFilterAndClose(filterType: string): void {
    this.filterByStatus(filterType);
    this.closeFilterDropdown();
  }

  /**
   * Search orders
   */
  searchOrders(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    console.log('Search:', query);

    if (!query || query.trim() === '') {
      // Reset to current filter if search is empty
      this.applyFilter();
    } else {
      // Search in allOrders first
      const searchTerm = query.toLowerCase().trim();
      let results = this.allOrders.filter((order) => {
        return (
          order.id.toLowerCase().includes(searchTerm) ||
          order.customer.toLowerCase().includes(searchTerm) ||
          order.total.toLowerCase().includes(searchTerm) ||
          order.date.includes(searchTerm)
        );
      });

      // Then apply current filter if not 'all'
      if (this.currentFilter !== 'all') {
        results = this.filterOrdersByType(results, this.currentFilter);
      }

      this.orders = results;
      console.log(`Search results: ${results.length} orders`);
    }

    // Reset selection
    this.selectedCount = 0;
    this.selectAll = false;
  }

  /**
   * Filter orders by status type
   */
  filterByStatus(filterType: string): void {
    console.log('Filter by:', filterType);
    this.currentFilter = filterType;
    this.applyFilter();

    // Reset selection
    this.selectedCount = 0;
    this.selectAll = false;
  }

  /**
   * Apply current filter
   */
  private applyFilter(): void {
    if (this.currentFilter === 'all') {
      this.orders = [...this.allOrders];
    } else {
      this.orders = this.filterOrdersByType(this.allOrders, this.currentFilter);
    }
  }

  /**
   * Filter orders array by type
   */
  private filterOrdersByType(orders: any[], filterType: string): any[] {
    switch (filterType) {
      case 'pending':
        return orders.filter((o) => o.status === 'pending');

      case 'confirmed':
        return orders.filter((o) => o.status === 'confirmed');

      case 'refund-requested':
        // Bao gồm cả refund-requested, processing_return, và returning
        return orders.filter(
          (o) =>
            o.status === 'refund-requested' ||
            o.status === 'processing_return' ||
            o.status === 'returning' ||
            o.refund === 'requested'
        );

      case 'cancelled':
        return orders.filter((o) => o.status === 'cancelled');

      case 'refunded':
        // Lọc cả 'cancelled', 'refunded', và 'returned' cho ô "TRẢ HÀNG/HOÀN TIỀN"
        return orders.filter(
          (o) => o.status === 'refunded' || o.status === 'cancelled' || o.status === 'returned'
        );

      case 'delivering':
        return orders.filter((o) => o.delivery === 'delivering');

      case 'delivered':
        return orders.filter((o) => o.delivery === 'delivered');

      case 'unpaid':
        return orders.filter((o) => o.payment === 'unpaid');

      case 'paid':
        return orders.filter((o) => o.payment === 'paid');

      default:
        return orders;
    }
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.currentFilter = 'all';
    this.orders = [...this.allOrders];

    // Reset selection
    this.selectedCount = 0;
    this.selectAll = false;

    console.log('Filters cleared');
  }

  /**
   * Check if a filter is active
   */
  isFilterActive(filterType: string): boolean {
    return this.currentFilter === filterType;
  }

  /**
   * Get status label
   */
  getStatusLabel(status: string): string {
    const labels: any = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      'refund-requested': 'Yêu cầu trả hàng/hoàn tiền',
      processing_return: 'Đang xử lý trả hàng/hoàn tiền',
      returning: 'Đang trả hàng',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
      returned: 'Đã hoàn tiền',
      processing: 'Đang xử lý',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao hàng',
      completed: 'Hoàn thành',
    };
    return labels[status] || status;
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
   * Get delivery label
   */
  getDeliveryLabel(delivery: string, order?: any): string {
    // Nếu order có status là processing_return hoặc returning và delivery là delivered
    // thì hiển thị "Đã giao hàng" thay vì "Hoàn thành"
    if (
      order &&
      (order.status === 'processing_return' || order.status === 'returning') &&
      delivery === 'delivered'
    ) {
      return 'Đã giao hàng';
    }

    const labels: any = {
      pending: 'Chờ giao',
      delivering: 'Đang giao',
      delivered: 'Hoàn thành',
      none: '',
    };
    return labels[delivery] || delivery;
  }

  /**
   * Get status class
   */
  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  /**
   * Get payment class
   */
  getPaymentClass(payment: string): string {
    return `payment-${payment}`;
  }

  /**
   * Get delivery class
   */
  getDeliveryClass(delivery: string): string {
    return `delivery-${delivery}`;
  }

  /**
   * Get refund label
   */
  getRefundLabel(refund: string): string {
    const labels: any = {
      none: 'Không',
      requested: 'Yêu cầu hoàn tiền',
      refunded: 'Đã hoàn tiền',
    };
    return labels[refund] || refund;
  }

  /**
   * Get refund class
   */
  getRefundClass(refund: string): string {
    return `refund-${refund}`;
  }

  /**
   * View order detail
   */
  viewOrderDetail(order: any): void {
    this.router.navigate(['/orders', order.id]);
  }
}
