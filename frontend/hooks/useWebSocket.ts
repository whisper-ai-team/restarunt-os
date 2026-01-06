"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Order {
    id: string;
    customerName: string;
    customerPhone: string;
    status: string;
    totalAmount: number;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        notes?: string;
    }>;
    createdAt: string;
    cloverOrderId?: string;
}

export function useWebSocket() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);


    useEffect(() => {
        const socketInstance = io("http://localhost:3000");

        socketInstance.on("connect", () => {
            console.log("✅ Connected to server");
            setIsConnected(true);
        });

        socketInstance.on("disconnect", () => {
            console.log("❌ Disconnected");
            setIsConnected(false);
        });

        // Listen for new orders
        socketInstance.on("order:new", (order: Order) => {
            console.log("🆕 New order:", order);
            setOrders((prev) => [order, ...prev]);
        });

        // Initial state
        socketInstance.on("state:orders", (orderList: Order[]) => {
            setOrders(orderList);
        });

        // Fetch initial orders from API
        fetch("http://localhost:3000/api/orders")
            .then(res => res.json())
            .then(data => {
                console.log("📥 Initial orders loaded:", data);
                setOrders(data);
            })
            .catch(err => console.error("Failed to load orders:", err));

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return { socket, isConnected, orders };
}
