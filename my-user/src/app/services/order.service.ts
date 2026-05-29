import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// ========== INTERFACES ==========
export interface OrderItem {
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  image?: string;
  unit?: string;
  category?: string;
  subcategory?: string;
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
  originalPrice?: number; // Giá gốc (để hiển thị gạch ngang cho item tặng kèm)
}

export interface ShippingAddress {
  city: string;
  district: string;
  ward: string;
  detail: string;
}

export interface ShippingInfo {
  fullName: string;
  phone: string;
  email?: string;
  address: ShippingAddress;
  deliveryMethod: 'standard' | 'express';
  warehouseAddress?: string;
  notes?: string;
}

export interface InvoiceInfo {
  companyName?: string;
  taxId?: string;
  invoiceEmail?: string;
  invoiceAddress?: string;
}

export interface CreateOrderRequest {
  CustomerID: string;
  shippingInfo: ShippingInfo;
  items: OrderItem[];
  paymentMethod: 'cod' | 'vnpay' | 'momo' | 'card' | 'banking';
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  code?: string;
  promotionName?: string;
  wantInvoice?: boolean;
  invoiceInfo?: InvoiceInfo;
  consultantCode?: string;
}

export interface Order extends CreateOrderRequest {
  OrderID: string;
  status:
    | 'pending'
    | 'confirmed'
    // | 'processing'        // Đang xử lý - Đã comment
    | 'shipping'
    | 'delivered'
    | 'received' // Đã nhận hàng (user xác nhận hoặc tự động sau 24h)
    | 'completed'
    | 'cancelled'
    | 'processing_return'
    | 'returning'
    | 'returned';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  count?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = 'http://localhost:3000/api/orders';

  constructor(private http: HttpClient) {}

  /**
   * Tạo đơn hàng mới
   */
  createOrder(orderData: CreateOrderRequest): Observable<ApiResponse<Order>> {
    console.log(' [OrderService] Creating order:', orderData);

    return this.http.post<ApiResponse<Order>>(this.apiUrl, orderData).pipe(
      tap((response) => {
        if (response.success) {
          console.log(' [OrderService] Order created successfully:', response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy tất cả đơn hàng của user
   */
  getOrdersByCustomer(customerID: string): Observable<ApiResponse<Order[]>> {
    console.log(` [OrderService] Fetching orders for customer: ${customerID}`);

    return this.http.get<ApiResponse<Order[]>>(`${this.apiUrl}?CustomerID=${customerID}`).pipe(
      tap((response) => {
        if (response.success) {
          console.log(` [OrderService] Fetched ${response.count} orders for ${customerID}`);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy đơn hàng theo OrderID
   */
  getOrderById(orderId: string): Observable<ApiResponse<Order>> {
    console.log(` [OrderService] Fetching order: ${orderId}`);

    return this.http.get<ApiResponse<Order>>(`${this.apiUrl}/${orderId}`).pipe(
      tap((response) => {
        if (response.success) {
          console.log(` [OrderService] Fetched order: ${orderId}`);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Cập nhật trạng thái đơn hàng
   */
  updateOrderStatus(orderId: string, status: Order['status']): Observable<ApiResponse<Order>> {
    console.log(` [OrderService] Updating order ${orderId} status to: ${status}`);

    return this.http.put<ApiResponse<Order>>(`${this.apiUrl}/${orderId}/status`, { status }).pipe(
      tap((response) => {
        if (response.success) {
          console.log(` [OrderService] Order ${orderId} status updated to: ${status}`);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Xóa đơn hàng
   */
  deleteOrder(orderId: string): Observable<ApiResponse<void>> {
    console.log(` [OrderService] Deleting order: ${orderId}`);

    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${orderId}`).pipe(
      tap((response) => {
        if (response.success) {
          console.log(` [OrderService] Order ${orderId} deleted successfully`);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Helper: Lấy CustomerID từ localStorage
   */
  getCustomerID(): string {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      console.warn(' [OrderService] No user found in localStorage');
      return 'guest';
    }

    try {
      const user = JSON.parse(userJson);
      const customerID = user?.CustomerID || 'guest';
      console.log(' [OrderService] CustomerID:', customerID);
      return customerID;
    } catch (error) {
      console.error(' [OrderService] Error parsing user from localStorage:', error);
      return 'guest';
    }
  }

  /**
   * Error handling
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }

    console.error(' [OrderService] Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
