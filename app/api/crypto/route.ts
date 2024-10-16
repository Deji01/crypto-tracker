import { NextResponse } from 'next/server';
import WebSocket from 'ws';

const cryptoPairs = ['btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt'];

export async function GET() {
    const encoder = new TextEncoder();
    const wsConnections: WebSocket[] = [];
    let streamClosed = false; // Add a flag to track the stream's open state

    const readable = new ReadableStream({
        start(controller) {
            const closeStream = () => {
                if (!streamClosed) {
                    streamClosed = true; // Update the flag when the stream is closed
                    controller.close();
                }
            };

            cryptoPairs.forEach(pair => {
                const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@trade`);

                ws.on('open', () => {
                    console.log(`WebSocket connection opened for ${pair}`);
                });

                ws.on('message', (data: WebSocket.Data) => {
                    try {
                        const parsedData = JSON.parse(data.toString());
                        if (parsedData && parsedData.s && parsedData.p) {
                            const formattedData = {
                                symbol: parsedData.s,
                                price: parseFloat(parsedData.p),
                            };

                            // Only enqueue data if the stream is not closed
                            if (!streamClosed) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(formattedData)}\n\n`));
                            }
                        } else {
                            console.log(`Received unexpected data format for ${pair}:`, parsedData);
                        }
                    } catch (error) {
                        console.error(`Error parsing WebSocket message for ${pair}:`, error);
                    }
                });

                ws.on('error', (error) => {
                    console.error(`WebSocket error for ${pair}:`, error);
                    closeStream();
                });

                ws.on('close', () => {
                    console.log(`WebSocket connection closed for ${pair}`);
                    closeStream();
                });

                wsConnections.push(ws);
            });
        },
        cancel() {
            // When the stream is canceled, close all WebSocket connections
            wsConnections.forEach(ws => ws.close());
            streamClosed = true;
        },
    });

    return new NextResponse(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
