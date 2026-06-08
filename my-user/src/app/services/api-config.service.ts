import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiConfigService {
  private baseApiUrl: string;

  constructor() {
    // Use environment config, fallback to localhost for dev
    this.baseApiUrl = environment.apiUrl || 'http://localhost:3000';
  }

  getBaseApiUrl(): string {
    return this.baseApiUrl;
  }

  getApiEndpoint(endpoint: string): string {
    return `${this.baseApiUrl}/api${endpoint}`;
  }
}
