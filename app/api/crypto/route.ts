import { NextResponse } from 'next/server';
import WebSocket from 'ws';

const cryptoPairs = ['btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt'];
let lastUpdateTime = Date.now(); // Throttle control

export async function GET() {
    const encoder = new TextEncoder();

    // Create concurrent WebSocket connections
    const wsConnections = await Promise.all(
        cryptoPairs.map(pair => {
            return new Promise<WebSocket>((resolve, reject) => {
                const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@trade`);

                ws.on('open', () => {
                    console.log(`WebSocket connection opened for ${pair}`);
                    resolve(ws); // Resolve the promise once the WebSocket is open
                });

                ws.on('error', (error) => {
                    console.error(`WebSocket error for ${pair}:`, error);
                    reject(error);
                });
            });
        })
    );

    const readable = new ReadableStream({
        start(controller) {
            wsConnections.forEach(ws => {
                ws.on('message', (data: WebSocket.Data) => {
                    // Throttle to update only once per second
                    if (Date.now() - lastUpdateTime >= 1000) {
                        try {
                            const parsedData = JSON.parse(data.toString());
                            if (parsedData && parsedData.s && parsedData.p) {
                                const formattedData = {
                                    symbol: parsedData.s,
                                    price: parseFloat(parsedData.p),
                                };
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(formattedData)}\n\n`));
                            }
                            lastUpdateTime = Date.now();
                        } catch (error) {
                            console.error('Error parsing WebSocket message:', error);
                        }
                    }
                });
            });
        },
        cancel() {
            // Close all WebSocket connections when stream is canceled
            wsConnections.forEach(ws => ws.close());
        }
    });

    return new NextResponse(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
