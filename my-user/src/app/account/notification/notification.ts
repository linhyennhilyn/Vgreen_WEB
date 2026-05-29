import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NotificationService,
  Notification as NotificationItem,
} from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notification.html',
  styleUrl: './notification.css',
})
export class NotificationComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() unreadCountChange = new EventEmitter<number>();
  @ViewChild('tabList') tabList?: ElementRef;
  activeTab: string = 'all';
  canScrollLeft: boolean = false;
  canScrollRight: boolean = false;

  notifications: NotificationItem[] = [];
  private subscription: Subscription = new Subscription();

  tabs = [
    { key: 'all', label: 'Tất cả thông báo' },
    { key: 'order', label: 'Cập nhật đơn hàng' },
    { key: 'promotion', label: 'Khuyến mãi' },
    { key: 'other', label: 'Thông báo khác' },
  ];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    // Load customerId and set it in service
    this.loadCustomerId();

    // Load notifications
    this.notificationService.loadNotifications();
    this.notificationService.loadUnreadCount();

    // Subscribe to notifications
    const notifSub = this.notificationService.notifications$.subscribe((notifications) => {
      this.notifications = notifications;
      this.updateUnreadCount();
    });
    this.subscription.add(notifSub);

    // Subscribe to unread count
    const countSub = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCountChange.emit(count);
    });
    this.subscription.add(countSub);
  }

  ngAfterViewInit(): void {
    // Check scroll buttons after view init
    setTimeout(() => {
      this.checkScrollButtons();
    }, 100);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
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

  @HostListener('window:resize')
  onResize(): void {
    this.checkScrollButtons();
  }

  private loadCustomerId(): void {
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        const customerId = user.CustomerID;
        if (customerId) {
          this.notificationService.setCustomerId(customerId);
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  updateUnreadCount(): void {
    const unreadCount = this.notifications.filter((n) => !this.isNotificationRead(n)).length;
    this.unreadCountChange.emit(unreadCount);
  }

  get filteredNotifications(): NotificationItem[] {
    if (this.activeTab === 'all') {
      return this.notifications;
    }
    return this.notifications.filter((notification) => notification.type === this.activeTab);
  }

  get hasNotifications(): boolean {
    return this.filteredNotifications.length > 0;
  }

  getTabBadge(tabKey: string): number {
    if (tabKey === 'all') {
      return this.notifications.filter((n) => !this.isNotificationRead(n)).length;
    }
    return this.notifications.filter((n) => n.type === tabKey && !this.isNotificationRead(n))
      .length;
  }

  formatTimestamp(date: Date | string | undefined): string {
    if (!date) {
      return '';
    }
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return '';
    }
  }

  getNotificationTimestamp(notification: NotificationItem): Date | string {
    if (notification.timestamp) {
      return notification.timestamp;
    }
    if (notification.createdAt) {
      return notification.createdAt;
    }
    return new Date();
  }

  isNotificationRead(notification: NotificationItem): boolean {
    return notification.read === true || notification.isRead === true;
  }

  markAsRead(notification: NotificationItem): void {
    if (!this.isNotificationRead(notification)) {
      const notificationId = notification._id || notification.id;
      if (notificationId) {
        this.notificationService.markAsRead(notificationId);
      }
    }
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'order':
        return '/asset/icons/order_dark.png';
      case 'promotion':
        return '/asset/icons/promotion_dark.png';
      case 'other':
        return '/asset/icons/notice_dark.png';
      default:
        return '/asset/icons/info.png';
    }
  }

  getNotificationTitle(notification: NotificationItem): string {
    return notification.title || 'Thông báo';
  }

  getNotificationContent(notification: NotificationItem): string {
    return notification.content || notification.message || '';
  }

  onMenuItemClicked(menuId: string): void {
    console.log('Menu item clicked:', menuId);
  }

  markAllAsRead(): void {
    // Mark all notifications as read
    this.notificationService.deleteAllNotifications();
    // Reload notifications after marking as read
    setTimeout(() => {
      this.notificationService.loadNotifications();
      this.notificationService.loadUnreadCount();
    }, 500);
  }
}
