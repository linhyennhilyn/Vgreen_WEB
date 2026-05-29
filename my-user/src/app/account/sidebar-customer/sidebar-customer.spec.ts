import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidebarCustomer } from './sidebar-customer';

describe('SidebarCustomer', () => {
  let component: SidebarCustomer;
  let fixture: ComponentFixture<SidebarCustomer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarCustomer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarCustomer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
