import { ApiReference } from '@scalar/nextjs-api-reference';

const config = {
  spec: {
    url: '/openapi.json',
  },
  theme: 'default',
  layout: 'modern',
  showSidebar: true,
  customCss: `
    /* Snappd brand colors */
    .scalar-api-client {
      --scalar-color-1: #0EA5E9;
      --scalar-color-2: #06B6D4;
      --scalar-color-3: #3B82F6;
    }
  `,
};

export const GET = ApiReference(config);
