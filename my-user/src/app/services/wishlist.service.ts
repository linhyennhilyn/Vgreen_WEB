import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';

export interface WishlistItem {
  sku: string;
  product_name: string;
  time: Date;
  _id?: string;
}

export interface UserWishlist {
  _id?: string;
  CustomerID: string;
  wishlist: WishlistItem[];
}

@Injectable({
  providedIn: 'root',
})
export class WishlistService {
  private apiUrl = 'http://localhost:3000/api/wishlist';
  private wishlistSubject = new BehaviorSubject<WishlistItem[]>([]);
  public wishlist$ = this.wishlistSubject.asObservable();

  constructor(private http: HttpClient) {}

 // Lấy wishlist của user từ server
  getWishlist(customerID: string): Observable<UserWishlist> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for getWishlist:', customerID);
      return of({ CustomerID: '', wishlist: [] });
    }

 console.log(' [WishlistService] Getting wishlist for customerID:', customerID);

    return this.http.get<any>(`${this.apiUrl}/${customerID}`).pipe(
      map((response) => {
        if (response.success) {
          this.wishlistSubject.next(response.data.wishlist || []);
 console.log(
            ' [WishlistService] Got wishlist:',
            response.data.wishlist?.length || 0,
            'items'
          );
          return response.data;
        }
        return { CustomerID: customerID, wishlist: [] };
      }),
      catchError((error) => {
 console.error(' [WishlistService] Error getting wishlist:', error);
        return of({ CustomerID: customerID, wishlist: [] });
      })
    );
  }

 // Thêm sản phẩm vào wishlist
  addToWishlist(customerID: string, sku: string, productName: string): Observable<boolean> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for addToWishlist:', customerID);
      return of(false);
    }

    if (!sku || sku.trim() === '') {
 console.error(' [WishlistService] Invalid SKU for addToWishlist:', sku);
      return of(false);
    }

    const requestBody = {
      sku: sku,
      product_name: productName,
    };

 console.log(' [WishlistService] Adding to wishlist:', { customerID, sku, productName });
 console.log(' [WishlistService] Request body:', JSON.stringify(requestBody));

    return this.http.post<any>(`${this.apiUrl}/${customerID}/add`, requestBody).pipe(
      map((response) => {
        if (response.success) {
          this.wishlistSubject.next(response.data.wishlist || []);
 console.log(' [WishlistService] Added to wishlist successfully');
          return true;
        }
        return false;
      }),
      catchError((error) => {
 console.error(' [WishlistService] Error adding to wishlist:', error);
        return of(false);
      })
    );
  }

 // Xóa sản phẩm khỏi wishlist
  removeFromWishlist(customerID: string, sku: string): Observable<boolean> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for removeFromWishlist:', customerID);
      return of(false);
    }

    return this.http.delete<any>(`${this.apiUrl}/${customerID}/remove/${sku}`).pipe(
      map((response) => {
        if (response.success) {
          this.wishlistSubject.next(response.data.wishlist || []);
          return true;
        }
        return false;
      }),
      catchError((error) => {
 console.error('Lỗi khi xóa khỏi wishlist:', error);
        return of(false);
      })
    );
  }

 // Kiểm tra sản phẩm có trong wishlist không
  isInWishlist(customerID: string, sku: string): Observable<boolean> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for isInWishlist:', customerID);
      return of(false);
    }

    return this.http.get<any>(`${this.apiUrl}/${customerID}/check/${sku}`).pipe(
      map((response) => {
        return response.success && response.data && response.data.isInWishlist;
      }),
      catchError((error) => {
 console.error('Lỗi khi kiểm tra wishlist:', error);
        return of(false);
      })
    );
  }

 // Toggle wishlist (thêm hoặc xóa)
  toggleWishlist(customerID: string, sku: string, productName: string): Observable<boolean> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for toggleWishlist:', customerID);
      return of(false);
    }

 console.log(' [WishlistService] Toggle wishlist:', { customerID, sku, productName });

    return this.isInWishlist(customerID, sku).pipe(
      map((isInWishlist) => {
        if (isInWishlist) {
          this.removeFromWishlist(customerID, sku).subscribe();
          return false; // Đã xóa
        } else {
          this.addToWishlist(customerID, sku, productName).subscribe();
          return true; // Đã thêm
        }
      }),
      catchError((error) => {
 console.error(' [WishlistService] Toggle error:', error);
        return of(false);
      })
    );
  }

 // Xóa toàn bộ wishlist
  clearWishlist(customerID: string): Observable<boolean> {
    if (!customerID || customerID.trim() === '') {
 console.error(' [WishlistService] Invalid customerID for clearWishlist:', customerID);
      return of(false);
    }

    return this.http.delete<any>(`${this.apiUrl}/${customerID}/clear`).pipe(
      map((response) => {
        if (response.success) {
          this.wishlistSubject.next([]);
          return true;
        }
        return false;
      }),
      catchError((error) => {
 console.error('Lỗi khi xóa wishlist:', error);
        return of(false);
      })
    );
  }

 // Lấy wishlist hiện tại (từ BehaviorSubject)
  getCurrentWishlist(): WishlistItem[] {
    return this.wishlistSubject.value;
  }

 // Đếm số lượng sản phẩm trong wishlist
  getWishlistCount(): number {
    return this.wishlistSubject.value.length;
  }
}
