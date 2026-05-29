import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ReviewBadgeService {
  private unreviewedCountSubject = new BehaviorSubject<number>(0);
  public unreviewedCount$: Observable<number> = this.unreviewedCountSubject.asObservable();

  constructor() {
    this.loadUnreviewedCount();
  }

  getUnreviewedCount(): number {
    return this.unreviewedCountSubject.value;
  }

  setUnreviewedCount(count: number): void {
    this.unreviewedCountSubject.next(count);
 // Lưu vào localStorage để persist 
    localStorage.setItem('reviewBadgeCount', count.toString());
  }

  private loadUnreviewedCount(): void {
    const saved = localStorage.getItem('reviewBadgeCount');
    if (saved) {
      this.unreviewedCountSubject.next(parseInt(saved, 10));
    }
  }
}
