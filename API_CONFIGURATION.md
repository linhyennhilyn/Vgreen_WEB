# VGreen Frontend API Configuration Guide

## Overview

This guide explains how the frontend is configured to work with different backend environments (local development vs. production/Render).

## Architecture

### Environment Configuration

Two environment files control the API URL:
- `my-user/src/environments/environment.ts` - **Development**: `http://localhost:3000`
- `my-user/src/environments/environment.prod.ts` - **Production**: `https://vgreen-web.onrender.com`

Same setup for `my-admin/src/environments/`.

### ApiConfigService

A centralized service that reads the environment configuration and provides the API base URL to all services:

```typescript
// Usage in services
constructor(private apiConfig: ApiConfigService) {
  const apiUrl = this.apiConfig.getApiEndpoint('/auth');  // Returns full API URL
}
```

## Updated Services

The following services have been updated to use `ApiConfigService`:

### my-user
- ✅ `auth.service.ts` - Uses environment-based URLs
- ✅ `address.service.ts` - Uses environment-based URLs for address and tree_complete endpoints
- ⚠️ Other services and components still have hardcoded `localhost:3000` (see below)

### my-admin
- ✅ `auth.service.ts` - Uses environment-based URLs
- ✅ `api.service.ts` - Uses environment-based URLs

## Remaining Hardcoded URLs

The following files still have hardcoded `localhost:3000` and should be updated to use `ApiConfigService`:

### my-user Components
- `vg-blog/blog-detail/blog-detail.ts` - Multiple hardcoded URLs (lines 234, 240, 262, 390, 952)
- `account/orders/orders.ts` - Multiple hardcoded URLs
- `account/sidebar-customer/sidebar-customer.ts` - Line 355
- `account/reviews/reviews.ts` - Multiple hardcoded URLs
- `account/return-management/return-management.ts` - Line 806
- `cart/cart.ts` - Line 453
- `support/support.ts` - Line 320
- `services/order.service.ts` - Line 93
- `services/chat.service.ts` - Line 44
- `services/cart.service.ts` - Line 877
- `services/wishlist.service.ts` - Line 22
- `services/notification.service.ts` - Line 29

### my-admin Components
- `promotionmanage/promotionmanage.ts` - Multiple hardcoded URLs
- `services/notification.service.ts` - Line 31

## How to Update Remaining Files

### Method 1: Inject and Use ApiConfigService (Recommended)

```typescript
// In the component/service constructor
constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

// Replace hardcoded URLs with
this.apiConfig.getApiEndpoint('/endpoint')

// Example:
// OLD: this.http.get('http://localhost:3000/api/orders')
// NEW: this.http.get(this.apiConfig.getApiEndpoint('/orders'))
```

### Method 2: Create a Base Service

If many components make direct HTTP calls, create a base HTTP service that injects ApiConfigService:

```typescript
@Injectable({ providedIn: 'root' })
export class ApiHttpService {
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(this.apiConfig.getApiEndpoint(endpoint));
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(this.apiConfig.getApiEndpoint(endpoint), data);
  }
  // ... etc
}
```

Then use in components:
```typescript
this.apiHttp.get('/orders')
```

## Environment Build Configuration

During Angular build:
- `ng serve` (dev) → Uses `environment.ts` → API calls go to `http://localhost:3000`
- `ng build --configuration production` → Uses `environment.prod.ts` → API calls go to `https://vgreen-web.onrender.com`

## Vercel Deployment

The `vercel.json` file in both `my-user/` and `my-admin/` is configured to:
- Handle client-side routing (SPA rewrites)
- Point to the Render backend URL via environment configuration

## Development Workflow

### Local Development
```bash
# Terminal 1: Start backend (dev server uses localhost:3000)
npm run backend

# Terminal 2: Start frontend (uses http://localhost:3000)
npm run serve  # or cd my-user && npm start
```

### Production Build
```bash
# Build with production environment
cd my-user
ng build --configuration production

# Built files use https://vgreen-web.onrender.com for API calls
```

## Testing Configuration Changes

1. **Test local development**:
   - Start backend on port 3000
   - Run `npm run serve` or `ng serve`
   - Frontend should call `http://localhost:3000`

2. **Test production build**:
   - Run `ng build --configuration production`
   - Check the generated files to verify API calls use Render URL
   - (Or test locally with `ng serve --configuration production`)

## Next Steps

1. ✅ Environment files configured
2. ✅ ApiConfigService created in both frontends
3. ✅ Critical services (auth, api, address) updated
4. ⏳ Update remaining component files to use ApiConfigService
5. ⏳ Test local development workflow
6. ⏳ Test production build
7. ⏳ Deploy to Vercel

## CORS Configuration

The backend (`backend/server.supabase.js`) is configured to allow requests from:
- `http://localhost:4200` (local dev)
- `http://localhost:4201` (alternate local port)
- `vgreen-web.vercel.app` (production my-user)
- `vgreen-web-admin.vercel.app` (production my-admin)

If you change the Vercel project URLs, update the CORS list in the backend.
