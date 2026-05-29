import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { startWith, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface AdminNotification {
  _id?: string;
  id?: string;
  type: 'order_cancellation_request' | 'new_order' | 'return_request' | 'consultation' | 'system' | 'other';
  customerId?: string;
  customerName?: string;
  orderId?: string;
  orderTotal?: number;
  reason?: string;
  title?: string;
  message?: string;
  sku?: string;
  productName?: string;
  questionId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'active';
  read: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:3000/api/notifications';
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();
  
  private notificationsSubject = new BehaviorSubject<AdminNotification[]>([]);
  public notifications$: Observable<AdminNotification[]> = this.notificationsSubject.asObservable();
  
  private newNotificationSubject = new BehaviorSubject<AdminNotification | null>(null);
  public newNotification$: Observable<AdminNotification | null> = this.newNotificationSubject.asObservable();
  
  private pollingInterval = 5000; // 5 seconds for real-time updates
  private previousNotificationIds: Set<string> = new Set();

  constructor(private http: HttpClient) {
    // Start polling for notifications
    this.startPolling();
  }

  /**
   * Start polling for notifications
   */
  private startPolling(): void {
    interval(this.pollingInterval)
      .pipe(
        startWith(0),
        switchMap(() => {
          return this.http.get<{ success: boolean; data: AdminNotification[] }>(
            `${this.apiUrl}`
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
          const currentNotifications = response.data;
          const currentIds = new Set(
            currentNotifications.map(n => n._id || n.id || '').filter(id => id)
          );
          
          // Detect new notifications
          const newNotifications = currentNotifications.filter(n => {
            const id = n._id || n.id || '';
            return id && !this.previousNotificationIds.has(id) && !n.read;
          });
          
          // If there are new notifications, emit them
          if (newNotifications.length > 0) {
            // Emit the most recent new notification
            const latestNewNotification = newNotifications.sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateB - dateA;
            })[0];
            
            this.newNotificationSubject.next(latestNewNotification);
            console.log('🔔 New notification detected:', latestNewNotification);
          }
          
          // Update previous IDs
          this.previousNotificationIds = currentIds;
          
          // Update notifications
          this.notificationsSubject.next(currentNotifications);
          this.updateUnreadCount(currentNotifications);
        }
      });
  }

  /**
   * Load notifications from API
   */
  loadNotifications(): void {
    this.http.get<{ success: boolean; data: AdminNotification[] }>(
      `${this.apiUrl}`
    ).pipe(
      catchError(error => {
        console.error('Error loading notifications:', error);
        return of({ success: false, data: [] });
      })
    ).subscribe(response => {
      if (response && response.success && response.data) {
        // Initialize previous IDs with current notifications to avoid showing popup for existing notifications
        const currentIds = new Set(
          response.data.map(n => n._id || n.id || '').filter(id => id)
        );
        if (this.previousNotificationIds.size === 0) {
          this.previousNotificationIds = currentIds;
        }
        
        this.notificationsSubject.next(response.data);
        this.updateUnreadCount(response.data);
      }
    });
  }

  /**
   * Get unread count from API
   */
  loadUnreadCount(): void {
    this.http.get<{ success: boolean; count: number }>(
      `${this.apiUrl}/unread-count`
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
    // Optimistic update: Update local state immediately
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map(notif => {
      if ((notif._id === notificationId || notif.id === notificationId) && !notif.read) {
        return { ...notif, read: true };
      }
      return notif;
    });
    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount(updatedNotifications);

    // Then update on server
    this.http.put<{ success: boolean }>(
      `${this.apiUrl}/${notificationId}/read`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error marking notification as read:', error);
        // Revert optimistic update on error
        this.loadNotifications();
        this.loadUnreadCount();
        return of({ success: false });
      })
    ).subscribe(response => {
      if (response && response.success) {
        // Reload to ensure sync with server
        this.loadNotifications();
        this.loadUnreadCount();
      } else {
        // Reload on failure to revert
        this.loadNotifications();
        this.loadUnreadCount();
      }
    });
  }

  /**
   * Update notification status (approve/reject)
   */
  updateNotificationStatus(notificationId: string, action: 'approve' | 'reject'): void {
    this.http.put<{ success: boolean }>(
      `${this.apiUrl}/${notificationId}/status`,
      { action }
    ).pipe(
      catchError(error => {
        console.error('Error updating notification status:', error);
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
   * Update unread count from notifications
   */
  private updateUnreadCount(notifications: AdminNotification[]): void {
    const unreadCount = notifications.filter(n => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }

  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  getNotifications(): Observable<AdminNotification[]> {
    return this.notifications$;
  }

  /**
   * Toast notification methods for admin UI feedback
   * These are simple console logs or could be integrated with a toast service
   */
  showSuccess(message: string, duration: number = 3000): void {
    console.log('✅ Success:', message);
    // TODO: Integrate with toast service if available
  }

  showError(message: string, duration: number = 4000): void {
    console.error('❌ Error:', message);
    // TODO: Integrate with toast service if available
  }

  showWarning(message: string, duration: number = 3000): void {
    console.warn('⚠️ Warning:', message);
    // TODO: Integrate with toast service if available
  }

  showInfo(message: string, duration: number = 3000): void {
    console.info('ℹ️ Info:', message);
    // TODO: Integrate with toast service if available
  }

  removeNotification(id: string): void {
    // For admin, we don't have a remove endpoint, so we just mark as read
    this.markAsRead(id);
  }
}
