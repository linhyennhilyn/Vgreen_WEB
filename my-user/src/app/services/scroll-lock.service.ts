import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ScrollLockService {
  private scrollY = 0;

  lock() {
 // Tính scrollbar width động 
    const scrollbarWidth = this.getScrollbarWidth();

 // Lưu scroll position 
    this.scrollY = window.scrollY;

 // Apply styles 
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

 // Compensate cho header nếu có 
    const header = document.querySelector('.nav-menu') as HTMLElement;
    if (header) {
      header.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  unlock() {
 // Remove styles 
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.paddingRight = '';

 // Restore header 
    const header = document.querySelector('.nav-menu') as HTMLElement;
    if (header) {
      header.style.paddingRight = '';
    }

 // Restore scroll position 
    window.scrollTo(0, this.scrollY);
  }

  private getScrollbarWidth(): number {
 // Tạo element tạm để đo scrollbar 
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    (outer.style as any).msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  }
}
