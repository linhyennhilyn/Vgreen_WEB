import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ProductCard {
  _id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  image: string;
  brand: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    message: string;
    sessionId: string;
    products?: ProductCard[];
  };
  error?: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  data: {
    sessionId: string;
    messages: ChatMessage[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/api/chat';
  private sessionId: string | null = null;

  constructor(private http: HttpClient) {
    // Lấy hoặc tạo sessionId từ localStorage
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Lấy hoặc tạo sessionId từ localStorage
   */
  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Gửi tin nhắn và nhận phản hồi từ AI
   */
  sendMessage(message: string, userId?: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/message`, {
      message,
      sessionId: this.sessionId,
      userId: userId || null,
    });
  }

  /**
   * Lấy lịch sử hội thoại
   */
  getHistory(): Observable<ChatHistoryResponse> {
    if (!this.sessionId) {
      this.sessionId = this.getOrCreateSessionId();
    }
    return this.http.get<ChatHistoryResponse>(`${this.apiUrl}/history/${this.sessionId}`);
  }

  /**
   * Xóa lịch sử hội thoại
   */
  clearHistory(): Observable<{ success: boolean; message: string }> {
    if (!this.sessionId) {
      this.sessionId = this.getOrCreateSessionId();
    }
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/history/${this.sessionId}`
    );
  }

  /**
   * Lấy sessionId hiện tại
   */
  getSessionId(): string {
    return this.sessionId || this.getOrCreateSessionId();
  }

  /**
   * Reset session (tạo session mới)
   */
  resetSession(): void {
    localStorage.removeItem('chatSessionId');
    this.sessionId = this.getOrCreateSessionId();
  }
}

