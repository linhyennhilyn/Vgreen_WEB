import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarCustomer } from '../sidebar-customer/sidebar-customer';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-account-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarCustomer],
  templateUrl: './account-layout.html',
  styleUrl: './account-layout.css',
})
export class AccountLayout implements OnInit, OnDestroy {
  notificationBadge: number = 0;
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    // Load customerId and set it in notification service
    this.loadCustomerId();
    
    // Subscribe to notification count changes 
    const sub = this.notificationService.unreadCount$.subscribe((count: number) => {
      this.notificationBadge = count;
    });
    this.subscription.add(sub);

    // Load initial count and notifications
    this.notificationService.loadUnreadCount();
    this.notificationService.loadNotifications();
    
    // Get initial count 
    this.notificationBadge = this.notificationService.getUnreadCount();
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

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
