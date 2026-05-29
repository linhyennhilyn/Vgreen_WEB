import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../services/api.service';

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

interface Consultation {
  _id: string;
  sku: string;
  productName: string;
  questions: Question[];
}

@Component({
  selector: 'app-consultationdetail',
  imports: [CommonModule, FormsModule],
  templateUrl: './consultationdetail.html',
  styleUrl: './consultationdetail.css',
  standalone: true
})
export class ConsultationDetail implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sku: string = '';
  consultation: Consultation | null = null;
  loadError: string = '';

  // Filter state
  currentFilter: 'all' | 'pending' | 'answered' = 'all';
  showFilterDropdown: boolean = false;

  // Search state
  searchQuery: string = '';

  // Selected question for answering
  selectedQuestion: Question | null = null;
  answerText: string = '';
  isSubmittingAnswer: boolean = false;

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

  // Questions display limit
  questionsPerPage: number = 10;
  expandedQuestions: boolean = false;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.sku = params['sku'];
      if (this.sku) {
        this.loadConsultation();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.closeFilterDropdown();
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  loadConsultation(): void {
    this.loadError = '';
    
    this.http.get<any>(`http://localhost:3000/api/consultations/${this.sku}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.consultation = response.data;
          this.updateStatistics();
        } else {
          this.loadError = 'Không tìm thấy thông tin tư vấn cho sản phẩm này';
          this.consultation = null;
        }
      },
      error: (error) => {
        console.error('Error loading consultation:', error);
        this.loadError = 'Lỗi khi tải thông tin tư vấn';
        this.consultation = null;
      }
    });
  }

  updateStatistics(): void {
    if (!this.consultation) {
      this.statistics = { total: 0, pending: 0, answered: 0 };
      return;
    }

    this.statistics.total = this.consultation.questions.length;
    this.statistics.pending = this.consultation.questions.filter(q => q.status === 'pending').length;
    this.statistics.answered = this.consultation.questions.filter(q => q.status === 'answered').length;
  }

  applyFilters(): void {
    // Filter is handled in getDisplayedQuestions
  }

  onFilterChange(filter: 'all' | 'pending' | 'answered'): void {
    this.currentFilter = filter;
    this.closeFilterDropdown();
  }

  toggleFilterDropdown(): void {
    this.showFilterDropdown = !this.showFilterDropdown;
  }

  closeFilterDropdown(): void {
    this.showFilterDropdown = false;
  }

  onSearchChange(): void {
    // Search is handled in getDisplayedQuestions
  }

  // Get displayed questions (with filter and search)
  getDisplayedQuestions(): Question[] {
    if (!this.consultation) return [];

    let filtered = [...this.consultation.questions];

    // Apply status filter
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(q => q.status === this.currentFilter);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(q => {
        return q.question.toLowerCase().includes(query) ||
               q.customerName.toLowerCase().includes(query) ||
               (q.answer && q.answer.toLowerCase().includes(query));
      });
    }

    // Sort: pending first, then answered (by date, newest first)
    filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    if (!this.expandedQuestions && filtered.length > this.questionsPerPage) {
      return filtered.slice(0, this.questionsPerPage);
    }

    return filtered;
  }

  hasMoreQuestions(): boolean {
    if (!this.consultation) return false;
    const displayed = this.getDisplayedQuestions();
    const total = this.getTotalFilteredCount();
    return !this.expandedQuestions && total > this.questionsPerPage;
  }

  getRemainingQuestionsCount(): number {
    return this.getTotalFilteredCount() - this.questionsPerPage;
  }

  getTotalFilteredCount(): number {
    if (!this.consultation) return 0;

    let filtered = [...this.consultation.questions];

    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(q => q.status === this.currentFilter);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(q => {
        return q.question.toLowerCase().includes(query) ||
               q.customerName.toLowerCase().includes(query) ||
               (q.answer && q.answer.toLowerCase().includes(query));
      });
    }

    return filtered.length;
  }

  toggleExpandQuestions(): void {
    this.expandedQuestions = !this.expandedQuestions;
  }

  openAnswerDialog(question: Question): void {
    this.selectedQuestion = question;
    this.answerText = question.answer || '';
  }

  closeAnswerDialog(): void {
    this.selectedQuestion = null;
    this.answerText = '';
    this.isSubmittingAnswer = false;
  }

  submitAnswer(): void {
    if (!this.consultation || !this.selectedQuestion || !this.answerText.trim()) {
      this.displayPopup('Vui lòng nhập câu trả lời', 'error');
      return;
    }

    this.isSubmittingAnswer = true;

    // Get admin name
    const adminName = 'Admin'; // TODO: Get from auth service

    this.http.post<any>(
      `http://localhost:3000/api/consultations/${this.consultation.sku}/answer/${this.selectedQuestion._id}`,
      {
        answer: this.answerText.trim(),
        answeredBy: adminName
      }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.displayPopup('Đã trả lời câu hỏi thành công', 'success');
          this.closeAnswerDialog();
          this.loadConsultation();
        } else {
          this.displayPopup(response.message || 'Có lỗi xảy ra khi trả lời câu hỏi', 'error');
        }
        this.isSubmittingAnswer = false;
      },
      error: (error) => {
        console.error('Error submitting answer:', error);
        const errorMessage = error.error?.message || 'Có lỗi xảy ra khi trả lời câu hỏi';
        this.displayPopup(errorMessage, 'error');
        this.isSubmittingAnswer = false;
      }
    });
  }

  deleteQuestion(question: Question): void {
    if (!this.consultation) return;

    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
      return;
    }

    this.http.delete<any>(
      `http://localhost:3000/api/consultations/${this.consultation.sku}/question/${question._id}`
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.displayPopup('Đã xóa câu hỏi thành công', 'success');
          this.loadConsultation();
        } else {
          this.displayPopup(response.message || 'Có lỗi xảy ra khi xóa câu hỏi', 'error');
        }
      },
      error: (error) => {
        console.error('Error deleting question:', error);
        const errorMessage = error.error?.message || 'Có lỗi xảy ra khi xóa câu hỏi';
        this.displayPopup(errorMessage, 'error');
      }
    });
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

  goBack(): void {
    this.router.navigate(['/consultations']);
  }
}

