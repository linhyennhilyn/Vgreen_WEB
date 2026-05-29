import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ReviewSyncService {
  private ordersChangedSubject = new Subject<void>();
  public ordersChanged$: Observable<void> = this.ordersChangedSubject.asObservable();

  constructor() {}

 /** 
 * Notify that orders have changed (e.g., when order status changes to completed) 
 * This will trigger reviews component to reload unreviewed orders 
 */ 
  notifyOrdersChanged(): void {
    this.ordersChangedSubject.next();
  }
}
