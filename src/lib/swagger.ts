import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

// Normalize Windows backslashes to forward slashes for glob compatibility
const toGlob = (p: string) => p.replace(/\\/g, '/');

const getBaseDefinition = (title: string, description: string, tags: any[]) => ({
  openapi: '3.0.0',
  info: {
    title,
    version: '1.0.0',
    description,
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Development Server',
    },
  ],
  tags,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the JWT token you received from login. Example: **Bearer eyJhbGci...**',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

const riderTags = [
  { name: 'Rider Auth', description: 'Rider login, forgot-password, reset-password & authentication' },
  { name: 'Rider Profile', description: 'Rider profile, assigned vehicle & performance stats' },
  { name: 'Rider Actions', description: 'Accept, arrive, start, complete rides, pending rides, status toggle, location sync & earnings' },
];

const customerTags = [
  { name: 'Customer Auth', description: 'Customer registration & login' },
  { name: 'Customer Profile', description: 'Customer profile management' },
  { name: 'Customer Ride', description: 'Ride status, cancel, rate & history' },
  { name: 'Customer Actions', description: 'Fare estimate & ride actions' },
  { name: 'Ride Booking', description: 'Book a new ride (Customer)' },
];

export const getApiDocs = (type: 'rider' | 'customer' | 'all' = 'all') => {
  let apis: string[] = [];
  let definition;

  if (type === 'rider') {
    apis = [
      toGlob(path.join(process.cwd(), 'src/app/api/rider-app/**/*.ts')),
    ];
    definition = getBaseDefinition(
      'Kandi Rider App API — React Native Reference',
      'Complete API documentation for the Kandi Rider mobile app (React Native). Includes authentication, profile, ride lifecycle, GPS location sync, and earnings endpoints.',
      riderTags
    );
  } else if (type === 'customer') {
    apis = [
      toGlob(path.join(process.cwd(), 'src/app/api/customer-app/**/*.ts')),
      toGlob(path.join(process.cwd(), 'src/app/api/book-ride/**/*.ts')),
    ];
    definition = getBaseDefinition(
      'Kandi Customer App API',
      'API documentation specifically for the Kandi Customer App.',
      customerTags
    );
  } else {
    apis = [
      toGlob(path.join(process.cwd(), 'src/app/api/**/*.ts')),
      toGlob(path.join(process.cwd(), 'src/app/api/*.ts')),
    ];
    definition = getBaseDefinition(
      'Kandi Full API Docs',
      'Complete API documentation for all Kandi APIs.',
      [...riderTags, ...customerTags, { name: 'Auth', description: 'Common authentication (find-role)' }]
    );
  }

  return swaggerJsdoc({ definition, apis });
};