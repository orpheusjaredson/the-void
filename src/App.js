import React, { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [scattered, setScattered] = useState([]); // Scattered messages for the void
  const [cameraOffset, setCameraOffset] = useState(0); // Virtual camera offset
  const prevWidthRef = useRef(window.innerWidth);
  const animationRef = useRef();
  const containerRef = useRef();
  const SCATTER_HEIGHT = viewport.height * 10; // Tall virtual area
  const SPAWN_COUNT = 40; // Number of times to spawn each message
  const ANIMATION_SPEED = 60; // px/sec

  // Firestore listener
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
    });
    return unsubscribe;
  }, []);

  // Update viewport size on resize
  useEffect(() => {
    const handleResize = () => {
      setViewport((prev) => {
        const newWidth = window.innerWidth;
        const oldWidth = prevWidthRef.current;
        setScattered((floaters) =>
          floaters.map((f) => {
            // Calculate ratio of previous X position
            const ratio = oldWidth > f.width ? f.x / (oldWidth - f.width) : 0;
            const newMsgWidth = Math.min(f.width, 0.6 * newWidth, 340);
            const newX = ratio * (newWidth - newMsgWidth);
            return {
              ...f,
              x: Math.max(0, Math.min(newX, newWidth - newMsgWidth)),
              width: newMsgWidth,
            };
          })
        );
        prevWidthRef.current = newWidth;
        return { width: newWidth, height: window.innerHeight };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scatter messages in a tall area
  useEffect(() => {
    if (!messages.length) return;
    const minFontSize = 1.0;
    const maxFontSize = 2.0;
    const maxWidth = Math.min(0.6 * viewport.width, 340);
    const placed = [];
    let nextId = 0;
    function estimateTextHeight(text, fontSize) {
      const charsPerLine = Math.floor(maxWidth / (fontSize * 16));
      const lines = Math.ceil(text.length / charsPerLine);
      return lines * fontSize * 16 * 1.2;
    }
    for (let spawn = 0; spawn < SPAWN_COUNT; spawn++) {
      messages.forEach((msg, idx) => {
        const baseSeed = getSeed(msg.id || "" + idx) + spawn * 100000;
        const fontSize = 1.0 + seededRandom(baseSeed + 2) * (maxFontSize - minFontSize);
        const width = maxWidth;
        const height = estimateTextHeight(msg.text, fontSize);
        const x = seededRandom(baseSeed) * (viewport.width - width);
        const y = seededRandom(baseSeed + 100) * (SCATTER_HEIGHT - height);
        placed.push({
          id: `scattered-${nextId++}`,
          text: msg.text,
          x,
          y,
          fontSize,
          width,
          height,
        });
      });
    }
    setScattered(placed);
    // eslint-disable-next-line
  }, [messages, viewport.width, viewport.height]);

  // Animation: cameraOffset increases over time
  useEffect(() => {
    let last = Date.now();
    let running = true;
    function animate() {
      if (!running) return;
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setCameraOffset((prev) => prev + ANIMATION_SPEED * dt);
      animationRef.current = requestAnimationFrame(animate);
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, [SCATTER_HEIGHT]);

  // Mouse wheel: update cameraOffset
  useEffect(() => {
    const handleWheel = (e) => {
      setCameraOffset((prev) => prev + e.deltaY);
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    await addDoc(collection(db, "messages"), {
      text: trimmed,
      timestamp: serverTimestamp(),
    });
    setInput("");
  };

  // Wrap cameraOffset to keep it in range (for numerical stability)
  const wrappedCameraOffset = ((cameraOffset % SCATTER_HEIGHT) + SCATTER_HEIGHT) % SCATTER_HEIGHT;

  // Only render messages in the visible viewport for performance
  const visibleMessages = scattered.filter((msg) => {
    let y = msg.y - wrappedCameraOffset;
    if (y < -msg.height) y += SCATTER_HEIGHT;
    if (y > SCATTER_HEIGHT - msg.height) y -= SCATTER_HEIGHT;
    return y + msg.height > 0 && y < viewport.height;
  });

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          background: "black",
          overflow: "hidden",
          position: "relative",
        }}
        tabIndex={0}
      >
        {visibleMessages.map((msg) => {
          let y = msg.y - wrappedCameraOffset;
          if (y < -msg.height) y += SCATTER_HEIGHT;
          if (y > SCATTER_HEIGHT - msg.height) y -= SCATTER_HEIGHT;
          return (
            <div
              key={msg.id}
              style={{
                position: "absolute",
                left: msg.x,
                top: y,
                fontSize: `${msg.fontSize}em`,
                color: "white",
                maxWidth: msg.width,
                wordBreak: "break-word",
                pointerEvents: "auto",
                userSelect: "text",
                fontWeight: 400,
                opacity: 0.95,
                lineHeight: 1.2,
                transition: "none",
              }}
            >
              {msg.text}
            </div>
          );
        })}
      </div>
      <form
        onSubmit={sendMessage}
        className="w-full flex items-center px-4 py-3 border-t border-gray-800 bg-black"
        autoComplete="off"
        style={{ position: "sticky", bottom: 0, zIndex: 10 }}
      >
        <input
          className="flex-1 bg-transparent border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-white placeholder-gray-500"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message into the void..."
          autoFocus
        />
        <button
          type="submit"
          className="ml-3 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}