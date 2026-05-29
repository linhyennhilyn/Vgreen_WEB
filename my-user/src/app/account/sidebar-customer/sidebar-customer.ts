import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  Input,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { WishlistService } from '../../services/wishlist.service';
import { ReturnBadgeService } from '../../services/return-badge.service';
import { ReviewBadgeService } from '../../services/review-badge.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Logout } from '../../auth/logout/logout';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge?: number;
  isActive?: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  memberSince?: string;
  phone?: string;
  address?: string;
  customerType?: string;
  totalSpent?: number;
}

@Component({
  selector: 'app-sidebar-customer',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, Logout],
  templateUrl: './sidebar-customer.html',
  styleUrl: './sidebar-customer.css',
})
export class SidebarCustomer implements OnInit, OnChanges, OnDestroy {
  @Output() menuItemClicked = new EventEmitter<string>();
  @Input() notificationBadge: number = 0;

  // Mobile sidebar state
  isMobileSidebarOpen = false;
  // Logout popup state
  isLogoutPopupOpen = false;

  // Wishlist subscription
  private wishlistSubscription: Subscription = new Subscription();
  // Return badge subscription
  private returnBadgeSubscription: Subscription = new Subscription();
  // Review badge subscription
  private reviewBadgeSubscription: Subscription = new Subscription();
  // Router subscription
  private routerSubscription?: Subscription;

  // User info (get from service)
  // Commented out mockup data to avoid showing fake data to customers
  // userProfile: UserProfile = {
  //   name: 'Thu Hà',
  //   email: 'alice@email.com',
  //   avatar: '/asset/image/avt.png',
  //   memberSince: '2024',
  //   phone: '123456789',
  //   address: 'Hà Nội',
  //   customerType: 'Regular',
  // };

  // Initialize with empty/default values - will be loaded from backend/localStorage
  userProfile: UserProfile = {
    name: '',
    email: '',
    avatar: '/asset/image/avt.png', // Default avatar
    memberSince: '',
    phone: '',
    address: '',
    customerType: '',
    totalSpent: 0,
  };

  // Display info based on priority (Họ tên => SĐT => Email)
  getDisplayInfo(): { primary: string; secondary: string } {
    const { name, phone, email } = this.userProfile;

    // Show name as primary, or placeholder if not loaded yet
    const primary = name || 'Khách hàng';

    // Show phone as secondary if available, otherwise email, or empty if not loaded
    const secondary = phone || email || '';

    return { primary, secondary };
  }

  // Check if secondary info is phone
  isSecondaryPhone(): boolean {
    return !!this.userProfile.phone;
  }

  // Calculate points from TotalSpent (10k = 1 điểm)
  getCustomerPoints(): number {
    const totalSpent = this.userProfile.totalSpent || 0;
    return Math.floor(totalSpent / 10000);
  }

  // Get tooltip text for customer badge
  getCustomerBadgeTooltip(): string {
    const points = this.getCustomerPoints();
    const totalSpent = this.userProfile.totalSpent || 0;
    // Format: "Điểm tích lũy: X điểm | Tổng chi tiêu: Y đ"
    return `Điểm tích lũy: ${points.toLocaleString(
      'vi-VN'
    )} điểm | Tổng chi tiêu: ${totalSpent.toLocaleString('vi-VN')} đ`;
  }

