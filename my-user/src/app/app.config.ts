import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { NotificationService } from './services/notification.service';
import { CartService } from './services/cart.service';
import { WishlistService } from './services/wishlist.service';
import { ScrollLockService } from './services/scroll-lock.service';
import { AuthPopupService } from './services/auth-popup.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      })
    ),
    provideHttpClient(),
    NotificationService,
    CartService,
    WishlistService,
    ScrollLockService,
    AuthPopupService,
  ],
};
