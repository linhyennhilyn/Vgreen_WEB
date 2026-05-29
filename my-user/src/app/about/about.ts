import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about.html',
  styleUrls: ['./about.css'],
})
export class AboutComponent implements OnInit, OnDestroy, AfterViewInit {
  private intersectionObserver?: IntersectionObserver;
  private parallaxElements: HTMLElement[] = [];
  private countersAnimated = false;

  ngOnInit(): void {
    // Initialize component
  }

  ngAfterViewInit(): void {
    // Initialize all animations and interactions after view is ready
    this.initScrollAnimations();
    this.initParallax();
    this.initSmoothScroll();
    this.initTeamHover();
    this.initCounterAnimation();
  }

  ngOnDestroy(): void {
    // Cleanup observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    // Remove scroll event listeners
    window.removeEventListener('scroll', this.handleParallaxScroll);
  }

  /**
   * Initialize scroll animations using Intersection Observer
   */
  private initScrollAnimations(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
  }

  /**
   * Initialize parallax effect for background images
   */
  private initParallax(): void {
    this.parallaxElements = Array.from(
      document.querySelectorAll('.parallax-section')
    ) as HTMLElement[];

    // Add scroll event listener
    window.addEventListener('scroll', this.handleParallaxScroll.bind(this), { passive: true });
  }

  /**
   * Handle parallax scroll effect
   */
  private handleParallaxScroll(): void {
    const scrolled = window.pageYOffset;

    this.parallaxElements.forEach((element) => {
      const speed = 0.5;
      const yPos = -(scrolled * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  /**
   * Initialize smooth scroll for CTA button
   */
  private initSmoothScroll(): void {
    // Smooth scroll is handled by the scrollToStory method
  }

  /**
   * Scroll to story section when CTA button is clicked
   */
  scrollToStory(): void {
    const storySection = document.getElementById('story');
    if (storySection) {
      const elementPosition = storySection.offsetTop;
      const offsetPosition = elementPosition - 180; // Giảm 100px từ vị trí gốc

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  }

  /**
   * Initialize team member hover effects
   */
  private initTeamHover(): void {
    const members = document.querySelectorAll('.team-member');

    members.forEach((member) => {
      const overlay = member.querySelector('.member-overlay') as HTMLElement;

      if (overlay) {
        member.addEventListener('mouseenter', () => {
          overlay.classList.add('show');
        });

        member.addEventListener('mouseleave', () => {
          overlay.classList.remove('show');
        });
      }
    });
  }

  /**
   * Initialize counter animation for achievements section
   */
  private initCounterAnimation(): void {
    const achievementSection = document.querySelector('.achievements-section');

    if (achievementSection) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !this.countersAnimated) {
            this.animateCounters();
            this.countersAnimated = true;
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );

      observer.observe(achievementSection);
    }
  }

  /**
   * Animate counter numbers from 0 to target value
   */
  private animateCounters(): void {
    const counters = document.querySelectorAll('.achievement-number');

    counters.forEach((counter) => {
      const target = parseInt((counter as HTMLElement).dataset['target'] || '0');
      const duration = 2000; // 2 seconds
      const increment = target / (duration / 16); // 60fps

      let current = 0;

      const updateCounter = (): void => {
        current += increment;

        if (current < target) {
          (counter as HTMLElement).textContent = Math.floor(current).toLocaleString();
          requestAnimationFrame(updateCounter);
        } else {
          (counter as HTMLElement).textContent = target.toLocaleString();
        }
      };

      // Start animation with a small delay for staggered effect
      setTimeout(updateCounter, Math.random() * 500);
    });
  }

  /**
   * Utility method to format numbers with commas
   */
  private formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * Handle window resize for responsive adjustments
   */
  private handleResize(): void {
    // Recalculate parallax elements on resize
    this.parallaxElements = Array.from(
      document.querySelectorAll('.parallax-section')
    ) as HTMLElement[];
  }

  /**
   * Initialize scroll indicator animation
   */
  private initScrollIndicator(): void {
    const scrollIndicator = document.querySelector('.scroll-indicator');

    if (scrollIndicator) {
      // Hide scroll indicator after user starts scrolling
      window.addEventListener(
        'scroll',
        () => {
          if (window.scrollY > 100) {
            (scrollIndicator as HTMLElement).style.opacity = '0';
          } else {
            (scrollIndicator as HTMLElement).style.opacity = '0.8';
          }
        },
        { passive: true }
      );
    }
  }

  /**
   * Add loading states to buttons
   */
  addLoadingState(element: HTMLElement): void {
    element.classList.add('loading');
    element.setAttribute('disabled', 'true');
  }

  /**
   * Remove loading states from buttons
   */
  removeLoadingState(element: HTMLElement): void {
    element.classList.remove('loading');
    element.removeAttribute('disabled');
  }

  /**
   * Smooth scroll to any element by ID
   */
  scrollToElement(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  private initKeyboardNavigation(): void {
    document.addEventListener('keydown', (event) => {
      // Handle Enter key on buttons
      if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) {
        event.target.click();
      }
    });
  }

  /**
   * Initialize lazy loading for images
   */
  private initLazyLoading(): void {
    const images = document.querySelectorAll('img[data-src]');

    if (images.length > 0) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = img.dataset['src'] || '';
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach((img) => imageObserver.observe(img));
    }
  }

  /**
   * Add stagger animation delay to elements
   */
  private addStaggerDelay(): void {
    const fadeInElements = document.querySelectorAll('.fade-in');

    fadeInElements.forEach((element, index) => {
      (element as HTMLElement).style.transitionDelay = `${index * 0.1}s`;
    });
  }

  /**
   * Handle scroll to top functionality
   */
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /**
   * Get current scroll position
   */
  getScrollPosition(): number {
    return window.pageYOffset || document.documentElement.scrollTop;
  }

  /**
   * Check if element is in viewport
   */
  isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Debounce function for performance optimization
   */
  private debounce(func: Function, wait: number): (...args: any[]) => void {
    let timeout: number;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function for scroll events
   */
  private throttle(func: Function, limit: number): (...args: any[]) => void {
    let inThrottle: boolean;
    return (...args: any[]) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Initialize performance optimizations
   */
  private initPerformanceOptimizations(): void {
    // Throttle scroll events
    const throttledParallax = this.throttle(this.handleParallaxScroll.bind(this), 16);
    window.removeEventListener('scroll', this.handleParallaxScroll);
    window.addEventListener('scroll', throttledParallax, { passive: true });

    // Debounce resize events
    const debouncedResize = this.debounce(this.handleResize.bind(this), 250);
    window.addEventListener('resize', debouncedResize);
  }

  /**
   * Initialize accessibility features
   */
  private initAccessibility(): void {
    // Add ARIA labels to interactive elements
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button) => {
      if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
        button.setAttribute('aria-label', 'Button');
      }
    });

    // Add focus indicators
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }
}
