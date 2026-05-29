import { Component, signal, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import {
  Router,
  RouterOutlet,
  RouterModule,
  NavigationStart,
  NavigationEnd,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from './services/cart.service';
import { CartComponent } from './cart/cart';
import { ScrollLockService } from './services/scroll-lock.service';
import { FooterComponent } from './footer/footer';
import { HeaderComponent } from './header/header';
import { AuthPopupComponent } from './auth/auth-popup/auth-popup';
import { AuthPopupService } from './services/auth-popup.service';
import { Veebot } from './veebot/veebot';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CartComponent,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    RouterModule,
    AuthPopupComponent,
    Veebot,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('my-user');

  // Scroll to top button state
  showScrollButton: boolean = false;
  private scrollThreshold: number = 300; // Hiển thị button sau khi scroll 300px
  private scrollHandler: (() => void) | null = null;

  // Debug computed property
  get isCartOpen() {
    return this.cartService.getIsOpen()();
  }

  constructor(
    public cartService: CartService,
    private scrollLock: ScrollLockService,
    public authPopupService: AuthPopupService,
    private router: Router
  ) {
    console.log(' [APP] Constructor được gọi - App component đang khởi tạo');
    console.log(' [APP] Current URL:', window.location.href);

    // Track window.location changes
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      console.log('🌐 [HISTORY] pushState called:', args[2]);
      return originalPushState.apply(history, args);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      console.log('🌐 [HISTORY] replaceState called:', args[2]);
      return originalReplaceState.apply(history, args);
    };

    // Track router events
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          console.log('🧭 [ROUTER] Navigation START:', event.url);
        } else if (event instanceof NavigationEnd) {
          console.log('🧭 [ROUTER] Navigation END:', event.url);
        }
      });

    // Track page reload/unload
    window.addEventListener('beforeunload', (e) => {
      console.log(' [WINDOW] beforeunload - Page đang reload/navigate away!');
      console.log(' Stack trace:', new Error().stack);
    });

    // Quản lý scroll lock
    effect(() => {
      const isOpen = this.cartService.getIsOpen()();

      if (isOpen) {
        this.scrollLock.lock();
      } else {
        this.scrollLock.unlock();
      }
    });
  }

  onCheckout() {
    // Logic checkout sẽ được implement sau
    console.log('Checkout clicked');
  }

  onSelectAll() {
    this.cartService.toggleSelectAll();
  }

  ngOnInit(): void {
    // Initialize scroll listener for scroll-to-top button
    this.initScrollListener();

    // Track route changes để reset scroll state
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      // Reset scroll button state khi navigate
      this.showScrollButton = false;

      // Scroll to top khi navigate (trừ account routes)
      if (!this.isAccountRoute()) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    // Cleanup scroll listener
    if (this.scrollHandler && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }

  /**
   * Kiểm tra xem có đang ở account routes không
   */
  isAccountRoute(): boolean {
    return this.router.url.startsWith('/account');
  }

  /**
   * Initialize scroll listener để hiển thị/ẩn scroll-to-top button
   */
  private initScrollListener(): void {
    if (typeof window === 'undefined') return;

    this.scrollHandler = (): void => {
      // Chỉ update button state nếu không ở account route
      if (!this.isAccountRoute()) {
        const scrollY =
          window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        this.showScrollButton = scrollY > this.scrollThreshold && scrollY > 0;
      } else {
        this.showScrollButton = false;
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Gọi lần đầu để set initial state
    this.scrollHandler();
  }

  /**
   * Scroll to top
   */
  scrollToTop(): void {
    if (typeof window === 'undefined') return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}
