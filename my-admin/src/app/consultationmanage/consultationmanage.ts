import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

interface Consultation {
  _id: string;
  sku: string;
  productName: string;
  questions: Question[];
}

interface Question {
  _id: string;
  question: string;
  customerId: string;
  customerName: string;
  answer: string;
  answeredBy: string;
  answeredAt: Date | null;
  status: 'pending' | 'answered';
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-consultationmanage',
  imports: [CommonModule, FormsModule],
  templateUrl: './consultationmanage.html',
  styleUrl: './consultationmanage.css',
  standalone: true
})
export class ConsultationManage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);
  private router = inject(Router);

  consultations: Consultation[] = [];
  allConsultations: Consultation[] = [];
  loadError: string = '';

  // Filter state
  currentFilter: 'all' | 'pending' | 'answered' = 'all';
  showFilterDropdown: boolean = false;

  // Search state
  searchQuery: string = '';


  // Popup state
  showPopup: boolean = false;
  popupMessage: string = '';
  popupType: 'success' | 'error' | 'info' = 'success';

  // Statistics
  statistics = {
    total: 0,
    pending: 0,
    answered: 0
  };


  ngOnInit(): void {
    this.loadConsultations();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.closeFilterDropdown();
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  loadConsultations(): void {
    this.loadError = '';
    
    this.http.get<any>('http://localhost:3000/api/consultations').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.allConsultations = response.data;
          this.applyFilters();
          this.updateStatistics();
        } else {
          this.loadError = 'Không thể tải danh sách tư vấn';
          this.allConsultations = [];
        }
      },
      error: (error) => {
        console.error('Error loading consultations:', error);
        this.loadError = 'Lỗi khi tải danh sách tư vấn';
        this.allConsultations = [];
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allConsultations];

    // Apply status filter
    if (this.currentFilter !== 'all') {
      filtered = filtered.map(consultation => {
        const filteredQuestions = consultation.questions.filter(q => {
          if (this.currentFilter === 'pending') {
            return q.status === 'pending';
          } else if (this.currentFilter === 'answered') {
            return q.status === 'answered';
          }
          return true;
        });
        return {
          ...consultation,
          questions: filteredQuestions
        };
      }).filter(consultation => consultation.questions.length > 0);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.map(consultation => {
        const matchingQuestions = consultation.questions.filter(q => {
          return q.question.toLowerCase().includes(query) ||
                 q.customerName.toLowerCase().includes(query) ||
                 consultation.productName.toLowerCase().includes(query) ||
                 consultation.sku.toLowerCase().includes(query);
        });
        return {
          ...consultation,
          questions: matchingQuestions
        };
      }).filter(consultation => consultation.questions.length > 0);
    }

    this.consultations = filtered;
  }

  updateStatistics(): void {
    this.statistics.total = this.allConsultations.reduce((sum, c) => sum + c.questions.length, 0);
    this.statistics.pending = this.allConsultations.reduce((sum, c) => 
      sum + c.questions.filter(q => q.status === 'pending').length, 0);
    this.statistics.answered = this.allConsultations.reduce((sum, c) => 
      sum + c.questions.filter(q => q.status === 'answered').length, 0);
  }

  onFilterChange(filter: 'all' | 'pending' | 'answered'): void {
    this.currentFilter = filter;
    this.applyFilters();
    this.closeFilterDropdown();
  }

  toggleFilterDropdown(): void {
    this.showFilterDropdown = !this.showFilterDropdown;
  }

  closeFilterDropdown(): void {
    this.showFilterDropdown = false;
  }

  onSearchChange(): void {
    this.applyFilters();
  }


  displayPopup(message: string, type: 'success' | 'error' | 'info'): void {
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;

    setTimeout(() => {
      this.closePopup();
    }, 3000);
  }

  closePopup(): void {
    this.showPopup = false;
    this.popupMessage = '';
  }

  formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTimeAgo(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return this.formatDate(date);
  }

  getFilterLabel(filter: string): string {
    switch (filter) {
      case 'all': return 'Tất cả';
      case 'pending': return 'Chờ trả lời';
      case 'answered': return 'Đã trả lời';
      default: return filter;
    }
  }


  // Navigate to consultation detail page
  viewConsultationDetail(consultation: Consultation): void {
    const sku = consultation.sku;
    if (sku) {
      this.router.navigate(['/consultations', sku]);
    }
  }

  // Get pending questions count
  getPendingCount(consultation: Consultation): number {
    return consultation.questions.filter(q => q.status === 'pending').length;
  }

  // Get answered questions count
  getAnsweredCount(consultation: Consultation): number {
    return consultation.questions.filter(q => q.status === 'answered').length;
  }
}

