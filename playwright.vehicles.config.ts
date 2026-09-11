import {defineConfig} from '@playwright/test';
import base from './playwright.config';
// A dedicated, strict port prevents silently testing another modeller's checkout.
const port=Number(process.env.PLAYWRIGHT_PORT || 54531);
export default defineConfig({...base,outputDir:'test-results/vehicles',
  use:{...base.use,baseURL:`http://127.0.0.1:${port}`},
  webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
});
