import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logout.html',
  styleUrl: './logout.css',
})
export class Logout {
  @Input() isOpen: boolean = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
 console.log('� User confirmed logout'); 
    this.confirm.emit();
  }

  onCancel(): void {
 console.log(' User cancelled logout'); 
    this.cancel.emit();
  }

  onOverlayClick(event: MouseEvent): void {
 // Đóng popup khi click vào overlay (nền mờ) 
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}
