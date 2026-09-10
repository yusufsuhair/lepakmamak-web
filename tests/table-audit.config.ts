import {defineConfig} from '@playwright/test';
import base from '../playwright.config';
const port=Number(process.env.PLAYWRIGHT_PORT||5341);
export default defineConfig({
 ...base,testDir:'.',outputDir:`/tmp/lm-table-audit-${port}`,
 use:{...base.use,baseURL:`http://127.0.0.1:${port}`},
 webServer:{...base.webServer as any,url:`http://127.0.0.1:${port}`,command:`npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,reuseExistingServer:false},
});
