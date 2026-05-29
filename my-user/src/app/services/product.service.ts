import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Product {
  _id: string;
  category: string;
  subcategory: string;
  product_name: string;
  brand: string;
  unit: string;
  price: number;
  sku: string;
  origin: string;
  weight: string;
  ingredients: string;
  usage: string;
  storage: string;
  manufacture_date: string;
  expiry_date: string;
  producer: string;
  safety_warning: string;
  color?: any;
  base_price?: number;
  image: string[];
  rating?: number;
  purchase_count?: number;
  status?: string;
  post_date?: any;
  liked?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl = '/api/products'; // Use proxy configuration
  private productsCache$ = new BehaviorSubject<Product[]>([]);

  constructor(private http: HttpClient) {}

 /**
 * Lấy tất cả sản phẩm
 */
  getAllProducts(): Observable<Product[]> {
 // console.log(' [ProductService] Fetching all products from API...');
    return this.http.get<any>(this.apiUrl).pipe(
      tap((response) => {
 // console.log(` [ProductService] Received ${response.count} products`);
      }),
      map((response) => response.data),
      tap((products) => {
        this.productsCache$.next(products);
      }),
      catchError((error) => {
 // console.error(' [ProductService] Error fetching products:', error);
        return of([]);
      })
    );
  }

 /**
 * Lấy sản phẩm theo ID
 */
  getProductById(id: string): Observable<Product | null> {
 // console.log(` [ProductService] Fetching product with ID: ${id}`);
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => {
 // console.log(` [ProductService] Found product: ${response.data.product_name}`);
      }),
      map((response) => response.data),
      catchError((error) => {
 // console.error(' [ProductService] Error fetching product:', error);
        return of(null);
      })
    );
  }

 /**
 * Lấy sản phẩm theo SKU
 */
  getProductBySku(sku: string): Observable<Product | null> {
 // console.log(` [ProductService] Fetching product with SKU: ${sku}`);
 // First try to find in cache
    const cachedProducts = this.productsCache$.value;
    if (cachedProducts.length > 0) {
      const product = cachedProducts.find((p) => p.sku === sku);
      if (product) {
 // console.log(` [ProductService] Found product in cache: ${product.product_name}`);
        return of(product);
      }
    }

 // If not in cache, fetch from API
    return this.getAllProducts().pipe(
      map((products) => {
        const product = products.find((p) => p.sku === sku);
        if (product) {
 // console.log(` [ProductService] Found product: ${product.product_name}`);
          return product;
        }
 // console.warn(` [ProductService] Product not found with SKU: ${sku}`);
        return null;
      }),
      catchError((error) => {
 // console.error(' [ProductService] Error fetching product by SKU:', error);
        return of(null);
      })
    );
  }

 /**
 * Lấy sản phẩm theo category
 */
  getProductsByCategory(category: string): Observable<Product[]> {
 // console.log(` [ProductService] Fetching products in category: ${category}`);
    return this.http.get<any>(`${this.apiUrl}/category/${category}`).pipe(
      tap((response) => {
 // console.log(` [ProductService] Found ${response.count} products in ${category}`);
      }),
      map((response) => response.data),
      catchError((error) => {
 // console.error(' [ProductService] Error fetching products by category:', error);
        return of([]);
      })
    );
  }

 /**
 * Lấy sản phẩm theo subcategory
 */
  getProductsBySubcategory(category: string, subcategory: string): Observable<Product[]> {
 // console.log(` [ProductService] Fetching products in ${category}/${subcategory}`);
    return this.http.get<any>(`${this.apiUrl}/category/${category}/${subcategory}`).pipe(
      tap((response) => {
 // console.log(` [ProductService] Found ${response.count} products`);
      }),
      map((response) => response.data),
      catchError((error) => {
 // console.error(' [ProductService] Error fetching products by subcategory:', error);
        return of([]);
      })
    );
  }

 /**
 * Lấy cache hiện tại
 */
  getCurrentProducts(): Product[] {
    return this.productsCache$.value;
  }

 /**
 * Observable cho products cache
 */
  getProductsObservable(): Observable<Product[]> {
    return this.productsCache$.asObservable();
  }

 /**
 * Lấy danh sách categories và subcategories từ products
 */
  getCategoriesWithSubcategories(): Observable<{ name: string; subcategories: string[] }[]> {
 // console.log(' [ProductService] Extracting categories from products...');

    return this.getAllProducts().pipe(
      map((products) => {
 // Tạo Map để lưu các category và subcategories
        const categoryMap = new Map<string, Set<string>>();

 // Duyệt qua tất cả sản phẩm để extract categories và subcategories
        products.forEach((product) => {
          const category = product.category || '';
          const subcategory = product.subcategory || '';

          if (category && subcategory) {
            if (!categoryMap.has(category)) {
              categoryMap.set(category, new Set<string>());
            }
            categoryMap.get(category)!.add(subcategory);
          }
        });

 // Chuyển đổi Map thành Array và sắp xếp
        const categories = Array.from(categoryMap.entries())
          .map(([categoryName, subcategorySet]) => {
            const subcategories = Array.from(subcategorySet).sort();
            return {
              name: categoryName,
              subcategories: subcategories,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

 // console.log(' [ProductService] Extracted categories:', categories);
        return categories;
      })
    );
  }
}
