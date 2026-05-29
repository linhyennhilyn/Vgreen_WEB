import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Veebot } from './veebot';

describe('Veebot', () => {
  let component: Veebot;
  let fixture: ComponentFixture<Veebot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Veebot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Veebot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
