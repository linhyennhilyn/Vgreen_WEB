import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../services/api.service';
import { interval, Subscription, forkJoin, of } from 'rxjs';
import { switchMap, catchError, debounceTime, retry, tap } from 'rxjs/operators';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  standalone: true,
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('revenueChart') revenueChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ordersChart') ordersChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('customersChart') customersChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('promotionChart') promotionChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsChart') topProductsChart!: ElementRef<HTMLCanvasElement>;

  private apiService = inject(ApiService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private refreshSubscription?: Subscription;

  /**
   * Navigate to products page with stock filter and update sidebar active state
   */
  navigateToProductsWithFilter(stockStatus: 'low-stock' | 'out-of-stock'): void {
    this.router
      .navigate(['/products'], {
        queryParams: { stockStatus: stockStatus },
      })
      .then(() => {
        this.updateSidebarActiveState('products');
      });
  }

  /**
   * Navigate to products page and update sidebar active state
   */
  navigateToProducts(): void {
    this.router.navigate(['/products']).then(() => {
      this.updateSidebarActiveState('products');
    });
  }

  /**
   * Scroll to revenue chart section
   */
  scrollToRevenue(): void {
    const revenueSection = document.getElementById('revenue-chart-section');
    if (revenueSection) {
      revenueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Update sidebar active state based on route
   */
  private updateSidebarActiveState(routeKey: string): void {
    // Use setTimeout to ensure DOM is ready after navigation
    setTimeout(() => {
      // Map route keys to menu text (Vietnamese)
      const routeTextMap: { [key: string]: string } = {
        products: 'sản phẩm',
        orders: 'đơn hàng',
        customers: 'khách hàng',
        dashboard: 'tổng quan',
      };

      const menuText = routeTextMap[routeKey];
      if (!menuText) return;

      // Remove active from all menu links
      const allLinks = document.querySelectorAll('.menu-link');
      allLinks.forEach((link) => link.classList.remove('active'));

      // Find and activate the correct menu link by matching text content
      const menuItems = document.querySelectorAll('.menu-link');
      menuItems.forEach((link: Element) => {
        const textContent = link.textContent?.trim().toLowerCase();
        if (textContent === menuText) {
          link.classList.add('active');
        }
      });
    }, 100);
  }

  chart: any;
  ordersChartInstance: any;
  statusChartInstance: any;
  customersChartInstance: any;
  promotionChartInstance: any;
  topProductsChartInstance: any;

  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  timePeriod: 'current' | 'previous' = 'current';

  // Customers chart settings - filter by week
  selectedYearCustomers: number = new Date().getFullYear();
  selectedMonthCustomers: number = new Date().getMonth() + 1;
  selectedWeekCustomers: number = 1; // Tuần được chọn (1-4 hoặc 5)

  // Orders chart settings - filter by week
  selectedYearOrders: number = new Date().getFullYear();
  selectedMonthOrders: number = new Date().getMonth() + 1;
  selectedWeekOrders: number = 1; // Tuần được chọn (1-4 hoặc 5)

  // Computed start/end days based on selected week
  startDayCustomers: number = 1;
  endDayCustomers: number = 7;
  startDayOrders: number = 1;
  endDayOrders: number = 7;

  // Orders data for chart
  allOrders: any[] = [];
  recentOrders: any[] = [];

  // Users data for mapping
  allUsers: any[] = [];

  // Reviews data
  recentReviews: any[] = [];

  // Products data
  allProducts: any[] = [];
  topProducts: any[] = [];
  outOfStockProducts: any[] = [];
  outOfStockCount: number = 0; // Số sản phẩm hết hàng (quantity = 0)
  lowStockCount: number = 0; // Số sản phẩm sắp hết hàng (quantity > 0 và < 10)

  // Promotions data
  allPromotions: any[] = [];

  // Customers chart data
  customersByDay: number[] = [];
  customersChartLabels: string[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Dynamic labels based on actual week days

  // Cached weeks data để tránh tính toán lại nhiều lần
  availableWeeksCustomers: Array<{
    week: number;
    startDay: number;
    endDay: number;
    label: string;
  }> = [];
  availableWeeksOrders: Array<{ week: number; startDay: number; endDay: number; label: string }> =
    [];

  // Widget system
  showAddWidgetModal = false;
  widgets: any[] = [
    {
      id: 'revenue-line',
      type: 'line',
      title: 'Doanh thu',
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      chartType: 'line',
    }, // Default widget với kích thước lớn hơn minimum
  ];
  nextWidgetId = 1;

  // Grid settings - cells background
  gridCols = 12;
  gridCellSize = 80; // Size của mỗi ô (pixels) - 80px height + 20px gap = 100px total
  gridGap = 20; // Gap giữa các cells
  minWidgetCells = 4; // Widget nhỏ nhất là 4 ô (2x2 hoặc 4x1)

  // Available chart types
  chartTypes = [
    { id: 'line', name: 'Biểu đồ Đường', icon: '📈' },
    { id: 'bar', name: 'Biểu đồ Cột', icon: '📊' },
    { id: 'column', name: 'Biểu đồ Thanh', icon: '📋' },
    { id: 'pie', name: 'Biểu đồ Tròn', icon: '🥧' },
  ];

  // Drag and drop state
  draggedWidget: any = null;
  draggedOverWidget: any = null;

  // Orders data
  ordersCount: number = 0;
  ordersChangePercent: number = 0;
  ordersChangeType: 'positive' | 'negative' = 'positive';

  // Products data
  productsCount: number = 0;
  productsChangePercent: number = 0;
  productsChangeType: 'positive' | 'negative' = 'positive';

  // Revenue data
  revenueTotal: number = 0; // Tổng doanh thu tất cả orders
  revenueDisplay: string = '0đ'; // Format hiển thị với VNĐ
  revenueChangePercent: number = 0;
  revenueChangeType: 'positive' | 'negative' = 'positive';

  // Buyers data
  buyersCount: number = 0;
  buyersChangePercent: number = 0;
  buyersChangeType: 'positive' | 'negative' = 'positive';

  // Auto-refresh interval (5 seconds)
  private readonly REFRESH_INTERVAL = 5000;

  // Real-time update state
  isRefreshing: boolean = false;
  lastUpdateTime: Date | null = null;
  updateError: string | null = null;

  months: string[] = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ];

  availableYears: number[] = [];

  ngOnInit() {
    // Tạo danh sách năm từ năm hiện tại trở về trước 10 năm
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      this.availableYears.push(currentYear - i);
    }

    // Khởi tạo giá trị mặc định cho week range
    this.updateWeekRangeCustomers();
    this.updateWeekRangeOrders();

    // Load widget layout từ localStorage
    this.loadWidgetLayout();

    // Load dashboard data (orders và users)
    this.loadDashboardData();

    // Set up auto-refresh để tự động cập nhật khi có thay đổi
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    // Cleanup: dừng auto-refresh khi component bị destroy
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  /**
   * Start auto-refresh để tự động cập nhật dữ liệu theo thời gian thực
   * Sử dụng RxJS operators để tối ưu hiệu suất và tránh race conditions
   */
  startAutoRefresh(): void {
    // Tạo interval với debounce và switchMap để tránh multiple concurrent requests
    this.refreshSubscription = interval(this.REFRESH_INTERVAL)
      .pipe(
        debounceTime(100), // Debounce để tránh quá nhiều requests
        switchMap(() => {
          // Nếu đang refresh, bỏ qua request này
          if (this.isRefreshing) {
            return of(null);
          }
          // Đánh dấu đang refresh và thực hiện request
          this.isRefreshing = true;
          this.updateError = null;
          return of(true);
        })
      )
      .subscribe((shouldRefresh) => {
        if (shouldRefresh) {
          this.loadDashboardData();
        }
      });
  }

  /**
   * Load all dashboard data from MongoDB theo thời gian thực
   * Tối ưu: Load tất cả dữ liệu song song để cải thiện hiệu suất
   */
  loadDashboardData(): void {
    // Load tất cả dữ liệu song song với forkJoin để tối ưu hiệu suất
    forkJoin({
      orders: this.apiService.getOrders().pipe(
        retry(2), // Retry 2 lần nếu lỗi
        catchError((error) => {
          console.error('Error loading orders:', error);
          this.updateError = 'Lỗi tải dữ liệu đơn hàng';
          return of([]);
        })
      ),
      users: this.apiService.getUsers().pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading users:', error);
          return of([]);
        })
      ),
      products: this.apiService.getProducts().pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading products:', error);
          return of([]);
        })
      ),
      promotions: this.apiService.getPromotions().pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading promotions:', error);
          return of([]);
        })
      ),
    }).subscribe({
      next: (data) => {
        // Cập nhật thời gian refresh cuối cùng
        this.lastUpdateTime = new Date();
        this.isRefreshing = false;
        this.updateError = null;

        // Xử lý orders data - đảm bảo luôn là array
        let orders = data.orders || [];
        if (!Array.isArray(orders)) {
          console.warn('⚠️ [Dashboard] Orders data is not an array:', orders);
          orders = [];
        }

        // Đảm bảo allOrders luôn là array trước khi slice
        const previousOrdersCount = Array.isArray(this.allOrders) ? this.allOrders.length : 0;
        const previousOrderIds =
          Array.isArray(this.allOrders) && this.allOrders.length > 0
            ? this.allOrders.slice(0, 5).map((o) => o.order_id || o._id || o.id || o.OrderID)
            : [];

        this.allOrders = Array.isArray(orders) ? orders : [];

        // Chỉ update charts nếu dữ liệu thay đổi (so sánh số lượng và một số orders đầu tiên)
        const ordersChanged =
          previousOrdersCount !== orders.length ||
          (orders.length > 0 &&
            previousOrdersCount > 0 &&
            JSON.stringify(previousOrderIds) !==
              JSON.stringify(orders.slice(0, 5).map((o) => o.order_id || o._id || o.id)));

        // Tính toán stats từ orders
        this.calculateOrdersStats(orders);

        // Load và cập nhật recent orders
        this.loadRecentOrders();

        // Load reviews sẽ được gọi riêng vì cần load từ API riêng
        // (reviews không được load trong forkJoin vì cấu trúc khác)
        this.loadRecentReviews();

        // Cập nhật charts chỉ khi cần thiết
        if (ordersChanged || !this.chart) {
          if (this.chart) {
            this.updateChart();
          }
        }

        if (ordersChanged || !this.ordersChartInstance) {
          if (this.ordersChartInstance) {
            this.updateOrdersChart();
          }
        }

        // Update status pie chart
        if (ordersChanged || !this.statusChartInstance) {
          if (this.statusChartInstance) {
            this.updateStatusChart();
          }
        }

        // Xử lý users data - đảm bảo luôn là array
        let users = data.users || [];
        if (!Array.isArray(users)) {
          console.warn('⚠️ [Dashboard] Users data is not an array:', users);
          users = [];
        }
        const previousUsersCount = Array.isArray(this.allUsers) ? this.allUsers.length : 0;
        this.allUsers = Array.isArray(users) ? users : []; // Lưu users để dùng cho mapping
        this.calculateUsersStats(users);

        // Calculate customers by day of week (based on new account registrations)
        const usersChanged = previousUsersCount !== users.length;
        this.calculateCustomersByDay();
        if (usersChanged || ordersChanged || !this.customersChartInstance) {
          if (this.customersChartInstance) {
            this.updateCustomersChart();
          }
        }

        // Xử lý products data - đảm bảo luôn là array
        let products = data.products || [];
        if (!Array.isArray(products)) {
          console.warn('⚠️ [Dashboard] Products data is not an array:', products);
          products = [];
        }
        const previousProductsCount = Array.isArray(this.allProducts) ? this.allProducts.length : 0;
        this.allProducts = Array.isArray(products) ? products : [];
        const productsChanged = previousProductsCount !== products.length;

        if (productsChanged) {
          this.calculateProductsStats(products);
          this.calculateTopProducts();
          this.calculateOutOfStockProducts();

          if (this.topProductsChartInstance) {
            this.updateTopProductsChart();
          }
        }

        // Xử lý promotions data - đảm bảo luôn là array
        let promotions = data.promotions || [];
        if (!Array.isArray(promotions)) {
          console.warn('⚠️ [Dashboard] Promotions data is not an array:', promotions);
          promotions = [];
        }
        const previousPromotionsCount = Array.isArray(this.allPromotions)
          ? this.allPromotions.length
          : 0;
        this.allPromotions = Array.isArray(promotions) ? promotions : [];
        const promotionsChanged = previousPromotionsCount !== promotions.length;

        if (promotionsChanged && this.promotionChartInstance) {
          this.updatePromotionChart();
        }

        console.log('✅ Dashboard data refreshed:', {
          orders: orders.length,
          users: users.length,
          products: products.length,
          promotions: promotions.length,
          timestamp: this.lastUpdateTime.toISOString(),
        });
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isRefreshing = false;
        this.updateError = 'Lỗi kết nối server. Đang thử lại...';

        // Initialize empty data để tránh crash - đảm bảo luôn là array
        this.allOrders = Array.isArray(this.allOrders) ? this.allOrders : [];
        this.allUsers = Array.isArray(this.allUsers) ? this.allUsers : [];
        this.allProducts = Array.isArray(this.allProducts) ? this.allProducts : [];
        this.allPromotions = Array.isArray(this.allPromotions) ? this.allPromotions : [];
        this.ordersCount = this.ordersCount || 0;
        this.productsCount = this.productsCount || 0;
        this.revenueTotal = this.revenueTotal || 0;
        this.revenueDisplay = this.revenueDisplay || '0đ';
      },
    });
  }

  /**
   * Load users data from MongoDB (đã được tích hợp vào loadDashboardData)
   * Giữ lại để tương thích ngược
   */
  loadUsersData(): void {
    this.apiService
      .getUsers()
      .pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading users:', error);
          this.buyersCount = 0;
          return of([]);
        })
      )
      .subscribe({
        next: (users) => {
          this.calculateUsersStats(users);
        },
      });
  }

  /**
   * Calculate users statistics - Today vs Yesterday
   */
  calculateUsersStats(users: any[]): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Filter users by registration date
    const todayUsers = users.filter((user) => {
      const userDate = this.parseUserDate(user);
      return userDate >= today && userDate < tomorrow;
    });

    const yesterdayUsers = users.filter((user) => {
      const userDate = this.parseUserDate(user);
      return userDate >= yesterday && userDate < today;
    });

    // Hiển thị tổng số users trong collection
    this.buyersCount = users.length;

    // Tính phần trăm thay đổi: so sánh số người dùng mới hôm nay vs hôm qua
    this.calculateChangeStats(todayUsers.length, yesterdayUsers.length, 'buyers');

    // Log để debug
    console.log(`📊 Total users: ${users.length}`);
    console.log(
      `📊 Today new users: ${todayUsers.length}, Yesterday new users: ${yesterdayUsers.length}`
    );
  }

  /**
   * Parse user registration date from various formats
   */
  parseUserDate(user: any): Date {
    // Check multiple possible field names for registration date (prioritize RegisterDate from MongoDB)
    let dateStr =
      user.RegisterDate ||
      user.register_date ||
      user.registerDate ||
      user.created_at ||
      user.createdAt ||
      user.date ||
      user.createdDate ||
      user.created_date;

    if (!dateStr) {
      // Nếu không có date, trả về ngày xa trong quá khứ để không bị tính vào hôm nay
      return new Date(0);
    }

    // Handle MongoDB date format { $date: "..." }
    if (typeof dateStr === 'object' && dateStr.$date) {
      const date = new Date(dateStr.$date);
      if (!isNaN(date.getTime())) {
        // Convert to local date to avoid timezone issues
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        localDate.setHours(0, 0, 0, 0);
        return localDate;
      }
    }

    // Handle different date formats
    if (typeof dateStr === 'string') {
      // Try YYYY-MM-DD format (phổ biến nhất từ MongoDB)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const day = parseInt(parts[2]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          return date;
        }
      }

      // Try DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          return date;
        }
      }

      // Try ISO format (2025-01-15T00:00:00.000Z)
      // Important: Parse as local date, not UTC, to match date comparison logic
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Convert to local date (ignore timezone, use local date components)
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        localDate.setHours(0, 0, 0, 0);
        return localDate;
      }
    }

    // Try to parse as Date object directly
    if (dateStr instanceof Date) {
      // Convert to local date to avoid timezone issues
      const localDate = new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
      localDate.setHours(0, 0, 0, 0);
      return localDate;
    }

    // Nếu không parse được, trả về ngày xa trong quá khứ
    console.warn('Could not parse user date:', dateStr, user);
    return new Date(0);
  }

  /**
   * Load orders data from MongoDB (for backward compatibility)
   */
  loadOrdersData(): void {
    this.loadDashboardData();
  }

  /**
   * Calculate orders statistics (Orders, Visitors, Revenue) - Today vs Yesterday
   */
  calculateOrdersStats(orders: any[]): void {
    // Đảm bảo orders là array
    if (!Array.isArray(orders)) {
      console.warn('⚠️ [Dashboard] calculateOrdersStats: orders is not an array:', orders);
      orders = [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Filter orders by date - chính xác hơn với comparison
    const todayOrders = orders.filter((order) => {
      const orderDate = this.parseOrderDate(order);
      // Kiểm tra nếu orderDate nằm trong ngày hôm nay (>= today và < tomorrow)
      return orderDate >= today && orderDate < tomorrow;
    });

    const yesterdayOrders = orders.filter((order) => {
      const orderDate = this.parseOrderDate(order);
      // Kiểm tra nếu orderDate nằm trong ngày hôm qua (>= yesterday và < today)
      return orderDate >= yesterday && orderDate < today;
    });

    // 1. Orders - Số đơn hàng hôm nay
    this.calculateChangeStats(todayOrders.length, yesterdayOrders.length, 'orders');

    // 2. Visitors - Số đơn hàng hôm nay (proxy cho visitors)
    this.calculateChangeStats(todayOrders.length, yesterdayOrders.length, 'visitors');

    // 3. Revenue - Tổng doanh thu từ các đơn hàng ĐÃ THANH TOÁN (completed/delivered)
    // Loại bỏ các đơn hàng hủy (cancelled) hoặc hoàn tiền (refunded)
    const paidOrders = orders.filter((order) => {
      const status = order.status || order.order_status || '';
      // Chỉ tính các đơn hàng đã thanh toán
      return status === 'completed' || status === 'delivered';
    });

    const totalRevenue = paidOrders.reduce((sum, order) => {
      const total =
        order.totalAmount ||
        order.total_amount ||
        order.total_price ||
        order.total ||
        order.order_total ||
        0;
      return (
        sum +
        (typeof total === 'number'
          ? total
          : parseFloat(String(total).replace(/[^0-9.-]/g, '')) || 0)
      );
    }, 0);

    // Tính doanh thu hôm nay và hôm qua để so sánh phần trăm (chỉ đơn hàng đã thanh toán)
    const todayPaidOrders = todayOrders.filter((order) => {
      const status = order.status || order.order_status || '';
      return status === 'completed' || status === 'delivered';
    });

    const yesterdayPaidOrders = yesterdayOrders.filter((order) => {
      const status = order.status || order.order_status || '';
      return status === 'completed' || status === 'delivered';
    });

    const todayRevenue = todayPaidOrders.reduce((sum, order) => {
      const total =
        order.totalAmount ||
        order.total_amount ||
        order.total_price ||
        order.total ||
        order.order_total ||
        0;
      return (
        sum +
        (typeof total === 'number'
          ? total
          : parseFloat(String(total).replace(/[^0-9.-]/g, '')) || 0)
      );
    }, 0);

    const yesterdayRevenue = yesterdayPaidOrders.reduce((sum, order) => {
      const total =
        order.totalAmount ||
        order.total_amount ||
        order.total_price ||
        order.total ||
        order.order_total ||
        0;
      return (
        sum +
        (typeof total === 'number'
          ? total
          : parseFloat(String(total).replace(/[^0-9.-]/g, '')) || 0)
      );
    }, 0);

    // Tính phần trăm thay đổi: so sánh doanh thu hôm nay vs hôm qua
    this.calculateChangeStats(todayRevenue, yesterdayRevenue, 'revenue');

    // Update counts - HIỂN THỊ TỔNG SỐ ĐƠN HÀNG TRONG COLLECTION (tất cả, không chỉ hôm nay)
    this.ordersCount = orders.length; // Tổng số đơn hàng trong collection

    // Hiển thị tổng doanh thu từ tất cả orders
    this.revenueTotal = totalRevenue;
    this.revenueDisplay = this.formatCurrency(totalRevenue);

    // buyersCount sẽ được cập nhật trong calculateUsersStats()

    // Log để debug
    console.log(`📊 Total orders in collection: ${orders.length}`);
    console.log(
      `📊 Today: ${todayOrders.length} orders, Yesterday: ${yesterdayOrders.length} orders`
    );
  }

  /**
   * Calculate change statistics for any metric
   * Tính phần trăm thay đổi: ((Hôm nay - Hôm qua) / Hôm qua) * 100
   */
  calculateChangeStats(
    todayValue: number,
    yesterdayValue: number,
    type: 'orders' | 'visitors' | 'revenue' | 'buyers' | 'products'
  ): void {
    let changePercent = 0;
    let changeType: 'positive' | 'negative' = 'positive';

    // Xử lý trường hợp hôm qua có 0 hoặc không có dữ liệu
    if (yesterdayValue === 0) {
      if (todayValue > 0) {
        // Nếu hôm nay có đơn hàng nhưng hôm qua không có, tính là tăng 100%
        changePercent = 100;
        changeType = 'positive';
      } else {
        // Cả hai đều 0, không thay đổi
        changePercent = 0;
        changeType = 'positive';
      }
    } else {
      // Tính phần trăm thay đổi: ((Hôm nay - Hôm qua) / Hôm qua) * 100
      const change = ((todayValue - yesterdayValue) / yesterdayValue) * 100;
      changePercent = Math.abs(change);
      changeType = change >= 0 ? 'positive' : 'negative';
    }

    // Làm tròn đến 1 chữ số thập phân để tránh sai số
    changePercent = Math.round(changePercent * 10) / 10;

    // Nếu changePercent rất nhỏ (< 0.1), coi như không thay đổi
    if (changePercent < 0.1) {
      changePercent = 0;
      changeType = 'positive'; // "Không thay đổi" luôn là positive (màu xanh)
    }

    // Update the appropriate property
    switch (type) {
      case 'orders':
        this.ordersChangePercent = changePercent;
        this.ordersChangeType = changeType;
        break;
      case 'visitors':
        // Deprecated - no longer used
        break;
      case 'products':
        this.productsChangePercent = changePercent;
        this.productsChangeType = changeType;
        break;
      case 'revenue':
        this.revenueChangePercent = changePercent;
        this.revenueChangeType = changeType;
        break;
      case 'buyers':
        this.buyersChangePercent = changePercent;
        this.buyersChangeType = changeType;
        break;
    }
  }

  /**
   * Parse order date from various formats
   * Hỗ trợ: YYYY-MM-DD, DD/MM/YYYY, ISO date, MongoDB date format
   * Sử dụng local date để tránh timezone issues
   */
  parseOrderDate(order: any): Date {
    // Thử nhiều trường date khác nhau - ưu tiên createdAt từ MongoDB
    // Xử lý createdAt với format MongoDB $date
    if (order.createdAt) {
      if (typeof order.createdAt === 'object' && order.createdAt.$date) {
        return new Date(order.createdAt.$date);
      }
      if (order.createdAt instanceof Date) {
        return order.createdAt;
      }
    }

    let dateStr =
      order.createdAt ||
      order.created_at ||
      order.order_date ||
      order.orderDate ||
      order.OrderDate ||
      order.CreatedAt ||
      order.date ||
      order.createdDate ||
      order.Date;

    if (!dateStr) {
      // Nếu không có date, trả về ngày xa trong quá khứ để không bị tính vào hôm nay
      console.warn('⚠️ Order has no date field:', order.order_id || order.OrderID || order.id);
      return new Date(0);
    }

    // Handle MongoDB date format { $date: "..." }
    if (typeof dateStr === 'object' && dateStr.$date) {
      dateStr = dateStr.$date;
    }

    // Handle different date formats
    if (typeof dateStr === 'string') {
      // Try YYYY-MM-DD format (phổ biến nhất từ MongoDB)
      // QUAN TRỌNG: Parse trực tiếp thành local date để tránh timezone shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);

        // Tạo local date trực tiếp (tránh timezone conversion)
        const date = new Date(year, month, day, 0, 0, 0, 0);
        if (!isNaN(date.getTime())) {
          return date; // Đã là local date, không cần setHours
        }
      }

      // Try DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        // Tạo local date trực tiếp
        const date = new Date(year, month, day, 0, 0, 0, 0);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // Try ISO format (2025-01-15T00:00:00.000Z)
      // Nếu có timezone, parse và convert về local
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Nếu date string có timezone info, tạo local date từ components
        if (dateStr.includes('T')) {
          const localDate = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          );
          return localDate;
        }
        // Nếu không có timezone, date đã là local
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }

    // Try to parse as Date object directly
    if (dateStr instanceof Date) {
      // Tạo local date từ components để tránh timezone issues
      const localDate = new Date(
        dateStr.getFullYear(),
        dateStr.getMonth(),
        dateStr.getDate(),
        0,
        0,
        0,
        0
      );
      return localDate;
    }

    // Nếu không parse được, trả về ngày xa trong quá khứ
    console.warn('⚠️ Could not parse order date:', dateStr, order);
    return new Date(0);
  }

  /**
   * Format currency (VND) - xử lý số 0 và giá trị không hợp lệ
   */
  formatCurrency(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined || amount === '') {
      return '0đ';
    }

    // Convert to number
    const numAmount =
      typeof amount === 'string'
        ? parseFloat(amount.toString().replace(/[^0-9.-]/g, ''))
        : Number(amount);

    // Check if valid number
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      return '0đ';
    }

    // Format với VNĐ
    return Math.round(numAmount).toLocaleString('vi-VN') + 'đ';
  }

  /**
   * Format order time for display - xử lý nhiều format date khác nhau
   */
  formatOrderTime(dateStr: string | Date | any): string {
    if (!dateStr) return 'Chưa có thông tin';

    try {
      let date: Date;

      // Handle MongoDB date format { $date: "..." }
      if (typeof dateStr === 'object' && dateStr.$date) {
        dateStr = dateStr.$date;
      }

      // Handle Date object
      if (dateStr instanceof Date) {
        date = dateStr;
      }
      // Handle string formats
      else if (typeof dateStr === 'string') {
        // Try YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          date = new Date(dateStr + 'T00:00:00');
        }
        // Try ISO format with time
        else if (dateStr.includes('T')) {
          date = new Date(dateStr);
        }
        // Try other formats
        else {
          date = new Date(dateStr);
        }
      }
      // Handle other object formats
      else {
        return 'Chưa có thông tin';
      }

      if (isNaN(date.getTime())) {
        return 'Chưa có thông tin';
      }

      // Format với date và time
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting order time:', error, dateStr);
      return 'Chưa có thông tin';
    }
  }

  /**
   * Load recent orders (latest 5 orders) với format đúng
   */
  loadRecentOrders(): void {
    // Đảm bảo allOrders là array
    if (!Array.isArray(this.allOrders) || this.allOrders.length === 0) {
      this.recentOrders = [];
      return;
    }

    // Sort by date descending (newest first)
    const sortedOrders = [...this.allOrders].sort((a, b) => {
      const dateA = this.parseOrderDate(a);
      const dateB = this.parseOrderDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    // Get latest 5 orders và format dữ liệu
    this.recentOrders = sortedOrders.slice(0, 5).map((order) => ({
      ...order,
      // Đảm bảo có order_id
      order_id:
        order.order_id || order.OrderID || order._id?.$oid || order._id || order.id || 'N/A',
      // Đảm bảo có total_amount - ưu tiên totalAmount từ MongoDB
      total_amount:
        order.totalAmount ||
        order.total_amount ||
        order.total_price ||
        order.total ||
        order.order_total ||
        0,
      // Đảm bảo có date - thử nhiều trường khác nhau
      order_date:
        order.order_date ||
        order.orderDate ||
        order.OrderDate ||
        order.created_at ||
        order.createdAt ||
        order.CreatedAt ||
        order.date ||
        order.createdDate ||
        order.Date ||
        null,
    }));
  }

  /**
   * Load recent reviews from reviews collection (MongoDB)
   */
  loadRecentReviews(): void {
    console.log('🔄 Loading recent reviews from MongoDB...');

    // Load from MongoDB API
    this.apiService.getReviews().subscribe({
      next: (reviewsData) => {
        console.log(`✅ Loaded ${reviewsData.length} review documents from MongoDB`);
        if (Array.isArray(reviewsData) && reviewsData.length > 0) {
          this.processReviewsData(reviewsData);
        } else {
          console.warn('⚠️ No reviews data found');
          this.recentReviews = [];
        }
      },
      error: (error) => {
        console.error('❌ Error loading reviews from MongoDB:', error);
        this.recentReviews = [];
      },
    });
  }

  /**
   * Process reviews data: flatten, sort, and format for display
   */
  processReviewsData(reviewsData: any[]): void {
    // Flatten reviews: mỗi document có sku và mảng reviews[]
    const allReviews: any[] = [];

    reviewsData.forEach((reviewDoc: any) => {
      if (reviewDoc.reviews && Array.isArray(reviewDoc.reviews)) {
        reviewDoc.reviews.forEach((review: any) => {
          allReviews.push({
            ...review,
            sku: reviewDoc.sku,
          });
        });
      }
    });

    console.log(`📊 Total reviews found: ${allReviews.length}`);

    // Filter out reviews with future dates (only show reviews from current time and earlier)
    const now = new Date();
    const validReviews = allReviews.filter((review) => {
      const reviewDate = this.parseReviewDate(review);
      // Only include reviews with date <= current time
      const isValid = reviewDate.getTime() <= now.getTime();
      if (!isValid) {
        console.warn(
          `⚠️ Filtered out review with future date: ${reviewDate.toISOString()} (current: ${now.toISOString()})`
        );
      }
      return isValid;
    });

    console.log(
      `📊 Valid reviews (not in future): ${validReviews.length} (filtered out ${
        allReviews.length - validReviews.length
      } future reviews)`
    );

    // Sort by time descending (newest first)
    validReviews.sort((a, b) => {
      const dateA = this.parseReviewDate(a);
      const dateB = this.parseReviewDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    // Get latest 4 reviews (như trong hình ảnh)
    const latestReviews = validReviews.slice(0, 4);

    // Map và format reviews để hiển thị
    this.recentReviews = latestReviews.map((review) => {
      // Lấy tên người đánh giá từ fullname
      let customerName = review.fullname || review.full_name || 'Khách vãng lai';

      // Nếu có customer_id, thử map với users để lấy tên đầy đủ hơn
      const customerID = review.customer_id || review.CustomerID;
      if (customerID && this.allUsers && this.allUsers.length > 0) {
        const user = this.allUsers.find(
          (u) => (u.CustomerID || u.customer_id || u.customerId) === customerID
        );
        if (user) {
          customerName =
            user.FullName || user.full_name || user.fullName || user.name || customerName;
        }
      }

      // Lấy thời gian từ trường time của review
      const reviewTime = review.time || review.created_at || review.date;

      return {
        full_name: customerName,
        rating: review.rating || 5,
        review_date: reviewTime, // Lưu time gốc để format
        time: reviewTime, // Đảm bảo có trường time
        sku: review.sku,
        customer_id: customerID,
      };
    });

    console.log(`✅ Processed ${this.recentReviews.length} recent reviews for display`);
  }

  /**
   * Parse review date from various formats
   */
  parseReviewDate(review: any): Date {
    // Lấy time từ review (có thể là string, object với $date, hoặc Date)
    const timeField = review.time || review.review_date || review.created_at || review.date;

    if (!timeField) {
      return new Date(0); // Return epoch date if no date found
    }

    // Nếu đã là Date object
    if (timeField instanceof Date) {
      return timeField;
    }

    // Nếu là object với $date (MongoDB format)
    if (typeof timeField === 'object' && timeField.$date) {
      return new Date(timeField.$date);
    }

    // Nếu là string
    if (typeof timeField === 'string') {
      // Handle MongoDB date format with $date trong string
      if (timeField.includes('$date')) {
        try {
          const parsed = JSON.parse(timeField);
          if (parsed.$date) {
            return new Date(parsed.$date);
          }
        } catch (e) {
          // If parsing fails, try direct date parse
        }
      }

      // Try parsing ISO string
      const date = new Date(timeField);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Fallback to current date
    return new Date();
  }

  /**
   * Format review time for display
   */
  formatReviewTime(dateInput: string | Date | any): string {
    if (!dateInput) return '';

    try {
      let date: Date;

      // If already a Date object
      if (dateInput instanceof Date) {
        date = dateInput;
      }
      // Handle MongoDB date format with $date
      else if (typeof dateInput === 'object' && dateInput.$date) {
        date = new Date(dateInput.$date);
      }
      // Handle string date
      else if (typeof dateInput === 'string') {
        // Parse date string (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          date = new Date(dateInput + 'T00:00:00');
        } else if (dateInput.includes('T')) {
          // ISO format with time
          date = new Date(dateInput);
        } else {
          date = new Date(dateInput);
        }
      } else {
        return '';
      }

      if (isNaN(date.getTime())) {
        return '';
      }

      // Format as DD-MM-YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    } catch (e) {
      return '';
    }
  }

  /**
   * Get stars array for rating display
   */
  getStars(rating: number): string[] {
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? 'filled' : 'empty');
    }
    return stars;
  }

  /**
   * Get available weeks for a specific month/year
   * Tuần đầu tiên luôn bắt đầu từ ngày 1 tháng, mỗi tuần kéo dài 7 ngày
   */
  getAvailableWeeks(
    year: number,
    month: number
  ): Array<{ week: number; startDay: number; endDay: number; label: string }> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks: Array<{ week: number; startDay: number; endDay: number; label: string }> = [];

    // Tuần đầu tiên luôn bắt đầu từ ngày 1
    let currentStartDay = 1;
    let weekNumber = 1;

    while (currentStartDay <= daysInMonth) {
      const endDay = Math.min(currentStartDay + 6, daysInMonth);
      weeks.push({
        week: weekNumber,
        startDay: currentStartDay,
        endDay: endDay,
        label: `Tuần ${weekNumber} (${currentStartDay}-${endDay})`,
      });
      currentStartDay += 7;
      weekNumber++;
    }

    return weeks;
  }

  /**
   * Update cached weeks for customers chart
   */
  updateAvailableWeeksCustomers(): void {
    this.availableWeeksCustomers = this.getAvailableWeeks(
      this.selectedYearCustomers,
      this.selectedMonthCustomers
    );
  }

  /**
   * Update cached weeks for orders chart
   */
  updateAvailableWeeksOrders(): void {
    this.availableWeeksOrders = this.getAvailableWeeks(
      this.selectedYearOrders,
      this.selectedMonthOrders
    );
  }

  /**
   * Update start/end days based on selected week
   */
  updateWeekRangeCustomers(): void {
    this.updateAvailableWeeksCustomers();
    if (
      this.availableWeeksCustomers.length > 0 &&
      this.selectedWeekCustomers > 0 &&
      this.selectedWeekCustomers <= this.availableWeeksCustomers.length
    ) {
      const selectedWeek = this.availableWeeksCustomers[this.selectedWeekCustomers - 1];
      this.startDayCustomers = selectedWeek.startDay;
      this.endDayCustomers = selectedWeek.endDay;
    }
  }

  /**
   * Update start/end days based on selected week for orders
   */
  updateWeekRangeOrders(): void {
    this.updateAvailableWeeksOrders();
    if (
      this.availableWeeksOrders.length > 0 &&
      this.selectedWeekOrders > 0 &&
      this.selectedWeekOrders <= this.availableWeeksOrders.length
    ) {
      const selectedWeek = this.availableWeeksOrders[this.selectedWeekOrders - 1];
      this.startDayOrders = selectedWeek.startDay;
      this.endDayOrders = selectedWeek.endDay;
    }
  }

  /**
   * Handle year change for customers chart
   */
  onYearChangeCustomers(): void {
    // Update week range
    this.updateWeekRangeCustomers();
    // Reset to week 1 if current week doesn't exist
    if (this.selectedWeekCustomers > this.availableWeeksCustomers.length) {
      this.selectedWeekCustomers = 1;
      this.updateWeekRangeCustomers();
    }
    this.calculateCustomersByDay();
    if (this.customersChartInstance) {
      this.updateCustomersChart();
    }
  }

  /**
   * Handle month change for customers chart
   */
  onMonthChangeCustomers(): void {
    // Update week range
    this.updateWeekRangeCustomers();
    // Reset to week 1 if current week doesn't exist
    if (this.selectedWeekCustomers > this.availableWeeksCustomers.length) {
      this.selectedWeekCustomers = 1;
      this.updateWeekRangeCustomers();
    }
    this.calculateCustomersByDay();
    if (this.customersChartInstance) {
      this.updateCustomersChart();
    }
  }

  /**
   * Handle week change for customers chart
   */
  onWeekChangeCustomers(): void {
    this.updateWeekRangeCustomers();
    this.calculateCustomersByDay();
    if (this.customersChartInstance) {
      this.updateCustomersChart();
    }
  }

  /**
   * Handle year change for orders chart
   */
  onYearChangeOrders(): void {
    // Update week range
    this.updateWeekRangeOrders();
    // Reset to week 1 if current week doesn't exist
    if (this.selectedWeekOrders > this.availableWeeksOrders.length) {
      this.selectedWeekOrders = 1;
      this.updateWeekRangeOrders();
    }
    this.updateOrdersChart();
  }

  /**
   * Handle month change for orders chart
   */
  onMonthChangeOrders(): void {
    // Update week range
    this.updateWeekRangeOrders();
    // Reset to week 1 if current week doesn't exist
    if (this.selectedWeekOrders > this.availableWeeksOrders.length) {
      this.selectedWeekOrders = 1;
      this.updateWeekRangeOrders();
    }
    this.updateOrdersChart();
  }

  /**
   * Handle week change for orders chart
   */
  onWeekChangeOrders(): void {
    this.updateWeekRangeOrders();
    this.updateOrdersChart();
  }

  /**
   * Calculate orders count by day for a specific month
   */
  calculateOrdersByDay(orders: any[], year: number, month: number): number[] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const ordersByDay = new Array(daysInMonth).fill(0);

    if (!orders || orders.length === 0) {
      return ordersByDay;
    }

    orders.forEach((order) => {
      const orderDate = this.parseOrderDate(order);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth() + 1;

      if (Number(orderYear) === Number(year) && Number(orderMonth) === Number(month)) {
        const day = orderDate.getDate() - 1; // Array index (0-based)
        if (day >= 0 && day < daysInMonth) {
          ordersByDay[day]++;
        }
      }
    });

    return ordersByDay;
  }

  /**
   * Calculate orders count by day of week - filter by date range
   */
  calculateOrdersByWeekDay(orders: any[]): { labels: string[]; data: number[] } {
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // Tạo date range từ các filter
    const startDate = new Date(
      this.selectedYearOrders,
      this.selectedMonthOrders - 1,
      this.startDayOrders
    );
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(
      this.selectedYearOrders,
      this.selectedMonthOrders - 1,
      this.endDayOrders
    );
    endDate.setHours(23, 59, 59, 999);

    // Calculate labels based on actual days in the selected week
    // Get the day of week for the first day of the selected week
    const firstDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Create labels array starting from the first day of the selected week
    const labels: string[] = [];
    const daysInWeek = Math.min(7, this.endDayOrders - this.startDayOrders + 1);
    for (let i = 0; i < daysInWeek; i++) {
      const dayIndex = (firstDayOfWeek + i) % 7;
      labels.push(dayLabels[dayIndex]);
    }

    console.log(
      `📦 [Orders Chart] First day of week: ${dayLabels[firstDayOfWeek]} (day ${this.startDayOrders})`
    );
    console.log(`📦 [Orders Chart] Chart labels: ${labels.join(', ')}`);

    // Initialize data array with zeros for each day in the week
    const ordersByDay = new Array(daysInWeek).fill(0);

    if (!orders || orders.length === 0) {
      return {
        labels: labels,
        data: ordersByDay,
      };
    }

    // Đảm bảo orders là array trước khi forEach
    if (!Array.isArray(orders)) {
      console.warn('⚠️ [Dashboard] calculateOrdersByWeekDay: orders is not an array:', orders);
      return { labels: labels, data: ordersByDay };
    }

    // Filter orders theo date range và tính theo vị trí trong tuần (0 = ngày đầu, 1 = ngày thứ 2, ...)
    orders.forEach((order) => {
      try {
        const orderDate = this.parseOrderDate(order);

        // Kiểm tra nếu order nằm trong khoảng thời gian được chọn
        if (orderDate >= startDate && orderDate <= endDate) {
          // Calculate which day in the week (0 = first day, 1 = second day, etc.)
          const dayDiff = Math.floor(
            (orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (dayDiff >= 0 && dayDiff < daysInWeek) {
            ordersByDay[dayDiff]++;
          }
        }
      } catch (e) {
        console.error('Error parsing order date:', e);
      }
    });

    console.log(`📦 [Orders Chart] Orders by day:`, ordersByDay);
    console.log(`📦 [Orders Chart] Labels:`, labels);

    return { labels: labels, data: ordersByDay };
  }

  /**
   * Create orders chart (line chart showing order count by day)
   */
  createOrdersChart() {
    if (!this.ordersChart || !this.ordersChart.nativeElement) {
      console.warn('⚠️ Orders chart element not found');
      return;
    }

    const ctx = this.ordersChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Cannot get 2D context for orders chart');
      return;
    }

    this.updateOrdersChart();
  }

  /**
   * Update orders chart with data (7 days of week as bar chart)
   */
  updateOrdersChart() {
    if (!this.ordersChart || !this.ordersChart.nativeElement) return;

    // Đảm bảo allOrders là array
    if (!Array.isArray(this.allOrders)) {
      console.warn('⚠️ [Dashboard] updateOrdersChart: allOrders is not an array:', this.allOrders);
      this.allOrders = [];
    }

    // Calculate orders for last 7 days
    const weekData = this.calculateOrdersByWeekDay(this.allOrders);
    const labels = weekData.labels;
    const data = weekData.data;

    const ctx = this.ordersChart.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.ordersChartInstance) {
      this.ordersChartInstance.data.labels = labels;
      this.ordersChartInstance.data.datasets[0].data = data;

      // Update chart first
      this.ordersChartInstance.update('none');

      // Create gradient for each bar after chart is drawn
      setTimeout(() => {
        const chartArea = this.ordersChartInstance.chartArea;
        if (chartArea && ctx) {
          const backgroundColorArray = data.map((_, index) => {
            // Create gradient from dark green to light green (same as customers chart)
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, '#256E05'); // Dark green at bottom
            gradient.addColorStop(0.5, '#3CB018'); // Medium green in middle
            gradient.addColorStop(1, '#68CB3C'); // Light green at top
            return gradient;
          });

          this.ordersChartInstance.data.datasets[0].backgroundColor = backgroundColorArray;
          this.ordersChartInstance.update('none');
        }
      }, 100);
    } else {
      // Create initial chart with solid color first, then update with gradient
      this.ordersChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Tổng đơn hàng',
              data: data,
              backgroundColor: '#3CB018', // Solid color first
              borderColor: '#256E05',
              borderWidth: 1,
              borderRadius: 8,
              maxBarThickness: 50, // Same as customers chart
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              left: 8,
              right: 8,
              top: 8,
              bottom: 8,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  return `${context.parsed.y} đơn hàng`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#F3F4F6',
              },
              border: {
                display: false,
              },
              ticks: {
                stepSize: 1,
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
              },
            },
            x: {
              grid: {
                display: false,
              },
              border: {
                display: false,
              },
              ticks: {
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
                maxRotation: 0,
                autoSkip: false,
              },
              // Add padding to prevent labels from being cut off
              afterFit: (scale: any) => {
                scale.paddingLeft = 4;
                scale.paddingRight = 4;
              },
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
        },
      });

      // Update with gradient after chart is created
      setTimeout(() => {
        if (this.ordersChartInstance && this.ordersChartInstance.chartArea && ctx) {
          const chartArea = this.ordersChartInstance.chartArea;
          const backgroundColorArray = data.map((_, index) => {
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, '#256E05'); // Dark green at bottom
            gradient.addColorStop(0.5, '#3CB018'); // Medium green in middle
            gradient.addColorStop(1, '#68CB3C'); // Light green at top
            return gradient;
          });

          this.ordersChartInstance.data.datasets[0].backgroundColor = backgroundColorArray;
          this.ordersChartInstance.update('none');
        }
      }, 200);
    }
  }

  /**
   * Calculate order status distribution: Chờ xác nhận, Đang giao, Đã giao/hoàn thành, Đã huỷ/hoàn tiền
   */
  calculateOrderStatus(): {
    waitingConfirmation: number;
    delivering: number;
    completed: number;
    cancelled: number;
  } {
    // Đảm bảo allOrders là array
    if (!Array.isArray(this.allOrders) || this.allOrders.length === 0) {
      // Trả về 0 thay vì sample data để hiển thị biểu đồ trống
      return { waitingConfirmation: 0, delivering: 0, completed: 0, cancelled: 0 };
    }

    let waitingConfirmation = 0; // Chờ xác nhận: pending, confirmed
    let delivering = 0; // Đang giao: processing, shipping
    let completed = 0; // Đã giao/hoàn thành: delivered, completed
    let cancelled = 0; // Đã huỷ/hoàn tiền: cancelled, processing_return, returning, returned

    this.allOrders.forEach((order) => {
      const status = (order.status || '').toLowerCase();

      // Chờ xác nhận: pending, confirmed
      if (status === 'pending' || status === 'confirmed') {
        waitingConfirmation++;
      }
      // Đang giao: processing, shipping
      else if (status === 'processing' || status === 'shipping') {
        delivering++;
      }
      // Đã giao/hoàn thành: delivered, completed
      else if (status === 'delivered' || status === 'completed') {
        completed++;
      }
      // Đã huỷ/hoàn tiền: cancelled, processing_return, returning, returned
      else if (
        status === 'cancelled' ||
        status === 'processing_return' ||
        status === 'returning' ||
        status === 'returned'
      ) {
        cancelled++;
      }
    });

    console.log(`📊 Order Status Count (4 categories):`, {
      waitingConfirmation,
      delivering,
      completed,
      cancelled,
      total: this.allOrders.length,
    });

    return { waitingConfirmation, delivering, completed, cancelled };
  }

  /**
   * Create status pie chart
   */
  createStatusChart() {
    if (!this.statusChart || !this.statusChart.nativeElement) {
      console.warn('⚠️ Status chart element not found');
      return;
    }

    const ctx = this.statusChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Cannot get 2D context for status chart');
      return;
    }

    this.updateStatusChart();
  }

  /**
   * Update status pie chart with data
   */
  updateStatusChart() {
    if (!this.statusChart || !this.statusChart.nativeElement) return;

    const statusData = this.calculateOrderStatus();
    const total =
      statusData.waitingConfirmation +
      statusData.delivering +
      statusData.completed +
      statusData.cancelled;

    if (total === 0) {
      // No data, show empty chart
      if (this.statusChartInstance) {
        this.statusChartInstance.data.datasets[0].data = [0, 0, 0, 0];
        this.statusChartInstance.data.labels = [
          'Chờ xác nhận',
          'Đang giao',
          'Đã giao/hoàn thành',
          'Đã huỷ/hoàn tiền',
        ];
        this.statusChartInstance.update('none');
      } else {
        this.statusChartInstance = new Chart(this.statusChart.nativeElement.getContext('2d')!, {
          type: 'doughnut',
          data: {
            labels: ['Chờ xác nhận', 'Đang giao', 'Đã giao/hoàn thành', 'Đã huỷ/hoàn tiền'],
            datasets: [
              {
                data: [0, 0, 0, 0],
                backgroundColor: [
                  'rgba(37, 110, 5, 0.8)', // VGreen đậm nhất - Chờ xác nhận
                  'rgba(60, 176, 24, 0.8)', // VGreen đậm - Đang giao
                  'rgba(200, 230, 180, 0.8)', // VGreen nhạt - Đã giao/hoàn thành
                  'rgba(220, 240, 200, 0.8)', // VGreen rất nhạt - Đã huỷ/hoàn tiền
                ],
                borderColor: '#fff',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%', // Create donut chart (hollow center)
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  padding: 15,
                  font: {
                    family: 'SF Pro',
                    size: 12,
                  },
                  usePointStyle: true,
                },
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.parsed || 0;
                    const total = 1; // Avoid division by zero
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    return `${context.label}: ${value} đơn (${percentage}%)`;
                  },
                },
              },
            },
          },
        });
      }
      return;
    }

    const data = [
      statusData.waitingConfirmation,
      statusData.delivering,
      statusData.completed,
      statusData.cancelled,
    ];

    if (this.statusChartInstance) {
      this.statusChartInstance.data.datasets[0].data = data;
      this.statusChartInstance.data.labels = [
        'Chờ xác nhận',
        'Đang giao',
        'Đã giao/hoàn thành',
        'Đã huỷ/hoàn tiền',
      ];
      this.statusChartInstance.data.datasets[0].backgroundColor = [
        'rgba(37, 110, 5, 0.8)', // VGreen đậm nhất - Chờ xác nhận
        'rgba(60, 176, 24, 0.8)', // VGreen đậm - Đang giao
        'rgba(104, 203, 60, 0.8)', // VGreen trung bình - Đã giao/hoàn thành
        'rgba(200, 230, 180, 0.8)', // VGreen nhạt - Đã huỷ/hoàn tiền
      ];
      this.statusChartInstance.update('none');
    } else {
      this.statusChartInstance = new Chart(this.statusChart.nativeElement.getContext('2d')!, {
        type: 'doughnut',
        data: {
          labels: ['Chờ xác nhận', 'Đang giao', 'Đã giao/hoàn thành', 'Đã huỷ/hoàn tiền'],
          datasets: [
            {
              data: data,
              backgroundColor: [
                'rgba(37, 110, 5, 0.8)', // VGreen đậm nhất - Chờ xác nhận
                'rgba(60, 176, 24, 0.8)', // VGreen đậm - Đang giao
                'rgba(104, 203, 60, 0.8)', // VGreen trung bình - Đã giao/hoàn thành
                'rgba(200, 230, 180, 0.8)', // VGreen nhạt - Đã huỷ/hoàn tiền
              ],
              borderColor: '#fff',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%', // Create donut chart (hollow center)
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  family: 'SF Pro',
                  size: 12,
                },
                usePointStyle: true,
                generateLabels: (chart: any) => {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label: string, i: number) => {
                      const value = data.datasets[0].data[i];
                      const total = data.datasets[0].data.reduce(
                        (a: number, b: number) => a + b,
                        0
                      );
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                      return {
                        text: `${label}: ${percentage}%`,
                        fillStyle: data.datasets[0].backgroundColor[i],
                        strokeStyle: data.datasets[0].borderColor,
                        lineWidth: data.datasets[0].borderWidth,
                        hidden: false,
                        index: i,
                      };
                    });
                  }
                  return [];
                },
              },
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed || 0;
                  const total = data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return `${context.label}: ${value} đơn (${percentage}%)`;
                },
              },
            },
          },
        },
      });
    }
  }

  /**
   * Navigate to orders management page and update sidebar active state
   */
  navigateToOrders(): void {
    this.router.navigate(['/orders']).then(() => {
      this.updateSidebarActiveState('orders');
    });
  }

  /**
   * Navigate to customers management page and update sidebar active state
   */
  navigateToCustomers(): void {
    this.router.navigate(['/customers']).then(() => {
      this.updateSidebarActiveState('customers');
    });
  }

  /**
   * Collision Detection Functions
   */

  /**
   * Check if two widgets overlap
   */
  widgetsOverlap(widget1: any, widget2: any): boolean {
    if (widget1.id === widget2.id) return false;

    // Check if widgets overlap horizontally
    const horizontalOverlap = !(
      widget1.x + widget1.w <= widget2.x || widget2.x + widget2.w <= widget1.x
    );

    // Check if widgets overlap vertically
    const verticalOverlap = !(
      widget1.y + widget1.h <= widget2.y || widget2.y + widget2.h <= widget1.y
    );

    return horizontalOverlap && verticalOverlap;
  }

  /**
   * Check if a widget collides with any other widget
   */
  hasCollision(widget: any, excludeWidgetId?: string): boolean {
    return this.widgets.some((otherWidget) => {
      if (otherWidget.id === widget.id || otherWidget.id === excludeWidgetId) return false;
      return this.widgetsOverlap(widget, otherWidget);
    });
  }

  /**
   * Find the nearest available position for a widget
   * Searches in a spiral pattern from the desired position
   */
  findAvailablePosition(
    widget: any,
    preferredX?: number,
    preferredY?: number
  ): { x: number; y: number } {
    const w = widget.w;
    const h = widget.h;
    const maxRows = 50; // Maximum rows to search
    const maxCols = this.gridCols;

    // Start from preferred position or widget's current position
    const startX = preferredX !== undefined ? preferredX : widget.x;
    const startY = preferredY !== undefined ? preferredY : widget.y;

    // Try the preferred position first
    const testWidget = { ...widget, x: startX, y: startY };
    if (
      !this.hasCollision(testWidget, widget.id) &&
      startX + w <= maxCols &&
      startX >= 0 &&
      startY >= 0
    ) {
      return { x: startX, y: startY };
    }

    // Spiral search pattern
    for (let radius = 1; radius < Math.max(maxRows, maxCols); radius++) {
      // Try positions in a spiral pattern
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Only check positions on the perimeter of the spiral
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const testX = startX + dx;
          const testY = startY + dy;

          // Check bounds
          if (testX < 0 || testX + w > maxCols || testY < 0) continue;

          const testWidget = { ...widget, x: testX, y: testY };
          if (!this.hasCollision(testWidget, widget.id)) {
            return { x: testX, y: testY };
          }
        }
      }
    }

    // If no position found, return the original position
    return { x: widget.x, y: widget.y };
  }

  /**
   * Widget Management Functions
   */
  openAddWidgetModal(): void {
    this.showAddWidgetModal = true;
  }

  closeAddWidgetModal(): void {
    this.showAddWidgetModal = false;
  }

  addWidget(chartType: string): void {
    // Widget mới có kích thước tối thiểu 4 cells (2x2)
    const newWidget = {
      id: `widget-${this.nextWidgetId++}`,
      type: chartType,
      title: `Biểu đồ ${
        chartType === 'line'
          ? 'Đường'
          : chartType === 'bar'
          ? 'Cột'
          : chartType === 'column'
          ? 'Thanh'
          : 'Tròn'
      }`,
      x: 0,
      y: 0,
      w: 2, // Minimum width = 2 cells (2 ô ngang)
      h: 2, // Minimum height = 2 cells (2 ô dọc) = 4 cells total
      chartType: chartType,
    };

    // Find available position for new widget
    const position = this.findAvailablePosition(newWidget, 0, 0);
    newWidget.x = position.x;
    newWidget.y = position.y;

    this.widgets.push(newWidget);
    this.saveWidgetLayout();
    this.closeAddWidgetModal();

    // Khởi tạo chart cho widget mới sau khi view updated
    setTimeout(() => {
      this.initializeWidgetChart(newWidget.id, chartType);
    }, 100);
  }

  removeWidget(widgetId: string): void {
    const widget = this.widgets.find((w) => w.id === widgetId);
    if (widget && widget.chart) {
      widget.chart.destroy();
    }
    this.widgets = this.widgets.filter((w) => w.id !== widgetId);
    this.saveWidgetLayout();
  }

  /**
   * Move widget in a specific direction
   */
  moveWidget(widget: any, direction: 'left' | 'right' | 'up' | 'down'): void {
    switch (direction) {
      case 'left':
        widget.x = Math.max(0, widget.x - 1);
        break;
      case 'right':
        // Ensure widget doesn't go out of bounds - snap vào cells
        if (widget.x + widget.w < this.gridCols) {
          widget.x = Math.min(this.gridCols - widget.w, widget.x + 1);
        }
        break;
      case 'up':
        widget.y = Math.max(0, widget.y - 1);
        break;
      case 'down':
        widget.y = widget.y + 1; // Snap vào cell tiếp theo
        break;
    }
    this.saveWidgetLayout();
  }

  /**
   * Drag and Drop Functions
   */
  onDragStart(event: DragEvent, widget: any): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', widget.id);
    }
    this.draggedWidget = widget;
    const element = (event.target as HTMLElement).closest('.widget-item') as HTMLElement;
    if (element) {
      element.classList.add('widget-dragging');
    }
  }

  onDragOver(event: DragEvent, widget?: any): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.draggedOverWidget = widget;

    // Add visual feedback
    const element = (event.target as HTMLElement).closest('.widget-item') as HTMLElement;
    if (element && widget && widget.id !== this.draggedWidget?.id) {
      element.classList.add('drag-over');
    }
  }

  onDragLeave(event: DragEvent): void {
    const element = (event.target as HTMLElement).closest('.widget-item') as HTMLElement;
    if (element) {
      element.classList.remove('drag-over');
    }
  }

  onDrop(event: DragEvent, targetWidget?: any): void {
    event.preventDefault();
    event.stopPropagation();

    const widgetId = event.dataTransfer?.getData('text/plain');
    if (!widgetId || !this.draggedWidget) return;

    if (targetWidget && targetWidget.id !== this.draggedWidget.id) {
      // Swap positions - nhưng kiểm tra collision trước
      const draggedWidget = this.draggedWidget;
      const targetWidgetPos = { x: targetWidget.x, y: targetWidget.y };

      // Test if swapped position causes collision
      const testDragged = { ...draggedWidget, x: targetWidgetPos.x, y: targetWidgetPos.y };
      const testTarget = { ...targetWidget, x: draggedWidget.x, y: draggedWidget.y };

      // If swap would cause collision with other widgets, find available positions
      const otherWidgets = this.widgets.filter(
        (w) => w.id !== draggedWidget.id && w.id !== targetWidget.id
      );
      const draggedCollides = otherWidgets.some((w) => this.widgetsOverlap(testDragged, w));
      const targetCollides = otherWidgets.some((w) => this.widgetsOverlap(testTarget, w));

      if (!draggedCollides && !targetCollides) {
        // Safe to swap
        const draggedIndex = this.widgets.findIndex((w) => w.id === draggedWidget.id);
        const targetIndex = this.widgets.findIndex((w) => w.id === targetWidget.id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const temp = { ...this.widgets[draggedIndex] };
          this.widgets[draggedIndex] = { ...this.widgets[targetIndex] };
          this.widgets[targetIndex] = temp;
        }
      } else {
        // Find available positions for both widgets
        const draggedPos = this.findAvailablePosition(
          draggedWidget,
          targetWidgetPos.x,
          targetWidgetPos.y
        );
        const targetPos = this.findAvailablePosition(
          targetWidget,
          draggedWidget.x,
          draggedWidget.y
        );

        draggedWidget.x = draggedPos.x;
        draggedWidget.y = draggedPos.y;
        targetWidget.x = targetPos.x;
        targetWidget.y = targetPos.y;
      }
    } else {
      // Move to new position - SNAP VÀO GRID CELLS với collision detection
      const dropX = event.clientX;
      const dropY = event.clientY;

      // Calculate grid position - snap vào cells
      const container = document.querySelector('.widgets-grid') as HTMLElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        // Tính chính xác kích thước mỗi cell (bao gồm cả gap)
        const totalGap = this.gridGap * (this.gridCols - 1);
        const colWidth = (rect.width - totalGap) / this.gridCols;
        const rowHeight = this.gridCellSize;

        const relativeX = dropX - rect.left;
        const relativeY = dropY - rect.top;

        // Snap vào grid cells - tính chính xác theo từng cell
        // Mỗi cell có width = colWidth, gap = 20px giữa các cell
        let newX = 0;
        let accumulated = 0;
        for (let i = 0; i < this.gridCols; i++) {
          const cellStart = accumulated;
          const cellEnd = accumulated + colWidth;
          if (relativeX >= cellStart && relativeX < cellEnd) {
            newX = i;
            break;
          }
          accumulated = cellEnd + this.gridGap;
        }

        // Tính vị trí Y
        let newY = Math.max(0, Math.floor(relativeY / (rowHeight + this.gridGap)));

        const widget = this.widgets.find((w) => w.id === widgetId);
        if (widget) {
          // Đảm bảo widget không vượt quá grid (chiều ngang)
          if (newX + widget.w > this.gridCols) {
            newX = Math.max(0, this.gridCols - widget.w);
          }

          // Test for collision at this position
          const testWidget = { ...widget, x: newX, y: newY };
          if (this.hasCollision(testWidget, widget.id)) {
            // Find nearest available position
            const availablePos = this.findAvailablePosition(widget, newX, newY);
            widget.x = availablePos.x;
            widget.y = availablePos.y;
          } else {
            widget.x = newX;
            widget.y = newY;
          }
        }
      }
    }

    this.draggedWidget = null;
    this.draggedOverWidget = null;
    this.saveWidgetLayout();

    // Remove dragging class
    document.querySelectorAll('.widget-dragging, .drag-over').forEach((el) => {
      el.classList.remove('widget-dragging', 'drag-over');
    });
  }

  onDragEnd(event: DragEvent): void {
    // Remove all dragging classes
    document.querySelectorAll('.widget-dragging, .drag-over').forEach((el) => {
      el.classList.remove('widget-dragging', 'drag-over');
    });
    this.draggedWidget = null;
    this.draggedOverWidget = null;
  }

  /**
   * Resize Functions - ClickUp Style: Resize từ 4 cạnh và 4 góc (HỖ TRỢ CẢ WIDTH VÀ HEIGHT)
   */
  startResize(
    event: MouseEvent,
    widget: any,
    side:
      | 'top'
      | 'bottom'
      | 'left'
      | 'right'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startW = widget.w;
    const startH = widget.h;
    const startX_pos = widget.x;
    const startY_pos = widget.y;

    // Grid settings - mượt mà hơn
    const container = document.querySelector('.widgets-grid') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const colWidth = (rect.width - this.gridGap * (this.gridCols - 1)) / this.gridCols;
    const rowHeight = this.gridCellSize;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Tính toán delta theo grid cells - snap vào từng cell
      // Mỗi cell có width = colWidth, gap = 20px giữa các cells
      // Khi resize, tính số cells di chuyển
      const cellWidth = colWidth + this.gridGap; // Total width per cell including gap
      const cellHeight = rowHeight + this.gridGap; // Total height per cell including gap

      const deltaCols = deltaX / cellWidth;
      const deltaRows = deltaY / cellHeight;

      // Xử lý theo từng cạnh/góc - SNAP VÀO GRID CELLS (MINIMUM 4 CELLS)
      // Tính minimum size để đảm bảo widget có ít nhất 4 cells
      const currentMinWidth = Math.ceil(this.minWidgetCells / (widget.h || 1));
      const currentMinHeight = Math.ceil(this.minWidgetCells / (widget.w || 1));

      if (side === 'bottom') {
        // Resize từ cạnh dưới - snap vào cells, minimum 4 cells
        const newH = Math.max(currentMinHeight, Math.min(20, startH + Math.round(deltaRows)));
        const testWidget = { ...widget, h: newH };

        // Check collision
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.h = newH;
        } else {
          // Find maximum height without collision
          for (let h = newH; h >= currentMinHeight; h--) {
            const testWidget = { ...widget, h };
            if (!this.hasCollision(testWidget, widget.id)) {
              widget.h = h;
              break;
            }
          }
        }

        // Đảm bảo vẫn có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          widget.h = Math.ceil(this.minWidgetCells / widget.w);
        }
      } else if (side === 'top') {
        // Resize từ cạnh trên - snap vào cells, minimum 4 cells
        const deltaCells = Math.round(deltaRows);
        const newY = Math.max(0, startY_pos - deltaCells);
        const actualDeltaCellsY = startY_pos - newY;
        const newH = Math.max(currentMinHeight, Math.min(20, startH + actualDeltaCellsY));

        const testWidget = { ...widget, y: newY, h: newH };

        // Check collision
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.y = newY;
          widget.h = newH;
        } else {
          // Find maximum size without collision
          for (let h = newH; h >= currentMinHeight; h--) {
            const testY = Math.max(0, startY_pos - (h - startH));
            const testWidget = { ...widget, y: testY, h };
            if (!this.hasCollision(testWidget, widget.id)) {
              widget.y = testY;
              widget.h = h;
              break;
            }
          }
        }

        // Đảm bảo vẫn có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          widget.h = Math.ceil(this.minWidgetCells / widget.w);
        }
      } else if (side === 'right') {
        // Resize từ cạnh phải - snap vào cells, minimum 4 cells
        const newW = Math.max(
          currentMinWidth,
          Math.min(this.gridCols, startW + Math.round(deltaCols))
        );
        let finalW = newW;

        // Đảm bảo không vượt quá grid
        if (widget.x + finalW > this.gridCols) {
          finalW = this.gridCols - widget.x;
        }

        const testWidget = { ...widget, w: finalW };

        // Check collision
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.w = finalW;
        } else {
          // Find maximum width without collision
          for (let w = finalW; w >= currentMinWidth; w--) {
            const testWidget = { ...widget, w };
            if (!this.hasCollision(testWidget, widget.id)) {
              widget.w = w;
              break;
            }
          }
        }

        // Đảm bảo vẫn có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          widget.w = Math.ceil(this.minWidgetCells / widget.h);
          if (widget.x + widget.w > this.gridCols) {
            widget.w = this.gridCols - widget.x;
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }
      } else if (side === 'left') {
        // Resize từ cạnh trái - GIỐNG BÊN PHẢI: widget di chuyển sang trái và width tăng
        // Khi kéo từ cạnh trái sang trái: widget di chuyển sang trái, width tăng
        // Khi kéo từ cạnh trái sang phải: widget di chuyển sang phải, width giảm

        // Tính số cells di chuyển (deltaX âm khi kéo sang trái)
        const deltaCells = Math.round(deltaCols);

        // Tính vị trí X mới: khi kéo sang trái (deltaX âm), X giảm
        // newX = startX - deltaCells (vì deltaCells sẽ âm khi kéo sang trái)
        const newX = Math.max(0, startX_pos - deltaCells);

        // Số cells widget đã di chuyển sang trái
        const movedCells = startX_pos - newX;

        // Width mới = width ban đầu + số cells di chuyển (vì di chuyển sang trái làm tăng width)
        let newW = startW + movedCells;
        newW = Math.max(2, Math.min(this.gridCols, newW));

        // Đảm bảo widget không vượt quá grid
        if (newX + newW > this.gridCols) {
          const overflow = newX + newW - this.gridCols;
          newW = newW - overflow;
        }

        // Test collision
        const testWidget = { ...widget, x: newX, w: newW };
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.x = newX;
          widget.w = newW;
        } else {
          // Find maximum size without collision
          for (let w = newW; w >= 2; w--) {
            const testX = Math.max(0, startX_pos - (w - startW));
            if (testX + w > this.gridCols) continue;
            const testWidget = { ...widget, x: testX, w };
            if (!this.hasCollision(testWidget, widget.id)) {
              widget.x = testX;
              widget.w = w;
              break;
            }
          }
        }

        // Đảm bảo widget không nhỏ hơn minimum width
        if (widget.w < 2) {
          widget.w = 2;
          widget.x = Math.max(0, startX_pos - (widget.w - startW));
        }

        // Đảm bảo vẫn có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          widget.w = Math.ceil(this.minWidgetCells / widget.h);
          if (widget.x + widget.w > this.gridCols) {
            widget.x = Math.max(0, this.gridCols - widget.w);
            widget.w = this.gridCols - widget.x;
            if (widget.w * widget.h < this.minWidgetCells) {
              widget.h = Math.ceil(this.minWidgetCells / widget.w);
            }
          }
        }
      } else if (side === 'bottom-right') {
        // Resize từ góc dưới phải - snap vào cells, minimum 4 cells
        let newW = Math.max(2, Math.min(this.gridCols, startW + Math.round(deltaCols)));
        let newH = Math.max(2, Math.min(20, startH + Math.round(deltaRows)));

        // Đảm bảo không vượt quá grid
        if (widget.x + newW > this.gridCols) {
          newW = this.gridCols - widget.x;
        }

        // Đảm bảo có ít nhất 4 cells
        if (newW * newH < this.minWidgetCells) {
          if (newW < newH) {
            newW = Math.ceil(this.minWidgetCells / newH);
          } else {
            newH = Math.ceil(this.minWidgetCells / newW);
          }
        }

        // Test collision
        const testWidget = { ...widget, w: newW, h: newH };
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.w = newW;
          widget.h = newH;
        } else {
          // Find maximum size without collision
          for (let size = Math.min(newW, newH); size >= 2; size--) {
            let testW = Math.min(newW, size);
            let testH = Math.min(newH, size);

            // Ensure minimum cells
            if (testW * testH < this.minWidgetCells) {
              if (testW < testH) {
                testW = Math.ceil(this.minWidgetCells / testH);
              } else {
                testH = Math.ceil(this.minWidgetCells / testW);
              }
            }

            const testWidget = { ...widget, w: testW, h: testH };
            if (!this.hasCollision(testWidget, widget.id) && widget.x + testW <= this.gridCols) {
              widget.w = testW;
              widget.h = testH;
              break;
            }
          }
        }

        // Final check for minimum cells
        if (widget.w * widget.h < this.minWidgetCells) {
          if (widget.w < widget.h) {
            widget.w = Math.ceil(this.minWidgetCells / widget.h);
          } else {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }

        if (widget.x + widget.w > this.gridCols) {
          widget.w = this.gridCols - widget.x;
          if (widget.w * widget.h < this.minWidgetCells) {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }
      } else if (side === 'bottom-left') {
        // Resize từ góc dưới trái - di chuyển X, tăng width và height
        const deltaCellsX = Math.round(deltaCols);
        const deltaCellsY = Math.round(deltaRows);

        // Tính vị trí X mới (di chuyển sang trái)
        const newX = Math.max(0, startX_pos - deltaCellsX);
        const actualDeltaCellsX = startX_pos - newX;

        // Tăng width và height
        let newW = startW + actualDeltaCellsX;
        let newH = startH + deltaCellsY;
        newW = Math.max(2, Math.min(this.gridCols, newW));
        newH = Math.max(2, Math.min(20, newH));

        // Đảm bảo widget không vượt quá grid
        if (newX + newW > this.gridCols) {
          newW = this.gridCols - newX;
        }

        // Test collision
        const testWidget = { ...widget, x: newX, w: newW, h: newH };
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.x = newX;
          widget.w = newW;
          widget.h = newH;
        } else {
          // Find maximum size without collision
          for (let w = newW; w >= 2; w--) {
            for (let h = newH; h >= 2; h--) {
              const testX = Math.max(0, startX_pos - (w - startW));
              if (testX + w > this.gridCols) continue;
              const testWidget = { ...widget, x: testX, w, h };
              if (!this.hasCollision(testWidget, widget.id)) {
                widget.x = testX;
                widget.w = w;
                widget.h = h;
                break;
              }
            }
            if (widget.w === w && widget.h >= 2) break;
          }
        }

        // Đảm bảo có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          if (widget.w < widget.h) {
            widget.w = Math.ceil(this.minWidgetCells / widget.h);
            if (widget.x + widget.w > this.gridCols) {
              widget.x = Math.max(0, this.gridCols - widget.w);
              widget.w = this.gridCols - widget.x;
              widget.h = Math.ceil(this.minWidgetCells / widget.w);
            }
          } else {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }
      } else if (side === 'top-right') {
        // Resize từ góc trên phải - snap vào cells, minimum 4 cells
        const deltaCellsY = Math.round(deltaRows);
        const newY = Math.max(0, startY_pos - deltaCellsY);
        const actualDeltaCellsY = startY_pos - newY;
        let newW = Math.max(2, Math.min(this.gridCols, startW + Math.round(deltaCols)));
        let newH = Math.max(2, Math.min(20, startH + actualDeltaCellsY));

        // Đảm bảo không vượt quá grid
        if (widget.x + newW > this.gridCols) {
          newW = this.gridCols - widget.x;
        }

        // Test collision
        const testWidget = { ...widget, y: newY, w: newW, h: newH };
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.y = newY;
          widget.w = newW;
          widget.h = newH;
        } else {
          // Find maximum size without collision
          for (let w = newW; w >= 2; w--) {
            for (let h = newH; h >= 2; h--) {
              const testY = Math.max(0, startY_pos - (h - startH));
              if (widget.x + w > this.gridCols) continue;
              const testWidget = { ...widget, y: testY, w, h };
              if (!this.hasCollision(testWidget, widget.id)) {
                widget.y = testY;
                widget.w = w;
                widget.h = h;
                break;
              }
            }
            if (widget.w === w && widget.h >= 2) break;
          }
        }

        // Đảm bảo có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          if (widget.w < widget.h) {
            widget.w = Math.ceil(this.minWidgetCells / widget.h);
          } else {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }

        if (widget.x + widget.w > this.gridCols) {
          widget.w = this.gridCols - widget.x;
          if (widget.w * widget.h < this.minWidgetCells) {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }
      } else if (side === 'top-left') {
        // Resize từ góc trên trái - di chuyển cả X và Y, tăng width và height
        const deltaCellsX = Math.round(deltaCols);
        const deltaCellsY = Math.round(deltaRows);

        // Tính vị trí mới (di chuyển sang trái và lên trên)
        const newX = Math.max(0, startX_pos - deltaCellsX);
        const newY = Math.max(0, startY_pos - deltaCellsY);
        const actualDeltaCellsX = startX_pos - newX;
        const actualDeltaCellsY = startY_pos - newY;

        // Tăng width và height
        let newW = startW + actualDeltaCellsX;
        let newH = startH + actualDeltaCellsY;
        newW = Math.max(2, Math.min(this.gridCols, newW));
        newH = Math.max(2, Math.min(20, newH));

        // Đảm bảo widget không vượt quá grid
        if (newX + newW > this.gridCols) {
          newW = this.gridCols - newX;
        }

        // Test collision
        const testWidget = { ...widget, x: newX, y: newY, w: newW, h: newH };
        if (!this.hasCollision(testWidget, widget.id)) {
          widget.x = newX;
          widget.y = newY;
          widget.w = newW;
          widget.h = newH;
        } else {
          // Find maximum size without collision
          for (let w = newW; w >= 2; w--) {
            for (let h = newH; h >= 2; h--) {
              const testX = Math.max(0, startX_pos - (w - startW));
              const testY = Math.max(0, startY_pos - (h - startH));
              if (testX + w > this.gridCols) continue;
              const testWidget = { ...widget, x: testX, y: testY, w, h };
              if (!this.hasCollision(testWidget, widget.id)) {
                widget.x = testX;
                widget.y = testY;
                widget.w = w;
                widget.h = h;
                break;
              }
            }
            if (widget.w === w && widget.h >= 2) break;
          }
        }

        // Đảm bảo có ít nhất 4 cells
        if (widget.w * widget.h < this.minWidgetCells) {
          if (widget.w < widget.h) {
            widget.w = Math.ceil(this.minWidgetCells / widget.h);
            if (widget.x + widget.w > this.gridCols) {
              widget.x = Math.max(0, this.gridCols - widget.w);
              widget.w = this.gridCols - widget.x;
              widget.h = Math.ceil(this.minWidgetCells / widget.w);
            }
          } else {
            widget.h = Math.ceil(this.minWidgetCells / widget.w);
          }
        }
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Snap to grid cells sau khi kéo xong - MINIMUM 4 CELLS
      widget.x = Math.max(0, Math.min(widget.x, this.gridCols - 1));
      widget.y = Math.max(0, widget.y);
      widget.w = Math.max(2, Math.min(this.gridCols, widget.w));
      widget.h = Math.max(2, Math.min(20, widget.h));

      // Đảm bảo widget có ít nhất 4 cells
      if (widget.w * widget.h < this.minWidgetCells) {
        // Điều chỉnh để có ít nhất 4 cells
        if (widget.w < widget.h) {
          widget.w = Math.ceil(this.minWidgetCells / widget.h);
        } else {
          widget.h = Math.ceil(this.minWidgetCells / widget.w);
        }
      }

      // Đảm bảo không vượt quá grid
      if (widget.x + widget.w > this.gridCols) {
        widget.w = this.gridCols - widget.x;
        // Đảm bảo vẫn có ít nhất 4 cells sau khi điều chỉnh
        if (widget.w * widget.h < this.minWidgetCells) {
          widget.h = Math.ceil(this.minWidgetCells / widget.w);
        }
      }
      if (widget.y < 0) {
        widget.y = 0;
      }

      this.saveWidgetLayout();

      // Update chart size after resize
      setTimeout(() => {
        if (widget.chart) {
          widget.chart.resize();
        }
      }, 100);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Initialize chart for a widget
   * DISABLED - dashboard HTML không có widget elements
   */
  initializeWidgetChart(widgetId: string, chartType: string): void {
    // Widget system disabled - dashboard HTML không có widget elements
    // Return early để tránh errors và console warnings
    // Dashboard chỉ có main revenue chart, không có widget system
    return;
  }

  /**
   * Update widget chart with new data (dữ liệu thật từ MongoDB)
   */
  updateWidgetChart(widget: any, chartData: any, chartType: string): void {
    if (!widget.chart) return;

    try {
      if (chartType === 'pie') {
        // For pie chart, aggregate data by week
        const weekData = this.aggregateDataByWeek(chartData.data);
        widget.chart.data.labels = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'];
        widget.chart.data.datasets[0].data = weekData;
      } else {
        // For line, bar, column charts
        widget.chart.data.labels = chartData.labels;
        widget.chart.data.datasets[0].data = chartData.data;
      }

      widget.chart.update('none'); // Update without animation for smoother refresh
    } catch (error) {
      console.error('Error updating widget chart:', error);
      // If update fails, recreate the chart
      const widgetElement = document.querySelector(
        `[data-widget-id="${widget.id}"]`
      ) as HTMLElement;
      if (widgetElement) {
        const canvas = widgetElement.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (widget.chart) {
              widget.chart.destroy();
              widget.chart = null;
            }
            switch (chartType) {
              case 'line':
                this.createLineChart(ctx, chartData, widget.id);
                break;
              case 'bar':
                this.createBarChart(ctx, chartData, widget.id);
                break;
              case 'column':
                this.createColumnChart(ctx, chartData, widget.id);
                break;
              case 'pie':
                this.createPieChart(ctx, chartData, widget.id);
                break;
            }
          }
        }
      }
    }
  }

  /**
   * Get chart data from orders - ĐẢM BẢO DỮ LIỆU THẬT TỪ DOANH THU (MongoDB)
   */
  getChartData(): any {
    // Đảm bảo selectedMonth và selectedYear là number (ngModel có thể trả về string)
    const month =
      typeof this.selectedMonth === 'string'
        ? parseInt(this.selectedMonth, 10)
        : this.selectedMonth;
    const year =
      typeof this.selectedYear === 'string' ? parseInt(this.selectedYear, 10) : this.selectedYear;

    // Sử dụng dữ liệu thật từ orders collection trong MongoDB
    const daysInMonth = new Date(year, month, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => `Ngày ${i + 1}`);

    // Tính doanh thu theo ngày từ orders thực tế trong MongoDB
    // Dữ liệu được lấy từ this.allOrders (đã được load từ MongoDB)
    const data = this.calculateRevenueByDay(this.allOrders, year, month);

    // Debug: Log để kiểm tra data
    const totalRevenue = data.reduce((sum: number, val: number) => sum + val, 0);

    // Đảm bảo allOrders là array
    if (!Array.isArray(this.allOrders)) {
      console.warn(
        '⚠️ [Dashboard] calculateRevenueByDay: allOrders is not an array:',
        this.allOrders
      );
      this.allOrders = [];
    }

    const ordersInMonth = this.allOrders.filter((order) => {
      const orderDate = this.parseOrderDate(order);
      return orderDate.getFullYear() === year && orderDate.getMonth() + 1 === month;
    }).length;

    // Luôn log để debug
    console.log(`📊 Chart Data - Month ${month}/${year}:`, {
      days: daysInMonth,
      totalRevenue: totalRevenue.toFixed(2) + 'tr',
      dataPoints: data.length,
      ordersCount: this.allOrders.length,
      ordersInMonth: ordersInMonth,
      sampleData: data.slice(0, 5), // Sample 5 ngày đầu
      hasData: totalRevenue > 0,
      monthType: typeof month,
      yearType: typeof year,
      originalSelectedMonth: this.selectedMonth,
      originalSelectedYear: this.selectedYear,
    });

    // Đảm bảo data và labels là arrays hợp lệ
    if (!Array.isArray(data) || data.length !== daysInMonth) {
      console.warn(`⚠️ Invalid data array. Expected length: ${daysInMonth}, Got: ${data.length}`);
      return { labels, data: new Array(daysInMonth).fill(0) };
    }

    return { labels, data };
  }

  /**
   * Create line chart - Sử dụng dữ liệu thật từ MongoDB
   */
  createLineChart(ctx: CanvasRenderingContext2D, chartData: any, widgetId: string): void {
    const widget = this.widgets.find((w) => w.id === widgetId);
    if (widget.chart) {
      widget.chart.destroy();
    }

    // Đảm bảo dữ liệu là array từ MongoDB
    const data = Array.isArray(chartData.data) ? chartData.data : [];
    const labels = Array.isArray(chartData.labels) ? chartData.labels : [];

    // Debug: Log data trước khi tạo chart
    console.log(`📈 Creating line chart for ${widgetId}:`, {
      dataLength: data.length,
      labelsLength: labels.length,
      dataSample: data.slice(0, 5),
      totalRevenue: data.reduce((sum: number, v: number) => sum + v, 0),
    });

    widget.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Doanh thu (VNĐ)',
            data: data, // Dữ liệu thật từ MongoDB
            borderColor: '#3CB018',
            backgroundColor: 'rgba(60, 176, 24, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#3CB018',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y || 0;
                return `Doanh thu: ${value.toFixed(2)}tr VNĐ`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => {
                if (typeof value === 'number' && value >= 0) {
                  return value.toFixed(1) + 'tr';
                }
                return '0tr';
              },
            },
          },
        },
      },
    });

    console.log(`✅ Line chart created for ${widgetId}`);
  }

  /**
   * Create bar chart (vertical bars) - Sử dụng dữ liệu thật từ MongoDB
   */
  createBarChart(ctx: CanvasRenderingContext2D, chartData: any, widgetId: string): void {
    const widget = this.widgets.find((w) => w.id === widgetId);
    if (widget.chart) {
      widget.chart.destroy();
    }

    // Đảm bảo dữ liệu là array từ MongoDB
    const data = Array.isArray(chartData.data) ? chartData.data : [];
    const labels = Array.isArray(chartData.labels) ? chartData.labels : [];

    // Debug: Log data trước khi tạo chart
    console.log(`📊 Creating bar chart for ${widgetId}:`, {
      dataLength: data.length,
      labelsLength: labels.length,
      dataSample: data.slice(0, 5),
      totalRevenue: data.reduce((sum: number, v: number) => sum + v, 0),
    });

    widget.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Doanh thu (VNĐ)',
            data: data, // Dữ liệu thật từ MongoDB
            backgroundColor: 'rgba(60, 176, 24, 0.7)',
            borderColor: '#3CB018',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y || 0;
                return `Doanh thu: ${value.toFixed(2)}tr VNĐ`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => {
                if (typeof value === 'number' && value >= 0) {
                  return value.toFixed(1) + 'tr';
                }
                return '0tr';
              },
            },
          },
        },
      },
    });

    console.log(`✅ Bar chart created for ${widgetId}`);
  }

  /**
   * Create column chart (horizontal bar) - Sử dụng dữ liệu thật từ MongoDB
   */
  createColumnChart(ctx: CanvasRenderingContext2D, chartData: any, widgetId: string): void {
    const widget = this.widgets.find((w) => w.id === widgetId);
    if (widget.chart) {
      widget.chart.destroy();
    }

    // Đảm bảo dữ liệu là array từ MongoDB
    const data = Array.isArray(chartData.data) ? chartData.data : [];
    const labels = Array.isArray(chartData.labels) ? chartData.labels : [];

    // Debug: Log data trước khi tạo chart
    console.log(`📋 Creating column chart for ${widgetId}:`, {
      dataLength: data.length,
      labelsLength: labels.length,
      dataSample: data.slice(0, 5),
      totalRevenue: data.reduce((sum: number, v: number) => sum + v, 0),
    });

    widget.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Doanh thu (VNĐ)',
            data: data, // Dữ liệu thật từ MongoDB
            backgroundColor: 'rgba(60, 176, 24, 0.7)',
            borderColor: '#3CB018',
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: 'y', // Horizontal bars
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.x || 0;
                return `Doanh thu: ${value.toFixed(2)}tr VNĐ`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => {
                if (typeof value === 'number' && value >= 0) {
                  return value.toFixed(1) + 'tr';
                }
                return '0tr';
              },
            },
          },
        },
      },
    });
  }

  /**
   * Create pie chart - Sử dụng dữ liệu thật từ MongoDB, nhóm theo tuần
   */
  createPieChart(ctx: CanvasRenderingContext2D, chartData: any, widgetId: string): void {
    const widget = this.widgets.find((w) => w.id === widgetId);
    if (widget.chart) {
      widget.chart.destroy();
    }

    // Đảm bảo dữ liệu là array từ MongoDB
    const data = Array.isArray(chartData.data) ? chartData.data : [];

    // For pie chart, aggregate data by week from real data
    const weekData = this.aggregateDataByWeek(data);
    const totalRevenue = weekData.reduce((sum: number, val: number) => sum + val, 0);

    widget.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
        datasets: [
          {
            label: 'Doanh thu theo tuần (VNĐ)',
            data: weekData, // Dữ liệu thật từ MongoDB, đã được nhóm theo tuần
            backgroundColor: [
              'rgba(60, 176, 24, 0.8)',
              'rgba(104, 203, 60, 0.8)',
              'rgba(52, 148, 9, 0.8)',
              'rgba(37, 110, 5, 0.8)',
            ],
            borderColor: '#fff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: {
                size: 12,
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed || 0;
                const total = totalRevenue || 1; // Avoid division by zero
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(2)}tr VNĐ (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Aggregate daily data by week
   */
  aggregateDataByWeek(data: number[]): number[] {
    const weeks: number[] = [0, 0, 0, 0];
    data.forEach((value, index) => {
      const week = Math.floor(index / 7);
      if (week < 4) {
        weeks[week] += value;
      }
    });
    return weeks;
  }

  /**
   * Save widget layout to localStorage
   */
  saveWidgetLayout(): void {
    const layout = this.widgets.map((w) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      chartType: w.chartType,
    }));
    localStorage.setItem('dashboard-widgets', JSON.stringify(layout));
  }

  /**
   * Load widget layout from localStorage
   */
  loadWidgetLayout(): void {
    const saved = localStorage.getItem('dashboard-widgets');
    if (saved) {
      try {
        const savedWidgets = JSON.parse(saved);
        // Đảm bảo mỗi widget có ít nhất 4 cells
        this.widgets = savedWidgets.map((w: any) => {
          // Kiểm tra và điều chỉnh để có ít nhất 4 cells
          if (w.w * w.h < this.minWidgetCells) {
            if (w.w < w.h) {
              w.w = Math.ceil(this.minWidgetCells / w.h);
            } else {
              w.h = Math.ceil(this.minWidgetCells / w.w);
            }
          }
          // Đảm bảo không vượt quá grid
          if (w.x + w.w > this.gridCols) {
            w.x = Math.max(0, this.gridCols - w.w);
            if (w.x + w.w > this.gridCols) {
              w.w = this.gridCols - w.x;
            }
          }
          // Đảm bảo minimum size
          w.w = Math.max(2, Math.min(this.gridCols, w.w));
          w.h = Math.max(2, Math.min(20, w.h));
          return w;
        });

        // Update nextWidgetId
        if (this.widgets.length > 0) {
          const maxId = this.widgets.reduce((max: number, w: any) => {
            const match = w.id?.match(/widget-(\d+)/);
            if (match) {
              const id = parseInt(match[1]);
              return Math.max(max, id);
            }
            return max;
          }, 0);
          this.nextWidgetId = maxId + 1;
        }
        // Charts will be initialized in ngAfterViewInit
      } catch (e) {
        console.error('Error loading widget layout:', e);
      }
    }
  }

  ngAfterViewInit() {
    this.createRevenueChart();

    // Khởi tạo orders chart sau khi view ready
    setTimeout(() => {
      this.createOrdersChart();
    }, 100);

    // Khởi tạo status pie chart sau khi view ready
    setTimeout(() => {
      this.createStatusChart();
    }, 200);

    // Khởi tạo customers chart
    setTimeout(() => {
      this.createCustomersChart();
    }, 300);

    // Khởi tạo promotion chart
    setTimeout(() => {
      this.createPromotionChart();
    }, 350);

    // Khởi tạo top products chart
    setTimeout(() => {
      this.createTopProductsChart();
    }, 400);

    // Khởi tạo charts cho widgets sau khi view ready và sau khi data được load
    // Chờ data được load từ loadDashboardData trước
    setTimeout(() => {
      console.log('🔄 ngAfterViewInit: Initializing widget charts...', {
        widgetsCount: this.widgets.length,
        ordersCount: this.allOrders.length,
      });

      this.widgets.forEach((widget) => {
        if (widget.chartType && !widget.chart) {
          console.log(`📊 Initializing chart for widget: ${widget.id}, type: ${widget.chartType}`);
          this.initializeWidgetChart(widget.id, widget.chartType);
        }
      });
    }, 500); // Tăng timeout để đảm bảo data đã được load
  }

  setTimePeriod(period: 'current' | 'previous') {
    this.timePeriod = period;
    // Cập nhật active state cho buttons
    const buttons = document.querySelectorAll('.toggle-btn');
    buttons.forEach((btn, index) => {
      if (period === 'current' && index === 0) {
        btn.classList.add('active');
      } else if (period === 'previous' && index === 1) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.updateChart();
  }

  onYearChange() {
    this.updateChart();
  }

  onMonthChange() {
    this.updateChart();
    // Widget system disabled - dashboard HTML không có widget elements
    // Chỉ cập nhật main revenue chart
  }

  createRevenueChart() {
    const ctx = this.revenueChart.nativeElement.getContext('2d');

    if (ctx) {
      this.updateChart();
    }
  }

  /**
   * Tính doanh thu theo ngày trong tháng từ orders thực tế - DỮ LIỆU THẬT TỪ MONGODB
   */
  calculateRevenueByDay(orders: any[], year: number, month: number): number[] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const revenueByDay = new Array(daysInMonth).fill(0);

    if (!orders || orders.length === 0) {
      console.warn(`⚠️ No orders data available for ${month}/${year}`);
      return revenueByDay;
    }

    let ordersInMonth = 0;
    let totalRevenueInMonth = 0;
    const unmatchedOrders: any[] = [];

    // Debug: Log tất cả orders và dates
    console.log(`🔍 Calculating revenue for ${month}/${year}:`, {
      totalOrders: orders.length,
      targetMonth: month,
      targetYear: year,
    });

    orders.forEach((order, index) => {
      // Chỉ tính các đơn hàng đã thanh toán (completed/delivered)
      const status = order.status || order.order_status || '';
      if (status !== 'completed' && status !== 'delivered') {
        return; // Bỏ qua đơn hàng chưa thanh toán, hủy, hoặc hoàn tiền
      }

      const orderDate = this.parseOrderDate(order);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth() + 1;

      // Debug: Log một vài orders đầu tiên
      if (index < 5) {
        const yearMatch = Number(orderYear) === Number(year);
        const monthMatch = Number(orderMonth) === Number(month);
        const matches = yearMatch && monthMatch;

        console.log(`🔍 Order ${index + 1}:`, {
          order_id: order.order_id || order.id,
          order_date: order.order_date || order.date,
          parsedDate: orderDate.toISOString(),
          parsedYear: orderYear,
          parsedMonth: orderMonth,
          targetYear: year,
          targetMonth: month,
          yearMatch: yearMatch,
          monthMatch: monthMatch,
          matches: matches,
          status: status,
          yearType:
            typeof orderYear === typeof year ? 'same' : `${typeof orderYear} vs ${typeof year}`,
          monthType:
            typeof orderMonth === typeof month ? 'same' : `${typeof orderMonth} vs ${typeof month}`,
          total_amount: order.total_amount,
          total_price: order.total_price,
          total: order.total,
          order_total: order.order_total,
        });
      }

      // Kiểm tra nếu order thuộc tháng và năm được chọn
      // So sánh chính xác năm và tháng (local date, không phải UTC)
      // Đảm bảo type conversion để tránh string vs number mismatch
      const orderMatches =
        Number(orderYear) === Number(year) && Number(orderMonth) === Number(month);

      if (orderMatches) {
        const day = orderDate.getDate() - 1; // Array index (0-based)

        if (day >= 0 && day < daysInMonth) {
          // Lấy giá trị từ các trường có thể có: totalAmount (MongoDB), total_amount, total_price, total, order_total
          const total =
            order.totalAmount ||
            order.total_amount ||
            order.total_price ||
            order.total ||
            order.order_total ||
            0;
          const amount =
            typeof total === 'number'
              ? total
              : parseFloat(String(total).replace(/[^0-9.-]/g, '')) || 0;

          // Debug: Log order được tính
          if (ordersInMonth < 5) {
            console.log(`✅ Order matched - Day ${day + 1}:`, {
              order_id: order.OrderID || order.order_id || order.id,
              status: status,
              totalAmount: order.totalAmount,
              total_amount: order.total_amount,
              amount: amount,
              amountInMillion: (amount / 1000000).toFixed(2) + 'tr',
            });
          }

          // Chuyển đổi sang đơn vị "tr" (triệu) - chia cho 1,000,000
          const revenueInMillion = amount / 1000000;
          revenueByDay[day] += revenueInMillion;

          ordersInMonth++;
          totalRevenueInMonth += amount;
        } else {
          console.warn(`⚠️ Order day out of range: ${day + 1} (should be 1-${daysInMonth})`);
        }
      } else {
        // Lưu orders không match để debug
        if (unmatchedOrders.length < 5) {
          unmatchedOrders.push({
            order_id: order.order_id || order.id,
            order_date: order.order_date || order.date,
            parsedYear: orderYear,
            parsedMonth: orderMonth,
            targetYear: year,
            targetMonth: month,
          });
        }
      }
    });

    // Log chi tiết
    console.log(`📊 Revenue by Day - ${month}/${year}:`, {
      ordersInMonth,
      totalRevenue: totalRevenueInMonth.toLocaleString('vi-VN') + 'đ',
      totalRevenueInMillion: (totalRevenueInMonth / 1000000).toFixed(2) + 'tr',
      daysWithData: revenueByDay.filter((v) => v > 0).length,
      maxDayRevenue: revenueByDay.length > 0 ? Math.max(...revenueByDay).toFixed(2) + 'tr' : '0tr',
      unmatchedOrdersSample: unmatchedOrders,
      revenueByDaySample: revenueByDay.slice(0, 10), // Sample 10 ngày đầu
    });

    // Nếu không có orders trong tháng, log cảnh báo và suggest tháng có data
    if (ordersInMonth === 0 && orders.length > 0) {
      // Tìm tháng có nhiều orders nhất
      const monthStats = new Map<string, number>();
      orders.forEach((order) => {
        const orderDate = this.parseOrderDate(order);
        const orderYear = orderDate.getFullYear();
        const orderMonth = orderDate.getMonth() + 1;
        const key = `${orderYear}-${orderMonth}`;
        monthStats.set(key, (monthStats.get(key) || 0) + 1);
      });

      // Tìm tháng có nhiều orders nhất
      let maxMonth = '';
      let maxCount = 0;
      monthStats.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          maxMonth = key;
        }
      });

      const [suggestYear, suggestMonth] = maxMonth
        ? maxMonth.split('-').map(Number)
        : [year, month];

      console.warn(`⚠️ No orders found for ${month}/${year}. Available months with orders:`, {
        totalOrders: orders.length,
        suggestedMonth: `${suggestMonth}/${suggestYear} (${maxCount} orders)`,
        allMonths: Array.from(monthStats.entries())
          .map(([key, count]) => {
            const [y, m] = key.split('-').map(Number);
            return { month: m, year: y, count };
          })
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          }),
        sampleOrderDates: orders.slice(0, 3).map((o) => {
          const d = this.parseOrderDate(o);
          return {
            order_id: o.order_id || o.id,
            order_date: o.order_date || o.date,
            parsedDate: d.toISOString(),
            parsedMonth: d.getMonth() + 1,
            parsedYear: d.getFullYear(),
          };
        }),
      });

      // Gợi ý: Nếu tháng hiện tại không có data, suggest tháng có data
      if (suggestMonth && suggestMonth !== month) {
        console.info(
          `💡 Tip: Try selecting month ${suggestMonth} to see data (${maxCount} orders available)`
        );
      }
    }

    return revenueByDay;
  }

  updateChart() {
    // Tính số ngày trong tháng được chọn
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    // Tính tháng trước
    let prevMonth = this.selectedMonth - 1;
    let prevYear = this.selectedYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = this.selectedYear - 1;
    }

    // Tính doanh thu từ orders thực tế
    const currentMonthData = this.calculateRevenueByDay(
      this.allOrders,
      this.selectedYear,
      this.selectedMonth
    );

    const previousMonthData = this.calculateRevenueByDay(this.allOrders, prevYear, prevMonth);

    // Tính số ngày trong tháng trước
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

    if (this.chart) {
      this.chart.data.labels = labels;
      if (this.timePeriod === 'current') {
        this.chart.data.datasets[0].data = currentMonthData;
        this.chart.data.datasets[0].label = `Tháng ${this.selectedMonth}/${this.selectedYear}`;
        this.chart.data.datasets[1].data = previousMonthData.slice(-daysInMonth);
        this.chart.data.datasets[1].label = `Tháng ${prevMonth}/${prevYear}`;
      } else {
        this.chart.data.datasets[0].data = previousMonthData;
        this.chart.data.datasets[0].label = `Tháng ${prevMonth}/${prevYear}`;
        this.chart.data.datasets[1].data = currentMonthData.slice(-daysInPrevMonth);
        this.chart.data.datasets[1].label = `Tháng ${this.selectedMonth}/${this.selectedYear}`;
      }
      this.chart.update('none'); // Update without animation for smoother refresh
    } else {
      // Tạo chart mới

      this.chart = new Chart(this.revenueChart.nativeElement.getContext('2d')!, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label:
                this.timePeriod === 'current'
                  ? `Tháng ${this.selectedMonth}/${this.selectedYear}`
                  : `Tháng ${prevMonth}/${prevYear}`,
              data: this.timePeriod === 'current' ? currentMonthData : previousMonthData,
              borderColor: '#3CB018',
              backgroundColor: 'rgba(60, 176, 24, 0.15)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#3CB018',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              borderWidth: 2,
            },
            {
              label:
                this.timePeriod === 'current'
                  ? `Tháng ${prevMonth}/${prevYear}`
                  : `Tháng ${this.selectedMonth}/${this.selectedYear}`,
              data:
                this.timePeriod === 'current'
                  ? previousMonthData.slice(-daysInMonth)
                  : currentMonthData.slice(-daysInPrevMonth),
              borderColor: '#68CB3C',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: '#68CB3C',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                  family: 'SF Pro',
                  size: 12,
                  weight: 500 as any,
                },
                color: '#6B7280',
              },
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: {
                family: 'SF Pro',
                size: 12,
                weight: 600 as any,
              },
              bodyFont: {
                family: 'SF Pro',
                size: 13,
              },
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${value.toFixed(2)}tr VNĐ`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#F3F4F6',
              },
              border: {
                display: false,
              },
              ticks: {
                callback: (value: any) => {
                  return value + 'tr';
                },
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
              },
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          animations: {
            tension: {
              duration: 1000,
              easing: 'linear',
            },
          },
        },
      });
    }
  }

  /**
   * Calculate customers by day of week - filter by date range
   */
  calculateCustomersByDay(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.customersByDay = [0, 0, 0, 0, 0, 0, 0];
      this.customersChartLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      return;
    }

    // Tạo date range từ các filter
    const startDate = new Date(
      this.selectedYearCustomers,
      this.selectedMonthCustomers - 1,
      this.startDayCustomers
    );
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(
      this.selectedYearCustomers,
      this.selectedMonthCustomers - 1,
      this.endDayCustomers
    );
    endDate.setHours(23, 59, 59, 999);

    console.log(`\n📊 === CALCULATE CUSTOMERS BY DAY ===`);
    console.log(
      `📅 Date range: ${startDate.toLocaleDateString(
        'vi-VN'
      )} (${startDate.toISOString()}) - ${endDate.toLocaleDateString(
        'vi-VN'
      )} (${endDate.toISOString()})`
    );
    console.log(
      `📅 Selected: Year=${this.selectedYearCustomers}, Month=${this.selectedMonthCustomers}, Week=${this.selectedWeekCustomers}`
    );
    console.log(`📅 Week range: Day ${this.startDayCustomers} - ${this.endDayCustomers}`);
    console.log(`👥 Total users: ${this.allUsers.length}`);

    // Calculate labels based on actual days in the selected week
    // Get the day of week for the first day of the selected week
    const firstDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // Create labels array starting from the first day of the selected week
    const labels: string[] = [];
    const daysInWeek = Math.min(7, this.endDayCustomers - this.startDayCustomers + 1);
    for (let i = 0; i < daysInWeek; i++) {
      const dayIndex = (firstDayOfWeek + i) % 7;
      labels.push(dayLabels[dayIndex]);
    }
    this.customersChartLabels = labels;

    console.log(
      `📅 First day of week: ${dayLabels[firstDayOfWeek]} (day ${this.startDayCustomers})`
    );
    console.log(`📅 Chart labels: ${labels.join(', ')}`);

    // Initialize data array with zeros for each day in the week
    const customersByDay = new Array(daysInWeek).fill(0);
    let matchedUsers = 0;
    let debugUsers: any[] = [];

    // Filter users theo date range và tính theo vị trí trong tuần (0 = ngày đầu, 1 = ngày thứ 2, ...)
    this.allUsers.forEach((user, index) => {
      const userRegisterDate = this.parseUserDate(user);

      // Debug: Log first few users
      if (index < 10) {
        const inRange = userRegisterDate >= startDate && userRegisterDate <= endDate;
        console.log(`👤 User ${index + 1}:`, {
          CustomerID: user.CustomerID || user.customer_id,
          RegisterDate: user.RegisterDate || user.register_date || user.created_at,
          ParsedDate: userRegisterDate.toLocaleDateString('vi-VN'),
          ParsedDateISO: userRegisterDate.toISOString(),
          DayOfWeek: userRegisterDate.getDay(),
          DayName: dayLabels[userRegisterDate.getDay()],
          InRange: inRange,
          StartDate: startDate.toLocaleDateString('vi-VN'),
          EndDate: endDate.toLocaleDateString('vi-VN'),
        });
      }

      // Kiểm tra nếu user được tạo trong khoảng thời gian được chọn
      if (userRegisterDate >= startDate && userRegisterDate <= endDate) {
        // Calculate which day in the week (0 = first day, 1 = second day, etc.)
        const dayDiff = Math.floor(
          (userRegisterDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dayDiff >= 0 && dayDiff < daysInWeek) {
          customersByDay[dayDiff]++;
          matchedUsers++;

          // Store for debug
          if (debugUsers.length < 10) {
            debugUsers.push({
              CustomerID: user.CustomerID || user.customer_id,
              RegisterDate: user.RegisterDate || user.register_date,
              ParsedDate: userRegisterDate.toLocaleDateString('vi-VN'),
              DayOfWeek: userRegisterDate.getDay(),
              DayName: dayLabels[userRegisterDate.getDay()],
              DayIndex: dayDiff,
              DayLabel: labels[dayDiff],
            });
          }
        }
      }
    });

    console.log(`✅ Matched users in range: ${matchedUsers}`);
    console.log(`📊 Customers by day:`, customersByDay);
    console.log(`📊 Labels:`, labels);
    if (debugUsers.length > 0) {
      console.log(`📋 Sample matched users:`, debugUsers);
    }

    // Store data in the order that matches the labels
    this.customersByDay = customersByDay;
  }

  /**
   * Create customers chart (bar chart by day of week)
   */
  createCustomersChart(): void {
    if (!this.customersChart || !this.customersChart.nativeElement) {
      console.warn('⚠️ Customers chart element not found');
      return;
    }

    const ctx = this.customersChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Cannot get 2D context for customers chart');
      return;
    }

    this.updateCustomersChart();
  }

  /**
   * Create green gradient for chart bars
   */
  createGreenGradient(
    ctx: CanvasRenderingContext2D,
    chartArea: any,
    startColor: string,
    endColor: string
  ): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, startColor); // Bottom color (darker)
    gradient.addColorStop(1, endColor); // Top color (lighter)
    return gradient;
  }

  /**
   * Update customers chart with data
   */
  updateCustomersChart(): void {
    if (!this.customersChart || !this.customersChart.nativeElement) return;

    // Use dynamic labels based on actual days in the selected week
    const labels =
      this.customersChartLabels.length > 0
        ? this.customersChartLabels
        : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Fallback to default

    const ctx = this.customersChart.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.customersChartInstance) {
      this.customersChartInstance.data.labels = labels;
      this.customersChartInstance.data.datasets[0].data = this.customersByDay;

      // Update gradient after chart is drawn
      this.customersChartInstance.update('none');

      // Create gradient for each bar after chart is drawn
      const chartArea = this.customersChartInstance.chartArea;
      if (chartArea) {
        const backgroundColorArray = this.customersByDay.map((_, index) => {
          // Create gradient from dark green to light green
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, '#256E05'); // Dark green at bottom
          gradient.addColorStop(0.5, '#3CB018'); // Medium green in middle
          gradient.addColorStop(1, '#68CB3C'); // Light green at top
          return gradient;
        });

        this.customersChartInstance.data.datasets[0].backgroundColor = backgroundColorArray;
        this.customersChartInstance.update('none');
      }
    } else {
      // Create initial chart with gradient
      // Use dynamic labels based on actual days in the selected week
      const initialLabels =
        this.customersChartLabels.length > 0
          ? this.customersChartLabels
          : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Fallback to default

      this.customersChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: initialLabels,
          datasets: [
            {
              label: 'Tài khoản mới',
              data: this.customersByDay,
              backgroundColor: (context: any) => {
                const chart = context.chart;
                const { ctx, chartArea } = chart;

                if (!chartArea) {
                  return '#3CB018'; // Fallback color
                }

                // Create gradient for each bar
                const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                gradient.addColorStop(0, '#256E05'); // Dark green at bottom
                gradient.addColorStop(0.5, '#3CB018'); // Medium green in middle
                gradient.addColorStop(1, '#68CB3C'); // Light green at top
                return gradient;
              },
              borderColor: '#256E05',
              borderWidth: 1,
              borderRadius: 8,
              maxBarThickness: 50, // Tăng width của các cột (tăng 2-5px so với mặc định)
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  return `${context.parsed.y} tài khoản mới`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#F3F4F6',
              },
              border: {
                display: false,
              },
              ticks: {
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                font: {
                  family: 'SF Pro',
                  size: 11,
                },
                color: '#9CA3AF',
              },
            },
          },
        },
      });
    }
  }

  /**
   * Calculate payment status distribution
   */
  calculatePaymentStatus(): { paid: number; unpaid: number; cancelled: number } {
    if (!this.allOrders || this.allOrders.length === 0) {
      return { paid: 0, unpaid: 0, cancelled: 0 };
    }

    let paid = 0;
    let unpaid = 0;
    let cancelled = 0;

    this.allOrders.forEach((order) => {
      const paymentStatus = (order.payment_status || order.payment || '').toLowerCase();
      const orderStatus = (order.status || '').toLowerCase();

      // Đã thanh toán
      if (
        paymentStatus.includes('paid') ||
        paymentStatus.includes('completed') ||
        orderStatus.includes('delivered') ||
        orderStatus.includes('paid')
      ) {
        paid++;
      }
      // Hủy đơn
      else if (
        paymentStatus.includes('cancel') ||
        paymentStatus.includes('refund') ||
        orderStatus.includes('cancel') ||
        orderStatus.includes('refund')
      ) {
        cancelled++;
      }
      // Chưa thanh toán
      else {
        unpaid++;
      }
    });

    return { paid, unpaid, cancelled };
  }

  /**
   * Calculate promotion status distribution
   */
  calculatePromotionStatus(): { active: number; upcoming: number; expired: number } {
    if (!this.allPromotions || this.allPromotions.length === 0) {
      return { active: 0, upcoming: 0, expired: 0 };
    }

    const now = new Date();
    let active = 0;
    let upcoming = 0;
    let expired = 0;

    this.allPromotions.forEach((promotion) => {
      // Xử lý start_date từ MongoDB (có thể là $date object hoặc Date string)
      let parsedStartDate: Date | null = null;
      let parsedEndDate: Date | null = null;

      // Xử lý start_date
      const startDateField = promotion.start_date || promotion.startDate || promotion.start;
      if (startDateField) {
        if (typeof startDateField === 'object' && startDateField.$date) {
          // MongoDB format: { $date: "..." }
          parsedStartDate = new Date(startDateField.$date);
        } else if (startDateField instanceof Date) {
          parsedStartDate = startDateField;
        } else if (typeof startDateField === 'string') {
          parsedStartDate = new Date(startDateField);
        }
        if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
          parsedStartDate = null;
        }
      }

      // Xử lý end_date
      const endDateField = promotion.end_date || promotion.endDate || promotion.end;
      if (endDateField) {
        if (typeof endDateField === 'object' && endDateField.$date) {
          // MongoDB format: { $date: "..." }
          parsedEndDate = new Date(endDateField.$date);
        } else if (endDateField instanceof Date) {
          parsedEndDate = endDateField;
        } else if (typeof endDateField === 'string') {
          parsedEndDate = new Date(endDateField);
        }
        if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
          parsedEndDate = null;
        }
      }

      // Classify promotion status dựa trên dates
      if (parsedStartDate && parsedEndDate) {
        if (now < parsedStartDate) {
          upcoming++;
        } else if (now > parsedEndDate) {
          expired++;
        } else {
          // Trong khoảng thời gian, kiểm tra status field
          const status = (promotion.status || '').toLowerCase();
          if (status === 'active') {
            active++;
          } else if (status === 'inactive' || status === 'expired') {
            expired++;
          } else {
            active++; // Default to active if status not specified
          }
        }
      } else if (parsedStartDate) {
        if (now < parsedStartDate) {
          upcoming++;
        } else {
          const status = (promotion.status || '').toLowerCase();
          if (status === 'active') {
            active++;
          } else {
            expired++;
          }
        }
      } else if (parsedEndDate) {
        if (now > parsedEndDate) {
          expired++;
        } else {
          const status = (promotion.status || '').toLowerCase();
          if (status === 'active') {
            active++;
          } else {
            expired++;
          }
        }
      } else {
        // No dates provided, use status field
        const status = (promotion.status || '').toLowerCase();
        if (status === 'active') {
          active++;
        } else if (status === 'inactive' || status === 'expired') {
          expired++;
        } else {
          active++; // Default to active
        }
      }
    });

    console.log(`📊 Promotion Status Count:`, {
      active,
      upcoming,
      expired,
      total: this.allPromotions.length,
    });

    return { active, upcoming, expired };
  }

  /**
   * Create promotion status pie chart
   */
  createPromotionChart(): void {
    if (!this.promotionChart || !this.promotionChart.nativeElement) {
      console.warn('⚠️ Promotion chart element not found');
      return;
    }

    const ctx = this.promotionChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Cannot get 2D context for promotion chart');
      return;
    }

    this.updatePromotionChart();
  }

  /**
   * Update promotion chart with data
   */
  updatePromotionChart(): void {
    if (!this.promotionChart || !this.promotionChart.nativeElement) return;

    const promotionData = this.calculatePromotionStatus();
    const total = promotionData.active + promotionData.upcoming + promotionData.expired;

    if (total === 0) {
      if (this.promotionChartInstance) {
        this.promotionChartInstance.data.datasets[0].data = [0, 0, 0];
        this.promotionChartInstance.update('none');
      } else {
        this.promotionChartInstance = new Chart(
          this.promotionChart.nativeElement.getContext('2d')!,
          {
            type: 'doughnut',
            data: {
              labels: ['Đang hoạt động', 'Sắp tới', 'Đã hết hạn'],
              datasets: [
                {
                  data: [0, 0, 0],
                  backgroundColor: [
                    'rgba(37, 110, 5, 0.8)', // VGreen đậm - Đang hoạt động
                    'rgba(60, 176, 24, 0.8)', // VGreen trung bình - Sắp tới
                    'rgba(104, 203, 60, 0.8)', // VGreen nhạt - Đã hết hạn
                  ],
                  borderColor: '#fff',
                  borderWidth: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '60%', // Create donut chart (hollow center)
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    padding: 15,
                    font: {
                      family: 'SF Pro',
                      size: 12,
                    },
                    usePointStyle: true,
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = context.parsed || 0;
                      const total = 1;
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                      return `${context.label}: ${value} (${percentage}%)`;
                    },
                  },
                },
              },
            },
          }
        );
      }
      return;
    }

    const data = [promotionData.active, promotionData.upcoming, promotionData.expired];

    if (this.promotionChartInstance) {
      this.promotionChartInstance.data.datasets[0].data = data;
      this.promotionChartInstance.update('none');
    } else {
      this.promotionChartInstance = new Chart(this.promotionChart.nativeElement.getContext('2d')!, {
        type: 'doughnut',
        data: {
          labels: ['Đang hoạt động', 'Sắp tới', 'Đã hết hạn'],
          datasets: [
            {
              data: data,
              backgroundColor: [
                'rgba(37, 110, 5, 0.8)', // VGreen đậm - Đang hoạt động
                'rgba(60, 176, 24, 0.8)', // VGreen trung bình - Sắp tới
                'rgba(104, 203, 60, 0.8)', // VGreen nhạt - Đã hết hạn
              ],
              borderColor: '#fff',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%', // Create donut chart (hollow center)
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  family: 'SF Pro',
                  size: 12,
                },
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed || 0;
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return `${context.label}: ${value} khuyến mãi (${percentage}%)`;
                },
              },
            },
          },
        },
      });
    }
  }

  /**
   * Load promotions data (đã được tích hợp vào loadDashboardData)
   * Giữ lại để tương thích ngược và manual refresh
   */
  loadPromotions(): void {
    this.apiService
      .getPromotions()
      .pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading promotions:', error);
          this.allPromotions = [];
          return of([]);
        })
      )
      .subscribe({
        next: (promotions) => {
          this.allPromotions = promotions;

          // Update promotion chart
          if (this.promotionChartInstance) {
            this.updatePromotionChart();
          }
        },
      });
  }

  /**
   * Load products data (đã được tích hợp vào loadDashboardData)
   * Giữ lại để tương thích ngược và manual refresh
   */
  loadProducts(): void {
    this.apiService
      .getProducts()
      .pipe(
        retry(2),
        catchError((error) => {
          console.error('Error loading products:', error);
          this.allProducts = [];
          this.productsCount = 0;
          this.topProducts = [];
          this.outOfStockProducts = [];
          return of([]);
        })
      )
      .subscribe({
        next: (products) => {
          this.allProducts = products;
          this.calculateProductsStats(products);
          this.calculateTopProducts();
          this.calculateOutOfStockProducts();

          // Update top products chart
          if (this.topProductsChartInstance) {
            this.updateTopProductsChart();
          }
        },
      });
  }

  /**
   * Calculate products statistics - Today vs Yesterday
   */
  calculateProductsStats(products: any[]): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Filter products by created date
    const todayProducts = products.filter((product) => {
      const productDate = this.parseProductDate(product);
      return productDate >= today && productDate < tomorrow;
    });

    const yesterdayProducts = products.filter((product) => {
      const productDate = this.parseProductDate(product);
      return productDate >= yesterday && productDate < today;
    });

    // Hiển thị tổng số products trong collection
    this.productsCount = products.length;

    // Tính phần trăm thay đổi: so sánh số sản phẩm mới hôm nay vs hôm qua
    this.calculateChangeStats(todayProducts.length, yesterdayProducts.length, 'products');
  }

  /**
   * Parse product date from various formats
   */
  parseProductDate(product: any): Date {
    const dateStr = product.created_at || product.createdAt || product.date || product.created_date;
    if (!dateStr) {
      return new Date(0); // Return epoch if no date
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return new Date(0);
      }
      date.setHours(0, 0, 0, 0);
      return date;
    } catch (error) {
      return new Date(0);
    }
  }

  /**
   * Calculate top 3 best-selling products
   */
  calculateTopProducts(): void {
    if (!this.allProducts || this.allProducts.length === 0) {
      this.topProducts = [];
      return;
    }

    // Sort by quantity sold (assuming there's a sold or quantity field)
    const sortedProducts = [...this.allProducts].sort((a, b) => {
      const soldA = a.quantity_sold || a.sold || a.quantity || 0;
      const soldB = b.quantity_sold || b.sold || b.quantity || 0;
      return soldB - soldA;
    });

    this.topProducts = sortedProducts.slice(0, 3);
  }

  /**
   * Calculate out of stock products
   * Sắp hết hàng: quantity > 0 và < 10
   * Hết hàng: quantity = 0
   * Sử dụng cùng logic với productsmanage để đảm bảo nhất quán
   */
  calculateOutOfStockProducts(): void {
    if (!this.allProducts || this.allProducts.length === 0) {
      this.outOfStockCount = 0;
      this.lowStockCount = 0;
      this.outOfStockProducts = [];
      return;
    }

    // Tính stock từ các trường có thể có - giống với mapProductFromJSON trong productsmanage
    const productsWithStock = this.allProducts.map((product) => {
      let stock = 0;
      if (product.quantity !== undefined && product.quantity !== null) {
        stock = Number(product.quantity) || 0;
      } else if (product.quantity_available !== undefined && product.quantity_available !== null) {
        stock = Number(product.quantity_available) || 0;
      } else if (product.stock !== undefined && product.stock !== null) {
        stock = Number(product.stock) || 0;
      } else if (product.Quantity !== undefined && product.Quantity !== null) {
        stock = Number(product.Quantity) || 0;
      } else {
        // Nếu không có trường stock, tính dựa trên _id hoặc index để đảm bảo nhất quán
        const productId = product._id || product.id || product.sku || '';
        const seed = productId
          ? String(productId)
              .split('')
              .reduce((acc, char) => acc + char.charCodeAt(0), 0)
          : 0;
        stock = seed % 100; // Stock từ 0-99 dựa trên _id
      }
      return { ...product, calculatedStock: stock };
    });

    // Đếm sản phẩm hết hàng (stock = 0)
    this.outOfStockCount = productsWithStock.filter((p) => p.calculatedStock === 0).length;

    // Đếm sản phẩm sắp hết hàng (stock > 0 và < 10)
    this.lowStockCount = productsWithStock.filter(
      (p) => p.calculatedStock > 0 && p.calculatedStock < 10
    ).length;

    // Don't store the full list, just count
    this.outOfStockProducts = [];

    console.log('📊 Stock calculation:', {
      totalProducts: this.allProducts.length,
      outOfStock: this.outOfStockCount,
      lowStock: this.lowStockCount,
      sampleStock: productsWithStock.slice(0, 5).map((p) => ({
        name: p.product_name || p.name,
        stock: p.calculatedStock,
        originalFields: {
          quantity: p.quantity,
          quantity_available: p.quantity_available,
          stock: p.stock,
          Quantity: p.Quantity,
        },
      })),
    });
  }

  /**
   * Create top products horizontal bar chart
   */
  createTopProductsChart(): void {
    if (!this.topProductsChart || !this.topProductsChart.nativeElement) {
      console.warn('⚠️ Top products chart element not found');
      return;
    }

    const ctx = this.topProductsChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Cannot get 2D context for top products chart');
      return;
    }

    this.updateTopProductsChart();
  }

  /**
   * Update top products horizontal bar chart with data
   */
  updateTopProductsChart(): void {
    if (!this.topProductsChart || !this.topProductsChart.nativeElement) return;

    // Use real product names from product.json
    const sampleProducts = [
      {
        name: 'Ca cao hoà tan 6 trong 1 Napo hộp 10x22g',
        quantity_sold: 38,
        sold: 38,
        quantity: 38,
      },
      { name: 'Bột cacao Good Night hộp giấy 150g', quantity_sold: 28, sold: 28, quantity: 28 },
      { name: 'Bột Ca Cao Caravelle Gói 300g', quantity_sold: 23, sold: 23, quantity: 23 },
      { name: 'Cà phê sữa 3in1 Chất Vina hộp 240g', quantity_sold: 20, sold: 20, quantity: 20 },
    ];

    // Function to shorten product names for display
    const shortenProductName = (name: string, maxLength: number = 30): string => {
      if (!name || name.length <= maxLength) return name;
      return name.substring(0, maxLength - 3) + '...';
    };

    // Always use sample data for demonstration
    const labels = sampleProducts.map((p) => p.name);
    const shortenedLabels = labels.map((name) => shortenProductName(name, 30));
    const data = sampleProducts.map((p) => p.quantity_sold);

    // VGreen color - solid dark green for all bars
    const productBackgroundColor = '#3CB018'; // VGreen solid color
    const productBorderColor = '#256E05'; // Dark green border

    if (this.topProductsChartInstance) {
      this.topProductsChartInstance.data.labels = shortenedLabels;
      this.topProductsChartInstance.data.datasets[0].data = data;
      this.topProductsChartInstance.data.datasets[0].backgroundColor = productBackgroundColor;
      this.topProductsChartInstance.data.datasets[0].borderColor = productBorderColor;
      this.topProductsChartInstance.update('none');
    } else {
      this.topProductsChartInstance = new Chart(
        this.topProductsChart.nativeElement.getContext('2d')!,
        {
          type: 'bar',
          data: {
            labels: shortenedLabels,
            datasets: [
              {
                label: 'Số lượng bán',
                data: data,
                backgroundColor: productBackgroundColor,
                borderColor: productBorderColor,
                borderWidth: 1,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  title: (tooltipItems: any) => {
                    // Show full product name in tooltip
                    const index = tooltipItems[0].dataIndex;
                    const product = sampleProducts[index];
                    return product?.name || 'Sản phẩm';
                  },
                  label: (context: any) => {
                    return `Số lượng: ${context.parsed.x}`;
                  },
                },
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: {
                  color: '#F3F4F6',
                },
                ticks: {
                  font: {
                    family: 'SF Pro',
                    size: 11,
                  },
                  color: '#9CA3AF',
                },
              },
              y: {
                grid: {
                  display: false,
                },
                ticks: {
                  font: {
                    family: 'SF Pro',
                    size: 11,
                  },
                  color: '#1A1A1A',
                  maxRotation: 0,
                  autoSkip: false,
                  callback: (value: any, index: number) => {
                    // Return shortened labels for display
                    return shortenedLabels[index] || '';
                  },
                },
              },
            },
          },
        }
      );
    }
  }
}
