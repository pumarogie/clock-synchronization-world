/**
 * Health Check Endpoint
 * 
 * Used by load balancers, Docker health checks, and monitoring systems
 * to verify the application is running and responsive.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
}

