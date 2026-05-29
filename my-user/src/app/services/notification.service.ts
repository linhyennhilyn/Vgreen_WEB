import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { startWith, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Notification {
  _id?: string;
  id?: string;
  type: 'order' | 'promotion' | 'other';
  customerId?: string;
  orderId?: string;
  orderTotal?: number;
  title: string;
  message?: string;
  content?: string;
  status?: string;
  read: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
  timestamp?: Date;
  isRead?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:3000/api/notifications';
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();
  
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();
  
  private customerId: string | null = null;
  private pollingInterval = 30000; // 30 seconds

  constructor(private http: HttpClient) {
    this.loadCustomerId();
    // Start polling for notifications
    this.startPolling();
  }

  private loadCustomerId(): void {
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        this.customerId = user.CustomerID || null;
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    }
  }

  setCustomerId(customerId: string): void {
    this.customerId = customerId;
    this.loadNotifications();
  }

  /**
   * Start polling for notifications
   */
  private startPolling(): void {
    if (!this.customerId) {
      // Try to load customerId again
      this.loadCustomerId();
    }

    interval(this.pollingInterval)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (!this.customerId) {
            return of({ success: false, data: [] });
          }
          return this.http.get<{ success: boolean; data: Notification[] }>(
            `${this.apiUrl}?customerId=${this.customerId}`
          ).pipe(
            catchError(error => {
              console.error('Error fetching notifications:', error);
              return of({ success: false, data: [] });
            })
          );
        })
      )
      .subscribe(response => {
        if (response && response.success && response.data) {
          const notifications = this.mapNotifications(response.data);
          this.notificationsSubject.next(notifications);
          this.updateUnreadCount(notifications);
        }
      });
  }

  /**
   * Load notifications from API
   */
  loadNotifications(): void {
    if (!this.customerId) {
      this.loadCustomerId();
      if (!this.customerId) {
        return;
      }
    }

    this.http.get<{ success: boolean; data: Notification[] }>(
      `${this.apiUrl}?customerId=${this.customerId}`
    ).pipe(
      catchError(error => {
        console.error('Error loading notifications:', error);
        return of({ success: false, data: [] });
      })
    ).subscribe(response => {
      if (response && response.success && response.data) {
        const notifications = this.mapNotifications(response.data);
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      }
    });
  }

  /**
   * Get unread count from API
   */
  loadUnreadCount(): void {
    if (!this.customerId) {
      this.loadCustomerId();
      if (!this.customerId) {
        this.unreadCountSubject.next(0);
        return;
      }
    }

    this.http.get<{ success: boolean; count: number }>(
      `${this.apiUrl}/unread-count?customerId=${this.customerId}`
    ).pipe(
      catchError(error => {
        console.error('Error loading unread count:', error);
        return of({ success: false, count: 0 });
      })
    ).subscribe(response => {
      if (response && response.success) {
        this.unreadCountSubject.next(response.count || 0);
      }
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    this.http.put<{ success: boolean }>(
      `${this.apiUrl}/${notificationId}/read`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error marking notification as read:', error);
        return of({ success: false });
      })
    ).subscribe(response => {
      if (response && response.success) {
        // Reload notifications
        this.loadNotifications();
      }
    });
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): void {
    // Note: Backend might not have DELETE endpoint, so we'll mark as read for now
    this.markAsRead(notificationId);
  }

  /**
   * Delete all notifications
   */
  deleteAllNotifications(): void {
    // Mark all as read
    const notifications = this.notificationsSubject.value;
    notifications.forEach(notif => {
      if (notif._id || notif.id) {
        this.markAsRead(notif._id || notif.id || '');
      }
    });
  }

  /**
   * Map backend notifications to frontend format
   */
  private mapNotifications(notifications: Notification[]): Notification[] {
    return notifications.map(notif => ({
      ...notif,
      id: notif._id || notif.id,
      content: notif.message || notif.content || '',
      timestamp: notif.createdAt ? new Date(notif.createdAt) : new Date(),
      isRead: notif.read
    }));
  }

  /**
   * Update unread count from notifications
   */
  private updateUnreadCount(notifications: Notification[]): void {
    const unreadCount = notifications.filter(n => !n.read && !n.isRead).length;
    this.unreadCountSubject.next(unreadCount);
  }

  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  incrementUnreadCount(): void {
    const current = this.unreadCountSubject.value;
    this.setUnreadCount(current + 1);
  }

  decrementUnreadCount(): void {
    const current = this.unreadCountSubject.value;
    this.setUnreadCount(Math.max(0, current - 1));
  }

  resetUnreadCount(): void {
    this.setUnreadCount(0);
  }

  getNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }
}
