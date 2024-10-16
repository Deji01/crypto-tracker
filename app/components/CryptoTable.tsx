'use client';

import { formatPrice } from '@/app/utils/formatter';
import { useState, useEffect, useCallback, useRef } from 'react';

type CryptoData = {
    symbol: string;
    price: number;
    prevPrice?: number;
};

export default function CryptoTable() {
    const [cryptoData, setCryptoData] = useState<{ [key: string]: CryptoData }>({});
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null); // Using useRef to manage the EventSource reference

    const connectToEventSource = useCallback(() => {
        const eventSource = new EventSource('/api/crypto');
        eventSourceRef.current = eventSource; // Save the reference to the EventSource

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data && data.symbol && typeof data.price === 'number') {
                    setCryptoData((prevData) => {
                        const newData = { ...prevData };
                        newData[data.symbol] = {
                            symbol: data.symbol,
                            price: data.price,
                            prevPrice: prevData[data.symbol]?.price,
                        };
                        return newData;
                    });
                } else {
                    console.log('Received unexpected data format:', data);
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        eventSource.onerror = () => {
            console.error('EventSource failed. Attempting to reconnect...');
            setError('Failed to connect to the data stream. Attempting to reconnect...');
            eventSource.close();
        };

        return eventSource;
    }, []);

    useEffect(() => {
        connectToEventSource(); // Open connection when component mounts

        const intervalId = setInterval(() => {
            // Close and reopen the EventSource connection every 10 seconds
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            connectToEventSource(); // Reopen connection
        }, 10000); // 10-second interval

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close(); // Cleanup on unmount
            }
            clearInterval(intervalId); // Clear interval on unmount
        };
    }, [connectToEventSource]);

    if (error) {
        return <div className="text-red-500 text-center mt-4">{error}</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (USDT)</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(cryptoData).map((crypto) => (
                        <tr key={crypto.symbol}>
                            <td className="px-6 py-4 whitespace-nowrap">{crypto.symbol}</td>
                            <td className={`px-6 py-4 whitespace-nowrap ${crypto.prevPrice && crypto.price > crypto.prevPrice ? 'text-green-600' :
                                crypto.prevPrice && crypto.price < crypto.prevPrice ? 'text-red-600' : ''
                                }`}>
                                {formatPrice(crypto.price)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {Object.keys(cryptoData).length === 0 && (
                <div className="text-center mt-4">Loading cryptocurrency data...</div>
            )}
        </div>
    );
}