  // Menu items
  menuItems: MenuItem[] = [
    {
      id: 'profile',
      icon: '/asset/icons/person.png',
      label: 'Tài khoản cá nhân',
      route: '/account/profile',
      isActive: false,
    },
    {
      id: 'addresses',
      icon: '/asset/icons/map.png',
      label: 'Sổ địa chỉ',
      route: '/account/address',
      badge: 0,
      isActive: false,
    },
    {
      id: 'orders',
      icon: '/asset/icons/order.png',
      label: 'Quản lý đơn hàng',
      route: '/account/orders',
      badge: 0,
      isActive: true,
    },
    {
      id: 'returns',
      icon: '/asset/icons/return.png',
      label: 'Quản lý đổi trả',
      route: '/account/return-management',
      badge: 0,
      isActive: false,
    },
    {
      id: 'reviews',
      icon: '/asset/icons/star_outline.png',
      label: 'Đánh giá đơn hàng',
      route: '/account/reviews',
      badge: 0,
      isActive: false,
    },
    {
      id: 'wishlist',
      icon: '/asset/icons/heart_outline.png',
      label: 'Sản phẩm yêu thích',
      route: '/account/wishlist',
      badge: 0,
      isActive: false,
    },
    {
      id: 'notifications',
      icon: '/asset/icons/notice.png',
      label: 'Thông báo',
      route: '/account/notifications',
      badge: 0,
      isActive: false,
    },
  ];

  constructor(
    private router: Router,
    private http: HttpClient,
    private wishlistService: WishlistService,
    private returnBadgeService: ReturnBadgeService,
    private reviewBadgeService: ReviewBadgeService
  ) {}

