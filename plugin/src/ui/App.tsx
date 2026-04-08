import { useEffect, useMemo, useRef, useState } from "react";

type RequestType =
	| "get_document"
	| "get_selection"
	| "get_node"
	| "get_styles"
	| "get_metadata"
	| "get_design_context"
	| "get_variable_defs"
	| "get_screenshot";

type ServerRequest = {
	type: RequestType;
	requestId: string;
	nodeIds?: string[];
	params?: {
		format?: "PNG" | "SVG" | "JPG" | "PDF";
		scale?: number;
		depth?: number;
	};
};

type PluginStatus = {
	fileName: string;
	selectionCount: number;
};

const WS_URL = "ws://localhost:1994/ws";

export default function App() {
	const [connected, setConnected] = useState(false);
	const [status, setStatus] = useState<PluginStatus>({
		fileName: "Unknown file",
		selectionCount: 0,
	});
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<number | null>(null);

	const statusLabel = useMemo(
		() => (connected ? "Connected" : "Disconnected"),
		[connected],
	);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data?.pluginMessage;
			if (!msg) return;

			if (msg.type === "plugin-status") {
				setStatus(msg.payload);
				return;
			}

			if (!("requestId" in msg)) {
				return;
			}

			if (
				!socketRef.current ||
				socketRef.current.readyState !== WebSocket.OPEN
			) {
				return;
			}
			socketRef.current.send(JSON.stringify(msg));
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	useEffect(() => {
		const connect = () => {
			if (socketRef.current) {
				socketRef.current.close();
			}

			const ws = new WebSocket(WS_URL);
			socketRef.current = ws;

			ws.onopen = () => {
				setConnected(true);
				parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
			};

			ws.onclose = () => {
				setConnected(false);
				if (reconnectTimer.current === null) {
					reconnectTimer.current = window.setTimeout(() => {
						reconnectTimer.current = null;
						connect();
					}, 1500);
				}
			};

			ws.onerror = () => {
				setConnected(false);
			};

			ws.onmessage = (event) => {
				const payload = JSON.parse(event.data) as ServerRequest;
				parent.postMessage(
					{ pluginMessage: { type: "server-request", payload } },
					"*",
				);
			};
		};

		connect();

		return () => {
			if (reconnectTimer.current !== null) {
				window.clearTimeout(reconnectTimer.current);
			}
			if (socketRef.current) {
				socketRef.current.close();
			}
		};
	}, []);

	return (
		<div className="container">
			<div className="info-row">
				<span className="info-label">File:</span>
				<span className="info-value">{status.fileName}</span>
			</div>
			<div className="info-row">
				<span className="info-label">Selection:</span>
				<span className="info-value">{status.selectionCount} node(s)</span>
				<div className={`badge ${connected ? "connected" : "disconnected"}`}>
					<span className="dot" />
					<span className="badge-text">{statusLabel}</span>
				</div>
			</div>
		</div>
	);
}
