import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrderDetailModalService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  private orderNumberSubject = new BehaviorSubject<string | null>(null);

  public isOpen$: Observable<boolean> = this.isOpenSubject.asObservable();
  public orderNumber$: Observable<string | null> = this.orderNumberSubject.asObservable();

  openModal(orderNumber: string): void {
    this.orderNumberSubject.next(orderNumber);
    this.isOpenSubject.next(true);
    // Lock body scroll when modal opens
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.isOpenSubject.next(false);
    this.orderNumberSubject.next(null);
    // Restore body scroll when modal closes
    document.body.style.overflow = '';
  }

  getIsOpen(): boolean {
    return this.isOpenSubject.value;
  }

  getOrderNumber(): string | null {
    return this.orderNumberSubject.value;
  }
}
