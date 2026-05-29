import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// Interface cho Blog Post - Khớp với MongoDB schema
interface BlogPost {
  id: string; // MongoDB: id
  img: string; // MongoDB: img
  title: string; // MongoDB: title
  excerpt: string; // MongoDB: excerpt
  pubDate: string | Date; // MongoDB: pubDate (Date)
  author: string; // MongoDB: author
  categoryTag: string; // MongoDB: categoryTag
  content: string; // MongoDB: content
  status?: string; // MongoDB: status (Active/Draft/Archived)
  views?: number; // MongoDB: views
  createdAt?: Date; // MongoDB: createdAt
  updatedAt?: Date; // MongoDB: updatedAt
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, FormsModule],
  templateUrl: './blog.html',
  styleUrls: ['./blog.css'],
})
export class Blog implements OnInit, AfterViewInit {
  // Dữ liệu blog
  allBlogs: BlogPost[] = [];
  displayedBlogs: BlogPost[] = [];
  featuredPost: BlogPost | null = null;

  // Pagination
  currentPage = 1;
  postsPerPage = 9;
  totalPages = 0;

  // Load more functionality
  hasMorePosts = false;
  isLoadingMore = false;
  displayedPostsCount = 9; // Số bài viết hiện đang hiển thị

  // Search và Filter
  searchTerm = '';
  selectedCategory = '';
  categories: string[] = [];

