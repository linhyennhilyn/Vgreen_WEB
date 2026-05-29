import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);

  // Base URL của backend API
  private baseUrl = 'http://localhost:3000/api'; // Thay đổi URL này theo backend của bạn

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  /**
   * Get all users/customers
   */
  getUsers(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/users`).pipe(
      map((response: any) => {
        // Handle both formats: array or object with data property
        if (Array.isArray(response)) {
          return response;
        } else if (response && Array.isArray(response.data)) {
          return response.data;
        } else if (response && Array.isArray(response.users)) {
          return response.users;
        }
        // Return empty array if response is not in expected format
        console.warn('⚠️ [API Service] Unexpected users response format:', response);
        return [];
      })
    );
  }

  /**
   * Get user by ID
   */
  getUserById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/users/${id}`);
  }

  /**
   * Create new user
   */
  createUser(userData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users`, userData, this.httpOptions);
  }

  /**
   * Update user
   */
  updateUser(id: number, userData: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/users/${id}`, userData, this.httpOptions);
  }

  /**
   * Delete user
   */
  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/users/${id}`);
  }

  /**
   * Get all orders
   */
  getOrders(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/orders`).pipe(
      map((response: any) => {
        // Handle both formats: { success: true, data: [...] } or direct array
        if (response && typeof response === 'object') {
          if (response.success && Array.isArray(response.data)) {
            return response.data;
          } else if (Array.isArray(response)) {
            return response;
          } else if (Array.isArray(response.orders)) {
            return response.orders;
          }
        }
        // Return empty array if response is not in expected format
        console.warn('⚠️ [API Service] Unexpected orders response format:', response);
        return [];
      })
    );
  }

  /**
   * Get order by ID
   */
  getOrderById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders/${id}`);
  }

  /**
   * Get orders by user ID
   */
  getOrdersByUserId(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders/user/${userId}`);
  }

  /**
   * Get all products
   */
  getProducts(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/products`).pipe(
      map((response: any) => {
        // Handle both formats: { success: true, data: [...] } or direct array
        if (response && typeof response === 'object') {
          if (response.success && Array.isArray(response.data)) {
            return response.data;
          } else if (Array.isArray(response)) {
            return response;
          } else if (Array.isArray(response.products)) {
            return response.products;
          }
        }
        // Return empty array if response is not in expected format
        console.warn('⚠️ [API Service] Unexpected products response format:', response);
        return [];
      })
    );
  }

  /**
   * Get product by ID
   */
  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/products/${id}`);
  }

  /**
   * Get all blogs
   */
  getBlogs(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/blogs`).pipe(
      map((response: any) => {
        // Handle both formats: { success: true, data: [...] } or direct array
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Update product
   */
  updateProduct(id: string, productData: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/products/${id}`, productData, this.httpOptions);
  }

  /**
   * Update a specific field of a product (PATCH)
   */
  updateProductField(id: string, field: string, value: any): Observable<any> {
    return this.http.patch<any>(
      `${this.baseUrl}/products/${id}`,
      { field, value },
      this.httpOptions
    );
  }

  /**
   * Create new product
   */
  createProduct(productData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products`, productData, this.httpOptions);
  }

  /**
   * Update blog
   */
  updateBlog(id: string, blogData: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/blogs/${id}`, blogData, this.httpOptions);
  }

  /**
   * Create new blog
   */
  createBlog(blogData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/blogs`, blogData, this.httpOptions);
  }

  /**
   * Extract keywords and generate hashtags for a blog
   */
  extractBlogKeywords(blogId: string): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/blogs/${blogId}/extract-keywords`,
      {},
      this.httpOptions
    );
  }

  /**
   * Get related products for a blog based on content keywords/hashtags
   */
  getBlogRelatedProducts(blogId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/blogs/${blogId}/related-products`, this.httpOptions);
  }

  /**
   * Delete blog
   */
  deleteBlog(blogId: string): Observable<any> {
    console.log(`🗑️ [API Service] Deleting blog: ${blogId}`);
    return this.http.delete<any>(`${this.baseUrl}/blogs/${blogId}`, this.httpOptions).pipe(
      map((response: any) => {
        console.log(`📝 [API Service] Delete blog response:`, response);
        return response;
      })
    );
  }

  /**
   * Get all promotions
   */
  getPromotions(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/promotions`).pipe(
      map((response: any) => {
        // Handle both formats: { success: true, data: [...] } or direct array
        if (response && typeof response === 'object') {
          if (response.success && Array.isArray(response.data)) {
            return response.data;
          } else if (Array.isArray(response)) {
            return response;
          } else if (Array.isArray(response.promotions)) {
            return response.promotions;
          }
        }
        // Return empty array if response is not in expected format
        console.warn('⚠️ [API Service] Unexpected promotions response format:', response);
        return [];
      })
    );
  }

  /**
   * Get promotion usage counts for all promotions
   */
  getPromotionUsage(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/promotions/usage`).pipe(
      map((response: any) => {
        if (response && response.success && response.data) {
          return response.data;
        }
        return {};
      })
    );
  }

  /**
   * Get all promotion targets
   */
  getPromotionTargets(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/promotion-targets`).pipe(
      map((response: any) => {
        if (response && response.success && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      })
    );
  }

  /**
   * Get order details
   */
  getOrderDetails(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orderdetails`);
  }

  /**
   * Get order detail by order ID
   */
  getOrderDetailByOrderId(orderId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orderdetails/${orderId}`);
  }

  /**
   * Get all provinces
   */
  getProvinces(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/provinces`);
  }

  /**
   * Get all wards
   */
  getWards(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/wards`);
  }

  /**
   * Get tree (hierarchical address structure)
   */
  getTree(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tree`);
  }

  /**
   * Get all reviews
   */
  getReviews(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/reviews`).pipe(
      map((response: any) => {
        // Handle both formats: { success: true, data: [...] } or direct array
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Get all categories
   */
  getCategories(): Observable<string[]> {
    return this.http.get<any>(`${this.baseUrl}/products/metadata/categories`).pipe(
      map((response: any) => {
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Create new order
   */
  createOrder(orderData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders`, orderData, this.httpOptions).pipe(
      map((response: any) => {
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Update order status
   */
  updateOrderStatus(orderId: string, status: string): Observable<any> {
    return this.http
      .put<any>(`${this.baseUrl}/orders/${orderId}/status`, { status }, this.httpOptions)
      .pipe(
        map((response: any) => {
          return response.success ? response.data : response;
        })
      );
  }

  /**
   * Update order
   */
  updateOrder(orderId: string, orderData: any): Observable<any> {
    return this.http
      .put<any>(`${this.baseUrl}/orders/${orderId}`, orderData, this.httpOptions)
      .pipe(
        map((response: any) => {
          return response.success ? response.data : response;
        })
      );
  }

  /**
   * Delete product
   * @param productId - Product ID/SKU to delete
   * @param confirm - Whether to confirm deletion (for products in pending orders)
   */
  deleteProduct(productId: string, confirm: boolean = false): Observable<any> {
    console.log(`🗑️ [API Service] Deleting product: ${productId}, confirm: ${confirm}`);
    const url = confirm
      ? `${this.baseUrl}/products/${productId}?confirm=true`
      : `${this.baseUrl}/products/${productId}`;
    return this.http.delete<any>(url, this.httpOptions).pipe(
      map((response: any) => {
        console.log(`📦 [API Service] Delete response:`, response);
        // Return the full response, not just data
        return response;
      })
    );
  }

  /**
   * Delete customer/user
   */
  deleteCustomer(customerId: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/users/${customerId}`, this.httpOptions).pipe(
      map((response: any) => {
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Delete promotion
   */
  deletePromotion(promotionId: string): Observable<any> {
    return this.http
      .delete<any>(`${this.baseUrl}/promotions/${promotionId}`, this.httpOptions)
      .pipe(
        map((response: any) => {
          return response.success ? response.data : response;
        })
      );
  }

  /**
   * Delete order
   */
  deleteOrder(orderId: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/orders/${orderId}`, this.httpOptions).pipe(
      map((response: any) => {
        return response.success ? response.data : response;
      })
    );
  }

  /**
   * Get all product groups
   */
  getProductGroups(): Observable<string[]> {
    return this.http.get<any>(`${this.baseUrl}/products/metadata/groups`).pipe(
      map((response: any) => {
        return response.success ? response.data : [];
      })
    );
  }

  /**
   * Create product group and assign to products
   */
  createProductGroup(groupName: string, skus: string[]): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/products/groups`,
      {
        groupName,
        skus,
      },
      this.httpOptions
    );
  }

  /**
   * Add or remove group from a product
   */
  updateProductGroup(sku: string, action: 'add' | 'remove', groupName: string): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/products/groups/product/${sku}`,
      {
        action,
        groupName,
      },
      this.httpOptions
    );
  }

  /**
   * Delete a product group from all products
   */
  deleteProductGroup(groupName: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/products/groups/${encodeURIComponent(groupName)}`,
      this.httpOptions
    );
  }
}
