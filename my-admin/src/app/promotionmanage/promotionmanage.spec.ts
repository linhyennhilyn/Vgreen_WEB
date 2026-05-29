import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PromotionManage } from './promotionmanage';

describe('PromotionManage', () => {
  let component: PromotionManage;
  let fixture: ComponentFixture<PromotionManage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromotionManage, HttpClientTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromotionManage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load promotions on init', () => {
    expect(component.promotions).toBeDefined();
  });

  it('should calculate stats correctly', () => {
    component.promotions = [
      { code: 'TEST1', name: 'Test 1', discountType: 'percentage', discountValue: 10, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active' },
      { code: 'TEST2', name: 'Test 2', discountType: 'fixed', discountValue: 50000, startDate: '2024-01-01', endDate: '2024-12-31', usageCount: 0, status: 'expired' },
      { code: 'TEST3', name: 'Test 3', discountType: 'percentage', discountValue: 20, startDate: '2026-01-01', endDate: '2026-12-31', usageCount: 0, status: 'upcoming' }
    ];
    
    component.calculateStats();
    
    expect(component.activeCount).toBe(1);
    expect(component.expiredCount).toBe(1);
    expect(component.upcomingCount).toBe(1);
  });

  it('should toggle select all', () => {
    component.filteredPromotions = [
      { code: 'TEST1', name: 'Test 1', discountType: 'percentage', discountValue: 10, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active', selected: false },
      { code: 'TEST2', name: 'Test 2', discountType: 'fixed', discountValue: 50000, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active', selected: false }
    ];

    component.toggleSelectAll();

    expect(component.filteredPromotions.every(p => p.selected)).toBe(true);
  });

  it('should format date correctly', () => {
    const formatted = component.formatDate('2025-10-20');
    expect(formatted).toBe('20/10/2025');
  });

  it('should get correct status text', () => {
    expect(component.getStatusText('active')).toBe('Đang diễn ra');
    expect(component.getStatusText('upcoming')).toBe('Sắp diễn ra');
    expect(component.getStatusText('expired')).toBe('Đã kết thúc');
  });

  it('should filter promotions by status', () => {
    component.promotions = [
      { code: 'TEST1', name: 'Test 1', discountType: 'percentage', discountValue: 10, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active' },
      { code: 'TEST2', name: 'Test 2', discountType: 'fixed', discountValue: 50000, startDate: '2024-01-01', endDate: '2024-12-31', usageCount: 0, status: 'expired' }
    ];
    component.filteredPromotions = [...component.promotions];

    component.toggleStatusFilter('active');

    expect(component.filteredPromotions.length).toBe(1);
    expect(component.filteredPromotions[0].status).toBe('active');
  });

  it('should search promotions', () => {
    component.promotions = [
      { code: 'SUMMER2025', name: 'Summer Sale', discountType: 'percentage', discountValue: 10, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active' },
      { code: 'WINTER2025', name: 'Winter Sale', discountType: 'fixed', discountValue: 50000, startDate: '2025-01-01', endDate: '2025-12-31', usageCount: 0, status: 'active' }
    ];
    component.filteredPromotions = [...component.promotions];

    component.searchQuery = 'summer';
    component.applyFiltersAndSearch();

    expect(component.filteredPromotions.length).toBe(1);
    expect(component.filteredPromotions[0].code).toBe('SUMMER2025');
  });
});

