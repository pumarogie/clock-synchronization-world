import { NextResponse } from 'next/server';

export async function GET() {
  // Record the time when the server receives the request
  const serverReceiveTime = Date.now();
  
  // Simulate some processing time (optional, for demonstration)
  // In a real app, there might be database queries or other operations here
  
  // Record the time when the server sends the response
  const serverSendTime = Date.now();
  
  return NextResponse.json({
    // T2: Server receive timestamp
    serverReceiveTime,
    // T3: Server send timestamp  
    serverSendTime,
    // Server's current time (for display purposes)
    serverTime: serverSendTime,
    // Processing time on server
    serverProcessingTime: serverSendTime - serverReceiveTime,
  });
}

export async function POST(request: Request) {
  const serverReceiveTime = Date.now();
  
  try {
    const body = await request.json();
    const { clientSendTime } = body;
    
    const serverSendTime = Date.now();
    
    return NextResponse.json({
      // Client's original send time (T1)
      clientSendTime,
      // Server receive time (T2)
      serverReceiveTime,
      // Server send time (T3)
      serverSendTime,
      // Server processing time
      serverProcessingTime: serverSendTime - serverReceiveTime,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

