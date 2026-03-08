import { ApplicationConfig, provideZoneChangeDetection, ErrorHandler, Injectable } from '@angular/core';

@Injectable()
class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[EvNote] Unhandled error:', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]
};
