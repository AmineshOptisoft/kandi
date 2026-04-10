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
      `Complete API documentation for the Kandi Rider mobile app (React Native). Includes authentication, profile, ride lifecycle, GPS location sync, and earnings endpoints.

### 🔌 Socket.io Realtime Implementation Guide (React Native)

Follow these steps to connect your React Native app with our Socket Server:

#### 1. Setup Connection & Listen for Notifications (On App Mount)
Always initiate the connection when the app starts or the user logs in. **Keep this listener global** so you don't miss any ride request push.

\`\`\`javascript
import { io } from 'socket.io-client';

// Init connection
const socket = io('YOUR_API_BASE_URL', {
  path: '/api/socket/io', // ⚠️ MANDATORY: our custom server path
  transports: ['websocket'],
});

socket.on('connect', () => console.log('Socket Connected:', socket.id));

// 🔔 Listen for ride updates (Ride Assiged, Cancelled etc)
socket.on('notification', (data) => {
  console.log('New Notification Received:', data);
  // Example data: { type: "ride-status-update", orderId: "123", status: "PENDING" }
});
\`\`\`

#### 2. Pushing Live Location (During Shift/Ride)
When the driver goes online and the GPS service is running, send location updates to the server every few seconds.

\`\`\`javascript
// Emit location to the server
socket.emit('update-location', { 
  riderId: 10,  // Active Rider ID
  lat: 28.6139, 
  lng: 77.2090 
});
\`\`\`

#### 3. Receiving Map Movements (On Map Screen)
When you have the map open, listen for location broadcasts to draw/move markers smoothly.

\`\`\`javascript
socket.on('rider-moved', (locationData) => {
  // locationData includes: riderId, lat, lng, area, name
  console.log('Rider Map Position updated:', locationData);
});
\`\`\`
`,
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