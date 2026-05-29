import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ReturnBadgeService {
  private pendingCountSubject = new BehaviorSubject<number>(0);
  public pendingCount$: Observable<number> = this.pendingCountSubject.asObservable();

  constructor() {
    this.loadPendingCount();
  }

  getPendingCount(): number {
    return this.pendingCountSubject.value;
  }

  setPendingCount(count: number): void {
    this.pendingCountSubject.next(count);
 // Lưu vào localStorage để persist 
    localStorage.setItem('returnPendingBadge', count.toString());
  }

  private loadPendingCount(): void {
    const saved = localStorage.getItem('returnPendingBadge');
    if (saved) {
      this.pendingCountSubject.next(parseInt(saved, 10));
    }
  }
}
