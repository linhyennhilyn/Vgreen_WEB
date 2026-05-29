import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PopupType =
  | 'login'
  | 'register-phone'
  | 'otp'
  | 'register-password'
  | 'forgot-password-phone'
  | 'forgot-password-reset'
  | null;

@Injectable({
  providedIn: 'root',
})
export class AuthPopupService {
  private activePopupSubject = new BehaviorSubject<PopupType>(null);
  private popupDataSubject = new BehaviorSubject<any>(null);

  constructor() {
 // Restore state from sessionStorage khi service khởi tạo
    this.restoreStateFromSessionStorage();
  }

  private restoreStateFromSessionStorage() {
    const savedPopup = sessionStorage.getItem('activePopup') as PopupType;
    const savedData = sessionStorage.getItem('popupData');

    if (savedPopup) {
 console.log(' [AUTH-POPUP-SERVICE] Restoring popup state:', savedPopup);
      this.activePopupSubject.next(savedPopup);
      if (savedData) {
        try {
          this.popupDataSubject.next(JSON.parse(savedData));
        } catch (e) {
 console.error('Error parsing saved popup data:', e);
        }
      }
      document.body.style.overflow = 'hidden'; // Lock scroll
    }
  }

  getActivePopup() {
    return this.activePopupSubject.asObservable();
  }

  getPopupData() {
    return this.popupDataSubject.asObservable();
  }

  openPopup(type: PopupType, data: any = null) {
 console.log(' [AUTH-POPUP-SERVICE] openPopup:', type);
    this.popupDataSubject.next(data);
    this.activePopupSubject.next(type);

 // Lưu state vào sessionStorage để persist qua reload
    if (type) {
      sessionStorage.setItem('activePopup', type);
      if (data) {
        sessionStorage.setItem('popupData', JSON.stringify(data));
      }
 console.log(' [AUTH-POPUP-SERVICE] Saved popup state to sessionStorage');
    }

 // Lock body scroll when popup opens
    document.body.style.overflow = 'hidden';
  }

  closePopup() {
 console.log(' [AUTH-POPUP-SERVICE] closePopup');
    this.activePopupSubject.next(null);
    this.popupDataSubject.next(null);

 // Clear sessionStorage
    sessionStorage.removeItem('activePopup');
    sessionStorage.removeItem('popupData');
 console.log(' [AUTH-POPUP-SERVICE] Cleared popup state from sessionStorage');

 // Restore body scroll when popup closes
    document.body.style.overflow = 'auto';
  }

  switchPopup(type: PopupType, data: any = null) {
 console.log(' [AUTH-POPUP-SERVICE] switchPopup:', type);
    this.popupDataSubject.next(data);
    this.activePopupSubject.next(type);

 // Update sessionStorage
    if (type) {
      sessionStorage.setItem('activePopup', type);
      if (data) {
        sessionStorage.setItem('popupData', JSON.stringify(data));
      } else {
        sessionStorage.removeItem('popupData');
      }
 console.log(' [AUTH-POPUP-SERVICE] Updated popup state in sessionStorage');
    } else {
      sessionStorage.removeItem('activePopup');
      sessionStorage.removeItem('popupData');
    }
  }

 // Navigation methods
  navigateToLogin() {
 console.log('╔═══════════════════════════════════════════════════════════╗');
 console.log('║ � [AUTH-POPUP-SERVICE] navigateToLogin() ĐƯỢC GỌI! ║');
 console.log('╚═══════════════════════════════════════════════════════════╝');
 console.log(
      '📡 [AUTH-POPUP-SERVICE] activePopup trước khi switch:',
      this.activePopupSubject.value
    );
 console.log('� [AUTH-POPUP-SERVICE] Switching popup to: login');
    this.switchPopup('login');
 console.log(' [AUTH-POPUP-SERVICE] Đã switch popup to login');
 console.log(
      ' [AUTH-POPUP-SERVICE] activePopup sau khi switch:',
      this.activePopupSubject.value
    );
  }

  navigateToRegister() {
    this.switchPopup('register-phone');
  }

  navigateToOTP(phoneNumber: string, flowType: 'register' | 'forgot' = 'register') {
    this.switchPopup('otp', { phoneNumber, flowType });
  }

  navigateToRegisterPassword(phoneNumber: string) {
    this.switchPopup('register-password', { phoneNumber });
  }

  navigateToForgotPassword() {
    this.switchPopup('forgot-password-phone');
  }

  navigateToForgotPasswordReset(phoneNumber: string) {
    this.switchPopup('forgot-password-reset', { phoneNumber });
  }
}