  // Loading states
  isLoading = true;
  error = '';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadBlogData();
  }

  ngAfterViewInit(): void {
    // Scroll state sẽ được restore trong loadBlogData() sau khi blogs đã load xong
  }

  // Load dữ liệu từ backend API
  loadBlogData(): void {
    this.isLoading = true;
    this.error = '';

    // Load data từ backend API sử dụng subscribe thay vì toPromise
    this.http.get<{ success: boolean; data: BlogPost[]; count: number }>('/api/blogs').subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          // Map và convert pubDate nếu cần, và normalize blog IDs
          this.allBlogs = response.data.map((blog) => {
            // Normalize ID: trim và loại bỏ dấu phẩy thừa
            let normalizedId = blog.id;
            if (normalizedId && typeof normalizedId === 'string') {
              normalizedId = normalizedId.trim().replace(/,$/, '').trim();
            }

            // Đảm bảo pubDate là string ISO
            let pubDateStr = blog.pubDate;
            if (pubDateStr instanceof Date) {
              pubDateStr = pubDateStr.toISOString();
            } else if (typeof pubDateStr === 'string') {
              // Nếu đã là string, giữ nguyên
              pubDateStr = pubDateStr;
            } else {
              // Fallback
              pubDateStr = new Date().toISOString();
            }

            return {
              ...blog,
              id: normalizedId, // Sử dụng ID đã normalize
              pubDate: pubDateStr,
            };
          });

          this.setupBlogData();
          this.isLoading = false;
          // Restore scroll state sau khi blogs đã load xong
          setTimeout(() => {
            this.restoreScrollState();
          }, 100);
        } else {
          this.error = 'Không thể tải dữ liệu blog. Vui lòng thử lại sau.';
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error(' [Blog] Error loading from backend:', err);
        this.error = 'Không thể tải dữ liệu blog. Vui lòng thử lại sau.';

        // Fallback: thử load từ JSON nếu backend lỗi
        this.http.get<BlogPost[]>('../../data/blog.json').subscribe({
          next: (fallbackResponse) => {
            if (fallbackResponse) {
              this.allBlogs = fallbackResponse;
              this.setupBlogData();
              this.error = '';
              this.isLoading = false;
              // Restore scroll state sau khi blogs đã load xong
              setTimeout(() => {
                this.restoreScrollState();
              }, 100);
            }
          },
          error: (fallbackErr) => {
            console.error(' [Blog] Fallback also failed:', fallbackErr);
            this.isLoading = false;
          },
        });
      },
    });
  }

  // Setup dữ liệu sau khi load
  setupBlogData() {
    // Sắp xếp theo ngày đăng mới nhất
    this.allBlogs.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Lấy bài viết đầu tiên làm featured post
    this.featuredPost = this.allBlogs[0];

    // Lấy danh sách categories
    this.categories = [...new Set(this.allBlogs.map((blog) => blog.categoryTag))];

    // Setup pagination
    this.updatePagination();
  }

  // Cập nhật pagination
  updatePagination() {
    const filteredBlogs = this.getFilteredBlogs();
    this.totalPages = Math.ceil(filteredBlogs.length / this.postsPerPage);
    this.currentPage = 1;
    this.displayedPostsCount = 9; // Reset về 9 bài viết ban đầu
    this.updateDisplayedBlogs();
    this.updateHasMorePosts();
  }

  // Lấy danh sách blog đã filter
  getFilteredBlogs(): BlogPost[] {
    let filtered = this.allBlogs;

    // Filter theo category
    if (this.selectedCategory) {
      filtered = filtered.filter((blog) => blog.categoryTag === this.selectedCategory);
    }

    // Filter theo search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (blog) =>
          blog.title.toLowerCase().includes(term) ||
          blog.excerpt.toLowerCase().includes(term) ||
          blog.author.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  // Cập nhật danh sách blog hiển thị
  updateDisplayedBlogs() {
    const filteredBlogs = this.getFilteredBlogs();
    this.displayedBlogs = filteredBlogs.slice(0, this.displayedPostsCount);
    this.updateHasMorePosts();
  }

  // Cập nhật trạng thái có thêm bài viết không
  updateHasMorePosts() {
    const filteredBlogs = this.getFilteredBlogs();
    this.hasMorePosts = this.displayedPostsCount < filteredBlogs.length;
  }

  // Search
  onSearch() {
    this.displayedPostsCount = 9; // Reset về 9 bài viết
    this.updatePagination();
  }

  // Search focus events
  onSearchFocus() {
    this.isSearchFocused = true;
  }

  onSearchBlur() {
    this.isSearchFocused = false;
  }

  // Search state
  isSearchFocused: boolean = false;
  isSearchDropdownOpen: boolean = false;
  searchQuery: string = '';
  searchHistory: string[] = [];
  searchSuggestions: string[] = [];
  // Filter theo category
  onCategoryFilter(category: string) {
    this.selectedCategory = category === this.selectedCategory ? '' : category;
    this.displayedPostsCount = 9; // Reset về 9 bài viết
    this.updatePagination();
  }

  // Format ngày tháng - Xử lý cả Date object và string
  formatDate(dateInput: string | Date): string {
    let date: Date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      date = new Date();
    }

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Scroll to top
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Load thêm bài viết
  loadMorePosts() {
    if (this.isLoadingMore || !this.hasMorePosts) return;

    this.isLoadingMore = true;

    // Tăng số lượng bài viết hiển thị thêm 9 bài
    this.displayedPostsCount += 9;
    this.updateDisplayedBlogs();
    this.isLoadingMore = false;

    // Kiểm tra xem có blogId đang chờ scroll không (khi quay lại từ blog-detail)
    const savedStateStr = localStorage.getItem('blogScrollState');
    const blogIdToScroll = savedStateStr ? JSON.parse(savedStateStr).blogId : null;

    setTimeout(() => {
      // Nếu có blogId đang chờ scroll, scroll đến blog đó thay vì scroll xuống dưới
      if (blogIdToScroll) {
        const savedState = JSON.parse(savedStateStr!);
        this.scrollToBlogWithRetry(blogIdToScroll, savedState.scrollY, 0);
      } else {
        // Scroll xuống dưới để xem bài viết mới (behavior mặc định)
        const postsGrid = document.querySelector('.posts-grid');
        if (postsGrid) {
          postsGrid.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
          });
        }
      }
    }, 50);
  }

  // Lazy loading cho ảnh
  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.opacity = '1';
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial, Helvetica, sans-serif" font-size="16">No Image</text></svg>`
      );
  }

  // -----------------------------
  // 🎯 Scroll State Management (E-commerce UX)
  // -----------------------------
  goToBlogDetail(blogId: string): void {
    // Lưu scroll position và state trước khi navigate
    this.saveScrollState(blogId);
    this.router.navigate(['/blog', blogId]);
  }

  private saveScrollState(blogId?: string): void {
    if (typeof window === 'undefined') return;

    const scrollState = {
      scrollY: window.scrollY || window.pageYOffset || 0,
      blogId: blogId || '', // Lưu blogId để scroll đến sau này
      searchTerm: this.searchTerm,
      selectedCategory: this.selectedCategory,
      displayedPostsCount: this.displayedPostsCount,
      timestamp: Date.now(),
    };

    localStorage.setItem('blogScrollState', JSON.stringify(scrollState));
    // Set flag để biết đang navigate đến blog-detail
    localStorage.setItem('navigatingToBlogDetail', 'true');
    console.log('[Blog] Saved scroll state:', scrollState);
  }

  private restoreScrollState(): void {
    if (typeof window === 'undefined') return;

    const savedStateStr = localStorage.getItem('blogScrollState');
    if (!savedStateStr) {
      console.log('[Blog] No saved scroll state found');
      return;
    }

    try {
      const savedState = JSON.parse(savedStateStr);

      // Chỉ restore nếu state được lưu trong vòng 5 phút (tránh restore state cũ)
      const stateAge = Date.now() - savedState.timestamp;
      if (stateAge > 5 * 60 * 1000) {
        console.log('[Blog] Saved state is too old, clearing it');
        localStorage.removeItem('blogScrollState');
        localStorage.removeItem('navigatingToBlogDetail');
        return;
      }

      // Kiểm tra xem có phải quay lại từ blog-detail không
      const navigatingFlag = localStorage.getItem('navigatingToBlogDetail');
      const isReturningFromDetail =
        navigatingFlag === 'true' || (document.referrer && document.referrer.includes('/blog/'));

      if (!isReturningFromDetail) {
        // Nếu không phải quay lại từ blog-detail, clear state
        console.log('[Blog] Not returning from blog-detail, clearing saved state');
        localStorage.removeItem('blogScrollState');
        localStorage.removeItem('navigatingToBlogDetail');
        return;
      }

      // Clear flag sau khi đã check
      localStorage.removeItem('navigatingToBlogDetail');

      console.log('[Blog] Restoring scroll state:', savedState);

      // Restore state
      this.searchTerm = savedState.searchTerm || this.searchTerm;
      this.selectedCategory = savedState.selectedCategory || this.selectedCategory;
      this.displayedPostsCount =
        savedState.displayedPostsCount !== undefined
          ? savedState.displayedPostsCount
          : this.displayedPostsCount;

      // Apply filters và update displayed blogs với state đã restore
      setTimeout(() => {
        this.updatePagination();

        // Restore scroll position sau khi blogs đã render với hiệu ứng mượt mà
        setTimeout(() => {
          const blogId = savedState.blogId;
          const scrollY = savedState.scrollY || 0;

          // Nếu có blogId, scroll đến blog card cụ thể và highlight
          if (blogId) {
            this.scrollToBlogWithRetry(blogId, scrollY, 0);
          } else if (scrollY > 0) {
            // Fallback: scroll đến vị trí cũ nếu không có blogId
            window.scrollTo({
              top: scrollY,
              behavior: 'smooth',
            });
            console.log('[Blog] Restored scroll position to:', scrollY, 'with smooth animation');
          }
        }, 300); // Delay để đảm bảo blogs đã render hoàn toàn
      }, 200);
    } catch (error) {
      console.error('[Blog] Error restoring scroll state:', error);
      localStorage.removeItem('blogScrollState');
    }
  }

  /**
   * Scroll đến blog card cụ thể dựa trên ID (với retry mechanism)
   * @param blogId - ID của blog post
   * @param fallbackScrollY - Vị trí scroll fallback nếu không tìm thấy blog
   * @param retryCount - Số lần đã retry
   */
  private scrollToBlogWithRetry(
    blogId: string,
    fallbackScrollY?: number,
    retryCount: number = 0
  ): void {
    console.log(`[Blog] Attempting to find blog card (retry ${retryCount}):`, blogId);

    // Kiểm tra xem blog có tồn tại trong allBlogs không
    const blogExists = this.allBlogs.some((b) => b.id === blogId);
    if (!blogExists) {
      console.log('[Blog] Blog not found in allBlogs:', blogId);
      if (fallbackScrollY && fallbackScrollY > 0) {
        window.scrollTo({
          top: fallbackScrollY,
          behavior: 'smooth',
        });
      }
      return;
    }

    // Kiểm tra xem blog có trong displayedBlogs chưa, nếu chưa thì load thêm
    const blogInDisplayed = this.displayedBlogs.some((b) => b.id === blogId);
    if (!blogInDisplayed && this.hasMorePosts) {
      // Blog chưa được load, cần load thêm
      console.log('[Blog] Blog not in displayed blogs, loading more...');
      const filteredBlogs = this.getFilteredBlogs();
      const blogIndex = filteredBlogs.findIndex((b) => b.id === blogId);

      if (blogIndex >= 0) {
        // Tính toán số lượng blog cần load để hiển thị blog này
        const neededCount = Math.min(blogIndex + 1, filteredBlogs.length);
        if (neededCount > this.displayedPostsCount) {
          this.displayedPostsCount = neededCount;
          this.updateDisplayedBlogs();
          // Sau khi load thêm, retry scroll
          setTimeout(() => {
            this.scrollToBlogWithRetry(blogId, fallbackScrollY, retryCount);
          }, 100);
          return;
        }
      }
    }

    // Tìm blog card trong DOM bằng data attribute
    let targetCard: HTMLElement | null = null;

    // Cách 1: Tìm bằng data-blog-id attribute
    targetCard = document.querySelector(`.post-card[data-blog-id="${blogId}"]`) as HTMLElement;

    // Cách 2: Nếu không tìm thấy, thử tìm trong displayedBlogs và match index
    if (!targetCard) {
      const blogIndex = this.displayedBlogs.findIndex((b) => b.id === blogId);
      if (blogIndex >= 0) {
        const allCards = document.querySelectorAll('.post-card');
        if (blogIndex < allCards.length) {
          targetCard = allCards[blogIndex] as HTMLElement;
          console.log(`[Blog] Found blog by index: ${blogIndex}`);
        }
      }
    }

    if (targetCard) {
      // Scroll đến blog card với offset để không bị che bởi header
      const headerOffset = 100; // Offset để không bị che bởi header/sticky elements
      const elementPosition = targetCard.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      console.log('[Blog] Found blog card, scrolling to:', offsetPosition);

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Highlight blog card
      targetCard.classList.add('blog-highlight');
      setTimeout(() => {
        targetCard?.classList.remove('blog-highlight');
      }, 2000);

      console.log('[Blog] Successfully scrolled to blog:', blogId);

      // Clear blogId khỏi saved state sau khi scroll thành công (chỉ khi retryCount === 0)
      // Để tránh scroll lại khi user chủ động click "Xem thêm"
      if (retryCount === 0) {
        const savedStateStr = localStorage.getItem('blogScrollState');
        if (savedStateStr) {
          try {
            const savedState = JSON.parse(savedStateStr);
            if (savedState.blogId === blogId) {
              // Clear blogId để không scroll lại khi click "Xem thêm"
              savedState.blogId = '';
              localStorage.setItem('blogScrollState', JSON.stringify(savedState));
              console.log('[Blog] Cleared blogId from saved state after successful scroll');
            }
          } catch (e) {
            console.error('[Blog] Error clearing blogId:', e);
          }
        }
      }
    } else {
      // Retry nếu chưa tìm thấy và chưa quá 5 lần (tối đa 1 giây delay)
      if (retryCount < 5) {
        console.log(`[Blog] Blog card not found, retrying in 200ms... (${retryCount + 1}/5)`);
        setTimeout(() => {
          this.scrollToBlogWithRetry(blogId, fallbackScrollY, retryCount + 1);
        }, 200); // Retry sau 200ms
      } else {
        // Fallback về scroll position cũ nếu không tìm thấy sau nhiều lần retry
        console.log('[Blog] Blog not found after 5 retries, using fallback scroll position');
        if (fallbackScrollY && fallbackScrollY > 0) {
          window.scrollTo({
            top: fallbackScrollY,
            behavior: 'smooth',
          });
          console.log('[Blog] Restored scroll position to:', fallbackScrollY);
        }
      }
    }
  }
}
