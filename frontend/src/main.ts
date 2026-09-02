import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';

// Initialize Vercel Speed Insights
injectSpeedInsights();

// Initialize Vercel Web Analytics
inject();

bootstrapApplication(App, appConfig)
  .then(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error('SW registration failed:', err);
      });
    }
  })
  .catch((err) => console.error(err));