  ngOnInit(): void {
    // Get current route and set active
    this.setActiveMenuItem(this.router.url);
    this.loadUserProfile();
    this.updateNotificationBadge();
    this.subscribeToWishlist();
    this.subscribeToReturnBadge();
    this.subscribeToReviewBadge();
    this.updateReviewsBadge();
    this.updateReturnsBadge();

    // Listen for router navigation events
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.setActiveMenuItem(event.urlAfterRedirects || this.router.url);
      });

    // Listen for storage changes to update badges (cross-tab only, same-tab uses services)
    window.addEventListener('storage', (e: StorageEvent) => {
      if (
        e.key === 'returnManagementData' ||
        e.key === 'returnManagementDataChanged' ||
        e.key === 'returnTabCounts'
      ) {
        this.updateReturnsBadge();
      }
      if (e.key === 'reviewBadgeCount') {
        this.updateReviewsBadge();
      }
      // Listen for user info updates (including TotalSpent updates)
      if (e.key === 'user' || e.key === 'userInfo' || e.key === 'userDataRefreshed') {
        this.loadUserProfile();
      }
    });

    // Listen for custom events to update user profile in real-time (same tab)
    window.addEventListener('userInfoUpdated', () => {
      this.loadUserProfile();
    });

    // Listen for avatar updates from personal-information component
    window.addEventListener('avatarUpdated', (event: any) => {
      if (event.detail && event.detail.avatar) {
        this.userProfile.avatar = event.detail.avatar;
        console.log(' [Sidebar] Avatar updated from personal-information:', event.detail.avatar);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['notificationBadge']) {
      this.updateNotificationBadge();
    }
  }

  updateNotificationBadge(): void {
    const notificationItem = this.menuItems.find((item) => item.id === 'notifications');
    if (notificationItem) {
      notificationItem.badge = this.notificationBadge;
    }
  }

  // Subscribe to wishlist changes
  subscribeToWishlist(): void {
    this.wishlistSubscription = this.wishlistService.wishlist$.subscribe((wishlist) => {
      this.updateWishlistBadge(wishlist.length);
    });
  }

  // Subscribe to return badge changes
  subscribeToReturnBadge(): void {
    this.returnBadgeSubscription = this.returnBadgeService.pendingCount$.subscribe(
      (count: number) => {
        this.updateReturnBadgeFromService(count);
      }
    );
  }

  // Subscribe to review badge changes
  subscribeToReviewBadge(): void {
    this.reviewBadgeSubscription = this.reviewBadgeService.unreviewedCount$.subscribe(
      (count: number) => {
        this.updateReviewBadgeFromService(count);
      }
    );
  }

  // Update wishlist badge
  updateWishlistBadge(count: number): void {
    const wishlistItem = this.menuItems.find((item) => item.id === 'wishlist');
    if (wishlistItem) {
      wishlistItem.badge = count;
    }
  }

  // Update reviews badge from localStorage (fallback/initial load)
  updateReviewsBadge(): void {
    const saved = localStorage.getItem('reviewBadgeCount');
    if (saved) {
      const count = parseInt(saved, 10);
      this.updateReviewBadgeFromService(count);
    }
  }

  // Update review badge from service (real-time update)
  updateReviewBadgeFromService(count: number): void {
    const reviewsItem = this.menuItems.find((item) => item.id === 'reviews');
    if (reviewsItem) {
      reviewsItem.badge = count;
    }
  }

  // Update returns badge based on tab count from return-management component
  updateReturnsBadge(): void {
    let pendingCount = 0;

    // Lấy tab counts từ return-management component
    const tabCountsData = localStorage.getItem('returnTabCounts');
    if (tabCountsData) {
      try {
        const tabCounts = JSON.parse(tabCountsData);
        // Lấy count của tab "Đang chờ xử lý" (id: 'processing_return')
        pendingCount = tabCounts['processing_return'] || 0;
      } catch (e) {
        console.error('Error parsing return tab counts:', e);
      }
    }

    this.updateReturnBadgeFromService(pendingCount);
  }

  // Update return badge from service (real-time update)
  updateReturnBadgeFromService(count: number): void {
    const returnsItem = this.menuItems.find((item) => item.id === 'returns');
    if (returnsItem) {
      returnsItem.badge = count;
    }
  }

  // Load user profile from backend (MongoDB) first, fallback to localStorage
  loadUserProfile(): void {
    // Lấy CustomerID từ localStorage
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      console.log(' [Sidebar] No user data in localStorage');
      this.userProfile.avatar = '/asset/image/avt.png';
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      const customerID = user.CustomerID;

      if (!customerID || customerID === 'guest') {
        console.log(' [Sidebar] No CustomerID found, using localStorage data');
        this.loadUserProfileFromLocalStorage(user);
        return;
      }

      // Load từ backend trước (MongoDB) - thêm timestamp để tránh cache
      // Sử dụng full URL để đảm bảo request đến đúng backend server
      const timestamp = new Date().getTime();
      const apiUrl = `http://localhost:3000/api/auth/user/${customerID}?t=${timestamp}`;
      console.log(`\n🔄 [Sidebar] Loading user profile for CustomerID: ${customerID}`);
      console.log(`📡 [Sidebar] API URL: ${apiUrl}`);
      this.http.get<any>(apiUrl).subscribe({
        next: (response) => {
          console.log(`📥 [Sidebar] API Response:`, response);

          if (response.success && response.user) {
            const backendUser = response.user;
            console.log('✅ [Sidebar] Loaded user profile from backend:', {
              CustomerID: backendUser.CustomerID,
              FullName: backendUser.FullName,
              CustomerTiering: backendUser.CustomerTiering,
              TotalSpent: backendUser.TotalSpent,
              CustomerTieringType: typeof backendUser.CustomerTiering,
              TotalSpentType: typeof backendUser.TotalSpent,
            });

            // Cập nhật user profile từ backend
            // Check avatar từ backend, nếu không có hoặc empty thì dùng default
            const backendAvatar = backendUser.avatar || backendUser.Avatar || '';
            // Nếu FullName là null, undefined, hoặc empty string, hiển thị "Khách hàng"
            const fullName = backendUser.FullName;
            const displayName = !fullName || fullName.trim() === '' ? 'Khách hàng' : fullName;

            // Đảm bảo TotalSpent và CustomerTiering được load đúng từ backend
            const totalSpent =
              backendUser.TotalSpent !== undefined && backendUser.TotalSpent !== null
                ? Number(backendUser.TotalSpent)
                : 0;
            const customerTiering = backendUser.CustomerTiering || 'Đồng';

            console.log('✅ [Sidebar] Parsed values:', {
              totalSpent,
              customerTiering,
              totalSpentType: typeof totalSpent,
              customerTieringType: typeof customerTiering,
            });

            this.userProfile = {
              name: displayName,
              email: backendUser.Email || '',
              avatar:
                backendAvatar && backendAvatar.trim() !== ''
                  ? backendAvatar
                  : '/asset/image/avt.png',
              phone: backendUser.Phone || '',
              address: backendUser.Address || '',
              customerType: customerTiering,
              totalSpent: totalSpent,
              memberSince: backendUser.RegisterDate
                ? new Date(backendUser.RegisterDate).getFullYear().toString()
                : '2024',
            };

            console.log('✅ [Sidebar] Final userProfile:', {
              customerType: this.userProfile.customerType,
              totalSpent: this.userProfile.totalSpent,
            });

            // Cập nhật localStorage với dữ liệu mới nhất từ backend
            // Lưu FullName chính xác từ backend (có thể là null, "", hoặc giá trị thực)
            const updatedUser = {
              ...user,
              FullName: backendUser.FullName !== undefined ? backendUser.FullName : null,
              Email: backendUser.Email || '',
              Phone: backendUser.Phone || '',
              Address: backendUser.Address || '',
              CustomerTiering: customerTiering,
              TotalSpent: totalSpent,
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            console.log('✅ [Sidebar] Updated localStorage:', {
              CustomerTiering: updatedUser.CustomerTiering,
              TotalSpent: updatedUser.TotalSpent,
            });
            console.log(`\n`);
          } else {
            console.warn('⚠️ [Sidebar] Backend response invalid, using localStorage');
            console.warn('⚠️ [Sidebar] Response:', JSON.stringify(response, null, 2));
            this.loadUserProfileFromLocalStorage(user);
          }
        },
        error: (error) => {
          console.error('❌ [Sidebar] Error loading user from backend:', error);
          console.error('❌ [Sidebar] Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error,
          });
          console.log('⚠️ [Sidebar] Falling back to localStorage');
          this.loadUserProfileFromLocalStorage(user);
        },
      });
    } catch (error) {
      console.error(' [Sidebar] Error parsing user data:', error);
      this.userProfile.avatar = '/asset/image/avt.png';
    }
  }

  // Load user profile from localStorage (fallback - chỉ dùng khi không thể load từ backend)
  private loadUserProfileFromLocalStorage(user: any): void {
    // Prioritize FullName/fullName from localStorage['user'] (từ backend API update)
    // Nếu FullName/fullName là null, undefined, hoặc empty string, hiển thị "Khách hàng"
    let userName = '';
    if (user.FullName !== undefined) {
      // Nếu FullName là null hoặc empty, hiển thị "Khách hàng"
      const fullName = user.FullName;
      userName = !fullName || fullName.trim() === '' ? 'Khách hàng' : fullName;
    } else if (user.fullName !== undefined) {
      // Nếu fullName là null hoặc empty, hiển thị "Khách hàng"
      const fullName = user.fullName;
      userName = !fullName || fullName.trim() === '' ? 'Khách hàng' : fullName;
    } else {
      // Fallback: nếu không có FullName/fullName, hiển thị "Khách hàng"
      userName = 'Khách hàng';
    }

    // Check avatar từ user, nếu không có hoặc empty thì dùng default
    const userAvatar = user.avatar || user.Avatar || '';

    // Đảm bảo TotalSpent và CustomerTiering được parse đúng từ localStorage
    const totalSpent =
      user.TotalSpent !== undefined && user.TotalSpent !== null
        ? Number(user.TotalSpent)
        : user.totalSpent !== undefined && user.totalSpent !== null
        ? Number(user.totalSpent)
        : 0;
    const customerTiering =
      user.CustomerTiering || user.CustomerType || user.customer_type || 'Đồng';

    console.log('⚠️ [Sidebar] Loading from localStorage:', {
      CustomerTiering: customerTiering,
      TotalSpent: totalSpent,
    });

    this.userProfile = {
      name: userName,
      email: user.Email || user.email || '',
      avatar: userAvatar && userAvatar.trim() !== '' ? userAvatar : '/asset/image/avt.png',
      phone: user.Phone || user.phoneNumber || user.phone || '',
      address: user.Address || user.address || '',
      customerType: customerTiering,
      totalSpent: totalSpent,
      memberSince:
        user.RegisterDate || user.register_date || user.createdAt
          ? new Date(user.RegisterDate || user.register_date || user.createdAt)
              .getFullYear()
              .toString()
          : '2024',
    };

    // KHÔNG load name từ userInfo localStorage vì nó có thể chứa dữ liệu cũ
    // Name phải luôn được load từ backend (MongoDB collection users)
    // Chỉ load phone và email từ userInfo nếu cần
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        // KHÔNG override name từ userInfo - name phải từ backend
        // Chỉ load phone và email nếu chưa có
        if (userInfo.phone && !this.userProfile.phone) {
          this.userProfile.phone = userInfo.phone;
        }
        if (userInfo.email && !this.userProfile.email) {
          this.userProfile.email = userInfo.email;
        }
        // KHÔNG load avatar từ localStorage, chỉ dùng default hoặc từ backend
        if (!this.userProfile.avatar || this.userProfile.avatar.trim() === '') {
          this.userProfile.avatar = '/asset/image/avt.png';
        }
      } catch (error) {
        console.error('Error parsing userInfo:', error);
      }
    }

    console.log(' [Sidebar] Loaded user profile from localStorage:', this.userProfile);
  }

  // Set active menu item based on route
  setActiveMenuItem(route: string): void {
    // First, reset all items to inactive
    this.menuItems.forEach((item) => {
      item.isActive = false;
    });

    // Remove query params and hash from route for comparison
    const routeWithoutParams = route.split('?')[0].split('#')[0];

    // Sort by route length (longest first) to handle overlapping routes
    const sortedItems = [...this.menuItems].sort((a, b) => b.route.length - a.route.length);

    // Set active the first matching item
    for (const item of sortedItems) {
      if (routeWithoutParams === item.route || routeWithoutParams.startsWith(item.route + '/')) {
        const originalItem = this.menuItems.find((m) => m.id === item.id);
        if (originalItem) {
          originalItem.isActive = true;
        }
        break; // Only activate the first (longest) match
      }
    }
  }

  // Handle menu click
  onMenuItemClick(item: MenuItem): void {
    // Set active
    this.menuItems.forEach((m) => (m.isActive = false));
    item.isActive = true;

    // Navigate
    this.router.navigate([item.route]);

    // Close mobile sidebar after navigation
    this.closeMobileSidebar();

    // Emit event
    this.menuItemClicked.emit(item.id);
  }

  // Toggle mobile sidebar
  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  // Close mobile sidebar
  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  // Handle overlay click to close sidebar
  onOverlayClick(): void {
    this.closeMobileSidebar();
  }

  // Logout
  onLogout(): void {
    // Đóng sidebar khi nhấn nút logout (nếu đang mở ở mobile)
    this.closeMobileSidebar();
    // Mở popup xác nhận logout
    this.isLogoutPopupOpen = true;
  }

  confirmLogout(): void {
    // Clear user data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    sessionStorage.clear();

    console.log(' User confirmed logout - clearing session');

    // Close popup and redirect to home
    this.isLogoutPopupOpen = false;
    window.location.href = '/';
  }

  cancelLogout(): void {
    this.isLogoutPopupOpen = false;
  }

  ngOnDestroy(): void {
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
    if (this.returnBadgeSubscription) {
      this.returnBadgeSubscription.unsubscribe();
    }
    if (this.reviewBadgeSubscription) {
      this.reviewBadgeSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
