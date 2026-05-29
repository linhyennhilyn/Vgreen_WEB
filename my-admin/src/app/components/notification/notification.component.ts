import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AdminNotification } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css'
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: AdminNotification[] = [];
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    // Load notifications
    this.notificationService.loadNotifications();
    
    // Subscribe to notifications Observable
    this.subscription = this.notificationService.notifications$.subscribe(
      (notifications: AdminNotification[]) => {
        this.notifications = notifications;
      }
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Đóng notification
   */
  closeNotification(id: string): void {
    this.notificationService.markAsRead(id);
  }

  /**
   * Lấy icon class dựa trên type
   */
  getIconClass(type: string): string {
    switch (type) {
      case 'success':
        return 'icon-success';
      case 'error':
        return 'icon-error';
      case 'warning':
        return 'icon-warning';
      case 'info':
        return 'icon-info';
      default:
        return '';
    }
  }
}

