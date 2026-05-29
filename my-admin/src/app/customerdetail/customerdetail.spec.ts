import { TestBed } from '@angular/core/testing';
import { CustomerDetail } from './customerdetail';

describe('CustomerDetail', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerDetail],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(CustomerDetail);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});

