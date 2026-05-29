import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
 // Initialize footer animations and interactions 
    this.initializeFooterAnimations();
  }

 // ======================================================= 
 // NAVIGATION METHODS 
 // ======================================================= 
  
 /** 
 * Navigate to different sections/pages 
 * @param section - The section to navigate to 
 */ 
  navigateToLink(section: string): void {
 console.log(`Navigating to: ${section}`); 
    
 // Define navigation routes 
    const routes: { [key: string]: string } = {
      'about': '/about',
      'products': '/products',
      'contact': '/contact',
      'faq': '/faq',
      'order-guide': '/order-guide',
      'return-guide': '/return-guide',
      'return-policy': '/policies/return',
      'privacy-policy': '/policies/privacy',
      'payment-policy': '/policies/payment',
      'delivery-policy': '/policies/delivery',
      'warranty-policy': '/policies/warranty'
    };

    const route = routes[section];
    if (route) {
 // In a real app, you would use Angular Router here 
 // this.router.navigate([route]); 
 console.log(`Would navigate to: ${route}`); 
      
 // For now, just scroll to top 
      this.scrollToTop();
    }
  }

 // ======================================================= 
 // CONTACT METHODS 
 // ======================================================= 
  
 // /** 
 // * Handle phone number click 
 // */ 
 // callPhone(): void { 
 // const phoneNumber = '0123456789'; 
 // console.log(`Calling: ${phoneNumber}`); 
    
 // // Open phone dialer 
 // window.location.href = `tel:${phoneNumber}`; 
 // } 

 // /** 
 // * Handle email click 
 // */ 
 // sendEmail(): void { 
 // const email = 'vgreen@gmail.com'; 
 // const subject = 'Liên hệ từ website VGreen'; 
 // const body = 'Xin chào VGreen team,'; 
    
 // console.log(`Sending email to: ${email}`); 
    
 // // Open email client 
 // const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; 
 // window.location.href = mailtoLink; 
 // } 



 // ======================================================= 
 // UTILITY METHODS 
 // ======================================================= 
  
 /** 
 * Scroll to top of page 
 */ 
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

 /** 
 * Initialize footer animations and interactions 
 */ 
  private initializeFooterAnimations(): void {
 // Add intersection observer for scroll animations 
    this.setupScrollAnimations();
    
 // Add hover effects 
    this.setupHoverEffects();
  }

 /** 
 * Setup scroll-based animations 
 */ 
  private setupScrollAnimations(): void {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

 // Observe guarantee items 
    const guaranteeItems = document.querySelectorAll('.guarantee-item');
    guaranteeItems.forEach(item => {
      observer.observe(item);
    });
  }

 /** 
 * Setup hover effects for interactive elements 
 */ 
  private setupHoverEffects(): void {
 // Add ripple effect to clickable elements 
    const clickableElements = document.querySelectorAll('.clickable, .social-icon, .app-button');
    
    clickableElements.forEach(element => {
      element.addEventListener('click', (event) => {
        this.createRippleEffect(event as MouseEvent, element as HTMLElement);
      });
    });
  }

 /** 
 * Create ripple effect on click 
 * @param event - Mouse event 
 * @param element - Target element 
 */ 
  private createRippleEffect(event: MouseEvent, element: HTMLElement): void {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');

 // Add ripple styles 
    const rippleStyles = `
      .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
      }
      
      @keyframes ripple-animation {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;

 // Add styles if not already added 
    if (!document.querySelector('#ripple-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'ripple-styles';
      styleSheet.textContent = rippleStyles;
      document.head.appendChild(styleSheet);
    }

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

 // Remove ripple after animation 
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

 // ======================================================= 
 // ANALYTICS METHODS (Optional) 
 // ======================================================= 
  
 /** 
 * Track footer interactions for analytics 
 * @param action - The action performed 
 * @param category - The category of action 
 */ 
  private trackInteraction(action: string, category: string): void {
 // In a real app, you would send this to your analytics service 
 console.log(`Analytics: ${category} - ${action}`); 
    
 // Example: Google Analytics 
 // gtag('event', action, { 
 // event_category: category, 
 // event_label: 'footer' 
 // }); 
  }

 /** 
 * Track social media clicks 
 * @param platform - The social media platform 
 */ 
  trackSocialClick(platform: string): void {
    this.trackInteraction('social_click', platform);
  }

 /** 
 * Track app download clicks 
 * @param platform - The platform (ios/android) 
 */ 
  trackAppDownload(platform: string): void {
    this.trackInteraction('app_download_click', platform);
  }

 /** 
 * Track contact method clicks 
 * @param method - The contact method (phone/email) 
 */ 
  trackContactClick(method: string): void {
    this.trackInteraction('contact_click', method);
  }
}