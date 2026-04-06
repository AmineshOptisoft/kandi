'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid #334155',
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          🚖
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
            Kandi Ride App — API Docs
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
            React Native Developer Reference &mdash; v1.0.0
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href="/docs/rider"
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            🏍️ Rider APIs
          </a>
          {['Rider Auth', 'Rider Profile', 'Rider Actions', 'Customer Auth', 'Customer Ride'].map((tag) => (
            <span
              key={tag}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Swagger UI */}
      <div
        style={{
          padding: '0',
          background: '#fff',
        }}
      >
        <style>{`
          .swagger-ui .topbar { display: none !important; }
          .swagger-ui .info { padding: 20px 32px 0 !important; }
          .swagger-ui .info .title { font-size: 28px !important; }
          .swagger-ui .scheme-container { padding: 16px 32px !important; background: #f8fafc !important; }
          .swagger-ui .opblock-tag { font-size: 16px !important; font-weight: 600 !important; }
          .swagger-ui .btn.authorize { background: #6366f1 !important; border-color: #6366f1 !important; color: #fff !important; }
          .swagger-ui .btn.authorize svg { fill: #fff !important; }
        `}</style>

        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', background: '#fff' }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <p>Loading API Documentation...</p>
            </div>
          </div>
        }>
          <SwaggerUI
            url="/api/docs"
            persistAuthorization={true}
            tryItOutEnabled={true}
            displayRequestDuration={true}
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={3}
            docExpansion="list"
            filter={true}
          />
        </Suspense>
      </div>
    </div>
  );
}
